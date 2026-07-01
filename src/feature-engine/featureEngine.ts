import {
  getLatestTradeSnapshot,
  getTradeAnalysisByTradeId,
  getTradeById,
  listTrades,
  upsertTradeFeature,
} from '../db/repositories';
import { PythonTradeContextFeatures, Trade, TradeAnalysis, TradeFeature, TradeSnapshot } from '../types';
import { fetchPythonTradeContextFeatures } from '../services/featureApiService';

const FEATURE_VERSION = 'v3.0-local';
const FEATURE_SOURCE = 'local-feature-engine';
const BACKEND_FEATURE_VERSION = 'v5.0-backend';

type FeatureDraft = Omit<TradeFeature, 'id' | 'createdAt' | 'updatedAt'>;

const nullableFeatureFields: Array<keyof FeatureDraft> = [
  'exitTime',
  'exitPrice',
  'currentPrice',
  'volume',
  'ema',
  'macd',
  'rsi',
  'atr',
  'openInterest',
  'funding',
  'fearGreed',
  'change24h',
  'listingTime',
  'hoursSinceListing',
  'marketVolatility',
  'candlePattern',
  'trend',
  'support',
  'resistance',
  'setupType',
  'setupConfidence',
  'finalPnl',
  'isDisciplineLoss',
  'followedPlan',
];

function isMissing(value: unknown) {
  return value === null || value === undefined || value === '';
}

function calculateDataQualityScore(feature: FeatureDraft) {
  const missingFields = nullableFeatureFields.filter((field) => isMissing(feature[field]));
  const available = nullableFeatureFields.length - missingFields.length;
  const score = Math.round((available / nullableFeatureFields.length) * 100);

  return {
    score,
    missingFields,
  };
}

function calculateMarketVolatility(trade: Trade, analysis: TradeAnalysis | null) {
  if (!analysis || trade.entryPrice <= 0 || analysis.atr <= 0) return null;
  return (analysis.atr / trade.entryPrice) * 100;
}

function buildTradeFeature(
  trade: Trade,
  snapshot: TradeSnapshot | null,
  analysis: TradeAnalysis | null,
): FeatureDraft {
  const generatedAt = new Date().toISOString();
  const base: FeatureDraft = {
    tradeId: trade.id,
    featureVersion: FEATURE_VERSION,
    source: FEATURE_SOURCE,
    symbol: trade.symbol,
    marketType: trade.marketType,
    direction: trade.direction,
    tradeStatus: trade.status,
    entryTime: trade.createdAt,
    exitTime: trade.closedAt ?? trade.reviewedAt,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    currentPrice: snapshot?.currentPrice ?? null,
    positionSize: trade.positionSize,
    leverage: trade.leverage,
    volume: null,
    ema: null,
    macd: null,
    rsi: analysis?.rsi ?? null,
    atr: analysis?.atr ?? null,
    openInterest: null,
    funding: null,
    fearGreed: null,
    change24h: null,
    listingTime: null,
    hoursSinceListing: null,
    marketVolatility: calculateMarketVolatility(trade, analysis),
    candlePattern: null,
    trend: analysis?.trend ?? null,
    support: analysis?.support ?? null,
    resistance: analysis?.resistance ?? null,
    setupType: analysis?.setupType ?? trade.setupType,
    setupConfidence: analysis?.confidence ?? null,
    finalPnl: trade.pnl,
    isDisciplineLoss: trade.lossType === null ? null : trade.lossType === 'discipline_loss',
    followedPlan: trade.followedPlan,
    emotionBefore: trade.emotionBefore,
    isFollowingSystem: trade.isFollowingSystem,
    dataQualityScore: 0,
    missingFieldsJson: '[]',
    generatedAt,
  };
  const quality = calculateDataQualityScore(base);

  return {
    ...base,
    dataQualityScore: quality.score,
    missingFieldsJson: JSON.stringify(quality.missingFields),
  };
}

function buildBackendTradeFeature(
  trade: Trade,
  snapshot: TradeSnapshot | null,
  analysis: TradeAnalysis | null,
  backend: PythonTradeContextFeatures,
): FeatureDraft {
  return {
    tradeId: trade.id,
    featureVersion: BACKEND_FEATURE_VERSION,
    source: backend.source,
    symbol: trade.symbol,
    marketType: trade.marketType,
    direction: trade.direction,
    tradeStatus: trade.status,
    entryTime: trade.createdAt,
    exitTime: trade.closedAt ?? trade.reviewedAt,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    currentPrice: backend.price ?? snapshot?.currentPrice ?? null,
    positionSize: trade.positionSize,
    leverage: trade.leverage,
    volume: backend.volume,
    ema: backend.emaFast ?? backend.emaSlow,
    macd: backend.macd,
    rsi: backend.rsi,
    atr: backend.atr,
    openInterest: null,
    funding: null,
    fearGreed: null,
    change24h: backend.change24h,
    listingTime: null,
    hoursSinceListing: null,
    marketVolatility: backend.volatility,
    candlePattern: backend.candlePattern,
    trend: backend.trendDirection,
    support: analysis?.support ?? null,
    resistance: analysis?.resistance ?? null,
    setupType: analysis?.setupType ?? trade.setupType,
    setupConfidence: analysis?.confidence ?? null,
    finalPnl: trade.pnl,
    isDisciplineLoss: trade.lossType === null ? null : trade.lossType === 'discipline_loss',
    followedPlan: trade.followedPlan,
    emotionBefore: trade.emotionBefore,
    isFollowingSystem: trade.isFollowingSystem,
    dataQualityScore: backend.dataQualityScore,
    missingFieldsJson: JSON.stringify(backend.missingFields),
    generatedAt: backend.generatedAt,
  };
}

async function loadFeatureContext(tradeId: number) {
  const [trade, snapshot, analysis] = await Promise.all([
    getTradeById(tradeId),
    getLatestTradeSnapshot(tradeId),
    getTradeAnalysisByTradeId(tradeId),
  ]);

  if (!trade) throw new Error('Trade not found for feature generation.');

  return {
    trade,
    snapshot,
    analysis,
  };
}

export async function generateTradeFeature(tradeId: number) {
  const { trade, snapshot, analysis } = await loadFeatureContext(tradeId);

  const feature = buildTradeFeature(trade, snapshot, analysis);
  await upsertTradeFeature(feature);
  return feature;
}

export async function generateTradeFeatureFromBackend(tradeId: number) {
  const { trade, snapshot, analysis } = await loadFeatureContext(tradeId);
  const backend = await fetchPythonTradeContextFeatures(trade);

  if (!backend) {
    const feature = buildTradeFeature(trade, snapshot, analysis);
    await upsertTradeFeature(feature);
    return {
      feature,
      source: 'local-fallback' as const,
    };
  }

  const feature = buildBackendTradeFeature(trade, snapshot, analysis, backend);
  await upsertTradeFeature(feature);
  return {
    feature,
    source: 'backend' as const,
  };
}

export async function generateAllTradeFeatures() {
  const trades = await listTrades();
  let generated = 0;

  for (const trade of trades) {
    await generateTradeFeature(trade.id);
    generated += 1;
  }

  return {
    totalTrades: trades.length,
    generated,
  };
}

export async function refreshAllTradeFeaturesFromBackend() {
  const trades = await listTrades();
  let backendEnriched = 0;
  let localFallback = 0;

  for (const trade of trades) {
    const result = await generateTradeFeatureFromBackend(trade.id);
    if (result.source === 'backend') {
      backendEnriched += 1;
    } else {
      localFallback += 1;
    }
  }

  return {
    totalTrades: trades.length,
    backendEnriched,
    localFallback,
  };
}

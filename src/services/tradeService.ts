import { createTrade, getTradeById } from '../db/repositories';
import { generateTradeFeature } from '../feature-engine/featureEngine';
import { CreateQuickTradeInput, MarketType } from '../types';
import { generateAndSaveMockAnalysis } from './analysisService';
import { fetchBackendTicker } from './marketDataService';
import { calculateTradeRiskMetrics } from './risk';
import { createEntrySnapshot } from './snapshotService';
import { createTimelineEvent } from './timelineService';

function inferMarketType(input: CreateQuickTradeInput): MarketType {
  if (input.direction === 'short' || input.leverage > 1) return 'futures';
  return 'spot';
}

export async function createQuickTrade(input: CreateQuickTradeInput): Promise<number> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) throw new Error('Symbol is required.');
  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) throw new Error('Entry price must be valid.');
  if (!Number.isFinite(input.positionSize) || input.positionSize <= 0) throw new Error('Position size must be valid.');
  if (!Number.isFinite(input.leverage) || input.leverage < 1 || input.leverage > 5) {
    throw new Error('Leverage must be between 1 and 5.');
  }
  if (input.stopLossPrice !== null && (!Number.isFinite(input.stopLossPrice) || input.stopLossPrice <= 0)) {
    throw new Error('Stop loss must be empty or a valid price.');
  }
  if (input.takeProfitPrice !== null && (!Number.isFinite(input.takeProfitPrice) || input.takeProfitPrice <= 0)) {
    throw new Error('Take profit must be empty or a valid price.');
  }

  const marketType = inferMarketType(input);
  const backendTicker = await fetchBackendTicker(symbol, marketType);

  const tradeId = await createTrade(
    {
      symbol,
      marketType,
      leverage: input.leverage,
      direction: input.direction,
      entryPrice: input.entryPrice,
      stopLossPrice: input.stopLossPrice ?? 0,
      takeProfitPrice: input.takeProfitPrice,
      positionSize: input.positionSize,
      setupType: 'other',
      entryReason: 'Quick Trade capture',
      emotionBefore: 'calm',
      isFollowingSystem: true,
      screenshotNote: 'Created from V2 Quick Trade.',
    },
    'open',
  );

  const trade = await getTradeById(tradeId);
  if (!trade) throw new Error('Quick Trade was saved, but the trade could not be loaded.');

  await createEntrySnapshot(trade, backendTicker?.price ?? trade.entryPrice);
  await generateAndSaveMockAnalysis(trade);

  await createTimelineEvent({
    tradeId,
    eventType: 'trade_created',
    title: 'Trade Created',
    description: 'Quick Trade record was created with minimal required fields.',
    metadata: { source: 'quick_trade' },
  });
  await createTimelineEvent({
    tradeId,
    eventType: 'snapshot_saved',
    title: 'Snapshot Saved',
    description: backendTicker
      ? 'Entry snapshot was saved with V4 backend public market price.'
      : 'Entry snapshot was saved with entry price because the V4 backend was unavailable.',
    metadata: {
      snapshotType: 'entry',
      marketDataSource: backendTicker ? 'v4_backend_ccxt_public' : 'local_entry_price_fallback',
    },
  });
  await createTimelineEvent({
    tradeId,
    eventType: 'analysis_generated',
    title: 'Analysis Generated',
    description: 'Mock analysis was generated from the saved trade inputs.',
    metadata: { isMock: true },
  });

  const risk = calculateTradeRiskMetrics(trade, 0);
  await createTimelineEvent({
    tradeId,
    eventType: 'risk_calculated',
    title: 'Risk Calculated',
    description: risk.warning,
    metadata: {
      estimatedRiskPercent: risk.estimatedRiskPercent,
      rrRatio: risk.rrRatio,
      stopLossDistancePercent: risk.stopLossDistancePercent,
      takeProfitDistancePercent: risk.takeProfitDistancePercent,
    },
  });

  await generateTradeFeature(tradeId);

  return tradeId;
}

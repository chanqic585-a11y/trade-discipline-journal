import { TradeFeature } from '../types';

const columns: Array<keyof TradeFeature> = [
  'tradeId',
  'featureVersion',
  'source',
  'symbol',
  'marketType',
  'direction',
  'tradeStatus',
  'entryTime',
  'exitTime',
  'entryPrice',
  'exitPrice',
  'currentPrice',
  'positionSize',
  'leverage',
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
  'emotionBefore',
  'isFollowingSystem',
  'dataQualityScore',
  'missingFieldsJson',
  'generatedAt',
  'createdAt',
  'updatedAt',
];

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildTradeFeaturesCsv(features: TradeFeature[]) {
  const header = columns.join(',');
  const rows = features.map((feature) => columns.map((column) => escapeCsvValue(feature[column])).join(','));
  return [header, ...rows].join('\n');
}

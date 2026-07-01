import { SkillResult, Trade, TradeFeature } from '../types';
import {
  FilteredResearchDataset,
  ResearchDataset,
  ResearchFilterOptions,
  ResearchFilters,
  ResearchTimeRange,
  defaultResearchFilters,
} from './researchTypes';

const resultTypes = ['all', 'discipline_loss', 'strategy_loss', 'no_loss', 'unreviewed'];

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function getRangeStart(timeRange: ResearchTimeRange): string | null {
  if (timeRange === 'all') return null;

  const now = new Date();
  const days = timeRange === 'last_7_days' ? 7 : timeRange === 'last_30_days' ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function tradeMatchesResultType(trade: Trade, resultType: string) {
  if (resultType === 'all') return true;
  if (resultType === 'unreviewed') return trade.status !== 'reviewed';
  return trade.lossType === resultType;
}

export function buildFilterOptions(dataset: ResearchDataset): ResearchFilterOptions {
  const setupTypes = uniqueSorted([
    ...dataset.trades.map((trade) => trade.setupType),
    ...dataset.tradeFeatures.map((feature) => feature.setupType ?? 'unknown'),
    'unknown',
  ]);

  return {
    symbols: uniqueSorted(dataset.trades.map((trade) => trade.symbol)),
    setupTypes,
    resultTypes,
  };
}

export function normalizeResearchFilters(filters: Partial<ResearchFilters>): ResearchFilters {
  return {
    ...defaultResearchFilters,
    ...filters,
  };
}

export function applyResearchFilters(
  dataset: ResearchDataset,
  rawFilters: Partial<ResearchFilters>,
): FilteredResearchDataset {
  const filters = normalizeResearchFilters(rawFilters);
  const rangeStart = getRangeStart(filters.timeRange);

  const trades = dataset.trades.filter((trade) => {
    const setupType = trade.setupType || 'unknown';
    if (rangeStart && trade.createdAt < rangeStart) return false;
    if (filters.symbol !== 'all' && trade.symbol !== filters.symbol) return false;
    if (filters.setupType !== 'all' && setupType !== filters.setupType) return false;
    if (!tradeMatchesResultType(trade, filters.resultType)) return false;
    return true;
  });

  const filteredTradeIds = new Set(trades.map((trade) => trade.id));
  const hasTradeLinkedFilters =
    filters.timeRange !== 'all' ||
    filters.symbol !== 'all' ||
    filters.setupType !== 'all' ||
    filters.resultType !== 'all';

  const tradeFeatures = dataset.tradeFeatures.filter((feature) => {
    if (!filteredTradeIds.has(feature.tradeId)) return false;
    if (rangeStart && feature.entryTime < rangeStart) return false;
    if (filters.symbol !== 'all' && feature.symbol !== filters.symbol) return false;
    if (filters.setupType !== 'all' && (feature.setupType ?? 'unknown') !== filters.setupType) return false;
    return true;
  });

  const filterSkillResults = (results: SkillResult[]) =>
    results.filter((result) => {
      if (result.tradeId === null) return !hasTradeLinkedFilters;
      return filteredTradeIds.has(result.tradeId);
    });

  return {
    ...dataset,
    trades,
    tradeFeatures,
    skillResults: filterSkillResults(dataset.skillResults),
    latestSkillResults: filterSkillResults(dataset.latestSkillResults),
    filteredTradeIds,
  };
}

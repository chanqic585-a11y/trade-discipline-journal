import { SkillResult, Trade, TradeFeature } from '../types';
import { applyResearchFilters, buildFilterOptions, normalizeResearchFilters } from './researchFilters';
import { loadResearchDataset } from './researchRepository';
import { buildResearchSummary } from './researchSummary';
import {
  BucketItem,
  FilteredResearchDataset,
  ResearchDashboardData,
  ResearchFilters,
  ResearchOverview,
  SetupPatternResearchRow,
  SkillResearchRow,
  defaultResearchFilters,
} from './researchTypes';

const warningLabels = ['caution', 'weak', 'volatile', 'low_quality_data', 'incomplete_review'];
const dangerLabels = ['risky', 'rule_violation', 'discipline_loss'];

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function percent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (count / total) * 100));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function createBuckets(labels: string[], values: string[]): BucketItem[] {
  const total = values.length;
  return labels.map((label) => {
    const count = values.filter((value) => value === label).length;
    return {
      label,
      count,
      percent: round(percent(count, total)),
    };
  });
}

function mostCommonLabel(labels: Array<string | null>) {
  const counts = new Map<string, number>();
  labels.filter((label): label is string => Boolean(label)).forEach((label) => {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  let winner: string | null = null;
  let winnerCount = 0;
  counts.forEach((count, label) => {
    if (count > winnerCount) {
      winner = label;
      winnerCount = count;
    }
  });
  return winner;
}

function parseMissingFields(feature: TradeFeature) {
  try {
    const parsed = JSON.parse(feature.missingFieldsJson) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function sourceIsBackend(feature: TradeFeature) {
  return feature.source === 'python_feature_engine_v5';
}

function getSkillResultsForSummary(dataset: FilteredResearchDataset) {
  return dataset.latestSkillResults.length > 0 ? dataset.latestSkillResults : dataset.skillResults;
}

export function calculateOverview(dataset: FilteredResearchDataset): ResearchOverview {
  const skillResultsForAverage = getSkillResultsForSummary(dataset);
  const latestSkillRunAt =
    dataset.latestSkillRunSummary.completedAt ??
    dataset.latestSkillRunSummary.startedAt ??
    dataset.skillResults[0]?.createdAt ??
    null;

  return {
    totalTrades: dataset.trades.length,
    reviewedTrades: dataset.trades.filter((trade) => trade.status === 'reviewed').length,
    featureRows: dataset.tradeFeatures.length,
    skillResults: dataset.skillResults.length,
    averageFeatureQuality: round(average(dataset.tradeFeatures.map((feature) => feature.dataQualityScore))),
    averageSkillScore: round(average(skillResultsForAverage.map((result) => result.score))),
    disciplineLossCount: dataset.trades.filter((trade) => trade.lossType === 'discipline_loss').length,
    latestSkillRunAt,
  };
}

export function calculateDataQuality(dataset: FilteredResearchDataset): ResearchDashboardData['dataQuality'] {
  const missingFields = dataset.tradeFeatures.flatMap(parseMissingFields);
  const missingLabels = Array.from(new Set([...missingFields, 'unknown']));
  const labels = missingLabels.length > 0 ? missingLabels : ['unknown'];

  return {
    averageQualityScore: round(average(dataset.tradeFeatures.map((feature) => feature.dataQualityScore))),
    missingFieldCount: missingFields.length,
    commonMissingFields: createBuckets(labels, missingFields.length > 0 ? missingFields : ['unknown'])
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    backendRows: dataset.tradeFeatures.filter(sourceIsBackend).length,
    localRows: dataset.tradeFeatures.filter((feature) => !sourceIsBackend(feature)).length,
    latestGeneratedAt: dataset.dataQualitySummary.latestGeneratedAt,
  };
}

export function calculateSkillSummary(dataset: FilteredResearchDataset): ResearchDashboardData['skillSummary'] {
  const latestResults = dataset.latestSkillResults;
  const summaryResults = getSkillResultsForSummary(dataset);
  const bySkillMap = new Map<string, SkillResult[]>();
  summaryResults.forEach((result) => {
    const group = bySkillMap.get(result.skillId) ?? [];
    group.push(result);
    bySkillMap.set(result.skillId, group);
  });

  const bySkill: SkillResearchRow[] = Array.from(bySkillMap.entries()).map(([skillId, results]) => ({
    skillId,
    skillName: results[0]?.skillName ?? skillId,
    count: results.length,
    averageScore: round(average(results.map((result) => result.score))),
    mostCommonLabel: mostCommonLabel(results.map((result) => result.label)),
  }));

  const labels = summaryResults.map((result) => result.label ?? 'unknown');
  const labelOptions = Array.from(new Set([...labels, 'unknown']));

  return {
    latestRunGroupId: dataset.latestSkillRunSummary.runGroupId,
    latestRunResultCount: latestResults.length,
    allTimeResultCount: dataset.skillResults.length,
    averageScore: round(average(summaryResults.map((result) => result.score))),
    warningCount: summaryResults.filter((result) => warningLabels.includes(result.label ?? '')).length,
    dangerCount: summaryResults.filter((result) => dangerLabels.includes(result.label ?? '')).length,
    bySkill: bySkill.sort((a, b) => b.count - a.count),
    byLabel: createBuckets(labelOptions, labels.length > 0 ? labels : ['unknown']).sort((a, b) => b.count - a.count),
  };
}

export function calculateDisciplineSummary(dataset: FilteredResearchDataset): ResearchDashboardData['discipline'] {
  const reviewed = dataset.trades.filter((trade) => trade.status === 'reviewed');
  const followedPlanKnown = reviewed.filter((trade) => trade.followedPlan !== null);
  const followedPlanCount = followedPlanKnown.filter((trade) => trade.followedPlan).length;

  return {
    disciplineLossCount: dataset.trades.filter((trade) => trade.lossType === 'discipline_loss').length,
    strategyLossCount: dataset.trades.filter((trade) => trade.lossType === 'strategy_loss').length,
    noLossCount: dataset.trades.filter((trade) => trade.lossType === 'no_loss').length,
    incompleteReviewCount: dataset.trades.filter((trade) => trade.status !== 'reviewed' || trade.lossType === null).length,
    followedPlanRate: round(percent(followedPlanCount, followedPlanKnown.length)),
    impulsiveTradeCount: dataset.trades.filter((trade) => trade.impulsiveTrade).length,
    movedStopLossCount: dataset.trades.filter((trade) => trade.movedStopLoss).length,
    addedPositionCount: dataset.trades.filter((trade) => trade.addedPosition).length,
    earlyTakeProfitCount: dataset.trades.filter((trade) => trade.earlyTakeProfit).length,
  };
}

export function calculateSetupPatterns(dataset: FilteredResearchDataset): SetupPatternResearchRow[] {
  const setupTypes = Array.from(new Set([
    ...dataset.trades.map((trade) => trade.setupType ?? 'unknown'),
    ...dataset.tradeFeatures.map((feature) => feature.setupType ?? 'unknown'),
    'unknown',
  ]));

  return setupTypes.map((setupType) => {
    const trades = dataset.trades.filter((trade) => (trade.setupType ?? 'unknown') === setupType);
    const tradeIds = new Set(trades.map((trade) => trade.id));
    const features = dataset.tradeFeatures.filter((feature) => tradeIds.has(feature.tradeId));
    const skillResults = dataset.skillResults.filter((result) => result.tradeId !== null && tradeIds.has(result.tradeId));
    const reviewedTrades = trades.filter((trade) => trade.status === 'reviewed');

    return {
      setupType,
      tradeCount: trades.length,
      reviewedCount: reviewedTrades.length,
      winCount: reviewedTrades.filter((trade) => (trade.pnl ?? 0) > 0).length,
      lossCount: reviewedTrades.filter((trade) => (trade.pnl ?? 0) < 0).length,
      averagePnl: round(average(reviewedTrades.map((trade) => trade.pnl))),
      disciplineLossCount: trades.filter((trade) => trade.lossType === 'discipline_loss').length,
      averageSkillScore: round(average(skillResults.map((result) => result.score))),
      averageFeatureQuality: round(average(features.map((feature) => feature.dataQualityScore))),
    };
  }).sort((a, b) => b.tradeCount - a.tradeCount);
}

function rsiBucket(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  if (value < 30) return 'below_30';
  if (value < 50) return '30_to_50';
  if (value <= 70) return '50_to_70';
  return 'above_70';
}

function volatilityBucket(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  if (value < 2) return 'low';
  if (value < 5) return 'normal';
  if (value < 10) return 'high';
  return 'extreme';
}

function change24hBucket(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  if (value < -5) return 'below_minus_5';
  if (value < 0) return 'minus_5_to_0';
  if (value <= 5) return '0_to_5';
  return 'above_5';
}

function qualityBucket(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  if (value < 50) return 'low';
  if (value < 75) return 'medium';
  return 'high';
}

export function calculateMarketContext(dataset: FilteredResearchDataset): ResearchDashboardData['marketContext'] {
  const features = dataset.tradeFeatures;
  const trendValues = features.map((feature) => feature.trend ?? 'unknown');

  return {
    trendBuckets: createBuckets(['up', 'down', 'flat', 'unknown'], trendValues),
    rsiBuckets: createBuckets(
      ['below_30', '30_to_50', '50_to_70', 'above_70', 'unknown'],
      features.map((feature) => rsiBucket(feature.rsi)),
    ),
    volatilityBuckets: createBuckets(
      ['low', 'normal', 'high', 'extreme', 'unknown'],
      features.map((feature) => volatilityBucket(feature.marketVolatility)),
    ),
    change24hBuckets: createBuckets(
      ['below_minus_5', 'minus_5_to_0', '0_to_5', 'above_5', 'unknown'],
      features.map((feature) => change24hBucket(feature.change24h)),
    ),
    qualityBuckets: createBuckets(
      ['low', 'medium', 'high', 'unknown'],
      features.map((feature) => qualityBucket(feature.dataQualityScore)),
    ),
  };
}

export function buildRecentObservations(dataset: FilteredResearchDataset): ResearchDashboardData['recentObservations'] {
  const source = dataset.latestSkillResults.length > 0 ? dataset.latestSkillResults : dataset.skillResults;
  return source.slice(0, 12).map((result) => ({
    id: result.id,
    skillName: result.skillName,
    symbol: result.symbol,
    label: result.label,
    score: result.score,
    summary: result.summary,
    explanation: result.explanation,
    createdAt: result.createdAt,
  }));
}

export async function buildResearchDashboardData(
  rawFilters: Partial<ResearchFilters> = defaultResearchFilters,
): Promise<ResearchDashboardData> {
  const filters = normalizeResearchFilters(rawFilters);
  const dataset = await loadResearchDataset();
  const filteredDataset = applyResearchFilters(dataset, filters);

  const baseData = {
    filters,
    filterOptions: buildFilterOptions(dataset),
    overview: calculateOverview(filteredDataset),
    dataQuality: calculateDataQuality(filteredDataset),
    skillSummary: calculateSkillSummary(filteredDataset),
    discipline: calculateDisciplineSummary(filteredDataset),
    setupPatterns: calculateSetupPatterns(filteredDataset),
    marketContext: calculateMarketContext(filteredDataset),
    recentObservations: buildRecentObservations(filteredDataset),
  };

  return {
    ...baseData,
    summaryNotes: buildResearchSummary(baseData),
  };
}

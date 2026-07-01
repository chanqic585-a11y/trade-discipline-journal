import { DataQualitySummary, LatestSkillRunSummary, SkillResult, Trade, TradeFeature } from '../types';

export type ResearchTimeRange = 'all' | 'last_7_days' | 'last_30_days' | 'last_90_days';

export interface ResearchFilters {
  timeRange: ResearchTimeRange;
  symbol: string;
  setupType: string;
  resultType: string;
}

export interface ResearchOverview {
  totalTrades: number;
  reviewedTrades: number;
  featureRows: number;
  skillResults: number;
  averageFeatureQuality: number;
  averageSkillScore: number;
  disciplineLossCount: number;
  latestSkillRunAt: string | null;
}

export interface BucketItem {
  label: string;
  count: number;
  percent: number;
}

export interface SetupPatternResearchRow {
  setupType: string;
  tradeCount: number;
  reviewedCount: number;
  winCount: number;
  lossCount: number;
  averagePnl: number;
  disciplineLossCount: number;
  averageSkillScore: number;
  averageFeatureQuality: number;
}

export interface SkillResearchRow {
  skillId: string;
  skillName: string;
  count: number;
  averageScore: number;
  mostCommonLabel: string | null;
}

export interface ResearchObservation {
  id: number;
  skillName: string;
  symbol: string | null;
  label: string | null;
  score: number | null;
  summary: string;
  explanation: string;
  createdAt: string;
}

export interface ResearchDataset {
  trades: Trade[];
  tradeFeatures: TradeFeature[];
  skillResults: SkillResult[];
  latestSkillResults: SkillResult[];
  dataQualitySummary: DataQualitySummary;
  latestSkillRunSummary: LatestSkillRunSummary;
}

export interface FilteredResearchDataset extends ResearchDataset {
  filteredTradeIds: Set<number>;
}

export interface ResearchFilterOptions {
  symbols: string[];
  setupTypes: string[];
  resultTypes: string[];
}

export interface ResearchDashboardData {
  filters: ResearchFilters;
  filterOptions: ResearchFilterOptions;
  summaryNotes: string[];
  overview: ResearchOverview;
  dataQuality: {
    averageQualityScore: number;
    missingFieldCount: number;
    commonMissingFields: BucketItem[];
    backendRows: number;
    localRows: number;
    latestGeneratedAt: string | null;
  };
  skillSummary: {
    latestRunGroupId: string | null;
    latestRunResultCount: number;
    allTimeResultCount: number;
    averageScore: number;
    warningCount: number;
    dangerCount: number;
    bySkill: SkillResearchRow[];
    byLabel: BucketItem[];
  };
  discipline: {
    disciplineLossCount: number;
    strategyLossCount: number;
    noLossCount: number;
    incompleteReviewCount: number;
    followedPlanRate: number;
    impulsiveTradeCount: number;
    movedStopLossCount: number;
    addedPositionCount: number;
    earlyTakeProfitCount: number;
  };
  setupPatterns: SetupPatternResearchRow[];
  marketContext: {
    trendBuckets: BucketItem[];
    rsiBuckets: BucketItem[];
    volatilityBuckets: BucketItem[];
    change24hBuckets: BucketItem[];
    qualityBuckets: BucketItem[];
  };
  recentObservations: ResearchObservation[];
}

export const defaultResearchFilters: ResearchFilters = {
  timeRange: 'all',
  symbol: 'all',
  setupType: 'all',
  resultType: 'all',
};

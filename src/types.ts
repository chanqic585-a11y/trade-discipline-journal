export type MarketType = 'spot' | 'futures';
export type Direction = 'long' | 'short';
export type SetupType =
  | 'new_listing_pullback_breakout'
  | 'volume_breakout_previous_high'
  | 'extreme_fear_rebound'
  | 'other';
export type EmotionBefore = 'calm' | 'anxious' | 'greedy' | 'revenge' | 'fomo';
export type TradeStatus = 'planned' | 'open' | 'watching' | 'closed' | 'reviewed';
export type LossType = 'strategy_loss' | 'discipline_loss' | 'no_loss';
export type AlertType = 'stop_loss' | 'take_profit';
export type SkillCategory =
  | 'entry_quality'
  | 'risk'
  | 'discipline'
  | 'market_context'
  | 'review'
  | 'research';
export type SkillSeverity = 'info' | 'warning' | 'danger' | 'success';
export type SnapshotType = 'entry' | 'update' | 'close';
export type TimelineEventType =
  | 'trade_created'
  | 'snapshot_saved'
  | 'analysis_generated'
  | 'risk_calculated'
  | 'review_completed'
  | 'target_hit'
  | 'stop_loss_hit'
  | 'risk_warning'
  | 'position_closed';

export interface AccountSettings {
  id: number;
  initialBalance: number;
  currentBalance: number;
  maxRiskPerTradePercent: number;
  maxDailyLossPercent: number;
  maxConsecutiveLosses: number;
  reviewReminderTime: string;
  preTradeCheckEnabled: boolean;
  setupCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: number;
  symbol: string;
  marketType: MarketType;
  leverage: number;
  direction: Direction;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number | null;
  positionSize: number;
  setupType: SetupType;
  entryReason: string;
  emotionBefore: EmotionBefore;
  isFollowingSystem: boolean;
  screenshotNote: string;
  status: TradeStatus;
  exitPrice: number | null;
  pnl: number | null;
  followedPlan: boolean | null;
  movedStopLoss: boolean | null;
  addedPosition: boolean | null;
  earlyTakeProfit: boolean | null;
  impulsiveTrade: boolean | null;
  lossType: LossType | null;
  reviewNote: string | null;
  nextImprovement: string | null;
  createdAt: string;
  closedAt: string | null;
  reviewedAt: string | null;
}

export interface AlertLog {
  id: number;
  tradeId: number;
  symbol: string;
  alertType: AlertType;
  triggerPrice: number;
  currentPrice: number;
  message: string;
  createdAt: string;
}

export interface TradeAnalysis {
  id: number;
  tradeId: number;
  trend: string;
  volumeState: string;
  rsi: number;
  atr: number;
  setupType: string;
  confidence: number;
  support: number;
  resistance: number;
  riskWarning: string;
  marketSummary: string;
  isMock: boolean;
  createdAt: string;
}

export interface TradeSnapshot {
  id: number;
  tradeId: number;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  currentPrice: number;
  positionSize: number;
  leverage: number;
  snapshotType: SnapshotType;
  createdAt: string;
}

export interface TradeTimelineEvent {
  id: number;
  tradeId: number;
  eventType: TimelineEventType;
  title: string;
  description: string;
  metadataJson: string;
  createdAt: string;
}

export interface TradeFeature {
  id: number;
  tradeId: number;
  featureVersion: string;
  source: string;
  symbol: string;
  marketType: MarketType;
  direction: Direction;
  tradeStatus: TradeStatus;
  entryTime: string;
  exitTime: string | null;
  entryPrice: number;
  exitPrice: number | null;
  currentPrice: number | null;
  positionSize: number;
  leverage: number;
  volume: number | null;
  ema: number | null;
  macd: number | null;
  rsi: number | null;
  atr: number | null;
  openInterest: number | null;
  funding: number | null;
  fearGreed: number | null;
  change24h: number | null;
  listingTime: string | null;
  hoursSinceListing: number | null;
  marketVolatility: number | null;
  candlePattern: string | null;
  trend: string | null;
  support: number | null;
  resistance: number | null;
  setupType: string | null;
  setupConfidence: number | null;
  finalPnl: number | null;
  isDisciplineLoss: boolean | null;
  followedPlan: boolean | null;
  emotionBefore: EmotionBefore | null;
  isFollowingSystem: boolean | null;
  dataQualityScore: number;
  missingFieldsJson: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillResult {
  id: number;
  skillId: string;
  skillName: string;
  skillVersion: string;
  tradeId: number | null;
  symbol: string | null;
  category: SkillCategory;
  score: number | null;
  label: string | null;
  summary: string;
  explanation: string;
  evidenceJson: string;
  outputJson: string;
  source: string;
  createdAt: string;
}

export interface SkillResultSummary {
  totalResults: number;
  totalSkills: number;
  latestRunAt: string | null;
  averageScore: number;
  warningCount: number;
  dangerCount: number;
}

export interface DataQualitySummary {
  totalTrades: number;
  featureRows: number;
  missingFeatureRows: number;
  averageQualityScore: number;
  backendEnrichedRows: number;
  nullFieldCount: number;
  exportableRows: number;
  latestGeneratedAt: string | null;
}

export interface MarketTicker {
  exchange: string;
  symbol: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  high24h: number | null;
  low24h: number | null;
  volume: number | null;
  quoteVolume: number | null;
  priceChange24h: number | null;
  timestamp: number | null;
  datetime: string | null;
  source: 'ccxt_public';
}

export interface MarketOhlcvCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketOhlcv {
  exchange: string;
  symbol: string;
  timeframe: string;
  limit: number;
  candles: MarketOhlcvCandle[];
  source: 'ccxt_public';
}

export interface MarketFeatures {
  exchange: string;
  symbol: string;
  price: number | null;
  volume: number | null;
  priceChange1h: number | null;
  priceChange4h: number | null;
  priceChange24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volatility: number | null;
  trendDirection: 'up' | 'down' | 'flat' | 'unknown';
  source: 'ccxt_public';
}

export type FeatureTrendDirection = 'up' | 'down' | 'flat' | 'unknown';
export type TrendAlignment = 'aligned' | 'against' | 'neutral' | 'unknown';

export interface PythonMarketFeatures {
  exchange: string;
  symbol: string;
  timeframe: string;
  limit: number;
  price: number | null;
  volume: number | null;
  emaFast: number | null;
  emaSlow: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  rsi: number | null;
  atr: number | null;
  change1h: number | null;
  change4h: number | null;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volatility: number | null;
  trendDirection: FeatureTrendDirection;
  candlePattern: string | null;
  dataQualityScore: number;
  missingFields: string[];
  source: 'python_feature_engine_v5';
  generatedAt: string;
}

export interface PythonTradeContextFeatures extends PythonMarketFeatures {
  entryPrice: number;
  distanceFromEntryPercent: number | null;
  direction: Direction;
  trendAlignment: TrendAlignment;
}

export interface CreateTradeInput {
  symbol: string;
  marketType: MarketType;
  leverage: number;
  direction: Direction;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number | null;
  positionSize: number;
  setupType: SetupType;
  entryReason: string;
  emotionBefore: EmotionBefore;
  isFollowingSystem: boolean;
  screenshotNote: string;
}

export interface CreateQuickTradeInput {
  symbol: string;
  direction: Direction;
  entryPrice: number;
  positionSize: number;
  leverage: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
}

export interface ReviewTradeInput {
  tradeId: number;
  exitPrice: number;
  pnl: number;
  followedPlan: boolean;
  movedStopLoss: boolean;
  addedPosition: boolean;
  earlyTakeProfit: boolean;
  impulsiveTrade: boolean;
  lossType: LossType;
  reviewNote: string;
  nextImprovement: string;
}

export interface DashboardSummary {
  account: AccountSettings;
  todayPnl: number;
  todayTradeCount: number;
  todayConsecutiveLosses: number;
  openTradeCount: number;
  todayRiskPercent: number;
  aiWatch: string;
  disciplineScore: number;
  disciplineScoreReasons: string[];
  canTradeToday: boolean;
  warnings: string[];
}

export interface StatisticsSummary {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  averageWin: number;
  averageLoss: number;
  profitLossRatio: number;
  maxConsecutiveLosses: number;
  disciplineExecutionRate: number;
  disciplineLossCount: number;
  bestSetupType: SetupType | null;
  worstSetupType: SetupType | null;
}

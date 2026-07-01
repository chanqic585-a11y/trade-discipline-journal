export type MarketType = 'spot' | 'futures';
export type Direction = 'long' | 'short';
export type SetupType =
  | 'new_listing_pullback_breakout'
  | 'volume_breakout_previous_high'
  | 'extreme_fear_rebound'
  | 'other';
export type EmotionBefore = 'calm' | 'anxious' | 'greedy' | 'revenge' | 'fomo';
export type TradeStatus = 'planned' | 'open' | 'reviewed';
export type LossType = 'strategy_loss' | 'discipline_loss' | 'no_loss';
export type AlertType = 'stop_loss' | 'take_profit';
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

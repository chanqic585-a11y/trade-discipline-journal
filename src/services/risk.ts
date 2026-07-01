import { getAccountSettings, getLatestTrade, listTradesBetween, listUnreviewedTrades } from '../db/repositories';
import { DashboardSummary, Trade } from '../types';
import { todayRange } from './date';

export function calculateMaxLoss(
  entryPrice: number,
  stopLossPrice: number,
  positionSize: number,
  leverage: number,
) {
  if (entryPrice <= 0 || stopLossPrice <= 0 || positionSize <= 0 || leverage <= 0) return 0;
  return (Math.abs(entryPrice - stopLossPrice) / entryPrice) * positionSize * leverage;
}

export interface TradeRiskMetrics {
  riskAmount: number | null;
  estimatedRiskPercent: number | null;
  rrRatio: number | null;
  stopLossDistancePercent: number | null;
  takeProfitDistancePercent: number | null;
  warning: string;
}

export function calculateTradeRiskMetrics(trade: Trade, accountBalance: number): TradeRiskMetrics {
  const hasStopLoss = trade.stopLossPrice > 0;
  const hasTakeProfit = trade.takeProfitPrice !== null && trade.takeProfitPrice > 0;
  const stopLossDistancePercent = hasStopLoss
    ? (Math.abs(trade.entryPrice - trade.stopLossPrice) / trade.entryPrice) * 100
    : null;
  const takeProfitDistancePercent = hasTakeProfit
    ? (Math.abs(trade.entryPrice - (trade.takeProfitPrice ?? 0)) / trade.entryPrice) * 100
    : null;
  const riskAmount = hasStopLoss
    ? calculateMaxLoss(trade.entryPrice, trade.stopLossPrice, trade.positionSize, trade.leverage)
    : null;
  const estimatedRiskPercent = riskAmount !== null && accountBalance > 0
    ? (riskAmount / accountBalance) * 100
    : null;
  const rewardDistance = hasTakeProfit ? Math.abs((trade.takeProfitPrice ?? 0) - trade.entryPrice) : 0;
  const riskDistance = hasStopLoss ? Math.abs(trade.entryPrice - trade.stopLossPrice) : 0;
  const rrRatio = hasStopLoss && hasTakeProfit && riskDistance > 0 ? rewardDistance / riskDistance : null;

  return {
    riskAmount,
    estimatedRiskPercent,
    rrRatio,
    stopLossDistancePercent,
    takeProfitDistancePercent,
    warning: hasStopLoss && hasTakeProfit
      ? 'Risk calculated from saved entry, stop loss, target, position size, and leverage.'
      : 'Risk calculation requires stop loss / take profit.',
  };
}

export function calculateConsecutiveLosses(trades: Trade[]) {
  let count = 0;
  const reviewedNewestFirst = trades
    .filter((trade) => trade.status === 'reviewed' && trade.pnl !== null)
    .sort((a, b) => (b.reviewedAt ?? b.createdAt).localeCompare(a.reviewedAt ?? a.createdAt));

  for (const trade of reviewedNewestFirst) {
    if ((trade.pnl ?? 0) < 0) count += 1;
    else break;
  }

  return count;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const account = await getAccountSettings();
  const { startIso, endIso } = todayRange();
  const todayTrades = await listTradesBetween(startIso, endIso);
  const unreviewedTrades = await listUnreviewedTrades();
  const latestTrade = await getLatestTrade();

  const todayPnl = todayTrades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
  const todayReviewedTrades = todayTrades.filter((trade) => trade.status === 'reviewed');
  const openTrades = todayTrades.filter((trade) => trade.status !== 'reviewed');
  const todayRiskAmount = openTrades.reduce(
    (sum, trade) => sum + calculateMaxLoss(trade.entryPrice, trade.stopLossPrice, trade.positionSize, trade.leverage),
    0,
  );
  const todayRiskPercent = account.currentBalance > 0 ? (todayRiskAmount / account.currentBalance) * 100 : 0;
  const todayConsecutiveLosses = calculateConsecutiveLosses(todayReviewedTrades);
  const warnings: string[] = [];
  const disciplineScoreReasons: string[] = [];
  let disciplineScore = 100;

  if (Math.abs(Math.min(todayPnl, 0)) > account.currentBalance * (account.maxDailyLossPercent / 100)) {
    warnings.push('今日不建议继续交易，只允许复盘。');
    disciplineScore -= 20;
    disciplineScoreReasons.push('当日亏损超过风控线');
  }

  if (todayConsecutiveLosses >= account.maxConsecutiveLosses) {
    warnings.push('连续亏损已达到停止交易规则。');
    disciplineScore -= 20;
    disciplineScoreReasons.push('连续亏损达到停止交易规则');
  }

  if (unreviewedTrades.length > 0) {
    warnings.push('还有未完成复盘的交易，先复盘再考虑新计划。');
    disciplineScore -= 20;
    disciplineScoreReasons.push('存在未完成复盘');
  }

  if (latestTrade && (!latestTrade.stopLossPrice || latestTrade.stopLossPrice <= 0)) {
    warnings.push('最近一笔交易没有有效止损。');
    disciplineScore -= 20;
    disciplineScoreReasons.push('最近交易缺少有效止损');
  }

  if (todayTrades.some((trade) => !trade.isFollowingSystem)) {
    disciplineScore -= 15;
    disciplineScoreReasons.push('今日存在不符合系统的计划');
  }

  if (todayReviewedTrades.some((trade) => trade.movedStopLoss)) {
    disciplineScore -= 15;
    disciplineScoreReasons.push('今日存在移动止损');
  }

  if (todayReviewedTrades.some((trade) => trade.impulsiveTrade || trade.lossType === 'discipline_loss')) {
    disciplineScore -= 15;
    disciplineScoreReasons.push('今日存在纪律亏损或冲动交易');
  }

  if (warnings.length > 0) {
    warnings.push('你现在想交易，可能不是因为机会，而是因为想回本。');
  }

  return {
    account,
    todayPnl,
    todayTradeCount: todayTrades.length,
    todayConsecutiveLosses,
    openTradeCount: unreviewedTrades.length,
    todayRiskPercent,
    aiWatch: warnings.length > 0
      ? 'Mock Copilot sees discipline pressure today. Review risk state before adding exposure.'
      : 'Mock Copilot sees no blocking discipline warning in today local data.',
    disciplineScore: Math.max(0, Math.min(100, disciplineScore)),
    disciplineScoreReasons,
    canTradeToday: warnings.length === 0,
    warnings,
  };
}

export async function canCreateNewTrade() {
  const summary = await getDashboardSummary();
  return {
    allowed: summary.canTradeToday,
    reason: summary.warnings[0] ?? '',
    summary,
  };
}

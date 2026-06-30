import { getAccountSettings, getLatestTrade, listTradesBetween, listUnreviewedTrades } from '../db/repositories';
import { DashboardSummary, Trade } from '../types';
import { todayRange } from './date';

export function calculateMaxLoss(
  entryPrice: number,
  stopLossPrice: number,
  positionSize: number,
  leverage: number,
) {
  if (entryPrice <= 0 || positionSize <= 0 || leverage <= 0) return 0;
  return (Math.abs(entryPrice - stopLossPrice) / entryPrice) * positionSize * leverage;
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
  const todayConsecutiveLosses = calculateConsecutiveLosses(todayReviewedTrades);
  const warnings: string[] = [];

  if (Math.abs(Math.min(todayPnl, 0)) > account.currentBalance * (account.maxDailyLossPercent / 100)) {
    warnings.push('今日不建议继续交易，只允许复盘。');
  }

  if (todayConsecutiveLosses >= account.maxConsecutiveLosses) {
    warnings.push('连续亏损已达到停止交易规则。');
  }

  if (unreviewedTrades.length > 0) {
    warnings.push('还有未完成复盘的交易，先复盘再考虑新计划。');
  }

  if (latestTrade && (!latestTrade.stopLossPrice || latestTrade.stopLossPrice <= 0)) {
    warnings.push('最近一笔交易没有有效止损。');
  }

  if (warnings.length > 0) {
    warnings.push('你现在想交易，可能不是因为机会，而是因为想回本。');
  }

  return {
    account,
    todayPnl,
    todayTradeCount: todayTrades.length,
    todayConsecutiveLosses,
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

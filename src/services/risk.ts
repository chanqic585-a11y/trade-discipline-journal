import { getAccountSettings, getLatestTrade, listTrades, listTradesBetween, listUnreviewedTrades } from '../db/repositories';
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
  const allTrades = await listTrades();
  const todayTrades = await listTradesBetween(startIso, endIso);
  const unreviewedTrades = await listUnreviewedTrades();
  const latestTrade = await getLatestTrade();

  const todayPnl = todayTrades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
  const todayReviewedTrades = todayTrades.filter((trade) => trade.status === 'reviewed');
  const todayConsecutiveLosses = calculateConsecutiveLosses(todayReviewedTrades);
  const warnings: string[] = [];
  const disciplineScoreReasons: string[] = [];
  let disciplineScore = 100;
  const todayRisk = todayTrades.reduce((sum, trade) => {
    return sum + calculateMaxLoss(trade.entryPrice, trade.stopLossPrice, trade.positionSize, trade.leverage);
  }, 0);
  const todayRiskPercent = account.currentBalance > 0 ? (todayRisk / account.currentBalance) * 100 : 0;
  const systemBase = allTrades.length > 0 ? allTrades : todayTrades;
  const systemComplianceRate =
    systemBase.length === 0
      ? 100
      : (systemBase.filter((trade) => trade.isFollowingSystem).length / systemBase.length) * 100;
  const latestTodayTrade = todayTrades[todayTrades.length - 1] ?? null;
  const currentEmotion = latestTodayTrade ? latestTodayTrade.emotionBefore : null;
  const todayPlanLimit = 3;

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

  const boundedScore = Math.max(0, Math.min(100, disciplineScore));

  return {
    account,
    todayPnl,
    todayTradeCount: todayTrades.length,
    todayConsecutiveLosses,
    disciplineScore: boundedScore,
    disciplineLevel: getDisciplineLevel(boundedScore),
    disciplineScoreReasons,
    todayRiskPercent,
    systemComplianceRate,
    currentEmotion,
    todayPlanLimit,
    dailyReminder: getDailyReminder({
      canTradeToday: warnings.length === 0,
      currentEmotion,
      todayConsecutiveLosses,
      todayRiskPercent,
      todayTradeCount: todayTrades.length,
      todayPlanLimit,
      unreviewedCount: unreviewedTrades.length,
    }),
    canTradeToday: warnings.length === 0,
    warnings,
  };
}

function getDisciplineLevel(score: number) {
  if (score >= 90) return '优秀';
  if (score >= 75) return '稳定';
  if (score >= 60) return '谨慎';
  return '停止';
}

function getDailyReminder(input: {
  canTradeToday: boolean;
  currentEmotion: Trade['emotionBefore'] | null;
  todayConsecutiveLosses: number;
  todayRiskPercent: number;
  todayTradeCount: number;
  todayPlanLimit: number;
  unreviewedCount: number;
}) {
  if (!input.canTradeToday) return '今天只允许复盘，不要开新计划。';
  if (input.unreviewedCount > 0) return '先完成复盘，再考虑新的交易。';
  if (input.currentEmotion === 'revenge') return '今天不要为了回本开单。';
  if (input.currentEmotion === 'fomo') return '今天不要追高。';
  if (input.todayConsecutiveLosses > 0) return '亏损后先降频，避免连续犯错。';
  if (input.todayRiskPercent >= 2) return '今日风险已经接近上限，降低仓位。';
  if (input.todayTradeCount >= input.todayPlanLimit) return '今日计划已满，剩下时间只复盘。';
  return '今天不要追高。';
}

export async function canCreateNewTrade() {
  const summary = await getDashboardSummary();
  return {
    allowed: summary.canTradeToday,
    reason: summary.warnings[0] ?? '',
    summary,
  };
}

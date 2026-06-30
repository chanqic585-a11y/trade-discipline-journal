import { listTrades } from '../db/repositories';
import { SetupType, StatisticsSummary, Trade } from '../types';

function maxConsecutiveLosses(trades: Trade[]) {
  let current = 0;
  let max = 0;
  const reviewedOldestFirst = trades
    .filter((trade) => trade.status === 'reviewed' && trade.pnl !== null)
    .sort((a, b) => (a.reviewedAt ?? a.createdAt).localeCompare(b.reviewedAt ?? b.createdAt));

  for (const trade of reviewedOldestFirst) {
    if ((trade.pnl ?? 0) < 0) {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

function setupExtremes(trades: Trade[]) {
  const totals = new Map<SetupType, number>();
  for (const trade of trades) {
    if (trade.pnl === null) continue;
    totals.set(trade.setupType, (totals.get(trade.setupType) ?? 0) + trade.pnl);
  }

  let bestSetupType: SetupType | null = null;
  let worstSetupType: SetupType | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  let worstValue = Number.POSITIVE_INFINITY;

  totals.forEach((value, key) => {
    if (value > bestValue) {
      bestValue = value;
      bestSetupType = key;
    }
    if (value < worstValue) {
      worstValue = value;
      worstSetupType = key;
    }
  });

  return { bestSetupType, worstSetupType };
}

export async function getStatistics(): Promise<StatisticsSummary> {
  const allTrades = await listTrades();
  const reviewed = allTrades.filter((trade) => trade.status === 'reviewed' && trade.pnl !== null);
  const wins = reviewed.filter((trade) => (trade.pnl ?? 0) > 0);
  const losses = reviewed.filter((trade) => (trade.pnl ?? 0) < 0);
  const totalPnl = reviewed.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
  const totalWin = wins.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
  const totalLossAbs = Math.abs(losses.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0));
  const averageWin = wins.length ? totalWin / wins.length : 0;
  const averageLoss = losses.length ? totalLossAbs / losses.length : 0;
  const disciplineLossCount = reviewed.filter((trade) => trade.lossType === 'discipline_loss').length;
  const followedCount = reviewed.filter((trade) => trade.followedPlan === true).length;
  const { bestSetupType, worstSetupType } = setupExtremes(reviewed);

  return {
    totalTrades: reviewed.length,
    winRate: reviewed.length ? wins.length / reviewed.length : 0,
    totalPnl,
    averageWin,
    averageLoss,
    profitLossRatio: averageLoss > 0 ? averageWin / averageLoss : 0,
    maxConsecutiveLosses: maxConsecutiveLosses(reviewed),
    disciplineExecutionRate: reviewed.length ? followedCount / reviewed.length : 0,
    disciplineLossCount,
    bestSetupType,
    worstSetupType,
  };
}

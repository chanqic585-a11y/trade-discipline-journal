import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { StatCard } from '../components/Controls';
import { listOpenTrades, listRecentTimeline } from '../db/repositories';
import { formatDateTime } from '../services/date';
import { calculatePriceDistance, toOkxInstrumentId } from '../services/priceAlerts';
import { usePriceMonitor } from '../services/PriceMonitorContext';
import { getDashboardSummary } from '../services/risk';
import { DashboardSummary, Trade, TradeTimelineEvent } from '../types';
import { colors, spacing } from '../theme/theme';

export function DashboardScreen({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [timeline, setTimeline] = useState<TradeTimelineEvent[]>([]);
  const { prices } = usePriceMonitor();

  useEffect(() => {
    Promise.all([getDashboardSummary(), listOpenTrades(), listRecentTimeline(3)])
      .then(([nextSummary, nextOpenTrades, nextTimeline]) => {
        setSummary(nextSummary);
        setOpenTrades(nextOpenTrades);
        setTimeline(nextTimeline);
      })
      .catch(console.error);
  }, [refreshKey]);

  if (!summary) {
    return (
      <Screen>
        <Text style={styles.muted}>Loading dashboard...</Text>
      </Screen>
    );
  }

  const danger = !summary.canTradeToday;
  const closestStopLoss = findClosestDistance(openTrades, prices, 'stop_loss');
  const closestTakeProfit = findClosestDistance(openTrades, prices, 'take_profit');

  return (
    <Screen>
      <View style={styles.copilotPanel}>
        <Text style={styles.copilotKicker}>Trading Copilot</Text>
        <Text style={styles.copilotTitle}>AI Watch</Text>
        <Text style={styles.copilotText}>{summary.aiWatch}</Text>
      </View>

      <View style={[styles.statusPanel, danger ? styles.statusDanger : styles.statusOk]}>
        <Text style={[styles.statusTitle, danger && styles.statusTitleDanger]}>
          {summary.canTradeToday ? '今日可以创建计划' : '今日不建议继续交易'}
        </Text>
        <Text style={styles.statusText}>
          {summary.canTradeToday ? '纪律状态正常。仍需先写计划，再执行交易。' : '只允许复盘，先处理风险状态。'}
        </Text>
        {summary.warnings.map((warning) => (
          <Text key={warning} style={styles.warningText}>
            {warning}
          </Text>
        ))}
      </View>

      <View style={[styles.scorePanel, summary.disciplineScore < 80 && styles.scorePanelWarn]}>
        <Text style={styles.scoreLabel}>纪律评分</Text>
        <Text style={[styles.scoreValue, summary.disciplineScore < 80 && styles.scoreValueWarn]}>
          {summary.disciplineScore}
        </Text>
        <Text style={styles.scoreText}>
          {summary.disciplineScoreReasons.length === 0
            ? '今日暂无明显纪律扣分。'
            : summary.disciplineScoreReasons.join(' / ')}
        </Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Open Trades" value={String(summary.openTradeCount)} />
        <StatCard label="Today's Risk" value={`${summary.todayRiskPercent.toFixed(2)}%`} danger={summary.todayRiskPercent >= summary.account.maxRiskPerTradePercent} />
        <StatCard label="Closest Stop Loss" value={closestStopLoss} />
        <StatCard label="Closest Take Profit" value={closestTakeProfit} />
        <StatCard label="当前账户余额" value={summary.account.currentBalance.toFixed(2)} />
        <StatCard label="今日盈亏" value={summary.todayPnl.toFixed(2)} danger={summary.todayPnl < 0} />
        <StatCard label="今日交易次数" value={String(summary.todayTradeCount)} />
        <StatCard
          label="今日连续亏损"
          value={String(summary.todayConsecutiveLosses)}
          danger={summary.todayConsecutiveLosses >= summary.account.maxConsecutiveLosses}
        />
      </View>

      <View style={styles.timelinePanel}>
        <Text style={styles.noteTitle}>Recent Timeline</Text>
        {timeline.length === 0 ? (
          <Text style={styles.noteText}>No trade lifecycle events yet.</Text>
        ) : (
          timeline.map((event) => (
            <View key={event.id} style={styles.timelineItem}>
              <Text style={styles.timelineTitle}>{event.title}</Text>
              <Text style={styles.noteText}>{formatDateTime(event.createdAt)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>MVP boundary</Text>
        <Text style={styles.noteText}>
          本 APP 只记录计划、复盘、风控、统计和 OKX 公共行情提醒；不接交易权限，不自动下单。
        </Text>
      </View>
    </Screen>
  );
}

function findClosestDistance(trades: Trade[], prices: Record<string, number>, type: 'stop_loss' | 'take_profit') {
  const candidates = trades
    .map((trade) => {
      const price = prices[toOkxInstrumentId(trade.symbol, trade.marketType)] ?? trade.entryPrice;
      const distance = calculatePriceDistance(trade, price);
      const value = type === 'stop_loss' ? distance.stopLossPercent : distance.takeProfitPercent;
      return value === null ? null : { symbol: trade.symbol, value };
    })
    .filter((candidate): candidate is { symbol: string; value: number } => candidate !== null)
    .sort((a, b) => a.value - b.value);

  if (candidates.length === 0) return '-';
  const closest = candidates[0];
  if (!closest) return '-';
  return `${closest.symbol} ${closest.value.toFixed(2)}%`;
}

const styles = StyleSheet.create({
  muted: {
    color: colors.muted,
  },
  statusPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  copilotPanel: {
    borderColor: colors.accent,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.accentSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  copilotKicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  copilotTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  copilotText: {
    color: colors.text,
    lineHeight: 20,
  },
  statusOk: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  statusDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  statusTitle: {
    color: colors.success,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  statusTitleDanger: {
    color: colors.danger,
  },
  statusText: {
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  warningText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  scorePanel: {
    borderColor: colors.success,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scorePanelWarn: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  scoreValue: {
    color: colors.success,
    fontSize: 36,
    fontWeight: '800',
    marginTop: 2,
  },
  scoreValueWarn: {
    color: colors.warning,
  },
  scoreText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  note: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  timelinePanel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  timelineItem: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  timelineTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: 3,
  },
  noteTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  noteText: {
    color: colors.muted,
    lineHeight: 20,
  },
});

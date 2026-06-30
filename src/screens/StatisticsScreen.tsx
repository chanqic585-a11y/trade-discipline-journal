import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatCard } from '../components/Controls';
import { Screen } from '../components/Screen';
import { setupTypeLabels } from '../constants';
import { getStatistics } from '../services/statistics';
import { StatisticsSummary } from '../types';
import { colors, spacing } from '../theme/theme';

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function StatisticsScreen({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<StatisticsSummary | null>(null);

  useEffect(() => {
    getStatistics().then(setStats).catch(console.error);
  }, [refreshKey]);

  if (!stats) {
    return (
      <Screen>
        <Text style={styles.muted}>Loading statistics...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.grid}>
        <StatCard label="总交易次数" value={String(stats.totalTrades)} />
        <StatCard label="胜率" value={percent(stats.winRate)} />
        <StatCard label="总盈亏" value={stats.totalPnl.toFixed(2)} danger={stats.totalPnl < 0} />
        <StatCard label="平均盈利" value={stats.averageWin.toFixed(2)} />
        <StatCard label="平均亏损" value={stats.averageLoss.toFixed(2)} danger={stats.averageLoss > 0} />
        <StatCard label="盈亏比" value={stats.profitLossRatio.toFixed(2)} />
        <StatCard label="最大连续亏损" value={String(stats.maxConsecutiveLosses)} danger={stats.maxConsecutiveLosses >= 2} />
        <StatCard label="纪律执行率" value={percent(stats.disciplineExecutionRate)} />
        <StatCard label="纪律亏损次数" value={String(stats.disciplineLossCount)} danger={stats.disciplineLossCount > 0} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Setup result</Text>
        <Text style={styles.panelText}>
          最赚钱：{stats.bestSetupType ? setupTypeLabels[stats.bestSetupType] : '-'}
        </Text>
        <Text style={styles.panelText}>
          最亏钱：{stats.worstSetupType ? setupTypeLabels[stats.worstSetupType] : '-'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  panelText: {
    color: colors.muted,
    lineHeight: 22,
  },
});

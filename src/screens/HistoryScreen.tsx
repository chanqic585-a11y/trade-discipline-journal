import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SegmentedControl } from '../components/Controls';
import { Screen } from '../components/Screen';
import { directionLabels, lossTypeLabels } from '../constants';
import { listTrades } from '../db/repositories';
import { formatDateTime } from '../services/date';
import { Trade } from '../types';
import { colors, spacing } from '../theme/theme';

type Filter = 'all' | 'win' | 'loss' | 'discipline' | 'unreviewed';

export function HistoryScreen({ refreshKey }: { refreshKey: number }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    listTrades().then(setTrades).catch(console.error);
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (filter === 'win') return trades.filter((trade) => (trade.pnl ?? 0) > 0);
    if (filter === 'loss') return trades.filter((trade) => (trade.pnl ?? 0) < 0);
    if (filter === 'discipline') return trades.filter((trade) => trade.lossType === 'discipline_loss');
    if (filter === 'unreviewed') return trades.filter((trade) => trade.status !== 'reviewed');
    return trades;
  }, [filter, trades]);

  return (
    <Screen>
      <SegmentedControl
        label="筛选"
        value={filter}
        options={[
          { value: 'all', label: '全部' },
          { value: 'win', label: '盈利' },
          { value: 'loss', label: '亏损' },
          { value: 'discipline', label: '纪律亏损' },
          { value: 'unreviewed', label: '未复盘' },
        ]}
        onChange={setFilter}
      />

      {filtered.length === 0 ? (
        <Text style={styles.empty}>暂无记录。</Text>
      ) : (
        filtered.map((trade) => (
          <View key={trade.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>{trade.symbol}</Text>
              <Text style={[styles.pnl, (trade.pnl ?? 0) < 0 && styles.pnlLoss]}>
                {trade.status !== 'reviewed' ? '未复盘' : (trade.pnl ?? 0).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.meta}>
              {formatDateTime(trade.createdAt)} · {directionLabels[trade.direction]} · {trade.leverage}x
            </Text>
            <Text style={styles.meta}>
              {trade.lossType ? lossTypeLabels[trade.lossType] : '未定亏损类型'} · 按计划执行：
              {trade.followedPlan === null ? '-' : trade.followedPlan ? '是' : '否'}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.muted,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  pnl: {
    color: colors.success,
    fontWeight: '800',
  },
  pnlLoss: {
    color: colors.danger,
  },
  meta: {
    color: colors.muted,
    marginTop: 5,
  },
});

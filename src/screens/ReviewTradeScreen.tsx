import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Field, SegmentedControl } from '../components/Controls';
import { Screen } from '../components/Screen';
import { directionLabels, lossTypeLabels, lossTypeOptions } from '../constants';
import { listUnreviewedTrades, reviewTrade } from '../db/repositories';
import { formatDateTime } from '../services/date';
import { LossType, Trade } from '../types';
import { colors, spacing } from '../theme/theme';

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function ReviewTradeScreen({ onSaved }: { onSaved: () => void }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exitPrice, setExitPrice] = useState('');
  const [pnl, setPnl] = useState('');
  const [followedPlan, setFollowedPlan] = useState(true);
  const [movedStopLoss, setMovedStopLoss] = useState(false);
  const [addedPosition, setAddedPosition] = useState(false);
  const [earlyTakeProfit, setEarlyTakeProfit] = useState(false);
  const [impulsiveTrade, setImpulsiveTrade] = useState(false);
  const [lossType, setLossType] = useState<LossType>('no_loss');
  const [reviewNote, setReviewNote] = useState('');
  const [nextImprovement, setNextImprovement] = useState('');

  useEffect(() => {
    listUnreviewedTrades()
      .then((items) => {
        setTrades(items);
        setSelectedId(items[0]?.id ?? null);
      })
      .catch(console.error);
  }, []);

  const selectedTrade = trades.find((trade) => trade.id === selectedId) ?? null;

  const saveReview = async () => {
    if (!selectedTrade) return Alert.alert('没有可复盘交易', '请先创建交易计划。');
    const parsedExit = toNumber(exitPrice);
    const parsedPnl = toNumber(pnl);

    if (!Number.isFinite(parsedExit) || parsedExit <= 0) return Alert.alert('出场价无效', '请填写有效出场价。');
    if (!Number.isFinite(parsedPnl)) return Alert.alert('盈亏无效', '请填写实际盈亏。');
    if (!reviewNote.trim()) return Alert.alert('复盘总结必填', '请填写本次复盘总结。');

    await reviewTrade({
      tradeId: selectedTrade.id,
      exitPrice: parsedExit,
      pnl: parsedPnl,
      followedPlan,
      movedStopLoss,
      addedPosition,
      earlyTakeProfit,
      impulsiveTrade,
      lossType,
      reviewNote,
      nextImprovement,
    });
    Alert.alert('复盘完成', '首页和统计已更新。');
    onSaved();
  };

  return (
    <Screen>
      {trades.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>暂无未复盘交易</Text>
          <Text style={styles.emptyText}>创建计划后，交易会出现在这里等待复盘。</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>选择未复盘交易</Text>
          {trades.map((trade) => (
            <TouchableOpacity
              key={trade.id}
              style={[styles.tradeChoice, selectedId === trade.id && styles.tradeChoiceActive]}
              onPress={() => setSelectedId(trade.id)}
            >
              <Text style={styles.tradeTitle}>
                {trade.symbol} · {directionLabels[trade.direction]} · {trade.leverage}x
              </Text>
              <Text style={styles.tradeMeta}>{formatDateTime(trade.createdAt)} · Entry {trade.entryPrice}</Text>
            </TouchableOpacity>
          ))}

          <Field label="出场价" value={exitPrice} onChangeText={setExitPrice} keyboardType="decimal-pad" />
          <Field label="实际盈亏" value={pnl} onChangeText={setPnl} keyboardType="numbers-and-punctuation" />
          <SegmentedControl
            label="是否按计划执行"
            value={followedPlan}
            options={[
              { value: true, label: '是' },
              { value: false, label: '否' },
            ]}
            onChange={setFollowedPlan}
          />
          <SegmentedControl
            label="是否移动止损"
            value={movedStopLoss}
            options={[
              { value: false, label: '否' },
              { value: true, label: '是' },
            ]}
            onChange={setMovedStopLoss}
          />
          <SegmentedControl
            label="是否补仓"
            value={addedPosition}
            options={[
              { value: false, label: '否' },
              { value: true, label: '是' },
            ]}
            onChange={setAddedPosition}
          />
          <SegmentedControl
            label="是否提前止盈"
            value={earlyTakeProfit}
            options={[
              { value: false, label: '否' },
              { value: true, label: '是' },
            ]}
            onChange={setEarlyTakeProfit}
          />
          <SegmentedControl
            label="是否冲动交易"
            value={impulsiveTrade}
            options={[
              { value: false, label: '否' },
              { value: true, label: '是' },
            ]}
            onChange={setImpulsiveTrade}
          />
          <SegmentedControl
            label="亏损类型"
            value={lossType}
            options={lossTypeOptions.map((value) => ({ value, label: lossTypeLabels[value] }))}
            onChange={setLossType}
          />
          <Field label="复盘总结" value={reviewNote} onChangeText={setReviewNote} multiline />
          <Field label="下次改进" value={nextImprovement} onChangeText={setNextImprovement} multiline />
          <Button label="保存复盘" onPress={saveReview} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  tradeChoice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tradeChoiceActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  tradeTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  tradeMeta: {
    color: colors.muted,
    marginTop: 4,
  },
  emptyBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
});

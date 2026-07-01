import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Field, SegmentedControl } from '../components/Controls';
import { directionLabels } from '../constants';
import { getAccountSettings } from '../db/repositories';
import { calculateMaxLoss } from '../services/risk';
import { createQuickTrade } from '../services/tradeService';
import { AccountSettings, Direction } from '../types';
import { colors, spacing } from '../theme/theme';

function toNumber(value: string) {
  if (!value.trim()) return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  return toNumber(value);
}

export function QuickTradeScreen({ onCreated }: { onCreated: (tradeId: number) => void }) {
  const [account, setAccount] = useState<AccountSettings | null>(null);
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<Direction>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAccountSettings().then(setAccount).catch(console.error);
  }, []);

  const riskPreview = useMemo(() => {
    const entry = toNumber(entryPrice);
    const stop = toNumber(stopLossPrice);
    const size = toNumber(positionSize);
    const lev = toNumber(leverage);
    const amount = calculateMaxLoss(entry, stop, size, lev);
    const percent = account && account.currentBalance > 0 ? (amount / account.currentBalance) * 100 : 0;
    return {
      amount,
      percent,
      hasStopLoss: Number.isFinite(stop) && stop > 0,
    };
  }, [account, entryPrice, leverage, positionSize, stopLossPrice]);

  const save = async () => {
    if (saving) return;
    const parsedEntry = toNumber(entryPrice);
    const parsedPosition = toNumber(positionSize);
    const parsedLeverage = toNumber(leverage);
    const parsedStopLoss = optionalNumber(stopLossPrice);
    const parsedTakeProfit = optionalNumber(takeProfitPrice);

    setSaving(true);
    try {
      const tradeId = await createQuickTrade({
        symbol,
        direction,
        entryPrice: parsedEntry,
        positionSize: parsedPosition,
        leverage: parsedLeverage,
        stopLossPrice: parsedStopLoss,
        takeProfitPrice: parsedTakeProfit,
      });
      onCreated(tradeId);
    } catch (error) {
      Alert.alert('Quick Trade failed', error instanceof Error ? error.message : 'Unable to create trade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.kicker}>AI Trading Copilot Foundation</Text>
        <Text style={styles.heroTitle}>Quick Trade</Text>
        <Text style={styles.heroText}>Capture the trade first. Analysis, snapshot, risk, and timeline are generated automatically.</Text>
      </View>

      <View style={styles.riskCard}>
        <Text style={styles.riskLabel}>Estimated risk</Text>
        <Text style={styles.riskValue}>
          {riskPreview.hasStopLoss ? `${riskPreview.percent.toFixed(2)}%` : 'Incomplete'}
        </Text>
        <Text style={styles.riskText}>
          {riskPreview.hasStopLoss
            ? `Risk amount ${riskPreview.amount.toFixed(2)}. This is a local calculation, not a trading signal.`
            : 'Risk calculation requires stop loss / take profit.'}
        </Text>
      </View>

      <Field label="Symbol" value={symbol} onChangeText={setSymbol} placeholder="BTC / ETH / NEWCOIN" autoCapitalize="characters" />
      <SegmentedControl
        label="Direction"
        value={direction}
        options={[
          { value: 'long', label: directionLabels.long },
          { value: 'short', label: directionLabels.short },
        ]}
        onChange={setDirection}
      />
      <Field label="Entry Price" value={entryPrice} onChangeText={setEntryPrice} keyboardType="decimal-pad" />
      <Field label="Position Size" value={positionSize} onChangeText={setPositionSize} keyboardType="decimal-pad" />
      <Field label="Leverage 1-5x" value={leverage} onChangeText={setLeverage} keyboardType="numeric" />
      <Field label="Stop Loss optional" value={stopLossPrice} onChangeText={setStopLossPrice} keyboardType="decimal-pad" />
      <Field label="Take Profit optional" value={takeProfitPrice} onChangeText={setTakeProfitPrice} keyboardType="decimal-pad" />

      <Button label={saving ? 'Creating...' : 'Start Recording'} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  heroText: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  riskCard: {
    borderColor: colors.warning,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  riskLabel: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  riskValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  riskText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
});

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Field, Button, SegmentedControl } from '../components/Controls';
import { Screen } from '../components/Screen';
import { createTrade, getAccountSettings } from '../db/repositories';
import {
  directionLabels,
  emotionLabels,
  emotionOptions,
  marketTypeLabels,
  setupTypeLabels,
  setupTypeOptions,
} from '../constants';
import { calculateMaxLoss, canCreateNewTrade } from '../services/risk';
import { toOkxInstrumentId } from '../services/priceAlerts';
import { Direction, EmotionBefore, MarketType, SetupType } from '../types';
import { colors, spacing } from '../theme/theme';

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function TradePlanScreen({ onSaved }: { onSaved: () => void }) {
  const [symbol, setSymbol] = useState('');
  const [marketType, setMarketType] = useState<MarketType>('spot');
  const [leverageText, setLeverageText] = useState('1');
  const [direction, setDirection] = useState<Direction>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [setupType, setSetupType] = useState<SetupType>('new_listing_pullback_breakout');
  const [entryReason, setEntryReason] = useState('');
  const [emotionBefore, setEmotionBefore] = useState<EmotionBefore>('calm');
  const [isFollowingSystem, setIsFollowingSystem] = useState(true);
  const [screenshotNote, setScreenshotNote] = useState('');
  const [saving, setSaving] = useState(false);
  const effectiveDirection: Direction = marketType === 'spot' ? 'long' : direction;
  const effectiveLeverageText = marketType === 'spot' ? '1' : leverageText;
  const okxInstrumentPreview = symbol.trim() ? toOkxInstrumentId(symbol, marketType) : '-';

  const maxLossPreview = useMemo(() => {
    return calculateMaxLoss(
      toNumber(entryPrice),
      toNumber(stopLossPrice),
      toNumber(positionSize),
      toNumber(effectiveLeverageText),
    );
  }, [entryPrice, stopLossPrice, positionSize, effectiveLeverageText]);

  const savePlan = async () => {
    if (saving) return;
    const leverage = toNumber(effectiveLeverageText);
    const parsedEntry = toNumber(entryPrice);
    const parsedStop = toNumber(stopLossPrice);
    const parsedTakeProfit = takeProfitPrice.trim() ? toNumber(takeProfitPrice) : null;
    const parsedPosition = toNumber(positionSize);

    if (!symbol.trim()) return Alert.alert('缺少币种', '请填写 symbol。');
    if (!stopLossPrice.trim() || !Number.isFinite(parsedStop) || parsedStop <= 0) {
      return Alert.alert('止损必填', '必须填写有效止损价。');
    }
    if (!Number.isFinite(leverage) || leverage < 1 || leverage > 10) {
      return Alert.alert('杠杆限制', '杠杆范围必须是 1 到 10。现货固定为 1x。');
    }
    if (!Number.isFinite(parsedEntry) || parsedEntry <= 0) return Alert.alert('入场价无效', '请填写有效入场价。');
    if (!Number.isFinite(parsedPosition) || parsedPosition <= 0) {
      return Alert.alert('仓位无效', '请填写有效仓位金额。');
    }
    if (parsedTakeProfit !== null && (!Number.isFinite(parsedTakeProfit) || parsedTakeProfit <= 0)) {
      return Alert.alert('止盈价无效', '止盈价需要为空或有效数字。');
    }

    const createCheck = await canCreateNewTrade();
    if (!createCheck.allowed) {
      return Alert.alert('停止交易规则已触发', createCheck.reason || '今日只允许复盘。');
    }

    const account = await getAccountSettings();
    const maxLoss = calculateMaxLoss(parsedEntry, parsedStop, parsedPosition, leverage);
    const maxAllowed = account.currentBalance * (account.maxRiskPerTradePercent / 100);
    if (maxLoss > maxAllowed) {
      return Alert.alert('风险过高', `单笔最大亏损 ${maxLoss.toFixed(2)} 超过账户 ${account.maxRiskPerTradePercent}% 风险限制。`);
    }

    const commit = async () => {
      setSaving(true);
      try {
        await createTrade({
          symbol,
          marketType,
          leverage,
          direction: effectiveDirection,
          entryPrice: parsedEntry,
          stopLossPrice: parsedStop,
          takeProfitPrice: parsedTakeProfit,
          positionSize: parsedPosition,
          setupType,
          entryReason,
          emotionBefore,
          isFollowingSystem,
          screenshotNote,
        });
        Alert.alert('已保存', '交易计划已记录。');
        onSaved();
      } finally {
        setSaving(false);
      }
    };

    if (emotionBefore === 'revenge' || emotionBefore === 'fomo') {
      Alert.alert('情绪确认', '当前情绪容易导致冲动交易。确认仍要保存计划吗？', [
        { text: '取消', style: 'cancel' },
        { text: '确认保存', style: 'destructive', onPress: commit },
      ]);
      return;
    }

    await commit();
  };

  return (
    <Screen>
      <View style={styles.riskBox}>
        <Text style={styles.riskLabel}>单笔最大亏损预估</Text>
        <Text style={styles.riskValue}>{Number.isFinite(maxLossPreview) ? maxLossPreview.toFixed(2) : '0.00'}</Text>
      </View>

      <Field label="币种 symbol" value={symbol} onChangeText={setSymbol} placeholder="BTC / ETH / NEWCOIN" autoCapitalize="characters" />
      <SegmentedControl
        label="市场类型"
        value={marketType}
        options={[
          { value: 'spot', label: marketTypeLabels.spot },
          { value: 'futures', label: marketTypeLabels.futures },
        ]}
        onChange={(nextMarketType) => {
          setMarketType(nextMarketType);
          if (nextMarketType === 'spot') {
            setDirection('long');
            setLeverageText('1');
          }
        }}
      />
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>OKX 监听交易对：{okxInstrumentPreview}</Text>
        <Text style={styles.infoText}>
          {marketType === 'spot' ? '现货固定 1x 且只记录做多计划。' : '合约允许 1-10x，并支持做多/做空。'}
        </Text>
      </View>
      <Field
        label={marketType === 'spot' ? '杠杆（现货固定 1x）' : '杠杆 1-10'}
        value={effectiveLeverageText}
        onChangeText={setLeverageText}
        keyboardType="numeric"
        editable={marketType !== 'spot'}
      />
      {marketType === 'spot' ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>方向：{directionLabels.long}</Text>
        </View>
      ) : (
        <SegmentedControl
          label="方向"
          value={direction}
          options={[
            { value: 'long', label: directionLabels.long },
            { value: 'short', label: directionLabels.short },
          ]}
          onChange={setDirection}
        />
      )}
      <Field label="入场价" value={entryPrice} onChangeText={setEntryPrice} keyboardType="decimal-pad" />
      <Field label="止损价" value={stopLossPrice} onChangeText={setStopLossPrice} keyboardType="decimal-pad" />
      <Field label="止盈价" value={takeProfitPrice} onChangeText={setTakeProfitPrice} keyboardType="decimal-pad" />
      <Field label="仓位金额" value={positionSize} onChangeText={setPositionSize} keyboardType="decimal-pad" />
      <SegmentedControl
        label="形态类型"
        value={setupType}
        options={setupTypeOptions.map((value) => ({ value, label: setupTypeLabels[value] }))}
        onChange={setSetupType}
      />
      <Field label="入场理由" value={entryReason} onChangeText={setEntryReason} multiline />
      <SegmentedControl
        label="交易前情绪"
        value={emotionBefore}
        options={emotionOptions.map((value) => ({ value, label: emotionLabels[value] }))}
        onChange={setEmotionBefore}
      />
      <SegmentedControl
        label="是否符合交易系统"
        value={isFollowingSystem}
        options={[
          { value: true, label: '是' },
          { value: false, label: '否' },
        ]}
        onChange={setIsFollowingSystem}
      />
      <Field label="截图备注" value={screenshotNote} onChangeText={setScreenshotNote} multiline />
      <Button label={saving ? 'Saving...' : '保存交易计划'} onPress={savePlan} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  riskBox: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  riskLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  riskValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  infoBox: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.md,
  },
  infoText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
});

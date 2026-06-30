import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Field, SegmentedControl } from '../components/Controls';
import { Screen } from '../components/Screen';
import { getAccountSettings, updateAccountSettings } from '../db/repositories';
import { scheduleReviewReminder } from '../services/notifications';
import { colors, spacing } from '../theme/theme';

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function RulesScreen({ onSaved }: { onSaved: () => void }) {
  const [currentBalance, setCurrentBalance] = useState('10000');
  const [riskPerTrade, setRiskPerTrade] = useState('2');
  const [dailyLoss, setDailyLoss] = useState('3');
  const [consecutiveLosses, setConsecutiveLosses] = useState('2');
  const [reviewTime, setReviewTime] = useState('21:00');
  const [preTradeCheckEnabled, setPreTradeCheckEnabled] = useState(true);

  useEffect(() => {
    getAccountSettings()
      .then((settings) => {
        setCurrentBalance(String(settings.currentBalance));
        setRiskPerTrade(String(settings.maxRiskPerTradePercent));
        setDailyLoss(String(settings.maxDailyLossPercent));
        setConsecutiveLosses(String(settings.maxConsecutiveLosses));
        setReviewTime(settings.reviewReminderTime);
        setPreTradeCheckEnabled(settings.preTradeCheckEnabled);
      })
      .catch(console.error);
  }, []);

  const save = async () => {
    const parsedBalance = toNumber(currentBalance);
    const parsedRisk = toNumber(riskPerTrade);
    const parsedDailyLoss = toNumber(dailyLoss);
    const parsedLosses = Math.trunc(toNumber(consecutiveLosses));

    if (!Number.isFinite(parsedBalance) || parsedBalance <= 0) return Alert.alert('余额无效', '请填写有效账户余额。');
    if (!Number.isFinite(parsedRisk) || parsedRisk <= 0 || parsedRisk > 10) {
      return Alert.alert('风险比例无效', '单笔风险比例建议在 0 到 10 之间。');
    }
    if (!Number.isFinite(parsedDailyLoss) || parsedDailyLoss <= 0 || parsedDailyLoss > 20) {
      return Alert.alert('日亏损比例无效', '单日最大亏损比例建议在 0 到 20 之间。');
    }
    if (!Number.isFinite(parsedLosses) || parsedLosses < 1) {
      return Alert.alert('连续亏损次数无效', '请填写至少 1 次。');
    }
    if (!/^\d{2}:\d{2}$/.test(reviewTime)) {
      return Alert.alert('提醒时间格式无效', '请使用 21:00 这样的格式。');
    }

    await updateAccountSettings({
      currentBalance: parsedBalance,
      maxRiskPerTradePercent: parsedRisk,
      maxDailyLossPercent: parsedDailyLoss,
      maxConsecutiveLosses: parsedLosses,
      reviewReminderTime: reviewTime,
      preTradeCheckEnabled,
    });
    await scheduleReviewReminder(reviewTime);
    Alert.alert('规则已保存', '本地复盘提醒已按权限状态更新。');
    onSaved();
  };

  return (
    <Screen>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>纪律参数</Text>
        <Text style={styles.panelText}>默认规则：单笔 2%、单日 3%、连续亏损 2 笔停止创建新计划。</Text>
      </View>

      <Field label="当前账户余额" value={currentBalance} onChangeText={setCurrentBalance} keyboardType="decimal-pad" />
      <Field label="单笔最大风险比例 %" value={riskPerTrade} onChangeText={setRiskPerTrade} keyboardType="decimal-pad" />
      <Field label="单日最大亏损比例 %" value={dailyLoss} onChangeText={setDailyLoss} keyboardType="decimal-pad" />
      <Field label="连续亏损停止交易次数" value={consecutiveLosses} onChangeText={setConsecutiveLosses} keyboardType="numeric" />
      <Field label="每日复盘提醒时间 HH:mm" value={reviewTime} onChangeText={setReviewTime} placeholder="21:00" />
      <SegmentedControl
        label="每日交易前检查"
        value={preTradeCheckEnabled}
        options={[
          { value: true, label: '开启' },
          { value: false, label: '关闭' },
        ]}
        onChange={setPreTradeCheckEnabled}
      />
      <Button label="保存规则与提醒" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  panelText: {
    color: colors.muted,
    lineHeight: 20,
  },
});

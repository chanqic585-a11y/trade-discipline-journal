import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { emotionLabels } from '../constants';
import { getDashboardSummary } from '../services/risk';
import { DashboardSummary } from '../types';
import { colors, spacing } from '../theme/theme';

export function DashboardScreen({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    getDashboardSummary().then(setSummary).catch(console.error);
  }, [refreshKey]);

  if (!summary) {
    return (
      <Screen>
        <Text style={styles.muted}>Loading dashboard...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>今日纪律评分</Text>
        <Text style={styles.heroScore}>{summary.disciplineScore}</Text>
        <Text style={styles.heroLevel}>{summary.disciplineLevel}</Text>
      </View>

      <View style={styles.metricList}>
        <MetricRow label="是否允许交易" value={summary.canTradeToday ? 'YES' : 'NO'} highlighted={!summary.canTradeToday} />
        <MetricRow label="今日风险" value={`${summary.todayRiskPercent.toFixed(1)}%`} highlighted={summary.todayRiskPercent >= 2} />
        <MetricRow label="连续亏损" value={String(summary.todayConsecutiveLosses)} highlighted={summary.todayConsecutiveLosses > 0} />
        <MetricRow label="交易系统符合率" value={`${summary.systemComplianceRate.toFixed(0)}%`} />
        <MetricRow
          label="情绪"
          value={summary.currentEmotion ? emotionLabels[summary.currentEmotion] : '未记录'}
          highlighted={summary.currentEmotion === 'revenge' || summary.currentEmotion === 'fomo'}
        />
        <MetricRow label="今日计划" value={`${summary.todayTradeCount}/${summary.todayPlanLimit}`} highlighted={summary.todayTradeCount >= summary.todayPlanLimit} />
      </View>

      <View style={styles.reminder}>
        <Text style={styles.reminderLabel}>今日提醒</Text>
        <Text style={styles.reminderText}>{summary.dailyReminder}</Text>
      </View>

      {summary.disciplineScoreReasons.length > 0 ? (
        <View style={styles.reasons}>
          {summary.disciplineScoreReasons.map((reason) => (
            <Text key={reason} style={styles.reasonText}>
              {reason}
            </Text>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function MetricRow({ label, value, highlighted }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, highlighted && styles.metricValueWarn]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.muted,
  },
  hero: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  heroLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  heroScore: {
    color: colors.accent,
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 82,
    marginTop: spacing.sm,
  },
  heroLevel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  metricList: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  metricRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: spacing.md,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  metricValueWarn: {
    color: colors.warning,
  },
  reminder: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reminderLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  reminderText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
  },
  reasons: {
    borderColor: colors.warning,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
  },
  reasonText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
});

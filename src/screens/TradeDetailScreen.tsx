import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { directionLabels, marketTypeLabels } from '../constants';
import {
  getAccountSettings,
  getLatestTradeSnapshot,
  getTradeAnalysisByTradeId,
  getTradeById,
  listSkillResultsByTradeId,
  listTradeTimeline,
} from '../db/repositories';
import { formatDateTime } from '../services/date';
import { toOkxInstrumentId } from '../services/priceAlerts';
import { usePriceMonitor } from '../services/PriceMonitorContext';
import { calculateTradeRiskMetrics } from '../services/risk';
import { AccountSettings, SkillResult, Trade, TradeAnalysis, TradeSnapshot, TradeTimelineEvent } from '../types';
import { colors, spacing } from '../theme/theme';

interface DetailState {
  account: AccountSettings;
  trade: Trade;
  analysis: TradeAnalysis | null;
  snapshot: TradeSnapshot | null;
  timeline: TradeTimelineEvent[];
  skillResults: SkillResult[];
}

function formatNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

function statusLabel(status: Trade['status']) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'closed') return 'Closed';
  if (status === 'watching') return 'Watching';
  if (status === 'open') return 'Open';
  return 'Planned';
}

export function TradeDetailScreen({ tradeId }: { tradeId: number }) {
  const [state, setState] = useState<DetailState | null>(null);
  const { prices } = usePriceMonitor();

  useEffect(() => {
    Promise.all([
      getAccountSettings(),
      getTradeById(tradeId),
      getTradeAnalysisByTradeId(tradeId),
      getLatestTradeSnapshot(tradeId),
      listTradeTimeline(tradeId),
      listSkillResultsByTradeId(tradeId),
    ])
      .then(([account, trade, analysis, snapshot, timeline, skillResults]) => {
        if (!trade) throw new Error('Trade not found.');
        setState({ account, trade, analysis, snapshot, timeline, skillResults });
      })
      .catch(console.error);
  }, [tradeId]);

  const currentPrice = useMemo(() => {
    if (!state) return null;
    const instrumentId = toOkxInstrumentId(state.trade.symbol, state.trade.marketType);
    return prices[instrumentId] ?? state.snapshot?.currentPrice ?? state.trade.entryPrice;
  }, [prices, state]);

  if (!state) {
    return (
      <Screen>
        <Text style={styles.muted}>Loading trade detail...</Text>
      </Screen>
    );
  }

  const { account, analysis, skillResults, snapshot, timeline, trade } = state;
  const risk = calculateTradeRiskMetrics(trade, account.currentBalance);

  return (
    <Screen>
      <View style={styles.headerCard}>
        <Text style={styles.kicker}>Trade Detail</Text>
        <Text style={styles.title}>{trade.symbol}</Text>
        <Text style={styles.subtitle}>
          {directionLabels[trade.direction]} · {trade.leverage}x · {marketTypeLabels[trade.marketType]} · {statusLabel(trade.status)}
        </Text>
      </View>

      <Section title="Overview">
        <Metric label="Entry Price" value={trade.entryPrice.toFixed(6)} />
        <Metric label="Current Price" value={currentPrice ? currentPrice.toFixed(6) : '-'} />
        <Metric label="Position Size" value={trade.positionSize.toFixed(2)} />
        <Metric label="Created" value={formatDateTime(trade.createdAt)} />
      </Section>

      <Section title="AI Analysis">
        {analysis ? (
          <>
            <Text style={styles.mockBadge}>{analysis.isMock ? 'Mock Analysis' : 'Analysis'}</Text>
            <Metric label="Trend" value={analysis.trend} />
            <Metric label="Volume" value={analysis.volumeState} />
            <Metric label="RSI" value={analysis.rsi.toFixed(2)} />
            <Metric label="ATR" value={analysis.atr.toFixed(2)} />
            <Metric label="Setup" value={analysis.setupType} />
            <Metric label="Confidence" value={`${analysis.confidence.toFixed(0)}%`} />
            <Metric label="Support" value={analysis.support.toFixed(6)} />
            <Metric label="Resistance" value={analysis.resistance.toFixed(6)} />
            <Text style={styles.warningText}>{analysis.riskWarning}</Text>
            <Text style={styles.bodyText}>{analysis.marketSummary}</Text>
          </>
        ) : (
          <Text style={styles.muted}>No analysis has been generated for this trade.</Text>
        )}
      </Section>

      <Section title="Snapshot">
        {snapshot ? (
          <>
            <Metric label="Entry Time" value={formatDateTime(snapshot.createdAt)} />
            <Metric label="Entry Price" value={snapshot.entryPrice.toFixed(6)} />
            <Metric label="Current Price" value={snapshot.currentPrice.toFixed(6)} />
            <Metric label="Snapshot Type" value={snapshot.snapshotType} />
          </>
        ) : (
          <Text style={styles.muted}>No snapshot saved.</Text>
        )}
      </Section>

      <Section title="Risk">
        <Metric label="Position Size" value={trade.positionSize.toFixed(2)} />
        <Metric label="Leverage" value={`${trade.leverage}x`} />
        <Metric label="Estimated Risk %" value={formatNumber(risk.estimatedRiskPercent)} />
        <Metric label="RR Ratio" value={formatNumber(risk.rrRatio)} />
        <Metric label="Stop Loss Distance" value={risk.stopLossDistancePercent === null ? '-' : `${risk.stopLossDistancePercent.toFixed(2)}%`} />
        <Metric
          label="Take Profit Distance"
          value={risk.takeProfitDistancePercent === null ? '-' : `${risk.takeProfitDistancePercent.toFixed(2)}%`}
        />
        <Text style={styles.warningText}>{risk.warning}</Text>
      </Section>

      <Section title="Timeline">
        {timeline.length === 0 ? (
          <Text style={styles.muted}>No timeline events.</Text>
        ) : (
          timeline.map((event) => (
            <View key={event.id} style={styles.timelineItem}>
              <Text style={styles.timelineTitle}>{event.title}</Text>
              <Text style={styles.timelineText}>{event.description}</Text>
              <Text style={styles.timelineTime}>{formatDateTime(event.createdAt)}</Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Skill Results">
        {skillResults.length === 0 ? (
          <Text style={styles.muted}>No skill results yet.</Text>
        ) : (
          skillResults.slice(0, 3).map((result) => (
            <View key={result.id} style={styles.skillItem}>
              <Text style={styles.timelineTitle}>{result.skillName}</Text>
              <Text style={styles.timelineText}>
                {result.label ?? 'unknown'} · {result.score === null ? '-' : result.score.toFixed(0)}
              </Text>
              <Text style={styles.timelineText}>{result.summary}</Text>
              <Text style={styles.timelineTime}>{formatDateTime(result.createdAt)}</Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Review">
        <Text style={styles.bodyText}>
          {trade.status === 'reviewed'
            ? 'Review has been completed for this trade.'
            : trade.status === 'closed'
              ? 'This trade is closed and waiting for review. Use the Review tab to complete the lifecycle.'
              : 'This trade is still open for review. Use the Review tab when the trade is closed.'}
        </Text>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.muted,
  },
  headerCard: {
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
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  section: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  metric: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 3,
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  mockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  warningText: {
    color: colors.warning,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  bodyText: {
    color: colors.text,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  timelineItem: {
    borderLeftColor: colors.accent,
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skillItem: {
    borderLeftColor: colors.accent,
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timelineTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  timelineText: {
    color: colors.text,
    lineHeight: 19,
    marginTop: 3,
  },
  timelineTime: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
});

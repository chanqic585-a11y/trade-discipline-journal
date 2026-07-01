import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SegmentedControl, StatCard } from '../components/Controls';
import { Screen } from '../components/Screen';
import { setupTypeLabels } from '../constants';
import { buildResearchDashboardData } from '../research/researchMetrics';
import { BucketItem, ResearchDashboardData, ResearchFilters, defaultResearchFilters } from '../research/researchTypes';
import { formatDateTime } from '../services/date';
import { colors, spacing } from '../theme/theme';

const timeRangeOptions: Array<{ value: ResearchFilters['timeRange']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'last_7_days', label: '7D' },
  { value: 'last_30_days', label: '30D' },
  { value: 'last_90_days', label: '90D' },
];

const resultTypeOptions = [
  { value: 'all', label: 'All' },
  { value: 'discipline_loss', label: 'Discipline Loss' },
  { value: 'strategy_loss', label: 'Strategy Loss' },
  { value: 'no_loss', label: 'No Loss' },
  { value: 'unreviewed', label: 'Unreviewed' },
];

function emptyDashboardData(filters: ResearchFilters = defaultResearchFilters): ResearchDashboardData {
  return {
    filters,
    filterOptions: {
      symbols: [],
      setupTypes: ['unknown'],
      resultTypes: resultTypeOptions.map((option) => option.value),
    },
    summaryNotes: ['This dashboard summarizes historical trades, feature quality, and research skill observations.'],
    overview: {
      totalTrades: 0,
      reviewedTrades: 0,
      featureRows: 0,
      skillResults: 0,
      averageFeatureQuality: 0,
      averageSkillScore: 0,
      disciplineLossCount: 0,
      latestSkillRunAt: null,
    },
    dataQuality: {
      averageQualityScore: 0,
      missingFieldCount: 0,
      commonMissingFields: [],
      backendRows: 0,
      localRows: 0,
      latestGeneratedAt: null,
    },
    skillSummary: {
      latestRunGroupId: null,
      latestRunResultCount: 0,
      allTimeResultCount: 0,
      averageScore: 0,
      warningCount: 0,
      dangerCount: 0,
      bySkill: [],
      byLabel: [],
    },
    discipline: {
      disciplineLossCount: 0,
      strategyLossCount: 0,
      noLossCount: 0,
      incompleteReviewCount: 0,
      followedPlanRate: 0,
      impulsiveTradeCount: 0,
      movedStopLossCount: 0,
      addedPositionCount: 0,
      earlyTakeProfitCount: 0,
    },
    setupPatterns: [],
    marketContext: {
      trendBuckets: [],
      rsiBuckets: [],
      volatilityBuckets: [],
      change24hBuckets: [],
      qualityBuckets: [],
    },
    recentObservations: [],
  };
}

function formatNumber(value: number, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0';
}

function formatMaybeDate(value: string | null) {
  return value ? formatDateTime(value) : '-';
}

function formatSetupType(setupType: string) {
  if (setupType === 'all') return 'All';
  if (setupType === 'unknown') return 'Unknown';
  return setupTypeLabels[setupType as keyof typeof setupTypeLabels] ?? setupType;
}

function shortId(value: string | null) {
  if (!value) return '-';
  return value.length > 20 ? `${value.slice(0, 20)}...` : value;
}

export function ResearchDashboardScreen({ refreshKey }: { refreshKey: number }) {
  const [filters, setFilters] = useState<ResearchFilters>(defaultResearchFilters);
  const [data, setData] = useState<ResearchDashboardData>(() => emptyDashboardData());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    buildResearchDashboardData(filters)
      .then((nextData) => {
        if (mounted) setData(nextData);
      })
      .catch((error) => {
        console.error(error);
        if (mounted) setData(emptyDashboardData(filters));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [filters, refreshKey]);

  const symbolOptions = [
    { value: 'all', label: 'All' },
    ...data.filterOptions.symbols.map((symbol) => ({ value: symbol, label: symbol })),
  ];
  const setupOptions = [
    { value: 'all', label: 'All' },
    ...data.filterOptions.setupTypes.map((setupType) => ({
      value: setupType,
      label: formatSetupType(setupType),
    })),
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>Research Dashboard</Text>
        <Text style={styles.title}>Historical Research</Text>
        <Text style={styles.subtitle}>Historical research view built from trades, features, and skill results.</Text>
      </View>

      <View style={styles.safety}>
        <Text style={styles.safetyTitle}>Research-only boundary</Text>
        <Text style={styles.safetyText}>Research Dashboard summarizes historical data. It does not provide trading advice.</Text>
        <Text style={styles.safetyText}>It only reads local SQLite data and does not call an exchange, AI model, or order API.</Text>
      </View>

      <Section title="Filters">
        <SegmentedControl label="Time Range" value={filters.timeRange} options={timeRangeOptions} onChange={(timeRange) => setFilters({ ...filters, timeRange })} />
        <SegmentedControl label="Symbol" value={filters.symbol} options={symbolOptions} onChange={(symbol) => setFilters({ ...filters, symbol })} />
        <SegmentedControl label="Setup Type" value={filters.setupType} options={setupOptions} onChange={(setupType) => setFilters({ ...filters, setupType })} />
        <SegmentedControl label="Result Type" value={filters.resultType} options={resultTypeOptions} onChange={(resultType) => setFilters({ ...filters, resultType })} />
      </Section>

      {loading ? <Text style={styles.empty}>Loading research data...</Text> : null}

      <Section title="Research Overview">
        <Text style={styles.sectionCopy}>This dashboard summarizes historical trades, feature quality, and research skill observations.</Text>
        <View style={styles.grid}>
          <StatCard label="Trades" value={String(data.overview.totalTrades)} />
          <StatCard label="Reviewed" value={String(data.overview.reviewedTrades)} />
          <StatCard label="Features" value={String(data.overview.featureRows)} />
          <StatCard label="Skill Results" value={String(data.overview.skillResults)} />
          <StatCard label="Avg Feature Quality" value={`${formatNumber(data.overview.averageFeatureQuality)}%`} />
          <StatCard label="Avg Skill Score" value={formatNumber(data.overview.averageSkillScore)} />
          <StatCard label="Discipline Losses" value={String(data.overview.disciplineLossCount)} danger={data.overview.disciplineLossCount > 0} />
        </View>
        {data.summaryNotes.map((note) => (
          <Text key={note} style={styles.note}>{note}</Text>
        ))}
      </Section>

      <Section title="Data Quality">
        <View style={styles.grid}>
          <StatCard label="Avg Quality" value={`${formatNumber(data.dataQuality.averageQualityScore)}%`} danger={data.dataQuality.averageQualityScore < 50 && data.overview.featureRows > 0} />
          <StatCard label="Backend Rows" value={String(data.dataQuality.backendRows)} />
          <StatCard label="Local Rows" value={String(data.dataQuality.localRows)} />
          <StatCard label="Missing Fields" value={String(data.dataQuality.missingFieldCount)} danger={data.dataQuality.missingFieldCount > 0} />
        </View>
        <Text style={styles.meta}>Latest feature: {formatMaybeDate(data.dataQuality.latestGeneratedAt)}</Text>
        {data.overview.featureRows === 0 ? (
          <Text style={styles.warningText}>Data quality is limited. Generate or refresh TradeFeatures before drawing conclusions.</Text>
        ) : null}
        <BarList title="Common Missing Fields" items={data.dataQuality.commonMissingFields} />
      </Section>

      <Section title="Skill Results">
        <View style={styles.grid}>
          <StatCard label="Latest Run" value={String(data.skillSummary.latestRunResultCount)} />
          <StatCard label="All-Time" value={String(data.skillSummary.allTimeResultCount)} />
          <StatCard label="Avg Score" value={formatNumber(data.skillSummary.averageScore)} />
          <StatCard label="Warnings" value={String(data.skillSummary.warningCount)} danger={data.skillSummary.warningCount > 0} />
        </View>
        <Text style={styles.meta}>Latest run group: {shortId(data.skillSummary.latestRunGroupId)}</Text>
        <Text style={styles.meta}>Latest run is shown separately from all-time results.</Text>
        <RowsBySkill rows={data.skillSummary.bySkill} />
        <BarList title="Labels" items={data.skillSummary.byLabel} />
      </Section>

      <Section title="Discipline">
        <Text style={styles.sectionCopy}>Discipline patterns describe past behavior. Use them to improve review quality, not to force new trades.</Text>
        <View style={styles.grid}>
          <StatCard label="Discipline Loss" value={String(data.discipline.disciplineLossCount)} danger={data.discipline.disciplineLossCount > 0} />
          <StatCard label="Strategy Loss" value={String(data.discipline.strategyLossCount)} />
          <StatCard label="No Loss" value={String(data.discipline.noLossCount)} />
          <StatCard label="Incomplete" value={String(data.discipline.incompleteReviewCount)} danger={data.discipline.incompleteReviewCount > 0} />
          <StatCard label="Followed Plan" value={`${formatNumber(data.discipline.followedPlanRate)}%`} />
          <StatCard label="Impulsive" value={String(data.discipline.impulsiveTradeCount)} danger={data.discipline.impulsiveTradeCount > 0} />
          <StatCard label="Moved Stop" value={String(data.discipline.movedStopLossCount)} danger={data.discipline.movedStopLossCount > 0} />
          <StatCard label="Added Size" value={String(data.discipline.addedPositionCount)} danger={data.discipline.addedPositionCount > 0} />
        </View>
      </Section>

      <Section title="Setup Pattern">
        {data.setupPatterns.length === 0 ? (
          <Text style={styles.empty}>No setup pattern rows yet.</Text>
        ) : (
          data.setupPatterns.map((row) => (
            <View key={row.setupType} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{formatSetupType(row.setupType)}</Text>
              <Text style={styles.meta}>
                Trades {row.tradeCount} · Reviewed {row.reviewedCount} · Win {row.winCount} · Loss {row.lossCount}
              </Text>
              <Text style={styles.meta}>
                Avg PnL {row.averagePnl.toFixed(2)} · Discipline Loss {row.disciplineLossCount}
              </Text>
              <Text style={styles.meta}>
                Avg Skill {row.averageSkillScore.toFixed(0)} · Feature Quality {row.averageFeatureQuality.toFixed(0)}%
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Market Context">
        <BarList title="Trend" items={data.marketContext.trendBuckets} />
        <BarList title="RSI" items={data.marketContext.rsiBuckets} />
        <BarList title="Volatility" items={data.marketContext.volatilityBuckets} />
        <BarList title="24h Change" items={data.marketContext.change24hBuckets} />
        <BarList title="Feature Quality" items={data.marketContext.qualityBuckets} />
      </Section>

      <Section title="Recent Research Observations">
        {data.recentObservations.length === 0 ? (
          <Text style={styles.empty}>No research observations yet. Run Skill Engine to populate this section.</Text>
        ) : (
          data.recentObservations.map((observation) => (
            <View key={observation.id} style={styles.observationCard}>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{observation.skillName}</Text>
                <Text style={styles.score}>{observation.score === null ? '-' : observation.score.toFixed(0)}</Text>
              </View>
              <Text style={styles.meta}>
                {observation.symbol ?? '-'} · {observation.label ?? 'unknown'} · {formatDateTime(observation.createdAt)}
              </Text>
              <Text style={styles.bodyText}>{observation.summary}</Text>
              <Text style={styles.muted}>{observation.explanation}</Text>
            </View>
          ))
        )}
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

function RowsBySkill({ rows }: { rows: ResearchDashboardData['skillSummary']['bySkill'] }) {
  if (rows.length === 0) return <Text style={styles.empty}>No skill rows yet.</Text>;

  return (
    <View>
      <Text style={styles.subTitle}>By Skill</Text>
      {rows.map((row) => (
        <View key={row.skillId} style={styles.compactRow}>
          <Text style={styles.compactTitle}>{row.skillName}</Text>
          <Text style={styles.compactMeta}>
            Count {row.count} · Avg {row.averageScore.toFixed(0)} · Label {row.mostCommonLabel ?? 'unknown'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BarList({ title, items }: { title: string; items: BucketItem[] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.barBlock}>
      <Text style={styles.subTitle}>{title}</Text>
      {items.map((item) => {
        const width = item.count > 0 ? Math.max(item.percent, 4) : 0;
        return (
          <View key={item.label} style={styles.barRow}>
            <Text style={styles.barLabel}>{item.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${width}%` }]} />
            </View>
            <Text style={styles.barValue}>{item.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  safety: {
    borderColor: colors.warning,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  safetyTitle: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  safetyText: {
    color: colors.text,
    lineHeight: 20,
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
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sectionCopy: {
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  note: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  meta: {
    color: colors.muted,
    lineHeight: 19,
    marginTop: 4,
  },
  muted: {
    color: colors.muted,
    lineHeight: 19,
    marginTop: 4,
  },
  warningText: {
    color: colors.warning,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  empty: {
    color: colors.muted,
    lineHeight: 20,
  },
  subTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  barBlock: {
    marginTop: spacing.sm,
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  barLabel: {
    color: colors.muted,
    fontSize: 12,
    width: 96,
  },
  barTrack: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    flex: 1,
    height: 9,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: 9,
  },
  barValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: spacing.sm,
    minWidth: 24,
    textAlign: 'right',
  },
  rowCard: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  compactTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  compactMeta: {
    color: colors.muted,
    lineHeight: 19,
    marginTop: 3,
  },
  observationCard: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  bodyText: {
    color: colors.text,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  score: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    textAlign: 'center',
  },
});

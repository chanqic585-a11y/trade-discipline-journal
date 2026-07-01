import React, { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { Button, StatCard } from '../components/Controls';
import { Screen } from '../components/Screen';
import { getDataQualitySummary, listTradeFeatures } from '../db/repositories';
import { buildTradeFeaturesCsv } from '../feature-engine/csvExport';
import { generateAllTradeFeatures, refreshAllTradeFeaturesFromBackend } from '../feature-engine/featureEngine';
import { formatDateTime } from '../services/date';
import { DataQualitySummary, TradeFeature } from '../types';
import { colors, spacing } from '../theme/theme';

function emptySummary(): DataQualitySummary {
  return {
    totalTrades: 0,
    featureRows: 0,
    missingFeatureRows: 0,
    averageQualityScore: 0,
    backendEnrichedRows: 0,
    nullFieldCount: 0,
    exportableRows: 0,
    latestGeneratedAt: null,
  };
}

function parseMissingFields(feature: TradeFeature) {
  try {
    const parsed = JSON.parse(feature.missingFieldsJson) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function buildCsvFileName(date = new Date()) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  const second = pad2(date.getSeconds());
  return `trade_features_${year}${month}${day}_${hour}${minute}${second}.csv`;
}

async function shareCsvText(csv: string) {
  await Share.share({
    title: 'TradeFeatures CSV',
    message: csv,
  });
}

export function DataQualityScreen({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<DataQualitySummary>(emptySummary);
  const [features, setFeatures] = useState<TradeFeature[]>([]);
  const [working, setWorking] = useState(false);
  const [backendWorking, setBackendWorking] = useState(false);
  const [backendStatus, setBackendStatus] = useState('Backend Feature Engine has not been checked yet.');
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const [nextSummary, nextFeatures] = await Promise.all([getDataQualitySummary(), listTradeFeatures()]);
    setSummary(nextSummary);
    setFeatures(nextFeatures);
  };

  useEffect(() => {
    load().catch(console.error);
  }, [refreshKey]);

  const generateLocal = async () => {
    setWorking(true);
    try {
      const result = await generateAllTradeFeatures();
      await load();
      Alert.alert('Feature Database updated', `Generated ${result.generated} feature rows from ${result.totalTrades} trades.`);
    } catch (error) {
      Alert.alert('Feature generation failed', error instanceof Error ? error.message : 'Unable to generate features.');
    } finally {
      setWorking(false);
    }
  };

  const refreshFromBackend = async () => {
    setBackendWorking(true);
    try {
      const result = await refreshAllTradeFeaturesFromBackend();
      await load();

      if (result.backendEnriched === 0 && result.totalTrades > 0) {
        setBackendStatus('Backend Feature Engine unavailable. Local fallback is still available.');
      } else {
        setBackendStatus(
          `Backend enriched ${result.backendEnriched} rows. Local fallback used for ${result.localFallback} rows.`,
        );
      }

      Alert.alert(
        'Feature refresh complete',
        `Backend enriched ${result.backendEnriched} of ${result.totalTrades} trades. Local fallback: ${result.localFallback}.`,
      );
    } catch (error) {
      setBackendStatus('Backend Feature Engine unavailable. Local fallback is still available.');
      Alert.alert(
        'Backend refresh failed',
        error instanceof Error ? error.message : 'Backend Feature Engine unavailable. Local fallback is still available.',
      );
    } finally {
      setBackendWorking(false);
    }
  };

  const exportCsv = async () => {
    if (features.length === 0) {
      Alert.alert('No export rows', 'Generate TradeFeatures before exporting CSV.');
      return;
    }

    const csv = buildTradeFeaturesCsv(features);
    setExporting(true);

    try {
      const exportDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

      if (!exportDirectory) {
        await shareCsvText(csv);
        return;
      }

      const fileName = buildCsvFileName();
      const fileUri = `${exportDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShareFile = await Sharing.isAvailableAsync();
      if (!canShareFile) {
        await shareCsvText(csv);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: 'Export TradeFeatures CSV',
      });
    } catch (error) {
      console.warn('CSV file export failed, falling back to text share.', error);
      try {
        await shareCsvText(csv);
      } catch (fallbackError) {
        Alert.alert(
          'CSV export failed',
          fallbackError instanceof Error ? fallbackError.message : 'Unable to export TradeFeatures CSV.',
        );
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>Feature Database</Text>
        <Text style={styles.title}>Data Quality</Text>
        <Text style={styles.subtitle}>
          Python Feature Engine converts public market data into structured research features. Missing data is stored as null.
        </Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Trades" value={String(summary.totalTrades)} />
        <StatCard label="Feature Rows" value={String(summary.featureRows)} />
        <StatCard label="Backend Rows" value={String(summary.backendEnrichedRows)} />
        <StatCard label="Missing Rows" value={String(summary.missingFeatureRows)} danger={summary.missingFeatureRows > 0} />
        <StatCard label="Avg Quality" value={`${summary.averageQualityScore.toFixed(0)}%`} danger={summary.averageQualityScore < 50 && summary.featureRows > 0} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>V5 Python Feature Engine</Text>
        <Text style={styles.panelText}>{backendStatus}</Text>
        <Text style={styles.panelMuted}>
          Uses public market data only. It does not create signals, place orders, or use API keys.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Export Readiness</Text>
        <Text style={styles.panelText}>Exportable rows: {summary.exportableRows}</Text>
        <Text style={styles.panelText}>Backend enriched rows: {summary.backendEnrichedRows}</Text>
        <Text style={styles.panelText}>Null feature values: {summary.nullFieldCount}</Text>
        <Text style={styles.panelText}>
          Latest generation: {summary.latestGeneratedAt ? formatDateTime(summary.latestGeneratedAt) : '-'}
        </Text>
      </View>

      <Button label={working ? 'Generating...' : 'Generate Local Features'} onPress={generateLocal} />
      <Button label={backendWorking ? 'Refreshing...' : 'Refresh From Backend'} onPress={refreshFromBackend} tone="neutral" />
      <Button label={exporting ? 'Exporting...' : 'Export TradeFeatures CSV'} onPress={exportCsv} tone="neutral" />

      <Text style={styles.sectionTitle}>Recent Feature Rows</Text>
      {features.length === 0 ? (
        <Text style={styles.empty}>No feature rows yet. Generate features to populate the database.</Text>
      ) : (
        features.slice(0, 8).map((feature) => {
          const missing = parseMissingFields(feature);
          return (
            <View key={feature.id} style={styles.featureCard}>
              <View style={styles.row}>
                <Text style={styles.featureTitle}>{feature.symbol}</Text>
                <Text style={styles.badge}>{feature.dataQualityScore}%</Text>
              </View>
              <Text style={styles.meta}>
                {feature.direction} · {feature.tradeStatus} · {formatDateTime(feature.entryTime)}
              </Text>
              <Text style={styles.meta}>Source: {feature.source}</Text>
              <Text style={styles.meta}>Trend: {feature.trend ?? '-'}</Text>
              <Text style={styles.meta}>Setup: {feature.setupType ?? '-'}</Text>
              <Text style={styles.missing}>
                Missing: {missing.length === 0 ? 'none' : missing.slice(0, 8).join(', ')}
              </Text>
            </View>
          );
        })
      )}
    </Screen>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  panel: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  panelText: {
    color: colors.text,
    lineHeight: 20,
  },
  panelMuted: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  empty: {
    color: colors.muted,
  },
  featureCard: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  meta: {
    color: colors.muted,
    lineHeight: 19,
    marginTop: 4,
  },
  missing: {
    color: colors.warning,
    lineHeight: 19,
    marginTop: 4,
  },
});

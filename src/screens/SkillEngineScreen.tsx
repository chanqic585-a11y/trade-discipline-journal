import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, StatCard } from '../components/Controls';
import { Screen } from '../components/Screen';
import { getSkillResultSummary, listSkillResults } from '../db/repositories';
import { formatDateTime } from '../services/date';
import { listAvailableSkills, runAllSkillsForAllTrades } from '../skill-engine/skillRunner';
import { SkillDefinition } from '../skill-engine/skillTypes';
import { SkillResult, SkillResultSummary } from '../types';
import { colors, spacing } from '../theme/theme';

function emptySummary(): SkillResultSummary {
  return {
    totalResults: 0,
    totalSkills: 0,
    latestRunAt: null,
    averageScore: 0,
    warningCount: 0,
    dangerCount: 0,
  };
}

function formatScore(score: number | null) {
  return score === null || !Number.isFinite(score) ? '-' : `${score.toFixed(0)}`;
}

export function SkillEngineScreen({ refreshKey }: { refreshKey: number }) {
  const [skills] = useState<SkillDefinition[]>(() => listAvailableSkills());
  const [summary, setSummary] = useState<SkillResultSummary>(emptySummary);
  const [results, setResults] = useState<SkillResult[]>([]);
  const [working, setWorking] = useState(false);

  const load = async () => {
    const [nextSummary, nextResults] = await Promise.all([
      getSkillResultSummary(),
      listSkillResults(20),
    ]);
    setSummary(nextSummary);
    setResults(nextResults);
  };

  useEffect(() => {
    load().catch(console.error);
  }, [refreshKey]);

  const runAll = async () => {
    setWorking(true);
    try {
      const result = await runAllSkillsForAllTrades();
      await load();
      if (result.totalTrades === 0) {
        Alert.alert('No trades yet', 'Create trades before running research skills.');
      } else {
        Alert.alert(
          'Skill run complete',
          `Created ${result.totalResults} SkillResults from ${result.totalTrades} trades.`,
        );
      }
    } catch (error) {
      Alert.alert('Skill Engine failed', error instanceof Error ? error.message : 'Unable to run skills.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>Skill Engine</Text>
        <Text style={styles.title}>Research Skills</Text>
        <Text style={styles.subtitle}>Reusable research skills built on Feature Database.</Text>
      </View>

      <View style={styles.safety}>
        <Text style={styles.safetyTitle}>Research-only boundary</Text>
        <Text style={styles.safetyText}>Skills produce research observations, not trading advice.</Text>
        <Text style={styles.safetyText}>No AI, no signals, no exchange permissions, and no order actions.</Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Available Skills" value={String(skills.length)} />
        <StatCard label="Skill Results" value={String(summary.totalResults)} />
        <StatCard label="Avg Score" value={`${summary.averageScore.toFixed(0)}`} />
        <StatCard label="Latest Run" value={summary.latestRunAt ? formatDateTime(summary.latestRunAt) : '-'} />
      </View>

      <Button label={working ? 'Running...' : 'Run All Skills'} onPress={runAll} />
      <Button label="Refresh Results" onPress={() => load().catch(console.error)} tone="neutral" />

      <Text style={styles.sectionTitle}>Available Skills</Text>
      {skills.map((skill) => (
        <View key={skill.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{skill.name}</Text>
            <Text style={styles.badge}>v{skill.version}</Text>
          </View>
          <Text style={styles.meta}>{skill.category}</Text>
          <Text style={styles.cardText}>{skill.description}</Text>
          <Text style={styles.muted}>{skill.explanation}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Recent Skill Results</Text>
      {results.length === 0 ? (
        <Text style={styles.empty}>No skill results yet. Run skills after creating trades and features.</Text>
      ) : (
        results.map((result) => (
          <View key={result.id} style={styles.resultCard}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{result.skillName}</Text>
              <Text style={styles.score}>{formatScore(result.score)}</Text>
            </View>
            <Text style={styles.meta}>
              {result.symbol ?? '-'} · {result.label ?? 'unknown'} · {formatDateTime(result.createdAt)}
            </Text>
            <Text style={styles.cardText}>{result.summary}</Text>
            <Text style={styles.muted}>{result.explanation}</Text>
          </View>
        ))
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resultCard: {
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
  cardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  cardText: {
    color: colors.text,
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
  badge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
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
  empty: {
    color: colors.muted,
  },
});

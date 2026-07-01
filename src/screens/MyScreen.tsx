import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Screen } from '../components/Screen';
import { DataQualityScreen } from './DataQualityScreen';
import { HistoryScreen } from './HistoryScreen';
import { MonitorScreen } from './MonitorScreen';
import { ResearchDashboardScreen } from './ResearchDashboardScreen';
import { RulesScreen } from './RulesScreen';
import { SkillEngineScreen } from './SkillEngineScreen';
import { StatisticsScreen } from './StatisticsScreen';
import { colors, spacing } from '../theme/theme';

type MyView = 'menu' | 'monitor' | 'stats' | 'rules' | 'history' | 'dataQuality' | 'skills' | 'research';

interface MyScreenProps {
  refreshKey: number;
  onSaved: () => void;
}

const entries: Array<{ key: MyView; title: string; description: string }> = [
  {
    key: 'monitor',
    title: '行情提醒',
    description: '查看 OKX 公共行情监听、当前价和提醒日志。',
  },
  {
    key: 'stats',
    title: '统计',
    description: '查看胜率、总盈亏、纪律执行率和形态表现。',
  },
  {
    key: 'rules',
    title: '规则与提醒',
    description: '设置单笔风险、单日亏损、连续亏损和复盘提醒。',
  },
  {
    key: 'history',
    title: '交易记录',
    description: '查看全部交易、盈利、亏损、纪律亏损和未复盘记录。',
  },
  {
    key: 'dataQuality',
    title: 'Feature Database',
    description: '生成 TradeFeatures、检查数据质量，并导出 CSV。',
  },
  {
    key: 'skills',
    title: 'Skill Engine',
    description: '运行可复用研究技能，分析入场质量、风险纪律、市场状态和复盘行为。',
  },
  {
    key: 'research',
    title: 'Research Dashboard',
    description: '聚合交易、Feature 和 Skill Results，查看历史研究模式与数据质量。',
  },
];

export function MyScreen({ refreshKey, onSaved }: MyScreenProps) {
  const [view, setView] = useState<MyView>('menu');

  if (view === 'monitor') return <NestedView title="行情提醒" onBack={() => setView('menu')}><MonitorScreen /></NestedView>;
  if (view === 'stats') return <NestedView title="统计" onBack={() => setView('menu')}><StatisticsScreen refreshKey={refreshKey} /></NestedView>;
  if (view === 'rules') return <NestedView title="规则与提醒" onBack={() => setView('menu')}><RulesScreen onSaved={onSaved} /></NestedView>;
  if (view === 'history') return <NestedView title="交易记录" onBack={() => setView('menu')}><HistoryScreen refreshKey={refreshKey} /></NestedView>;
  if (view === 'dataQuality') return <NestedView title="Feature Database" onBack={() => setView('menu')}><DataQualityScreen refreshKey={refreshKey} /></NestedView>;
  if (view === 'skills') return <NestedView title="Skill Engine" onBack={() => setView('menu')}><SkillEngineScreen refreshKey={refreshKey} /></NestedView>;
  if (view === 'research') return <NestedView title="Research Dashboard" onBack={() => setView('menu')}><ResearchDashboardScreen refreshKey={refreshKey} /></NestedView>;

  return (
    <Screen>
      <Text style={styles.heading}>我的</Text>
      <Text style={styles.subtitle}>管理提醒、统计、规则、交易记录、Feature Database、Skill Engine 和 Research Dashboard。</Text>
      {entries.map((entry) => (
        <TouchableOpacity key={entry.key} style={styles.card} onPress={() => setView(entry.key)}>
          <Text style={styles.cardTitle}>{entry.title}</Text>
          <Text style={styles.cardText}>{entry.description}</Text>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}

function NestedView({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.nested}>
      <View style={styles.nestedHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.nestedTitle}>{title}</Text>
      </View>
      <View style={styles.nestedBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  card: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 5,
  },
  cardText: {
    color: colors.muted,
    lineHeight: 20,
  },
  nested: {
    flex: 1,
  },
  nestedHeader: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  backText: {
    color: colors.text,
    fontWeight: '700',
  },
  nestedTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginLeft: spacing.md,
  },
  nestedBody: {
    flex: 1,
  },
});

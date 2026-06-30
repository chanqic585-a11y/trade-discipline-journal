import React, { useCallback, useEffect, useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { initDatabase } from './src/db/database';
import { hasAccountSettings } from './src/db/repositories';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { InitialSetupScreen } from './src/screens/InitialSetupScreen';
import { MyScreen } from './src/screens/MyScreen';
import { ReviewTradeScreen } from './src/screens/ReviewTradeScreen';
import { TradePlanScreen } from './src/screens/TradePlanScreen';
import { PriceMonitorProvider } from './src/services/PriceMonitorContext';
import { colors, spacing } from './src/theme/theme';

type TabKey = 'dashboard' | 'plan' | 'review' | 'my';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: '首页' },
  { key: 'plan', label: '计划' },
  { key: 'review', label: '复盘' },
  { key: 'my', label: '我的' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        setSetupComplete(await hasAccountSettings());
        setReady(true);
      })
      .catch((error: unknown) => {
        Alert.alert('Database error', error instanceof Error ? error.message : 'Unable to open local database.');
      });
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const renderScreen = () => {
    if (!ready) {
      return (
        <View style={styles.centered}>
          <Text style={styles.loading}>Preparing local journal...</Text>
        </View>
      );
    }

    if (!setupComplete) {
      return (
        <InitialSetupScreen
          onComplete={() => {
            setSetupComplete(true);
            refresh();
          }}
        />
      );
    }

    if (activeTab === 'dashboard') return <DashboardScreen refreshKey={refreshKey} />;
    if (activeTab === 'plan') return <TradePlanScreen onSaved={() => { refresh(); setActiveTab('dashboard'); }} />;
    if (activeTab === 'review') return <ReviewTradeScreen onSaved={() => { refresh(); setActiveTab('dashboard'); }} />;
    return <MyScreen refreshKey={refreshKey} onSaved={refresh} />;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Trade Discipline Journal</Text>
        <Text style={styles.subtitle}>Plan first. Review after. No signals.</Text>
      </View>
      {ready && setupComplete ? (
        <PriceMonitorProvider refreshKey={refreshKey}>
          <View style={styles.body}>{renderScreen()}</View>
        </PriceMonitorProvider>
      ) : (
        <View style={styles.body}>{renderScreen()}</View>
      )}
      {ready && setupComplete ? (
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  body: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    color: colors.muted,
  },
  tabBar: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.xs,
    backgroundColor: colors.surface,
  },
  tab: {
    width: '25%',
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.text,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.surface,
  },
});

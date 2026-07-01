import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Controls';
import { Screen } from '../components/Screen';
import { directionLabels } from '../constants';
import { listOpenTrades } from '../db/repositories';
import { formatDateTime } from '../services/date';
import { Trade } from '../types';
import { colors, spacing } from '../theme/theme';
import { QuickTradeScreen } from './QuickTradeScreen';
import { TradeDetailScreen } from './TradeDetailScreen';
import { TradePlanScreen } from './TradePlanScreen';

type WorkspaceView = 'quick' | 'classic' | 'detail';

interface TradeWorkspaceScreenProps {
  refreshKey: number;
  onSaved: () => void;
}

export function TradeWorkspaceScreen({ refreshKey, onSaved }: TradeWorkspaceScreenProps) {
  const [view, setView] = useState<WorkspaceView>('quick');
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  useEffect(() => {
    listOpenTrades().then(setOpenTrades).catch(console.error);
  }, [refreshKey, localRefreshKey]);

  const refresh = () => {
    setLocalRefreshKey((current) => current + 1);
    onSaved();
  };

  if (view === 'classic') {
    return (
      <NestedView title="完整计划" onBack={() => setView('quick')}>
        <TradePlanScreen
          onSaved={() => {
            refresh();
            setView('quick');
          }}
        />
      </NestedView>
    );
  }

  if (view === 'detail' && selectedTradeId !== null) {
    return (
      <NestedView title="Trade Detail" onBack={() => setView('quick')}>
        <TradeDetailScreen tradeId={selectedTradeId} />
      </NestedView>
    );
  }

  return (
    <Screen>
      <QuickTradeScreen
        onCreated={(tradeId) => {
          setSelectedTradeId(tradeId);
          refresh();
          setView('detail');
        }}
      />

      <View style={styles.switchCard}>
        <Text style={styles.switchTitle}>完整 V1.1 计划</Text>
        <Text style={styles.switchText}>需要情绪、形态、长理由和交易前检查时，继续使用完整计划。</Text>
        <Button label="打开完整计划" onPress={() => setView('classic')} tone="neutral" />
      </View>

      <Text style={styles.sectionTitle}>Open Trades</Text>
      {openTrades.length === 0 ? (
        <Text style={styles.empty}>No open trades.</Text>
      ) : (
        openTrades.map((trade) => (
          <TouchableOpacity
            key={trade.id}
            style={styles.tradeCard}
            onPress={() => {
              setSelectedTradeId(trade.id);
              setView('detail');
            }}
          >
            <View style={styles.row}>
              <Text style={styles.tradeTitle}>{trade.symbol}</Text>
              <Text style={styles.badge}>{trade.status}</Text>
            </View>
            <Text style={styles.tradeMeta}>
              {directionLabels[trade.direction]} · {trade.leverage}x · Entry {trade.entryPrice}
            </Text>
            <Text style={styles.tradeMeta}>{formatDateTime(trade.createdAt)}</Text>
          </TouchableOpacity>
        ))
      )}
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
  switchCard: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  switchTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  switchText: {
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  empty: {
    color: colors.muted,
  },
  tradeCard: {
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
  tradeTitle: {
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
  tradeMeta: {
    color: colors.muted,
    marginTop: 5,
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

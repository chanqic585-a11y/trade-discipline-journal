import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { directionLabels } from '../constants';
import { formatDateTime } from '../services/date';
import { calculatePriceDistance, toOkxInstrumentId } from '../services/priceAlerts';
import { ConnectionStatus, usePriceMonitor } from '../services/PriceMonitorContext';
import { colors, spacing } from '../theme/theme';

export function MonitorScreen() {
  const { logs, prices, status, trades } = usePriceMonitor();
  const instrumentCount = new Set(trades.map((trade) => toOkxInstrumentId(trade.symbol, trade.marketType))).size;

  return (
    <Screen>
      <View style={styles.foregroundWarning}>
        <Text style={styles.foregroundTitle}>前台提醒限制</Text>
        <Text style={styles.foregroundText}>
          当前版本只在 APP 前台运行时提醒。锁屏、后台运行或系统杀掉 APP 后，价格监听可能停止。
        </Text>
      </View>

      <View style={[styles.statusPanel, status === 'connected' ? styles.statusOk : styles.statusWarn]}>
        <Text style={styles.statusTitle}>OKX 公共行情监听</Text>
        <Text style={styles.statusText}>
          {trades.length === 0
            ? '当前没有未复盘交易计划。创建计划后，APP 前台运行时会自动监听对应价格。'
            : `状态：${statusLabel(status)} · 监听 ${instrumentCount} 个交易对`}
        </Text>
        <Text style={styles.safetyText}>仅使用 OKX 公共行情 WebSocket；不保存 API Key，不下单，不给买卖建议。</Text>
      </View>

      {trades.length === 0 ? (
        <Text style={styles.empty}>暂无需要监听的交易计划。</Text>
      ) : (
        trades.map((trade) => {
          const instrumentId = toOkxInstrumentId(trade.symbol, trade.marketType);
          const currentPrice = prices[instrumentId];
          const distance = currentPrice ? calculatePriceDistance(trade, currentPrice) : null;

          return (
            <View key={trade.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title}>{instrumentId}</Text>
                <Text style={styles.badge}>{directionLabels[trade.direction]}</Text>
              </View>
              <Text style={styles.price}>{currentPrice ? currentPrice.toFixed(6) : '等待行情...'}</Text>
              <Text style={styles.meta}>止损：{trade.stopLossPrice.toFixed(6)}</Text>
              <Text style={styles.meta}>
                止盈：{trade.takeProfitPrice === null ? '未设置' : trade.takeProfitPrice.toFixed(6)}
              </Text>
              <View style={styles.distanceRow}>
                <Text style={styles.distanceText}>
                  距离止损 {distance ? `${distance.stopLossPercent.toFixed(2)}%` : '-'}
                </Text>
                <Text style={styles.distanceText}>
                  距离止盈 {distance?.takeProfitPercent === null || !distance ? '-' : `${distance.takeProfitPercent.toFixed(2)}%`}
                </Text>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.logPanel}>
        <Text style={styles.sectionTitle}>提醒日志</Text>
        {logs.length === 0 ? (
          <Text style={styles.empty}>暂无提醒记录。</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <Text style={styles.logTitle}>
                {log.symbol} · {log.alertType === 'stop_loss' ? '止损' : '止盈'}
              </Text>
              <Text style={styles.meta}>
                {formatDateTime(log.createdAt)} · 当前价 {log.currentPrice.toFixed(6)}
              </Text>
              <Text style={styles.meta}>{log.message}</Text>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

function statusLabel(status: ConnectionStatus) {
  if (status === 'connecting') return '连接中';
  if (status === 'connected') return '已连接';
  if (status === 'reconnecting') return '断线重连中';
  if (status === 'error') return '连接异常';
  return '未启动';
}

const styles = StyleSheet.create({
  statusPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  foregroundWarning: {
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  foregroundTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  foregroundText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  statusOk: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  statusWarn: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  statusText: {
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  safetyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  empty: {
    color: colors.muted,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  badge: {
    color: colors.accent,
    fontWeight: '800',
  },
  price: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  meta: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: 4,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  distanceText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  logPanel: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  logItem: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  logTitle: {
    color: colors.text,
    fontWeight: '800',
  },
});

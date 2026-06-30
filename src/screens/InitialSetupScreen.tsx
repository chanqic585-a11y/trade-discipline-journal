import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Field } from '../components/Controls';
import { Screen } from '../components/Screen';
import { createInitialAccountSettings } from '../db/repositories';
import { colors, spacing } from '../theme/theme';

function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function InitialSetupScreen({ onComplete }: { onComplete: () => void }) {
  const [initialBalance, setInitialBalance] = useState('15000');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const parsedBalance = parseAmount(initialBalance);
    if (!Number.isFinite(parsedBalance) || parsedBalance <= 0) {
      Alert.alert('本金无效', '请输入大于 0 的初始本金。');
      return;
    }

    setSaving(true);
    try {
      await createInitialAccountSettings(parsedBalance);
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.panel}>
        <Text style={styles.title}>Initial Setup</Text>
        <Text style={styles.description}>
          先设置你的交易账户本金。它只用于本地风控计算，不会连接交易所，也不会上传到服务器。
        </Text>
      </View>

      <Field
        label="初始本金"
        value={initialBalance}
        onChangeText={setInitialBalance}
        keyboardType="decimal-pad"
        placeholder="15000"
      />
      <Button label={saving ? 'Saving...' : '开始使用'} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
});

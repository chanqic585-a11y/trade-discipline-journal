import React, { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '../theme/theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});

import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../theme/theme';

interface FieldProps extends TextInputProps {
  label: string;
}

export function Field({ label, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

interface SegmentOption<T extends string | number | boolean> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string | number | boolean> {
  label: string;
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmentWrap}>
        {options.map((option) => (
          <TouchableOpacity
            key={String(option.value)}
            style={[styles.segment, value === option.value && styles.segmentActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger' | 'neutral';
}

export function Button({ label, onPress, tone = 'primary' }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        tone === 'primary' && styles.buttonPrimary,
        tone === 'danger' && styles.buttonDanger,
        tone === 'neutral' && styles.buttonNeutral,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, tone === 'neutral' && styles.buttonTextNeutral]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StatCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={[styles.card, danger && styles.cardDanger]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, danger && styles.cardValueDanger]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  segment: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  segmentActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.accent,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonPrimary: {
    backgroundColor: colors.text,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonNeutral: {
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  buttonText: {
    color: colors.surface,
    fontWeight: '800',
    fontSize: 15,
  },
  buttonTextNeutral: {
    color: colors.text,
  },
  card: {
    width: '48%',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 6,
  },
  cardValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  cardValueDanger: {
    color: colors.danger,
  },
});

// src/components/common/Button.jsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = true,
}) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    isDisabled && styles.disabled,
    fullWidth && { width: '100%' },
    style,
  ];

  const labelStyle = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={containerStyle}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textInverse : colors.primary}
        />
      ) : (
        <Text style={labelStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },

  // Variants
  variant_primary: {
    backgroundColor: colors.primary,
  },
  variant_secondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: colors.error,
  },

  // Sizes
  size_sm: { paddingVertical: spacing.sm,      paddingHorizontal: spacing.md  },
  size_md: { paddingVertical: spacing.md - 2,  paddingHorizontal: spacing.lg  },
  size_lg: { paddingVertical: spacing.md + 2,  paddingHorizontal: spacing.xl  },

  // Text
  text: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  text_primary:   { color: colors.textInverse },
  text_secondary: { color: colors.primary },
  text_ghost:     { color: colors.primary },
  text_danger:    { color: colors.textInverse },

  textSize_sm: { fontSize: 13 },
  textSize_md: { fontSize: 15 },
  textSize_lg: { fontSize: 16 },

  disabled: { opacity: 0.55 },
});
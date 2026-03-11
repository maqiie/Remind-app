// src/theme/index.js
export const colors = {
  bg:             '#F7F6F2',
  bgCard:         '#FFFFFF',
  bgInput:        '#F0EFE9',
  bgInputFocused: '#FFFFFF',
  primary:        '#6B9E78',
  primaryLight:   '#EAF2EC',
  primaryDark:    '#4E7D5B',
  textPrimary:    '#1C1C1E',
  textSecondary:  '#6E6E73',
  textMuted:      '#AEAEB2',
  textInverse:    '#FFFFFF',
  border:         '#E5E4DE',
  borderFocused:  '#6B9E78',
  error:          '#D94F4F',
  errorLight:     '#FDEAEA',
  success:        '#6B9E78',
  warning:        '#E09F3E',
  overlay:        'rgba(28, 28, 30, 0.45)',
  shadow:         'rgba(28, 28, 30, 0.08)',
};

// Use these font name constants everywhere — no Platform.select needed
export const fonts = {
  serif:      'Fraunces_600SemiBold',
  serifBold:  'Fraunces_700Bold',
  sans:       'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
};

export const typography = {
  display: {
    fontFamily: fonts.serifBold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  heading: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  subheading: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyMedium: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  button: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    letterSpacing: 0.2,
  },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
};

export const radius = {
  sm: 8, md: 14, lg: 20, xl: 28, full: 999,
};

export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
};

export default { colors, fonts, typography, spacing, radius, shadows };
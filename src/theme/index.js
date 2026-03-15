// src/theme/index.js
// ─── Colour palette ────────────────────────────────────────────────────────────
export const colors = {
  // Brand
  primary:      '#4A7C59',
  primaryLight: '#EAF2EC',
  primaryDark:  '#2D5C3E',

  // Backgrounds
  bg:      '#FAF8F5',
  bgCard:  '#FFFFFF',
  bgInput: '#F5F2EE',

  // Text
  textPrimary:   '#1C1917',
  textSecondary: '#57534E',
  textMuted:     '#A8A29E',

  // Borders
  border:      'rgba(0,0,0,0.07)',
  borderLight: 'rgba(0,0,0,0.04)',

  // Status
  success: '#4A7C59',
  warning: '#B45309',
  error:   '#C2500A',
  info:    '#2563EB',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
};

// ─── Typography ────────────────────────────────────────────────────────────────
export const fonts = {
  serif:      'Fraunces_600SemiBold',
  serifBold:  'Fraunces_700Bold',
  sans:       'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
};

// ─── Spacing ───────────────────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ─── Border radius ─────────────────────────────────────────────────────────────
export const radius = {
  sm:   6,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 999,
};

// ─── Shadows ───────────────────────────────────────────────────────────────────
export const shadows = {
  sm: {
    shadowColor:   '#1C1917',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  4,
    elevation:     1,
  },
  md: {
    shadowColor:   '#1C1917',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  10,
    elevation:     3,
  },
  lg: {
    shadowColor:   '#1C1917',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  20,
    elevation:     6,
  },
};

// ─── Typography scale ──────────────────────────────────────────────────────────
export const typography = {
  h1: { fontFamily: fonts.serifBold,  fontSize: 32, letterSpacing: -0.8 },
  h2: { fontFamily: fonts.serifBold,  fontSize: 26, letterSpacing: -0.5 },
  h3: { fontFamily: fonts.serif,      fontSize: 20, letterSpacing: -0.3 },
  h4: { fontFamily: fonts.serif,      fontSize: 17, letterSpacing: -0.2 },
  body:  { fontFamily: fonts.sans,       fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.sans,       fontSize: 13 },
  label: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 0.3 },
  tiny:  { fontFamily: fonts.sans,       fontSize: 11 },
};

export default { colors, fonts, spacing, radius, shadows, typography };
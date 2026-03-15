// src/theme/tokens.js
// Single source of truth for dark/light color tokens.
// Import useTheme() in any screen to get the current palette.

import useThemeStore from '../store/themeStore';

export const DARK = {
  bg:          '#0A0A0F',
  surface:     '#13131A',
  surfaceHigh: '#1C1C27',
  border:      'rgba(255,255,255,0.07)',
  borderBright:'rgba(255,255,255,0.13)',
  ink:         '#F4F4F6',
  inkMid:      '#9898A8',
  inkDim:      '#5A5A6E',
  sage:        '#4ADE80',
  sageDim:     'rgba(74,222,128,0.15)',
  sageMid:     '#22C55E',
  amber:       '#FBBF24',
  amberDim:    'rgba(251,191,36,0.15)',
  rose:        '#F87171',
  roseDim:     'rgba(248,113,113,0.15)',
  sky:         '#60A5FA',
  skyDim:      'rgba(96,165,250,0.15)',
  violet:      '#A78BFA',
  violetDim:   'rgba(167,139,250,0.15)',
};

export const LIGHT = {
  bg:          '#F7F6F2',
  surface:     '#FFFFFF',
  surfaceHigh: '#F2EEE8',
  border:      'rgba(0,0,0,0.07)',
  borderBright:'rgba(0,0,0,0.13)',
  ink:         '#1C1917',
  inkMid:      '#57534E',
  inkDim:      '#A8A29E',
  sage:        '#16A34A',
  sageDim:     'rgba(22,163,74,0.12)',
  sageMid:     '#15803D',
  amber:       '#D97706',
  amberDim:    'rgba(217,119,6,0.12)',
  rose:        '#DC2626',
  roseDim:     'rgba(220,38,38,0.12)',
  sky:         '#2563EB',
  skyDim:      'rgba(37,99,235,0.12)',
  violet:      '#7C3AED',
  violetDim:   'rgba(124,58,237,0.12)',
};

/** Hook — returns current palette C and isDark flag */
export function useTheme() {
  const isDark = useThemeStore(s => s.isDark);
  return { C: isDark ? DARK : LIGHT, isDark };
}
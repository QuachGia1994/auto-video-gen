// Design tokens — single source of truth for the Android app palette.
// Mirrors apps/ios/AutoVideoGen/Theme.swift (same semantic keys, tuned per platform).

export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

export interface Palette {
  scheme: Scheme;
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  hairline: string;
  textPrimary: string;
  textSecondary: string;
  textFaint: string;
  accent: string;
  accentAlt: string;
  accentBlue: string;
  gradient: [string, string, string];
  success: string;
  danger: string;
  onAccent: string;
  inputBg: string;
  tabBar: string;
  overlay: string;
  glowTint: string;
}

const dark: Palette = {
  scheme: 'dark',
  bg: '#0A1019',
  bgElevated: '#101A2A',
  surface: '#141E30',
  surfaceAlt: '#1D2A41',
  border: '#273449',
  hairline: 'rgba(255,255,255,0.08)',
  textPrimary: '#F5F8FF',
  textSecondary: '#A6B2C6',
  textFaint: '#6B7889',
  accent: '#8B5CF6',
  accentAlt: '#22D3EE',
  accentBlue: '#3B82F6',
  gradient: ['#8B5CF6', '#4F7BFF', '#22D3EE'],
  success: '#34D399',
  danger: '#FB7185',
  onAccent: '#FFFFFF',
  inputBg: '#0B1322',
  tabBar: '#0C1421',
  overlay: 'rgba(4,8,15,0.72)',
  glowTint: 'rgba(139,92,246,0.45)',
};

const light: Palette = {
  scheme: 'light',
  bg: '#F3F5FC',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF1FA',
  border: '#E1E7F3',
  hairline: 'rgba(17,26,42,0.08)',
  textPrimary: '#121A2B',
  textSecondary: '#54617A',
  textFaint: '#9AA5BA',
  accent: '#6D3BF5',
  accentAlt: '#0E9BC4',
  accentBlue: '#2563EB',
  gradient: ['#7C3AED', '#4F5DF5', '#0EA5C9'],
  success: '#0E9F6E',
  danger: '#E11D48',
  onAccent: '#FFFFFF',
  inputBg: '#EEF2FB',
  tabBar: '#FFFFFF',
  overlay: 'rgba(17,26,42,0.32)',
  glowTint: 'rgba(109,59,245,0.22)',
};

export const palettes: Record<Scheme, Palette> = { dark, light };

export const radii = {
  card: 22,
  control: 16,
  small: 12,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
} as const;

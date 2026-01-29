export const theme = {
  colors: {
    bg: 'linear-gradient(135deg, #0a0e1a 0%, #1a1535 50%, #0f172a 100%)',
    text: '#fff',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    headerBg: 'rgba(10,14,26,0.95)',
    headerBorder: '1px solid rgba(139,92,246,0.2)',
    cardBg: 'linear-gradient(135deg, rgba(26,21,53,0.4), rgba(15,23,42,0.4))',
    cardBgSolid: 'linear-gradient(135deg, rgba(26,21,53,0.6), rgba(15,23,42,0.6))',
    cardBorder: '1px solid rgba(139,92,246,0.2)',
    cardInner: 'rgba(15,23,42,0.6)',
    chartGrid: '#334155',
    chartText: '#94a3b8',
    primary: '#8b5cf6',
    primaryLight: 'rgba(139,92,246,0.15)',
    primaryBorder: 'rgba(139,92,246,0.3)',
    accent: '#f97316',
    accentLight: 'rgba(249,115,22,0.15)',
    accentBorder: 'rgba(249,115,22,0.5)',
    success: '#10b981',
    successLight: 'rgba(16,185,129,0.15)',
    successBorder: 'rgba(16,185,129,0.3)',
    warning: '#f59e0b',
    warningLight: 'rgba(245,158,11,0.15)',
    warningBorder: 'rgba(245,158,11,0.3)',
    danger: '#ef4444',
    dangerLight: 'rgba(239,68,68,0.15)',
    dangerBorder: 'rgba(239,68,68,0.3)',
    info: '#6366f1',
    infoLight: 'rgba(99,102,241,0.15)',
    infoBorder: 'rgba(99,102,241,0.3)',
    muted: '#94a3b8',
    mutedLight: 'rgba(100,116,139,0.15)',
    mutedBorder: 'rgba(100,116,139,0.3)',
    gradient: 'linear-gradient(135deg, #f97316, #8b5cf6)',
    gradientReverse: 'linear-gradient(135deg, #8b5cf6, #f97316)',
    dark: 'rgba(30,41,59,0.8)',
    darkSolid: '#1e293b',
    progressBg: 'rgba(30,41,59,0.8)',
  },
  borderRadius: {
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '12px',
    '2xl': '16px',
    full: '50%',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '2.5rem',
  },
  fontSize: {
    xs: '0.7rem',
    sm: '0.75rem',
    base: '0.875rem',
    md: '0.95rem',
    lg: '1rem',
    xl: '1.1rem',
    '2xl': '1.125rem',
    '3xl': '1.25rem',
    '4xl': '1.5rem',
    '5xl': '1.875rem',
    '6xl': '2rem',
    '7xl': '2.5rem',
    '8xl': '3rem',
    '9xl': '4.5rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  shadows: {
    card: '0 4px 20px rgba(0,0,0,0.2)',
    dropdown: '0 10px 40px rgba(0,0,0,0.3)',
  },
  transitions: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
} as const;

export type Theme = typeof theme;

export const statusColors = {
  'on-track': theme.colors.success,
  'at-risk': theme.colors.warning,
  'delayed': theme.colors.danger,
} as const;

export const statusLabels = {
  'on-track': 'ON-TRACK',
  'at-risk': 'AT-RISK',
  'delayed': 'DELAYED',
} as const;

export const priorityColors = {
  high: theme.colors.danger,
  medium: theme.colors.warning,
  low: theme.colors.info,
} as const;

export const chartColors = {
  revenue: theme.colors.success,
  expenses: theme.colors.danger,
  profit: theme.colors.info,
  primary: theme.colors.primary,
  secondary: theme.colors.accent,
  tertiary: theme.colors.warning,
} as const;

export const tooltipStyle = {
  backgroundColor: theme.colors.darkSolid,
  border: 'none',
  borderRadius: theme.borderRadius.md,
} as const;

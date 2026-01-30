// Legacy theme object for backward compatibility
// New components should use Tailwind classes with semantic tokens from index.css

export const theme = {
  colors: {
    bg: 'hsl(222 47% 6%)',
    text: 'hsl(210 40% 98%)',
    textSecondary: 'hsl(215 20% 65%)',
    textMuted: 'hsl(215 20% 45%)',
    headerBg: 'hsl(222 47% 6% / 0.95)',
    headerBorder: '1px solid hsl(258 90% 66% / 0.2)',
    cardBg: 'hsl(222 47% 8% / 0.6)',
    cardBgSolid: 'hsl(222 47% 8%)',
    cardBorder: '1px solid hsl(217 33% 17% / 0.5)',
    cardInner: 'hsl(222 47% 6% / 0.8)',
    chartGrid: 'hsl(217 33% 25%)',
    chartText: 'hsl(215 20% 65%)',
    primary: 'hsl(258 90% 66%)',
    primaryLight: 'hsl(258 90% 66% / 0.15)',
    primaryBorder: 'hsl(258 90% 66% / 0.3)',
    accent: 'hsl(24 95% 53%)',
    accentLight: 'hsl(24 95% 53% / 0.15)',
    accentBorder: 'hsl(24 95% 53% / 0.5)',
    success: 'hsl(160 84% 39%)',
    successLight: 'hsl(160 84% 39% / 0.15)',
    successBorder: 'hsl(160 84% 39% / 0.3)',
    warning: 'hsl(38 92% 50%)',
    warningLight: 'hsl(38 92% 50% / 0.15)',
    warningBorder: 'hsl(38 92% 50% / 0.3)',
    danger: 'hsl(0 84% 60%)',
    dangerLight: 'hsl(0 84% 60% / 0.15)',
    dangerBorder: 'hsl(0 84% 60% / 0.3)',
    info: 'hsl(239 84% 67%)',
    infoLight: 'hsl(239 84% 67% / 0.15)',
    infoBorder: 'hsl(239 84% 67% / 0.3)',
    muted: 'hsl(215 20% 65%)',
    mutedLight: 'hsl(215 20% 65% / 0.15)',
    mutedBorder: 'hsl(217 33% 17%)',
    gradient: 'linear-gradient(135deg, hsl(24 95% 53%), hsl(258 90% 66%))',
    gradientReverse: 'linear-gradient(135deg, hsl(258 90% 66%), hsl(24 95% 53%))',
    dark: 'hsl(222 47% 10%)',
    darkSolid: 'hsl(222 47% 10%)',
    progressBg: 'hsl(222 47% 15%)',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
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
    xs: '0.75rem',
    sm: '0.8125rem',
    base: '0.875rem',
    md: '0.9375rem',
    lg: '1rem',
    xl: '1.125rem',
    '2xl': '1.25rem',
    '3xl': '1.375rem',
    '4xl': '1.5rem',
    '5xl': '1.875rem',
    '6xl': '2.25rem',
    '7xl': '3rem',
    '8xl': '3.75rem',
    '9xl': '4.5rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  shadows: {
    card: '0 4px 20px -5px hsl(222 47% 6% / 0.5)',
    dropdown: '0 10px 40px -10px hsl(222 47% 6% / 0.6)',
    glow: '0 0 30px -5px hsl(258 90% 66% / 0.3)',
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
  borderRadius: theme.borderRadius.lg,
  boxShadow: theme.shadows.dropdown,
} as const;

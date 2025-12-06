// TradieTrack Mobile Design System
// Matches web app styling EXACTLY for 1:1 visual parity
// Based on web's index.css and design_guidelines.md

import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// === SPACING (matches web's tailwind spacing scale) ===
// Web uses: gap-4 = 16px, p-4 = 16px, space-y-6 = 24px
export const spacing = {
  xs: 2,      // 0.5 tailwind unit
  sm: 4,      // 1 tailwind unit
  md: 8,      // 2 tailwind units (gap-2)
  lg: 12,     // 3 tailwind units (gap-3)
  xl: 16,     // 4 tailwind units (gap-4, p-4) - PRIMARY SPACING
  '2xl': 20,  // 5 tailwind units
  '3xl': 24,  // 6 tailwind units (space-y-6)
  '4xl': 32,  // 8 tailwind units
} as const;

// Page shell padding (matches web's PageShell component)
export const pageShell = {
  paddingHorizontal: spacing.xl, // 16px - web's px-4
  paddingTop: spacing.xl,        // 16px - web's pt-4
  paddingBottom: 100,            // bottom nav clearance (64px nav + 36px spacing)
  sectionGap: spacing['3xl'],    // 24px - web's space-y-6
} as const;

// === BORDER RADIUS (matches web's tailwind radius) ===
export const radius = {
  xs: 4,      // rounded
  sm: 6,      // rounded-md
  md: 8,      // --radius in web (0.5rem)
  lg: 10,     // rounded-lg
  xl: 14,     // rounded-xl - main card radius (matches web)
  '2xl': 16,  // rounded-2xl - feed cards, modals
  pill: 9999, // fully rounded pills
  full: 9999,
} as const;

// === FIXED SIZES (compact for modern density) ===
export const sizes = {
  // Input/search heights - reduced from 48 to 40
  inputHeight: 40,
  inputHeightSm: 32,
  searchBarHeight: 40,
  // Icon containers - smaller
  iconSm: 16,
  iconMd: 20,
  iconLg: 28,
  // Avatar/dot sizes - compact
  dotSm: 6,
  dotLg: 10,
  avatarSm: 28,
  avatarMd: 36,
  avatarLg: 48,
  // Quick action button - smaller
  quickActionBtn: 32,
  // FAB - 56px as per design spec
  fabSize: 56,
  fabOffset: 28,
  // Empty state icons - smaller
  emptyIcon: 40,
  emptyIconSm: 28,
  // Filter counts
  filterCountMin: 18,
} as const;

// === SHADOWS (matches web's shadow system from index.css) ===
// Web uses: shadow-sm, shadow, shadow-md, shadow-lg with HSL-based colors
export const shadows = {
  none: {},
  '2xs': Platform.select({
    ios: {
      shadowColor: '#1c2130',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 1,
    },
    android: {
      elevation: 0.5,
    },
  }) as object,
  xs: Platform.select({
    ios: {
      shadowColor: '#1c2130',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
    },
    android: {
      elevation: 1,
    },
  }) as object,
  sm: Platform.select({
    ios: {
      shadowColor: '#1c2130',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    android: {
      elevation: 1.5,
    },
  }) as object,
  md: Platform.select({
    ios: {
      shadowColor: '#1c2130',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: {
      elevation: 3,
    },
  }) as object,
  lg: Platform.select({
    ios: {
      shadowColor: '#1c2130',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 15,
    },
    android: {
      elevation: 6,
    },
  }) as object,
  xl: Platform.select({
    ios: {
      shadowColor: '#1c2130',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.1,
      shadowRadius: 25,
    },
    android: {
      elevation: 10,
    },
  }) as object,
} as const;

// === TYPOGRAPHY (matches web's iOS-style system from index.css) ===
// Web uses: ios-title, ios-section-title, ios-card-title, ios-body, ios-caption, ios-label
export const typography = {
  // iOS Large Title - 32-34px on web
  largeTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  // iOS Section Title - 22-24px on web (.ios-section-title)
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  // Page title (legacy) - same as section title
  pageTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  // Headline
  headline: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
  },
  // iOS Card Title - 17px on web (.ios-card-title)
  cardTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  // Subtitle (section headers)
  subtitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  // iOS Body - 15px on web (.ios-body)
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  // Body semibold
  bodySemibold: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  // iOS Caption - 13px on web (.ios-caption)
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  // Small caption
  captionSmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  // iOS Label - 11px on web (.ios-label)
  label: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  // Button text - 14px
  button: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  // Badge text - 11px
  badge: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
  },
  // Stat value - large numbers
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
  },
} as const;

// === ICON SIZES (compact like web) ===
export const iconSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
} as const;

// === COLORS ===
// Note: For dynamic brand theming, use `import { useTheme } from './theme'`
// The static colors export is deprecated - use the theme context instead.
// See theme.tsx for useTheme() and useThemedStyles() helpers.

// === ANIMATION DURATIONS ===
export const durations = {
  fast: 100,
  normal: 200,
  slow: 300,
} as const;

// === PRESS SCALE (for hover-elevate equivalent) ===
export const pressScale = {
  normal: 0.98,
  subtle: 0.995,
} as const;

// === SHARED COMPONENT STYLES (compact modern styling) ===
export const componentStyles = StyleSheet.create({
  // Feed card - light background, subtle border, minimal shadow
  feedCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    ...shadows.xs,
  },
  
  // Card with press effect - clean and minimal
  cardPress: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    ...shadows.xs,
  },
  
  // Card padding - tighter
  cardPadding: {
    padding: spacing.lg, // 12px
  },
  
  // Promo card - subtle blue tint
  promoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: spacing.lg,
  },
  
  // Primary button - compact height
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: spacing.sm,
    minHeight: 36,
  },
  
  // Secondary/outline button - compact
  outlineButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: spacing.sm,
    minHeight: 36,
  },
  
  // Ghost button - minimal
  ghostButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: spacing.xs,
  },
  
  // Icon button - smaller
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  // Quick action button - compact
  quickActionButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    minHeight: 36,
  },
  
  // Quick action button active state
  quickActionButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  
  // Badge - smaller padding
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  // Empty state - tighter
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: spacing['3xl'],
    backgroundColor: '#f8fafc',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  
  // Section header - tighter margin
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.md,
  },
  
  // Row with gap
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  
  // 2-column grid
  grid2: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  
  // Screen container
  screenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  
  // Scroll content
  scrollContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: pageShell.paddingBottom,
  },
});

// === STATUS COLORS (job status colors) ===
export const statusColors = {
  pending: {
    bg: '#fef3c7',
    text: '#d97706',
    border: '#fcd34d',
    dot: '#f59e0b',
  },
  scheduled: {
    bg: '#dbeafe',
    text: '#2563eb',
    border: '#93c5fd',
    dot: '#3b82f6',
  },
  in_progress: {
    bg: '#dcfce7',
    text: '#16a34a',
    border: '#86efac',
    dot: '#22c55e',
  },
  done: {
    bg: '#d1fae5',
    text: '#059669',
    border: '#6ee7b7',
    dot: '#10b981',
  },
  invoiced: {
    bg: '#ede9fe',
    text: '#7c3aed',
    border: '#c4b5fd',
    dot: '#8b5cf6',
  },
} as const;

export type JobStatus = keyof typeof statusColors;

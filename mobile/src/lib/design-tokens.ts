// TradieTrack Mobile Design System
// Matches web app styling EXACTLY for 1:1 visual parity
// Based on web's index.css and design_guidelines.md

import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// === SPACING (matches web's tailwind spacing scale exactly) ===
// Web uses: gap-4 = 16px, p-4 = 16px, p-5 = 20px, space-y-6 = 24px
export const spacing = {
  xs: 4,      // 1 tailwind unit - gap-1
  sm: 8,      // 2 tailwind units - gap-2
  md: 12,     // 3 tailwind units - gap-3
  lg: 16,     // 4 tailwind units - gap-4, p-4 - PRIMARY SPACING
  xl: 20,     // 5 tailwind units - p-5
  '2xl': 24,  // 6 tailwind units - space-y-6
  '3xl': 32,  // 8 tailwind units
  '4xl': 40,  // 10 tailwind units
} as const;

// Page shell padding (matches web's PageShell component exactly)
export const pageShell = {
  paddingHorizontal: spacing.lg, // 16px - web's px-4
  paddingTop: spacing.lg,        // 16px - web's pt-4
  paddingBottom: spacing['2xl'], // 24px - section gap
  sectionGap: spacing['2xl'],    // 24px - web's space-y-6
} as const;

// Bottom tab bar clearance - use this ONLY on screens that have bottom tabs visible
export const bottomTabClearance = 90; // 64px nav + 26px safe area

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

// === FIXED SIZES (matching web for visual parity) ===
export const sizes = {
  // Input/search heights - 44px min touch target
  inputHeight: 44,
  inputHeightSm: 36,
  searchBarHeight: 44,
  // Icon containers - proper sizing
  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
  // Avatar/dot sizes
  dotSm: 8,
  dotLg: 12,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 52,
  // Quick action button - 44px min touch target
  quickActionBtn: 44,
  // FAB - 56px as per design spec
  fabSize: 56,
  fabOffset: 28,
  // Empty state icons
  emptyIcon: 48,
  emptyIconSm: 32,
  // Filter chips - 44px min touch target
  filterChipHeight: 44,
  filterCountMin: 20,
  // Card minimum heights
  cardMinHeight: 80,
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

// === ICON SIZES (matches web lucide icons) ===
export const iconSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
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

// === SHARED COMPONENT STYLES (layout only - NO hardcoded colors) ===
// IMPORTANT: Colors should come from useTheme() hook, not from here
// These styles only define layout, spacing, and structural properties
export const componentStyles = StyleSheet.create({
  // Card padding - tighter
  cardPadding: {
    padding: spacing.lg, // 12px
  },
  
  // Badge - smaller padding
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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

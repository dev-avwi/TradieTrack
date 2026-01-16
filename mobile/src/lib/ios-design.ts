import { Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { useMemo } from 'react';

// Platform detection
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// ============================================================================
// iOS SYSTEM COLORS
// Authentic Apple Human Interface Guidelines colors
// ============================================================================

export const IOSSystemColors = {
  // Primary System Colors
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemIndigo: '#5856D6',
  systemOrange: '#FF9500',
  systemPink: '#FF2D55',
  systemPurple: '#AF52DE',
  systemRed: '#FF3B30',
  systemTeal: '#5AC8FA',
  systemYellow: '#FFCC00',
  
  // Gray Scale
  systemGray: '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F2F2F7',
  
  // Semantic Colors - Light Mode
  light: {
    label: '#000000',
    secondaryLabel: 'rgba(60, 60, 67, 0.6)',
    tertiaryLabel: 'rgba(60, 60, 67, 0.3)',
    quaternaryLabel: 'rgba(60, 60, 67, 0.18)',
    placeholderText: 'rgba(60, 60, 67, 0.3)',
    separator: 'rgba(60, 60, 67, 0.29)',
    opaqueSeparator: '#C6C6C8',
    systemBackground: '#FFFFFF',
    secondarySystemBackground: '#F2F2F7',
    tertiarySystemBackground: '#FFFFFF',
    systemGroupedBackground: '#F2F2F7',
    secondarySystemGroupedBackground: '#FFFFFF',
    tertiarySystemGroupedBackground: '#F2F2F7',
    systemFill: 'rgba(120, 120, 128, 0.2)',
    secondarySystemFill: 'rgba(120, 120, 128, 0.16)',
    tertiarySystemFill: 'rgba(118, 118, 128, 0.12)',
    quaternarySystemFill: 'rgba(116, 116, 128, 0.08)',
  },
  
  // Semantic Colors - Dark Mode
  dark: {
    label: '#FFFFFF',
    secondaryLabel: 'rgba(235, 235, 245, 0.6)',
    tertiaryLabel: 'rgba(235, 235, 245, 0.3)',
    quaternaryLabel: 'rgba(235, 235, 245, 0.18)',
    placeholderText: 'rgba(235, 235, 245, 0.3)',
    separator: 'rgba(84, 84, 88, 0.6)',
    opaqueSeparator: '#38383A',
    systemBackground: '#000000',
    secondarySystemBackground: '#1C1C1E',
    tertiarySystemBackground: '#2C2C2E',
    systemGroupedBackground: '#000000',
    secondarySystemGroupedBackground: '#1C1C1E',
    tertiarySystemGroupedBackground: '#2C2C2E',
    systemFill: 'rgba(120, 120, 128, 0.36)',
    secondarySystemFill: 'rgba(120, 120, 128, 0.32)',
    tertiarySystemFill: 'rgba(118, 118, 128, 0.24)',
    quaternarySystemFill: 'rgba(118, 118, 128, 0.18)',
  },
};

// ============================================================================
// iOS TYPOGRAPHY
// SF Pro text sizes following Apple Human Interface Guidelines
// ============================================================================

export const IOSTypography = {
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: 0.36,
    lineHeight: 34,
  },
  title2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: 0.35,
    lineHeight: 28,
  },
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.38,
    lineHeight: 25,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.32,
    lineHeight: 21,
  },
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: -0.08,
    lineHeight: 18,
  },
  caption1: {
    fontSize: 12,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 16,
  },
  caption2: {
    fontSize: 11,
    fontWeight: '400' as const,
    letterSpacing: 0.07,
    lineHeight: 13,
  },
};

// ============================================================================
// iOS CORNER RADII
// Standard Apple corner radius values
// ============================================================================

export const IOSCorners = {
  // Small elements (badges, small buttons)
  small: 6,
  // Standard buttons
  button: 8,
  // Cards, modals, grouped content
  card: 10,
  // Large cards, modal sheets
  large: 13,
  // Bottom sheets, full screen modals
  sheet: 20,
  // Pill/capsule shape (use with height/2)
  pill: 9999,
};

// ============================================================================
// iOS SHADOWS
// Minimal shadows - iOS uses translucency over heavy shadows
// ============================================================================

export const IOSShadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
};

// ============================================================================
// iOS GROUPED LIST STYLING
// Inset grouped table view styling
// ============================================================================

export interface IOSGroupedListStyle {
  container: ViewStyle;
  header: ViewStyle;
  headerText: TextStyle;
  item: ViewStyle;
  itemFirst: ViewStyle;
  itemLast: ViewStyle;
  separator: ViewStyle;
  insetMargin: number;
}

export function getIOSGroupedListStyle(isDark: boolean): IOSGroupedListStyle {
  const colors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  return {
    container: {
      backgroundColor: colors.systemGroupedBackground,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 8,
    },
    headerText: {
      ...IOSTypography.footnote,
      color: colors.secondaryLabel,
      textTransform: 'uppercase',
    },
    item: {
      backgroundColor: colors.secondarySystemGroupedBackground,
      paddingHorizontal: 16,
      paddingVertical: 11,
      minHeight: 44,
    },
    itemFirst: {
      borderTopLeftRadius: IOSCorners.card,
      borderTopRightRadius: IOSCorners.card,
    },
    itemLast: {
      borderBottomLeftRadius: IOSCorners.card,
      borderBottomRightRadius: IOSCorners.card,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.separator,
      marginLeft: 16,
    },
    insetMargin: 16,
  };
}

// ============================================================================
// iOS BUTTON STYLES
// System button styling
// ============================================================================

export interface IOSButtonStyle {
  filled: ViewStyle & { textColor: string };
  tinted: ViewStyle & { textColor: string };
  gray: ViewStyle & { textColor: string };
  plain: ViewStyle & { textColor: string };
  destructive: ViewStyle & { textColor: string };
}

export function getIOSButtonStyle(isDark: boolean): IOSButtonStyle {
  const colors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  return {
    filled: {
      backgroundColor: IOSSystemColors.systemBlue,
      borderRadius: IOSCorners.button,
      borderWidth: 0,
      textColor: '#FFFFFF',
    },
    tinted: {
      backgroundColor: isDark ? 'rgba(0, 122, 255, 0.25)' : 'rgba(0, 122, 255, 0.15)',
      borderRadius: IOSCorners.button,
      borderWidth: 0,
      textColor: IOSSystemColors.systemBlue,
    },
    gray: {
      backgroundColor: colors.tertiarySystemFill,
      borderRadius: IOSCorners.button,
      borderWidth: 0,
      textColor: colors.label,
    },
    plain: {
      backgroundColor: 'transparent',
      borderRadius: IOSCorners.button,
      borderWidth: 0,
      textColor: IOSSystemColors.systemBlue,
    },
    destructive: {
      backgroundColor: IOSSystemColors.systemRed,
      borderRadius: IOSCorners.button,
      borderWidth: 0,
      textColor: '#FFFFFF',
    },
  };
}

// ============================================================================
// iOS BADGE/CAPSULE STYLES
// Pill-shaped badges with subtle backgrounds
// ============================================================================

export interface IOSBadgeStyle {
  container: ViewStyle;
  text: TextStyle;
}

export function getIOSBadgeStyle(
  variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary',
  isDark: boolean
): IOSBadgeStyle {
  const baseStyle: ViewStyle = {
    borderRadius: IOSCorners.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0,
  };
  
  const textBase: TextStyle = {
    ...IOSTypography.caption1,
    fontWeight: '500',
  };
  
  switch (variant) {
    case 'success':
      return {
        container: {
          ...baseStyle,
          backgroundColor: isDark ? 'rgba(52, 199, 89, 0.2)' : 'rgba(52, 199, 89, 0.15)',
        },
        text: {
          ...textBase,
          color: IOSSystemColors.systemGreen,
        },
      };
    case 'warning':
      return {
        container: {
          ...baseStyle,
          backgroundColor: isDark ? 'rgba(255, 149, 0, 0.2)' : 'rgba(255, 149, 0, 0.15)',
        },
        text: {
          ...textBase,
          color: IOSSystemColors.systemOrange,
        },
      };
    case 'destructive':
      return {
        container: {
          ...baseStyle,
          backgroundColor: isDark ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255, 59, 48, 0.15)',
        },
        text: {
          ...textBase,
          color: IOSSystemColors.systemRed,
        },
      };
    case 'secondary':
      return {
        container: {
          ...baseStyle,
          backgroundColor: isDark 
            ? IOSSystemColors.dark.tertiarySystemFill 
            : IOSSystemColors.light.tertiarySystemFill,
        },
        text: {
          ...textBase,
          color: isDark ? IOSSystemColors.dark.secondaryLabel : IOSSystemColors.light.secondaryLabel,
        },
      };
    default:
      return {
        container: {
          ...baseStyle,
          backgroundColor: isDark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.15)',
        },
        text: {
          ...textBase,
          color: IOSSystemColors.systemBlue,
        },
      };
  }
}

// ============================================================================
// iOS CARD STYLES
// Grouped list card styling (ServiceM8 aesthetic)
// ============================================================================

export interface IOSCardStyle {
  container: ViewStyle;
  elevated: ViewStyle;
  outlined: ViewStyle;
  ghost: ViewStyle;
}

export function getIOSCardStyle(isDark: boolean): IOSCardStyle {
  const colors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  return {
    container: {
      backgroundColor: colors.secondarySystemGroupedBackground,
      borderRadius: IOSCorners.card,
      borderWidth: 0,
      ...IOSShadows.none,
    },
    elevated: {
      backgroundColor: colors.secondarySystemGroupedBackground,
      borderRadius: IOSCorners.card,
      borderWidth: 0,
      ...IOSShadows.subtle,
    },
    outlined: {
      backgroundColor: colors.secondarySystemGroupedBackground,
      borderRadius: IOSCorners.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.separator,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderRadius: IOSCorners.card,
      borderWidth: 0,
    },
  };
}

// ============================================================================
// iOS SEGMENTED CONTROL STYLES
// Native segmented control styling
// ============================================================================

export interface IOSSegmentedControlStyle {
  container: ViewStyle;
  segment: ViewStyle;
  selectedSegment: ViewStyle;
  indicator: ViewStyle;
  text: TextStyle;
  selectedText: TextStyle;
}

export function getIOSSegmentedControlStyle(isDark: boolean): IOSSegmentedControlStyle {
  const colors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  return {
    container: {
      backgroundColor: colors.tertiarySystemFill,
      borderRadius: 9,
      padding: 2,
      flexDirection: 'row',
    },
    segment: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 7,
    },
    selectedSegment: {
      // Indicator handles the selected appearance
    },
    indicator: {
      backgroundColor: isDark ? '#636366' : '#FFFFFF',
      borderRadius: 7,
      ...IOSShadows.subtle,
    },
    text: {
      ...IOSTypography.subhead,
      fontWeight: '500',
      color: colors.secondaryLabel,
    },
    selectedText: {
      ...IOSTypography.subhead,
      fontWeight: '600',
      color: colors.label,
    },
  };
}

// ============================================================================
// useIOSStyles HOOK
// Returns platform-conditional styles
// ============================================================================

export interface IOSStyles {
  isIOS: boolean;
  colors: typeof IOSSystemColors.light | typeof IOSSystemColors.dark;
  systemColors: typeof IOSSystemColors;
  typography: typeof IOSTypography;
  corners: typeof IOSCorners;
  shadows: typeof IOSShadows;
  getGroupedListStyle: () => IOSGroupedListStyle;
  getButtonStyle: () => IOSButtonStyle;
  getBadgeStyle: (variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary') => IOSBadgeStyle;
  getCardStyle: () => IOSCardStyle;
  getSegmentedControlStyle: () => IOSSegmentedControlStyle;
}

export function useIOSStyles(isDark: boolean): IOSStyles {
  return useMemo(() => ({
    isIOS,
    colors: isDark ? IOSSystemColors.dark : IOSSystemColors.light,
    systemColors: IOSSystemColors,
    typography: IOSTypography,
    corners: IOSCorners,
    shadows: IOSShadows,
    getGroupedListStyle: () => getIOSGroupedListStyle(isDark),
    getButtonStyle: () => getIOSButtonStyle(isDark),
    getBadgeStyle: (variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary') => 
      getIOSBadgeStyle(variant, isDark),
    getCardStyle: () => getIOSCardStyle(isDark),
    getSegmentedControlStyle: () => getIOSSegmentedControlStyle(isDark),
  }), [isDark]);
}

export default {
  isIOS,
  isAndroid,
  IOSSystemColors,
  IOSTypography,
  IOSCorners,
  IOSShadows,
  useIOSStyles,
};

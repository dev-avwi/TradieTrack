/**
 * Native iOS Grouped List Component
 * Provides UITableView grouped/inset list styling on iOS
 * Falls back to standard list on Android
 */
import { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ViewStyle, TextStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { IOSCorners, IOSShadows, IOSSystemColors } from '../../lib/ios-design';
import { spacing, radius, typography } from '../../lib/design-tokens';

// Helper to get iOS colors based on theme
const getIOSColors = (isDark: boolean) => isDark ? IOSSystemColors.dark : IOSSystemColors.light;

interface IOSGroupedListProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Section header text */
  header?: string;
  /** Section footer text */
  footer?: string;
  /** Inset style (iOS 14+) - smaller horizontal margins */
  inset?: boolean;
}

export function IOSGroupedList({
  children,
  style,
  header,
  footer,
  inset = true,
}: IOSGroupedListProps) {
  const { colors, isDark } = useTheme();
  
  if (isIOS) {
    const iosColors = getIOSColors(isDark);
    
    return (
      <View style={[styles.iosContainer, style]}>
        {header && (
          <Text style={[
            styles.iosHeader,
            { color: iosColors.secondaryLabel },
          ]}>
            {header.toUpperCase()}
          </Text>
        )}
        <View style={[
          styles.iosListContainer,
          {
            backgroundColor: iosColors.secondarySystemGroupedBackground,
            borderRadius: IOSCorners.card,
            marginHorizontal: inset ? 16 : 0,
          },
          IOSShadows.card,
        ]}>
          {children}
        </View>
        {footer && (
          <Text style={[
            styles.iosFooter,
            { 
              color: iosColors.secondaryLabel,
              marginHorizontal: inset ? 16 : 0,
            },
          ]}>
            {footer}
          </Text>
        )}
      </View>
    );
  }

  // Android fallback
  return (
    <View style={[styles.androidContainer, style]}>
      {header && (
        <Text style={[styles.androidHeader, { color: colors.mutedForeground }]}>
          {header}
        </Text>
      )}
      <View style={[
        styles.androidListContainer,
        { backgroundColor: colors.card, borderRadius: radius.md },
      ]}>
        {children}
      </View>
      {footer && (
        <Text style={[styles.androidFooter, { color: colors.mutedForeground }]}>
          {footer}
        </Text>
      )}
    </View>
  );
}

interface IOSListItemProps {
  label: string;
  value?: string | ReactNode;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  iconBackgroundColor?: string;
  onPress?: () => void;
  /** Show disclosure indicator (chevron) */
  disclosure?: boolean;
  /** Show as destructive (red text) */
  destructive?: boolean;
  /** Show toggle switch instead of value */
  toggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  /** Custom right accessory */
  rightAccessory?: ReactNode;
  /** Show separator below */
  showSeparator?: boolean;
  /** Haptic feedback on press */
  hapticFeedback?: boolean;
  /** Custom content instead of label/value */
  children?: ReactNode;
  style?: ViewStyle;
}

export function IOSListItem({
  label,
  value,
  icon,
  iconColor,
  iconBackgroundColor,
  onPress,
  disclosure = true,
  destructive = false,
  toggle = false,
  toggleValue,
  onToggleChange,
  rightAccessory,
  showSeparator = true,
  hapticFeedback = true,
  children,
  style,
}: IOSListItemProps) {
  const { colors, isDark } = useTheme();
  const iosColors = getIOSColors(isDark);

  const handlePress = () => {
    if (hapticFeedback && isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const content = (
    <View style={[
      styles.itemContainer,
      isIOS && styles.iosItemContainer,
      showSeparator && isIOS && styles.iosItemSeparator,
      style,
    ]}>
      {/* Icon */}
      {icon && (
        <View style={[
          styles.iconContainer,
          isIOS && styles.iosIconContainer,
          isIOS && {
            backgroundColor: iconBackgroundColor || (isDark ? IOSSystemColors.systemGray4 : IOSSystemColors.systemGray5),
          },
        ]}>
          <Feather
            name={icon}
            size={isIOS ? 18 : 20}
            color={iconColor || (isIOS ? IOSSystemColors.systemBlue : colors.primary)}
          />
        </View>
      )}

      {/* Content */}
      {children ? (
        <View style={styles.childrenContainer}>{children}</View>
      ) : (
        <View style={styles.contentContainer}>
          <Text style={[
            styles.label,
            isIOS && styles.iosLabel,
            { color: destructive 
              ? (isIOS ? IOSSystemColors.systemRed : colors.destructive) 
              : (isIOS ? iosColors.label : colors.foreground) 
            },
          ]}>
            {label}
          </Text>
          
          {typeof value === 'string' ? (
            <Text style={[
              styles.value,
              isIOS && styles.iosValue,
              { color: isIOS ? iosColors.secondaryLabel : colors.mutedForeground },
            ]}>
              {value}
            </Text>
          ) : value}
        </View>
      )}

      {/* Right accessory */}
      {rightAccessory}

      {/* Disclosure indicator */}
      {onPress && disclosure && !toggle && !rightAccessory && (
        <Feather
          name="chevron-right"
          size={isIOS ? 16 : 20}
          color={isIOS ? iosColors.tertiaryLabel : colors.mutedForeground}
          style={styles.disclosureIcon}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={isIOS ? 0.6 : 0.7}
        style={[
          isIOS && { backgroundColor: iosColors.secondarySystemGroupedBackground },
        ]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Convenience component for section separators
export function IOSListSeparator() {
  const { colors, isDark } = useTheme();
  const iosColors = getIOSColors(isDark);

  if (isIOS) {
    return (
      <View style={[
        styles.iosSeparator,
        { backgroundColor: iosColors.separator },
      ]} />
    );
  }

  return (
    <View style={[
      styles.androidSeparator,
      { backgroundColor: colors.border },
    ]} />
  );
}

const styles = StyleSheet.create({
  // iOS styles
  iosContainer: {
    marginBottom: 24,
  },
  iosHeader: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.08,
    marginBottom: 8,
    marginHorizontal: 32,
    textTransform: 'uppercase',
  },
  iosListContainer: {
    overflow: 'hidden',
  },
  iosFooter: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  iosItemContainer: {
    minHeight: 44, // iOS HIG minimum touch target
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iosItemSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60, 60, 67, 0.29)',
  },
  iosIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iosLabel: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  iosValue: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  iosSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 58, // Inset for icon
  },

  // Android styles
  androidContainer: {
    marginBottom: spacing.md,
  },
  androidHeader: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    textTransform: 'uppercase',
  },
  androidListContainer: {
    overflow: 'hidden',
  },
  androidFooter: {
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  androidSeparator: {
    height: 1,
    marginHorizontal: spacing.md,
  },

  // Shared styles
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48, // Android recommended touch target
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  childrenContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '400',
  },
  disclosureIcon: {
    marginLeft: 8,
  },
});

export default IOSGroupedList;

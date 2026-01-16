/**
 * iOS 26 Liquid Glass List Item
 * 
 * A list item with glass material for use within GlassSection or standalone.
 * Provides proper separators and touch feedback.
 */
import { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { IOSSystemColors, IOSTypography, IOSCorners } from '../../lib/ios-design';

interface GlassListItemProps {
  /** Primary text */
  title: string;
  /** Secondary text */
  subtitle?: string;
  /** Left icon or element */
  leftIcon?: ReactNode;
  /** Right element (defaults to chevron if onPress is provided) */
  rightElement?: ReactNode;
  /** Press handler */
  onPress?: () => void;
  /** Whether this is the first item (for rounded corners) */
  isFirst?: boolean;
  /** Whether this is the last item (for rounded corners) */
  isLast?: boolean;
  /** Show separator */
  showSeparator?: boolean;
  /** Custom style */
  style?: ViewStyle;
  /** Destructive style (red text) */
  destructive?: boolean;
  /** Value text (right aligned, muted) */
  value?: string;
  /** Badge count */
  badge?: number;
}

export function GlassListItem({
  title,
  subtitle,
  leftIcon,
  rightElement,
  onPress,
  isFirst = false,
  isLast = false,
  showSeparator = true,
  style,
  destructive = false,
  value,
  badge,
}: GlassListItemProps) {
  const { isDark } = useTheme();
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  const handlePress = () => {
    if (onPress) {
      if (isIOS) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress();
    }
  };
  
  // Show chevron by default if there's an onPress handler
  const showChevron = onPress && !rightElement;
  
  const content = (
    <>
      {/* Left Icon */}
      {leftIcon && (
        <View style={styles.leftIcon}>
          {leftIcon}
        </View>
      )}
      
      {/* Text Content */}
      <View style={styles.textContainer}>
        <Text 
          style={[
            styles.title, 
            { color: destructive ? IOSSystemColors.systemRed : iosColors.label },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text 
            style={[styles.subtitle, { color: iosColors.secondaryLabel }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      
      {/* Value */}
      {value && (
        <Text style={[styles.value, { color: iosColors.secondaryLabel }]}>
          {value}
        </Text>
      )}
      
      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: IOSSystemColors.systemRed }]}>
          <Text style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
      
      {/* Right Element or Chevron */}
      {rightElement && (
        <View style={styles.rightElement}>
          {rightElement}
        </View>
      )}
      {showChevron && (
        <Feather 
          name="chevron-right" 
          size={18} 
          color={iosColors.tertiaryLabel} 
        />
      )}
      
      {/* Separator */}
      {showSeparator && !isLast && (
        <View 
          style={[
            styles.separator, 
            { 
              backgroundColor: iosColors.separator,
              left: leftIcon ? 52 : 16,
            },
          ]} 
        />
      )}
    </>
  );
  
  const containerStyle = [
    styles.container,
    isFirst && styles.firstItem,
    isLast && styles.lastItem,
    style,
  ];
  
  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          containerStyle,
          pressed && { backgroundColor: iosColors.systemFill },
        ]}
      >
        {content}
      </Pressable>
    );
  }
  
  return (
    <View style={containerStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  firstItem: {
    borderTopLeftRadius: IOSCorners.card,
    borderTopRightRadius: IOSCorners.card,
  },
  lastItem: {
    borderBottomLeftRadius: IOSCorners.card,
    borderBottomRightRadius: IOSCorners.card,
  },
  leftIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...IOSTypography.body,
  },
  subtitle: {
    ...IOSTypography.footnote,
    marginTop: 2,
  },
  value: {
    ...IOSTypography.body,
    marginRight: 4,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  rightElement: {
    marginLeft: 8,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});

export default GlassListItem;

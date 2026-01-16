/**
 * iOS 26 Liquid Glass Quick Action
 * 
 * A quick action button with glass material for dashboard-style
 * action grids. Content shows through the translucent background.
 */
import { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSSystemColors, IOSTypography } from '../../lib/ios-design';

interface GlassQuickActionProps {
  /** Icon name from Feather icons */
  icon: string;
  /** Action label */
  label: string;
  /** Press handler */
  onPress: () => void;
  /** Icon color (defaults to system blue) */
  color?: string;
  /** Custom style */
  style?: ViewStyle;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Badge count */
  badge?: number;
  /** Subtitle/description */
  subtitle?: string;
}

export function GlassQuickAction({
  icon,
  label,
  onPress,
  color,
  style,
  disabled = false,
  badge,
  subtitle,
}: GlassQuickActionProps) {
  const { isDark } = useTheme();
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  const iconColor = color || IOSSystemColors.systemBlue;
  
  // Glass background
  const glassBackground = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(255, 255, 255, 0.6)';
  
  // Icon background (tinted)
  const iconBackground = isDark
    ? `${iconColor}25`
    : `${iconColor}15`;
  
  const handlePress = () => {
    if (!disabled) {
      if (isIOS) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress();
    }
  };
  
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {/* Glass background */}
      {isIOS ? (
        <>
          <BlurView
            intensity={25}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, styles.blurLayer]}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.glassOverlay,
              { backgroundColor: glassBackground },
            ]}
          />
          {/* Border */}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.border,
              {
                borderColor: isDark 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(255, 255, 255, 0.8)',
              },
            ]}
          />
        </>
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.solidBackground,
            { backgroundColor: iosColors.secondarySystemGroupedBackground },
          ]}
        />
      )}
      
      {/* Content */}
      <View style={styles.content}>
        {/* Icon container */}
        <View style={[styles.iconContainer, { backgroundColor: iconBackground }]}>
          <Feather 
            name={icon as any} 
            size={22} 
            color={disabled ? iosColors.tertiaryLabel : iconColor} 
          />
          {/* Badge */}
          {badge !== undefined && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badge > 99 ? '99+' : badge}
              </Text>
            </View>
          )}
        </View>
        
        {/* Label */}
        <Text 
          style={[
            styles.label, 
            { color: disabled ? iosColors.tertiaryLabel : iosColors.label },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        
        {/* Subtitle */}
        {subtitle && (
          <Text 
            style={[styles.subtitle, { color: iosColors.secondaryLabel }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 80,
    minHeight: 90,
    borderRadius: LiquidGlass.corners.small,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
  },
  blurLayer: {
    borderRadius: LiquidGlass.corners.small,
    overflow: 'hidden',
  },
  glassOverlay: {
    borderRadius: LiquidGlass.corners.small,
  },
  solidBackground: {
    borderRadius: LiquidGlass.corners.small,
  },
  border: {
    borderRadius: LiquidGlass.corners.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: IOSSystemColors.systemRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    ...IOSTypography.footnote,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitle: {
    ...IOSTypography.caption2,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default GlassQuickAction;

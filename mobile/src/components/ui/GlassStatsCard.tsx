/**
 * iOS 26 Liquid Glass Stats Card
 * 
 * A statistics card with glass material for dashboard KPIs.
 * Supports various layouts and accent colors.
 */
import { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSSystemColors, IOSTypography } from '../../lib/ios-design';

interface GlassStatsCardProps {
  /** Stat title/label */
  title: string;
  /** Primary value */
  value: string | number;
  /** Subtitle or description */
  subtitle?: string;
  /** Icon name from Feather */
  icon?: string;
  /** Accent color for icon */
  color?: string;
  /** Press handler */
  onPress?: () => void;
  /** Trend indicator */
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  /** Custom style */
  style?: ViewStyle;
  /** Layout variant */
  variant?: 'default' | 'compact' | 'large';
}

export function GlassStatsCard({
  title,
  value,
  subtitle,
  icon,
  color,
  onPress,
  trend,
  style,
  variant = 'default',
}: GlassStatsCardProps) {
  const { isDark } = useTheme();
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  const accentColor = color || IOSSystemColors.systemBlue;
  
  // Glass background
  const glassBackground = isDark
    ? 'rgba(255, 255, 255, 0.05)'
    : 'rgba(255, 255, 255, 0.55)';
  
  // Icon background (tinted)
  const iconBackground = isDark
    ? `${accentColor}20`
    : `${accentColor}12`;
  
  const handlePress = () => {
    if (onPress) {
      if (isIOS) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress();
    }
  };
  
  // Trend color
  const getTrendColor = () => {
    if (!trend) return iosColors.secondaryLabel;
    switch (trend.direction) {
      case 'up': return IOSSystemColors.systemGreen;
      case 'down': return IOSSystemColors.systemRed;
      default: return iosColors.secondaryLabel;
    }
  };
  
  const content = (
    <>
      {/* Glass background */}
      {isIOS ? (
        <>
          <BlurView
            intensity={22}
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
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(255, 255, 255, 0.7)',
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
      <View style={[styles.content, variant === 'compact' && styles.contentCompact]}>
        {/* Header row */}
        <View style={styles.header}>
          {icon && (
            <View style={[styles.iconContainer, { backgroundColor: iconBackground }]}>
              <Feather name={icon as any} size={18} color={accentColor} />
            </View>
          )}
          <Text 
            style={[styles.title, { color: iosColors.secondaryLabel }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        
        {/* Value */}
        <Text 
          style={[
            variant === 'large' ? styles.valueLarge : styles.value, 
            { color: iosColors.label },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        
        {/* Subtitle / Trend */}
        {(subtitle || trend) && (
          <View style={styles.footer}>
            {trend && (
              <View style={styles.trend}>
                <Feather 
                  name={trend.direction === 'up' ? 'trending-up' : trend.direction === 'down' ? 'trending-down' : 'minus'} 
                  size={12} 
                  color={getTrendColor()} 
                />
                <Text style={[styles.trendValue, { color: getTrendColor() }]}>
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </Text>
              </View>
            )}
            {subtitle && (
              <Text 
                style={[styles.subtitle, { color: iosColors.tertiaryLabel }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        )}
      </View>
    </>
  );
  
  const containerStyle = [
    styles.container,
    variant === 'compact' && styles.containerCompact,
    variant === 'large' && styles.containerLarge,
    style,
  ];
  
  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          containerStyle,
          pressed && styles.pressed,
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
    flex: 1,
    minHeight: 100,
    borderRadius: LiquidGlass.corners.small,
    overflow: 'hidden',
  },
  containerCompact: {
    minHeight: 70,
  },
  containerLarge: {
    minHeight: 120,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
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
    padding: 14,
    justifyContent: 'space-between',
  },
  contentCompact: {
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    ...IOSTypography.footnote,
    fontWeight: '500',
    flex: 1,
  },
  value: {
    ...IOSTypography.title2,
  },
  valueLarge: {
    ...IOSTypography.largeTitle,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  trendValue: {
    ...IOSTypography.caption1,
    fontWeight: '600',
    marginLeft: 2,
  },
  subtitle: {
    ...IOSTypography.caption1,
    flex: 1,
  },
});

export default GlassStatsCard;

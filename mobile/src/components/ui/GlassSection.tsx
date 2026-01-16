/**
 * iOS 26 Liquid Glass Section
 * 
 * A section container with glass material, matching Apple's grouped list
 * styling but with translucent glass effect. Content infuses through.
 */
import { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSSystemColors, IOSTypography } from '../../lib/ios-design';

interface GlassSectionProps {
  children: ReactNode;
  /** Section header title */
  title?: string;
  /** Subtitle text */
  subtitle?: string;
  /** Right accessory (e.g., "See All" link) */
  accessory?: ReactNode;
  /** Custom style for the section container */
  style?: ViewStyle;
  /** Custom style for the content area */
  contentStyle?: ViewStyle;
  /** Whether to show glass effect or solid background */
  solid?: boolean;
  /** Blur intensity */
  intensity?: 'light' | 'medium' | 'heavy';
  /** Padding inside the section */
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export function GlassSection({
  children,
  title,
  subtitle,
  accessory,
  style,
  contentStyle,
  solid = false,
  intensity = 'light',
  padding = 'medium',
}: GlassSectionProps) {
  const { isDark } = useTheme();
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  // Blur intensities
  const blurValue = {
    light: 20,
    medium: 35,
    heavy: 50,
  }[intensity];
  
  // Glass background - very transparent
  const glassBackground = isDark
    ? 'rgba(255, 255, 255, 0.05)'
    : 'rgba(255, 255, 255, 0.55)';
  
  // Padding values
  const paddingValue = {
    none: 0,
    small: 8,
    medium: 12,
    large: 16,
  }[padding];
  
  const showHeader = title || subtitle || accessory;
  
  return (
    <View style={[styles.container, style]}>
      {/* Section Header */}
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {title && (
              <Text style={[styles.title, { color: iosColors.label }]}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitle, { color: iosColors.secondaryLabel }]}>
                {subtitle}
              </Text>
            )}
          </View>
          {accessory && (
            <View style={styles.accessory}>
              {accessory}
            </View>
          )}
        </View>
      )}
      
      {/* Glass Content Container */}
      <View style={[styles.content, { padding: paddingValue }, contentStyle]}>
        {/* Glass background */}
        {isIOS && !solid ? (
          <>
            <BlurView
              intensity={blurValue}
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
            {/* Subtle border */}
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
        <View style={styles.contentInner}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    ...IOSTypography.headline,
  },
  subtitle: {
    ...IOSTypography.footnote,
    marginTop: 2,
  },
  accessory: {
    marginLeft: 8,
  },
  content: {
    borderRadius: LiquidGlass.corners.small,
    overflow: 'hidden',
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
  contentInner: {
    position: 'relative',
  },
});

export default GlassSection;

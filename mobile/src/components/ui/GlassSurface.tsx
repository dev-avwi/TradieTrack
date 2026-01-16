/**
 * iOS 26 Liquid Glass Surface Component
 * Creates translucent, blurred surfaces that content shows through
 * 
 * Used for:
 * - Floating tab bars
 * - Headers/navigation bars
 * - Floating action buttons
 * - Cards and panels
 */
import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, getLiquidGlassColors, IOSShadows } from '../../lib/ios-design';

interface GlassSurfaceProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Blur intensity (0-100) */
  intensity?: number;
  /** Corner radius */
  borderRadius?: number;
  /** Whether to show the glass border */
  showBorder?: boolean;
  /** Whether to show shadow */
  showShadow?: boolean;
  /** Variant for different use cases */
  variant?: 'default' | 'tabBar' | 'header' | 'fab' | 'card';
}

export function GlassSurface({
  children,
  style,
  intensity,
  borderRadius,
  showBorder = true,
  showShadow = true,
  variant = 'default',
}: GlassSurfaceProps) {
  const { isDark } = useTheme();
  const glassColors = getLiquidGlassColors(isDark);
  
  // Get variant-specific settings
  const getVariantStyle = () => {
    switch (variant) {
      case 'tabBar':
        return {
          borderRadius: borderRadius ?? LiquidGlass.tabBar.borderRadius,
          intensity: intensity ?? LiquidGlass.tabBar.blurIntensity,
        };
      case 'header':
        return {
          borderRadius: borderRadius ?? 0,
          intensity: intensity ?? LiquidGlass.header.blurIntensity,
        };
      case 'fab':
        return {
          borderRadius: borderRadius ?? LiquidGlass.fab.borderRadius,
          intensity: intensity ?? LiquidGlass.fab.blurIntensity,
        };
      case 'card':
        return {
          borderRadius: borderRadius ?? LiquidGlass.corners.medium,
          intensity: intensity ?? LiquidGlass.blur.medium,
        };
      default:
        return {
          borderRadius: borderRadius ?? LiquidGlass.corners.medium,
          intensity: intensity ?? LiquidGlass.blur.medium,
        };
    }
  };
  
  const variantStyle = getVariantStyle();
  
  // On iOS, use BlurView for authentic glass effect
  if (isIOS) {
    return (
      <View
        style={[
          styles.container,
          {
            borderRadius: variantStyle.borderRadius,
            ...(showShadow ? IOSShadows.glass : {}),
          },
          style,
        ]}
      >
        <BlurView
          intensity={variantStyle.intensity}
          tint={isDark ? 'dark' : 'light'}
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: variantStyle.borderRadius,
              overflow: 'hidden',
            },
          ]}
        />
        {/* Glass overlay for the tinted effect */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: glassColors.background,
              borderRadius: variantStyle.borderRadius,
            },
          ]}
        />
        {/* Subtle border highlight */}
        {showBorder && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: variantStyle.borderRadius,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: glassColors.border,
              },
            ]}
          />
        )}
        {/* Content */}
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }
  
  // On Android, use solid semi-transparent background
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark 
            ? 'rgba(28, 28, 30, 0.95)' 
            : 'rgba(255, 255, 255, 0.95)',
          borderRadius: variantStyle.borderRadius,
          ...(showShadow ? { elevation: 8 } : {}),
        },
        showBorder && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(0, 0, 0, 0.1)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
});

export default GlassSurface;

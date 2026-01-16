/**
 * iOS 26 Liquid Glass Background
 * 
 * Creates the shared background layer that glass surfaces refract.
 * This is the key to Apple's "background extension effect" - content and
 * background colors infuse through the translucent glass controls.
 * 
 * Usage:
 * Wrap your screen content in LiquidGlassBackground to provide the
 * refractive layer that glass surfaces (tab bar, headers, FABs) will show through.
 */
import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { IOSSystemColors } from '../../lib/ios-design';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LiquidGlassBackgroundProps {
  children: ReactNode;
  /** Background style variant */
  variant?: 'default' | 'gradient' | 'mesh' | 'solid';
  /** Custom gradient colors (for gradient variant) */
  gradientColors?: string[];
  /** Custom style */
  style?: ViewStyle;
}

export function LiquidGlassBackground({
  children,
  variant = 'default',
  gradientColors,
  style,
}: LiquidGlassBackgroundProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  // iOS system colors
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  // Default gradient colors - subtle, allows content to shine
  const defaultGradientColors = isDark 
    ? [
        'rgba(0, 0, 0, 1)',
        'rgba(18, 18, 20, 1)',
        'rgba(28, 28, 30, 1)',
      ]
    : [
        'rgba(242, 242, 247, 1)', // systemGroupedBackground
        'rgba(250, 250, 252, 1)',
        'rgba(255, 255, 255, 1)',
      ];
  
  // Mesh gradient effect - more dynamic, Apple-style
  const meshGradientColors = isDark
    ? [
        'rgba(20, 20, 25, 1)',
        'rgba(30, 25, 35, 1)',
        'rgba(25, 30, 40, 1)',
        'rgba(20, 20, 25, 1)',
      ]
    : [
        'rgba(255, 252, 250, 1)',
        'rgba(250, 248, 255, 1)',
        'rgba(248, 252, 255, 1)',
        'rgba(255, 255, 252, 1)',
      ];
  
  const colors = gradientColors || (variant === 'mesh' ? meshGradientColors : defaultGradientColors);
  
  // For Android or solid variant, use simple background
  if (!isIOS || variant === 'solid') {
    return (
      <View style={[styles.container, { backgroundColor: iosColors.systemGroupedBackground }, style]}>
        {children}
      </View>
    );
  }
  
  // For iOS, render gradient background for glass refraction
  return (
    <View style={[styles.container, style]}>
      {/* Background gradient layer - this is what glass surfaces refract */}
      <LinearGradient
        colors={colors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      
      {/* Mesh overlay for richer effect (optional, for mesh variant) */}
      {variant === 'mesh' && (
        <>
          <LinearGradient
            colors={['transparent', isDark ? 'rgba(100, 80, 150, 0.05)' : 'rgba(150, 180, 255, 0.08)', 'transparent']}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 1, y: 0.7 }}
            style={[styles.gradient, styles.meshOverlay]}
          />
          <LinearGradient
            colors={['transparent', isDark ? 'rgba(60, 100, 150, 0.05)' : 'rgba(255, 200, 150, 0.06)', 'transparent']}
            start={{ x: 0.7, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={[styles.gradient, styles.meshOverlay]}
          />
        </>
      )}
      
      {/* Content layer - transparent so background shows through */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  meshOverlay: {
    opacity: 1,
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default LiquidGlassBackground;

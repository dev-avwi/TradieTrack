/**
 * iOS 26 Liquid Glass Card
 * 
 * A card component that uses glass material, allowing background content
 * to infuse through. This is different from regular cards - it's translucent
 * and refracts the background.
 */
import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, Pressable, PressableProps } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, getLiquidGlassColors, IOSShadows, IOSCorners, IOSSystemColors } from '../../lib/ios-design';

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Whether the card is pressable */
  onPress?: () => void;
  /** Blur intensity (lower = more content shows through) */
  intensity?: 'light' | 'medium' | 'heavy';
  /** Whether to show subtle border */
  showBorder?: boolean;
  /** Whether to use elevated shadow */
  elevated?: boolean;
  /** Disable glass effect (fall back to solid) */
  solid?: boolean;
}

export function GlassCard({
  children,
  style,
  onPress,
  intensity = 'light',
  showBorder = true,
  elevated = false,
  solid = false,
}: GlassCardProps) {
  const { isDark } = useTheme();
  const glassColors = getLiquidGlassColors(isDark);
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  // Map intensity to blur value - lower values let more content through
  const blurIntensity = {
    light: 25,  // Very translucent - content infuses through
    medium: 40,
    heavy: 60,
  }[intensity];
  
  // Glass background color - very transparent
  const glassBackground = isDark
    ? 'rgba(255, 255, 255, 0.06)'  // Subtle white tint
    : 'rgba(255, 255, 255, 0.5)'; // Light frosted
  
  const handlePress = () => {
    if (onPress) {
      if (isIOS) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress();
    }
  };
  
  const cardContent = (
    <>
      {/* Blur layer */}
      {isIOS && !solid && (
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, styles.blurLayer]}
        />
      )}
      
      {/* Glass tint overlay */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: solid 
              ? iosColors.secondarySystemGroupedBackground 
              : glassBackground,
            borderRadius: LiquidGlass.corners.small,
          },
        ]}
      />
      
      {/* Border highlight */}
      {showBorder && isIOS && !solid && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.border,
            {
              borderColor: isDark 
                ? 'rgba(255, 255, 255, 0.1)' 
                : 'rgba(255, 255, 255, 0.6)',
            },
          ]}
        />
      )}
      
      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </>
  );
  
  const containerStyle = [
    styles.container,
    elevated && (isIOS ? IOSShadows.card : { elevation: 3 }),
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
        {cardContent}
      </Pressable>
    );
  }
  
  return (
    <View style={containerStyle}>
      {cardContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: LiquidGlass.corners.small,
    overflow: 'hidden',
  },
  blurLayer: {
    borderRadius: LiquidGlass.corners.small,
    overflow: 'hidden',
  },
  border: {
    borderRadius: LiquidGlass.corners.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    padding: 16,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

export default GlassCard;

/**
 * iOS 26 Liquid Glass Floating Action Button
 * 
 * A floating action button with glass material that allows background
 * content to show through, matching the iOS 26 Liquid Glass aesthetic.
 */
import { ReactNode } from 'react';
import { View, StyleSheet, Pressable, Text, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSShadows, IOSSystemColors, IOSTypography } from '../../lib/ios-design';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GlassFABProps {
  onPress: () => void;
  /** Icon name from Feather icons */
  icon?: string;
  /** Optional label text */
  label?: string;
  /** Custom icon element */
  iconElement?: ReactNode;
  /** Position on screen */
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  /** Whether to extend (show label) */
  extended?: boolean;
  /** Custom style */
  style?: ViewStyle;
  /** Whether the FAB uses primary color or glass */
  variant?: 'glass' | 'primary';
}

export function GlassFAB({
  onPress,
  icon = 'plus',
  label,
  iconElement,
  position = 'bottom-right',
  extended = false,
  style,
  variant = 'glass',
}: GlassFABProps) {
  const { isDark, colors } = useTheme();
  const pressed = useSharedValue(0);
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  // Glass colors - more saturated for FAB
  const glassBackground = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(255, 255, 255, 0.7)';
  
  const handlePressIn = () => {
    pressed.value = withSpring(1, { damping: 15, stiffness: 400 });
    if (isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  const handlePressOut = () => {
    pressed.value = withSpring(0, { damping: 15, stiffness: 400 });
  };
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, 0.95]) },
    ],
  }));
  
  // Position styles
  const positionStyle = {
    'bottom-right': { right: 20, bottom: 100 },
    'bottom-center': { alignSelf: 'center' as const, bottom: 100 },
    'bottom-left': { left: 20, bottom: 100 },
  }[position];
  
  const isPrimary = variant === 'primary';
  const showLabel = extended && label;
  
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        positionStyle,
        showLabel && styles.extended,
        isIOS && !isPrimary && IOSShadows.glass,
        isPrimary && styles.primaryShadow,
        animatedStyle,
        style,
      ]}
    >
      {/* Glass background */}
      {isIOS && !isPrimary ? (
        <>
          <BlurView
            intensity={LiquidGlass.fab.blurIntensity}
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
          {/* Border highlight */}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.border,
              {
                borderColor: isDark 
                  ? 'rgba(255, 255, 255, 0.15)' 
                  : 'rgba(255, 255, 255, 0.8)',
              },
            ]}
          />
        </>
      ) : isPrimary ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.primaryBackground,
            { backgroundColor: colors.primary },
          ]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.glassOverlay,
            { backgroundColor: iosColors.secondarySystemGroupedBackground },
          ]}
        />
      )}
      
      {/* Content */}
      <View style={styles.content}>
        {iconElement || (
          <Feather 
            name={icon as any} 
            size={24} 
            color={isPrimary ? '#fff' : (isDark ? '#fff' : colors.primary)} 
          />
        )}
        {showLabel && (
          <Text 
            style={[
              styles.label, 
              { color: isPrimary ? '#fff' : (isDark ? '#fff' : iosColors.label) },
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: LiquidGlass.fab.size,
    height: LiquidGlass.fab.size,
    borderRadius: LiquidGlass.fab.borderRadius,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  extended: {
    width: 'auto',
    paddingHorizontal: 20,
    borderRadius: 28,
  },
  blurLayer: {
    borderRadius: LiquidGlass.fab.borderRadius,
    overflow: 'hidden',
  },
  glassOverlay: {
    borderRadius: LiquidGlass.fab.borderRadius,
  },
  primaryBackground: {
    borderRadius: LiquidGlass.fab.borderRadius,
  },
  border: {
    borderRadius: LiquidGlass.fab.borderRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    ...IOSTypography.headline,
  },
  primaryShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default GlassFAB;

import { useRef, ReactNode } from 'react';
import {
  Animated,
  Pressable,
  Platform,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';

interface GlassButtonProps {
  onPress: () => void;
  children: ReactNode;
  size?: number;
  tint?: string;
  disabled?: boolean;
  style?: ViewStyle;
  hitSlop?: number;
  testID?: string;
}

function hexToRgba(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function GlassButton({
  onPress,
  children,
  size = 38,
  tint,
  disabled = false,
  style,
  hitSlop = 8,
  testID,
}: GlassButtonProps) {
  const { isDark, colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const baseColor = tint || colors.primary;
  const bgColor = hexToRgba(baseColor, isDark ? 0.25 : 0.15);
  const borderColor = hexToRgba(baseColor, isDark ? 0.35 : 0.2);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      damping: 15,
      stiffness: 400,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 12,
      stiffness: 300,
      mass: 0.5,
      useNativeDriver: true,
    }).start();
  };

  const borderRadius = size / 2;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          transform: [{ scale: scaleAnim }],
          backgroundColor: bgColor,
          borderWidth: 1,
          borderColor: borderColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        Platform.select({
          ios: {
            shadowColor: baseColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.15,
            shadowRadius: 8,
          },
          android: {
            elevation: 4,
          },
        }),
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        hitSlop={hitSlop}
        testID={testID}
        style={{
          width: size,
          height: size,
          borderRadius,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

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

  const iconColor = tint || colors.primary;

  const bgColor = tint
    ? isDark
      ? `${tint}30`
      : `${tint}18`
    : isDark
      ? `${colors.primary}30`
      : `${colors.primary}18`;

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
          alignItems: 'center',
          justifyContent: 'center',
        },
        Platform.select({
          ios: {
            shadowColor: isDark ? '#000' : iconColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.25 : 0.1,
            shadowRadius: 6,
          },
          android: {
            elevation: 3,
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

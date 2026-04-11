import { useRef, ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  Platform,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
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
  size = 40,
  tint,
  disabled = false,
  style,
  hitSlop = 8,
  testID,
}: GlassButtonProps) {
  const { isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
  const useTint = !!tint;

  const tintOverlay = useTint
    ? (isDark ? `${tint}30` : `${tint}26`)
    : isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(255,255,255,0.35)';

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      <BlurView
        intensity={isDark ? 50 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={{
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
        }}
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
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tintOverlay,
          }}
        >
          {children}
        </Pressable>
      </BlurView>
    </Animated.View>
  );
}

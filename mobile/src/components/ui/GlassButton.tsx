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
  size = 38,
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
  const bgColor = useTint
    ? (isDark ? `${tint}55` : `${tint}28`)
    : isDark
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(255,255,255,0.65)';

  const borderColor = useTint
    ? (isDark ? `${tint}40` : `${tint}20`)
    : isDark
      ? 'rgba(255,255,255,0.18)'
      : 'rgba(255,255,255,0.8)';

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          transform: [{ scale: scaleAnim }],
          overflow: 'hidden',
        },
        Platform.select({
          ios: {
            shadowColor: tint || '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.35 : 0.15,
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
        style={[
          styles.pressable,
          { width: size, height: size, borderRadius },
        ]}
      >
        {Platform.OS === 'ios' && !useTint ? (
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, { borderRadius }]}
          />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: bgColor,
              borderRadius,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: borderColor,
            },
          ]}
        />
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

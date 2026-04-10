import { useRef, ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';

interface GlassButtonProps {
  onPress: () => void;
  children: ReactNode;
  size?: number;
  disabled?: boolean;
  style?: ViewStyle;
  hitSlop?: number;
  testID?: string;
}

export function GlassButton({
  onPress,
  children,
  size = 36,
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
      toValue: 0.9,
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
          backgroundColor: isDark
            ? 'rgba(120,120,128,0.24)'
            : 'rgba(120,120,128,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 4,
          },
          android: {
            elevation: 2,
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

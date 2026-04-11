import { useRef, ReactNode } from 'react';
import {
  Animated,
  Pressable,
  Platform,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';

interface GlassActionCircleProps {
  onPress: () => void;
  children: ReactNode;
  size?: number;
  tint?: string;
  disabled?: boolean;
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
  size = 40,
  tint,
  disabled = false,
  hitSlop = 8,
  testID,
}: GlassActionCircleProps) {
  const { isDark, colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const baseColor = tint || colors.primary;
  const bgColor = hexToRgba(baseColor, isDark ? 0.22 : 0.13);

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
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
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
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

interface GlassModuleProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function GlassModule({ children, style }: GlassModuleProps) {
  const { isDark } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: isDark ? 'rgba(44,44,46,0.65)' : 'rgba(255,255,255,0.72)',
          borderRadius: 24,
          borderWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)',
          flexDirection: 'row',
          alignItems: 'center',
          padding: 4,
          gap: 4,
        },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.35 : 0.12,
            shadowRadius: 10,
          },
          android: { elevation: 5 },
        }),
        style,
      ]}
    >
      {children}
    </View>
  );
}

import { useRef, ReactNode } from 'react';
import {
  Animated,
  Pressable,
  Platform,
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../lib/theme';

function hexToRgba(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

interface GlassButtonProps {
  onPress: () => void;
  children: ReactNode;
  size?: number;
  tint?: string;
  disabled?: boolean;
  hitSlop?: number;
  testID?: string;
}

export function GlassButton({
  onPress,
  children,
  size = 40,
  tint,
  disabled = false,
  hitSlop = 8,
  testID,
}: GlassButtonProps) {
  const { isDark, colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const baseColor = tint || colors.primary;
  const bgColor = hexToRgba(baseColor, isDark ? 0.22 : 0.13);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(scaleAnim, {
      toValue: 0.92,
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
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.4 : 0.14,
            shadowRadius: 12,
          },
          android: { elevation: 6 },
        }),
        style,
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? (isDark ? 60 : 80) : 0}
        tint={isDark ? 'dark' : 'light'}
        style={{
          borderRadius: 24,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 4,
            gap: 4,
            backgroundColor: isDark ? 'rgba(44,44,46,0.35)' : 'rgba(255,255,255,0.25)',
            borderRadius: 24,
            borderWidth: 0.5,
            borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)',
          }}
        >
          {children}
        </View>
      </BlurView>
    </View>
  );
}

import { useRef, ReactNode } from 'react';
import {
  Animated,
  Pressable,
  Platform,
  View,
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
  const pressAnim = useRef(new Animated.Value(0)).current;

  const baseColor = tint || colors.primary;

  const bgOpacity = isDark ? 0.22 : 0.13;
  const pressedBgOpacity = isDark ? 0.38 : 0.24;

  const bgColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      hexToRgba(baseColor, bgOpacity),
      hexToRgba(baseColor, pressedBgOpacity),
    ],
  });

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.88,
        damping: 18,
        stiffness: 420,
        mass: 0.5,
        useNativeDriver: false,
      }),
      Animated.timing(pressAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 14,
        stiffness: 280,
        mass: 0.5,
        useNativeDriver: false,
      }),
      Animated.timing(pressAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
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
      >
        <Animated.View
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
        </Animated.View>
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

  const shadowStyle = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: isDark ? 0.45 : 0.16,
      shadowRadius: 14,
    },
    android: { elevation: 8 },
  });

  return (
    <View style={[shadowStyle, style]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? (isDark ? 65 : 90) : 0}
        tint={isDark ? 'dark' : 'light'}
        style={{
          borderRadius: 26,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 4,
            gap: 4,
            backgroundColor: isDark ? 'rgba(50,50,52,0.4)' : 'rgba(255,255,255,0.35)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.75)',
            borderRadius: 26,
          }}
        >
          {children}
        </View>
      </BlurView>
    </View>
  );
}

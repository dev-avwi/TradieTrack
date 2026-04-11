import { ReactNode } from 'react';
import { Platform, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
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

const SPRING_CONFIG = { damping: 18, stiffness: 380, mass: 0.5 };
const SPRING_BACK = { damping: 14, stiffness: 260, mass: 0.4 };

interface GlassButtonProps {
  onPress: () => void;
  children: ReactNode;
  size?: number;
  tint?: string;
  disabled?: boolean;
  testID?: string;
}

export function GlassButton({
  onPress,
  children,
  size = 40,
  tint,
  disabled = false,
  testID,
}: GlassButtonProps) {
  const { isDark, colors } = useTheme();
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pressed = useSharedValue(0);

  const baseColor = tint || colors.primary;
  const bgNormal = hexToRgba(baseColor, isDark ? 0.20 : 0.12);
  const bgPressed = hexToRgba(baseColor, isDark ? 0.35 : 0.22);

  const borderRadius = size / 2;

  const fireHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const firePress = () => {
    if (!disabled) onPress();
  };

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      runOnJS(fireHaptic)();
      scale.value = withSpring(0.88, SPRING_CONFIG);
      pressed.value = withTiming(1, { duration: 60 });
      const offsetX = (e.x - size / 2) / (size / 2);
      const offsetY = (e.y - size / 2) / (size / 2);
      translateX.value = withSpring(offsetX * 1.5, SPRING_CONFIG);
      translateY.value = withSpring(offsetY * 1.5, SPRING_CONFIG);
    })
    .onUpdate((e) => {
      const offsetX = (e.x - size / 2) / (size / 2);
      const offsetY = (e.y - size / 2) / (size / 2);
      translateX.value = interpolate(
        Math.max(-1, Math.min(1, offsetX)),
        [-1, 0, 1],
        [-1.5, 0, 1.5]
      );
      translateY.value = interpolate(
        Math.max(-1, Math.min(1, offsetY)),
        [-1, 0, 1],
        [-1.5, 0, 1.5]
      );
    })
    .onEnd(() => {
      runOnJS(firePress)();
    })
    .onFinalize(() => {
      scale.value = withSpring(1, SPRING_BACK);
      pressed.value = withTiming(0, { duration: 180 });
      translateX.value = withSpring(0, SPRING_BACK);
      translateY.value = withSpring(0, SPRING_BACK);
    })
    .minDistance(0)
    .maxPointers(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: pressed.value > 0.5 ? bgPressed : bgNormal,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle} testID={testID}>
        <Animated.View
          style={[
            bgStyle,
            {
              width: size,
              height: size,
              borderRadius,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
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
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: isDark ? 0.45 : 0.16,
            shadowRadius: 14,
          },
          android: { elevation: 8 },
        }),
        style,
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? (isDark ? 65 : 90) : 0}
        tint={isDark ? 'dark' : 'light'}
        style={{ borderRadius: 26, overflow: 'hidden' }}
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

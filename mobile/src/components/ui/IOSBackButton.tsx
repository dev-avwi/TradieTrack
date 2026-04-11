import { Text, StyleSheet, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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

const SPRING_CONFIG = { damping: 18, stiffness: 380, mass: 0.5 };
const SPRING_BACK = { damping: 14, stiffness: 260, mass: 0.4 };

const CAPSULE_W = 100;
const CAPSULE_H = 36;

interface IOSBackButtonProps {
  onPress?: () => void;
  label?: string;
}

export function IOSBackButton({ onPress, label = 'Back' }: IOSBackButtonProps) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pressed = useSharedValue(0);

  const fireHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      runOnJS(fireHaptic)();
      scale.value = withSpring(0.93, SPRING_CONFIG);
      pressed.value = withTiming(1, { duration: 60 });
      const offsetX = (e.x - CAPSULE_W / 2) / (CAPSULE_W / 2);
      const offsetY = (e.y - CAPSULE_H / 2) / (CAPSULE_H / 2);
      translateX.value = withSpring(offsetX * 2, SPRING_CONFIG);
      translateY.value = withSpring(offsetY * 1, SPRING_CONFIG);
    })
    .onUpdate((e) => {
      const offsetX = (e.x - CAPSULE_W / 2) / (CAPSULE_W / 2);
      const offsetY = (e.y - CAPSULE_H / 2) / (CAPSULE_H / 2);
      translateX.value = interpolate(
        Math.max(-1, Math.min(1, offsetX)),
        [-1, 0, 1],
        [-2, 0, 2]
      );
      translateY.value = interpolate(
        Math.max(-1, Math.min(1, offsetY)),
        [-1, 0, 1],
        [-1, 0, 1]
      );
    })
    .onEnd(() => {
      runOnJS(handlePress)();
    })
    .onFinalize(() => {
      scale.value = withSpring(1, SPRING_BACK);
      pressed.value = withTiming(0, { duration: 180 });
      translateX.value = withSpring(0, SPRING_BACK);
      translateY.value = withSpring(0, SPRING_BACK);
    })
    .minDistance(0)
    .maxPointers(1);

  const animatedOuter = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const shadowAnimated = useAnimatedStyle(() => {
    const shadowOp = interpolate(pressed.value, [0, 1], [isDark ? 0.45 : 0.16, isDark ? 0.2 : 0.06]);
    const shadowRad = interpolate(pressed.value, [0, 1], [14, 6]);
    return Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: interpolate(pressed.value, [0, 1], [5, 2]) },
          shadowOpacity: shadowOp,
          shadowRadius: shadowRad,
        }
      : { elevation: interpolate(pressed.value, [0, 1], [8, 3]) };
  });

  const innerBg = useAnimatedStyle(() => ({
    backgroundColor: pressed.value > 0.5
      ? (isDark ? 'rgba(70,70,72,0.5)' : 'rgba(235,235,240,0.55)')
      : (isDark ? 'rgba(50,50,52,0.4)' : 'rgba(255,255,255,0.35)'),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[shadowAnimated, animatedOuter]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? (isDark ? 65 : 90) : 0}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurWrap}
        >
          <Animated.View
            style={[
              styles.inner,
              innerBg,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.75)',
              },
            ]}
          >
            <Feather name="chevron-left" size={18} color={colors.primary} />
            <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  blurWrap: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 7,
    gap: 1,
    borderRadius: 22,
    borderWidth: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
  },
});

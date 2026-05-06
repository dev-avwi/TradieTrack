import { ReactNode, useRef, useCallback, forwardRef } from 'react';
import {
  Pressable,
  PressableProps,
  Animated,
  Easing,
  Platform,
  StyleProp,
  ViewStyle,
  View,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../../lib/theme';
import { triggerHaptic, HapticType } from '../../lib/haptics';

export interface PressableRowProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: HapticType;
  rippleColor?: string;
  borderless?: boolean;
}

const PressableRow = forwardRef<View, PressableRowProps>(function PressableRow(
  {
    children,
    style,
    haptic = 'light',
    rippleColor,
    borderless = false,
    onPress,
    disabled,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const isAndroid = Platform.OS === 'android';

  const handlePressIn = useCallback(() => {
    if (isAndroid) return;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.99,
        duration: 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.85,
        duration: 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity, isAndroid]);

  const handlePressOut = useCallback(() => {
    if (isAndroid) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity, isAndroid]);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (haptic !== 'none') {
        triggerHaptic(haptic);
      }
      onPress?.(e);
    },
    [haptic, onPress],
  );

  const androidRipple = isAndroid
    ? {
        color: rippleColor ?? colors.ripple ?? colors.elevate1,
        borderless,
        foreground: true,
      }
    : undefined;

  if (isAndroid) {
    return (
      <Pressable
        ref={ref}
        onPress={handlePress}
        disabled={disabled}
        android_ripple={androidRipple}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <Pressable
      ref={ref}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
});

export { PressableRow };
export default PressableRow;

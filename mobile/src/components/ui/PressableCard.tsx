import { Pressable, View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { ReactNode, useRef } from 'react';
import { useTheme } from '../../lib/theme';
import { radius } from '../../lib/design-tokens';

interface PressableCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}

export function PressableCard({ children, onPress, style, disabled }: PressableCardProps) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          {
            backgroundColor: pressed ? colors.cardHover : colors.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default PressableCard;

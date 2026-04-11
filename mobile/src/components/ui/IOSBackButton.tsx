import { useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';

interface IOSBackButtonProps {
  onPress?: () => void;
  label?: string;
}

export function IOSBackButton({ onPress, label = 'Back' }: IOSBackButtonProps) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.92,
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

  const innerBg = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDark ? 'rgba(50,50,52,0.4)' : 'rgba(255,255,255,0.35)',
      isDark ? 'rgba(70,70,72,0.55)' : 'rgba(240,240,245,0.55)',
    ],
  });

  const shadowOpacity = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? 0.45 : 0.16, isDark ? 0.25 : 0.08],
  });

  return (
    <Animated.View
      style={[
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 5 },
            shadowRadius: 14,
            shadowOpacity: shadowOpacity,
          },
          android: { elevation: 8 },
        }),
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? (isDark ? 65 : 90) : 0}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurWrap}
      >
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View
            style={[
              styles.inner,
              {
                backgroundColor: innerBg,
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.75)',
              },
            ]}
          >
            <Feather name="chevron-left" size={18} color={colors.primary} />
            <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
          </Animated.View>
        </Pressable>
      </BlurView>
    </Animated.View>
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

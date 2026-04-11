import { TouchableOpacity, Text, StyleSheet, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { useTheme } from '../../lib/theme';

function hexToRgba(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

interface IOSBackButtonProps {
  onPress?: () => void;
  label?: string;
}

export function IOSBackButton({ onPress, label = 'Back' }: IOSBackButtonProps) {
  const { isDark, colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  const content = (
    <>
      <Feather name="chevron-left" size={20} color={colors.primary} />
      <Text style={[styles.backText, { color: colors.primary }]}>{label}</Text>
    </>
  );

  if (isLiquidGlassSupported) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <LiquidGlassView style={styles.glassCapsule} interactive effect="regular">
          {content}
        </LiquidGlassView>
      </TouchableOpacity>
    );
  }

  const bgColor = hexToRgba(colors.primary, isDark ? 0.14 : 0.08);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.6}
      style={[
        styles.fallbackCapsule,
        {
          backgroundColor: bgColor,
        },
        Platform.select({
          ios: {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.12 : 0.05,
            shadowRadius: 3,
          },
          android: { elevation: 1 },
        }),
      ]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  glassCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 14,
    height: 38,
    borderRadius: 19,
  },
  fallbackCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 14,
    height: 38,
    borderRadius: 19,
  },
  backText: {
    fontSize: 17,
    fontWeight: '400',
    marginLeft: -2,
  },
});

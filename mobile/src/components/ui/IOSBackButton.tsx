import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
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
      <Feather name="chevron-left" size={18} color={colors.primary} />
      <Text style={[styles.backText, { color: colors.primary }]}>{label}</Text>
    </>
  );

  if (isLiquidGlassSupported) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.5}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <LiquidGlassView style={styles.capsule} interactive effect="clear">
          {content}
        </LiquidGlassView>
      </TouchableOpacity>
    );
  }

  const bgColor = hexToRgba(colors.primary, isDark ? 0.10 : 0.05);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.5}
      style={[
        styles.capsule,
        { backgroundColor: bgColor },
      ]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 10,
    height: 32,
    borderRadius: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '400',
    marginLeft: -3,
  },
});

import { ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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

interface GlassControlItemProps {
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  testID?: string;
}

interface GlassControlGroupProps {
  items: GlassControlItemProps[];
}

export function GlassControlGroup({ items }: GlassControlGroupProps) {
  const { isDark, colors } = useTheme();

  const separatorColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  const controls = items.map((item, i) => (
    <View key={i} style={styles.itemRow}>
      {i > 0 && (
        <View style={[styles.separator, { backgroundColor: separatorColor }]} />
      )}
      <TouchableOpacity
        onPress={item.onPress}
        disabled={item.disabled}
        activeOpacity={0.5}
        style={styles.touchTarget}
        testID={item.testID}
      >
        {item.children}
      </TouchableOpacity>
    </View>
  ));

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView style={styles.glassCapsule} interactive effect="regular">
        {controls}
      </LiquidGlassView>
    );
  }

  const bgColor = hexToRgba(colors.primary, isDark ? 0.14 : 0.08);

  return (
    <View
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
    >
      {controls}
    </View>
  );
}

const styles = StyleSheet.create({
  glassCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 4,
  },
  fallbackCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    marginHorizontal: 2,
  },
  touchTarget: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

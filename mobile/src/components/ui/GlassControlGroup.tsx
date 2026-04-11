import { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
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

  const separatorColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  const controls = items.map((item, i) => (
    <View key={i} style={styles.itemRow}>
      {i > 0 && (
        <View style={[styles.separator, { backgroundColor: separatorColor }]} />
      )}
      <Pressable
        onPress={item.onPress}
        disabled={item.disabled}
        style={styles.touchTarget}
        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
        testID={item.testID}
      >
        {item.children}
      </Pressable>
    </View>
  ));

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView style={styles.capsule} effect="clear">
        {controls}
      </LiquidGlassView>
    );
  }

  const bgColor = hexToRgba(colors.primary, isDark ? 0.08 : 0.04);

  return (
    <View style={[styles.capsule, { backgroundColor: bgColor }]}>
      {controls}
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 14,
  },
  touchTarget: {
    width: 30,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

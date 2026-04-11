import { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';

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
  const { isDark } = useTheme();

  const separatorColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={styles.group}>
      {items.map((item, i) => (
        <View key={i} style={styles.itemRow}>
          {i > 0 && (
            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
          )}
          <Pressable
            onPress={item.onPress}
            disabled={item.disabled}
            style={styles.touchTarget}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            testID={item.testID}
          >
            {item.children}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    marginHorizontal: 1,
  },
  touchTarget: {
    width: 30,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

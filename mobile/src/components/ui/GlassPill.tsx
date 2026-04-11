import { ReactNode } from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../lib/theme';

interface GlassPillProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function GlassPill({ children, style }: GlassPillProps) {
  const { isDark } = useTheme();

  return (
    <View style={[
      styles.outerWrap,
      {
        borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
      },
      Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 6 },
      }),
      style,
    ]}>
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurContainer}
      >
        <View style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark ? 'rgba(40,40,40,0.4)' : 'rgba(255,255,255,0.45)',
          },
        ]} />
        <View style={styles.innerRow}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  blurContainer: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 4,
  },
});

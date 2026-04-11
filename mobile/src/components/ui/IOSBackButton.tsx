import { TouchableOpacity, Text, StyleSheet, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';

interface IOSBackButtonProps {
  onPress?: () => void;
  label?: string;
}

export function IOSBackButton({ onPress, label = 'Back' }: IOSBackButtonProps) {
  const { colors, isDark } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.capsule,
        {
          backgroundColor: isDark ? 'rgba(44,44,46,0.65)' : 'rgba(255,255,255,0.72)',
          borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)',
        },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.35 : 0.12,
            shadowRadius: 10,
          },
          android: { elevation: 5 },
        }),
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.6}
        style={styles.inner}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="chevron-left" size={18} color={colors.primary} />
        <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    borderRadius: 20,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 7,
    gap: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
  },
});

import { TouchableOpacity, Text, StyleSheet, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.4 : 0.14,
            shadowRadius: 12,
          },
          android: { elevation: 6 },
        }),
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? (isDark ? 60 : 80) : 0}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurWrap}
      >
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.6}
          style={[
            styles.inner,
            {
              backgroundColor: isDark ? 'rgba(44,44,46,0.35)' : 'rgba(255,255,255,0.25)',
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)',
            },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={18} color={colors.primary} />
          <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  blurWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 7,
    gap: 1,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
  },
});

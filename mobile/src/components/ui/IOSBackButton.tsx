import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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

  if (Platform.OS === 'ios') {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.capsuleClip}>
          <BlurView
            tint={isDark ? 'systemChromeMaterialDark' as any : 'systemChromeMaterial' as any}
            intensity={70}
            style={StyleSheet.absoluteFill}
          />
          <Feather name="chevron-left" size={16} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>{label}</Text>
        </View>
      </Pressable>
    );
  }

  const bgColor = hexToRgba(colors.primary, isDark ? 0.08 : 0.04);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={[styles.capsuleClip, { backgroundColor: bgColor }]}>
        <Feather name="chevron-left" size={16} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsuleClip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 10,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  backText: {
    fontSize: 15,
    fontWeight: '400',
    marginLeft: -1,
  },
});

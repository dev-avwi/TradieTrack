import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { IOSSystemColors, IOSCorners, IOSShadows, getIOSButtonStyle } from '../../lib/ios-design';

interface IOSBackButtonProps {
  onPress?: () => void;
  label?: string;
  /** Use soft card-like background (matches grouped list items) */
  variant?: 'plain' | 'soft';
}

export function IOSBackButton({ onPress, label = 'Back', variant = 'soft' }: IOSBackButtonProps) {
  const { colors, isDark } = useTheme();
  const iosButtonStyle = getIOSButtonStyle(isDark);
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };
  
  const isSoft = variant === 'soft';
  
  return (
    <TouchableOpacity 
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.backButton,
        isSoft && {
          backgroundColor: iosButtonStyle.soft.backgroundColor,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: IOSCorners.button,
          marginLeft: 0,
          ...IOSShadows.subtle,
        },
      ]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Feather 
        name="chevron-left" 
        size={isSoft ? 20 : 24} 
        color={IOSSystemColors.systemBlue} 
      />
      <Text style={[styles.backText, { color: IOSSystemColors.systemBlue }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
  },
  backText: {
    fontSize: 17,
    fontWeight: '400',
  },
});

import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { GlassButton } from './GlassButton';

interface IOSBackButtonProps {
  onPress?: () => void;
}

export function IOSBackButton({ onPress }: IOSBackButtonProps) {
  const { colors } = useTheme();
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };
  
  return (
    <GlassButton onPress={handlePress} tint={colors.primary}>
      <Feather name="chevron-left" size={20} color={colors.primary} />
    </GlassButton>
  );
}

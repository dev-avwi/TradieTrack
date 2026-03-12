import { Slot } from 'expo-router';
import { View } from 'react-native';
import { useTheme } from '../../src/lib/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Slot />
    </View>
  );
}

import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

export default function MoreLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'ios_from_right',
        animationDuration: 200,
        presentation: 'card',
        freezeOnBlur: true,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    />
  );
}

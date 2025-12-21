import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';
import { IOSBackButton } from '../../src/components/ui/IOSBackButton';

export default function JobLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackVisible: false,
        headerLeft: () => <IOSBackButton />,
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'ios_from_right',
        animationDuration: 220,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        presentation: 'card',
        freezeOnBlur: true,
      }}
    />
  );
}

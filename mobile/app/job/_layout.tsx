import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';
import { IOSBackButton } from '../../src/components/ui/IOSBackButton';

const isIOS = Platform.OS === 'ios';

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
        headerTintColor: colors.primary,
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
        headerRightContainerStyle: {
          backgroundColor: 'transparent',
        },
        headerLeftContainerStyle: {
          backgroundColor: 'transparent',
        },
      }}
    >
      <Stack.Screen name="[id]" options={{ headerShown: isIOS }} />
      <Stack.Screen name="chat" options={{ headerShown: isIOS }} />
    </Stack>
  );
}

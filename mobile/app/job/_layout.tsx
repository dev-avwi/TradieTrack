import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

const isIOS = Platform.OS === 'ios';

export default function JobLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackVisible: true,
        headerBackTitle: 'Back',
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.primary,
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

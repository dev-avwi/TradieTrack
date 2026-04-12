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
        headerShown: false,
        headerBackVisible: false,
        headerTitle: '',
        headerShadowVisible: false,
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
      }}
    >
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{
        headerShown: isIOS,
        headerLeft: () => <IOSBackButton />,
        headerStyle: { backgroundColor: colors.background },
      }} />
    </Stack>
  );
}

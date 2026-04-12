import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

const isIOS = Platform.OS === 'ios';

export default function JobLayout() {
  const { colors, isDark } = useTheme();
  
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
      <Stack.Screen name="[id]" />
      <Stack.Screen name="chat" options={{
        headerShown: isIOS,
        headerTransparent: true,
        headerBlurEffect: isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterial',
        headerStyle: { backgroundColor: 'transparent' },
      }} />
    </Stack>
  );
}

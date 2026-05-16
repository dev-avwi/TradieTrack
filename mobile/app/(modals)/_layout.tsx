import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/lib/theme';

export default function ModalsLayout() {
  const { colors } = useTheme();
  const isIOS = Platform.OS === 'ios';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        presentation: isIOS ? 'formSheet' : 'modal',
        sheetAllowedDetents: 'fitToContents',
        sheetGrabberVisible: true,
        sheetCornerRadius: 20,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="job-schedule" />
    </Stack>
  );
}

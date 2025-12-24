import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const getNavigationConfig = (colors: any) => ({
  headerShown: isIOS,
  animation: isIOS ? 'ios_from_right' : 'slide_from_right',
  gestureEnabled: true,
  gestureDirection: 'horizontal' as const,
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: colors.background,
  },
});

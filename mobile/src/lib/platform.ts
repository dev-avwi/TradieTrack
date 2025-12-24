import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// Liquid Glass navigation config for iOS (like ServiceM8)
// Uses native iOS blur effect for frosted glass appearance
export const getNavigationConfig = (colors: any, options?: { 
  enableLiquidGlass?: boolean;
  isDark?: boolean;
}) => {
  const enableLiquidGlass = options?.enableLiquidGlass ?? true;
  const isDark = options?.isDark ?? false;
  
  if (isIOS && enableLiquidGlass) {
    return {
      headerShown: true,
      animation: 'ios_from_right' as const,
      gestureEnabled: true,
      gestureDirection: 'horizontal' as const,
      // Liquid Glass effect - translucent header with native blur
      headerTransparent: true,
      headerBlurEffect: isDark ? 'systemMaterialDark' : 'systemMaterial',
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTintColor: colors.foreground,
      // Large title for iOS feel (like ServiceM8)
      headerLargeTitle: false,
      headerLargeTitleShadowVisible: false,
    };
  }
  
  // Android config - hide headers by default (screens manage their own headers)
  return {
    headerShown: false,
    animation: 'slide_from_right' as const,
    gestureEnabled: true,
    gestureDirection: 'horizontal' as const,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: colors.background,
    },
    headerTintColor: colors.foreground,
  };
};

// Helper for screens that need solid (non-transparent) headers
export const getSolidHeaderConfig = (colors: any) => ({
  headerShown: true,
  animation: isIOS ? 'ios_from_right' : 'slide_from_right',
  gestureEnabled: true,
  gestureDirection: 'horizontal' as const,
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTintColor: colors.foreground,
});

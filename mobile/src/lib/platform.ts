import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// Valid blur effect types for iOS native navigation
type BlurEffectType = 'extraLight' | 'light' | 'dark' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial' | 'systemUltraThinMaterialLight' | 'systemThinMaterialLight' | 'systemMaterialLight' | 'systemThickMaterialLight' | 'systemChromeMaterialLight' | 'systemUltraThinMaterialDark' | 'systemThinMaterialDark' | 'systemMaterialDark' | 'systemThickMaterialDark' | 'systemChromeMaterialDark';

// Navigation config - native iOS headers with blur, solid Android headers
export const getNavigationConfig = (colors: any, options?: { 
  enableLiquidGlass?: boolean;
  isDark?: boolean;
}) => {
  if (isIOS) {
    // iOS: Native navigation with blur effect for Liquid Glass feel
    const blurEffect: BlurEffectType = options?.isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight';
    
    return {
      headerShown: true,
      animation: 'ios_from_right' as const,
      gestureEnabled: true,
      gestureDirection: 'horizontal' as const,
      headerShadowVisible: false,
      // Native iOS blur header
      headerTransparent: true,
      headerBlurEffect: blurEffect,
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTintColor: colors.foreground,
      headerTitleStyle: {
        fontWeight: '600' as const,
        fontSize: 17,
      },
    };
  }
  
  // Android: Solid headers
  return {
    headerShown: true,
    animation: 'slide_from_right' as const,
    gestureEnabled: true,
    gestureDirection: 'horizontal' as const,
    headerShadowVisible: false,
    headerTransparent: false,
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

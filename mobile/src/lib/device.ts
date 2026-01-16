import { Platform, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';

const IPAD_WIDTH_THRESHOLD = 768;

// Platform detection
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// Get iOS version number (returns 0 for non-iOS)
export function getIOSVersion(): number {
  if (!isIOS) return 0;
  const version = Platform.Version;
  if (typeof version === 'string') {
    return parseFloat(version);
  }
  return version as number;
}

// ============================================================================
// iOS 26 "LIQUID GLASS" DESIGN SYSTEM
// Modern frosted glass aesthetic with deep blur, translucent layers, and 
// subtle highlights. Applied consistently across all iOS devices.
// ============================================================================

export type BlurTint = 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial';

// Glass configuration - consistent modern aesthetic
export interface GlassConfig {
  // Blur settings
  blurIntensity: number;
  blurTint: BlurTint;
  // Overlay colors (rgba)
  overlayLight: string;
  overlayDark: string;
  // Border colors (hairline glass edge)
  borderLight: string;
  borderDark: string;
  // Shadow for depth
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
}

// Liquid Glass configuration for navbars/chrome
export const GLASS_NAV: GlassConfig = {
  blurIntensity: 100,
  blurTint: 'systemChromeMaterial',
  overlayLight: 'rgba(255, 255, 255, 0.72)',
  overlayDark: 'rgba(28, 28, 30, 0.78)',
  borderLight: 'rgba(255, 255, 255, 0.18)',
  borderDark: 'rgba(255, 255, 255, 0.08)',
  shadowColor: '#000000',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: -2 },
};

// Liquid Glass configuration for cards/surfaces
export const GLASS_CARD: GlassConfig = {
  blurIntensity: 80,
  blurTint: 'systemThinMaterial',
  overlayLight: 'rgba(255, 255, 255, 0.65)',
  overlayDark: 'rgba(38, 38, 40, 0.70)',
  borderLight: 'rgba(255, 255, 255, 0.20)',
  borderDark: 'rgba(255, 255, 255, 0.10)',
  shadowColor: '#000000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
};

// Liquid Glass configuration for buttons/controls
export const GLASS_BUTTON: GlassConfig = {
  blurIntensity: 60,
  blurTint: 'systemUltraThinMaterial',
  overlayLight: 'rgba(255, 255, 255, 0.55)',
  overlayDark: 'rgba(48, 48, 52, 0.60)',
  borderLight: 'rgba(255, 255, 255, 0.25)',
  borderDark: 'rgba(255, 255, 255, 0.12)',
  shadowColor: '#000000',
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
};

// Get glass styling for a specific element type
export function getGlassStyle(type: 'nav' | 'card' | 'button', isDark: boolean) {
  const config = type === 'nav' ? GLASS_NAV : type === 'card' ? GLASS_CARD : GLASS_BUTTON;
  
  return {
    blurIntensity: config.blurIntensity,
    blurTint: config.blurTint,
    overlay: isDark ? config.overlayDark : config.overlayLight,
    border: isDark ? config.borderDark : config.borderLight,
    shadow: {
      shadowColor: config.shadowColor,
      shadowOpacity: config.shadowOpacity,
      shadowRadius: config.shadowRadius,
      shadowOffset: config.shadowOffset,
    },
  };
}

// Check if we should use glass effects (iOS only)
export function useGlassEffects(): boolean {
  return isIOS;
}

export function isTablet(): boolean {
  // Check Platform.isPad first (most reliable for iOS)
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  if (isPad) {
    return true;
  }
  
  // Use screen dimensions (more reliable than window for split view/zoom)
  const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
  
  // Use the larger of screen or window width (min of w/h for portrait mode check)
  const effectiveWidth = Math.max(
    Math.min(screenWidth, screenHeight),
    Math.min(windowWidth, windowHeight)
  );
  
  // Lower threshold to 744 to catch iPad mini
  const isLargeScreen = effectiveWidth >= 744;
  
  return isLargeScreen;
}

export function useDeviceType(): 'phone' | 'tablet' {
  return isTablet() ? 'tablet' : 'phone';
}

export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export function getContentWidth(): number {
  const { width } = Dimensions.get('window');
  if (isTablet()) {
    return width - SIDEBAR_WIDTH;
  }
  return width;
}

export function useContentWidth(): number {
  const [contentWidth, setContentWidth] = useState(() => getContentWidth());
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setContentWidth(getContentWidth());
    });
    return () => subscription.remove();
  }, []);
  
  return contentWidth;
}

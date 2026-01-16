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

// Check if device supports modern iOS features (iOS 13+)
// iOS 13 introduced dark mode, SF Symbols, and improved blur
export function supportsModernBlur(): boolean {
  if (!isIOS) return false;
  return getIOSVersion() >= 13;
}

// Check if device supports latest iOS features (iOS 15+)
// iOS 15 introduced materials system and enhanced vibrancy
export function supportsLatestBlur(): boolean {
  if (!isIOS) return false;
  return getIOSVersion() >= 15;
}

// Check if device supports iOS 18+ features (latest)
export function supportsIOS18(): boolean {
  if (!isIOS) return false;
  return getIOSVersion() >= 18;
}

// Use appropriate blur intensity based on iOS version
export function getBlurIntensity(): number {
  if (!isIOS) return 0;
  const version = getIOSVersion();
  if (version >= 18) return 80; // Latest iOS - full vibrancy
  if (version >= 15) return 70; // iOS 15+ - good blur support
  if (version >= 13) return 50; // iOS 13-14 - moderate blur
  return 0; // Older iOS - no blur (use fallback)
}

// Get blur type based on iOS version
export type BlurTint = 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial';

export function getBlurTint(isDark: boolean): BlurTint {
  const version = getIOSVersion();
  if (version >= 15) {
    // Use iOS 15+ system materials for best appearance
    return isDark ? 'systemThinMaterial' : 'systemThinMaterial';
  }
  if (version >= 13) {
    // iOS 13-14 use regular blur tints
    return isDark ? 'dark' : 'light';
  }
  // Fallback for older versions
  return isDark ? 'dark' : 'light';
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

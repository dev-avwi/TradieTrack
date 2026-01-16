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
// Authentic Apple Liquid Glass aesthetic - light translucent materials that
// let content peek through. Navigation floats as a distinct functional layer.
// Key principles: minimal overlays, let blur do the work, subtle highlights.
// ============================================================================

export type BlurTint = 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial';

// Glass configuration - authentic light translucent materials
export interface GlassConfig {
  // Blur settings - moderate intensity lets content show through
  blurIntensity: number;
  blurTint: BlurTint;
  // Overlay - VERY light tint, not opaque (8-18% opacity)
  overlayLight: string;
  overlayDark: string;
  // Top highlight - subtle gradient sheen for glass reflection
  highlightLight: string;
  highlightDark: string;
  // Border - barely visible separator (optional)
  borderLight: string;
  borderDark: string;
  // Shadow - very subtle or none (glass floats, doesn't cast heavy shadows)
  shadowOpacity: number;
}

// Liquid Glass for navigation chrome (Header, TabBar)
// Light translucent material - content can peek through
export const GLASS_NAV: GlassConfig = {
  blurIntensity: 50, // Moderate - lets content show through
  blurTint: 'systemChromeMaterial',
  // Very light overlay - just enough to separate from content
  overlayLight: 'rgba(255, 255, 255, 0.12)',
  overlayDark: 'rgba(0, 0, 0, 0.10)',
  // Subtle top highlight for glass reflection effect
  highlightLight: 'rgba(255, 255, 255, 0.35)',
  highlightDark: 'rgba(255, 255, 255, 0.08)',
  // Barely visible separator
  borderLight: 'rgba(0, 0, 0, 0.04)',
  borderDark: 'rgba(255, 255, 255, 0.06)',
  shadowOpacity: 0,
};

// Liquid Glass for floating cards/surfaces
export const GLASS_CARD: GlassConfig = {
  blurIntensity: 40,
  blurTint: 'systemThinMaterial',
  overlayLight: 'rgba(255, 255, 255, 0.15)',
  overlayDark: 'rgba(0, 0, 0, 0.12)',
  highlightLight: 'rgba(255, 255, 255, 0.25)',
  highlightDark: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(0, 0, 0, 0.03)',
  borderDark: 'rgba(255, 255, 255, 0.05)',
  shadowOpacity: 0.03,
};

// Liquid Glass for buttons/controls
export const GLASS_BUTTON: GlassConfig = {
  blurIntensity: 30,
  blurTint: 'systemUltraThinMaterial',
  overlayLight: 'rgba(255, 255, 255, 0.18)',
  overlayDark: 'rgba(0, 0, 0, 0.15)',
  highlightLight: 'rgba(255, 255, 255, 0.30)',
  highlightDark: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.05)',
  borderDark: 'rgba(255, 255, 255, 0.06)',
  shadowOpacity: 0.02,
};

// Get glass styling for a specific element type
export function getGlassStyle(type: 'nav' | 'card' | 'button', isDark: boolean) {
  const config = type === 'nav' ? GLASS_NAV : type === 'card' ? GLASS_CARD : GLASS_BUTTON;
  
  return {
    blurIntensity: config.blurIntensity,
    blurTint: config.blurTint,
    overlay: isDark ? config.overlayDark : config.overlayLight,
    highlight: isDark ? config.highlightDark : config.highlightLight,
    border: isDark ? config.borderDark : config.borderLight,
    shadowOpacity: config.shadowOpacity,
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

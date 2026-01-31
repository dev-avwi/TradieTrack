import { Platform, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';

const IPAD_WIDTH_THRESHOLD = 768;

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

export function isIPad(): boolean {
  return Platform.OS === 'ios' && Platform.isPad;
}

export function getOrientation(): 'portrait' | 'landscape' {
  const { width, height } = Dimensions.get('window');
  return width > height ? 'landscape' : 'portrait';
}

export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => getOrientation());
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const newOrientation = window.width > window.height ? 'landscape' : 'portrait';
      setOrientation(newOrientation);
    });
    return () => subscription.remove();
  }, []);
  
  return orientation;
}

export function useDeviceType(): 'phone' | 'tablet' {
  return isTablet() ? 'tablet' : 'phone';
}

// Determines if we should use sidebar navigation
// iPad uses sidebar only in landscape mode
// Phones always use bottom nav
export function useShouldUseSidebar(): boolean {
  const [shouldUseSidebar, setShouldUseSidebar] = useState(() => {
    const isPad = isIPad();
    if (isPad) {
      return getOrientation() === 'landscape';
    }
    // Non-iPad tablets always use sidebar
    return isTablet();
  });
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const isPad = isIPad();
      if (isPad) {
        const orientation = window.width > window.height ? 'landscape' : 'portrait';
        setShouldUseSidebar(orientation === 'landscape');
      } else {
        setShouldUseSidebar(isTablet());
      }
    });
    return () => subscription.remove();
  }, []);
  
  return shouldUseSidebar;
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

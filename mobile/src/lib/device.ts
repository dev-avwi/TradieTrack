import { Platform, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';

const IPAD_WIDTH_THRESHOLD = 768;

export function isTablet(): boolean {
  if (Platform.OS === 'ios' && Platform.isPad) {
    return true;
  }
  
  const { width, height } = Dimensions.get('window');
  const screenWidth = Math.min(width, height);
  
  return screenWidth >= IPAD_WIDTH_THRESHOLD;
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

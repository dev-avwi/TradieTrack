import { Platform, Dimensions } from 'react-native';

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

export const SIDEBAR_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

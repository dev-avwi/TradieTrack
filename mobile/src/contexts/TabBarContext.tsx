/**
 * Tab Bar Context for iOS 26 Liquid Glass
 * 
 * Provides animated tab bar hide/show behavior based on scroll direction.
 * Tab bar minimizes when scrolling down, expands when scrolling up.
 * This matches Apple's iOS 26 Liquid Glass tab bar behavior.
 */
import { createContext, useContext, useRef, useState, ReactNode } from 'react';
import { Animated } from 'react-native';

interface TabBarContextValue {
  /** Animated value for tab bar translation (0 = visible, 1 = hidden) */
  tabBarAnimatedValue: Animated.Value;
  /** Whether tab bar is currently hidden */
  isTabBarHidden: boolean;
  /** Call this when scroll starts */
  onScrollBegin: () => void;
  /** Call this with scroll events to update tab bar visibility */
  onScroll: (currentOffset: number) => void;
  /** Force show the tab bar */
  showTabBar: () => void;
  /** Force hide the tab bar */
  hideTabBar: () => void;
}

const TabBarContext = createContext<TabBarContextValue | null>(null);

interface TabBarProviderProps {
  children: ReactNode;
}

export function TabBarProvider({ children }: TabBarProviderProps) {
  const tabBarAnimatedValue = useRef(new Animated.Value(0)).current;
  const [isTabBarHidden, setIsTabBarHidden] = useState(false);
  
  // Track scroll state
  const lastOffsetRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const accumulatedScrollRef = useRef(0);
  
  // Threshold for triggering hide/show (prevents jitter)
  const SCROLL_THRESHOLD = 50;
  
  const onScrollBegin = () => {
    accumulatedScrollRef.current = 0;
  };
  
  const onScroll = (currentOffset: number) => {
    const previousOffset = lastOffsetRef.current;
    const diff = currentOffset - previousOffset;
    
    // At top of scroll - always show tab bar
    if (currentOffset <= 0) {
      if (isTabBarHidden) {
        showTabBar();
      }
      lastOffsetRef.current = currentOffset;
      return;
    }
    
    // Determine scroll direction
    const currentDirection = diff > 0 ? 'down' : 'up';
    
    // If direction changed, reset accumulator
    if (currentDirection !== scrollDirectionRef.current) {
      scrollDirectionRef.current = currentDirection;
      accumulatedScrollRef.current = 0;
    }
    
    // Accumulate scroll in current direction
    accumulatedScrollRef.current += Math.abs(diff);
    
    // Check if we've scrolled enough to trigger hide/show
    if (accumulatedScrollRef.current > SCROLL_THRESHOLD) {
      if (currentDirection === 'down' && !isTabBarHidden) {
        hideTabBar();
      } else if (currentDirection === 'up' && isTabBarHidden) {
        showTabBar();
      }
      accumulatedScrollRef.current = 0;
    }
    
    lastOffsetRef.current = currentOffset;
  };
  
  const showTabBar = () => {
    setIsTabBarHidden(false);
    Animated.spring(tabBarAnimatedValue, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 12,
    }).start();
  };
  
  const hideTabBar = () => {
    setIsTabBarHidden(true);
    Animated.spring(tabBarAnimatedValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 12,
    }).start();
  };
  
  return (
    <TabBarContext.Provider
      value={{
        tabBarAnimatedValue,
        isTabBarHidden,
        onScrollBegin,
        onScroll,
        showTabBar,
        hideTabBar,
      }}
    >
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  const context = useContext(TabBarContext);
  if (!context) {
    // Return a default implementation if not wrapped in provider
    return {
      tabBarAnimatedValue: new Animated.Value(0),
      isTabBarHidden: false,
      onScrollBegin: () => {},
      onScroll: () => {},
      showTabBar: () => {},
      hideTabBar: () => {},
    };
  }
  return context;
}

export default TabBarContext;

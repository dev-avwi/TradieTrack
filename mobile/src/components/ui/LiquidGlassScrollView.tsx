/**
 * iOS 26 Liquid Glass ScrollView
 * Provides edge-to-edge content that scrolls behind floating tab bar and headers
 * 
 * Features:
 * - Automatic content insets for floating tab bar
 * - Header insets for transparent navigation
 * - Content extends behind floating glass controls
 */
import { ReactNode, forwardRef, useCallback } from 'react';
import { 
  ScrollView, 
  ScrollViewProps, 
  StyleSheet, 
  NativeSyntheticEvent, 
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isIOS } from '../../lib/device';
import { LiquidGlass } from '../../lib/ios-design';

interface LiquidGlassScrollViewProps extends ScrollViewProps {
  children: ReactNode;
  /** Whether to add bottom inset for floating tab bar (default: true) */
  hasTabBar?: boolean;
  /** Whether to add top inset for transparent header (default: true) */
  hasHeader?: boolean;
  /** Additional bottom padding */
  extraBottomPadding?: number;
  /** Additional top padding */
  extraTopPadding?: number;
  /** Whether this is a FlatList-style scroll (don't wrap children) */
  isVirtualized?: boolean;
}

export const LiquidGlassScrollView = forwardRef<ScrollView, LiquidGlassScrollViewProps>(
  function LiquidGlassScrollView(
    {
      children,
      hasTabBar = true,
      hasHeader = true,
      extraBottomPadding = 0,
      extraTopPadding = 0,
      isVirtualized = false,
      style,
      contentContainerStyle,
      onScroll,
      scrollEventThrottle = 16,
      ...props
    },
    ref
  ) {
    const insets = useSafeAreaInsets();
    
    // Calculate content insets for edge-to-edge layout on iOS
    const getContentInsets = () => {
      if (!isIOS) {
        return {
          top: extraTopPadding,
          bottom: extraBottomPadding,
        };
      }
      
      // Tab bar height + margins + safe area
      const tabBarInset = hasTabBar 
        ? LiquidGlass.tabBar.height + LiquidGlass.tabBar.marginBottom + insets.bottom
        : insets.bottom;
      
      // Header height (native header handles its own insets)
      const headerInset = hasHeader ? 0 : 0;
      
      return {
        top: headerInset + extraTopPadding,
        bottom: tabBarInset + extraBottomPadding,
      };
    };
    
    const contentInsets = getContentInsets();
    
    return (
      <ScrollView
        ref={ref}
        style={[styles.scrollView, style]}
        contentContainerStyle={[
          {
            paddingTop: contentInsets.top,
            paddingBottom: contentInsets.bottom,
          },
          contentContainerStyle,
        ]}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        // iOS-specific settings for smooth edge-to-edge scrolling
        contentInsetAdjustmentBehavior={isIOS ? 'automatic' : undefined}
        automaticallyAdjustContentInsets={isIOS}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
);

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
});

export default LiquidGlassScrollView;

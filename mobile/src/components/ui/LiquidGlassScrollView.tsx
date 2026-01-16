/**
 * iOS 26 Liquid Glass ScrollView
 * Provides true edge-to-edge content that scrolls behind floating glass controls.
 * 
 * The key to Apple's Liquid Glass design:
 * - Content extends behind tab bar and headers (no clipping)
 * - Glass surfaces refract the scrolling content
 * - Transparent backgrounds let the shared background layer show through
 * - Tab bar minimizes on scroll down, expands on scroll up
 * 
 * Features:
 * - Automatic content insets for floating tab bar
 * - Header insets for transparent navigation
 * - Content extends behind floating glass controls
 * - Optional integrated background gradient
 * - Tab bar hide-on-scroll behavior (iOS 26)
 */
import { ReactNode, forwardRef, useCallback, useRef } from 'react';
import { 
  ScrollView, 
  ScrollViewProps, 
  StyleSheet, 
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSSystemColors } from '../../lib/ios-design';
import { useTabBar } from '../../contexts/TabBarContext';

interface LiquidGlassScrollViewProps extends ScrollViewProps {
  children: ReactNode;
  /** Whether to add bottom inset for floating tab bar (default: true) */
  hasTabBar?: boolean;
  /** Whether to add top inset for transparent header (default: false for native large title) */
  hasHeader?: boolean;
  /** Additional bottom padding */
  extraBottomPadding?: number;
  /** Additional top padding */
  extraTopPadding?: number;
  /** Whether this is a FlatList-style scroll (don't wrap children) */
  isVirtualized?: boolean;
  /** Show integrated background gradient (for screens without LiquidGlassBackground wrapper) */
  showBackground?: boolean;
  /** Background variant */
  backgroundVariant?: 'default' | 'mesh';
  /** Use native iOS large title behavior (no manual top padding) */
  nativeLargeTitle?: boolean;
  /** Enable tab bar hide on scroll (iOS 26 behavior) */
  hidesTabBarOnScroll?: boolean;
}

export const LiquidGlassScrollView = forwardRef<ScrollView, LiquidGlassScrollViewProps>(
  function LiquidGlassScrollView(
    {
      children,
      hasTabBar = true,
      hasHeader = false,
      extraBottomPadding = 0,
      extraTopPadding = 0,
      isVirtualized = false,
      showBackground = false,
      backgroundVariant = 'default',
      nativeLargeTitle = true,
      hidesTabBarOnScroll = true,
      style,
      contentContainerStyle,
      onScroll: externalOnScroll,
      scrollEventThrottle = 16,
      ...props
    },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const { isDark } = useTheme();
    const { onScroll: tabBarOnScroll, onScrollBegin } = useTabBar();
    
    const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
    
    // Background gradient colors for iOS
    const gradientColors = isDark 
      ? ['rgba(0, 0, 0, 1)', 'rgba(18, 18, 20, 1)', 'rgba(28, 28, 30, 1)']
      : ['rgba(242, 242, 247, 1)', 'rgba(248, 248, 252, 1)', 'rgba(255, 255, 255, 1)'];
    
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
      
      // For native large title, let iOS handle top insets automatically
      // This enables the collapsing large title behavior
      const topInset = nativeLargeTitle ? 0 : (hasHeader ? 0 : 0);
      
      return {
        top: topInset + extraTopPadding,
        bottom: tabBarInset + extraBottomPadding,
      };
    };
    
    const contentInsets = getContentInsets();
    
    // Handle scroll events for tab bar hide/show
    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Call external scroll handler if provided
      if (externalOnScroll) {
        externalOnScroll(event);
      }
      
      // Update tab bar visibility based on scroll
      if (isIOS && hidesTabBarOnScroll) {
        const offsetY = event.nativeEvent.contentOffset.y;
        tabBarOnScroll(offsetY);
      }
    }, [externalOnScroll, hidesTabBarOnScroll, tabBarOnScroll]);
    
    const handleScrollBeginDrag = useCallback(() => {
      if (isIOS && hidesTabBarOnScroll) {
        onScrollBegin();
      }
    }, [hidesTabBarOnScroll, onScrollBegin]);
    
    const scrollViewContent = (
      <ScrollView
        ref={ref}
        style={[
          styles.scrollView, 
          // Transparent background on iOS so the gradient/content shows through glass
          isIOS && showBackground && { backgroundColor: 'transparent' },
          style,
        ]}
        contentContainerStyle={[
          {
            // Only add top padding if NOT using native large title (iOS handles insets automatically)
            paddingTop: isIOS && nativeLargeTitle ? extraTopPadding : contentInsets.top,
            paddingBottom: contentInsets.bottom,
            // Extra horizontal padding for content
            paddingHorizontal: isIOS ? 16 : 0,
          },
          contentContainerStyle,
        ]}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={scrollEventThrottle}
        // iOS-specific settings for native large title collapsing behavior
        contentInsetAdjustmentBehavior={isIOS ? 'automatic' : undefined}
        automaticallyAdjustContentInsets={isIOS}
        automaticallyAdjustsScrollIndicatorInsets={isIOS}
        {...props}
      >
        {children}
      </ScrollView>
    );
    
    // For iOS with background enabled, wrap in gradient background
    if (isIOS && showBackground) {
      return (
        <View style={styles.container}>
          <LinearGradient
            colors={gradientColors as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {scrollViewContent}
        </View>
      );
    }
    
    return scrollViewContent;
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});

export default LiquidGlassScrollView;

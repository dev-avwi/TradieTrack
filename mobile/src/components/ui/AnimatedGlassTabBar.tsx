/**
 * iOS 26 Animated Glass Tab Bar
 * 
 * A custom tab bar component that:
 * - Uses Liquid Glass material
 * - Floats above content
 * - Hides on scroll down, shows on scroll up (iOS 26 behavior)
 * - Animates smoothly with spring physics
 */
import { View, StyleSheet, Animated, Pressable, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { isIOS } from '../../lib/device';
import { LiquidGlass, IOSSystemColors, getLiquidGlassColors } from '../../lib/ios-design';
import { useTabBar } from '../../contexts/TabBarContext';

interface TabItem {
  name: string;
  label: string;
  icon: string;
}

interface AnimatedGlassTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const TAB_ITEMS: TabItem[] = [
  { name: 'index', label: 'Dashboard', icon: 'home' },
  { name: 'jobs', label: 'Work', icon: 'briefcase' },
  { name: 'map', label: 'Map', icon: 'map' },
  { name: 'money', label: 'Money', icon: 'dollar-sign' },
  { name: 'profile', label: 'More', icon: 'more-horizontal' },
];

export function AnimatedGlassTabBar({ state, descriptors, navigation }: AnimatedGlassTabBarProps) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { tabBarAnimatedValue } = useTabBar();
  
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  const glassColors = getLiquidGlassColors(isDark);
  
  // Calculate hide translation (move down off screen)
  const tabBarHeight = LiquidGlass.tabBar.height + LiquidGlass.tabBar.marginBottom + insets.bottom;
  
  const translateY = tabBarAnimatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabBarHeight + 20],
  });
  
  const opacity = tabBarAnimatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.8, 0],
  });
  
  const handleTabPress = (routeName: string, isFocused: boolean) => {
    if (isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const event = navigation.emit({
      type: 'tabPress',
      target: routeName,
      canPreventDefault: true,
    });
    
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };
  
  // Filter to only show main tabs (exclude hidden routes)
  const visibleRoutes = state.routes.filter((route: any) => {
    const options = descriptors[route.key]?.options;
    return options?.href !== null;
  });
  
  if (!isIOS) {
    // Android: Don't render this custom tab bar
    return null;
  }
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: LiquidGlass.tabBar.marginBottom + insets.bottom,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.tabBarInner}>
        {/* Glass background */}
        <BlurView
          intensity={LiquidGlass.tabBar.blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, styles.blurLayer]}
        />
        
        {/* Glass tint overlay */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.glassOverlay,
            { backgroundColor: glassColors.background },
          ]}
        />
        
        {/* Border */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.border,
            { borderColor: glassColors.border },
          ]}
        />
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {visibleRoutes.map((route: any, index: number) => {
            const tabItem = TAB_ITEMS.find(t => t.name === route.name);
            if (!tabItem) return null;
            
            const isFocused = state.index === state.routes.findIndex((r: any) => r.name === route.name);
            const color = isFocused ? IOSSystemColors.systemBlue : iosColors.secondaryLabel;
            
            return (
              <Pressable
                key={route.key}
                onPress={() => handleTabPress(route.name, isFocused)}
                style={styles.tab}
              >
                <Feather name={tabItem.icon as any} size={22} color={color} />
                <Text style={[styles.tabLabel, { color }]}>
                  {tabItem.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: LiquidGlass.tabBar.marginHorizontal,
    right: LiquidGlass.tabBar.marginHorizontal,
    height: LiquidGlass.tabBar.height,
    // Shadow for floating effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  tabBarInner: {
    flex: 1,
    borderRadius: LiquidGlass.tabBar.borderRadius,
    overflow: 'hidden',
  },
  blurLayer: {
    borderRadius: LiquidGlass.tabBar.borderRadius,
    overflow: 'hidden',
  },
  glassOverlay: {
    borderRadius: LiquidGlass.tabBar.borderRadius,
  },
  border: {
    borderRadius: LiquidGlass.tabBar.borderRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default AnimatedGlassTabBar;

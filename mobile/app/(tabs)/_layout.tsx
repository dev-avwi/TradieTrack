import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/lib/theme';
import { isIOS } from '../../src/lib/device';
import { IOSSystemColors, LiquidGlass, getLiquidGlassColors } from '../../src/lib/ios-design';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  
  // iOS: Use native tab bar with Liquid Glass effect
  // Android: Hide native tab bar (use custom BottomNav)
  const useNativeTabBar = isIOS;
  
  // iOS semantic colors for proper native appearance
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  const glassColors = getLiquidGlassColors(isDark);
  
  return (
    <Tabs
      screenOptions={{
        // iOS: Show native header with blur, Android: hide
        headerShown: isIOS,
        headerTransparent: isIOS,
        headerBlurEffect: isIOS ? (isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight') : undefined,
        headerStyle: isIOS ? {
          backgroundColor: 'transparent',
        } : undefined,
        // iOS native header title styling
        headerTitleStyle: isIOS ? {
          fontWeight: '600',
          fontSize: 17,
          color: iosColors.label,
        } : undefined,
        // iOS large title styling (collapses on scroll)
        headerLargeTitleStyle: isIOS ? {
          fontWeight: '700',
          fontSize: 34,
          color: iosColors.label,
        } : undefined,
        headerLargeTitleShadowVisible: false,
        headerTintColor: isIOS ? IOSSystemColors.systemBlue : undefined,
        headerShadowVisible: false,
        
        // iOS: Floating Liquid Glass tab bar
        tabBarStyle: useNativeTabBar ? {
          position: 'absolute',
          bottom: LiquidGlass.tabBar.marginBottom,
          left: LiquidGlass.tabBar.marginHorizontal,
          right: LiquidGlass.tabBar.marginHorizontal,
          height: LiquidGlass.tabBar.height,
          borderRadius: LiquidGlass.tabBar.borderRadius,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          // Add shadow for floating effect
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 24,
        } : { display: 'none' },
        
        // iOS Liquid Glass tab bar background
        tabBarBackground: useNativeTabBar ? () => (
          <View style={StyleSheet.absoluteFill}>
            {/* Blur layer */}
            <BlurView
              intensity={LiquidGlass.tabBar.blurIntensity}
              tint={isDark ? 'dark' : 'light'}
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: LiquidGlass.tabBar.borderRadius,
                  overflow: 'hidden',
                },
              ]}
            />
            {/* Glass tint overlay */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: glassColors.background,
                  borderRadius: LiquidGlass.tabBar.borderRadius,
                },
              ]}
            />
            {/* Subtle border */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: LiquidGlass.tabBar.borderRadius,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: glassColors.border,
                },
              ]}
            />
          </View>
        ) : undefined,
        
        // iOS native tab bar colors
        tabBarActiveTintColor: isIOS ? IOSSystemColors.systemBlue : colors.primary,
        tabBarInactiveTintColor: isIOS ? iosColors.secondaryLabel : colors.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        
        animation: 'shift',
      }}
      sceneContainerStyle={{
        // Transparent on iOS so content/background shows through glass controls
        backgroundColor: isIOS ? 'transparent' : colors.background,
      }}
      screenListeners={{
        tabPress: () => {
          // iOS: Haptic feedback on tab press
          if (isIOS) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'TradieTrack',
          headerLargeTitle: true,
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Work',
          headerTitle: 'Jobs',
          headerLargeTitle: true,
          tabBarIcon: ({ color, size }) => (
            <Feather name="briefcase" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          headerTitle: 'Team Map',
          tabBarIcon: ({ color, size }) => (
            <Feather name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          headerTitle: 'Money',
          headerLargeTitle: true,
          tabBarIcon: ({ color, size }) => (
            <Feather name="dollar-sign" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'More',
          headerTitle: 'More',
          headerLargeTitle: true,
          tabBarIcon: ({ color, size }) => (
            <Feather name="more-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="collect"
        options={{
          href: null,
          headerTitle: 'Collect Payment',
        }}
      />
    </Tabs>
  );
}

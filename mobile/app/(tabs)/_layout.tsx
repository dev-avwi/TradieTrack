import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/lib/theme';
import { isIOS } from '../../src/lib/device';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  
  // iOS: Use native tab bar with blur effect
  // Android: Hide native tab bar (use custom BottomNav)
  const useNativeTabBar = isIOS;
  
  return (
    <Tabs
      screenOptions={{
        // iOS: Show native header with blur, Android: hide
        headerShown: isIOS,
        headerTransparent: isIOS,
        headerBlurEffect: isIOS ? (isDark ? 'dark' : 'light') : undefined,
        headerStyle: isIOS ? {
          backgroundColor: 'transparent',
        } : undefined,
        headerTitleStyle: isIOS ? {
          fontWeight: '600',
          fontSize: 17,
        } : undefined,
        headerShadowVisible: false,
        
        // iOS: Show native tab bar, Android: hide (custom BottomNav)
        tabBarStyle: useNativeTabBar ? {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        } : { display: 'none' },
        
        // iOS native tab bar styling
        tabBarBackground: useNativeTabBar ? () => (
          <BlurView
            intensity={50}
            tint={isDark ? 'dark' : 'light'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
        ) : undefined,
        
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        
        animation: 'shift',
      }}
      sceneContainerStyle={{
        backgroundColor: colors.background,
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

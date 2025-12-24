import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme, ThemeColors } from '../lib/theme';
import { useScrollToTop } from '../contexts/ScrollContext';

const isIOS = Platform.OS === 'ios';

interface NavItem {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  path: string;
  matchPaths?: string[];
}

const navItems: NavItem[] = [
  { 
    title: 'Activity', 
    icon: 'home', 
    path: '/',
    matchPaths: ['/', '/index']
  },
  { 
    title: 'Jobs', 
    icon: 'list', 
    path: '/jobs',
    matchPaths: ['/jobs', '/job']
  },
  { 
    title: 'Notifications', 
    icon: 'bell', 
    path: '/more/notifications',
    matchPaths: ['/more/notifications']
  },
  { 
    title: 'More', 
    icon: 'more-horizontal', 
    path: '/profile',
    matchPaths: ['/profile', '/more', '/map', '/money', '/more/invoices', '/more/quotes', '/more/money-hub', '/collect', '/more/chat-hub', '/more/team-chat', '/more/direct-messages']
  },
];

export const BOTTOM_NAV_HEIGHT = 64;

function NavButton({ 
  item, 
  active, 
  onPress,
  colors,
  styles,
}: { 
  item: NavItem; 
  active: boolean; 
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.8,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View 
        style={[
          styles.navButton,
          { transform: [{ scale }], opacity }
        ]}
      >
        <Feather 
          name={item.icon} 
          size={22}
          color={active ? colors.foreground : colors.mutedForeground}
        />
        <Text style={[
          styles.navLabel,
          active && styles.navLabelActive,
        ]}>
          {item.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { triggerScrollToTop } = useScrollToTop();

  const isActive = (item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
    }
    return pathname === item.path;
  };

  const isOnMainPage = (item: NavItem) => {
    // Check if we're on the exact main page for this tab (not a subpage)
    return pathname === item.path || 
           (item.path === '/' && (pathname === '/' || pathname === '/index'));
  };

  const handlePress = (item: NavItem) => {
    if (isActive(item)) {
      // If on a subpage, navigate to main page; if already on main page, scroll to top
      if (isOnMainPage(item)) {
        triggerScrollToTop();
      } else {
        router.push(item.path as any);
      }
    } else {
      router.push(item.path as any);
    }
  };

  const containerStyle = [styles.container, { paddingBottom: Math.max(insets.bottom, 8) }];
  
  const navContent = (
    <View style={styles.navBar}>
      {navItems.map((item) => (
        <NavButton
          key={item.title}
          item={item}
          active={isActive(item)}
          onPress={() => handlePress(item)}
          colors={colors}
          styles={styles}
        />
      ))}
    </View>
  );

  // iOS: Use BlurView for Liquid Glass effect
  if (isIOS) {
    return (
      <BlurView 
        intensity={80} 
        tint={isDark ? 'dark' : 'light'}
        style={containerStyle}
      >
        {navContent}
      </BlurView>
    );
  }

  // Android: Solid background
  return (
    <View style={containerStyle}>
      {navContent}
    </View>
  );
}

export function getBottomNavHeight(bottomInset: number): number {
  return BOTTOM_NAV_HEIGHT + Math.max(bottomInset, 8);
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: isIOS ? 'transparent' : colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isIOS 
      ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)')
      : colors.border,
    ...(isIOS ? {} : {
      elevation: 4,
    }),
    overflow: 'hidden',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: BOTTOM_NAV_HEIGHT,
    paddingHorizontal: 8,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    minWidth: 64,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginTop: 3,
  },
  navLabelActive: {
    fontWeight: '600',
    color: colors.foreground,
  },
});

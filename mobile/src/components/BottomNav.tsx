import { useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { useTheme, ThemeColors } from '../lib/theme';
import { useScrollToTop } from '../contexts/ScrollContext';

const isIOS = Platform.OS === 'ios';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NavItem {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  path: string;
  matchPaths?: string[];
}

const navItems: NavItem[] = [
  { 
    title: 'Dashboard', 
    icon: 'home', 
    path: '/',
    matchPaths: ['/', '/index']
  },
  { 
    title: 'Work', 
    icon: 'briefcase', 
    path: '/jobs',
    matchPaths: ['/jobs', '/job']
  },
  { 
    title: 'Chat', 
    icon: 'message-circle', 
    path: '/more/chat-hub',
    matchPaths: ['/more/chat-hub', '/more/team-chat', '/more/direct-messages']
  },
  { 
    title: 'More', 
    icon: 'more-horizontal', 
    path: '/profile',
    matchPaths: ['/profile', '/more', '/map', '/money', '/more/invoices', '/more/quotes', '/more/money-hub', '/collect']
  },
];

export const BOTTOM_NAV_HEIGHT = 56;
const TAB_COUNT = navItems.length;
const NAV_HORIZONTAL_PADDING = 16;
const PILL_WIDTH = 64;
const PILL_HEIGHT = 36;

const springConfig = {
  damping: 20,
  stiffness: 280,
};

function SlidingPill({ 
  activeIndex, 
  tabWidth,
  colors,
}: { 
  activeIndex: SharedValue<number>;
  tabWidth: number;
  colors: ThemeColors;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      activeIndex.value,
      [0, 1, 2, 3],
      [0, tabWidth, tabWidth * 2, tabWidth * 3],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <Animated.View 
      style={[
        {
          position: 'absolute',
          left: NAV_HORIZONTAL_PADDING / 2 + (tabWidth - PILL_WIDTH) / 2,
          top: (BOTTOM_NAV_HEIGHT - PILL_HEIGHT) / 2,
          width: PILL_WIDTH,
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
          backgroundColor: colors.tabBarActive,
        },
        animatedStyle,
      ]} 
    />
  );
}

function NavButton({ 
  item, 
  active,
  index,
  activeIndex,
  onPress,
  colors,
  styles,
}: { 
  item: NavItem; 
  active: boolean;
  index: number;
  activeIndex: SharedValue<number>;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const animatedIconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [1, 1.05, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [0, -1, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      style={styles.navButtonContainer}
    >
      <Animated.View style={[styles.navButton, animatedIconStyle]}>
        <Feather 
          name={item.icon} 
          size={22}
          color={active ? colors.primary : colors.mutedForeground}
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

  const tabWidth = useMemo(() => {
    return (SCREEN_WIDTH - NAV_HORIZONTAL_PADDING) / TAB_COUNT;
  }, []);

  const getActiveIndex = useCallback(() => {
    const chatRoutes = ['/more/chat-hub', '/more/team-chat', '/more/direct-messages'];
    const isChatRoute = chatRoutes.some(r => pathname === r || pathname.startsWith(r + '/'));
    if (isChatRoute) return 2;

    for (let i = 0; i < navItems.length; i++) {
      const item = navItems[i];
      if (item.matchPaths?.some(p => pathname === p || pathname.startsWith(p + '/'))) {
        return i;
      }
      if (pathname === item.path) return i;
    }
    return 0;
  }, [pathname]);

  const currentIndex = getActiveIndex();
  const activeIndex = useSharedValue(currentIndex);

  useEffect(() => {
    activeIndex.value = withSpring(currentIndex, springConfig);
  }, [currentIndex]);

  const isActive = useCallback((item: NavItem) => {
    const chatRoutes = ['/more/chat-hub', '/more/team-chat', '/more/direct-messages'];
    const isChatRoute = chatRoutes.some(r => pathname === r || pathname.startsWith(r + '/'));
    
    if (isChatRoute) {
      return item.title === 'Chat';
    }
    
    if (item.matchPaths) {
      return item.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
    }
    return pathname === item.path;
  }, [pathname]);

  const isOnMainPage = useCallback((item: NavItem) => {
    return pathname === item.path || 
           (item.path === '/' && (pathname === '/' || pathname === '/index'));
  }, [pathname]);

  const handlePress = useCallback((item: NavItem, index: number) => {
    if (isActive(item)) {
      if (isOnMainPage(item)) {
        triggerScrollToTop();
      } else {
        router.push(item.path as any);
      }
    } else {
      router.push(item.path as any);
    }
  }, [isActive, isOnMainPage, triggerScrollToTop]);

  const containerStyle = [styles.container, { paddingBottom: Math.max(insets.bottom, 6) }];
  
  const navContent = (
    <View style={styles.navBar}>
      <SlidingPill 
        activeIndex={activeIndex} 
        tabWidth={tabWidth}
        colors={colors}
      />
      {navItems.map((item, index) => (
        <NavButton
          key={item.title}
          item={item}
          index={index}
          active={isActive(item)}
          activeIndex={activeIndex}
          onPress={() => handlePress(item, index)}
          colors={colors}
          styles={styles}
        />
      ))}
    </View>
  );

  if (isIOS) {
    return (
      <BlurView 
        intensity={80} 
        tint={isDark ? 'dark' : 'light'}
        style={containerStyle}
      >
        <View style={styles.glassOverlay} />
        {navContent}
      </BlurView>
    );
  }

  return (
    <View style={[containerStyle, { backgroundColor: colors.chromeBackground }]}>
      {navContent}
    </View>
  );
}

export function getBottomNavHeight(bottomInset: number): number {
  return BOTTOM_NAV_HEIGHT + Math.max(bottomInset, 6);
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: isIOS ? 'transparent' : colors.chromeBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.chromeBorder,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: BOTTOM_NAV_HEIGHT,
    paddingHorizontal: NAV_HORIZONTAL_PADDING / 2,
  },
  navButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginTop: 1,
    letterSpacing: 0.2,
  },
  navLabelActive: {
    fontWeight: '600',
    color: colors.primary,
  },
});

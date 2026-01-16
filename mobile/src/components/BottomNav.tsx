import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../lib/theme';
import { useScrollToTop } from '../contexts/ScrollContext';
import { isIOS, isAndroid, useGlassEffects, getGlassStyle } from '../lib/device';

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
          active && styles.navButtonActive,
          { transform: [{ scale }], opacity }
        ]}
      >
        <Feather 
          name={item.icon} 
          size={20}
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { triggerScrollToTop } = useScrollToTop();

  // iOS: Liquid Glass effect
  const useGlass = useGlassEffects();
  const glassStyle = getGlassStyle('nav', isDark);

  const isActive = (item: NavItem) => {
    // Chat-specific routes should only highlight Chat, not More
    const chatRoutes = ['/more/chat-hub', '/more/team-chat', '/more/direct-messages'];
    const isChatRoute = chatRoutes.some(r => pathname === r || pathname.startsWith(r + '/'));
    
    // If current route is a chat route, only Chat tab should be active
    if (isChatRoute) {
      return item.title === 'Chat';
    }
    
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
    // iOS: Add haptic feedback on tab press
    if (isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
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

  // iOS: Use BlurView for authentic "Liquid Glass" tab bar
  if (useGlass) {
    return (
      <View style={[containerStyle, styles.containerGlass]}>
        {/* Base blur layer - let the material do the work */}
        <BlurView 
          intensity={glassStyle.blurIntensity} 
          tint={glassStyle.blurTint}
          style={StyleSheet.absoluteFill}
        />
        {/* Very light overlay for separation */}
        <View 
          style={[
            StyleSheet.absoluteFill, 
            { backgroundColor: glassStyle.overlay }
          ]} 
        />
        {/* Subtle top highlight gradient - glass reflection effect */}
        <LinearGradient
          colors={[glassStyle.highlight, 'transparent']}
          style={styles.glassHighlight}
        />
        {/* Top edge separator */}
        <View 
          style={[
            styles.glassTopBorder, 
            { backgroundColor: glassStyle.border }
          ]} 
        />
        {navContent}
      </View>
    );
  }

  // Android: solid background
  return (
    <View style={containerStyle}>
      {navContent}
    </View>
  );
}

export function getBottomNavHeight(bottomInset: number): number {
  return BOTTOM_NAV_HEIGHT + Math.max(bottomInset, 8);
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  containerGlass: {
    // iOS Liquid Glass container - transparent to show blur
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
    opacity: 0.5,
  },
  glassTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: BOTTOM_NAV_HEIGHT,
    paddingHorizontal: 12,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 9999,
    gap: 2,
  },
  navButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  navLabelActive: {
    fontWeight: '600',
    color: colors.primary,
  },
});

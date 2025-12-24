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
    matchPaths: ['/more/chat-hub', '/more/team-chat', '/more/direct-messages', '/more/sms']
  },
  { 
    title: 'More', 
    icon: 'menu', 
    path: '/profile',
    matchPaths: ['/profile', '/more', '/map', '/money', '/more/invoices', '/more/quotes', '/more/money-hub', '/collect', '/more/notifications', '/more/settings', '/more/clients', '/more/team-management']
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
        toValue: 0.92,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.7,
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
          size={22}
          color={active ? colors.primary : colors.mutedForeground}
        />
        <Text style={[
          styles.navLabel,
          { color: active ? colors.primary : colors.mutedForeground },
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
    return pathname === item.path || 
           (item.path === '/' && (pathname === '/' || pathname === '/index'));
  };

  const handlePress = (item: NavItem) => {
    if (isActive(item)) {
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

  // iOS: Use BlurView for glass effect with translucent overlay
  if (isIOS) {
    return (
      <View style={styles.outerContainer}>
        <BlurView 
          intensity={80} 
          tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterial'}
          style={containerStyle}
        >
          {/* Semi-transparent overlay for glass tint */}
          <View style={[
            StyleSheet.absoluteFill, 
            { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)' }
          ]} />
          {navContent}
        </BlurView>
      </View>
    );
  }

  // Android: Solid background with subtle elevation
  return (
    <View style={styles.outerContainer}>
      <View style={[containerStyle, styles.androidContainer]}>
        {navContent}
      </View>
    </View>
  );
}

export function getBottomNavHeight(bottomInset: number): number {
  return BOTTOM_NAV_HEIGHT + Math.max(bottomInset, 8);
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    overflow: 'hidden',
    // Subtle top border for definition
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  },
  androidContainer: {
    backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
    elevation: 8,
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
    borderRadius: 20,
    minWidth: 72,
  },
  // ServiceM8-style pill indicator for active state
  navButtonActive: {
    backgroundColor: isDark 
      ? `${colors.primary}20` 
      : `${colors.primary}12`,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
    letterSpacing: 0.1,
  },
  navLabelActive: {
    fontWeight: '600',
  },
});

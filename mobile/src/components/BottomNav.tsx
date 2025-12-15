import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../lib/theme';

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
    matchPaths: ['/profile', '/more', '/map', '/money', '/more/invoices', '/more/quotes', '/more/payments', '/more/payouts', '/collect']
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isActive = (item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
    }
    return pathname === item.path;
  };

  const handlePress = (path: string) => {
    router.push(path as any);
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.navBar}>
        {navItems.map((item) => (
          <NavButton
            key={item.title}
            item={item}
            active={isActive(item)}
            onPress={() => handlePress(item.path)}
            colors={colors}
            styles={styles}
          />
        ))}
      </View>
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
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
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

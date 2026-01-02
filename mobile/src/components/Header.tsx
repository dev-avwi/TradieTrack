import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Animated, Easing, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../lib/store';
import { useTheme, ThemeColors } from '../lib/theme';
import { useAdvancedThemeStore } from '../lib/advanced-theme-store';
import { useNotificationsStore } from '../lib/notifications-store';
import { useUserRole } from '../hooks/use-user-role';
import { HEADER_HEIGHT } from '../lib/design-tokens';
import { BackgroundLocationIndicator } from './BackgroundLocationIndicator';

const isIOS = Platform.OS === 'ios';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showBackButton?: boolean;
  showMenuButton?: boolean;
  showAvatar?: boolean;
  onBackPress?: () => void;
}

// Re-export for backward compatibility
export { HEADER_HEIGHT };

function HeaderIconButton({ 
  icon, 
  onPress, 
  color, 
  badge,
  colors,
}: { 
  icon: keyof typeof Feather.glyphMap; 
  onPress: () => void; 
  color: string;
  badge?: number;
  colors: ThemeColors;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.9,
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
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
          opacity,
        }}
      >
        <View style={{ position: 'relative' }}>
          <Feather name={icon} size={20} color={color} />
          {badge !== undefined && badge > 0 && (
            <View style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.destructive,
              borderWidth: 2,
              borderColor: colors.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>
                {badge > 9 ? '9+' : badge}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const getPageTitleFromPath = (pathname: string): string => {
  const path = pathname.replace(/^\/(tabs)\//, '/').replace(/^\(tabs\)\//, '/');
  
  if (path === '/' || path === '/index' || pathname.includes('(tabs)/index') || pathname === '/(tabs)') return 'Dashboard';
  if (path.startsWith('/jobs') || pathname.includes('(tabs)/jobs')) return 'Jobs';
  if (path.startsWith('/job/')) return 'Job Details';
  if (path.startsWith('/map') || pathname.includes('(tabs)/map')) return 'Map';
  if (path.startsWith('/money') || pathname.includes('(tabs)/money')) return 'Money';
  if (path.startsWith('/collect') || pathname.includes('(tabs)/collect')) return 'Collect Payment';
  if (path.startsWith('/profile') || pathname.includes('(tabs)/profile')) return 'Profile';
  if (pathname.includes('/more/chat-hub')) return 'Chat';
  if (pathname.includes('/more/team-chat')) return 'Team Chat';
  if (pathname.includes('/more/direct-messages')) return 'Messages';
  if (pathname.includes('/more/clients')) return 'Clients';
  if (pathname.includes('/more/client')) return 'Client';
  if (pathname.includes('/more/calendar')) return 'Schedule';
  if (pathname.includes('/more/reports')) return 'Reports';
  if (pathname.includes('/more/team-management')) return 'Team';
  if (pathname.includes('/more/team')) return 'Team';
  if (pathname.includes('/more/integrations')) return 'Integrations';
  if (pathname.includes('/more/business-settings') || pathname.includes('/more/app-settings')) return 'Settings';
  if (pathname.includes('/more/settings')) return 'Settings';
  if (pathname.includes('/more/invoices') || pathname.includes('/more/invoice')) return 'Invoices';
  if (pathname.includes('/more/quotes') || pathname.includes('/more/quote')) return 'Quotes';
  if (pathname.includes('/more/notifications')) return 'Notifications';
  if (pathname.includes('/more/search')) return 'Search';
  if (pathname.includes('/more/ai-assistant')) return 'AI Assistant';
  if (pathname.includes('/more/branding')) return 'Branding';
  if (pathname.includes('/more/money-hub')) return 'Money Hub';
  if (pathname.includes('/more/time-tracking')) return 'Time Tracking';
  if (pathname.includes('/more/automations')) return 'Automations';
  if (pathname.includes('/more/subscription')) return 'Subscription';
  return '';
};

export function Header({ 
  title,
  showSearch = true, 
  showBackButton = false,
  showMenuButton = true,
  showAvatar = true,
  onBackPress,
}: HeaderProps) {
  const { user, isOwner: isOwnerFromStore, roleInfo } = useAuthStore();
  const { colors, isDark, setThemeMode, themeMode } = useTheme();
  const advancedSetMode = useAdvancedThemeStore(state => state.setMode);
  const advancedMode = useAdvancedThemeStore(state => state.mode);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const { unreadCount } = useNotificationsStore();
  const pathname = usePathname();
  // Use useUserRole hook for consistent owner/manager detection (matches web behavior)
  // The hook has optimistic loading - returns 'owner'/'solo_owner' during loading if user is business owner
  const { canAccessMap, isLoading: roleLoading } = useUserRole();
  // Show map for users with VIEW_MAP permission (owners/managers have this by default)
  // Fallback: During loading only, also check cached auth store data
  const isManagerFromStore = roleInfo?.roleName === 'MANAGER' || roleInfo?.roleName === 'manager';
  const cachedCanViewMap = isOwnerFromStore() || isManagerFromStore;
  // Once role hook settles, use its result; during loading, allow cached fallback
  const canViewMap = canAccessMap || (roleLoading && cachedCanViewMap);
  
  const displayTitle = title || (!showMenuButton ? getPageTitleFromPath(pathname) : '');
  
  const avatarScale = useRef(new Animated.Value(1)).current;
  
  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    return 'U';
  };

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const toggleTheme = () => {
    // Use advanced theme mode as the source of truth, fallback to themeMode
    const currentMode = advancedMode || themeMode;
    let newMode: 'light' | 'dark' | 'system';
    
    if (currentMode === 'light') {
      newMode = 'dark';
    } else if (currentMode === 'dark') {
      newMode = 'system';
    } else {
      newMode = 'light';
    }
    
    // Update both theme systems to stay in sync
    setThemeMode(newMode);
    advancedSetMode(newMode);
  };

  const handleAvatarPressIn = () => {
    Animated.timing(avatarScale, {
      toValue: 0.9,
      duration: 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const handleAvatarPressOut = () => {
    Animated.spring(avatarScale, {
      toValue: 1,
      friction: 5,
      tension: 400,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.leftSection}>
          {showBackButton ? (
            <HeaderIconButton
              icon="arrow-left"
              onPress={handleBack}
              color={colors.foreground}
              colors={colors}
            />
          ) : showMenuButton ? (
            <View style={styles.brandContainer}>
              <Image 
                source={require('../../assets/tradietrack-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.brandName} numberOfLines={1}>TradieTrack</Text>
            </View>
          ) : null}
          
          {displayTitle && (showBackButton || !showMenuButton) && (
            <Text style={styles.pageTitleWithBack} numberOfLines={1}>{displayTitle}</Text>
          )}
        </View>

        <View style={styles.rightSection}>
          <BackgroundLocationIndicator compact showLabel={false} />
          
          {showSearch && (
            <HeaderIconButton
              icon="search"
              onPress={() => router.push('/more/search')}
              color={colors.mutedForeground}
              colors={colors}
            />
          )}
          
          {canViewMap && (
            <HeaderIconButton
              icon="map"
              onPress={() => router.push('/(tabs)/map')}
              color={pathname === '/map' || pathname === '/(tabs)/map' ? colors.primary : colors.mutedForeground}
              colors={colors}
            />
          )}
          
          <HeaderIconButton
            icon={isDark ? 'sun' : 'moon'}
            onPress={toggleTheme}
            color={colors.mutedForeground}
            colors={colors}
          />
          
          <HeaderIconButton
            icon="bell"
            onPress={() => router.push('/more/notifications-inbox')}
            color={colors.mutedForeground}
            badge={unreadCount}
            colors={colors}
          />
          
          {showAvatar && (
            <Pressable 
              onPress={() => router.push('/(tabs)/profile')}
              onPressIn={handleAvatarPressIn}
              onPressOut={handleAvatarPressOut}
            >
              <Animated.View 
                style={[
                  styles.avatarButton,
                  { transform: [{ scale: avatarScale }] }
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getUserInitials()}</Text>
                </View>
              </Animated.View>
            </Pressable>
          )}
        </View>
      </View>
      
      <View style={styles.headerBorder} />
    </View>
  );
}

const createStyles = (colors: ThemeColors, topInset: number) => StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    paddingTop: isIOS ? topInset : 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: HEADER_HEIGHT,
  },
  headerBorder: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brandName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  pageTitleWithBack: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    letterSpacing: -0.3,
    flex: 1,
  },
  avatarButton: {
    marginLeft: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});

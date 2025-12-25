import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Animated, Easing, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../lib/store';
import { useTheme, ThemeColors } from '../lib/theme';
import { useNotificationsStore } from '../lib/notifications-store';
import { HEADER_HEIGHT } from '../lib/design-tokens';

const isIOS = Platform.OS === 'ios';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showBackButton?: boolean;
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

export function Header({ 
  title,
  showSearch = true, 
  showBackButton = false,
  onBackPress,
}: HeaderProps) {
  const { user, isOwner, roleInfo } = useAuthStore();
  const { colors, isDark, setThemeMode, themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark, insets.top), [colors, isDark, insets.top]);
  const { unreadCount } = useNotificationsStore();
  const pathname = usePathname();
  const isManager = roleInfo?.roleName === 'MANAGER' || roleInfo?.roleName === 'manager';
  const canViewMap = isOwner() || isManager;
  
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
    if (themeMode === 'light') {
      setThemeMode('dark');
    } else if (themeMode === 'dark') {
      setThemeMode('system');
    } else {
      setThemeMode('light');
    }
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

  const headerContent = (
    <>
      <View style={styles.headerContent}>
        <View style={styles.leftSection}>
          {showBackButton ? (
            <HeaderIconButton
              icon="arrow-left"
              onPress={handleBack}
              color={colors.foreground}
              colors={colors}
            />
          ) : (
            <View style={styles.brandContainer}>
              <Image 
                source={require('../../assets/tradietrack-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.brandName} numberOfLines={1}>TradieTrack</Text>
            </View>
          )}
          
          {title && showBackButton && (
            <Text style={styles.pageTitleWithBack} numberOfLines={1}>{title}</Text>
          )}
        </View>

        <View style={styles.rightSection}>
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
        </View>
      </View>
      
      <View style={styles.headerBorder} />
    </>
  );

  // iOS: Use BlurView for Liquid Glass effect
  if (isIOS) {
    return (
      <BlurView 
        intensity={80} 
        tint={isDark ? 'dark' : 'light'}
        style={styles.header}
      >
        {headerContent}
      </BlurView>
    );
  }

  // Android: Solid background
  return (
    <View style={styles.header}>
      {headerContent}
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean, topInset: number) => StyleSheet.create({
  header: {
    // iOS: transparent background for blur effect, Android: solid background
    backgroundColor: isIOS ? 'transparent' : colors.background,
    paddingTop: isIOS ? topInset : 0,
    overflow: 'hidden',
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
    backgroundColor: isIOS 
      ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)')
      : colors.border,
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

import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
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

export { HEADER_HEIGHT };

export function Header({ 
  title,
  showSearch: _showSearch = true, 
  showBackButton = false,
  onBackPress,
}: HeaderProps) {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { unreadCount } = useNotificationsStore();
  
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

  const headerContent = (
    <View style={[styles.headerContent, { paddingTop: insets.top }]}>
      <View style={styles.leftSection}>
        {showBackButton && (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </Pressable>
        )}
        
        {title && (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        )}
      </View>

      <View style={styles.rightSection}>
        <Pressable 
          onPress={() => router.push('/more/notifications-inbox')}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.bellContainer}>
            <Feather name="bell" size={22} color={colors.foreground} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
        
        <Pressable 
          onPress={() => router.push('/(tabs)/profile')}
          style={({ pressed }) => [
            styles.avatarButton,
            pressed && styles.pressed,
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getUserInitials()}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  if (isIOS) {
    return (
      <View style={styles.header}>
        <BlurView 
          intensity={45} 
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {headerContent}
        <View style={styles.borderBottom} />
      </View>
    );
  }

  return (
    <View style={[styles.header, styles.androidBackground]}>
      {headerContent}
      <View style={styles.borderBottom} />
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  androidBackground: {
    backgroundColor: isDark 
      ? 'rgba(15, 15, 15, 0.85)' 
      : 'rgba(255, 255, 255, 0.85)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: HEADER_HEIGHT,
    minHeight: HEADER_HEIGHT,
  },
  borderBottom: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: isDark 
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(0, 0, 0, 0.1)',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  title: {
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
    fontWeight: '600',
    color: colors.primary,
  },
  pressed: {
    opacity: 0.6,
  },
});

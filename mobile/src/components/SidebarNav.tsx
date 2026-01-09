import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../lib/theme';
import { useAuthStore } from '../lib/store';
import { sidebarMainItems, sidebarSettingsItems, SidebarNavItem, isSidebarPathActive } from '../lib/navigation-config';
import { SIDEBAR_WIDTH } from '../lib/device';

interface SidebarNavItemButtonProps {
  item: SidebarNavItem;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
}

function SidebarNavItemButton({ item, active, onPress, colors }: SidebarNavItemButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        active && { backgroundColor: colors.primaryLight },
        pressed && { opacity: 0.7 },
      ]}
      data-testid={`sidebar-item-${item.id}`}
    >
      <View style={[styles.navItemIcon, active && { backgroundColor: 'transparent' }]}>
        <Feather 
          name={item.icon} 
          size={20}
          color={active ? colors.primary : colors.mutedForeground}
        />
      </View>
      <Text style={[
        styles.navItemLabel,
        { color: active ? colors.primary : colors.foreground },
        active && { fontWeight: '600' },
      ]}>
        {item.title}
      </Text>
    </Pressable>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, businessSettings } = useAuthStore();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = (item: SidebarNavItem) => {
    router.push(item.path as any);
  };

  const businessName = businessSettings?.businessName || 'TradieTrack';
  const logoUrl = businessSettings?.logoUrl;

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top }]}>
      <View style={themedStyles.header}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={themedStyles.logo} resizeMode="contain" />
        ) : (
          <View style={[themedStyles.logoPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={themedStyles.logoText}>{businessName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={themedStyles.businessName} numberOfLines={1}>{businessName}</Text>
      </View>

      <ScrollView style={themedStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={themedStyles.section}>
          {sidebarMainItems.map((item) => (
            <SidebarNavItemButton
              key={item.id}
              item={item}
              active={isSidebarPathActive(pathname, item)}
              onPress={() => handlePress(item)}
              colors={colors}
            />
          ))}
        </View>

        <View style={[themedStyles.divider, { backgroundColor: colors.border }]} />

        <View style={themedStyles.section}>
          <Text style={[themedStyles.sectionLabel, { color: colors.mutedForeground }]}>Settings</Text>
          {sidebarSettingsItems.map((item) => (
            <SidebarNavItemButton
              key={item.id}
              item={item}
              active={isSidebarPathActive(pathname, item)}
              onPress={() => handlePress(item)}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[themedStyles.footer, { borderTopColor: colors.border }]}>
        <Pressable 
          style={themedStyles.userInfo}
          onPress={() => router.push('/profile' as any)}
          data-testid="sidebar-user-profile"
        >
          <View style={[themedStyles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={themedStyles.avatarText}>
              {user?.firstName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={themedStyles.userDetails}>
            <Text style={[themedStyles.userName, { color: colors.foreground }]} numberOfLines={1}>
              {user?.firstName || user?.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={[themedStyles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export function getSidebarWidth(): number {
  return SIDEBAR_WIDTH;
}

const styles = StyleSheet.create({
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  navItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  navItemLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 14,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  businessName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  footer: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
    marginTop: 3,
  },
});

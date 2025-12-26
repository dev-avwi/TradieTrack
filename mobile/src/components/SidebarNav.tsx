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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navItemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.card,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  businessName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
});

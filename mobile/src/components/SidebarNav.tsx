import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../lib/theme';
import { useAuthStore } from '../lib/store';
import { 
  getFilteredSidebarMainItems, 
  getFilteredSidebarSettingsItems, 
  sidebarMainItems,
  SidebarNavItem, 
  isSidebarPathActive,
  FilterOptions,
  UserRole
} from '../lib/navigation-config';
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
        styles.navItemPressable,
        active && { backgroundColor: colors.primaryLight },
        pressed && !active && { backgroundColor: colors.muted },
      ]}
      data-testid={`sidebar-item-${item.id}`}
    >
      {active && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
      <View style={styles.navItemRow}>
        <Feather 
          name={item.icon} 
          size={16}
          color={active ? colors.primary : colors.mutedForeground}
          style={styles.navItemIcon}
        />
        <Text style={[
          styles.navItemLabel,
          { color: active ? colors.primary : colors.foreground },
          active && { fontWeight: '600' },
        ]}>
          {item.title}
        </Text>
      </View>
    </Pressable>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, businessSettings, isInitialized, roleInfo } = useAuthStore();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = (item: SidebarNavItem) => {
    router.push(item.path as any);
  };

  const businessName = businessSettings?.businessName || 'TradieTrack';
  const logoUrl = businessSettings?.logoUrl;
  const initials = businessName
    .split(' ')
    .map((word: string) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Derive role from user.role OR roleInfo.roleId, normalizing values
  const rawRole = user?.role || roleInfo?.roleId || '';
  const normalizedRole = useMemo(() => {
    const r = rawRole.toLowerCase();
    if (r === 'team_member' || r === 'team') return 'team';
    if (r === 'staff_tradie' || r === 'staff') return 'staff';
    if (r === 'solo_owner') return 'solo_owner';
    if (r === 'owner') return 'owner';
    if (r === 'manager') return 'manager';
    // Fallback based on roleInfo.isOwner
    if (roleInfo?.isOwner) return 'owner';
    // Ultimate fallback: if user is authenticated but no role, treat as owner
    if (user?.id && !r) return 'owner';
    return r as UserRole;
  }, [rawRole, roleInfo?.isOwner, user?.id]);
  
  const userRole = (normalizedRole || 'owner') as UserRole;
  const isOwner = userRole === 'owner' || userRole === 'solo_owner' || roleInfo?.isOwner;
  const isManager = userRole === 'manager';
  const isStaffTradie = userRole === 'staff_tradie' || userRole === 'staff' || userRole === 'team';
  
  const filterOptions: FilterOptions = useMemo(() => ({
    isTeam: Boolean((businessSettings as any)?.hasTeam),
    isTradie: isStaffTradie,
    isOwner: Boolean(isOwner),
    isManager: isManager,
    isSolo: userRole === 'solo_owner',
    userRole: userRole,
  }), [userRole, isOwner, isManager, isStaffTradie, businessSettings]);

  // User is ready when initialized and has either role data or is authenticated
  const isReady = isInitialized && (user?.id || roleInfo);
  
  const filteredMainItems = useMemo(() => {
    if (!isReady) {
      return [];
    }
    return getFilteredSidebarMainItems(filterOptions);
  }, [filterOptions, isReady]);
  
  const filteredSettingsItems = useMemo(() => {
    if (!isReady) {
      return [];
    }
    return getFilteredSidebarSettingsItems(filterOptions);
  }, [filterOptions, isReady]);
  
  const isLoading = !isReady;

  return (
    <View style={themedStyles.container}>
      {/* Safe area spacer at top */}
      <View style={{ height: insets.top, backgroundColor: colors.card }} />
      
      {/* Sidebar Header - Logo and Business Name */}
      <View style={themedStyles.headerSection}>
        <Pressable 
          style={({ pressed }) => [
            themedStyles.header,
            pressed && { opacity: 0.7 }
          ]}
          onPress={() => router.push('/more/settings' as any)}
          data-testid="sidebar-header-settings"
        >
          <View style={themedStyles.logoContainer}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={themedStyles.logo} resizeMode="cover" />
            ) : (
              <View style={[themedStyles.logoPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={themedStyles.logoText}>{initials || businessName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={themedStyles.headerTextContainer}>
            <Text 
              style={[themedStyles.businessName, { color: colors.foreground }]} 
              numberOfLines={1} 
              ellipsizeMode="tail"
            >
              {businessName || 'TradieTrack'}
            </Text>
            <Text style={[themedStyles.businessTagline, { color: colors.mutedForeground }]}>
              My Account
            </Text>
          </View>
        </Pressable>
      </View>

      <ScrollView 
        style={themedStyles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={themedStyles.scrollContent}
      >
        <View style={themedStyles.section}>
          <Text style={[themedStyles.sectionLabel, { color: colors.mutedForeground }]}>
            Main Menu
          </Text>
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <View key={i} style={[styles.navItemPressable, { marginBottom: 2 }]}>
                  <View style={[styles.navItemRow, { opacity: 0.4 }]}>
                    <View style={{ width: 16, height: 16, backgroundColor: colors.muted, borderRadius: 4, marginRight: 10 }} />
                    <View style={{ flex: 1, height: 14, backgroundColor: colors.muted, borderRadius: 4 }} />
                  </View>
                </View>
              ))}
            </>
          ) : (
            filteredMainItems.map((item) => (
              <SidebarNavItemButton
                key={item.id}
                item={item}
                active={isSidebarPathActive(pathname, item)}
                onPress={() => handlePress(item)}
                colors={colors}
              />
            ))
          )}
        </View>

        {!isLoading && filteredSettingsItems.length > 0 && (
          <View style={themedStyles.section}>
            <Text style={[themedStyles.sectionLabel, { color: colors.mutedForeground }]}>
              Settings
            </Text>
            {filteredSettingsItems.map((item) => (
              <SidebarNavItemButton
                key={item.id}
                item={item}
                active={isSidebarPathActive(pathname, item)}
                onPress={() => handlePress(item)}
                colors={colors}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[themedStyles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(12, insets.bottom) }]}>
        <Pressable 
          style={({ pressed }) => [
            themedStyles.logoutButton,
            pressed && { opacity: 0.7 }
          ]}
          onPress={() => {
            useAuthStore.getState().logout();
            router.replace('/');
          }}
          data-testid="sidebar-logout"
        >
          <Feather name="log-out" size={16} color={colors.mutedForeground} />
          <Text style={[themedStyles.logoutText, { color: colors.mutedForeground }]}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function getSidebarWidth(): number {
  return SIDEBAR_WIDTH;
}

const styles = StyleSheet.create({
  navItemPressable: {
    borderRadius: 6,
    marginBottom: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 2,
  },
  navItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: '100%',
  },
  navItemIcon: {
    marginRight: 10,
    width: 16,
    height: 16,
  },
  navItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    flexGrow: 0,
    flexShrink: 0,
  },
  headerSection: {
    height: 80,
    minHeight: 80,
    flexShrink: 0,
    flexGrow: 0,
    zIndex: 100,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  businessName: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  businessTagline: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  scrollView: {
    flex: 1,
    flexGrow: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 56,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    flexShrink: 0,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  planText: {
    fontSize: 11,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

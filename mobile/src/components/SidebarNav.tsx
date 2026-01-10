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
  const { user, businessSettings, isInitialized } = useAuthStore();
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

  const userRole = user?.role as UserRole | undefined;
  const isOwner = userRole === 'owner' || userRole === 'solo_owner';
  const isManager = userRole === 'manager';
  const isStaffTradie = userRole === 'staff_tradie' || userRole === 'staff' || userRole === 'team';
  
  const filterOptions: FilterOptions = useMemo(() => ({
    isTeam: Boolean(businessSettings?.hasTeam),
    isTradie: isStaffTradie,
    isOwner: isOwner,
    isManager: isManager,
    isSolo: userRole === 'solo_owner',
    userRole: userRole,
  }), [userRole, isOwner, isManager, isStaffTradie, businessSettings?.hasTeam]);

  const filteredMainItems = useMemo(() => {
    if (!isInitialized || !userRole) {
      return [];
    }
    return getFilteredSidebarMainItems(filterOptions);
  }, [filterOptions, userRole, isInitialized]);
  
  const filteredSettingsItems = useMemo(() => {
    if (!isInitialized || !userRole) {
      return [];
    }
    return getFilteredSidebarSettingsItems(filterOptions);
  }, [filterOptions, userRole, isInitialized]);
  
  const isLoading = !isInitialized || !userRole;

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
        <Text style={[themedStyles.businessName, { color: colors.foreground }]} numberOfLines={1}>
          {businessName}
        </Text>
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

      <View style={[themedStyles.footer, { borderTopColor: colors.border }]}>
        <Pressable 
          style={[themedStyles.userCard, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}
          onPress={() => router.push('/profile' as any)}
          data-testid="sidebar-user-profile"
        >
          <View style={[themedStyles.avatar, { backgroundColor: colors.primary }]}>
            {businessSettings?.logoUrl ? (
              <Image 
                source={{ uri: businessSettings.logoUrl }} 
                style={themedStyles.avatarImage} 
                resizeMode="cover" 
              />
            ) : (
              <Text style={themedStyles.avatarText}>{initials || 'U'}</Text>
            )}
          </View>
          <View style={themedStyles.userDetails}>
            <View style={themedStyles.userNameRow}>
              <Text style={[themedStyles.userName, { color: colors.foreground }]} numberOfLines={1}>
                {businessName}
              </Text>
              <View style={[themedStyles.roleBadge, { borderColor: colors.border }]}>
                <Text style={[themedStyles.roleBadgeText, { color: colors.mutedForeground }]}>
                  {isOwner ? 'Owner' : user?.role || 'Team'}
                </Text>
              </View>
            </View>
            <Text style={[themedStyles.planText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {(businessSettings as any)?.subscriptionTier === 'team' ? 'Team Plan' : 
               (businessSettings as any)?.subscriptionTier === 'pro' ? 'Pro Plan' : 
               (businessSettings as any)?.subscriptionTier === 'trial' ? 'Trial' : 'Free Plan'}
            </Text>
          </View>
        </Pressable>
        
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
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    flexGrow: 0,
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 10,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  businessName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
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
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
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
    marginTop: 8,
    gap: 10,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

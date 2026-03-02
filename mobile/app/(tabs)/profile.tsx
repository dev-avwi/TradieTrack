import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useUserRole, type UserRoleType } from '../../src/hooks/use-user-role';
import { spacing, radius, shadows, typography, iconSizes, sizes, usePageShell } from '../../src/lib/design-tokens';
import { 
  getMorePageItemsByCategory, 
  categoryOrder,
  type NavItem,
  type FilterOptions,
  type UserRole,
} from '../../src/lib/navigation-config';
import { useScrollToTop } from '../../src/contexts/ScrollContext';

const categoryMeta: Record<string, { icon: keyof typeof Feather.glyphMap; label: string; colorKey: string }> = {
  featured: { icon: 'star', label: 'Featured', colorKey: 'warning' },
  work: { icon: 'briefcase', label: 'Work', colorKey: 'primary' },
  money: { icon: 'dollar-sign', label: 'Money', colorKey: 'success' },
  team: { icon: 'users', label: 'Team', colorKey: 'info' },
  communication: { icon: 'message-circle', label: 'Comms', colorKey: 'info' },
  settings: { icon: 'settings', label: 'Settings', colorKey: 'muted' },
  legal: { icon: 'shield', label: 'Legal', colorKey: 'muted' },
  account: { icon: 'user', label: 'Account', colorKey: 'muted' },
  admin: { icon: 'shield', label: 'Admin', colorKey: 'destructive' },
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 80,
    ...shadows.sm,
  },
  avatar: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: sizes.avatarLg / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  avatarText: {
    ...typography.subtitle,
    color: colors.primary,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  userEmail: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  businessName: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.primary,
  },
  quickActionsContainer: {
    marginBottom: spacing.lg,
  },
  quickActionsLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },
  categoryTabsContainer: {
    marginBottom: spacing.md,
  },
  categoryTabsScroll: {
    marginBottom: spacing.xs,
  },
  categoryTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  categoryTabTextActive: {
    color: colors.primaryForeground || '#fff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  sectionHeaderIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  sectionCount: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginLeft: 'auto' as any,
    paddingRight: spacing.xs,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  featuredSection: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    minHeight: 52,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuItemTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  menuItemSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    ...typography.badge,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  versionText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  itemCount: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    paddingLeft: spacing.xs,
    marginBottom: spacing.sm,
  },
});

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  isLast?: boolean;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
}

function MenuItem({ 
  icon, 
  iconBg,
  iconColor,
  title, 
  subtitle, 
  onPress, 
  destructive = false, 
  isLast = false, 
  badge,
  badgeBg,
  badgeColor,
}: MenuItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const effectiveIconBg = iconBg || colors.primaryLight;
  const effectiveIconColor = iconColor || colors.primary;
  const effectiveBadgeBg = badgeBg || colors.successLight;
  const effectiveBadgeColor = badgeColor || colors.success;
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.menuItem,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
      ]}
    >
      <View style={[styles.menuItemIcon, { backgroundColor: effectiveIconBg }]}>
        <Feather name={icon} size={iconSizes.lg} color={effectiveIconColor} />
      </View>
      <View style={styles.menuItemContent}>
        <View style={styles.menuItemTitleRow}>
          <Text style={[
            styles.menuItemTitle, 
            destructive && { color: colors.destructive }
          ]}>
            {title}
          </Text>
          {badge && (
            <View style={[styles.badge, { backgroundColor: effectiveBadgeBg }]}>
              <Text style={[styles.badgeText, { color: effectiveBadgeColor }]}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text style={styles.menuItemSubtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      <Feather 
        name="chevron-right" 
        size={iconSizes.lg} 
        color={destructive ? colors.destructive : colors.mutedForeground} 
      />
    </TouchableOpacity>
  );
}

function getColorValues(colorKey: string | undefined, colors: ThemeColors): { bg: string; fg: string } {
  switch (colorKey) {
    case 'primary':
      return { bg: colors.primaryLight, fg: colors.primary };
    case 'success':
      return { bg: colors.successLight, fg: colors.success };
    case 'warning':
      return { bg: colors.warningLight, fg: colors.warning };
    case 'info':
      return { bg: colors.infoLight, fg: colors.info };
    case 'muted':
      return { bg: colors.muted, fg: colors.mutedForeground };
    case 'destructive':
      return { bg: colors.destructiveLight, fg: colors.destructive };
    default:
      return { bg: colors.primaryLight, fg: colors.primary };
  }
}

function getBadgeColors(colorKey: string | undefined, colors: ThemeColors): { bg: string; fg: string } {
  switch (colorKey) {
    case 'warning':
      return { bg: colors.warningLight, fg: colors.warning };
    case 'success':
      return { bg: colors.successLight, fg: colors.success };
    case 'destructive':
      return { bg: colors.destructiveLight, fg: colors.destructive };
    case 'info':
      return { bg: colors.infoLight, fg: colors.info };
    default:
      return { bg: colors.successLight, fg: colors.success };
  }
}

function mapRoleToFilterRole(role: UserRoleType): UserRole {
  if (role === 'staff') return 'staff_tradie';
  if (role === 'loading') return 'staff_tradie';
  return role as UserRole;
}

export default function MoreScreen() {
  const { user, businessSettings, logout } = useAuthStore();
  const { colors } = useTheme();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);
  
  const { 
    role,
    isStaff, 
    isSolo,
    hasTeamAccess,
    canAccessTeamPages,
    hasTeamSubscription,
    isOwner,
    isManager,
    canAccessBilling,
  } = useUserRole();

  const filterOptions: FilterOptions = useMemo(() => ({
    isTeam: canAccessTeamPages && !isSolo,
    isTradie: isStaff,
    isOwner,
    isManager,
    isSolo,
    userRole: mapRoleToFilterRole(role),
    isPlatformAdmin: user?.isPlatformAdmin || false,
  }), [canAccessTeamPages, isSolo, isStaff, isOwner, isManager, role, user?.isPlatformAdmin]);

  const categorizedItems = useMemo(() => 
    getMorePageItemsByCategory(filterOptions), 
    [filterOptions]
  );

  const visibleCategories = useMemo(() => {
    const cats: string[] = [];
    for (const key of categoryOrder) {
      const items = categorizedItems[key] || [];
      if (items.length > 0) {
        cats.push(key);
      }
    }
    return cats;
  }, [categorizedItems]);

  const allItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const key of categoryOrder) {
      const catItems = categorizedItems[key] || [];
      items.push(...catItems);
    }
    return items;
  }, [categorizedItems]);

  const filteredCategories = useMemo(() => {
    if (activeCategory === 'all') return visibleCategories;
    return visibleCategories.filter(k => k === activeCategory);
  }, [activeCategory, visibleCategories]);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const getInitials = () => {
    const first = user?.firstName?.[0] || '';
    const last = user?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'T';
  };

  const handleNavItemPress = (item: NavItem) => {
    router.push(item.url as any);
  };

  const quickActions = useMemo(() => {
    if (isStaff) return [];
    const actions: { icon: keyof typeof Feather.glyphMap; label: string; route: string; bg: string; fg: string }[] = [];
    actions.push({ icon: 'plus-circle', label: 'New Job', route: '/more/create-job', bg: colors.primaryLight, fg: colors.primary });
    actions.push({ icon: 'file-text', label: 'Invoice', route: '/more/invoices', bg: colors.successLight, fg: colors.success });
    actions.push({ icon: 'clock', label: 'Time', route: '/more/time-tracking', bg: colors.infoLight, fg: colors.info });
    return actions;
  }, [isStaff, colors]);

  const renderSectionHeader = (categoryKey: string) => {
    if (activeCategory !== 'all') return null;
    const meta = categoryMeta[categoryKey];
    if (!meta || !meta.label) return null;
    const colorVals = getColorValues(meta.colorKey, colors);
    const itemCount = (categorizedItems[categoryKey] || []).length;
    
    return (
      <View style={styles.sectionHeaderRow}>
        <View style={[styles.sectionHeaderIcon, { backgroundColor: colorVals.bg }]}>
          <Feather name={meta.icon} size={13} color={colorVals.fg} />
        </View>
        <Text style={styles.sectionTitle}>{meta.label}</Text>
        <Text style={styles.sectionCount}>{itemCount}</Text>
      </View>
    );
  };

  const renderSection = (categoryKey: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    
    const isFeatured = categoryKey === 'featured';
    
    return (
      <View key={categoryKey}>
        {renderSectionHeader(categoryKey)}
        <View style={[styles.section, isFeatured && styles.featuredSection]}>
          {items.map((item, index) => {
            const colorValues = getColorValues(item.color, colors);
            const badgeColorValues = getBadgeColors(item.color, colors);
            const isLast = index === items.length - 1;
            
            return (
              <MenuItem
                key={item.url}
                icon={item.icon}
                iconBg={colorValues.bg}
                iconColor={colorValues.fg}
                title={item.title}
                subtitle={item.description}
                badge={item.badge}
                badgeBg={badgeColorValues.bg}
                badgeColor={badgeColorValues.fg}
                onPress={() => handleNavItemPress(item)}
                isLast={isLast}
              />
            );
          })}
        </View>
      </View>
    );
  };

  const responsiveContentStyle = useMemo(() => ({
    padding: responsiveShell.paddingHorizontal,
  }), [responsiveShell]);

  const totalItemCount = allItems.length;

  return (
    <ScrollView 
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={responsiveContentStyle}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity 
        style={styles.profileHeader}
        activeOpacity={0.8}
        onPress={() => router.push('/more/profile-edit')}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {businessSettings?.businessName && (
            <View style={styles.businessRow}>
              <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
              <Text style={styles.businessName}>{businessSettings.businessName}</Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={iconSizes.xl} color={colors.mutedForeground} />
      </TouchableOpacity>

      {quickActions.length > 0 && (
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsLabel}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.route}
                style={styles.quickActionBtn}
                activeOpacity={0.7}
                onPress={() => router.push(action.route as any)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.bg }]}>
                  <Feather name={action.icon} size={iconSizes.lg} color={action.fg} />
                </View>
                <Text style={styles.quickActionText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.categoryTabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabsScroll}
        >
          <View style={styles.categoryTabsRow}>
            <TouchableOpacity
              style={[styles.categoryTab, activeCategory === 'all' && styles.categoryTabActive]}
              activeOpacity={0.7}
              onPress={() => setActiveCategory('all')}
            >
              <Text style={[styles.categoryTabText, activeCategory === 'all' && styles.categoryTabTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {visibleCategories.map(catKey => {
              const meta = categoryMeta[catKey];
              if (!meta) return null;
              const isActive = activeCategory === catKey;
              return (
                <TouchableOpacity
                  key={catKey}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                  activeOpacity={0.7}
                  onPress={() => setActiveCategory(catKey)}
                >
                  <Feather 
                    name={meta.icon} 
                    size={14} 
                    color={isActive ? (colors.primaryForeground || '#fff') : colors.mutedForeground} 
                  />
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        {activeCategory === 'all' && (
          <Text style={styles.itemCount}>{totalItemCount} features available</Text>
        )}
        {activeCategory !== 'all' && (
          <Text style={styles.itemCount}>
            {(categorizedItems[activeCategory] || []).length} items in {categoryMeta[activeCategory]?.label || activeCategory}
          </Text>
        )}
      </View>

      {filteredCategories.filter(k => k !== 'account').map(categoryKey => 
        renderSection(categoryKey, categorizedItems[categoryKey] || [])
      )}

      {(activeCategory === 'all' || activeCategory === 'account') && (
        <>
          {activeCategory === 'all' && renderSectionHeader('account')}
          <View style={styles.section}>
            {(categorizedItems.account || []).map((item, index) => {
              const colorValues = getColorValues(item.color, colors);
              const badgeColorValues = getBadgeColors(item.color, colors);
              return (
                <MenuItem
                  key={item.url}
                  icon={item.icon}
                  iconBg={colorValues.bg}
                  iconColor={colorValues.fg}
                  title={item.title}
                  subtitle={item.description}
                  badge={item.badge}
                  badgeBg={badgeColorValues.bg}
                  badgeColor={badgeColorValues.fg}
                  onPress={() => handleNavItemPress(item)}
                />
              );
            })}
            <MenuItem
              icon="log-out"
              iconBg={colors.destructiveLight}
              iconColor={colors.destructive}
              title="Sign Out"
              onPress={handleLogout}
              destructive
              isLast
            />
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>JobRunner Mobile</Text>
        <Text style={styles.versionText}>Version 1.1.0</Text>
      </View>

      <View style={{ height: spacing['4xl'] }} />
    </ScrollView>
  );
}

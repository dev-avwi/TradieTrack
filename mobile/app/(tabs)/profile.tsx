import { useMemo, useRef, useEffect } from 'react';
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
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../src/lib/design-tokens';
import { 
  getMorePageItemsByCategory, 
  categoryLabels, 
  categoryOrder,
  type NavItem,
  type FilterOptions,
  type UserRole,
} from '../../src/lib/navigation-config';
import { useScrollToTop } from '../../src/contexts/ScrollContext';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
    borderWidth: 2,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    minHeight: 52,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
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
    marginTop: spacing.xs,
  },
  badge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  badgeText: {
    ...typography.badge,
    color: colors.success,
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
  badge 
}: MenuItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const effectiveIconBg = iconBg || colors.primaryLight;
  const effectiveIconColor = iconColor || colors.primary;
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.menuItem,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }
      ]}
    >
      <View style={[styles.menuItemIcon, { backgroundColor: effectiveIconBg }]}>
        <Feather name={icon} size={iconSizes.xl} color={effectiveIconColor} />
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
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text style={styles.menuItemSubtitle}>{subtitle}</Text>
        )}
      </View>
      <Feather 
        name="chevron-right" 
        size={iconSizes.xl} 
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
      return { bg: colors.muted, fg: colors.foreground };
    case 'destructive':
      return { bg: colors.destructiveLight, fg: colors.destructive };
    default:
      return { bg: colors.primaryLight, fg: colors.primary };
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();
  
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
    isOwner,
    isManager,
    canAccessBilling,
  } = useUserRole();

  const filterOptions: FilterOptions = useMemo(() => ({
    isTeam: hasTeamAccess && !isSolo,
    isTradie: isStaff,
    isOwner,
    isManager,
    isSolo,
    userRole: mapRoleToFilterRole(role),
    isPlatformAdmin: user?.isPlatformAdmin || false,
  }), [hasTeamAccess, isSolo, isStaff, isOwner, isManager, role, user?.isPlatformAdmin]);

  const categorizedItems = useMemo(() => 
    getMorePageItemsByCategory(filterOptions), 
    [filterOptions]
  );

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

  const renderSection = (categoryKey: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    
    const label = categoryLabels[categoryKey];
    const isFeatured = categoryKey === 'featured';
    
    return (
      <View key={categoryKey}>
        {label && <Text style={styles.sectionTitle}>{label}</Text>}
        <View style={[styles.section, isFeatured && styles.featuredSection]}>
          {items.map((item, index) => {
            const colorValues = getColorValues(item.color, colors);
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
                onPress={() => handleNavItemPress(item)}
                isLast={isLast}
              />
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView 
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
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

      {/* Render all categories in order (except account which has special handling) */}
      {categoryOrder.filter(k => k !== 'account').map(categoryKey => 
        renderSection(categoryKey, categorizedItems[categoryKey] || [])
      )}

      {/* Account Section - special handling for sign out */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.section}>
        {(categorizedItems.account || []).map((item, index) => {
          const colorValues = getColorValues(item.color, colors);
          return (
            <MenuItem
              key={item.url}
              icon={item.icon}
              iconBg={colorValues.bg}
              iconColor={colorValues.fg}
              title={item.title}
              subtitle={item.description}
              badge={item.badge}
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

      {/* App Version */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>TradieTrack Mobile</Text>
        <Text style={styles.versionText}>Version 1.0.0 (Beta)</Text>
      </View>

      {/* Bottom Spacing */}
      <View style={{ height: spacing['4xl'] }} />
    </ScrollView>
  );
}

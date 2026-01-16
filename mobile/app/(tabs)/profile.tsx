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
import { isIOS } from '../../src/lib/device';
import { useIOSStyles, IOSCorners, IOSShadows, IOSSystemColors } from '../../src/lib/ios-design';
import { 
  getMorePageItemsByCategory, 
  categoryLabels, 
  categoryOrder,
  type NavItem,
  type FilterOptions,
  type UserRole,
} from '../../src/lib/navigation-config';
import { useScrollToTop } from '../../src/contexts/ScrollContext';
import { LiquidGlassScrollView } from '../../src/components/ui/LiquidGlassScrollView';
import { GlassSection } from '../../src/components/ui/GlassSection';
import { GlassListItem } from '../../src/components/ui/GlassListItem';

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
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 80,
    ...shadows.sm,
  },
  profileHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    minHeight: 80,
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
    marginBottom: spacing['2xl'],
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
    marginTop: spacing['2xl'],
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
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  const { colors, isDark } = useTheme();
  const iosStyles = useIOSStyles(isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const effectiveIconBg = iconBg || colors.primaryLight;
  const effectiveIconColor = iconColor || colors.primary;
  
  const separatorStyle = isIOS
    ? { borderBottomColor: iosStyles.colors.separator }
    : { borderBottomColor: colors.border };
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.menuItem,
        isIOS && { minHeight: 44, paddingVertical: 11 },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, ...separatorStyle }
      ]}
    >
      <View style={[styles.menuItemIcon, { backgroundColor: effectiveIconBg }]}>
        <Feather name={icon} size={iconSizes.xl} color={effectiveIconColor} />
      </View>
      <View style={styles.menuItemContent}>
        <View style={styles.menuItemTitleRow}>
          <Text style={[
            styles.menuItemTitle, 
            isIOS && { color: iosStyles.colors.label },
            destructive && { color: isIOS ? IOSSystemColors.systemRed : colors.destructive }
          ]}>
            {title}
          </Text>
          {badge && (
            <View style={[styles.badge, isIOS && { borderRadius: IOSCorners.pill }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text style={[styles.menuItemSubtitle, isIOS && { color: iosStyles.colors.secondaryLabel }]}>{subtitle}</Text>
        )}
      </View>
      <Feather 
        name="chevron-right" 
        size={iconSizes.xl} 
        color={destructive ? (isIOS ? IOSSystemColors.systemRed : colors.destructive) : (isIOS ? iosStyles.colors.tertiaryLabel : colors.mutedForeground)} 
      />
    </TouchableOpacity>
  );
}

interface IconWrapperProps {
  icon: keyof typeof Feather.glyphMap;
  bgColor: string;
  iconColor: string;
}

function IconWrapper({ icon, bgColor, iconColor }: IconWrapperProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={[styles.iconWrapper, { backgroundColor: bgColor }]}>
      <Feather name={icon} size={18} color={iconColor} />
    </View>
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
  const { colors, isDark } = useTheme();
  const iosStyles = useIOSStyles(isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();
  
  const containerStyle = isIOS 
    ? { backgroundColor: 'transparent' }
    : { backgroundColor: colors.background };
  
  const sectionStyle = isIOS 
    ? {
        backgroundColor: iosStyles.colors.secondarySystemGroupedBackground,
        borderRadius: IOSCorners.card,
        borderWidth: 0,
        ...IOSShadows.card,
      }
    : {
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadows.sm,
      };
  
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

  const renderGlassSection = (categoryKey: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    
    const label = categoryLabels[categoryKey];
    
    return (
      <GlassSection key={categoryKey} title={label} padding="none">
        {items.map((item, index) => {
          const colorValues = getColorValues(item.color, colors);
          const isFirst = index === 0;
          const isLast = index === items.length - 1;
          const badgeNumber = item.badge ? parseInt(item.badge, 10) : undefined;
          
          return (
            <GlassListItem
              key={item.url}
              title={item.title}
              subtitle={item.description}
              leftIcon={
                <IconWrapper 
                  icon={item.icon} 
                  bgColor={colorValues.bg} 
                  iconColor={colorValues.fg} 
                />
              }
              onPress={() => handleNavItemPress(item)}
              isFirst={isFirst}
              isLast={isLast}
              badge={badgeNumber}
            />
          );
        })}
      </GlassSection>
    );
  };

  const renderSection = (categoryKey: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    
    if (isIOS) {
      return renderGlassSection(categoryKey, items);
    }
    
    const label = categoryLabels[categoryKey];
    const isFeatured = categoryKey === 'featured';
    
    return (
      <View key={categoryKey}>
        {label && <Text style={styles.sectionTitle}>{label}</Text>}
        <View style={[styles.section, sectionStyle, isFeatured && styles.featuredSection]}>
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

  const renderAccountSection = () => {
    const accountItems = categorizedItems.account || [];
    const totalItems = accountItems.length + 1;
    
    if (isIOS) {
      return (
        <GlassSection title="Account" padding="none">
          {accountItems.map((item, index) => {
            const colorValues = getColorValues(item.color, colors);
            const isFirst = index === 0;
            const badgeNumber = item.badge ? parseInt(item.badge, 10) : undefined;
            
            return (
              <GlassListItem
                key={item.url}
                title={item.title}
                subtitle={item.description}
                leftIcon={
                  <IconWrapper 
                    icon={item.icon} 
                    bgColor={colorValues.bg} 
                    iconColor={colorValues.fg} 
                  />
                }
                onPress={() => handleNavItemPress(item)}
                isFirst={isFirst}
                isLast={false}
                badge={badgeNumber}
              />
            );
          })}
          <GlassListItem
            title="Sign Out"
            leftIcon={
              <IconWrapper 
                icon="log-out" 
                bgColor={colors.destructiveLight} 
                iconColor={colors.destructive} 
              />
            }
            onPress={handleLogout}
            destructive
            isFirst={accountItems.length === 0}
            isLast={true}
          />
        </GlassSection>
      );
    }
    
    return (
      <>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={[styles.section, sectionStyle]}>
          {accountItems.map((item, index) => {
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
      </>
    );
  };

  const renderProfileHeader = () => {
    if (isIOS) {
      return (
        <GlassSection padding="none" style={{ marginBottom: spacing.lg }}>
          <TouchableOpacity 
            style={styles.profileHeaderContent}
            activeOpacity={0.8}
            onPress={() => router.push('/more/profile-edit')}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { color: iosStyles.colors.label }]}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={[styles.userEmail, { color: iosStyles.colors.secondaryLabel }]}>{user?.email}</Text>
              {businessSettings?.businessName && (
                <View style={styles.businessRow}>
                  <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
                  <Text style={styles.businessName}>{businessSettings.businessName}</Text>
                </View>
              )}
            </View>
            <Feather name="chevron-right" size={iconSizes.xl} color={iosStyles.colors.tertiaryLabel} />
          </TouchableOpacity>
        </GlassSection>
      );
    }
    
    return (
      <TouchableOpacity 
        style={[styles.profileHeader, sectionStyle]}
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
    );
  };

  return (
    <LiquidGlassScrollView 
      ref={scrollRef}
      style={[styles.container, isIOS && containerStyle]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      hasTabBar={true}
      hasHeader={true}
      showBackground={true}
    >
      {renderProfileHeader()}

      {categoryOrder.filter(k => k !== 'account').map(categoryKey => 
        renderSection(categoryKey, categorizedItems[categoryKey] || [])
      )}

      {renderAccountSection()}

      <View style={styles.footer}>
        <Text style={styles.footerText}>TradieTrack Mobile</Text>
        <Text style={styles.versionText}>Version 1.0.0 (Beta)</Text>
      </View>
    </LiquidGlassScrollView>
  );
}

import { useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useUserRole } from '../../src/hooks/use-user-role';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../src/lib/design-tokens';

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
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    marginBottom: 2,
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
    borderRadius: 12,
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
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
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
        size={iconSizes.lg} 
        color={destructive ? colors.destructive : colors.mutedForeground} 
      />
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const { user, businessSettings, logout } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { 
    isStaff, 
    isSolo,
    hasTeamAccess,
    canAccessClients, 
    canAccessQuotes, 
    canAccessInvoices, 
    canAccessTeamManagement,
    canAccessBilling,
    canAccessReports,
    canAccessDispatch,
    canAccessSettings,
    canManageTemplates,
    canCollectPayments,
  } = useUserRole();

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

  return (
    <ScrollView 
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
              <Feather name="briefcase" size={iconSizes.sm} color={colors.primary} />
              <Text style={styles.businessName}>{businessSettings.businessName}</Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* AI Assistant - Featured */}
      <View style={[styles.section, styles.featuredSection]}>
        <MenuItem
          icon="star"
          iconBg={colors.primaryLight}
          iconColor={colors.primary}
          title="AI Assistant"
          subtitle="Get smart business suggestions"
          badge="New"
          onPress={() => router.push('/more/ai-assistant')}
          isLast
        />
      </View>

      {/* Work Section - matches web sidebar "Work" group */}
      <Text style={styles.sectionTitle}>Work</Text>
      <View style={styles.section}>
        {canAccessClients && (
          <MenuItem
            icon="users"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            title="Clients"
            subtitle="Manage your customers"
            onPress={() => router.push('/more/clients')}
          />
        )}
        <MenuItem
          icon="calendar"
          iconBg={colors.warningLight}
          iconColor={colors.warning}
          title="Schedule"
          subtitle="Calendar and appointments"
          onPress={() => router.push('/more/calendar')}
        />
        <MenuItem
          icon="clock"
          iconBg={colors.muted}
          iconColor={colors.foreground}
          title="Time Tracking"
          subtitle="Track work hours and timesheets"
          onPress={() => router.push('/more/time-tracking')}
        />
        {canManageTemplates && (
          <MenuItem
            icon="clipboard"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            title="Custom Forms"
            subtitle="Create form templates for jobs"
            badge="Popular"
            onPress={() => router.push('/more/custom-forms')}
          />
        )}
        {canAccessReports && (
          <MenuItem
            icon="bar-chart-2"
            iconBg={colors.successLight}
            iconColor={colors.success}
            title="Reports"
            subtitle="Business analytics and insights"
            onPress={() => router.push('/more/reports')}
            isLast={!isStaff}
          />
        )}
        {isStaff && (
          <MenuItem
            icon="clock"
            iconBg={colors.muted}
            iconColor={colors.foreground}
            title="My Timesheets"
            subtitle="View your work hours"
            onPress={() => router.push('/more/time-tracking')}
            isLast
          />
        )}
      </View>

      {/* Money Hub Section - matches web sidebar "Payment Hub" */}
      {!isStaff && (
        <>
          <Text style={styles.sectionTitle}>Money Hub</Text>
          <View style={styles.section}>
            <MenuItem
              icon="dollar-sign"
              iconBg={colors.successLight}
              iconColor={colors.success}
              title="Payment Hub"
              subtitle="Track all payments in one place"
              onPress={() => router.push('/more/payment-hub')}
            />
            {canAccessQuotes && (
              <MenuItem
                icon="file-text"
                iconBg={colors.infoLight}
                iconColor={colors.info}
                title="Quotes"
                subtitle="Create and manage quotes"
                onPress={() => router.push('/more/quotes')}
              />
            )}
            {canAccessInvoices && (
              <MenuItem
                icon="file-text"
                iconBg={colors.successLight}
                iconColor={colors.success}
                title="Invoices"
                subtitle="Send and track invoices"
                onPress={() => router.push('/more/invoices')}
              />
            )}
            {canCollectPayments && (
              <MenuItem
                icon="credit-card"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title="Collect Payment"
                subtitle="Tap to Pay, QR codes, links"
                onPress={() => router.push('/(tabs)/collect')}
              />
            )}
            {canAccessBilling && (
              <MenuItem
                icon="trending-up"
                iconBg={colors.successLight}
                iconColor={colors.success}
                title="Payouts"
                subtitle="Track earnings and transfers"
                onPress={() => router.push('/more/payouts')}
              />
            )}
            <MenuItem
              icon="file-minus"
              iconBg={colors.warningLight}
              iconColor={colors.warning}
              title="Expense Tracking"
              subtitle="Monitor business expenses"
              onPress={() => router.push('/more/expense-tracking')}
              isLast
            />
          </View>
        </>
      )}

      {/* Templates Section */}
      {canManageTemplates && (
        <>
          <Text style={styles.sectionTitle}>Templates</Text>
          <View style={styles.section}>
            <MenuItem
              icon="file"
              iconBg={colors.infoLight}
              iconColor={colors.info}
              title="Document Templates"
              subtitle="Quote and invoice templates"
              onPress={() => router.push('/more/templates')}
              isLast
            />
          </View>
        </>
      )}

      {/* Team Section - matches web sidebar Team & Automations */}
      {hasTeamAccess && !isSolo && (
        <>
          <Text style={styles.sectionTitle}>Team</Text>
          <View style={styles.section}>
            {canAccessTeamManagement && (
              <MenuItem
                icon="users"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title="Team Management"
                subtitle="Roles, permissions, and invites"
                onPress={() => router.push('/more/team-management')}
              />
            )}
            {canAccessDispatch && (
              <MenuItem
                icon="layout"
                iconBg={colors.infoLight}
                iconColor={colors.info}
                title="Dispatch Board"
                subtitle="Schedule and assign jobs"
                onPress={() => router.push('/more/dispatch-board')}
                isLast={isStaff}
              />
            )}
          </View>
        </>
      )}

      {/* Automations Section - matches web sidebar */}
      {!isStaff && (
        <>
          <Text style={styles.sectionTitle}>Automations</Text>
          <View style={styles.section}>
            <MenuItem
              icon="zap"
              iconBg={colors.warningLight}
              iconColor={colors.warning}
              title="Workflow Automations"
              subtitle="Set up automatic workflows"
              badge="New"
              onPress={() => router.push('/more/automations')}
              isLast
            />
          </View>
        </>
      )}

      {/* Communication Section */}
      <Text style={styles.sectionTitle}>Communication</Text>
      <View style={styles.section}>
        <MenuItem
          icon="message-circle"
          iconBg={colors.primaryLight}
          iconColor={colors.primary}
          title="Chat Hub"
          subtitle="All your conversations"
          onPress={() => router.push('/more/chat-hub')}
        />
        <MenuItem
          icon="users"
          iconBg={colors.infoLight}
          iconColor={colors.info}
          title="Team Chat"
          subtitle="Chat with your team"
          onPress={() => router.push('/more/team-chat')}
        />
        <MenuItem
          icon="send"
          iconBg={colors.successLight}
          iconColor={colors.success}
          title="Direct Messages"
          subtitle="Private conversations"
          onPress={() => router.push('/more/direct-messages')}
          isLast
        />
      </View>

      {/* Settings Section */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.section}>
        {canAccessSettings && (
          <MenuItem
            icon="briefcase"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            title="Business Settings"
            subtitle="Logo, ABN, and company details"
            onPress={() => router.push('/more/business-settings')}
          />
        )}
        {canAccessSettings && (
          <MenuItem
            icon="droplet"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            title="Branding"
            subtitle="Colors and visual identity"
            onPress={() => router.push('/more/branding')}
          />
        )}
        {canAccessBilling && (
          <MenuItem
            icon="dollar-sign"
            iconBg={colors.successLight}
            iconColor={colors.success}
            title="Payments"
            subtitle="Stripe connection status"
            onPress={() => router.push('/more/payments')}
          />
        )}
        {canAccessSettings && (
          <MenuItem
            icon="link"
            iconBg={colors.infoLight}
            iconColor={colors.info}
            title="Integrations"
            subtitle="Connect external services"
            onPress={() => router.push('/more/integrations')}
          />
        )}
        <MenuItem
          icon="bell"
          iconBg={colors.warningLight}
          iconColor={colors.warning}
          title="Notifications"
          subtitle="Push and email preferences"
          onPress={() => router.push('/more/notifications')}
        />
        <MenuItem
          icon="settings"
          iconBg={colors.muted}
          iconColor={colors.foreground}
          title="App Settings"
          subtitle="Theme and preferences"
          onPress={() => router.push('/more/app-settings')}
          isLast
        />
      </View>

      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.section}>
        {canAccessBilling && (
          <MenuItem
            icon="star"
            iconBg={colors.warningLight}
            iconColor={colors.warning}
            title="Subscription"
            subtitle="Free During Beta"
            badge="Beta"
            onPress={() => router.push('/more/subscription')}
          />
        )}
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

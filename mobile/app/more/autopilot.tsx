import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, usePageShell } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useContentWidth, isTablet } from '../../src/lib/device';

interface AutomationTrigger {
  type: string;
  entityType?: string;
  fromStatus?: string;
  toStatus?: string;
  delayDays?: number;
}

interface AutomationAction {
  type: string;
  template?: string;
  message?: string;
  newStatus?: string;
}

interface Automation {
  id: string;
  userId: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
}

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  category?: string;
}

type TabType = 'automations' | 'templates';

function getTriggerSummary(trigger: AutomationTrigger): string {
  if (!trigger) return 'No trigger configured';
  const parts: string[] = [];
  if (trigger.type) {
    parts.push(trigger.type.replace(/_/g, ' '));
  }
  if (trigger.entityType) {
    parts.push(`on ${trigger.entityType}`);
  }
  if (trigger.fromStatus && trigger.toStatus) {
    parts.push(`${trigger.fromStatus} → ${trigger.toStatus}`);
  } else if (trigger.toStatus) {
    parts.push(`→ ${trigger.toStatus}`);
  }
  if (trigger.delayDays) {
    parts.push(`after ${trigger.delayDays} day${trigger.delayDays > 1 ? 's' : ''}`);
  }
  return parts.length > 0 ? parts.join(' ') : 'Custom trigger';
}

function getActionSummary(actions: AutomationAction[]): string {
  if (!actions || actions.length === 0) return 'No actions';
  return actions.map(a => {
    if (a.type === 'send_email' || a.type === 'email') return 'Send email';
    if (a.type === 'send_sms' || a.type === 'sms') return 'Send SMS';
    if (a.type === 'update_status' || a.type === 'status_change') return `Set status to ${a.newStatus || 'new'}`;
    return a.type?.replace(/_/g, ' ') || 'Action';
  }).join(', ');
}

export default function AutopilotScreen() {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const isTabletDevice = isTablet();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);

  const [activeTab, setActiveTab] = useState<TabType>('automations');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [enablingIds, setEnablingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [automationsRes, templatesRes] = await Promise.all([
        api.get<Automation[]>('/api/automations'),
        api.get<AutomationTemplate[]>('/api/automation-templates'),
      ]);

      if (automationsRes.error) {
        setError(automationsRes.error);
      } else {
        setAutomations(automationsRes.data || []);
      }
      setTemplates(templatesRes.data || []);
    } catch (err) {
      setError('Failed to load automations');
      console.error('Error fetching automations:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleToggle = useCallback(async (automation: Automation) => {
    const newActive = !automation.isActive;
    setTogglingIds(prev => new Set(prev).add(automation.id));
    setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, isActive: newActive } : a));

    try {
      const res = await api.patch(`/api/automations/${automation.id}`, { isActive: newActive });
      if (res.error) {
        setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, isActive: automation.isActive } : a));
        Alert.alert('Error', res.error);
      }
    } catch {
      setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, isActive: automation.isActive } : a));
      Alert.alert('Error', 'Failed to update automation');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(automation.id);
        return next;
      });
    }
  }, []);

  const handleEnableTemplate = useCallback(async (template: AutomationTemplate) => {
    setEnablingIds(prev => new Set(prev).add(template.id));
    try {
      const res = await api.post(`/api/automation-templates/${template.id}/enable`);
      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        Alert.alert('Success', `"${template.name}" has been enabled`);
        fetchData();
      }
    } catch {
      Alert.alert('Error', 'Failed to enable template');
    } finally {
      setEnablingIds(prev => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  }, [fetchData]);

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'automations' && styles.activeTab]}
        onPress={() => setActiveTab('automations')}
        activeOpacity={0.7}
      >
        <Feather
          name="zap"
          size={iconSizes.md}
          color={activeTab === 'automations' ? colors.primary : colors.mutedForeground}
        />
        <Text style={[styles.tabText, activeTab === 'automations' && styles.activeTabText]}>
          My Automations
        </Text>
        <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.tabBadgeText}>{automations.length}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'templates' && styles.activeTab]}
        onPress={() => setActiveTab('templates')}
        activeOpacity={0.7}
      >
        <Feather
          name="copy"
          size={iconSizes.md}
          color={activeTab === 'templates' ? colors.primary : colors.mutedForeground}
        />
        <Text style={[styles.tabText, activeTab === 'templates' && styles.activeTabText]}>
          Templates
        </Text>
        <View style={[styles.tabBadge, { backgroundColor: '#6b7280' }]}>
          <Text style={styles.tabBadgeText}>{templates.length}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderAutomationCard = (automation: Automation) => (
    <View key={automation.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: automation.isActive ? '#22c55e' : '#6b7280' }]} />
          <Text style={styles.cardTitle} numberOfLines={1}>{automation.name}</Text>
        </View>
        <Switch
          value={automation.isActive}
          onValueChange={() => handleToggle(automation)}
          disabled={togglingIds.has(automation.id)}
          trackColor={{ false: colors.border, true: colors.primary + '80' }}
          thumbColor={automation.isActive ? colors.primary : colors.mutedForeground}
        />
      </View>

      {automation.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>{automation.description}</Text>
      ) : null}

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Feather name="play-circle" size={iconSizes.sm} color={colors.mutedForeground} />
          <Text style={styles.detailText} numberOfLines={1}>{getTriggerSummary(automation.trigger)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="arrow-right-circle" size={iconSizes.sm} color={colors.mutedForeground} />
          <Text style={styles.detailText} numberOfLines={1}>{getActionSummary(automation.actions)}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.statusBadge, { backgroundColor: automation.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)' }]}>
          <Text style={[styles.statusBadgeText, { color: automation.isActive ? '#22c55e' : '#6b7280' }]}>
            {automation.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderTemplateCard = (template: AutomationTemplate) => {
    const isEnabling = enablingIds.has(template.id);
    return (
      <View key={template.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.templateIcon, { backgroundColor: colors.primary + '15' }]}>
              <Feather name="zap" size={iconSizes.md} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{template.name}</Text>
          </View>
        </View>

        {template.description ? (
          <Text style={styles.cardDescription} numberOfLines={3}>{template.description}</Text>
        ) : null}

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Feather name="play-circle" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.detailText} numberOfLines={1}>{getTriggerSummary(template.trigger)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="arrow-right-circle" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.detailText} numberOfLines={1}>{getActionSummary(template.actions)}</Text>
          </View>
        </View>

        {template.category ? (
          <View style={styles.categoryContainer}>
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.categoryText, { color: colors.primary }]}>{template.category}</Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.enableButton, { backgroundColor: colors.primary }]}
          onPress={() => handleEnableTemplate(template)}
          disabled={isEnabling}
          activeOpacity={0.7}
        >
          {isEnabling ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="plus" size={iconSizes.sm} color="#fff" />
              <Text style={styles.enableButtonText}>Enable Template</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = (type: 'automations' | 'templates') => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '15' }]}>
        <Feather name={type === 'automations' ? 'zap' : 'copy'} size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {type === 'automations' ? 'No Automations Yet' : 'No Templates Available'}
      </Text>
      <Text style={styles.emptyDescription}>
        {type === 'automations'
          ? 'Create automations to streamline your workflow. Check out templates to get started.'
          : 'Templates will appear here when available.'}
      </Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
        <Feather name="alert-triangle" size={32} color="#ef4444" />
      </View>
      <Text style={styles.emptyTitle}>Something Went Wrong</Text>
      <Text style={styles.emptyDescription}>{error}</Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
        onPress={() => { setIsLoading(true); fetchData(); }}
        activeOpacity={0.7}
      >
        <Feather name="refresh-cw" size={iconSizes.sm} color="#fff" />
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading automations...</Text>
        </View>
      );
    }

    if (error && automations.length === 0) {
      return renderErrorState();
    }

    if (activeTab === 'automations') {
      if (automations.length === 0) return renderEmptyState('automations');
      return automations.map(renderAutomationCard);
    }

    if (templates.length === 0) return renderEmptyState('templates');
    return templates.map(renderTemplateCard);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: 'Autopilot',
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
      }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Autopilot</Text>
            <Text style={styles.pageSubtitle}>
              Automate your workflow with smart triggers and actions
            </Text>
          </View>
        </View>

        {renderTabs()}
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, shellPadding: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: shellPadding,
      paddingTop: spacing.lg,
      paddingBottom: spacing['3xl'],
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    },
    pageTitle: {
      ...typography.pageTitle,
      color: colors.foreground,
    },
    pageSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.xs,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.lg,
      gap: spacing.xs,
    },
    activeTab: {
      backgroundColor: colors.primary + '15',
    },
    tabText: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    activeTabText: {
      color: colors.primary,
      fontWeight: '600',
    },
    tabBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
    },
    tabBadgeText: {
      ...typography.badge,
      color: '#fff',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
      marginRight: spacing.sm,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    cardTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      flex: 1,
    },
    cardDescription: {
      ...typography.body,
      color: colors.mutedForeground,
      marginBottom: spacing.md,
    },
    detailsContainer: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    detailText: {
      ...typography.caption,
      color: colors.mutedForeground,
      flex: 1,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    statusBadgeText: {
      ...typography.badge,
    },
    templateIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryContainer: {
      marginBottom: spacing.md,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    categoryText: {
      ...typography.badge,
    },
    enableButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
    },
    enableButtonText: {
      ...typography.button,
      color: '#fff',
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing['4xl'],
    },
    loadingText: {
      ...typography.body,
      color: colors.mutedForeground,
      marginTop: spacing.md,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing['4xl'],
      paddingHorizontal: spacing.lg,
    },
    emptyIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    emptyDescription: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
      maxWidth: 280,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      marginTop: spacing.lg,
    },
    retryButtonText: {
      ...typography.button,
      color: '#fff',
    },
  });

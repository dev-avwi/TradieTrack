import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Switch, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles } from '../../src/lib/design-tokens';

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
  name: string;
  description: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
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

const CATEGORY_COLORS: Record<string, { color: string; bgColor: string }> = {
  'communication': { color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  'scheduling': { color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
  'invoicing': { color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  'follow-up': { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  'status': { color: '#06b6d4', bgColor: 'rgba(6,182,212,0.1)' },
  'notification': { color: '#ec4899', bgColor: 'rgba(236,72,153,0.1)' },
  'default': { color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' },
};

function getCategoryStyle(category?: string) {
  if (!category) return CATEGORY_COLORS['default'];
  const key = category.toLowerCase();
  return CATEGORY_COLORS[key] || CATEGORY_COLORS['default'];
}

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

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: 11,
  },
  tabContainer: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xs,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    gap: spacing.sm,
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
    minWidth: sizes.filterCountMin,
    height: sizes.filterCountMin,
    borderRadius: sizes.filterCountMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tabBadgeText: {
    ...typography.badge,
    color: '#fff',
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  automationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
  },
  cardDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  detailsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
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
    marginTop: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    ...typography.badge,
  },
  templateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContainer: {
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  categoryText: {
    ...typography.badge,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  enableButtonText: {
    ...typography.button,
    color: colors.primaryForeground || '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground || '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: spacing.md,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  emptyCtaText: {
    ...typography.button,
    color: colors.primaryForeground || '#fff',
  },
  templateGrid: {
    gap: spacing.sm,
  },
});

export default function AutopilotScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<TabType>('automations');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [enablingIds, setEnablingIds] = useState<Set<string>>(new Set());

  const activeCount = useMemo(() => automations.filter(a => a.isActive).length, [automations]);
  const totalCount = automations.length;
  const availableCount = templates.length;

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

  const renderStatsRow = () => (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
          <Feather name="zap" size={16} color="#22c55e" />
        </View>
        <Text style={[styles.statValue, { color: '#22c55e' }]}>{activeCount}</Text>
        <Text style={styles.statLabel}>Active</Text>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
          <Feather name="copy" size={16} color="#3b82f6" />
        </View>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{availableCount}</Text>
        <Text style={styles.statLabel}>Available</Text>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(107,114,128,0.1)' }]}>
          <Feather name="layers" size={16} color="#6b7280" />
        </View>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{totalCount}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
    </View>
  );

  const renderAutomationCard = (automation: Automation) => {
    const isActive = automation.isActive;
    return (
      <View key={automation.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.automationIconContainer, { backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)' }]}>
              <Feather name="zap" size={iconSizes.xl} color={isActive ? '#22c55e' : '#6b7280'} />
            </View>
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
          <View style={[styles.statusBadge, { backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)' }]}>
            <Text style={[styles.statusBadgeText, { color: isActive ? '#22c55e' : '#6b7280' }]}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTemplateCard = (template: AutomationTemplate) => {
    const isEnabling = enablingIds.has(template.id);
    const catStyle = getCategoryStyle(template.category);
    return (
      <View key={template.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.templateIconContainer, { backgroundColor: catStyle.bgColor }]}>
              <Feather name="zap" size={iconSizes.xl} color={catStyle.color} />
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
            <View style={[styles.categoryBadge, { backgroundColor: catStyle.bgColor }]}>
              <Text style={[styles.categoryText, { color: catStyle.color }]}>{template.category}</Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.enableButton}
          onPress={() => handleEnableTemplate(template)}
          disabled={isEnabling}
          activeOpacity={0.7}
        >
          {isEnabling ? (
            <ActivityIndicator size="small" color={colors.primaryForeground || '#fff'} />
          ) : (
            <>
              <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground || '#fff'} />
              <Text style={styles.enableButtonText}>Enable</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = (type: 'automations' | 'templates') => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.primaryLight || (colors.primary + '15') }]}>
        <Feather name="zap" size={40} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {type === 'automations' ? 'Put Your Business on Autopilot' : 'No Templates Available'}
      </Text>
      <Text style={styles.emptyDescription}>
        {type === 'automations'
          ? 'Create automations to streamline your workflow. Let smart triggers handle the repetitive tasks so you can focus on what matters.'
          : 'Templates will appear here when available. Check back soon for ready-made automations.'}
      </Text>
      {type === 'automations' && (
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={() => setActiveTab('templates')}
          activeOpacity={0.7}
        >
          <Feather name="copy" size={iconSizes.md} color={colors.primaryForeground || '#fff'} />
          <Text style={styles.emptyCtaText}>Browse Templates</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Autopilot</Text>
              <Text style={styles.pageSubtitle}>Automate your workflow with smart triggers</Text>
            </View>
          </View>

          {!isLoading && renderStatsRow()}

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

          {error && automations.length === 0 && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => { setIsLoading(true); fetchData(); }}
                activeOpacity={0.7}
              >
                <Feather name="refresh-cw" size={iconSizes.sm} color={colors.primaryForeground || '#fff'} />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading automations...</Text>
            </View>
          )}

          {!isLoading && !error && activeTab === 'automations' && (
            <>
              <Text style={styles.sectionTitle}>YOUR AUTOMATIONS</Text>
              {automations.length === 0
                ? renderEmptyState('automations')
                : automations.map(renderAutomationCard)}
            </>
          )}

          {!isLoading && activeTab === 'templates' && (
            <>
              <Text style={styles.sectionTitle}>AVAILABLE TEMPLATES</Text>
              <View style={styles.templateGrid}>
                {templates.length === 0
                  ? renderEmptyState('templates')
                  : templates.map(renderTemplateCard)}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

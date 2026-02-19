import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Switch, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

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
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingTop: 8,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
  },
  activeTab: {
    backgroundColor: colors.primary + '15',
  },
  tabText: {
    fontSize: 13,
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
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 12,
    lineHeight: 18,
  },
  detailsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  templateIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContainer: {
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryForeground || '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
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
          <Feather name="play-circle" size={14} color={colors.mutedForeground} />
          <Text style={styles.detailText} numberOfLines={1}>{getTriggerSummary(automation.trigger)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="arrow-right-circle" size={14} color={colors.mutedForeground} />
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
    const catStyle = getCategoryStyle(template.category);
    return (
      <View key={template.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.templateIconContainer, { backgroundColor: colors.primaryLight || (colors.primary + '15') }]}>
              <Feather name="zap" size={18} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{template.name}</Text>
          </View>
        </View>

        {template.description ? (
          <Text style={styles.cardDescription} numberOfLines={3}>{template.description}</Text>
        ) : null}

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Feather name="play-circle" size={14} color={colors.mutedForeground} />
            <Text style={styles.detailText} numberOfLines={1}>{getTriggerSummary(template.trigger)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="arrow-right-circle" size={14} color={colors.mutedForeground} />
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
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="plus" size={16} color="#fff" />
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
        <Feather name="zap" size={28} color={colors.primary} />
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
              <Text style={styles.pageSubtitle}>Automate your workflow with smart triggers and actions</Text>
            </View>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'automations' && styles.activeTab]}
              onPress={() => setActiveTab('automations')}
              activeOpacity={0.7}
            >
              <Feather
                name="zap"
                size={16}
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
                size={16}
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
                <Feather name="refresh-cw" size={14} color="#fff" />
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
              {templates.length === 0
                ? renderEmptyState('templates')
                : templates.map(renderTemplateCard)}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

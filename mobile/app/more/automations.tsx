import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: {
    type: 'status_change' | 'time_delay' | 'no_response' | 'payment_received';
    entityType: 'job' | 'quote' | 'invoice';
    fromStatus?: string;
    toStatus?: string;
    delayDays?: number;
  };
  actions: Array<{
    type: 'send_email' | 'create_job' | 'create_invoice' | 'notification' | 'update_status';
    template?: string;
    message?: string;
    newStatus?: string;
  }>;
  createdAt: string;
}

interface AutomationLog {
  id: string;
  automationId: string;
  automationName?: string;
  entityType: string;
  entityId: string;
  result: string;
  errorMessage?: string | null;
  processedAt: string;
}

const TRIGGER_ICONS: Record<string, string> = {
  status_change: 'arrow-right',
  time_delay: 'clock',
  no_response: 'alert-circle',
  payment_received: 'check-circle',
};

const TRIGGER_LABELS: Record<string, string> = {
  status_change: 'Status Changed',
  time_delay: 'Time Passed',
  no_response: 'No Response',
  payment_received: 'Payment Received',
};

const ACTION_ICONS: Record<string, string> = {
  send_email: 'mail',
  create_job: 'briefcase',
  create_invoice: 'file-text',
  notification: 'bell',
  update_status: 'settings',
};

const PRESET_AUTOMATIONS = [
  {
    name: "Quote Accepted → Create Job",
    description: "Auto-create a job when a quote is accepted",
    trigger: { type: 'status_change', entityType: 'quote', toStatus: 'accepted' },
    actions: [{ type: 'create_job' }, { type: 'notification', message: 'Job created from quote' }],
  },
  {
    name: "Job Done → Create Invoice",
    description: "Auto-create an invoice when job is completed",
    trigger: { type: 'status_change', entityType: 'job', toStatus: 'done' },
    actions: [{ type: 'create_invoice' }, { type: 'send_email', template: 'job_completed' }],
  },
  {
    name: "Quote Follow-up (3 days)",
    description: "Send follow-up email after 3 days without response",
    trigger: { type: 'no_response', entityType: 'quote', delayDays: 3 },
    actions: [{ type: 'send_email', template: 'quote_followup' }],
  },
  {
    name: "Invoice Reminder (7 days)",
    description: "Remind about overdue invoice after 7 days",
    trigger: { type: 'time_delay', entityType: 'invoice', delayDays: 7 },
    actions: [{ type: 'send_email', template: 'invoice_reminder' }],
  },
  {
    name: "Payment Thank You",
    description: "Send thank you when payment is received",
    trigger: { type: 'payment_received', entityType: 'invoice' },
    actions: [{ type: 'send_email', template: 'payment_received' }],
  },
];

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  automationCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  automationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  automationTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  automationTitleContent: {
    flex: 1,
  },
  automationName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  automationDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs / 2,
  },
  automationDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  triggerBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.md,
  },
  triggerBadgeText: {
    ...typography.captionSmall,
    color: colors.foreground,
  },
  entityText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  actionIcons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionIconCircle: {
    width: sizes.iconMd,
    height: sizes.iconMd,
    borderRadius: sizes.iconMd / 2,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  automationFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  deleteButtonText: {
    ...typography.caption,
    color: colors.destructive,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  editButtonText: {
    ...typography.caption,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.headline,
    color: colors.foreground,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalButtonCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  modalButtonSave: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  modalButtonCancelText: {
    ...typography.body,
    color: colors.foreground,
  },
  modalButtonSaveText: {
    ...typography.body,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  presetCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: spacing.sm,
  },
  presetContent: {
    flex: 1,
  },
  presetName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  presetDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs / 2,
  },
  addPresetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addPresetText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  emptyStateButtonText: {
    ...typography.body,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  allAddedState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  allAddedText: {
    ...typography.body,
    color: colors.success,
    marginTop: spacing.sm,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  historyIconCircle: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: sizes.avatarSm / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {
    flex: 1,
  },
  historyName: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  historyDetails: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  historyTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  historyError: {
    ...typography.captionSmall,
    color: colors.destructive,
    marginTop: spacing.xs / 2,
  },
});

export default function AutomationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [history, setHistory] = useState<AutomationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [addingPreset, setAddingPreset] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'presets' | 'history'>('active');
  const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);
  const [editDelayDays, setEditDelayDays] = useState('');

  const fetchAutomations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<AutomationRule[]>('/api/automations');
      if (response.data) {
        setAutomations(response.data);
      }
    } catch (error) {
      console.log('Error fetching automations:', error);
    }
    setIsLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await api.get<AutomationLog[]>('/api/automations/history');
      if (response.data) {
        setHistory(response.data);
      }
    } catch (error) {
      console.log('Error fetching automation history:', error);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
    fetchHistory();
  }, []);

  const toggleAutomation = async (id: string, isActive: boolean) => {
    setIsUpdating(true);
    try {
      await api.patch(`/api/automations/${id}`, { isActive: !isActive });
      setAutomations(prev => 
        prev.map(a => a.id === id ? { ...a, isActive: !isActive } : a)
      );
      Alert.alert('Updated', `Automation ${!isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update automation');
    }
    setIsUpdating(false);
  };

  const deleteAutomation = async (id: string) => {
    Alert.alert(
      'Delete Automation',
      'Are you sure you want to delete this automation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/automations/${id}`);
              setAutomations(prev => prev.filter(a => a.id !== id));
              Alert.alert('Deleted', 'Automation removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete automation');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (automation: AutomationRule) => {
    if (!automation.id) {
      Alert.alert('Error', 'Cannot edit unsaved automation');
      return;
    }
    setEditingAutomation(automation);
    setEditDelayDays(automation.trigger.delayDays?.toString() || '');
  };

  const saveAutomationEdit = async () => {
    if (!editingAutomation) return;
    
    setIsUpdating(true);
    try {
      const updatedTrigger = {
        ...editingAutomation.trigger,
        delayDays: editDelayDays ? parseInt(editDelayDays, 10) : undefined,
      };
      
      await api.patch(`/api/automations/${editingAutomation.id}`, {
        trigger: updatedTrigger,
      });
      
      await fetchAutomations();
      setEditingAutomation(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update automation');
    }
    setIsUpdating(false);
  };

  const addPreset = async (preset: typeof PRESET_AUTOMATIONS[0]) => {
    setAddingPreset(preset.name);
    try {
      const response = await api.post<AutomationRule>('/api/automations', {
        ...preset,
        isActive: true,
      });
      if (response.data) {
        setAutomations(prev => [...prev, response.data!]);
        Alert.alert('Added', 'Automation created and activated');
        setActiveTab('active');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create automation');
    }
    setAddingPreset(null);
  };

  const availablePresets = PRESET_AUTOMATIONS.filter(
    preset => !automations.some(a => a.name === preset.name)
  );

  const activeAutomations = automations.filter(a => a.isActive);
  const inactiveAutomations = automations.filter(a => !a.isActive);

  const renderAutomationCard = (automation: AutomationRule) => {
    const triggerIcon = TRIGGER_ICONS[automation.trigger.type] || 'zap';
    const triggerLabel = TRIGGER_LABELS[automation.trigger.type] || automation.trigger.type;

    return (
      <View key={automation.id} style={styles.automationCard}>
        <View style={styles.automationHeader}>
          <View style={styles.automationTitleRow}>
            <View style={[styles.iconCircle, { backgroundColor: automation.isActive ? colors.primaryLight : colors.muted }]}>
              <Feather 
                name={triggerIcon as any} 
                size={16} 
                color={automation.isActive ? colors.primary : colors.mutedForeground} 
              />
            </View>
            <View style={styles.automationTitleContent}>
              <Text style={styles.automationName}>{automation.name}</Text>
              {automation.description && (
                <Text style={styles.automationDescription}>{automation.description}</Text>
              )}
            </View>
          </View>
          <Switch
            value={automation.isActive}
            onValueChange={() => toggleAutomation(automation.id, automation.isActive)}
            disabled={isUpdating}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.automationDetails}>
          <View style={styles.detailRow}>
            <View style={styles.triggerBadge}>
              <Text style={styles.triggerBadgeText}>{triggerLabel}</Text>
            </View>
            <Text style={styles.entityText}>
              {automation.trigger.entityType.charAt(0).toUpperCase() + automation.trigger.entityType.slice(1)}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Text style={styles.actionsLabel}>Actions: </Text>
            <View style={styles.actionIcons}>
              {automation.actions.map((action, idx) => (
                <View key={idx} style={styles.actionIconCircle}>
                  <Feather 
                    name={ACTION_ICONS[action.type] as any || 'zap'} 
                    size={12} 
                    color={colors.foreground} 
                  />
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.automationFooter}>
          {(automation.trigger.type === 'time_delay' || automation.trigger.type === 'no_response') && (
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => openEditModal(automation)}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={styles.editButtonText}>Edit Timing</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteAutomation(automation.id)}>
            <Feather name="trash-2" size={14} color={colors.destructive} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPresetCard = (preset: typeof PRESET_AUTOMATIONS[0], idx: number) => {
    const triggerIcon = TRIGGER_ICONS[preset.trigger.type] || 'zap';
    const isAdding = addingPreset === preset.name;

    return (
      <View key={idx} style={styles.presetCard}>
        <View style={styles.presetHeader}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Feather name={triggerIcon as any} size={16} color={colors.primary} />
          </View>
          <View style={styles.presetContent}>
            <Text style={styles.presetName}>{preset.name}</Text>
            <Text style={styles.presetDescription}>{preset.description}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.addPresetButton} 
          onPress={() => addPreset(preset)}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.addPresetText}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderHistoryCard = (log: AutomationLog) => {
    const isSuccess = log.result === 'success';
    
    return (
      <View key={log.id} style={styles.historyCard}>
        <View style={[
          styles.historyIconCircle, 
          { backgroundColor: isSuccess ? colors.successLight || colors.primaryLight : colors.destructiveLight || colors.muted }
        ]}>
          <Feather 
            name={isSuccess ? 'check' : 'alert-circle'} 
            size={16} 
            color={isSuccess ? colors.success : colors.destructive} 
          />
        </View>
        <View style={styles.historyContent}>
          <Text style={styles.historyName}>{log.automationName || 'Automation'}</Text>
          <Text style={styles.historyDetails}>
            {log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1)} processed
          </Text>
          {log.errorMessage && (
            <Text style={styles.historyError}>{log.errorMessage}</Text>
          )}
        </View>
        <Text style={styles.historyTime}>{formatRelativeTime(log.processedAt)}</Text>
      </View>
    );
  };

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
              refreshing={isLoading}
              onRefresh={fetchAutomations}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Automations</Text>
              <Text style={styles.headerSubtitle}>Set up automatic workflows</Text>
            </View>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'active' && styles.tabActive]}
              onPress={() => setActiveTab('active')}
            >
              <Feather 
                name="zap" 
                size={14} 
                color={activeTab === 'active' ? colors.primary : colors.mutedForeground} 
              />
              <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
                Active ({automations.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'presets' && styles.tabActive]}
              onPress={() => setActiveTab('presets')}
            >
              <Feather 
                name="package" 
                size={14} 
                color={activeTab === 'presets' ? colors.primary : colors.mutedForeground} 
              />
              <Text style={[styles.tabText, activeTab === 'presets' && styles.tabTextActive]}>
                Templates
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'history' && styles.tabActive]}
              onPress={() => { setActiveTab('history'); fetchHistory(); }}
            >
              <Feather 
                name="clock" 
                size={14} 
                color={activeTab === 'history' ? colors.primary : colors.mutedForeground} 
              />
              <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                History
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'active' ? (
            <>
              {activeAutomations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Active ({activeAutomations.length})</Text>
                  {activeAutomations.map(renderAutomationCard)}
                </View>
              )}

              {inactiveAutomations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Inactive ({inactiveAutomations.length})</Text>
                  {inactiveAutomations.map(renderAutomationCard)}
                </View>
              )}

              {automations.length === 0 && !isLoading && (
                <View style={styles.emptyState}>
                  <Feather name="zap" size={48} color={colors.mutedForeground} />
                  <Text style={styles.emptyStateTitle}>No Automations Yet</Text>
                  <Text style={styles.emptyStateText}>
                    Add templates to automate your workflow and save time
                  </Text>
                  <TouchableOpacity 
                    style={styles.emptyStateButton}
                    onPress={() => setActiveTab('presets')}
                  >
                    <Feather name="plus" size={18} color={colors.primaryForeground} />
                    <Text style={styles.emptyStateButtonText}>Browse Templates</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : activeTab === 'presets' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Templates</Text>
              {availablePresets.length > 0 ? (
                availablePresets.map(renderPresetCard)
              ) : (
                <View style={styles.allAddedState}>
                  <Feather name="check-circle" size={32} color={colors.success} />
                  <Text style={styles.allAddedText}>All templates added!</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Automation History</Text>
              {history.length > 0 ? (
                history.map(renderHistoryCard)
              ) : (
                <View style={styles.emptyState}>
                  <Feather name="clock" size={48} color={colors.mutedForeground} />
                  <Text style={styles.emptyStateTitle}>No History Yet</Text>
                  <Text style={styles.emptyStateText}>
                    Automation executions will appear here when they run
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={editingAutomation !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingAutomation(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Automation</Text>
              <TouchableOpacity onPress={() => setEditingAutomation(null)}>
                <Feather name="x" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {editingAutomation?.trigger.type === 'time_delay' && (
              <>
                <Text style={styles.modalLabel}>Delay (days)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDelayDays}
                  onChangeText={setEditDelayDays}
                  placeholder="Enter number of days"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </>
            )}

            {editingAutomation?.trigger.type === 'no_response' && (
              <>
                <Text style={styles.modalLabel}>Wait for response (days)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDelayDays}
                  onChangeText={setEditDelayDays}
                  placeholder="Days before follow-up"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonCancel} 
                onPress={() => setEditingAutomation(null)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalButtonSave} 
                onPress={saveAutomationEdit}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.modalButtonSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU');
}

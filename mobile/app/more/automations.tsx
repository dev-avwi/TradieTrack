import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, typography, iconSizes, sizes } from '../../src/lib/design-tokens';

type TriggerType = 'status_change' | 'time_delay' | 'no_response' | 'payment_received';
type EntityType = 'job' | 'quote' | 'invoice';
type ActionType = 'send_email' | 'create_job' | 'create_invoice' | 'notification' | 'update_status';

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: {
    type: TriggerType;
    entityType: EntityType;
    fromStatus?: string;
    toStatus?: string;
    delayDays?: number;
  };
  actions: Array<{
    type: ActionType;
    template?: string;
    message?: string;
    newStatus?: string;
  }>;
  createdAt: string;
}

interface AutomationExecution {
  id: string;
  automationId: string;
  status: 'success' | 'failed' | 'skipped';
  entityType: string;
  entityId: string;
  executedAt: string;
  error?: string;
}

const TRIGGER_TYPES: { value: TriggerType; label: string; icon: keyof typeof Feather.glyphMap; description: string }[] = [
  { value: 'status_change', label: 'Status Changed', icon: 'arrow-right', description: 'When a job/quote/invoice status changes' },
  { value: 'time_delay', label: 'Time Passed', icon: 'clock', description: 'After a period of time' },
  { value: 'no_response', label: 'No Response', icon: 'alert-circle', description: "When client hasn't responded" },
  { value: 'payment_received', label: 'Payment Received', icon: 'check-circle', description: 'When payment is made' },
];

const ACTION_TYPES: { value: ActionType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'send_email', label: 'Send Email', icon: 'mail' },
  { value: 'create_job', label: 'Create Job', icon: 'briefcase' },
  { value: 'create_invoice', label: 'Create Invoice', icon: 'file-text' },
  { value: 'notification', label: 'Send Notification', icon: 'bell' },
  { value: 'update_status', label: 'Update Status', icon: 'settings' },
];

const JOB_STATUSES = ['pending', 'scheduled', 'in_progress', 'done', 'invoiced'];
const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'];
const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'];

const PRESET_AUTOMATIONS: Omit<AutomationRule, 'id' | 'createdAt'>[] = [
  {
    name: "Quote Accepted \u2192 Create Job",
    description: "Automatically create a job when a quote is accepted",
    isActive: false,
    trigger: { type: 'status_change', entityType: 'quote', toStatus: 'accepted' },
    actions: [{ type: 'create_job' }, { type: 'notification', message: 'A new job has been created from an accepted quote' }],
  },
  {
    name: "Job Completed \u2192 Create Invoice",
    description: "Automatically create an invoice when a job is marked as done",
    isActive: false,
    trigger: { type: 'status_change', entityType: 'job', toStatus: 'done' },
    actions: [{ type: 'create_invoice' }, { type: 'send_email', template: 'job_completed' }],
  },
  {
    name: "Quote Follow-up (3 days)",
    description: "Send a friendly follow-up email if quote not responded after 3 days",
    isActive: false,
    trigger: { type: 'no_response', entityType: 'quote', delayDays: 3 },
    actions: [{ type: 'send_email', template: 'quote_followup' }],
  },
  {
    name: "Invoice Reminder (7 days overdue)",
    description: "Send reminder when invoice is 7 days overdue",
    isActive: false,
    trigger: { type: 'time_delay', entityType: 'invoice', delayDays: 7 },
    actions: [{ type: 'send_email', template: 'invoice_reminder' }],
  },
  {
    name: "Payment Received \u2192 Thank You",
    description: "Send thank you message when payment is received",
    isActive: false,
    trigger: { type: 'payment_received', entityType: 'invoice' },
    actions: [{ type: 'send_email', template: 'payment_received' }, { type: 'update_status', newStatus: 'paid' }],
  },
  {
    name: "Job Scheduled \u2192 Confirmation",
    description: "Send confirmation when a job is scheduled",
    isActive: false,
    trigger: { type: 'status_change', entityType: 'job', toStatus: 'scheduled' },
    actions: [{ type: 'send_email', template: 'job_confirmation' }],
  },
];

type ActiveTab = 'rules' | 'presets' | 'settings' | 'history';

type ReminderType = 'sms' | 'email' | 'both';

interface AutomationSettings {
  id: string;
  userId: string;
  jobReminderEnabled: boolean;
  jobReminderHoursBefore: number;
  jobReminderType: ReminderType;
  quoteFollowUpEnabled: boolean;
  quoteFollowUpDays: number;
  quoteFollowUpType?: ReminderType;
  invoiceReminderEnabled: boolean;
  invoiceReminderDaysBeforeDue: number;
  invoiceOverdueReminderDays: number;
  invoiceReminderType?: ReminderType;
  requirePhotoBeforeStart: boolean;
  requirePhotoAfterComplete: boolean;
  autoCheckInOnArrival: boolean;
  autoCheckOutOnDeparture: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
}

const HOURS_OPTIONS = [
  { value: 1, label: '1 hour before' },
  { value: 2, label: '2 hours before' },
  { value: 4, label: '4 hours before' },
  { value: 12, label: '12 hours before' },
  { value: 24, label: '24 hours before' },
  { value: 48, label: '48 hours before' },
];

const DAYS_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 2, label: '2 days' },
  { value: 3, label: '3 days' },
  { value: 5, label: '5 days' },
  { value: 7, label: '7 days' },
];

const CHANNEL_OPTIONS: { value: ReminderType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'sms', label: 'SMS', icon: 'smartphone' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'both', label: 'Both', icon: 'message-circle' },
];

export default function AutomationsScreen() {
  const { colors } = useTheme();

  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [history, setHistory] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('rules');
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    triggerType: 'status_change' as TriggerType,
    entityType: 'job' as EntityType,
    fromStatus: '',
    toStatus: '',
    delayDays: '3',
    actions: [{ type: 'send_email' as ActionType, template: '', message: '' }] as Array<{ type: ActionType; template?: string; message?: string; newStatus?: string }>,
  });

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [automationsRes, historyRes, settingsRes] = await Promise.all([
        api.get<AutomationRule[]>('/api/automations'),
        api.get<AutomationExecution[]>('/api/automations/history'),
        api.get<AutomationSettings>('/api/automation-settings'),
      ]);
      if (automationsRes.data) setAutomations(automationsRes.data);
      if (historyRes.data) setHistory(historyRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);
    } catch (e) {
      setError('Failed to load automations. Pull down to retry.');
      console.error('Error fetching automations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSaveSettings = async (updates: Partial<AutomationSettings>) => {
    setSavingSettings(true);
    try {
      const res = await api.patch<AutomationSettings>('/api/automation-settings', updates);
      if (res.data) setSettings(res.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleSetting = (key: keyof AutomationSettings, value: any) => {
    const updated = { ...settings, [key]: value } as AutomationSettings;
    setSettings(updated);
    handleSaveSettings({ [key]: value });
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      name: '', description: '', isActive: true, triggerType: 'status_change',
      entityType: 'job', fromStatus: '', toStatus: '', delayDays: '3',
      actions: [{ type: 'send_email', template: '', message: '' }],
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required', 'Automation name is required');
      return;
    }
    const needsDelay = formData.triggerType === 'time_delay' || formData.triggerType === 'no_response';
    const parsedDelay = parseInt(formData.delayDays);
    if (needsDelay && (isNaN(parsedDelay) || parsedDelay < 1)) {
      Alert.alert('Invalid', 'Delay days must be a valid positive number');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        trigger: {
          type: formData.triggerType,
          entityType: formData.entityType,
          fromStatus: formData.fromStatus || undefined,
          toStatus: formData.toStatus || undefined,
          delayDays: needsDelay ? parsedDelay : undefined,
        },
        actions: formData.actions,
      };
      if (editingRule) {
        await api.patch(`/api/automations/${editingRule.id}`, payload);
      } else {
        await api.post('/api/automations', payload);
      }
      resetForm();
      setShowForm(false);
      setEditingRule(null);
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'Failed to save automation');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try {
      await api.patch(`/api/automations/${rule.id}`, { isActive: !rule.isActive });
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update automation');
    }
  };

  const handleDelete = (rule: AutomationRule) => {
    Alert.alert('Delete Automation', `Are you sure you want to delete "${rule.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/automations/${rule.id}`);
            fetchData();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete automation');
          }
        }
      },
    ]);
  };

  const handleEdit = (rule: AutomationRule) => {
    setFormData({
      name: rule.name,
      description: rule.description || '',
      isActive: rule.isActive,
      triggerType: rule.trigger.type,
      entityType: rule.trigger.entityType,
      fromStatus: rule.trigger.fromStatus || '',
      toStatus: rule.trigger.toStatus || '',
      delayDays: String(rule.trigger.delayDays || 3),
      actions: rule.actions.length > 0 ? rule.actions : [{ type: 'send_email', template: '', message: '' }],
    });
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleAddPreset = async (preset: Omit<AutomationRule, 'id' | 'createdAt'>) => {
    setSaving(true);
    try {
      await api.post('/api/automations', preset);
      fetchData();
      setActiveTab('rules');
    } catch (e) {
      Alert.alert('Error', 'Failed to add automation');
    } finally {
      setSaving(false);
    }
  };

  const getStatusesForEntity = (entity: EntityType) => {
    switch (entity) {
      case 'job': return JOB_STATUSES;
      case 'quote': return QUOTE_STATUSES;
      case 'invoice': return INVOICE_STATUSES;
    }
  };

  const styles = createStyles(colors);

  const getTriggerInfo = (type: TriggerType) => TRIGGER_TYPES.find(t => t.value === type);
  const getActionInfo = (type: ActionType) => ACTION_TYPES.find(a => a.value === type);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading automations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={iconSizes.md} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Automations</Text>
            <Text style={styles.headerSubtitle}>{automations.length} workflow rules</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerAction, { backgroundColor: colors.primary }]}
            onPress={() => { resetForm(); setEditingRule(null); setShowForm(true); }}
          >
            <Feather name="plus" size={iconSizes.sm} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContainer}>
        {(['rules', 'presets', 'settings', 'history'] as ActiveTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'rules' ? `Rules (${automations.length})` : tab === 'presets' ? 'Presets' : tab === 'settings' ? 'Settings' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error && activeTab !== 'presets' ? (
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={48} color={colors.destructive} />
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => { setLoading(true); fetchData(); }}>
              <Feather name="refresh-cw" size={iconSizes.sm} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!error && activeTab === 'rules' && (
          automations.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="zap" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No Automations</Text>
              <Text style={styles.emptySubtitle}>Create workflow rules or use presets to automate your business</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => setActiveTab('presets')}>
                <Feather name="layers" size={iconSizes.sm} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Browse Presets</Text>
              </TouchableOpacity>
            </View>
          ) : (
            automations.map(rule => {
              const triggerInfo = getTriggerInfo(rule.trigger.type);
              return (
                <View key={rule.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{rule.name}</Text>
                      {rule.description && <Text style={styles.cardDescription}>{rule.description}</Text>}
                    </View>
                    <Switch
                      value={rule.isActive}
                      onValueChange={() => handleToggle(rule)}
                      trackColor={{ false: colors.muted, true: colors.primaryLight }}
                      thumbColor={rule.isActive ? colors.primary : colors.mutedForeground}
                    />
                  </View>

                  <View style={styles.ruleFlow}>
                    <View style={[styles.ruleBadge, { backgroundColor: colors.infoLight }]}>
                      <Feather name={triggerInfo?.icon || 'zap'} size={14} color={colors.info} />
                      <Text style={[styles.ruleBadgeText, { color: colors.info }]}>
                        {triggerInfo?.label || rule.trigger.type}
                      </Text>
                    </View>
                    <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                    <View style={[styles.ruleBadge, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.ruleBadgeText, { color: colors.primary }]}>
                        {rule.trigger.entityType.charAt(0).toUpperCase() + rule.trigger.entityType.slice(1)}
                      </Text>
                    </View>
                    {rule.trigger.toStatus && (
                      <>
                        <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                        <View style={[styles.ruleBadge, { backgroundColor: colors.successLight }]}>
                          <Text style={[styles.ruleBadgeText, { color: colors.success }]}>{rule.trigger.toStatus}</Text>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.actionsRow}>
                    {rule.actions.map((action, idx) => {
                      const actionInfo = getActionInfo(action.type);
                      return (
                        <View key={idx} style={[styles.actionChip, { backgroundColor: colors.muted }]}>
                          <Feather name={actionInfo?.icon || 'zap'} size={12} color={colors.mutedForeground} />
                          <Text style={styles.actionChipText}>{actionInfo?.label || action.type}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleEdit(rule)}>
                      <Feather name="edit-2" size={14} color={colors.primary} />
                      <Text style={[styles.cardActionText, { color: colors.primary }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleDelete(rule)}>
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        )}

        {activeTab === 'presets' && (
          <View>
            <Text style={styles.sectionHint}>Quick-add common automation rules to streamline your workflow</Text>
            {PRESET_AUTOMATIONS.map((preset, idx) => {
              const triggerInfo = getTriggerInfo(preset.trigger.type);
              const alreadyAdded = automations.some(a => a.name === preset.name);
              return (
                <View key={idx} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{preset.name}</Text>
                      {preset.description && <Text style={styles.cardDescription}>{preset.description}</Text>}
                    </View>
                  </View>
                  <View style={styles.ruleFlow}>
                    <View style={[styles.ruleBadge, { backgroundColor: colors.infoLight }]}>
                      <Feather name={triggerInfo?.icon || 'zap'} size={14} color={colors.info} />
                      <Text style={[styles.ruleBadgeText, { color: colors.info }]}>{triggerInfo?.label}</Text>
                    </View>
                    <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                    {preset.actions.map((action, aidx) => {
                      const actionInfo = getActionInfo(action.type);
                      return (
                        <View key={aidx} style={[styles.actionChip, { backgroundColor: colors.muted }]}>
                          <Feather name={actionInfo?.icon || 'zap'} size={12} color={colors.mutedForeground} />
                          <Text style={styles.actionChipText}>{actionInfo?.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.addPresetBtn, alreadyAdded && { opacity: 0.5 }]}
                      onPress={() => !alreadyAdded && handleAddPreset(preset)}
                      disabled={alreadyAdded || saving}
                    >
                      <Feather name={alreadyAdded ? 'check' : 'plus'} size={14} color={alreadyAdded ? colors.success : colors.primary} />
                      <Text style={[styles.addPresetText, { color: alreadyAdded ? colors.success : colors.primary }]}>
                        {alreadyAdded ? 'Added' : 'Add Rule'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'settings' && (
          <View>
            <View style={styles.card}>
              <View style={styles.settingsHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: colors.infoLight }]}>
                  <Feather name="bell" size={18} color={colors.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Job Reminders</Text>
                  <Text style={styles.cardDescription}>Automatically remind clients before scheduled jobs</Text>
                </View>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Enable job reminders</Text>
                <Switch
                  value={settings?.jobReminderEnabled ?? false}
                  onValueChange={v => toggleSetting('jobReminderEnabled', v)}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={settings?.jobReminderEnabled ? colors.primary : colors.mutedForeground}
                />
              </View>
              {settings?.jobReminderEnabled && (
                <>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Hours before</Text>
                    <View style={styles.optionRow}>
                      {HOURS_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.optionChip, settings?.jobReminderHoursBefore === opt.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                          onPress={() => toggleSetting('jobReminderHoursBefore', opt.value)}
                        >
                          <Text style={[styles.optionChipText, settings?.jobReminderHoursBefore === opt.value && { color: colors.primary }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Send via</Text>
                    <View style={styles.optionRow}>
                      {CHANNEL_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.optionChip, settings?.jobReminderType === opt.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                          onPress={() => toggleSetting('jobReminderType', opt.value)}
                        >
                          <Feather name={opt.icon} size={12} color={settings?.jobReminderType === opt.value ? colors.primary : colors.mutedForeground} />
                          <Text style={[styles.optionChipText, settings?.jobReminderType === opt.value && { color: colors.primary }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.settingsHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: colors.warningLight }]}>
                  <Feather name="file-text" size={18} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Quote Follow-ups</Text>
                  <Text style={styles.cardDescription}>Follow up on quotes that haven't been responded to</Text>
                </View>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Enable quote follow-ups</Text>
                <Switch
                  value={settings?.quoteFollowUpEnabled ?? false}
                  onValueChange={v => toggleSetting('quoteFollowUpEnabled', v)}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={settings?.quoteFollowUpEnabled ? colors.primary : colors.mutedForeground}
                />
              </View>
              {settings?.quoteFollowUpEnabled && (
                <>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Days after sending</Text>
                    <View style={styles.optionRow}>
                      {DAYS_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.optionChip, settings?.quoteFollowUpDays === opt.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                          onPress={() => toggleSetting('quoteFollowUpDays', opt.value)}
                        >
                          <Text style={[styles.optionChipText, settings?.quoteFollowUpDays === opt.value && { color: colors.primary }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Send via</Text>
                    <View style={styles.optionRow}>
                      {CHANNEL_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.optionChip, settings?.quoteFollowUpType === opt.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                          onPress={() => toggleSetting('quoteFollowUpType', opt.value)}
                        >
                          <Feather name={opt.icon} size={12} color={settings?.quoteFollowUpType === opt.value ? colors.primary : colors.mutedForeground} />
                          <Text style={[styles.optionChipText, settings?.quoteFollowUpType === opt.value && { color: colors.primary }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.settingsHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: colors.successLight }]}>
                  <Feather name="dollar-sign" size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Invoice Reminders</Text>
                  <Text style={styles.cardDescription}>Automatic reminders for overdue invoices</Text>
                </View>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Enable invoice reminders</Text>
                <Switch
                  value={settings?.invoiceReminderEnabled ?? false}
                  onValueChange={v => toggleSetting('invoiceReminderEnabled', v)}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={settings?.invoiceReminderEnabled ? colors.primary : colors.mutedForeground}
                />
              </View>
              {settings?.invoiceReminderEnabled && (
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Send via</Text>
                  <View style={styles.optionRow}>
                    {CHANNEL_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.optionChip, settings?.invoiceReminderType === opt.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                        onPress={() => toggleSetting('invoiceReminderType', opt.value)}
                      >
                        <Feather name={opt.icon} size={12} color={settings?.invoiceReminderType === opt.value ? colors.primary : colors.mutedForeground} />
                        <Text style={[styles.optionChipText, settings?.invoiceReminderType === opt.value && { color: colors.primary }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.settingsHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="camera" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Job Photos</Text>
                  <Text style={styles.cardDescription}>Photo requirements for job workflows</Text>
                </View>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Require photo before starting</Text>
                <Switch
                  value={settings?.requirePhotoBeforeStart ?? false}
                  onValueChange={v => toggleSetting('requirePhotoBeforeStart', v)}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={settings?.requirePhotoBeforeStart ? colors.primary : colors.mutedForeground}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Require photo after completing</Text>
                <Switch
                  value={settings?.requirePhotoAfterComplete ?? false}
                  onValueChange={v => toggleSetting('requirePhotoAfterComplete', v)}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={settings?.requirePhotoAfterComplete ? colors.primary : colors.mutedForeground}
                />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.settingsHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: colors.infoLight }]}>
                  <Feather name="map-pin" size={18} color={colors.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Auto Check-in</Text>
                  <Text style={styles.cardDescription}>GPS-based automatic clock in/out</Text>
                </View>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Auto check-in on arrival</Text>
                <Switch
                  value={settings?.autoCheckInOnArrival ?? false}
                  onValueChange={v => toggleSetting('autoCheckInOnArrival', v)}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={settings?.autoCheckInOnArrival ? colors.primary : colors.mutedForeground}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Auto check-out on departure</Text>
                <Switch
                  value={settings?.autoCheckOutOnDeparture ?? false}
                  onValueChange={v => toggleSetting('autoCheckOutOnDeparture', v)}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={settings?.autoCheckOutOnDeparture ? colors.primary : colors.mutedForeground}
                />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.settingsHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: colors.warningLight }]}>
                  <Feather name="sun" size={18} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Daily Summary</Text>
                  <Text style={styles.cardDescription}>Receive a daily overview of your business</Text>
                </View>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Enable daily summary</Text>
                <Switch
                  value={settings?.dailySummaryEnabled ?? false}
                  onValueChange={v => toggleSetting('dailySummaryEnabled', v)}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={settings?.dailySummaryEnabled ? colors.primary : colors.mutedForeground}
                />
              </View>
            </View>

            {savingSettings && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.savingText}>Saving...</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'history' && (
          history.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="clock" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No History</Text>
              <Text style={styles.emptySubtitle}>Automation execution history will appear here</Text>
            </View>
          ) : (
            history.map(exec => {
              const automation = automations.find(a => a.id === exec.automationId);
              return (
                <View key={exec.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{automation?.name || 'Unknown Rule'}</Text>
                      <Text style={styles.cardDescription}>{exec.entityType} #{exec.entityId}</Text>
                    </View>
                    <View style={[styles.statusBadge, {
                      backgroundColor: exec.status === 'success' ? colors.successLight : exec.status === 'failed' ? (colors.destructiveLight || colors.muted) : colors.muted
                    }]}>
                      <Feather
                        name={exec.status === 'success' ? 'check-circle' : exec.status === 'failed' ? 'x-circle' : 'minus-circle'}
                        size={12}
                        color={exec.status === 'success' ? colors.success : exec.status === 'failed' ? colors.destructive : colors.mutedForeground}
                      />
                      <Text style={[styles.statusBadgeText, {
                        color: exec.status === 'success' ? colors.success : exec.status === 'failed' ? colors.destructive : colors.mutedForeground
                      }]}>
                        {exec.status.charAt(0).toUpperCase() + exec.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyDate}>{formatDate(exec.executedAt)}</Text>
                  {exec.error && <Text style={[styles.historyError, { color: colors.destructive }]}>{exec.error}</Text>}
                </View>
              );
            })
          )
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowForm(false); setEditingRule(null); resetForm(); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingRule ? 'Edit Rule' : 'New Rule'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput style={styles.formInput} value={formData.name} onChangeText={v => setFormData(p => ({ ...p, name: v }))} placeholder="Automation name" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={[styles.formInput, styles.formTextarea]} value={formData.description} onChangeText={v => setFormData(p => ({ ...p, description: v }))} placeholder="What does this automation do?" placeholderTextColor={colors.mutedForeground} multiline textAlignVertical="top" />
            </View>
            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Active</Text>
                <Switch
                  value={formData.isActive}
                  onValueChange={v => setFormData(p => ({ ...p, isActive: v }))}
                  trackColor={{ false: colors.muted, true: colors.primaryLight }}
                  thumbColor={formData.isActive ? colors.primary : colors.mutedForeground}
                />
              </View>
            </View>

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>Trigger</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>When</Text>
              <View style={styles.optionRow}>
                {TRIGGER_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.optionChip, formData.triggerType === t.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                    onPress={() => setFormData(p => ({ ...p, triggerType: t.value }))}
                  >
                    <Feather name={t.icon} size={14} color={formData.triggerType === t.value ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.optionChipText, formData.triggerType === t.value && { color: colors.primary }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Entity</Text>
              <View style={styles.optionRow}>
                {(['job', 'quote', 'invoice'] as EntityType[]).map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.optionChip, formData.entityType === e && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                    onPress={() => setFormData(p => ({ ...p, entityType: e, fromStatus: '', toStatus: '' }))}
                  >
                    <Text style={[styles.optionChipText, formData.entityType === e && { color: colors.primary }]}>{e.charAt(0).toUpperCase() + e.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {(formData.triggerType === 'status_change') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>To Status</Text>
                <View style={styles.optionRow}>
                  {getStatusesForEntity(formData.entityType).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.optionChip, formData.toStatus === s && { backgroundColor: colors.successLight, borderColor: colors.success }]}
                      onPress={() => setFormData(p => ({ ...p, toStatus: s }))}
                    >
                      <Text style={[styles.optionChipText, formData.toStatus === s && { color: colors.success }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {(formData.triggerType === 'time_delay' || formData.triggerType === 'no_response') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Days</Text>
                <TextInput style={styles.formInput} value={formData.delayDays} onChangeText={v => setFormData(p => ({ ...p, delayDays: v }))} placeholder="3" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" />
              </View>
            )}

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>Actions</Text>
            </View>

            {formData.actions.map((action, idx) => {
              const actionInfo = getActionInfo(action.type);
              return (
                <View key={idx} style={styles.actionFormCard}>
                  <View style={styles.optionRow}>
                    {ACTION_TYPES.map(a => (
                      <TouchableOpacity
                        key={a.value}
                        style={[styles.optionChip, action.type === a.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                        onPress={() => {
                          const newActions = [...formData.actions];
                          newActions[idx] = { ...newActions[idx], type: a.value };
                          setFormData(p => ({ ...p, actions: newActions }));
                        }}
                      >
                        <Feather name={a.icon} size={12} color={action.type === a.value ? colors.primary : colors.mutedForeground} />
                        <Text style={[styles.optionChipText, action.type === a.value && { color: colors.primary }]}>{a.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {(action.type === 'notification' || action.type === 'send_email') && (
                    <TextInput
                      style={[styles.formInput, { marginTop: spacing.sm }]}
                      value={action.message || action.template || ''}
                      onChangeText={v => {
                        const newActions = [...formData.actions];
                        if (action.type === 'notification') newActions[idx] = { ...newActions[idx], message: v };
                        else newActions[idx] = { ...newActions[idx], template: v };
                        setFormData(p => ({ ...p, actions: newActions }));
                      }}
                      placeholder={action.type === 'notification' ? 'Notification message' : 'Email template name'}
                      placeholderTextColor={colors.mutedForeground}
                    />
                  )}
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.addActionBtn}
              onPress={() => setFormData(p => ({ ...p, actions: [...p.actions, { type: 'send_email', template: '', message: '' }] }))}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[styles.addActionText, { color: colors.primary }]}>Add Action</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.subtitle, color: colors.foreground },
  headerSubtitle: { ...typography.caption, color: colors.mutedForeground },
  headerAction: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.mutedForeground },
  tabContainer: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { ...typography.caption, color: colors.mutedForeground, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, gap: spacing.sm },
  emptyTitle: { ...typography.subtitle, color: colors.foreground },
  emptySubtitle: { ...typography.body, color: colors.mutedForeground, textAlign: 'center' },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm },
  emptyButtonText: { ...typography.label, color: '#FFFFFF' },
  sectionHint: { ...typography.body, color: colors.mutedForeground, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  cardName: { ...typography.subtitle, color: colors.foreground },
  cardDescription: { ...typography.caption, color: colors.mutedForeground, marginTop: 2 },
  ruleFlow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  ruleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  ruleBadgeText: { ...typography.caption, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  actionChipText: { ...typography.caption, color: colors.mutedForeground },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  statusBadgeText: { ...typography.caption, fontWeight: '600' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  cardActionText: { ...typography.caption, fontWeight: '600' },
  addPresetBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  addPresetText: { ...typography.caption, fontWeight: '600' },
  historyDate: { ...typography.caption, color: colors.mutedForeground },
  historyError: { ...typography.caption, marginTop: spacing.xs },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalCancel: { ...typography.body, color: colors.mutedForeground },
  modalTitle: { ...typography.subtitle, color: colors.foreground },
  modalSave: { ...typography.body, color: colors.primary, fontWeight: '600' },
  formScroll: { flex: 1 },
  formContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  formGroup: { gap: spacing.xs },
  formLabel: { ...typography.label, color: colors.foreground },
  formInput: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.sm, height: sizes.inputHeight, borderWidth: 1, borderColor: colors.border, ...typography.body, color: colors.foreground },
  formTextarea: { height: 80, paddingVertical: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.primary, fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  optionChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  optionChipText: { ...typography.caption, color: colors.mutedForeground },
  actionFormCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  addActionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  addActionText: { ...typography.caption, fontWeight: '600' },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  settingsIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, flexWrap: 'wrap', gap: spacing.xs },
  settingLabel: { ...typography.body, color: colors.foreground, flex: 1 },
  savingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  savingText: { ...typography.caption, color: colors.primary },
});

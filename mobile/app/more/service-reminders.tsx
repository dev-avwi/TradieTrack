import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, iconSizes, typography, pageShell } from '../../src/lib/design-tokens';

interface Client {
  id: string;
  name: string;
}

interface ServiceReminder {
  id: string;
  clientId: string;
  jobId?: string;
  serviceType: string;
  description?: string;
  nextDueDate: string;
  intervalMonths?: number;
  reminderDays?: number;
  status?: string;
  notes?: string;
  clientName?: string;
}

const INTERVAL_OPTIONS = [
  { value: 1, label: 'Monthly' },
  { value: 3, label: 'Quarterly' },
  { value: 6, label: '6 Monthly' },
  { value: 12, label: 'Yearly' },
];

const REMINDER_DAYS_OPTIONS = [
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 30, label: '1 month' },
];

const TABS = ['upcoming', 'all', 'completed'] as const;
type Tab = typeof TABS[number];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.card,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.foreground,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOverdue: {
    borderColor: colors.destructive,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  clientName: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: colors.warningLight,
  },
  statusBadgeText: {
    color: colors.warning,
  },
  completedBadge: {
    backgroundColor: colors.successLight,
  },
  completedBadgeText: {
    color: colors.success,
  },
  intervalBadge: {
    backgroundColor: colors.muted,
  },
  intervalBadgeText: {
    color: colors.mutedForeground,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dateText: {
    fontSize: 13,
  },
  dateTextNormal: {
    color: colors.mutedForeground,
  },
  dateTextOverdue: {
    color: colors.destructive,
    fontWeight: '600',
  },
  dateTextDueSoon: {
    color: colors.warning,
    fontWeight: '500',
  },
  notes: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  completeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'] * 2,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  createButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalBody: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeOptionText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  typeOptionTextActive: {
    color: colors.primary,
  },
  clientPicker: {
    maxHeight: 200,
  },
  clientOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clientOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  clientOptionText: {
    fontSize: 15,
    color: colors.foreground,
  },
  clientOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.muted,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

function getDueDateStatus(dueDate: string): 'overdue' | 'due-soon' | 'upcoming' {
  const now = new Date();
  const due = new Date(dueDate);
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  if (due < now) return 'overdue';
  if (due < twoWeeks) return 'due-soon';
  return 'upcoming';
}

export default function ServiceRemindersScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ServiceReminder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [formData, setFormData] = useState({
    serviceType: '',
    clientId: '',
    nextDueDate: new Date().toISOString().split('T')[0],
    intervalMonths: 12,
    reminderDays: 14,
    notes: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [remindersRes, clientsRes] = await Promise.all([
        api.get<ServiceReminder[]>('/api/service-reminders'),
        api.get<Client[]>('/api/clients'),
      ]);
      if (remindersRes.data) setReminders(remindersRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const resetForm = () => {
    setFormData({
      serviceType: '',
      clientId: '',
      nextDueDate: new Date().toISOString().split('T')[0],
      intervalMonths: 12,
      reminderDays: 14,
      notes: '',
    });
  };

  const handleCreateNew = () => {
    setEditingReminder(null);
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (reminder: ServiceReminder) => {
    setEditingReminder(reminder);
    setFormData({
      serviceType: reminder.serviceType,
      clientId: reminder.clientId,
      nextDueDate: reminder.nextDueDate ? reminder.nextDueDate.split('T')[0] : new Date().toISOString().split('T')[0],
      intervalMonths: reminder.intervalMonths || 12,
      reminderDays: reminder.reminderDays || 14,
      notes: reminder.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.serviceType.trim() || !formData.clientId) {
      Alert.alert('Error', 'Service type and client are required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        serviceType: formData.serviceType,
        clientId: formData.clientId,
        nextDueDate: formData.nextDueDate,
        intervalMonths: formData.intervalMonths,
        reminderDays: formData.reminderDays,
        notes: formData.notes || null,
      };
      if (editingReminder) {
        await api.patch(`/api/service-reminders/${editingReminder.id}`, payload);
      } else {
        await api.post('/api/service-reminders', payload);
      }
      setShowModal(false);
      resetForm();
      setEditingReminder(null);
      await loadData();
      Alert.alert('Success', editingReminder ? 'Reminder updated' : 'Reminder created');
    } catch (error) {
      Alert.alert('Error', 'Failed to save reminder');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (reminder: ServiceReminder) => {
    Alert.alert('Delete Reminder', `Are you sure you want to delete "${reminder.serviceType}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/service-reminders/${reminder.id}`);
            await loadData();
            Alert.alert('Success', 'Reminder deleted');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete reminder');
          }
        },
      },
    ]);
  };

  const handleComplete = (reminder: ServiceReminder) => {
    Alert.alert(
      'Complete Service',
      `Mark "${reminder.serviceType}" as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Only',
          onPress: async () => {
            try {
              await api.post(`/api/service-reminders/${reminder.id}/complete`, { scheduleNext: false });
              await loadData();
              Alert.alert('Success', 'Service marked as completed');
            } catch (error) {
              Alert.alert('Error', 'Failed to complete service');
            }
          },
        },
        ...(reminder.intervalMonths ? [{
          text: 'Complete & Schedule Next',
          onPress: async () => {
            try {
              await api.post(`/api/service-reminders/${reminder.id}/complete`, { scheduleNext: true });
              await loadData();
              Alert.alert('Success', 'Service completed and next reminder scheduled');
            } catch (error) {
              Alert.alert('Error', 'Failed to complete service');
            }
          },
        }] : []),
      ]
    );
  };

  const filteredReminders = reminders.filter((r) => {
    if (activeTab === 'upcoming') return r.status === 'pending' || r.status === 'sent' || !r.status;
    if (activeTab === 'completed') return r.status === 'completed';
    return true;
  }).sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  const getIntervalLabel = (months?: number) => {
    if (!months) return '';
    const opt = INTERVAL_OPTIONS.find((o) => o.value === months);
    return opt ? opt.label : `${months}mo`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Service Reminders',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerRight: () => (
            <TouchableOpacity onPress={handleCreateNew} style={{ marginRight: spacing.md }}>
              <Feather name="plus" size={22} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'upcoming' ? 'Upcoming' : tab === 'all' ? 'All' : 'Completed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredReminders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="bell" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'completed' ? 'No completed reminders' : 'No service reminders yet'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'completed'
                ? 'Completed reminders will appear here'
                : 'Create your first service reminder to track recurring maintenance'}
            </Text>
            {activeTab !== 'completed' && (
              <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
                <Feather name="plus" size={iconSizes.sm} color={colors.primaryForeground} />
                <Text style={styles.createButtonText}>New Reminder</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredReminders.map((reminder) => {
            const dueDateStatus = getDueDateStatus(reminder.nextDueDate);
            const isActive = reminder.status === 'pending' || reminder.status === 'sent' || !reminder.status;
            const isOverdue = isActive && dueDateStatus === 'overdue';
            return (
              <TouchableOpacity
                key={reminder.id}
                style={[styles.card, isOverdue && styles.cardOverdue]}
                onPress={() => handleEdit(reminder)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.cardTitle}>{reminder.serviceType}</Text>
                    <View style={styles.clientRow}>
                      <Feather name="user" size={12} color={colors.mutedForeground} />
                      <Text style={styles.clientName}>{clientMap.get(reminder.clientId) || reminder.clientName || 'Unknown Client'}</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(reminder)}>
                      <Feather name="edit-2" size={iconSizes.sm} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(reminder)}>
                      <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.cardMeta}>
                  <View style={[styles.badge, reminder.status === 'completed' ? styles.completedBadge : styles.statusBadge]}>
                    <Text style={[styles.badgeText, reminder.status === 'completed' ? styles.completedBadgeText : styles.statusBadgeText]}>
                      {(reminder.status || 'pending').charAt(0).toUpperCase() + (reminder.status || 'pending').slice(1)}
                    </Text>
                  </View>
                  {reminder.intervalMonths ? (
                    <View style={[styles.badge, styles.intervalBadge]}>
                      <Feather name="refresh-cw" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.badgeText, styles.intervalBadgeText]}>{getIntervalLabel(reminder.intervalMonths)}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.dateRow}>
                  <Feather
                    name="calendar"
                    size={12}
                    color={isOverdue ? colors.destructive : dueDateStatus === 'due-soon' && isActive ? colors.warning : colors.mutedForeground}
                  />
                  <Text style={[
                    styles.dateText,
                    isOverdue ? styles.dateTextOverdue : dueDateStatus === 'due-soon' && isActive ? styles.dateTextDueSoon : styles.dateTextNormal,
                  ]}>
                    {formatDate(reminder.nextDueDate)}
                    {isOverdue && ' (Overdue)'}
                    {dueDateStatus === 'due-soon' && isActive && !isOverdue && ' (Due Soon)'}
                  </Text>
                </View>

                {reminder.notes ? (
                  <Text style={styles.notes} numberOfLines={2}>{reminder.notes}</Text>
                ) : null}

                {isActive && (
                  <TouchableOpacity style={styles.completeButton} onPress={() => handleComplete(reminder)}>
                    <Feather name="check" size={iconSizes.sm} color={colors.primaryForeground} />
                    <Text style={styles.completeButtonText}>Complete</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingReminder ? 'Edit Reminder' : 'New Reminder'}</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setEditingReminder(null); resetForm(); }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Service Type *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.serviceType}
                  onChangeText={(t) => setFormData({ ...formData, serviceType: t })}
                  placeholder="e.g., Annual AC Service"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Client *</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowClientPicker(!showClientPicker)}
                >
                  <Text style={{ color: formData.clientId ? colors.foreground : colors.mutedForeground, fontSize: 15 }}>
                    {formData.clientId ? clientMap.get(formData.clientId) || 'Select client' : 'Select client'}
                  </Text>
                </TouchableOpacity>
                {showClientPicker && (
                  <ScrollView style={[styles.clientPicker, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.xs }]}>
                    {clients.map((client) => (
                      <TouchableOpacity
                        key={client.id}
                        style={[styles.clientOption, formData.clientId === client.id && styles.clientOptionActive]}
                        onPress={() => { setFormData({ ...formData, clientId: client.id }); setShowClientPicker(false); }}
                      >
                        <Text style={[styles.clientOptionText, formData.clientId === client.id && styles.clientOptionTextActive]}>{client.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Next Due Date</Text>
                <TextInput
                  style={styles.input}
                  value={formData.nextDueDate}
                  onChangeText={(t) => setFormData({ ...formData, nextDueDate: t })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.label}>Repeat Interval</Text>
                  <View style={styles.typeSelector}>
                    {INTERVAL_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.typeOption, formData.intervalMonths === opt.value && styles.typeOptionActive]}
                        onPress={() => setFormData({ ...formData, intervalMonths: opt.value })}
                      >
                        <Text style={[styles.typeOptionText, formData.intervalMonths === opt.value && styles.typeOptionTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Remind Before</Text>
                <View style={styles.typeSelector}>
                  {REMINDER_DAYS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.typeOption, formData.reminderDays === opt.value && styles.typeOptionActive]}
                      onPress={() => setFormData({ ...formData, reminderDays: opt.value })}
                    >
                      <Text style={[styles.typeOptionText, formData.reminderDays === opt.value && styles.typeOptionTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(t) => setFormData({ ...formData, notes: t })}
                  placeholder="Additional notes..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowModal(false); setEditingReminder(null); resetForm(); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!formData.serviceType.trim() || !formData.clientId || isSaving) && styles.disabledButton]}
                onPress={handleSave}
                disabled={!formData.serviceType.trim() || !formData.clientId || isSaving}
              >
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : editingReminder ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

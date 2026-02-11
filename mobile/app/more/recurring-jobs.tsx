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

type FrequencyType = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

interface Client {
  id: string;
  name: string;
}

interface RecurringContract {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  frequency: string;
  contractValue?: string;
  startDate: string;
  endDate?: string;
  nextJobDate: string;
  status?: string;
  clientName?: string;
}

const FREQUENCIES: FrequencyType[] = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];

const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
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
    marginBottom: spacing.sm,
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
    backgroundColor: colors.successLight,
  },
  statusBadgeText: {
    color: colors.success,
  },
  pausedBadge: {
    backgroundColor: colors.warningLight,
  },
  pausedBadgeText: {
    color: colors.warning,
  },
  frequencyBadge: {
    backgroundColor: colors.muted,
  },
  frequencyBadgeText: {
    color: colors.mutedForeground,
  },
  valueBadge: {
    backgroundColor: colors.successLight,
  },
  valueBadgeText: {
    color: colors.success,
  },
  nextDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  nextDateText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  description: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  generateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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

export default function RecurringJobsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [contracts, setContracts] = useState<RecurringContract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState<RecurringContract | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientId: '',
    frequency: 'monthly' as FrequencyType,
    contractValue: '',
    startDate: new Date().toISOString().split('T')[0],
  });

  const loadData = useCallback(async () => {
    try {
      const [contractsRes, clientsRes] = await Promise.all([
        api.get<RecurringContract[]>('/api/recurring-contracts'),
        api.get<Client[]>('/api/clients'),
      ]);
      if (contractsRes.data) setContracts(contractsRes.data);
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
      title: '',
      description: '',
      clientId: '',
      frequency: 'monthly',
      contractValue: '',
      startDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleCreateNew = () => {
    setEditingContract(null);
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (contract: RecurringContract) => {
    setEditingContract(contract);
    setFormData({
      title: contract.title,
      description: contract.description || '',
      clientId: contract.clientId,
      frequency: (contract.frequency || 'monthly') as FrequencyType,
      contractValue: contract.contractValue || '',
      startDate: contract.startDate ? contract.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.clientId) {
      Alert.alert('Error', 'Title and client are required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        clientId: formData.clientId,
        frequency: formData.frequency,
        contractValue: formData.contractValue || null,
        startDate: formData.startDate,
        nextJobDate: formData.startDate,
      };
      if (editingContract) {
        await api.request('PUT', `/api/recurring-contracts/${editingContract.id}`, payload);
      } else {
        await api.post('/api/recurring-contracts', payload);
      }
      setShowModal(false);
      resetForm();
      setEditingContract(null);
      await loadData();
      Alert.alert('Success', editingContract ? 'Contract updated' : 'Contract created');
    } catch (error) {
      Alert.alert('Error', 'Failed to save contract');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (contract: RecurringContract) => {
    Alert.alert('Delete Contract', `Are you sure you want to delete "${contract.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/recurring-contracts/${contract.id}`);
            await loadData();
            Alert.alert('Success', 'Contract deleted');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete contract');
          }
        },
      },
    ]);
  };

  const handleGenerateJob = async (contract: RecurringContract) => {
    Alert.alert('Generate Job', `Generate a job from "${contract.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Generate',
        onPress: async () => {
          try {
            await api.post(`/api/recurring-contracts/${contract.id}/generate-job`);
            await loadData();
            Alert.alert('Success', 'Job generated successfully');
          } catch (error) {
            Alert.alert('Error', 'Failed to generate job');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Recurring Jobs',
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
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : contracts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="repeat" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No recurring jobs yet</Text>
            <Text style={styles.emptyText}>Set up recurring jobs for regular maintenance or scheduled work</Text>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
              <Feather name="plus" size={iconSizes.sm} color={colors.primaryForeground} />
              <Text style={styles.createButtonText}>Create Recurring Job</Text>
            </TouchableOpacity>
          </View>
        ) : (
          contracts.map((contract) => {
            const isActive = !contract.status || contract.status === 'active';
            const isPaused = contract.status === 'paused';
            return (
              <TouchableOpacity key={contract.id} style={styles.card} onPress={() => handleEdit(contract)} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{contract.title}</Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleGenerateJob(contract)}>
                      <Feather name="zap" size={iconSizes.sm} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(contract)}>
                      <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.clientRow}>
                  <Feather name="user" size={12} color={colors.mutedForeground} />
                  <Text style={styles.clientName}>{clientMap.get(contract.clientId) || contract.clientName || 'Unknown Client'}</Text>
                </View>
                {contract.description ? (
                  <Text style={styles.description} numberOfLines={2}>{contract.description}</Text>
                ) : null}
                <View style={styles.cardMeta}>
                  <View style={[styles.badge, isActive ? styles.statusBadge : isPaused ? styles.pausedBadge : styles.frequencyBadge]}>
                    <Feather name={isActive ? 'play' : isPaused ? 'pause' : 'check'} size={10} color={isActive ? colors.success : isPaused ? colors.warning : colors.mutedForeground} />
                    <Text style={[styles.badgeText, isActive ? styles.statusBadgeText : isPaused ? styles.pausedBadgeText : styles.frequencyBadgeText]}>
                      {(contract.status || 'active').charAt(0).toUpperCase() + (contract.status || 'active').slice(1)}
                    </Text>
                  </View>
                  <View style={[styles.badge, styles.frequencyBadge]}>
                    <Feather name="clock" size={10} color={colors.mutedForeground} />
                    <Text style={[styles.badgeText, styles.frequencyBadgeText]}>
                      {FREQUENCY_LABELS[(contract.frequency || 'monthly') as FrequencyType] || contract.frequency}
                    </Text>
                  </View>
                  {contract.contractValue ? (
                    <View style={[styles.badge, styles.valueBadge]}>
                      <Text style={[styles.badgeText, styles.valueBadgeText]}>${parseFloat(contract.contractValue).toLocaleString()}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.nextDateRow}>
                  <Feather name="calendar" size={12} color={colors.mutedForeground} />
                  <Text style={styles.nextDateText}>Next job: {formatDate(contract.nextJobDate)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingContract ? 'Edit Recurring Job' : 'Create Recurring Job'}</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setEditingContract(null); resetForm(); }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(t) => setFormData({ ...formData, title: t })}
                  placeholder="e.g., Monthly AC Maintenance"
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
                <Text style={styles.label}>Frequency</Text>
                <View style={styles.typeSelector}>
                  {FREQUENCIES.map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.typeOption, formData.frequency === f && styles.typeOptionActive]}
                      onPress={() => setFormData({ ...formData, frequency: f })}
                    >
                      <Text style={[styles.typeOptionText, formData.frequency === f && styles.typeOptionTextActive]}>{FREQUENCY_LABELS[f]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contract Value ($)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.contractValue}
                  onChangeText={(t) => setFormData({ ...formData, contractValue: t })}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Start Date</Text>
                <TextInput
                  style={styles.input}
                  value={formData.startDate}
                  onChangeText={(t) => setFormData({ ...formData, startDate: t })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(t) => setFormData({ ...formData, description: t })}
                  placeholder="Job details, notes..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowModal(false); setEditingContract(null); resetForm(); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!formData.title.trim() || !formData.clientId || isSaving) && styles.disabledButton]}
                onPress={handleSave}
                disabled={!formData.title.trim() || !formData.clientId || isSaving}
              >
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : editingContract ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

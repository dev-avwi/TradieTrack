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
import { Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, iconSizes } from '../../src/lib/design-tokens';

interface Rebate {
  id: string;
  name: string;
  rebateType: string;
  amount: string;
  status: string;
  description?: string;
  clientId?: string;
  jobId?: string;
  invoiceId?: string;
  referenceNumber?: string;
  expiryDate?: string;
  submittedDate?: string;
  approvedDate?: string;
  receivedDate?: string;
  createdAt?: string;
}

interface RebateSummary {
  pending: number;
  submitted: number;
  approved: number;
  received: number;
  rejected: number;
}

interface Client {
  id: string;
  name: string;
}

interface Job {
  id: string;
  title: string;
}

const REBATE_TYPES = [
  { value: 'manufacturer_rebate', label: 'Manufacturer' },
  { value: 'government_incentive', label: 'Government' },
  { value: 'energy_rebate', label: 'Energy' },
  { value: 'trade_discount', label: 'Trade Discount' },
  { value: 'loyalty_reward', label: 'Loyalty' },
  { value: 'other', label: 'Other' },
];

const REBATE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'received', label: 'Received' },
  { value: 'rejected', label: 'Rejected' },
];

const TYPE_ICONS: Record<string, string> = {
  manufacturer_rebate: 'package',
  government_incentive: 'award',
  energy_rebate: 'zap',
  trade_discount: 'tag',
  loyalty_reward: 'star',
  other: 'file-text',
};

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}

function getStatusColor(status: string, colors: ThemeColors) {
  switch (status) {
    case 'pending': return { bg: colors.warningLight, text: colors.warning };
    case 'submitted': return { bg: colors.infoLight, text: colors.info };
    case 'approved': return { bg: colors.primaryLight, text: colors.primary };
    case 'received': return { bg: colors.successLight, text: colors.success };
    case 'rejected': return { bg: colors.destructiveLight, text: colors.destructive };
    default: return { bg: colors.muted, text: colors.mutedForeground };
  }
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: spacing.xs },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.lg },
  createButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, gap: spacing.xs,
  },
  createButtonText: { color: colors.primaryForeground, fontSize: 14, fontWeight: '600' },
  rebateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rebateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  rebateIconContainer: {
    width: 40, height: 40, borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rebateActions: { flexDirection: 'row', gap: spacing.xs },
  actionButton: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  rebateName: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: spacing.xs },
  rebateAmount: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  rebateDescription: { fontSize: 13, color: colors.mutedForeground, marginBottom: spacing.sm },
  rebateMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.sm, gap: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '500' },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.sm, gap: 4,
  },
  metaBadgeText: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  modalBody: { padding: spacing.lg },
  inputGroup: { marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.background, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.foreground,
    borderWidth: 1, borderColor: colors.border,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' as any },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, gap: spacing.xs,
    borderWidth: 1, borderColor: 'transparent',
  },
  typeOptionActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  typeOptionText: { fontSize: 13, color: colors.mutedForeground, fontWeight: '500' },
  typeOptionTextActive: { color: colors.primary },
  statusSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modalFooter: {
    flexDirection: 'row', gap: spacing.md,
    padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1, backgroundColor: colors.muted,
    paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  saveButton: {
    flex: 1, backgroundColor: colors.primary,
    paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center',
  },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: colors.primaryForeground },
  pickerRow: { flexDirection: 'row', gap: spacing.sm },
});

export default function RebatesScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [rebates, setRebates] = useState<Rebate[]>([]);
  const [summary, setSummary] = useState<RebateSummary>({ pending: 0, submitted: 0, approved: 0, received: 0, rejected: 0 });
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRebate, setEditingRebate] = useState<Rebate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '', rebateType: 'manufacturer_rebate', amount: '',
    status: 'pending', description: '', referenceNumber: '',
    clientId: '', jobId: '',
  });

  const resetForm = () => {
    setFormData({
      name: '', rebateType: 'manufacturer_rebate', amount: '',
      status: 'pending', description: '', referenceNumber: '',
      clientId: '', jobId: '',
    });
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [rebatesRes, summaryRes, clientsRes, jobsRes] = await Promise.all([
        api.get<Rebate[]>('/api/rebates'),
        api.get<RebateSummary>('/api/rebates/summary'),
        api.get<Client[]>('/api/clients'),
        api.get<Job[]>('/api/jobs'),
      ]);
      if (rebatesRes.data) setRebates(rebatesRes.data);
      if (summaryRes.data) setSummary(summaryRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
    } catch (error) {
      console.error('Error loading rebates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCreateNew = () => {
    setEditingRebate(null);
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (rebate: Rebate) => {
    setEditingRebate(rebate);
    setFormData({
      name: rebate.name,
      rebateType: rebate.rebateType,
      amount: rebate.amount,
      status: rebate.status,
      description: rebate.description || '',
      referenceNumber: rebate.referenceNumber || '',
      clientId: rebate.clientId || '',
      jobId: rebate.jobId || '',
    });
    setShowModal(true);
  };

  const handleDelete = (rebate: Rebate) => {
    Alert.alert('Delete Rebate', `Are you sure you want to delete "${rebate.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/rebates/${rebate.id}`);
            await loadData();
            Alert.alert('Success', 'Rebate deleted');
          } catch { Alert.alert('Error', 'Failed to delete rebate'); }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.amount.trim()) {
      Alert.alert('Error', 'Name and amount are required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        rebateType: formData.rebateType,
        amount: formData.amount,
        status: formData.status,
        description: formData.description || null,
        referenceNumber: formData.referenceNumber || null,
        clientId: formData.clientId || null,
        jobId: formData.jobId || null,
      };
      if (editingRebate) {
        await api.patch(`/api/rebates/${editingRebate.id}`, payload);
        Alert.alert('Success', 'Rebate updated');
      } else {
        await api.post('/api/rebates', payload);
        Alert.alert('Success', 'Rebate created');
      }
      setShowModal(false);
      resetForm();
      setEditingRebate(null);
      await loadData();
    } catch {
      Alert.alert('Error', 'Failed to save rebate');
    } finally {
      setIsSaving(false);
    }
  };

  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  const jobMap = new Map(jobs.map(j => [j.id, j.title]));

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true, title: 'Rebates & Credits',
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
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.pending)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Submitted</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.submitted + summary.approved)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Received</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(summary.received)}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : rebates.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="dollar-sign" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No rebates yet</Text>
            <Text style={styles.emptyText}>Track manufacturer rebates, government incentives and credits</Text>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
              <Feather name="plus" size={iconSizes.sm} color={colors.primaryForeground} />
              <Text style={styles.createButtonText}>Add Rebate</Text>
            </TouchableOpacity>
          </View>
        ) : (
          rebates.map(rebate => {
            const statusColor = getStatusColor(rebate.status, colors);
            const typeIcon = TYPE_ICONS[rebate.rebateType] || 'file-text';
            const typeLabel = REBATE_TYPES.find(t => t.value === rebate.rebateType)?.label || rebate.rebateType;
            return (
              <TouchableOpacity key={rebate.id} style={styles.rebateCard} onPress={() => handleEdit(rebate)} activeOpacity={0.7}>
                <View style={styles.rebateHeader}>
                  <View style={styles.rebateIconContainer}>
                    <Feather name={typeIcon as any} size={iconSizes.lg} color={colors.primary} />
                  </View>
                  <View style={styles.rebateActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(rebate)}>
                      <Feather name="edit-2" size={iconSizes.sm} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(rebate)}>
                      <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.rebateName}>{rebate.name}</Text>
                <Text style={styles.rebateAmount}>{formatCurrency(rebate.amount)}</Text>
                {rebate.description ? <Text style={styles.rebateDescription} numberOfLines={2}>{rebate.description}</Text> : null}
                <View style={styles.rebateMeta}>
                  <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
                    <Text style={[styles.badgeText, { color: statusColor.text, textTransform: 'capitalize' }]}>{rebate.status}</Text>
                  </View>
                  <View style={styles.metaBadge}>
                    <Feather name={typeIcon as any} size={10} color={colors.mutedForeground} />
                    <Text style={styles.metaBadgeText}>{typeLabel}</Text>
                  </View>
                  {rebate.clientId && clientMap.get(rebate.clientId) && (
                    <View style={styles.metaBadge}>
                      <Feather name="user" size={10} color={colors.mutedForeground} />
                      <Text style={styles.metaBadgeText}>{clientMap.get(rebate.clientId)}</Text>
                    </View>
                  )}
                  {rebate.jobId && jobMap.get(rebate.jobId) && (
                    <View style={styles.metaBadge}>
                      <Feather name="briefcase" size={10} color={colors.mutedForeground} />
                      <Text style={styles.metaBadgeText}>{jobMap.get(rebate.jobId)}</Text>
                    </View>
                  )}
                  {rebate.referenceNumber ? (
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeText}>Ref: {rebate.referenceNumber}</Text>
                    </View>
                  ) : null}
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
              <Text style={styles.modalTitle}>{editingRebate ? 'Edit Rebate' : 'Add Rebate'}</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setEditingRebate(null); resetForm(); }}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input} value={formData.name}
                  onChangeText={v => setFormData(p => ({ ...p, name: v }))}
                  placeholder="e.g., Daikin Cashback" placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Amount ($)</Text>
                <TextInput
                  style={styles.input} value={formData.amount}
                  onChangeText={v => setFormData(p => ({ ...p, amount: v }))}
                  keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeSelector}>
                  {REBATE_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.value}
                      style={[styles.typeOption, formData.rebateType === type.value && styles.typeOptionActive]}
                      onPress={() => setFormData(p => ({ ...p, rebateType: type.value }))}
                    >
                      <Feather name={TYPE_ICONS[type.value] as any} size={14} color={formData.rebateType === type.value ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.typeOptionText, formData.rebateType === type.value && styles.typeOptionTextActive]}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.statusSelector}>
                  {REBATE_STATUSES.map(s => {
                    const sc = getStatusColor(s.value, colors);
                    return (
                      <TouchableOpacity
                        key={s.value}
                        style={[styles.typeOption, formData.status === s.value && { backgroundColor: sc.bg, borderColor: sc.text }]}
                        onPress={() => setFormData(p => ({ ...p, status: s.value }))}
                      >
                        <Text style={[styles.typeOptionText, formData.status === s.value && { color: sc.text }]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Reference Number</Text>
                <TextInput
                  style={styles.input} value={formData.referenceNumber}
                  onChangeText={v => setFormData(p => ({ ...p, referenceNumber: v }))}
                  placeholder="Optional reference" placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]} value={formData.description}
                  onChangeText={v => setFormData(p => ({ ...p, description: v }))}
                  placeholder="Brief description..." placeholderTextColor={colors.mutedForeground}
                  multiline numberOfLines={3}
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowModal(false); setEditingRebate(null); resetForm(); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving}>
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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

type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost';
type LeadSource = 'phone' | 'email' | 'website' | 'referral' | 'other';

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: string;
  description?: string;
  estimatedValue?: string;
  notes?: string;
  followUpDate?: string;
}

const STATUS_LIST: LeadStatus[] = ['new', 'contacted', 'quoted', 'won', 'lost'];
const SOURCE_LIST: LeadSource[] = ['phone', 'email', 'website', 'referral', 'other'];

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  referral: 'Referral',
  other: 'Other',
};

const SOURCE_ICONS: Record<LeadSource, string> = {
  phone: 'phone',
  email: 'mail',
  website: 'globe',
  referral: 'user-plus',
  other: 'message-square',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.foreground,
    marginLeft: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.muted,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  filterTabTextActive: {
    color: colors.primaryForeground,
  },
  statusGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  statusGroupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusCount: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontWeight: '500',
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
  cardName: {
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
  sourceBadge: {
    backgroundColor: colors.muted,
  },
  sourceBadgeText: {
    color: colors.mutedForeground,
  },
  valueBadge: {
    backgroundColor: colors.successLight,
  },
  valueBadgeText: {
    color: colors.success,
  },
  followUpBadge: {
    backgroundColor: colors.muted,
  },
  followUpBadgeText: {
    color: colors.mutedForeground,
  },
  overdueBadge: {
    backgroundColor: colors.destructiveLight,
  },
  overdueBadgeText: {
    color: colors.destructive,
  },
  description: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  convertButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
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
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
});

function getStatusColor(status: string, colors: ThemeColors) {
  switch (status) {
    case 'new': return { bg: colors.primaryLight, text: colors.primary };
    case 'contacted': return { bg: colors.infoLight, text: colors.info };
    case 'quoted': return { bg: colors.warningLight, text: colors.warning };
    case 'won': return { bg: colors.successLight, text: colors.success };
    case 'lost': return { bg: colors.destructiveLight, text: colors.destructive };
    default: return { bg: colors.muted, text: colors.mutedForeground };
  }
}

export default function LeadsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'other' as LeadSource,
    status: 'new' as LeadStatus,
    description: '',
    estimatedValue: '',
    notes: '',
    followUpDate: '',
  });

  const loadLeads = useCallback(async () => {
    try {
      const res = await api.get<Lead[]>('/api/leads');
      if (res.data) {
        setLeads(res.data);
      }
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadLeads();
    }, [loadLeads])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLeads();
    setIsRefreshing(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      source: 'other',
      status: 'new',
      description: '',
      estimatedValue: '',
      notes: '',
      followUpDate: '',
    });
  };

  const handleCreateNew = () => {
    setEditingLead(null);
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      source: (lead.source || 'other') as LeadSource,
      status: (lead.status || 'new') as LeadStatus,
      description: lead.description || '',
      estimatedValue: lead.estimatedValue || '',
      notes: lead.notes || '',
      followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        estimatedValue: formData.estimatedValue || null,
        followUpDate: formData.followUpDate || null,
      };
      if (editingLead) {
        await api.request('PUT', `/api/leads/${editingLead.id}`, payload);
      } else {
        await api.post('/api/leads', payload);
      }
      setShowModal(false);
      resetForm();
      setEditingLead(null);
      await loadLeads();
      Alert.alert('Success', editingLead ? 'Lead updated' : 'Lead created');
    } catch (error) {
      Alert.alert('Error', 'Failed to save lead');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (lead: Lead) => {
    Alert.alert('Delete Lead', `Are you sure you want to delete "${lead.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/leads/${lead.id}`);
            await loadLeads();
            Alert.alert('Success', 'Lead deleted');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete lead');
          }
        },
      },
    ]);
  };

  const handleConvert = (lead: Lead) => {
    Alert.alert(
      'Convert to Client',
      `Convert "${lead.name}" to a client?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            try {
              await api.post(`/api/leads/${lead.id}/convert`, { createJob: false, createQuote: false });
              await loadLeads();
              Alert.alert('Success', 'Lead converted to client');
            } catch (error) {
              Alert.alert('Error', 'Failed to convert lead');
            }
          },
        },
      ]
    );
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = searchQuery === '' ||
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const groupedLeads: Record<LeadStatus, Lead[]> = {
    new: [], contacted: [], quoted: [], won: [], lost: [],
  };
  filteredLeads.forEach((lead) => {
    const s = (lead.status || 'new') as LeadStatus;
    groupedLeads[s]?.push(lead);
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Leads',
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
        <View style={styles.searchContainer}>
          <Feather name="search" size={iconSizes.md} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={iconSizes.md} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterTab, statusFilter === 'all' && styles.filterTabActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.filterTabText, statusFilter === 'all' && styles.filterTabTextActive]}>All</Text>
          </TouchableOpacity>
          {STATUS_LIST.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterTab, statusFilter === s && styles.filterTabActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterTabText, statusFilter === s && styles.filterTabTextActive]}>
                {STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredLeads.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="users" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No leads yet</Text>
            <Text style={styles.emptyText}>Start tracking your enquiries and convert them to clients</Text>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
              <Feather name="plus" size={iconSizes.sm} color={colors.primaryForeground} />
              <Text style={styles.createButtonText}>Add Lead</Text>
            </TouchableOpacity>
          </View>
        ) : (
          STATUS_LIST.map((status) => {
            const group = groupedLeads[status];
            if (statusFilter !== 'all' && statusFilter !== status) return null;
            if (group.length === 0) return null;
            const sc = getStatusColor(status, colors);
            return (
              <View key={status}>
                <View style={styles.statusGroupHeader}>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.badgeText, { color: sc.text }]}>{STATUS_LABELS[status]}</Text>
                  </View>
                  <Text style={styles.statusCount}>({group.length})</Text>
                </View>
                {group.map((lead) => {
                  const source = (lead.source || 'other') as LeadSource;
                  const overdue = isOverdue(lead.followUpDate);
                  return (
                    <TouchableOpacity key={lead.id} style={styles.card} onPress={() => handleEdit(lead)} activeOpacity={0.7}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardName} numberOfLines={1}>{lead.name}</Text>
                        <View style={styles.cardActions}>
                          {lead.status !== 'won' && lead.status !== 'lost' && (
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleConvert(lead)}>
                              <Feather name="user-check" size={iconSizes.sm} color={colors.success} />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(lead)}>
                            <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {lead.description ? (
                        <Text style={styles.description} numberOfLines={2}>{lead.description}</Text>
                      ) : null}
                      <View style={styles.cardMeta}>
                        <View style={[styles.badge, styles.sourceBadge]}>
                          <Feather name={SOURCE_ICONS[source] as any} size={10} color={colors.mutedForeground} />
                          <Text style={[styles.badgeText, styles.sourceBadgeText]}>{SOURCE_LABELS[source]}</Text>
                        </View>
                        {lead.estimatedValue ? (
                          <View style={[styles.badge, styles.valueBadge]}>
                            <Feather name="dollar-sign" size={10} color={colors.success} />
                            <Text style={[styles.badgeText, styles.valueBadgeText]}>${parseFloat(lead.estimatedValue).toLocaleString()}</Text>
                          </View>
                        ) : null}
                        {lead.followUpDate ? (
                          <View style={[styles.badge, overdue ? styles.overdueBadge : styles.followUpBadge]}>
                            <Feather name="calendar" size={10} color={overdue ? colors.destructive : colors.mutedForeground} />
                            <Text style={[styles.badgeText, overdue ? styles.overdueBadgeText : styles.followUpBadgeText]}>
                              {formatDate(lead.followUpDate)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingLead ? 'Edit Lead' : 'Add Lead'}</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setEditingLead(null); resetForm(); }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(t) => setFormData({ ...formData, name: t })}
                  placeholder="Lead name"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(t) => setFormData({ ...formData, email: t })}
                    placeholder="email@example.com"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.label}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.phone}
                    onChangeText={(t) => setFormData({ ...formData, phone: t })}
                    placeholder="0400 000 000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Source</Text>
                <View style={styles.typeSelector}>
                  {SOURCE_LIST.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.typeOption, formData.source === s && styles.typeOptionActive]}
                      onPress={() => setFormData({ ...formData, source: s })}
                    >
                      <Feather name={SOURCE_ICONS[s] as any} size={12} color={formData.source === s ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.typeOptionText, formData.source === s && styles.typeOptionTextActive]}>{SOURCE_LABELS[s]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.typeSelector}>
                  {STATUS_LIST.map((s) => {
                    const sc = getStatusColor(s, colors);
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.typeOption, formData.status === s && { backgroundColor: sc.bg, borderColor: sc.text }]}
                        onPress={() => setFormData({ ...formData, status: s })}
                      >
                        <Text style={[styles.typeOptionText, formData.status === s && { color: sc.text }]}>{STATUS_LABELS[s]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(t) => setFormData({ ...formData, description: t })}
                  placeholder="Brief description..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
              </View>
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.label}>Estimated Value ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.estimatedValue}
                    onChangeText={(t) => setFormData({ ...formData, estimatedValue: t })}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, styles.halfInput]}>
                  <Text style={styles.label}>Follow-up Date</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.followUpDate}
                    onChangeText={(t) => setFormData({ ...formData, followUpDate: t })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                  />
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
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowModal(false); setEditingLead(null); resetForm(); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!formData.name.trim() || isSaving) && styles.disabledButton]}
                onPress={handleSave}
                disabled={!formData.name.trim() || isSaving}
              >
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : editingLead ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, typography, iconSizes, sizes } from '../../src/lib/design-tokens';

type LeadSource = 'phone' | 'email' | 'website' | 'referral' | 'other';
type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost';
type FilterType = 'all' | LeadStatus;

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  status?: LeadStatus;
  description?: string;
  estimatedValue?: string;
  notes?: string;
  followUpDate?: string;
  createdAt?: string;
}

const SOURCE_OPTIONS: { value: LeadSource; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'phone', label: 'Phone', icon: 'phone' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'website', label: 'Website', icon: 'globe' },
  { value: 'referral', label: 'Referral', icon: 'user-plus' },
  { value: 'other', label: 'Other', icon: 'message-square' },
];

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const getStatusConfig = (status: LeadStatus | undefined, colors: ThemeColors) => {
  switch (status) {
    case 'new':
      return { label: 'New', color: colors.primary, bgColor: colors.primaryLight, icon: 'star' as const };
    case 'contacted':
      return { label: 'Contacted', color: colors.info, bgColor: colors.infoLight, icon: 'phone-forwarded' as const };
    case 'quoted':
      return { label: 'Quoted', color: colors.warning, bgColor: colors.warningLight, icon: 'file-text' as const };
    case 'won':
      return { label: 'Won', color: colors.success, bgColor: colors.successLight, icon: 'check-circle' as const };
    case 'lost':
      return { label: 'Lost', color: colors.destructive, bgColor: colors.destructiveLight || colors.muted, icon: 'x-circle' as const };
    default:
      return { label: 'New', color: colors.mutedForeground, bgColor: colors.muted, icon: 'star' as const };
  }
};

const getSourceIcon = (source: LeadSource | undefined): keyof typeof Feather.glyphMap => {
  const found = SOURCE_OPTIONS.find(s => s.value === source);
  return found?.icon || 'message-square';
};

const formatCurrency = (amount: string | number | undefined): string => {
  if (!amount) return '$0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(num);
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function LeadsScreen() {
  const { colors } = useTheme();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'other' as LeadSource,
    status: 'new' as LeadStatus,
    description: '',
    estimatedValue: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [convertOptions, setConvertOptions] = useState({
    createJob: false,
    createQuote: false,
    createInspection: false,
  });

  const fetchLeads = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Lead[]>('/api/leads');
      if (res.data) setLeads(res.data);
    } catch (e) {
      setError('Failed to load leads. Pull down to retry.');
      console.error('Error fetching leads:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = searchQuery === '' ||
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'all' || (lead.status || 'new') === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [leads, searchQuery, activeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    leads.forEach(lead => {
      const s = lead.status || 'new';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [leads]);

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', source: 'other', status: 'new', description: '', estimatedValue: '', notes: '' });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required', 'Lead name is required');
      return;
    }
    if (formData.estimatedValue && isNaN(parseFloat(formData.estimatedValue))) {
      Alert.alert('Invalid', 'Estimated value must be a valid number');
      return;
    }
    setSaving(true);
    try {
      const parsedValue = formData.estimatedValue ? parseFloat(formData.estimatedValue) : null;
      const payload = {
        ...formData,
        estimatedValue: parsedValue !== null && !isNaN(parsedValue) ? parsedValue.toFixed(2) : null,
      };
      if (editingLead) {
        await api.patch(`/api/leads/${editingLead.id}`, payload);
      } else {
        await api.post('/api/leads', payload);
      }
      resetForm();
      setShowForm(false);
      setEditingLead(null);
      fetchLeads();
    } catch (e) {
      Alert.alert('Error', 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (lead: Lead) => {
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      source: (lead.source || 'other') as LeadSource,
      status: (lead.status || 'new') as LeadStatus,
      description: lead.description || '',
      estimatedValue: lead.estimatedValue || '',
      notes: lead.notes || '',
    });
    setEditingLead(lead);
    setShowForm(true);
  };

  const handleDelete = (lead: Lead) => {
    Alert.alert('Delete Lead', `Are you sure you want to delete "${lead.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/leads/${lead.id}`);
            fetchLeads();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete lead');
          }
        }
      },
    ]);
  };

  const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
    try {
      await api.patch(`/api/leads/${lead.id}`, { status: newStatus });
      fetchLeads();
    } catch (e) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleConvert = async () => {
    if (!leadToConvert) return;
    setSaving(true);
    try {
      const res = await api.post<{ client?: { id: string } }>(`/api/leads/${leadToConvert.id}/convert`, convertOptions);
      setShowConvertModal(false);
      setLeadToConvert(null);
      setConvertOptions({ createJob: false, createQuote: false, createInspection: false });
      fetchLeads();
      if (res.data?.client?.id) {
        router.push(`/more/client/${res.data.client.id}` as any);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to convert lead');
    } finally {
      setSaving(false);
    }
  };

  const styles = createStyles(colors);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'quoted', label: 'Quoted' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading leads...</Text>
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
            <Text style={styles.headerTitle}>Leads</Text>
            <Text style={styles.headerSubtitle}>{leads.length} total leads</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerAction, { backgroundColor: colors.primary }]}
            onPress={() => { resetForm(); setEditingLead(null); setShowForm(true); }}
          >
            <Feather name="plus" size={iconSizes.sm} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={iconSizes.sm} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={iconSizes.sm} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
                {f.label} {statusCounts[f.key] ? `(${statusCounts[f.key]})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.destructive}12` }]}>
              <Feather name="alert-circle" size={28} color={colors.destructive} />
            </View>
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => { setLoading(true); fetchLeads(); }}>
              <Feather name="refresh-cw" size={iconSizes.sm} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredLeads.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Feather name="user-plus" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Leads Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || activeFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first lead to get started'}
            </Text>
            {!searchQuery && activeFilter === 'all' && (
              <TouchableOpacity style={styles.emptyButton} onPress={() => { resetForm(); setEditingLead(null); setShowForm(true); }}>
                <Feather name="plus" size={iconSizes.sm} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Add Lead</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredLeads.map(lead => {
            const statusConfig = getStatusConfig(lead.status as LeadStatus, colors);
            return (
              <TouchableOpacity key={lead.id} style={styles.card} onPress={() => handleEdit(lead)} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{lead.name}</Text>
                    {lead.description && <Text style={styles.cardDescription} numberOfLines={1}>{lead.description}</Text>}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <Feather name={statusConfig.icon} size={12} color={statusConfig.color} />
                    <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                  </View>
                </View>

                <View style={styles.cardMeta}>
                  {lead.phone && (
                    <View style={styles.metaItem}>
                      <Feather name="phone" size={12} color={colors.mutedForeground} />
                      <Text style={styles.metaText}>{lead.phone}</Text>
                    </View>
                  )}
                  {lead.email && (
                    <View style={styles.metaItem}>
                      <Feather name="mail" size={12} color={colors.mutedForeground} />
                      <Text style={styles.metaText} numberOfLines={1}>{lead.email}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.metaItem}>
                    <Feather name={getSourceIcon(lead.source as LeadSource)} size={12} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{SOURCE_OPTIONS.find(s => s.value === lead.source)?.label || 'Other'}</Text>
                  </View>
                  {lead.estimatedValue && parseFloat(lead.estimatedValue) > 0 && (
                    <View style={styles.metaItem}>
                      <Feather name="dollar-sign" size={12} color={colors.success} />
                      <Text style={[styles.metaText, { color: colors.success }]}>{formatCurrency(lead.estimatedValue)}</Text>
                    </View>
                  )}
                  {lead.followUpDate && (
                    <View style={styles.metaItem}>
                      <Feather name="calendar" size={12} color={colors.warning} />
                      <Text style={[styles.metaText, { color: colors.warning }]}>{formatDate(lead.followUpDate)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardActions}>
                  {(lead.status || 'new') !== 'won' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.successLight }]}
                      onPress={(e) => { e.stopPropagation?.(); setLeadToConvert(lead); setShowConvertModal(true); }}
                    >
                      <Feather name="user-check" size={14} color={colors.success} />
                      <Text style={[styles.actionButtonText, { color: colors.success }]}>Convert</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.muted }]}
                    onPress={(e) => { e.stopPropagation?.(); handleDelete(lead); }}
                  >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowForm(false); setEditingLead(null); resetForm(); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingLead ? 'Edit Lead' : 'New Lead'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput style={styles.formInput} value={formData.name} onChangeText={v => setFormData(p => ({ ...p, name: v }))} placeholder="Lead name" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput style={styles.formInput} value={formData.email} onChangeText={v => setFormData(p => ({ ...p, email: v }))} placeholder="email@example.com" placeholderTextColor={colors.mutedForeground} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone</Text>
              <TextInput style={styles.formInput} value={formData.phone} onChangeText={v => setFormData(p => ({ ...p, phone: v }))} placeholder="Phone number" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Source</Text>
              <View style={styles.optionRow}>
                {SOURCE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionChip, formData.source === opt.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                    onPress={() => setFormData(p => ({ ...p, source: opt.value }))}
                  >
                    <Feather name={opt.icon} size={14} color={formData.source === opt.value ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.optionChipText, formData.source === opt.value && { color: colors.primary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Status</Text>
              <View style={styles.optionRow}>
                {STATUS_OPTIONS.map(opt => {
                  const sc = getStatusConfig(opt.value, colors);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionChip, formData.status === opt.value && { backgroundColor: sc.bgColor, borderColor: sc.color }]}
                      onPress={() => setFormData(p => ({ ...p, status: opt.value }))}
                    >
                      <Text style={[styles.optionChipText, formData.status === opt.value && { color: sc.color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Estimated Value</Text>
              <TextInput style={styles.formInput} value={formData.estimatedValue} onChangeText={v => setFormData(p => ({ ...p, estimatedValue: v }))} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={[styles.formInput, styles.formTextarea]} value={formData.description} onChangeText={v => setFormData(p => ({ ...p, description: v }))} placeholder="Brief description of the lead" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput style={[styles.formInput, styles.formTextarea]} value={formData.notes} onChangeText={v => setFormData(p => ({ ...p, notes: v }))} placeholder="Internal notes" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showConvertModal} animationType="slide" transparent>
        <View style={styles.convertOverlay}>
          <View style={styles.convertModal}>
            <Text style={styles.convertTitle}>Convert Lead to Client</Text>
            <Text style={styles.convertSubtitle}>
              {leadToConvert?.name} will be converted to a client. Optionally create related records:
            </Text>
            <TouchableOpacity style={styles.convertOption} onPress={() => setConvertOptions(p => ({ ...p, createJob: !p.createJob }))}>
              <View style={[styles.convertCheckbox, convertOptions.createJob && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {convertOptions.createJob && <Feather name="check" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.convertOptionText}>Create a job</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.convertOption} onPress={() => setConvertOptions(p => ({ ...p, createQuote: !p.createQuote }))}>
              <View style={[styles.convertCheckbox, convertOptions.createQuote && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {convertOptions.createQuote && <Feather name="check" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.convertOptionText}>Create a quote</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.convertOption} onPress={() => setConvertOptions(p => ({ ...p, createInspection: !p.createInspection }))}>
              <View style={[styles.convertCheckbox, convertOptions.createInspection && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {convertOptions.createInspection && <Feather name="check" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.convertOptionText}>Create an inspection</Text>
            </TouchableOpacity>
            <View style={styles.convertActions}>
              <TouchableOpacity style={styles.convertCancelBtn} onPress={() => { setShowConvertModal(false); setLeadToConvert(null); }}>
                <Text style={styles.convertCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.convertConfirmBtn, { backgroundColor: colors.primary }]} onPress={handleConvert} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <>
                    <Feather name="user-check" size={16} color="#FFFFFF" />
                    <Text style={styles.convertConfirmText}>Convert</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  searchContainer: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.sm, gap: spacing.xs, height: sizes.inputHeight, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, ...typography.body, color: colors.foreground },
  filterContainer: { paddingBottom: spacing.sm },
  filterScroll: { paddingHorizontal: spacing.md, gap: spacing.xs },
  filterChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  filterChipText: { ...typography.caption, color: colors.mutedForeground },
  filterChipTextActive: { color: colors.primary, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.lg, gap: spacing.sm },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { ...typography.subtitle, color: colors.foreground },
  emptySubtitle: { ...typography.body, color: colors.mutedForeground, textAlign: 'center' },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm },
  emptyButtonText: { ...typography.label, color: '#FFFFFF' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  cardName: { ...typography.subtitle, color: colors.foreground },
  cardDescription: { ...typography.caption, color: colors.mutedForeground, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  statusBadgeText: { ...typography.caption, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.caption, color: colors.mutedForeground },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md },
  actionButtonText: { ...typography.caption, fontWeight: '600' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalCancel: { ...typography.body, color: colors.mutedForeground },
  modalTitle: { ...typography.subtitle, color: colors.foreground },
  modalSave: { ...typography.body, color: colors.primary, fontWeight: '600' },
  formScroll: { flex: 1 },
  formContent: { padding: spacing.md, gap: spacing.md },
  formGroup: { gap: spacing.xs },
  formLabel: { ...typography.label, color: colors.foreground },
  formInput: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.sm, height: sizes.inputHeight, borderWidth: 1, borderColor: colors.border, ...typography.body, color: colors.foreground },
  formTextarea: { height: 80, paddingVertical: spacing.sm },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  optionChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  optionChipText: { ...typography.caption, color: colors.mutedForeground },
  convertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  convertModal: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  convertTitle: { ...typography.subtitle, color: colors.foreground, marginBottom: spacing.xs },
  convertSubtitle: { ...typography.body, color: colors.mutedForeground, marginBottom: spacing.md },
  convertOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  convertCheckbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  convertOptionText: { ...typography.body, color: colors.foreground },
  convertActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  convertCancelBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  convertCancelText: { ...typography.body, color: colors.mutedForeground },
  convertConfirmBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  convertConfirmText: { ...typography.label, color: '#FFFFFF' },
});

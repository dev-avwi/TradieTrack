import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Modal, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/lib/theme';
import { api, API_URL } from '../../src/lib/api';
import { format } from 'date-fns';

interface ComplianceDocument {
  id: string;
  type: string;
  title: string;
  documentNumber: string | null;
  issuer: string | null;
  holderName: string | null;
  holderUserId: string | null;
  expiryDate: string | null;
  coverageAmount: string | null;
  insurer: string | null;
  vehiclePlate: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  status?: string;
  documentName?: string;
  issuedDate?: string | null;
}

type FilterTab = 'all' | 'valid' | 'expiring_soon' | 'expired';

const DOCUMENT_TYPES = [
  { value: 'licence', label: 'Licence' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'certification', label: 'Certification' },
  { value: 'white_card', label: 'White Card' },
  { value: 'vehicle_rego', label: 'Vehicle Rego' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  valid: {
    label: 'Valid',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
  },
  expiring_soon: {
    label: 'Expiring Soon',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
  },
  expired: {
    label: 'Expired',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
  },
  pending: {
    label: 'Pending',
    color: '#6b7280',
    bgColor: 'rgba(107,114,128,0.12)',
  },
};

const TYPE_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; label: string; color: string }> = {
  licence: { icon: 'shield', label: 'Licence', color: '#3b82f6' },
  license: { icon: 'shield', label: 'Licence', color: '#3b82f6' },
  insurance: { icon: 'file-text', label: 'Insurance', color: '#8b5cf6' },
  certification: { icon: 'award', label: 'Certification', color: '#f59e0b' },
  certificate: { icon: 'award', label: 'Certificate', color: '#f59e0b' },
  white_card: { icon: 'credit-card', label: 'White Card', color: '#10b981' },
  vehicle_rego: { icon: 'truck', label: 'Vehicle Rego', color: '#6366f1' },
  permit: { icon: 'clipboard', label: 'Permit', color: '#ec4899' },
  other: { icon: 'file', label: 'Other', color: '#6b7280' },
};

const getTypeConfig = (type: string) => {
  return TYPE_CONFIG[type.toLowerCase()] || { icon: 'file' as keyof typeof Feather.glyphMap, label: type, color: '#6b7280' };
};

const computeStatus = (doc: ComplianceDocument): string => {
  if (doc.status) return doc.status;
  if (!doc.expiryDate) return 'valid';
  const now = new Date();
  const expiry = new Date(doc.expiryDate);
  if (expiry < now) return 'expired';
  const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'valid';
};

const getDocName = (doc: ComplianceDocument): string => {
  return doc.documentName || doc.title || 'Untitled Document';
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'valid', label: 'Active' },
  { key: 'expiring_soon', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
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
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.muted,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterTabTextActive: {
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  documentCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentCardExpanded: {
    borderColor: colors.primary,
  },
  documentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.muted,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  expiryText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(107,114,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  emptyAddButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  typeOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  uploadedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  uploadedText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#22c55e',
    flex: 1,
  },
  removeUploadButton: {
    padding: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  saveButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

interface FormData {
  type: string;
  title: string;
  documentNumber: string;
  issuer: string;
  expiryDate: string;
  notes: string;
  holderName: string;
  coverageAmount: string;
  insurer: string;
  vehiclePlate: string;
}

const emptyForm: FormData = {
  type: 'licence',
  title: '',
  documentNumber: '',
  issuer: '',
  expiryDate: '',
  notes: '',
  holderName: '',
  coverageAmount: '',
  insurer: '',
  vehiclePlate: '',
};

export default function ComplianceScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [hasExistingAttachment, setHasExistingAttachment] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<ComplianceDocument[]>('/api/compliance-documents');
      if (response.error) {
        setError(response.error);
      } else {
        setDocuments(response.data || []);
      }
    } catch (err) {
      setError('Failed to load compliance documents');
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

  const documentsWithStatus = documents.map(doc => ({
    ...doc,
    computedStatus: computeStatus(doc),
  }));

  const filteredDocuments = activeFilter === 'all'
    ? documentsWithStatus
    : documentsWithStatus.filter(d => d.computedStatus === activeFilter);

  const validCount = documentsWithStatus.filter(d => d.computedStatus === 'valid').length;
  const expiringSoonCount = documentsWithStatus.filter(d => d.computedStatus === 'expiring_soon').length;
  const expiredCount = documentsWithStatus.filter(d => d.computedStatus === 'expired').length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return '—';
    }
  };

  const openCreateModal = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setAttachmentUri(null);
    setHasExistingAttachment(false);
    setShowModal(true);
  };

  const openEditModal = (doc: ComplianceDocument) => {
    setEditingDoc(doc);
    setForm({
      type: doc.type || 'other',
      title: getDocName(doc),
      documentNumber: doc.documentNumber || '',
      issuer: doc.issuer || '',
      expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '',
      notes: doc.notes || '',
      holderName: doc.holderName || '',
      coverageAmount: doc.coverageAmount || '',
      insurer: doc.insurer || '',
      vehiclePlate: doc.vehiclePlate || '',
    });
    setAttachmentUri(null);
    setHasExistingAttachment(!!doc.attachmentUrl);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDoc(null);
    setForm(emptyForm);
    setAttachmentUri(null);
    setHasExistingAttachment(false);
  };

  const handlePickImage = async () => {
    Alert.alert(
      'Add Photo',
      'Choose a source for the document photo',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Camera access is needed to take photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.8,
              allowsEditing: true,
            });
            if (!result.canceled && result.assets[0]) {
              setAttachmentUri(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Photo Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              quality: 0.8,
              allowsEditing: true,
            });
            if (!result.canceled && result.assets[0]) {
              setAttachmentUri(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadAttachment = async (docId: string): Promise<string | null> => {
    if (!attachmentUri) return null;
    try {
      const filename = attachmentUri.split('/').pop() || 'document.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1] : 'jpg';
      const type = `image/${ext}`;

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? attachmentUri.replace('file://', '') : attachmentUri,
        name: filename,
        type,
      } as any);
      formData.append('type', 'compliance');

      const response = await api.uploadFile<{ url: string }>('/api/upload', formData);
      if (response.data?.url) {
        return response.data.url;
      }
      return null;
    } catch (err) {
      console.log('Attachment upload failed:', err);
      return null;
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Required', 'Please enter a document name.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        type: form.type,
        title: form.title.trim(),
        documentNumber: form.documentNumber.trim() || null,
        issuer: form.issuer.trim() || null,
        expiryDate: form.expiryDate || null,
        notes: form.notes.trim() || null,
        holderName: form.holderName.trim() || null,
        coverageAmount: form.coverageAmount.trim() || null,
        insurer: form.insurer.trim() || null,
        vehiclePlate: form.vehiclePlate.trim() || null,
      };

      let response;
      if (editingDoc) {
        response = await api.patch<ComplianceDocument>(`/api/compliance-documents/${editingDoc.id}`, payload);
      } else {
        response = await api.post<ComplianceDocument>('/api/compliance-documents', payload);
      }

      if (response.error) {
        Alert.alert('Error', response.error);
        return;
      }

      if (attachmentUri && response.data?.id) {
        const uploadedUrl = await uploadAttachment(response.data.id);
        if (uploadedUrl) {
          await api.patch(`/api/compliance-documents/${response.data.id}`, {
            attachmentUrl: uploadedUrl,
            attachmentType: 'image',
          });
        }
      }

      closeModal();
      fetchData();
      Alert.alert('Success', editingDoc ? 'Document updated successfully.' : 'Document added successfully.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (doc: ComplianceDocument) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${getDocName(doc)}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/api/compliance-documents/${doc.id}`);
              if (response.error) {
                Alert.alert('Error', response.error);
                return;
              }
              setExpandedId(null);
              fetchData();
              Alert.alert('Deleted', 'Document has been deleted.');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete document.');
            }
          },
        },
      ]
    );
  };

  const renderStatCards = () => (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.valid.bgColor }]}>
          <Feather name="check-circle" size={22} color={STATUS_CONFIG.valid.color} />
        </View>
        <Text style={styles.statValue}>{validCount}</Text>
        <Text style={styles.statLabel}>Valid</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.expiring_soon.bgColor }]}>
          <Feather name="clock" size={22} color={STATUS_CONFIG.expiring_soon.color} />
        </View>
        <Text style={styles.statValue}>{expiringSoonCount}</Text>
        <Text style={styles.statLabel}>Expiring</Text>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.expired.bgColor }]}>
          <Feather name="alert-circle" size={22} color={STATUS_CONFIG.expired.color} />
        </View>
        <Text style={styles.statValue}>{expiredCount}</Text>
        <Text style={styles.statLabel}>Expired</Text>
      </View>
    </View>
  );

  const renderFilterTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={styles.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
              {tab.key !== 'all' && ` (${tab.key === 'valid' ? validCount : tab.key === 'expiring_soon' ? expiringSoonCount : expiredCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderDocumentCard = (doc: ComplianceDocument & { computedStatus: string }) => {
    const typeConfig = getTypeConfig(doc.type);
    const statusConfig = STATUS_CONFIG[doc.computedStatus] || STATUS_CONFIG.pending;
    const isExpanded = expandedId === doc.id;

    return (
      <TouchableOpacity
        key={doc.id}
        style={[styles.documentCard, isExpanded && styles.documentCardExpanded]}
        onPress={() => setExpandedId(isExpanded ? null : doc.id)}
        activeOpacity={0.7}
      >
        <View style={styles.documentTopRow}>
          <View style={[styles.documentIconContainer, { backgroundColor: `${typeConfig.color}18` }]}>
            <Feather name={typeConfig.icon} size={22} color={typeConfig.color} />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentName} numberOfLines={2}>{getDocName(doc)}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{typeConfig.label}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </View>
          </View>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-right'} size={18} color={colors.mutedForeground} />
        </View>

        {doc.expiryDate && (
          <View style={styles.expiryRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={styles.expiryText}>Expires {formatDate(doc.expiryDate)}</Text>
          </View>
        )}

        {isExpanded && (
          <View style={styles.detailsContainer}>
            {doc.documentNumber && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Document Number</Text>
                <Text style={styles.detailValue}>{doc.documentNumber}</Text>
              </View>
            )}
            {doc.issuer && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Issuing Body</Text>
                <Text style={styles.detailValue}>{doc.issuer}</Text>
              </View>
            )}
            {doc.holderName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Holder</Text>
                <Text style={styles.detailValue}>{doc.holderName}</Text>
              </View>
            )}
            {doc.insurer && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Insurer</Text>
                <Text style={styles.detailValue}>{doc.insurer}</Text>
              </View>
            )}
            {doc.coverageAmount && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Coverage</Text>
                <Text style={styles.detailValue}>{doc.coverageAmount}</Text>
              </View>
            )}
            {doc.vehiclePlate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vehicle Plate</Text>
                <Text style={styles.detailValue}>{doc.vehiclePlate}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expiry Date</Text>
              <Text style={styles.detailValue}>{formatDate(doc.expiryDate)}</Text>
            </View>
            {doc.attachmentUrl && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Attachment</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="paperclip" size={12} color={colors.primary} />
                  <Text style={[styles.detailValue, { color: colors.primary }]}>Uploaded</Text>
                </View>
              </View>
            )}
            {doc.notes && (
              <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={[styles.detailValue, { fontWeight: '400' }]}>{doc.notes}</Text>
              </View>
            )}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(doc)}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={14} color="#fff" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(doc)}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={14} color="#ef4444" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="shield" size={32} color="#6b7280" />
      </View>
      <Text style={styles.emptyTitle}>No Documents</Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter !== 'all'
          ? `No ${activeFilter === 'valid' ? 'active' : activeFilter === 'expiring_soon' ? 'expiring' : 'expired'} documents found.`
          : 'Compliance documents like licences, insurance and certificates will appear here.'}
      </Text>
      {activeFilter === 'all' && (
        <TouchableOpacity style={styles.emptyAddButton} onPress={openCreateModal} activeOpacity={0.7}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.emptyAddButtonText}>Add Document</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={40} color={colors.destructive} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFormModal = () => (
    <Modal
      visible={showModal}
      animationType="slide"
      transparent
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingDoc ? 'Edit Document' : 'Add Document'}</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Document Type</Text>
              <View style={styles.typeSelector}>
                {DOCUMENT_TYPES.map(dt => (
                  <TouchableOpacity
                    key={dt.value}
                    style={[styles.typeOption, form.type === dt.value && styles.typeOptionSelected]}
                    onPress={() => setForm(f => ({ ...f, type: dt.value }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.typeOptionText, form.type === dt.value && styles.typeOptionTextSelected]}>
                      {dt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Document Name *</Text>
              <TextInput
                style={styles.formInput}
                value={form.title}
                onChangeText={(v) => setForm(f => ({ ...f, title: v }))}
                placeholder="e.g. Electrical Licence"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Document Number</Text>
              <TextInput
                style={styles.formInput}
                value={form.documentNumber}
                onChangeText={(v) => setForm(f => ({ ...f, documentNumber: v }))}
                placeholder="e.g. LIC-12345"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Issuing Body</Text>
              <TextInput
                style={styles.formInput}
                value={form.issuer}
                onChangeText={(v) => setForm(f => ({ ...f, issuer: v }))}
                placeholder="e.g. NSW Fair Trading"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Expiry Date</Text>
              <TextInput
                style={styles.formInput}
                value={form.expiryDate}
                onChangeText={(v) => setForm(f => ({ ...f, expiryDate: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            {(form.type === 'white_card') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Holder Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.holderName}
                  onChangeText={(v) => setForm(f => ({ ...f, holderName: v }))}
                  placeholder="Name of card holder"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            )}

            {(form.type === 'insurance') && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Insurer</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.insurer}
                    onChangeText={(v) => setForm(f => ({ ...f, insurer: v }))}
                    placeholder="e.g. QBE Insurance"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Coverage Amount</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.coverageAmount}
                    onChangeText={(v) => setForm(f => ({ ...f, coverageAmount: v }))}
                    placeholder="e.g. $20,000,000"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </>
            )}

            {(form.type === 'vehicle_rego') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Vehicle Plate</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.vehiclePlate}
                  onChangeText={(v) => setForm(f => ({ ...f, vehiclePlate: v }))}
                  placeholder="e.g. ABC 123"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMultiline]}
                value={form.notes}
                onChangeText={(v) => setForm(f => ({ ...f, notes: v }))}
                placeholder="Optional notes..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Document Photo</Text>
              {attachmentUri ? (
                <View style={styles.uploadedIndicator}>
                  <Feather name="image" size={16} color="#22c55e" />
                  <Text style={styles.uploadedText}>Photo selected</Text>
                  <TouchableOpacity
                    style={styles.removeUploadButton}
                    onPress={() => setAttachmentUri(null)}
                  >
                    <Feather name="x" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : hasExistingAttachment ? (
                <View style={styles.uploadedIndicator}>
                  <Feather name="paperclip" size={16} color="#22c55e" />
                  <Text style={styles.uploadedText}>Existing attachment</Text>
                  <TouchableOpacity
                    style={styles.removeUploadButton}
                    onPress={handlePickImage}
                  >
                    <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadButton} onPress={handlePickImage} activeOpacity={0.7}>
                  <Feather name="camera" size={18} color={colors.mutedForeground} />
                  <Text style={styles.uploadButtonText}>Take Photo or Choose from Library</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={closeModal} activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>{editingDoc ? 'Update' : 'Add Document'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isLoading && documents.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading compliance documents...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.pageTitle}>Compliance</Text>
                <Text style={styles.pageSubtitle}>Licences, insurance & certifications</Text>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={openCreateModal} activeOpacity={0.7}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {error ? renderErrorState() : documents.length === 0 && activeFilter === 'all' ? renderEmptyState() : (
              <>
                {renderStatCards()}
                {renderFilterTabs()}
                {filteredDocuments.length === 0 ? renderEmptyState() : filteredDocuments.map(renderDocumentCard)}
              </>
            )}
          </ScrollView>
        )}
      </View>
      {renderFormModal()}
    </>
  );
}

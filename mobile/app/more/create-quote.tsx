import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { DatePicker } from '../../src/components/ui/DatePicker';
import LiveDocumentPreview from '../../src/components/LiveDocumentPreview';
import { useClientsStore, useQuotesStore, useJobsStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface DocumentTemplate {
  id: string;
  name: string;
  type: string;
  defaults?: {
    title?: string;
    description?: string;
    terms?: string;
    depositPct?: number;
  };
  defaultLineItems?: Array<{
    description: string;
    qty?: number;
    unitPrice?: number;
  }>;
}

interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  unitPrice: string;
  unit: string;
  tradeType?: string;
  defaultQuantity?: number;
}

function generateId() {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function ClientSelector({
  clients,
  selectedId,
  onSelect,
  visible,
  onClose,
  colors,
  styles,
}: {
  clients: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  visible: boolean;
  onClose: () => void;
  colors: any;
  styles: any;
}) {
  const [search, setSearch] = useState('');

  const filteredClients = clients.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Client</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.modalSearch}
            placeholder="Search clients..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView style={styles.modalList}>
            {filteredClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={[
                  styles.clientItem,
                  selectedId === client.id && styles.clientItemSelected,
                ]}
                onPress={() => {
                  onSelect(client.id);
                  onClose();
                }}
              >
                <View style={styles.clientItemContent}>
                  <Text style={styles.clientItemName}>{client.name}</Text>
                  <Text style={styles.clientItemEmail}>{client.email}</Text>
                </View>
                {selectedId === client.id && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            {filteredClients.length === 0 && (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No clients found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function JobSelector({
  jobs,
  selectedId,
  onSelect,
  visible,
  onClose,
  colors,
  styles,
}: {
  jobs: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  visible: boolean;
  onClose: () => void;
  colors: any;
  styles: any;
}) {
  const [search, setSearch] = useState('');

  const filteredJobs = jobs.filter(
    (j) =>
      j.title?.toLowerCase().includes(search.toLowerCase()) ||
      j.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Link to Job (Optional)</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.clientItem, !selectedId && styles.clientItemSelected]}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
          >
            <Text style={styles.clientItemName}>No Job</Text>
            {!selectedId && <Feather name="check" size={20} color={colors.primary} />}
          </TouchableOpacity>

          <TextInput
            style={styles.modalSearch}
            placeholder="Search jobs..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView style={styles.modalList}>
            {filteredJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={[
                  styles.clientItem,
                  selectedId === job.id && styles.clientItemSelected,
                ]}
                onPress={() => {
                  onSelect(job.id);
                  onClose();
                }}
              >
                <View style={styles.clientItemContent}>
                  <Text style={styles.clientItemName}>{job.title}</Text>
                  <Text style={styles.clientItemEmail}>
                    {job.status} {job.scheduledAt && `• ${new Date(job.scheduledAt).toLocaleDateString()}`}
                  </Text>
                </View>
                {selectedId === job.id && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TemplateSelector({
  templates,
  visible,
  onClose,
  onSelect,
  colors,
  styles,
  isLoading,
}: {
  templates: DocumentTemplate[];
  visible: boolean;
  onClose: () => void;
  onSelect: (template: DocumentTemplate) => void;
  colors: any;
  styles: any;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');

  const filteredTemplates = templates.filter(
    (t) =>
      t.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply Template</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.modalSearch}
            placeholder="Search templates..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView style={styles.modalList}>
            {isLoading ? (
              <View style={styles.emptyList}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.emptyListText, { marginTop: 8 }]}>Loading templates...</Text>
              </View>
            ) : filteredTemplates.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No templates found</Text>
              </View>
            ) : (
              filteredTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.clientItem}
                  onPress={() => {
                    onSelect(template);
                    onClose();
                  }}
                >
                  <View style={styles.clientItemContent}>
                    <Text style={styles.clientItemName}>{template.name}</Text>
                    <Text style={styles.clientItemEmail}>
                      {template.defaultLineItems?.length || 0} line items
                      {template.defaults?.depositPct ? ` • ${template.defaults.depositPct}% deposit` : ''}
                    </Text>
                  </View>
                  <Feather name="file-text" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CatalogPicker({
  catalogItems,
  visible,
  onClose,
  onSelect,
  colors,
  styles,
  isLoading,
}: {
  catalogItems: CatalogItem[];
  visible: boolean;
  onClose: () => void;
  onSelect: (item: CatalogItem) => void;
  colors: any;
  styles: any;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');

  const filteredItems = catalogItems.filter(
    (item) =>
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `$${(num || 0).toFixed(2)}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add from Catalog</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.modalSearch}
            placeholder="Search catalog items..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView style={styles.modalList}>
            {isLoading ? (
              <View style={styles.emptyList}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.emptyListText, { marginTop: 8 }]}>Loading catalog...</Text>
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No catalog items found</Text>
              </View>
            ) : (
              filteredItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.catalogItem}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <View style={styles.clientItemContent}>
                    <Text style={styles.clientItemName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.clientItemEmail} numberOfLines={1}>{item.description}</Text>
                    )}
                    <View style={styles.catalogItemMeta}>
                      <Text style={styles.catalogItemPrice}>
                        {formatCurrency(item.unitPrice)}/{item.unit}
                      </Text>
                      {item.tradeType && (
                        <View style={[styles.tradeBadge, { backgroundColor: `${colors.primary}15` }]}>
                          <Text style={[styles.tradeBadgeText, { color: colors.primary }]}>{item.tradeType}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Feather name="plus-circle" size={20} color={colors.primary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function LineItemRow({
  item,
  onUpdate,
  onDelete,
  colors,
  styles,
}: {
  item: LineItem;
  onUpdate: (updates: Partial<LineItem>) => void;
  onDelete: () => void;
  colors: any;
  styles: any;
}) {
  const total = (item.quantity * item.unitPrice) / 100;

  return (
    <View style={styles.lineItemCard}>
      <View style={styles.lineItemHeader}>
        <TextInput
          style={styles.lineItemDescription}
          placeholder="Item description"
          placeholderTextColor={colors.mutedForeground}
          value={item.description}
          onChangeText={(text) => onUpdate({ description: text })}
          multiline
        />
        <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
          <Feather name="trash-2" size={18} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <View style={styles.lineItemNumbers}>
        <View style={styles.numberInput}>
          <Text style={styles.numberLabel}>Qty</Text>
          <TextInput
            style={styles.numberField}
            value={item.quantity.toString()}
            onChangeText={(text) => {
              const qty = parseInt(text) || 0;
              onUpdate({ quantity: qty });
            }}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.numberInput}>
          <Text style={styles.numberLabel}>Unit Price</Text>
          <View style={styles.priceInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.priceField}
              value={(item.unitPrice / 100).toFixed(2)}
              onChangeText={(text) => {
                const price = Math.round(parseFloat(text.replace(/[^0-9.]/g, '') || '0') * 100);
                onUpdate({ unitPrice: price });
              }}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.lineTotal}>
          <Text style={styles.numberLabel}>Total</Text>
          <Text style={styles.lineTotalValue}>${total.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { fontSize: 14, fontWeight: '500', color: colors.primary },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, minHeight: 52 },
  selectorPlaceholder: { fontSize: 15, color: colors.mutedForeground },
  selectedItem: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  clientAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' },
  selectedItemText: { flex: 1 },
  selectedItemName: { fontSize: 15, fontWeight: '500', color: colors.foreground },
  selectedItemDetail: { fontSize: 13, color: colors.mutedForeground },
  lineItemCard: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 12 },
  lineItemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineItemDescription: { flex: 1, fontSize: 15, color: colors.foreground, minHeight: 40, padding: 0 },
  deleteButton: { padding: 4 },
  lineItemNumbers: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  numberInput: { flex: 1 },
  numberLabel: { fontSize: 11, fontWeight: '500', color: colors.mutedForeground, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  numberField: { backgroundColor: colors.background, borderRadius: 6, borderWidth: 1, borderColor: colors.border, padding: 8, fontSize: 14, color: colors.foreground, textAlign: 'center' },
  priceInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  currencySymbol: { fontSize: 14, color: colors.mutedForeground, paddingLeft: 8 },
  priceField: { flex: 1, padding: 8, fontSize: 14, color: colors.foreground, textAlign: 'right' },
  lineTotal: { flex: 1, alignItems: 'flex-end' },
  lineTotalValue: { fontSize: 15, fontWeight: '600', color: colors.foreground, marginTop: 8 },
  totalsCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 24 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  totalLabel: { fontSize: 14, color: colors.mutedForeground },
  totalValue: { fontSize: 15, fontWeight: '500', color: colors.foreground },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 16 },
  grandTotalLabel: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  grandTotalValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  depositRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  depositInput: { width: 60, backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 15, color: colors.foreground, textAlign: 'center' },
  depositPercent: { fontSize: 15, color: colors.foreground },
  depositAmount: { fontSize: 14, color: colors.mutedForeground, marginLeft: 8 },
  textArea: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 15, color: colors.foreground, minHeight: 80, textAlignVertical: 'top' },
  actions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  saveDraftButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  saveDraftText: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  sendButton: { backgroundColor: colors.primary },
  sendText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground },
  modalSearch: { backgroundColor: colors.background, borderRadius: 8, margin: 16, padding: 12, fontSize: 15, color: colors.foreground },
  modalList: { paddingHorizontal: 16 },
  clientItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 10, marginBottom: 8, backgroundColor: colors.background },
  clientItemSelected: { backgroundColor: `${colors.primary}10`, borderWidth: 1, borderColor: `${colors.primary}30` },
  clientItemContent: { flex: 1 },
  clientItemName: { fontSize: 15, fontWeight: '500', color: colors.foreground },
  clientItemEmail: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  emptyList: { alignItems: 'center', paddingVertical: 32 },
  emptyListText: { fontSize: 14, color: colors.mutedForeground },
  catalogItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 10, marginBottom: 8, backgroundColor: colors.background },
  catalogItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  catalogItemPrice: { fontSize: 13, fontWeight: '600', color: colors.primary },
  tradeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tradeBadgeText: { fontSize: 11, fontWeight: '500' },
  viewModeContainer: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  viewModeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  viewModeButtonActive: { backgroundColor: colors.primary },
  viewModeText: { fontSize: 14, fontWeight: '500', color: colors.mutedForeground },
  viewModeTextActive: { color: '#FFFFFF' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: `${colors.primary}15` },
  headerButtonText: { fontSize: 13, fontWeight: '500', color: colors.primary },
  lineItemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  lineItemButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default function CreateQuoteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const params = useLocalSearchParams<{ clientId?: string; jobId?: string }>();
  const { clients, fetchClients } = useClientsStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { fetchQuotes } = useQuotesStore();

  const [clientId, setClientId] = useState<string | null>(params.clientId || null);
  const [jobId, setJobId] = useState<string | null>(params.jobId || null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    'Payment due within 14 days of acceptance.\nThis quote is valid for 30 days from the issue date.'
  );
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  const [depositPercentage, setDepositPercentage] = useState(0);

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchJobs();
  }, []);

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await api.get<DocumentTemplate[]>('/api/templates?type=quote');
      if (response.data) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      Alert.alert('Error', 'Failed to load templates. Please try again.');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const fetchCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      const response = await api.get<CatalogItem[]>('/api/catalog');
      if (response.data) {
        setCatalogItems(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error);
      Alert.alert('Error', 'Failed to load catalog items. Please try again.');
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleOpenTemplates = () => {
    fetchTemplates();
    setShowTemplatePicker(true);
  };

  const handleOpenCatalog = () => {
    fetchCatalog();
    setShowCatalogPicker(true);
  };

  const handleApplyTemplate = (template: DocumentTemplate) => {
    if (template.defaults?.title) setTitle(template.defaults.title);
    if (template.defaults?.description) setDescription(template.defaults.description);
    if (template.defaults?.terms) setTermsAndConditions(template.defaults.terms);
    if (template.defaults?.depositPct) setDepositPercentage(template.defaults.depositPct);
    
    if (template.defaultLineItems && template.defaultLineItems.length > 0) {
      const newItems = template.defaultLineItems.map((item) => ({
        id: generateId(),
        description: item.description || '',
        quantity: item.qty || 1,
        unitPrice: Math.round((item.unitPrice || 0) * 100),
      }));
      setLineItems(newItems);
    }

    Alert.alert('Template Applied', `"${template.name}" has been applied to your quote.`);
  };

  const handleAddFromCatalog = (item: CatalogItem) => {
    const newItem: LineItem = {
      id: generateId(),
      description: item.description || item.name,
      quantity: item.defaultQuantity || 1,
      unitPrice: Math.round(parseFloat(item.unitPrice || '0') * 100),
    };
    setLineItems([...lineItems, newItem]);
    Alert.alert('Item Added', `"${item.name}" has been added to your quote.`);
  };

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedJob = jobs.find((j) => j.id === jobId);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: generateId(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const deleteLineItem = (id: string) => {
    if (lineItems.length === 1) {
      Alert.alert('Error', 'You need at least one line item');
      return;
    }
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const gstAmount = Math.round(subtotal * 0.1);
  const total = subtotal + gstAmount;
  const depositAmount = Math.round(total * (depositPercentage / 100));

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const validateQuote = () => {
    if (!clientId) {
      Alert.alert('Missing Client', 'Please select a client for this quote');
      return false;
    }

    const validItems = lineItems.filter(
      (item) => item.description.trim() && item.unitPrice > 0
    );
    if (validItems.length === 0) {
      Alert.alert(
        'Missing Items',
        'Please add at least one line item with a description and price'
      );
      return false;
    }

    return true;
  };

  const saveQuote = async (status: 'draft' | 'sent' = 'draft') => {
    if (!validateQuote()) return;

    const saving = status === 'draft' ? setIsSaving : setIsSending;
    saving(true);

    try {
      const quoteData = {
        clientId,
        jobId,
        status,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        lineItems: lineItems
          .filter((item) => item.description.trim())
          .map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        subtotal,
        gstAmount,
        total,
        notes: notes.trim() || null,
        termsAndConditions: termsAndConditions.trim() || null,
        validUntil: validUntil.toISOString(),
        depositPercentage: depositPercentage > 0 ? depositPercentage : null,
        depositAmount: depositPercentage > 0 ? depositAmount : null,
      };

      const response = await api.post<{ id: string }>('/api/quotes', quoteData);

      if (response.data?.id) {
        await fetchQuotes();
        Alert.alert(
          status === 'sent' ? 'Quote Sent!' : 'Quote Saved!',
          status === 'sent'
            ? 'The quote has been sent to the client.'
            : 'Your quote has been saved as a draft.',
          [
            {
              text: 'View Quote',
              onPress: () => router.replace(`/more/quote/${response.data!.id}`),
            },
            {
              text: 'Back to Quotes',
              onPress: () => router.back(),
              style: 'cancel',
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Save quote error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to save quote. Please try again.'
      );
    } finally {
      saving(false);
    }
  };

  const previewLineItems = lineItems
    .filter((item) => item.description.trim())
    .map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice / 100,
    }));

  const businessInfo = {
    businessName: 'Your Business',
    gstEnabled: true,
  };

  const clientInfo = selectedClient
    ? {
        name: selectedClient.name,
        email: selectedClient.email,
        phone: selectedClient.phone,
        address: selectedClient.address,
      }
    : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Create Quote',
          headerTitleStyle: { fontWeight: '600', color: colors.foreground },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={handleOpenTemplates}>
                <Feather name="file-text" size={16} color={colors.primary} />
                <Text style={styles.headerButtonText}>Template</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* View Mode Toggle */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'edit' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('edit')}
            >
              <Feather name="edit-2" size={16} color={viewMode === 'edit' ? '#FFFFFF' : colors.mutedForeground} />
              <Text style={[styles.viewModeText, viewMode === 'edit' && styles.viewModeTextActive]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'preview' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('preview')}
            >
              <Feather name="eye" size={16} color={viewMode === 'preview' ? '#FFFFFF' : colors.mutedForeground} />
              <Text style={[styles.viewModeText, viewMode === 'preview' && styles.viewModeTextActive]}>Preview</Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'preview' ? (
          <LiveDocumentPreview
            type="quote"
            title={title || 'New Quote'}
            description={description}
            date={new Date().toISOString()}
            validUntil={validUntil.toISOString()}
            lineItems={previewLineItems}
            notes={notes}
            terms={termsAndConditions}
            business={businessInfo}
            client={clientInfo}
            showDepositSection={depositPercentage > 0}
            depositPercent={depositPercentage}
            gstEnabled={true}
          />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Client Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client *</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowClientPicker(true)}
              >
                {selectedClient ? (
                  <View style={styles.selectedItem}>
                    <View style={styles.clientAvatar}>
                      <Feather name="user" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.selectedItemText}>
                      <Text style={styles.selectedItemName}>{selectedClient.name}</Text>
                      <Text style={styles.selectedItemDetail}>{selectedClient.email}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Select a client</Text>
                )}
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Job Selection (Optional) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Link to Job (Optional)</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowJobPicker(true)}
              >
                {selectedJob ? (
                  <View style={styles.selectedItem}>
                    <Text style={styles.selectedItemName}>{selectedJob.title}</Text>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>No job linked</Text>
                )}
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Quote Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quote Title (Optional)</Text>
              <TextInput
                style={[styles.selector, { justifyContent: 'flex-start' }]}
                placeholder="e.g., Bathroom Renovation"
                placeholderTextColor={colors.mutedForeground}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description (Optional)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Brief description of the work..."
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Line Items */}
            <View style={styles.section}>
              <View style={styles.lineItemsHeader}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Line Items</Text>
                <View style={styles.lineItemButtons}>
                  <TouchableOpacity style={styles.addButton} onPress={handleOpenCatalog}>
                    <Feather name="package" size={16} color={colors.primary} />
                    <Text style={styles.addButtonText}>Catalog</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addButton} onPress={addLineItem}>
                    <Feather name="plus" size={16} color={colors.primary} />
                    <Text style={styles.addButtonText}>Add Item</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {lineItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(updates) => updateLineItem(item.id, updates)}
                  onDelete={() => deleteLineItem(item.id)}
                  colors={colors}
                  styles={styles}
                />
              ))}
            </View>

            {/* Totals */}
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal (ex. GST)</Text>
                <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>GST (10%)</Text>
                <Text style={styles.totalValue}>{formatCurrency(gstAmount)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total (inc. GST)</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
              </View>
            </View>

            {/* Deposit */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deposit Required</Text>
              <View style={styles.depositRow}>
                <TextInput
                  style={styles.depositInput}
                  value={depositPercentage > 0 ? depositPercentage.toString() : ''}
                  onChangeText={(text) => {
                    const pct = parseInt(text) || 0;
                    setDepositPercentage(Math.min(100, Math.max(0, pct)));
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
                <Text style={styles.depositPercent}>%</Text>
                {depositPercentage > 0 && (
                  <Text style={styles.depositAmount}>
                    = {formatCurrency(depositAmount)}
                  </Text>
                )}
              </View>
            </View>

            {/* Valid Until */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Valid Until</Text>
              <DatePicker
                value={validUntil}
                onChange={setValidUntil}
                minimumDate={new Date()}
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes (Optional)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Any additional notes for the client..."
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Terms */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Terms & Conditions</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Enter terms and conditions..."
                placeholderTextColor={colors.mutedForeground}
                value={termsAndConditions}
                onChangeText={setTermsAndConditions}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Bottom Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveDraftButton]}
            onPress={() => saveQuote('draft')}
            disabled={isSaving || isSending}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <>
                <Feather name="save" size={18} color={colors.foreground} />
                <Text style={styles.saveDraftText}>Save Draft</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.sendButton]}
            onPress={() => saveQuote('sent')}
            disabled={isSaving || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={18} color="#FFFFFF" />
                <Text style={styles.sendText}>Save & Send</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
      <ClientSelector
        clients={clients}
        selectedId={clientId}
        onSelect={setClientId}
        visible={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        colors={colors}
        styles={styles}
      />

      <JobSelector
        jobs={jobs}
        selectedId={jobId}
        onSelect={setJobId}
        visible={showJobPicker}
        onClose={() => setShowJobPicker(false)}
        colors={colors}
        styles={styles}
      />

      <TemplateSelector
        templates={templates}
        visible={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleApplyTemplate}
        colors={colors}
        styles={styles}
        isLoading={isLoadingTemplates}
      />

      <CatalogPicker
        catalogItems={catalogItems}
        visible={showCatalogPicker}
        onClose={() => setShowCatalogPicker(false)}
        onSelect={handleAddFromCatalog}
        colors={colors}
        styles={styles}
        isLoading={isLoadingCatalog}
      />
    </>
  );
}

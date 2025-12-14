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
import { useClientsStore, useQuotesStore, useJobsStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  cost: number; // Cost for profit margin calculation (in cents)
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
  onQuickAdd,
}: {
  clients: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  visible: boolean;
  onClose: () => void;
  colors: any;
  styles: any;
  onQuickAdd?: () => void;
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
          
          {/* Quick Add Client Button */}
          {onQuickAdd && (
            <TouchableOpacity
              style={[styles.clientItem, { backgroundColor: colors.primary + '10', borderColor: colors.primary, marginBottom: 8 }]}
              onPress={onQuickAdd}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="plus-circle" size={20} color={colors.primary} />
                <Text style={[styles.clientItemName, { color: colors.primary }]}>Quick Add New Client</Text>
              </View>
            </TouchableOpacity>
          )}

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

function LineItemRow({
  item,
  onUpdate,
  onDelete,
  colors,
  styles,
  showMargin,
}: {
  item: LineItem;
  onUpdate: (updates: Partial<LineItem>) => void;
  onDelete: () => void;
  colors: any;
  styles: any;
  showMargin: boolean;
}) {
  const total = (item.quantity * item.unitPrice) / 100;
  const totalCost = (item.quantity * item.cost) / 100;
  const margin = total > 0 ? ((total - totalCost) / total) * 100 : 0;
  const hasCost = item.cost > 0;

  const getMarginColor = () => {
    if (margin >= 30) return '#16a34a'; // green
    if (margin >= 15) return '#ca8a04'; // yellow
    return '#dc2626'; // red
  };

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
      
      {/* Cost and margin section */}
      {showMargin && (
        <View style={styles.costMarginSection}>
          <View style={styles.costInput}>
            <Text style={styles.numberLabel}>Your Cost</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.priceField}
                value={(item.cost / 100).toFixed(2)}
                onChangeText={(text) => {
                  const cost = Math.round(parseFloat(text.replace(/[^0-9.]/g, '') || '0') * 100);
                  onUpdate({ cost: cost });
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
          {hasCost && (
            <View style={[styles.marginBadge, { backgroundColor: getMarginColor() + '20' }]}>
              <Text style={[styles.marginBadgeText, { color: getMarginColor() }]}>
                {margin.toFixed(0)}% margin
              </Text>
            </View>
          )}
        </View>
      )}
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
  costMarginSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' },
  costInput: { flex: 1, maxWidth: 140 },
  marginBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  marginBadgeText: { fontSize: 12, fontWeight: '600' },
  profitSection: { backgroundColor: `${colors.muted}50`, borderRadius: 10, padding: 12, marginTop: 12 },
  profitSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  profitSectionTitle: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  profitToggleButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.background },
  profitToggleText: { fontSize: 12, fontWeight: '500', color: colors.primary },
  profitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  profitLabel: { fontSize: 13, color: colors.mutedForeground },
  profitValue: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  profitValuePositive: { color: '#16a34a' },
  profitValueNegative: { color: '#dc2626' },
  overallMarginBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  overallMarginText: { fontSize: 14, fontWeight: '700' },
  noCostHint: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 8 },
});

export default function CreateQuoteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const params = useLocalSearchParams<{ jobId?: string }>();
  const { clients, fetchClients } = useClientsStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { fetchQuotes } = useQuotesStore();

  const [clientId, setClientId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(params.jobId || null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', quantity: 1, unitPrice: 0, cost: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    'Payment due within 14 days of acceptance.\nThis quote is valid for 30 days from the issue date.'
  );
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  );
  const [depositPercentage, setDepositPercentage] = useState(0);
  const [showMarginMode, setShowMarginMode] = useState(false);

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Quick Add Client state
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchJobs();
  }, []);

  useEffect(() => {
    if (params.jobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === params.jobId);
      if (job) {
        setJobId(job.id);
        if (job.clientId) {
          setClientId(job.clientId);
        }
        if (job.title && lineItems.length === 1 && !lineItems[0].description) {
          setLineItems([{
            id: generateId(),
            description: job.title,
            quantity: 1,
            unitPrice: 0,
            cost: 0,
          }]);
        }
      }
    }
  }, [params.jobId, jobs]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedJob = jobs.find((j) => j.id === jobId);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: generateId(), description: '', quantity: 1, unitPrice: 0, cost: 0 },
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

  // Calculate totals
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const gstAmount = Math.round(subtotal * 0.1); // 10% GST
  const total = subtotal + gstAmount;
  const depositAmount = Math.round(total * (depositPercentage / 100));
  
  // Profit margin calculations
  const totalCost = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.cost,
    0
  );
  const grossProfit = subtotal - totalCost;
  const profitMargin = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
  const hasCostData = lineItems.some(item => item.cost > 0);
  
  const getMarginColor = (margin: number) => {
    if (margin >= 30) return '#16a34a'; // green
    if (margin >= 15) return '#ca8a04'; // yellow
    return '#dc2626'; // red
  };

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

  const handleQuickAddClient = async () => {
    if (!quickClientName.trim()) {
      Alert.alert('Name Required', 'Please enter a client name');
      return;
    }
    
    setIsAddingClient(true);
    try {
      const response = await api.post<{ id: string; name: string; email?: string; phone?: string }>('/api/clients', {
        name: quickClientName.trim(),
        email: quickClientEmail.trim() || undefined,
        phone: quickClientPhone.trim() || undefined,
      });
      
      if (response.data?.id) {
        // Refresh clients list and select the new client
        await fetchClients();
        setClientId(response.data.id);
        setShowQuickAddClient(false);
        setShowClientPicker(false);
        // Reset form
        setQuickClientName('');
        setQuickClientEmail('');
        setQuickClientPhone('');
        Alert.alert('Success', `Client "${quickClientName}" added!`);
      } else {
        Alert.alert('Error', response.error || 'Failed to create client');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create client');
    } finally {
      setIsAddingClient(false);
    }
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
        title: selectedClient ? `Quote for ${selectedClient.name}` : 'New Quote',
        lineItems: lineItems
          .filter((item) => item.description.trim())
          .map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: (item.unitPrice / 100).toFixed(2), // Convert cents to dollars
            total: ((item.quantity * item.unitPrice) / 100).toFixed(2), // Calculate total in dollars
            cost: item.cost > 0 ? (item.cost / 100).toFixed(2) : null, // Convert cents to dollars
          })),
        subtotal: (subtotal / 100).toFixed(2), // Convert cents to dollars
        gstAmount: (gstAmount / 100).toFixed(2), // Convert cents to dollars
        total: (total / 100).toFixed(2), // Convert cents to dollars
        notes: notes.trim() || null,
        termsAndConditions: termsAndConditions.trim() || null,
        validUntil: validUntil.toISOString(),
        depositPercent: depositPercentage > 0 ? String(depositPercentage) : null,
        depositAmount: depositPercentage > 0 ? (depositAmount / 100).toFixed(2) : null,
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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Create Quote',
          headerTitleStyle: { fontWeight: '600', color: colors.foreground },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
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

          {/* Job Selection (Optional) - Hidden when jobId is passed via params */}
          {!params.jobId && (
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
          )}
          
          {/* Show linked job info when passed via params */}
          {params.jobId && selectedJob && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Linked Job</Text>
              <View style={[styles.selector, { backgroundColor: `${colors.primary}10` }]}>
                <View style={styles.selectedItem}>
                  <Feather name="briefcase" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.selectedItemName}>{selectedJob.title}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Line Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Line Items</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity 
                  style={[styles.addButton, { backgroundColor: `${colors.primary}15`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }]} 
                  onPress={() => {
                    Alert.alert(
                      'AI Line Item Generator',
                      'Describe the work you need to quote and AI will suggest line items with pricing.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Coming Soon', onPress: () => {} }
                      ]
                    );
                  }}
                >
                  <Feather name="zap" size={14} color={colors.primary} />
                  <Text style={[styles.addButtonText, { fontSize: 13 }]}>AI</Text>
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
                showMargin={showMarginMode}
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
            
            {/* Profit Analysis Section */}
            <View style={styles.profitSection}>
              <View style={styles.profitSectionHeader}>
                <Text style={styles.profitSectionTitle}>
                  <Feather name="dollar-sign" size={12} color={colors.mutedForeground} /> Profit Analysis
                </Text>
                <TouchableOpacity 
                  style={styles.profitToggleButton}
                  onPress={() => setShowMarginMode(!showMarginMode)}
                >
                  <Text style={styles.profitToggleText}>
                    {showMarginMode ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {showMarginMode && (
                hasCostData ? (
                  <>
                    <View style={styles.profitRow}>
                      <Text style={styles.profitLabel}>Total Costs</Text>
                      <Text style={styles.profitValue}>{formatCurrency(totalCost)}</Text>
                    </View>
                    <View style={styles.profitRow}>
                      <Text style={styles.profitLabel}>Gross Profit</Text>
                      <Text style={[
                        styles.profitValue,
                        grossProfit >= 0 ? styles.profitValuePositive : styles.profitValueNegative
                      ]}>
                        {formatCurrency(grossProfit)}
                      </Text>
                    </View>
                    <View style={styles.profitRow}>
                      <Text style={styles.profitLabel}>Profit Margin</Text>
                      <View style={[styles.overallMarginBadge, { backgroundColor: getMarginColor(profitMargin) + '20' }]}>
                        <Text style={[styles.overallMarginText, { color: getMarginColor(profitMargin) }]}>
                          {profitMargin.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={styles.noCostHint}>
                    Add cost values to line items to see profit analysis
                  </Text>
                )
              )}
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
                <Text style={styles.depositAmount}>= {formatCurrency(depositAmount)}</Text>
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
              placeholder="Payment terms, conditions, etc..."
              placeholderTextColor={colors.mutedForeground}
              value={termsAndConditions}
              onChangeText={setTermsAndConditions}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Spacer for buttons */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Action Buttons */}
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

      <ClientSelector
        clients={clients}
        selectedId={clientId}
        onSelect={setClientId}
        visible={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        colors={colors}
        styles={styles}
        onQuickAdd={() => setShowQuickAddClient(true)}
      />
      
      {/* Quick Add Client Modal */}
      <Modal visible={showQuickAddClient} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Quick Add Client</Text>
                <TouchableOpacity onPress={() => setShowQuickAddClient(false)}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              
              <View style={{ padding: 16, gap: 12 }}>
                <View>
                  <Text style={styles.fieldLabel}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Client name"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientName}
                    onChangeText={setQuickClientName}
                    autoFocus
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="client@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientEmail}
                    onChangeText={setQuickClientEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0400 000 000"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientPhone}
                    onChangeText={setQuickClientPhone}
                    keyboardType="phone-pad"
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton, { marginTop: 8 }]}
                  onPress={handleQuickAddClient}
                  disabled={isAddingClient}
                >
                  {isAddingClient ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Feather name="plus" size={18} color={colors.primaryForeground} />
                      <Text style={styles.primaryButtonText}>Add Client</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <JobSelector
        jobs={jobs}
        selectedId={jobId}
        onSelect={setJobId}
        visible={showJobPicker}
        onClose={() => setShowJobPicker(false)}
        colors={colors}
        styles={styles}
      />
    </>
  );
}

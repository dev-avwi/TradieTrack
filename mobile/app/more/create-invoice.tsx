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
import { useClientsStore, useInvoicesStore, useJobsStore, useQuotesStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
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
              style={[styles.clientItem, { backgroundColor: colors.primary + '10', borderColor: colors.primary, marginBottom: 8, marginHorizontal: 16 }]}
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
  quoteNotice: { backgroundColor: `${colors.primary}10`, borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: `${colors.primary}20` },
  quoteNoticeText: { fontSize: 13, color: colors.primary },
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
});

export default function CreateInvoiceScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const params = useLocalSearchParams<{ quoteId?: string; jobId?: string }>();
  const { clients, fetchClients } = useClientsStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { quotes, fetchQuotes } = useQuotesStore();
  const { fetchInvoices } = useInvoicesStore();

  const [clientId, setClientId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(params.quoteId || null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  );
  const [depositPaid, setDepositPaid] = useState(0);

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  
  // Quick Add Client state
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchJobs();
    fetchQuotes();
  }, []);

  useEffect(() => {
    if (params.quoteId && quotes.length > 0) {
      const quote = quotes.find(q => q.id === params.quoteId);
      if (quote) {
        setIsLoadingQuote(true);
        setClientId(quote.clientId);
        setJobId(quote.jobId || null);
        setQuoteId(quote.id);
        
        if (quote.lineItems && Array.isArray(quote.lineItems)) {
          const items = quote.lineItems.map((item: any) => ({
            id: generateId(),
            description: item.description || '',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
          }));
          if (items.length > 0) {
            setLineItems(items);
          }
        }
        
        if (quote.notes) {
          setNotes(quote.notes);
        }
        
        if ((quote as any).depositAmount) {
          setDepositPaid((quote as any).depositAmount);
        }
        
        setIsLoadingQuote(false);
      }
    }
  }, [params.quoteId, quotes]);

  // Handle jobId param (when no quote exists) - prefill client from job
  useEffect(() => {
    if (params.jobId && !params.quoteId && jobs.length > 0) {
      const job = jobs.find(j => j.id === params.jobId);
      if (job) {
        setJobId(job.id);
        if (job.clientId) {
          setClientId(job.clientId);
        }
        // Use job title/description as a starting point for line items
        if (job.title && lineItems.length === 1 && !lineItems[0].description) {
          setLineItems([{
            id: generateId(),
            description: job.title,
            quantity: 1,
            unitPrice: 0,
          }]);
        }
      }
    }
  }, [params.jobId, params.quoteId, jobs]);

  const selectedClient = clients.find((c) => c.id === clientId);

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
  const amountDue = total - depositPaid;

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const validateInvoice = () => {
    if (!clientId) {
      Alert.alert('Missing Client', 'Please select a client for this invoice');
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

  const saveInvoice = async (status: 'draft' | 'sent' = 'draft') => {
    if (!validateInvoice()) return;

    const saving = status === 'draft' ? setIsSaving : setIsSending;
    saving(true);

    try {
      const invoiceData = {
        clientId,
        jobId,
        quoteId,
        status,
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
        amountPaid: depositPaid,
        notes: notes.trim() || null,
        dueDate: dueDate.toISOString(),
      };

      const response = await api.post<{ id: string }>('/api/invoices', invoiceData);

      if (response.data?.id) {
        await fetchInvoices();
        
        if (quoteId) {
          try {
            await api.patch(`/api/quotes/${quoteId}`, { status: 'accepted' });
            await fetchQuotes();
          } catch (e) {
            console.log('Could not update quote status');
          }
        }
        
        Alert.alert(
          status === 'sent' ? 'Invoice Sent!' : 'Invoice Saved!',
          status === 'sent'
            ? 'The invoice has been sent to the client.'
            : 'Your invoice has been saved as a draft.',
          [
            {
              text: 'View Invoice',
              onPress: () => router.replace(`/more/invoice/${response.data!.id}`),
            },
            {
              text: 'Back to Invoices',
              onPress: () => router.back(),
              style: 'cancel',
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Save invoice error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to save invoice. Please try again.'
      );
    } finally {
      saving(false);
    }
  };

  if (isLoadingQuote) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.mutedForeground }}>Loading quote data...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: quoteId ? 'Create Invoice from Quote' : (jobId ? 'Create Invoice for Job' : 'Create Invoice'),
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
          {quoteId && (
            <View style={styles.quoteNotice}>
              <Text style={styles.quoteNoticeText}>
                Creating invoice from quote. Client and items have been pre-filled.
              </Text>
            </View>
          )}
          
          {jobId && !quoteId && (
            <View style={styles.quoteNotice}>
              <Text style={styles.quoteNoticeText}>
                Creating invoice for job. Client has been pre-filled.
              </Text>
            </View>
          )}

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

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Line Items</Text>
              <TouchableOpacity style={styles.addButton} onPress={addLineItem}>
                <Feather name="plus" size={16} color={colors.primary} />
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
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

          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal (ex. GST)</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST (10%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(gstAmount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total (inc. GST)</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>
            {depositPaid > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.success }]}>Deposit Paid</Text>
                <Text style={[styles.totalValue, { color: colors.success }]}>-{formatCurrency(depositPaid)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Amount Due</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(amountDue)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Due Date</Text>
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              minimumDate={new Date()}
            />
          </View>

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

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveDraftButton]}
            onPress={() => saveInvoice('draft')}
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
            onPress={() => saveInvoice('sent')}
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
    </>
  );
}

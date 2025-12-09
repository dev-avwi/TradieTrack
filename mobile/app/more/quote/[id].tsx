import { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuotesStore, useClientsStore, useAuthStore } from '../../../src/lib/store';
import { colors } from '../../../src/lib/colors';
import { DocumentPreview } from '../../../src/components/DocumentPreview';
import { API_URL } from '../../../src/lib/api';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: colors.mutedForeground, bg: colors.cardHover },
  sent: { label: 'Sent', color: colors.info, bg: colors.infoLight },
  accepted: { label: 'Accepted', color: colors.success, bg: colors.successLight },
  rejected: { label: 'Rejected', color: colors.destructive, bg: colors.destructiveLight },
  expired: { label: 'Expired', color: colors.warning, bg: colors.warningLight },
};

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getQuote, updateQuoteStatus } = useQuotesStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, token } = useAuthStore();
  const [quote, setQuote] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    const quoteData = await getQuote(id!);
    setQuote(quoteData);
    await fetchClients();
    setIsLoading(false);
  };

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleSend = async () => {
    if (!quote) return;
    setShowSendModal(true);
  };

  const confirmSend = async () => {
    setIsSending(true);
    try {
      const response = await fetch(`${API_URL}/api/quotes/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: sendMessage || undefined,
        }),
      });

      if (response.ok) {
        await loadData();
        setShowSendModal(false);
        setSendMessage('');
        Alert.alert('Success', 'Quote sent successfully to the client');
      } else {
        const success = await updateQuoteStatus(id!, 'sent');
        if (success) {
          await loadData();
          setShowSendModal(false);
          Alert.alert('Quote Updated', 'Quote marked as sent (email sending may be unavailable)');
        } else {
          Alert.alert('Error', 'Failed to send quote');
        }
      }
    } catch (error) {
      const success = await updateQuoteStatus(id!, 'sent');
      if (success) {
        await loadData();
        setShowSendModal(false);
        Alert.alert('Quote Updated', 'Quote marked as sent');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleAccept = async () => {
    Alert.alert(
      'Accept Quote',
      'Mark this quote as accepted by the client?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            const success = await updateQuoteStatus(id!, 'accepted');
            if (success) {
              await loadData();
              Alert.alert('Success', 'Quote marked as accepted');
            }
          }
        }
      ]
    );
  };

  const handleConvertToInvoice = () => {
    router.push({
      pathname: '/more/invoice/new',
      params: { quoteId: id }
    });
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Quote' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!quote) {
    return (
      <>
        <Stack.Screen options={{ title: 'Quote' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Quote not found</Text>
        </View>
      </>
    );
  }

  const client = getClient(quote.clientId);
  const status = STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const lineItems = quote.lineItems || [];

  const previewDocument = {
    id: quote.id,
    number: quote.quoteNumber,
    status: quote.status,
    clientName: client?.name || 'Unknown Client',
    clientEmail: client?.email,
    clientPhone: client?.phone,
    clientAddress: client?.address,
    subtotal: quote.subtotal,
    gstAmount: quote.gstAmount,
    total: quote.total,
    notes: quote.notes,
    createdAt: quote.createdAt,
    validUntil: quote.validUntil,
    lineItems: lineItems.map((item: any, index: number) => ({
      id: item.id || `item-${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    })),
    depositRequired: quote.depositAmount,
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: quote.quoteNumber || 'Quote',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => setShowPreview(true)}
              style={styles.headerButton}
            >
              <Feather name="eye" size={22} color={colors.primary} />
            </TouchableOpacity>
          )
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Text style={styles.totalAmount}>{formatCurrency(quote.total)}</Text>
            <Text style={styles.totalLabel}>Total (inc. GST)</Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => setShowPreview(true)}
            >
              <Feather name="eye" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Preview</Text>
            </TouchableOpacity>
            {quote.status === 'draft' && (
              <TouchableOpacity style={styles.quickAction}>
                <Feather name="edit-2" size={20} color={colors.primary} />
                <Text style={styles.quickActionText}>Edit</Text>
              </TouchableOpacity>
            )}
            {quote.status === 'accepted' && (
              <TouchableOpacity 
                style={[styles.quickAction, styles.quickActionPrimary]}
                onPress={handleConvertToInvoice}
              >
                <Feather name="arrow-right" size={20} color={colors.white} />
                <Text style={[styles.quickActionText, { color: colors.white }]}>Invoice</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Client Info */}
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Feather name="user" size={18} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.clientName}>{client?.name || 'Unknown Client'}</Text>
              </View>
            </View>
            {client?.email && (
              <View style={styles.infoRow}>
                <Feather name="mail" size={16} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{client.email}</Text>
              </View>
            )}
            {client?.phone && (
              <View style={styles.infoRow}>
                <Feather name="phone" size={16} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{client.phone}</Text>
              </View>
            )}
            {client?.address && (
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={16} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{client.address}</Text>
              </View>
            )}
          </View>

          {/* Linked Job */}
          {quote && quote.jobId && (
            <>
              <Text style={styles.sectionTitle}>Linked Job</Text>
              <TouchableOpacity 
                style={styles.card}
                onPress={() => router.push(`/job/${quote.jobId}`)}
                activeOpacity={0.7}
              >
                <View style={styles.infoRow}>
                  <Feather name="briefcase" size={18} color={colors.primary} />
                  <View style={[styles.infoContent, { flex: 1 }]}>
                    <Text style={styles.infoLabel}>View Job</Text>
                    <Text style={styles.infoText}>Tap to open linked job</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Dates */}
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={18} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoText}>{formatDate(quote.createdAt)}</Text>
              </View>
            </View>
            {quote.validUntil && (
              <View style={styles.infoRow}>
                <Feather name="clock" size={18} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Valid Until</Text>
                  <Text style={styles.infoText}>{formatDate(quote.validUntil)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Items ({lineItems.length})</Text>
              <View style={styles.card}>
                {lineItems.map((item: any, index: number) => (
                  <View 
                    key={item.id || index} 
                    style={[styles.lineItem, index > 0 && styles.lineItemBorder]}
                  >
                    <View style={styles.lineItemHeader}>
                      <Feather name="package" size={16} color={colors.mutedForeground} />
                      <Text style={styles.lineItemDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                    <View style={styles.lineItemDetails}>
                      <Text style={styles.lineItemQty}>
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </Text>
                      <Text style={styles.lineItemTotal}>
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Amounts */}
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.card}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Subtotal</Text>
              <Text style={styles.amountValue}>{formatCurrency(quote.subtotal)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>GST (10%)</Text>
              <Text style={styles.amountValue}>{formatCurrency(quote.gstAmount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.amountRow}>
              <Text style={styles.totalLabel2}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(quote.total)}</Text>
            </View>
            {quote.depositAmount && quote.depositAmount > 0 && (
              <View style={styles.depositRow}>
                <Text style={styles.depositLabel}>Deposit Required</Text>
                <Text style={styles.depositValue}>{formatCurrency(quote.depositAmount)}</Text>
              </View>
            )}
          </View>

          {/* Notes */}
          {quote.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.card}>
                <Text style={styles.notesText}>{quote.notes}</Text>
              </View>
            </>
          )}

          {/* Actions */}
          {quote.status === 'draft' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleSend}>
              <Feather name="send" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Send to Client</Text>
            </TouchableOpacity>
          )}
          
          {quote.status === 'sent' && (
            <TouchableOpacity style={styles.successButton} onPress={handleAccept}>
              <Feather name="check-circle" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Mark as Accepted</Text>
            </TouchableOpacity>
          )}

          {quote.status === 'accepted' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleConvertToInvoice}>
              <Feather name="arrow-right" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Convert to Invoice</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Document Preview Modal */}
      <DocumentPreview
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        type="quote"
        document={previewDocument}
      />

      {/* Send Modal */}
      <Modal
        visible={showSendModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSendModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSendModal(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Send Quote</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.sendInfo}>
              <Feather name="mail" size={20} color={colors.primary} />
              <View style={styles.sendInfoText}>
                <Text style={styles.sendInfoLabel}>Sending to:</Text>
                <Text style={styles.sendInfoValue}>{client?.email || 'No email'}</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Personal Message (Optional)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Add a personal message to include with the quote..."
              placeholderTextColor={colors.mutedForeground}
              value={sendMessage}
              onChangeText={setSendMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Quote Preview</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Quote Number:</Text>
                <Text style={styles.previewValue}>{quote.quoteNumber}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total:</Text>
                <Text style={[styles.previewValue, styles.previewTotal]}>
                  {formatCurrency(quote.total)}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.sendButton, isSending && styles.buttonDisabled]}
              onPress={confirmSend}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Feather name="send" size={20} color={colors.white} />
                  <Text style={styles.sendButtonText}>Send Quote</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.mutedForeground,
  },
  headerButton: {
    padding: 8,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  quoteNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.foreground,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 15,
    color: colors.foreground,
  },
  lineItem: {
    paddingVertical: 12,
  },
  lineItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lineItemDescription: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  lineItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginLeft: 26,
  },
  lineItemQty: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  lineItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  amountLabel: {
    fontSize: 15,
    color: colors.mutedForeground,
  },
  amountValue: {
    fontSize: 15,
    color: colors.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalLabel2: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.warningLight,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  depositLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.warning,
  },
  depositValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },
  notesText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
  },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginBottom: 24,
  },
  sendInfoText: {
    flex: 1,
  },
  sendInfoLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  sendInfoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.card,
    minHeight: 120,
    marginBottom: 24,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  previewLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  previewTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

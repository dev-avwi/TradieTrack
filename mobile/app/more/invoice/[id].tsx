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
  Modal,
  Switch,
  Share
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useInvoicesStore, useClientsStore, useAuthStore } from '../../../src/lib/store';
import { colors } from '../../../src/lib/colors';
import { DocumentPreview } from '../../../src/components/DocumentPreview';
import { API_URL, WEB_URL } from '../../../src/lib/api';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: colors.mutedForeground, bg: colors.cardHover },
  sent: { label: 'Sent', color: colors.info, bg: colors.infoLight },
  paid: { label: 'Paid', color: colors.success, bg: colors.successLight },
  overdue: { label: 'Overdue', color: colors.destructive, bg: colors.destructiveLight },
  cancelled: { label: 'Cancelled', color: colors.mutedForeground, bg: colors.cardHover },
};

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getInvoice, updateInvoiceStatus } = useInvoicesStore();
  const { clients, fetchClients } = useClientsStore();
  const { token } = useAuthStore();
  const [invoice, setInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTogglingPayment, setIsTogglingPayment] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    const invoiceData = await getInvoice(id!);
    setInvoice(invoiceData);
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

  const handleSend = () => {
    setShowSendModal(true);
  };

  const confirmSend = async () => {
    setIsSending(true);
    try {
      const response = await fetch(`${API_URL}/api/invoices/${id}/send`, {
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
        Alert.alert('Success', 'Invoice sent successfully to the client');
      } else {
        const success = await updateInvoiceStatus(id!, 'sent');
        if (success) {
          await loadData();
          setShowSendModal(false);
          Alert.alert('Invoice Updated', 'Invoice marked as sent (email sending may be unavailable)');
        } else {
          Alert.alert('Error', 'Failed to send invoice');
        }
      }
    } catch (error) {
      const success = await updateInvoiceStatus(id!, 'sent');
      if (success) {
        await loadData();
        setShowSendModal(false);
        Alert.alert('Invoice Updated', 'Invoice marked as sent');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkPaid = async () => {
    Alert.alert(
      'Mark as Paid',
      'Confirm that payment has been received for this invoice?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/invoices/${id}/mark-paid`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                await loadData();
                Alert.alert('Success', 'Invoice marked as paid and job status updated');
              } else {
                const success = await updateInvoiceStatus(id!, 'paid');
                if (success) {
                  await loadData();
                  Alert.alert('Invoice Updated', 'Invoice marked as paid locally');
                } else {
                  Alert.alert('Error', 'Failed to mark invoice as paid');
                }
              }
            } catch (error) {
              const success = await updateInvoiceStatus(id!, 'paid');
              if (success) {
                await loadData();
                Alert.alert('Invoice Updated', 'Invoice marked as paid locally');
              }
            }
          }
        }
      ]
    );
  };

  const handleCollectPayment = () => {
    router.push('/(tabs)/collect');
  };

  const handleToggleOnlinePayment = async (enabled: boolean) => {
    setIsTogglingPayment(true);
    try {
      const response = await fetch(`${API_URL}/api/invoices/${id}/online-payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ allowOnlinePayment: enabled }),
      });

      if (response.ok) {
        await loadData();
        Alert.alert(
          'Success',
          enabled ? 'Online payment enabled for this invoice' : 'Online payment disabled'
        );
      } else {
        Alert.alert('Error', 'Failed to update online payment setting');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update online payment setting');
    } finally {
      setIsTogglingPayment(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    if (invoice?.paymentToken) {
      const paymentUrl = `${WEB_URL}/pay/${invoice.paymentToken}`;
      try {
        await Share.share({
          message: paymentUrl,
          title: 'Payment Link',
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to share payment link');
      }
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Invoice' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <Stack.Screen options={{ title: 'Invoice' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invoice not found</Text>
        </View>
      </>
    );
  }

  const client = getClient(invoice.clientId);
  const status = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const amountDue = invoice.total - (invoice.amountPaid || 0);
  const lineItems = invoice.lineItems || [];

  const previewDocument = {
    id: invoice.id,
    number: invoice.invoiceNumber,
    status: invoice.status,
    clientName: client?.name || 'Unknown Client',
    clientEmail: client?.email,
    clientPhone: client?.phone,
    clientAddress: client?.address,
    subtotal: invoice.subtotal,
    gstAmount: invoice.gstAmount,
    total: invoice.total,
    notes: invoice.notes,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    lineItems: lineItems.map((item: any, index: number) => ({
      id: item.id || `item-${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    })),
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: invoice.invoiceNumber || 'Invoice',
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
              <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Text style={styles.totalAmount}>{formatCurrency(invoice.total)}</Text>
            <Text style={styles.totalLabel}>Total (inc. GST)</Text>
            
            {invoice.status !== 'paid' && amountDue > 0 && (
              <View style={styles.dueContainer}>
                <Text style={styles.dueLabel}>Amount Due:</Text>
                <Text style={styles.dueAmount}>{formatCurrency(amountDue)}</Text>
              </View>
            )}
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
            {invoice.status === 'draft' && (
              <TouchableOpacity style={styles.quickAction}>
                <Feather name="edit-2" size={20} color={colors.primary} />
                <Text style={styles.quickActionText}>Edit</Text>
              </TouchableOpacity>
            )}
            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
              <TouchableOpacity 
                style={[styles.quickAction, styles.quickActionPrimary]}
                onPress={handleCollectPayment}
              >
                <Feather name="credit-card" size={20} color={colors.white} />
                <Text style={[styles.quickActionText, { color: colors.white }]}>Pay</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Overdue Alert */}
          {invoice.status === 'overdue' && (
            <View style={styles.overdueAlert}>
              <Feather name="alert-circle" size={20} color={colors.destructive} />
              <Text style={styles.overdueText}>This invoice is overdue</Text>
            </View>
          )}

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
          {invoice && invoice.jobId && (
            <>
              <Text style={styles.sectionTitle}>Linked Job</Text>
              <TouchableOpacity 
                style={styles.card}
                onPress={() => router.push(`/job/${invoice.jobId}`)}
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
                <Text style={styles.infoText}>{formatDate(invoice.createdAt)}</Text>
              </View>
            </View>
            {invoice.dueDate && (
              <View style={styles.infoRow}>
                <Feather name="clock" size={18} color={invoice.status === 'overdue' ? colors.destructive : colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Due Date</Text>
                  <Text style={[styles.infoText, invoice.status === 'overdue' && { color: colors.destructive }]}>
                    {formatDate(invoice.dueDate)}
                  </Text>
                </View>
              </View>
            )}
            {invoice.paidAt && (
              <View style={styles.infoRow}>
                <Feather name="check-circle" size={18} color={colors.success} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Paid</Text>
                  <Text style={styles.infoText}>{formatDate(invoice.paidAt)}</Text>
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
              <Text style={styles.amountValue}>{formatCurrency(invoice.subtotal)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>GST (10%)</Text>
              <Text style={styles.amountValue}>{formatCurrency(invoice.gstAmount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.amountRow}>
              <Text style={styles.totalLabel2}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.total)}</Text>
            </View>
            {invoice.amountPaid > 0 && (
              <>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Amount Paid</Text>
                  <Text style={[styles.amountValue, { color: colors.success }]}>
                    -{formatCurrency(invoice.amountPaid)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.amountRow}>
                  <Text style={[styles.totalLabel2, { color: colors.warning }]}>Balance Due</Text>
                  <Text style={[styles.totalValue, { color: colors.warning }]}>
                    {formatCurrency(amountDue)}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Notes */}
          {invoice.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.card}>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            </>
          )}

          {/* Online Payment Section */}
          {invoice.status !== 'paid' && (
            <>
              <Text style={styles.sectionTitle}>Online Payment</Text>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Feather name="credit-card" size={20} color={colors.primary} />
                    <View style={styles.switchText}>
                      <Text style={styles.switchLabel}>Allow Online Payment</Text>
                      <Text style={styles.switchDescription}>
                        Let customers pay via card
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={invoice.allowOnlinePayment || false}
                    onValueChange={handleToggleOnlinePayment}
                    disabled={isTogglingPayment}
                    trackColor={{ false: colors.muted, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>
                
                {invoice.allowOnlinePayment && invoice.paymentToken && (
                  <View style={styles.paymentLinkContainer}>
                    <Text style={styles.paymentLinkLabel}>Payment Link:</Text>
                    <View style={styles.paymentLinkRow}>
                      <Text style={styles.paymentLinkUrl} numberOfLines={1}>
                        {`${WEB_URL}/pay/${invoice.paymentToken}`}
                      </Text>
                      <TouchableOpacity 
                        style={styles.copyButton}
                        onPress={handleCopyPaymentLink}
                      >
                        <Feather name="share-2" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Actions */}
          {invoice.status === 'draft' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleSend}>
              <Feather name="send" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Send to Client</Text>
            </TouchableOpacity>
          )}
          
          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
            <View style={styles.actionsColumn}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCollectPayment}>
                <Feather name="credit-card" size={20} color={colors.white} />
                <Text style={styles.primaryButtonText}>Collect Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleMarkPaid}>
                <Feather name="check-circle" size={20} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Mark as Paid</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Document Preview Modal */}
      <DocumentPreview
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        type="invoice"
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
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Send Invoice</Text>
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
              placeholder="Add a personal message to include with the invoice..."
              placeholderTextColor={colors.mutedForeground}
              value={sendMessage}
              onChangeText={setSendMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Invoice Preview</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Invoice Number:</Text>
                <Text style={styles.previewValue}>{invoice.invoiceNumber}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Due Date:</Text>
                <Text style={styles.previewValue}>{formatDate(invoice.dueDate)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total:</Text>
                <Text style={[styles.previewValue, styles.previewTotal]}>
                  {formatCurrency(invoice.total)}
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
                  <Text style={styles.sendButtonText}>Send Invoice</Text>
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
  invoiceNumber: {
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
  dueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dueLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  dueAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.warning,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
  overdueAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: colors.destructiveLight,
    borderRadius: 10,
    marginBottom: 16,
  },
  overdueText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.destructive,
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
  notesText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 22,
  },
  actionsColumn: {
    gap: 12,
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
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  switchText: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  switchDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  paymentLinkContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentLinkLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: 8,
  },
  paymentLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paymentLinkUrl: {
    flex: 1,
    fontSize: 12,
    color: colors.foreground,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
    marginLeft: 8,
  },
});

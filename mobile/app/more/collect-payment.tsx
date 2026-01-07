import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  StyleSheet,
  RefreshControl,
  Share,
  Image
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useStripeTerminal } from '../../src/hooks/useServices';
import { isTapToPayAvailable } from '../../src/lib/stripe-terminal';
import { useInvoicesStore, useClientsStore } from '../../src/lib/store';
import api from '../../src/lib/api';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
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
  headerBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.promoBorder,
  },
  headerBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerBannerTitle: {
    color: colors.foreground,
    fontWeight: '600',
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  headerBannerSubtitle: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  quickLinkIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  amountSection: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    color: colors.foreground,
    fontWeight: '600',
    fontSize: 16,
    marginBottom: spacing.md,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: 64,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  amountInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  descriptionInput: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: 48,
    color: colors.foreground,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodCardDisabled: {
    opacity: 0.5,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  paymentMethodContent: {
    flex: 1,
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodTitle: {
    color: colors.foreground,
    fontWeight: '600',
    fontSize: 16,
  },
  paymentMethodDescription: {
    color: colors.mutedForeground,
    fontSize: 14,
    marginTop: 4,
  },
  pendingSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pendingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptyPending: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyPendingText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingItemContent: {
    flex: 1,
  },
  pendingItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  pendingItemClient: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  pendingItemRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  pendingItemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  collectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    gap: 4,
  },
  collectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  infoCard: {
    marginTop: spacing.lg,
  },
  infoCardTitle: {
    color: colors.foreground,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  infoCardText: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  infoCardFees: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  warningCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.warningLight,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  warningTitle: {
    color: colors.warning,
    fontWeight: '600',
    marginBottom: 4,
  },
  warningText: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalStepTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.xl,
  },
  modalStepSubtitle: {
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  readyIcon: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  amountDisplay: {
    color: colors.foreground,
    fontSize: 36,
    fontWeight: 'bold',
  },
  acceptedMethodsCard: {
    marginTop: 32,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  acceptedMethodsText: {
    color: colors.mutedForeground,
    fontSize: 14,
    textAlign: 'center',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    color: colors.success,
    fontSize: 24,
    fontWeight: 'bold',
  },
  successAmount: {
    color: colors.foreground,
    fontSize: 18,
    marginTop: spacing.sm,
  },
  errorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.destructiveLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  errorTitle: {
    color: colors.destructive,
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalFooter: {
    padding: spacing.lg,
  },
  statsGrid: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  demoModeBanner: {
    backgroundColor: colors.infoLight || colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.info || colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  demoModeText: {
    flex: 1,
  },
  demoModeTitle: {
    color: colors.warning,
    fontWeight: '600',
    fontSize: 14,
  },
  demoModeDescription: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  receiptInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    color: colors.foreground,
    fontSize: 14,
  },
  qrCodeContainer: {
    width: 220,
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    padding: spacing.sm,
  },
  qrCodeWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeImage: {
    width: 200,
    height: 200,
  },
  qrCodePlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrAmountDisplay: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  qrUrlContainer: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrUrlText: {
    flex: 1,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  qrActionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  paymentLinkInputContainer: {
    width: '100%',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  paymentLinkLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
});

interface PaymentMethodCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'default';
  onPress: () => void;
  disabled?: boolean;
  colors: ThemeColors;
}

function PaymentMethodCard({ 
  icon, 
  title, 
  description, 
  badge, 
  badgeVariant = 'success',
  onPress,
  disabled = false,
  colors
}: PaymentMethodCardProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.paymentMethodCard, disabled && styles.paymentMethodCardDisabled]}
    >
      <View style={styles.paymentMethodIcon}>
        {icon}
      </View>
      <View style={styles.paymentMethodContent}>
        <View style={styles.paymentMethodHeader}>
          <Text style={styles.paymentMethodTitle}>{title}</Text>
          {badge && (
            <Badge variant={badgeVariant} style={{ marginLeft: 8 }}>
              {badge}
            </Badge>
          )}
        </View>
        <Text style={styles.paymentMethodDescription}>
          {description}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function StatCard({ 
  title, 
  value, 
  icon,
  colors
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconContainer}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

interface SelectedInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  total: number;
  amountPaid: number;
  amountDue: number;
}

export default function CollectScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { invoiceId } = useLocalSearchParams<{ invoiceId?: string }>();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showTapToPayModal, setShowTapToPayModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'ready' | 'connecting' | 'waiting' | 'processing' | 'success' | 'error'>('ready');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SelectedInvoice | null>(null);
  const [lastPaymentAmount, setLastPaymentAmount] = useState(0);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const hasAutoSelectedInvoice = useRef(false);
  
  // QR Code Modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrPaymentUrl, setQrPaymentUrl] = useState('');
  const [qrPaymentRequest, setQrPaymentRequest] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  
  // Payment Link Modal state
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [paymentLinkRequest, setPaymentLinkRequest] = useState<any>(null);
  const [linkRecipientEmail, setLinkRecipientEmail] = useState('');
  const [linkRecipientPhone, setLinkRecipientPhone] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  
  const { invoices, fetchInvoices } = useInvoicesStore();
  const { clients, fetchClients } = useClientsStore();
  const terminal = useStripeTerminal();
  const tapToPaySupported = isTapToPayAvailable();

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchInvoices(), fetchClients()]);
    setIsLoading(false);
  }, [fetchInvoices, fetchClients]);

  useEffect(() => {
    refreshData();
    if (tapToPaySupported) {
      terminal.initialize();
    }
  }, []);

  // Reset auto-selection flag when invoiceId changes (allows new invoice selection)
  useEffect(() => {
    hasAutoSelectedInvoice.current = false;
  }, [invoiceId]);

  // Auto-select invoice when navigated from invoice detail with invoiceId param
  useEffect(() => {
    if (invoiceId && invoices.length > 0 && clients.length > 0 && !hasAutoSelectedInvoice.current) {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (invoice) {
        const client = clients.find(c => c.id === invoice.clientId);
        // Parse amounts - database stores dollars as strings
        const invoiceTotal = typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total || 0);
        const invoicePaid = typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : (invoice.amountPaid || 0);
        const invoiceAmountDue = invoiceTotal - invoicePaid;
        
        setSelectedInvoice({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          clientName: client?.name || 'Unknown Client',
          clientEmail: client?.email,
          clientPhone: client?.phone,
          total: invoiceTotal,
          amountPaid: invoicePaid,
          amountDue: invoiceAmountDue,
        });
        
        setAmount(invoiceAmountDue.toFixed(2));
        setDescription(`Payment for ${invoice.invoiceNumber}`);
        hasAutoSelectedInvoice.current = true;
      }
    } else if (!invoiceId) {
      // Clear selection when navigating to collect without an invoice ID
      hasAutoSelectedInvoice.current = false;
    }
  }, [invoiceId, invoices, clients]);

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const getClientName = (clientId: string) => {
    const client = getClient(clientId);
    return client?.name || 'Unknown Client';
  };

  // Handle collecting payment for a specific invoice
  const handleCollectForInvoice = (invoice: any) => {
    const client = getClient(invoice.clientId);
    // Parse amounts - database stores dollars as strings
    const invoiceTotal = typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total || 0);
    const invoicePaid = typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : (invoice.amountPaid || 0);
    const amountDue = invoiceTotal - invoicePaid;
    
    setSelectedInvoice({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: client?.name || 'Unknown Client',
      clientEmail: client?.email,
      clientPhone: client?.phone,
      total: invoiceTotal,
      amountPaid: invoicePaid,
      amountDue,
    });
    
    // Pre-fill the amount and description
    setAmount(amountDue.toFixed(2));
    setDescription(`Payment for ${invoice.invoiceNumber}`);
  };

  // Clear invoice selection
  const clearInvoiceSelection = () => {
    setSelectedInvoice(null);
    setAmount('');
    setDescription('');
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '$0.00';
    return `$${num.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const totalPending = pendingInvoices.reduce((sum, i) => {
    const total = typeof i.total === 'string' ? parseFloat(i.total) : (i.total || 0);
    const paid = typeof i.amountPaid === 'string' ? parseFloat(i.amountPaid) : (i.amountPaid || 0);
    return sum + (total - paid);
  }, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const getAmountInCents = (): number => {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  };

  const handleTapToPay = async () => {
    const amountCents = getAmountInCents();
    if (amountCents < 500) {
      Alert.alert('Minimum Amount', 'Tap to Pay requires a minimum of $5.00');
      return;
    }

    // Only show custom modal in simulation mode (Expo Go)
    // When using real SDK, Apple's native Tap to Pay UI appears automatically
    const useNativeSDK = !terminal.isSimulation && terminal.isSDKAvailable;
    
    if (!useNativeSDK) {
      // Simulation mode: show custom modal as fallback UI
      setShowTapToPayModal(true);
      setPaymentStep('connecting');
    }

    try {
      if (!terminal.isAvailable) {
        const initialized = await terminal.initialize();
        if (!initialized && !useNativeSDK) {
          setPaymentStep('error');
          return;
        }
      }

      if (!terminal.reader) {
        const connected = await terminal.connectReader();
        if (!connected && !useNativeSDK) {
          setPaymentStep('error');
          return;
        }
      }

      if (!useNativeSDK) {
        setPaymentStep('waiting');
      }
      
      // When using real SDK, collectPaymentMethod will present Apple's native 
      // "Hold Here to Pay" interface automatically - no custom UI needed
      const result = await terminal.collectPayment(amountCents, description || undefined);
      
      if (result) {
        setLastPaymentAmount(amountCents);
        
        // If paying an invoice, update the invoice payment status
        if (selectedInvoice) {
          try {
            await api.post(`/api/invoices/${selectedInvoice.id}/record-payment`, {
              amount: (amountCents / 100).toFixed(2), // Server expects dollars, not cents
              paymentMethod: 'card', // Server accepts: cash, bank_transfer, cheque, card, other
              notes: 'Tap to Pay contactless payment',
            });
            // Refresh invoices
            fetchInvoices();
          } catch (err) {
            console.error('Failed to record invoice payment:', err);
          }
        }
        
        if (!useNativeSDK) {
          // Simulation mode: show success in modal then switch to receipt
          setPaymentStep('success');
          setTimeout(() => {
            setShowTapToPayModal(false);
            setPaymentStep('ready');
            setShowReceiptModal(true);
          }, 1500);
        } else {
          // Native SDK: Payment succeeded, go directly to receipt
          setShowReceiptModal(true);
        }
      } else {
        if (!useNativeSDK) {
          setPaymentStep('error');
        } else {
          // Native SDK: Payment was cancelled or failed
          Alert.alert('Payment Cancelled', 'The payment was not completed.');
        }
      }
    } catch (error: any) {
      console.error('Tap to Pay error:', error);
      if (!useNativeSDK) {
        setPaymentStep('error');
      } else {
        Alert.alert('Payment Error', error?.message || 'The payment could not be processed. Please try again.');
      }
    }
  };

  // Send receipt via email
  const sendReceiptEmail = async () => {
    setSendingReceipt(true);
    try {
      const recipientEmail = manualEmail || selectedInvoice?.clientEmail;
      if (!recipientEmail) {
        Alert.alert('No Email', 'Please enter an email address to send the receipt.');
        setSendingReceipt(false);
        return;
      }

      await api.post('/api/payments/send-receipt', {
        email: recipientEmail,
        amount: lastPaymentAmount, // Amount in cents - backend divides by 100
        description: description || 'Payment received',
        invoiceId: selectedInvoice?.id,
        invoiceNumber: selectedInvoice?.invoiceNumber,
        clientName: selectedInvoice?.clientName,
        method: 'email',
      });

      Alert.alert('Receipt Sent', `Receipt emailed to ${recipientEmail}`);
      handleCloseReceiptModal();
    } catch (error) {
      console.error('Failed to send receipt:', error);
      Alert.alert('Error', 'Failed to send receipt. Please try again.');
    } finally {
      setSendingReceipt(false);
    }
  };

  // Send receipt via SMS
  const sendReceiptSMS = async () => {
    setSendingReceipt(true);
    try {
      const recipientPhone = manualPhone || selectedInvoice?.clientPhone;
      if (!recipientPhone) {
        Alert.alert('No Phone', 'Please enter a phone number to send the receipt.');
        setSendingReceipt(false);
        return;
      }

      await api.post('/api/payments/send-receipt', {
        phone: recipientPhone,
        amount: lastPaymentAmount, // Amount in cents - backend divides by 100
        description: description || 'Payment received',
        invoiceId: selectedInvoice?.id,
        invoiceNumber: selectedInvoice?.invoiceNumber,
        clientName: selectedInvoice?.clientName,
        method: 'sms',
      });

      Alert.alert('Receipt Sent', `Receipt SMS sent to ${recipientPhone}`);
      handleCloseReceiptModal();
    } catch (error: any) {
      console.error('Failed to send SMS receipt:', error);
      if (error?.message?.includes('disabled')) {
        Alert.alert('SMS Disabled', 'SMS is disabled during beta. Use email instead.');
      } else {
        Alert.alert('Error', 'Failed to send SMS. Please try again.');
      }
    } finally {
      setSendingReceipt(false);
    }
  };

  // Close receipt modal and reset state
  const handleCloseReceiptModal = () => {
    setShowReceiptModal(false);
    setAmount('');
    setDescription('');
    setSelectedInvoice(null);
    setLastPaymentAmount(0);
    setManualEmail('');
    setManualPhone('');
  };

  const handleCancelPayment = async () => {
    await terminal.cancelPayment();
    setShowTapToPayModal(false);
    setPaymentStep('ready');
  };

  const handleQRCode = async () => {
    const amountCents = getAmountInCents();
    if (amountCents < 500) {
      Alert.alert('Minimum Amount', 'Payments require a minimum of $5.00');
      return;
    }

    setQrLoading(true);
    setShowQRModal(true);

    try {
      const response = await api.post<{ 
        id: string; 
        token: string; 
        paymentUrl: string; 
        amount: string;
        status: string;
      }>('/api/payment-requests', {
        amount: amountCents / 100, // API expects dollars
        description: description || 'Payment',
        invoiceId: selectedInvoice?.id,
        clientId: selectedInvoice?.clientId,
        reference: selectedInvoice?.invoiceNumber,
      });

      if (response.data) {
        setQrPaymentUrl(response.data.paymentUrl);
        setQrPaymentRequest(response.data);
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code');
      setShowQRModal(false);
    } finally {
      setQrLoading(false);
    }
  };

  const handleCopyPaymentUrl = async () => {
    if (qrPaymentUrl) {
      try {
        await Clipboard.setStringAsync(qrPaymentUrl);
        Alert.alert('Copied!', 'Payment link copied to clipboard');
      } catch (error) {
        Alert.alert('Payment Link', qrPaymentUrl, [{ text: 'OK' }]);
      }
    }
  };

  const handleSharePaymentUrl = async () => {
    if (qrPaymentUrl) {
      try {
        const amountDisplay = (getAmountInCents() / 100).toFixed(2);
        await Share.share({
          message: `Please pay $${amountDisplay} using this secure link: ${qrPaymentUrl}`,
          url: qrPaymentUrl,
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setQrPaymentUrl('');
    setQrPaymentRequest(null);
    setAmount('');
    setDescription('');
    setSelectedInvoice(null);
  };

  const handlePaymentLink = async () => {
    const amountCents = getAmountInCents();
    if (amountCents < 500) {
      Alert.alert('Minimum Amount', 'Payments require a minimum of $5.00');
      return;
    }

    // Pre-fill recipient from selected invoice if available
    setLinkRecipientEmail(selectedInvoice?.clientEmail || '');
    setLinkRecipientPhone(selectedInvoice?.clientPhone || '');
    
    setSendingLink(true);
    
    try {
      // Create payment request first
      const response = await api.post<{ 
        id: string; 
        token: string; 
        paymentUrl: string; 
        amount: string;
        status: string;
      }>('/api/payment-requests', {
        amount: amountCents / 100, // API expects dollars
        description: description || 'Payment',
        invoiceId: selectedInvoice?.id,
        clientId: selectedInvoice?.clientId,
        reference: selectedInvoice?.invoiceNumber,
      });

      if (response.data) {
        setPaymentLinkRequest(response.data);
        setShowPaymentLinkModal(true);
      }
    } catch (error) {
      console.error('Failed to create payment request:', error);
      Alert.alert('Error', 'Failed to create payment link');
    } finally {
      setSendingLink(false);
    }
  };

  const sendPaymentLinkViaEmail = async () => {
    if (!paymentLinkRequest?.id) return;
    
    const email = linkRecipientEmail.trim();
    if (!email) {
      Alert.alert('Email Required', 'Please enter an email address');
      return;
    }
    
    setSendingLink(true);
    try {
      await api.post(`/api/payment-requests/${paymentLinkRequest.id}/send-email`, {
        email,
      });
      
      Alert.alert('Success', `Payment link sent to ${email}`);
      handleClosePaymentLinkModal();
    } catch (error) {
      console.error('Failed to send email:', error);
      Alert.alert('Error', 'Failed to send payment link via email');
    } finally {
      setSendingLink(false);
    }
  };

  const sendPaymentLinkViaSMS = async () => {
    if (!paymentLinkRequest?.id) return;
    
    const phone = linkRecipientPhone.trim();
    if (!phone) {
      Alert.alert('Phone Required', 'Please enter a phone number');
      return;
    }
    
    setSendingLink(true);
    try {
      await api.post(`/api/payment-requests/${paymentLinkRequest.id}/send-sms`, {
        phone,
      });
      
      Alert.alert('Success', `Payment link sent to ${phone}`);
      handleClosePaymentLinkModal();
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      if (error?.response?.data?.error?.includes('disabled')) {
        Alert.alert('SMS Disabled', 'SMS is disabled during beta. Use email instead, or copy the link to share manually.');
      } else {
        Alert.alert('Error', 'Failed to send payment link via SMS');
      }
    } finally {
      setSendingLink(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    if (paymentLinkRequest?.paymentUrl) {
      try {
        await Clipboard.setStringAsync(paymentLinkRequest.paymentUrl);
        Alert.alert('Copied!', 'Payment link copied to clipboard');
      } catch (error) {
        Alert.alert('Payment Link', paymentLinkRequest.paymentUrl, [{ text: 'OK' }]);
      }
    }
  };

  const handleSharePaymentLink = async () => {
    if (paymentLinkRequest?.paymentUrl) {
      try {
        const amountDisplay = (getAmountInCents() / 100).toFixed(2);
        await Share.share({
          message: `Please pay $${amountDisplay} using this secure link: ${paymentLinkRequest.paymentUrl}`,
          url: paymentLinkRequest.paymentUrl,
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const handleClosePaymentLinkModal = () => {
    setShowPaymentLinkModal(false);
    setPaymentLinkRequest(null);
    setLinkRecipientEmail('');
    setLinkRecipientPhone('');
    setAmount('');
    setDescription('');
    setSelectedInvoice(null);
  };

  const renderTapToPayModal = () => (
    <Modal
      visible={showTapToPayModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancelPayment}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Tap to Pay</Text>
          <TouchableOpacity onPress={handleCancelPayment} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          {paymentStep === 'connecting' && (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalStepTitle}>Connecting...</Text>
              <Text style={styles.modalStepSubtitle}>
                Setting up Tap to Pay on this device
              </Text>
            </>
          )}

          {paymentStep === 'waiting' && (
            <>
              <View style={styles.readyIcon}>
                <Feather name="smartphone" size={64} color={colors.primary} />
              </View>
              <Text style={styles.amountDisplay}>
                ${(getAmountInCents() / 100).toFixed(2)}
              </Text>
              <Text style={styles.modalStepTitle}>Ready for Payment</Text>
              <Text style={styles.modalStepSubtitle}>
                Ask customer to tap their card or phone on the back of your device
              </Text>
              <View style={styles.acceptedMethodsCard}>
                <Text style={styles.acceptedMethodsText}>
                  Accepts contactless cards, Apple Pay, and Google Pay
                </Text>
              </View>
            </>
          )}

          {paymentStep === 'processing' && (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalStepTitle}>Processing Payment...</Text>
              <Text style={styles.modalStepSubtitle}>
                Please wait while we process the payment
              </Text>
            </>
          )}

          {paymentStep === 'success' && (
            <>
              <View style={styles.successIcon}>
                <Feather name="check-circle" size={48} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Payment Successful!</Text>
              <Text style={styles.successAmount}>
                ${(getAmountInCents() / 100).toFixed(2)} received
              </Text>
            </>
          )}

          {paymentStep === 'error' && (
            <>
              <View style={styles.errorIcon}>
                <Feather name="alert-circle" size={48} color={colors.destructive} />
              </View>
              <Text style={styles.errorTitle}>Payment Failed</Text>
              <Text style={styles.modalStepSubtitle}>
                {terminal.error || 'The payment could not be processed. Please try again.'}
              </Text>
              <Button
                variant="default"
                onPress={() => {
                  setPaymentStep('ready');
                  handleTapToPay();
                }}
                fullWidth
              >
                Try Again
              </Button>
            </>
          )}
        </View>

        {(paymentStep === 'waiting' || paymentStep === 'connecting') && (
          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={handleCancelPayment} fullWidth>
              Cancel Payment
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );

  const renderQRModal = () => (
    <Modal
      visible={showQRModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseQRModal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Payment QR Code</Text>
          <TouchableOpacity onPress={handleCloseQRModal} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          {qrLoading ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalStepTitle}>Generating QR Code...</Text>
            </>
          ) : qrPaymentUrl ? (
            <>
              <Text style={styles.qrAmountDisplay}>
                ${(getAmountInCents() / 100).toFixed(2)}
              </Text>
              
              {selectedInvoice && (
                <Text style={styles.modalStepSubtitle}>
                  {selectedInvoice.invoiceNumber} • {selectedInvoice.clientName}
                </Text>
              )}
              
              <View style={[styles.qrCodeContainer, { marginTop: spacing.xl }]}>
                <View style={styles.qrCodeWrapper}>
                  <Image
                    source={{ 
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPaymentUrl)}&margin=10` 
                    }}
                    style={styles.qrCodeImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
              
              <Text style={styles.modalStepSubtitle}>
                Customer can scan this code to pay securely online
              </Text>

              <TouchableOpacity 
                style={styles.qrUrlContainer}
                onPress={handleCopyPaymentUrl}
                activeOpacity={0.7}
              >
                <Feather name="link" size={16} color={colors.mutedForeground} />
                <Text style={styles.qrUrlText} numberOfLines={1}>
                  {qrPaymentUrl}
                </Text>
                <Feather name="copy" size={16} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.qrActionButtons}>
                <Button 
                  variant="outline" 
                  onPress={handleCopyPaymentUrl}
                  style={{ flex: 1 }}
                >
                  <Feather name="copy" size={18} color={colors.foreground} />
                  <Text style={{ marginLeft: spacing.xs }}>Copy Link</Text>
                </Button>
                <Button 
                  variant="default" 
                  onPress={handleSharePaymentUrl}
                  style={{ flex: 1 }}
                >
                  <Feather name="share" size={18} color={colors.primaryForeground} />
                  <Text style={{ marginLeft: spacing.xs, color: colors.primaryForeground }}>Share</Text>
                </Button>
              </View>
            </>
          ) : (
            <Text style={styles.modalStepSubtitle}>Failed to generate QR code</Text>
          )}
        </View>

        <View style={styles.modalFooter}>
          <Button variant="outline" onPress={handleCloseQRModal} fullWidth>
            Done
          </Button>
        </View>
      </View>
    </Modal>
  );

  const renderPaymentLinkModal = () => (
    <Modal
      visible={showPaymentLinkModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClosePaymentLinkModal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Send Payment Link</Text>
          <TouchableOpacity onPress={handleClosePaymentLinkModal} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
          <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <View style={styles.readyIcon}>
              <Feather name="link" size={64} color={colors.primary} />
            </View>
            <Text style={styles.qrAmountDisplay}>
              ${(getAmountInCents() / 100).toFixed(2)}
            </Text>
            {selectedInvoice && (
              <Text style={styles.modalStepSubtitle}>
                {selectedInvoice.invoiceNumber} • {selectedInvoice.clientName}
              </Text>
            )}
          </View>

          <View style={styles.paymentLinkInputContainer}>
            <View>
              <Text style={styles.paymentLinkLabel}>Send via Email</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextInput
                  style={[styles.descriptionInput, { flex: 1, marginTop: 0 }]}
                  placeholder="Enter email address"
                  placeholderTextColor={colors.mutedForeground}
                  value={linkRecipientEmail}
                  onChangeText={setLinkRecipientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button 
                  variant="default" 
                  onPress={sendPaymentLinkViaEmail}
                  disabled={sendingLink || !linkRecipientEmail.trim()}
                >
                  {sendingLink ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="send" size={18} color={colors.primaryForeground} />
                  )}
                </Button>
              </View>
            </View>

            <View>
              <Text style={styles.paymentLinkLabel}>Send via SMS</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextInput
                  style={[styles.descriptionInput, { flex: 1, marginTop: 0 }]}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.mutedForeground}
                  value={linkRecipientPhone}
                  onChangeText={setLinkRecipientPhone}
                  keyboardType="phone-pad"
                />
                <Button 
                  variant="default" 
                  onPress={sendPaymentLinkViaSMS}
                  disabled={sendingLink || !linkRecipientPhone.trim()}
                >
                  {sendingLink ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="send" size={18} color={colors.primaryForeground} />
                  )}
                </Button>
              </View>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: spacing.xs }}>
                Note: SMS may be disabled during beta
              </Text>
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.paymentLinkLabel}>Or share manually</Text>
              <TouchableOpacity 
                style={styles.qrUrlContainer}
                onPress={handleCopyPaymentLink}
                activeOpacity={0.7}
              >
                <Feather name="link" size={16} color={colors.mutedForeground} />
                <Text style={styles.qrUrlText} numberOfLines={1}>
                  {paymentLinkRequest?.paymentUrl || 'Loading...'}
                </Text>
                <Feather name="copy" size={16} color={colors.primary} />
              </TouchableOpacity>
              
              <View style={[styles.qrActionButtons, { marginTop: spacing.md }]}>
                <Button 
                  variant="outline" 
                  onPress={handleCopyPaymentLink}
                  style={{ flex: 1 }}
                >
                  <Feather name="copy" size={18} color={colors.foreground} />
                  <Text style={{ marginLeft: spacing.xs }}>Copy</Text>
                </Button>
                <Button 
                  variant="outline" 
                  onPress={handleSharePaymentLink}
                  style={{ flex: 1 }}
                >
                  <Feather name="share" size={18} color={colors.foreground} />
                  <Text style={{ marginLeft: spacing.xs }}>Share</Text>
                </Button>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button variant="outline" onPress={handleClosePaymentLinkModal} fullWidth>
            Done
          </Button>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Collect Payment</Text>
            <Text style={styles.pageSubtitle}>Get paid instantly with multiple options</Text>
          </View>

          {terminal.isSimulation && (
            <View style={styles.demoModeBanner}>
              <Feather name="smartphone" size={24} color={colors.info} />
              <View style={styles.demoModeText}>
                <Text style={[styles.demoModeTitle, { color: colors.info }]}>Native App Required for NFC</Text>
                <Text style={styles.demoModeDescription}>
                  Install the TradieTrack app from the App Store or Google Play to use Tap to Pay. QR codes, payment links, and record cash work now.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.headerBanner}>
            <View style={styles.headerBannerRow}>
              <Feather name="wifi" size={24} color={colors.primary} />
              <Text style={styles.headerBannerTitle}>Accept Payments On-Site</Text>
            </View>
            <Text style={styles.headerBannerSubtitle}>
              Get paid instantly with Tap to Pay, QR codes, or send a payment link
            </Text>
          </View>

          <View style={styles.quickLinksRow}>
            <TouchableOpacity 
              style={styles.quickLink} 
              activeOpacity={0.7}
              onPress={() => router.push('/more/invoices')}
            >
              <View style={styles.quickLinkIconContainer}>
                <Feather name="file-text" size={18} color={colors.info} />
              </View>
              <Text style={styles.quickLinkText}>View Invoices</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickLink} 
              activeOpacity={0.7}
              onPress={() => router.push('/more/payments')}
            >
              <View style={styles.quickLinkIconContainer}>
                <Feather name="clock" size={18} color={colors.warning} />
              </View>
              <Text style={styles.quickLinkText}>Payment History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.amountSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={styles.sectionLabel}>Payment Amount</Text>
              {selectedInvoice && (
                <TouchableOpacity 
                  onPress={clearInvoiceSelection}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  activeOpacity={0.7}
                >
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {selectedInvoice && (
              <View style={{
                backgroundColor: colors.primaryLight,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                borderWidth: 1,
                borderColor: colors.promoBorder,
              }}>
                <Feather name="file-text" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
                    {selectedInvoice.invoiceNumber}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {selectedInvoice.clientName} • Due: {formatCurrency(selectedInvoice.amountDue)}
                  </Text>
                </View>
                <Badge variant="success">Invoice</Badge>
              </View>
            )}
            
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Description (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <Text style={styles.sectionLabel}>Payment Methods</Text>

          {/* Apple Requirement 5.5: Use SF Symbol wave.3.right.circle for Tap to Pay
              In native builds, replace Feather 'radio' with actual SF Symbol via react-native-sfsymbols
              The 'radio' icon from Feather resembles the wave pattern as a fallback */}
          <PaymentMethodCard
            icon={<Feather name="radio" size={24} color={colors.primary} />}
            title="Tap to Pay"
            description="Customer taps card on your phone"
            badge={tapToPaySupported ? "Ready" : "Build Required"}
            badgeVariant={tapToPaySupported ? 'success' : 'warning'}
            onPress={handleTapToPay}
            disabled={!tapToPaySupported}
            colors={colors}
          />

          <PaymentMethodCard
            icon={<Feather name="grid" size={24} color={colors.primary} />}
            title="QR Code"
            description="Customer scans and pays online"
            badge="Works Now"
            badgeVariant="success"
            onPress={handleQRCode}
            colors={colors}
          />

          <PaymentMethodCard
            icon={<Feather name="credit-card" size={24} color={colors.primary} />}
            title="Payment Link"
            description="Send via SMS or email"
            badge="Works Now"
            badgeVariant="success"
            onPress={handlePaymentLink}
            colors={colors}
          />

          <View style={styles.pendingSection}>
            <View style={styles.pendingSectionHeader}>
              <Feather name="clock" size={18} color={colors.foreground} />
              <Text style={styles.pendingSectionTitle}>Pending Payments</Text>
            </View>
            
            {pendingInvoices.length === 0 ? (
              <View style={styles.emptyPending}>
                <Feather name="check-circle" size={32} color={colors.success} />
                <Text style={styles.emptyPendingText}>All caught up!</Text>
              </View>
            ) : (
              pendingInvoices.slice(0, 5).map(invoice => {
                const isSelected = selectedInvoice?.id === invoice.id;
                const amountDue = (invoice.total || 0) - (invoice.amountPaid || 0);
                return (
                  <TouchableOpacity 
                    key={invoice.id} 
                    style={[
                      styles.pendingItem,
                      isSelected && { borderColor: colors.primary, borderWidth: 2 }
                    ]}
                    onPress={() => handleCollectForInvoice(invoice)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pendingItemContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.pendingItemTitle}>{invoice.invoiceNumber}</Text>
                        {isSelected && (
                          <Badge variant="success">Selected</Badge>
                        )}
                        {invoice.status === 'overdue' && !isSelected && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                      </View>
                      <Text style={styles.pendingItemClient}>{getClientName(invoice.clientId)}</Text>
                    </View>
                    <View style={styles.pendingItemRight}>
                      <Text style={styles.pendingItemAmount}>{formatCurrency(amountDue)}</Text>
                      <View style={[
                        styles.collectButton,
                        isSelected && { backgroundColor: colors.success }
                      ]}>
                        <Feather 
                          name={isSelected ? "check" : "credit-card"} 
                          size={14} 
                          color={colors.primaryForeground} 
                        />
                        <Text style={styles.collectButtonText}>
                          {isSelected ? 'Ready' : 'Collect'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <Card style={styles.infoCard}>
            <CardContent>
              <Text style={styles.infoCardTitle}>Accepted Payment Methods</Text>
              <Text style={styles.infoCardText}>
                Visa, Mastercard, American Express, Apple Pay, Google Pay
              </Text>
              <Text style={styles.infoCardFees}>
                2.9% + $0.30 per transaction Deposits within 2 business days
              </Text>
            </CardContent>
          </Card>

          {!tapToPaySupported && (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Tap to Pay Requires Native Build</Text>
              <Text style={styles.warningText}>
                Tap to Pay uses your phone's NFC chip and requires building the app with EAS Build. 
                QR codes and payment links work in Expo Go.
              </Text>
            </View>
          )}
        </ScrollView>

        {renderTapToPayModal()}
        {renderReceiptModal()}
        {renderQRModal()}
        {renderPaymentLinkModal()}
      </View>
    </>
  );

  function renderReceiptModal() {
    return (
      <Modal
        visible={showReceiptModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseReceiptModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Send Receipt</Text>
            <TouchableOpacity onPress={handleCloseReceiptModal} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.successIcon}>
              <Feather name="check-circle" size={48} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Payment Complete!</Text>
            <Text style={styles.successAmount}>
              ${(lastPaymentAmount / 100).toFixed(2)} received
            </Text>
            
            {selectedInvoice && (
              <Text style={[styles.modalStepSubtitle, { marginTop: spacing.sm }]}>
                {selectedInvoice.invoiceNumber} • {selectedInvoice.clientName}
              </Text>
            )}

            <View style={{ marginTop: spacing.xl, width: '100%', gap: spacing.md }}>
              <View>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodCard,
                    sendingReceipt && styles.paymentMethodCardDisabled
                  ]}
                  onPress={sendReceiptEmail}
                  disabled={sendingReceipt}
                  activeOpacity={0.7}
                >
                  <View style={[styles.paymentMethodIcon, { backgroundColor: colors.infoLight }]}>
                    <Feather name="mail" size={24} color={colors.info} />
                  </View>
                  <View style={styles.paymentMethodContent}>
                    <Text style={styles.paymentMethodTitle}>Email Receipt</Text>
                    <Text style={styles.paymentMethodDescription}>
                      {manualEmail || selectedInvoice?.clientEmail || 'Enter email below'}
                    </Text>
                  </View>
                  {sendingReceipt ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="send" size={20} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
                {!selectedInvoice?.clientEmail && (
                  <TextInput
                    style={styles.receiptInput}
                    placeholder="Enter email address"
                    placeholderTextColor={colors.mutedForeground}
                    value={manualEmail}
                    onChangeText={setManualEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              </View>

              <View>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodCard,
                    sendingReceipt && styles.paymentMethodCardDisabled
                  ]}
                  onPress={sendReceiptSMS}
                  disabled={sendingReceipt}
                  activeOpacity={0.7}
                >
                  <View style={[styles.paymentMethodIcon, { backgroundColor: colors.successLight }]}>
                    <Feather name="message-circle" size={24} color={colors.success} />
                  </View>
                  <View style={styles.paymentMethodContent}>
                    <Text style={styles.paymentMethodTitle}>SMS Receipt</Text>
                    <Text style={styles.paymentMethodDescription}>
                      {manualPhone || selectedInvoice?.clientPhone || 'Enter phone below'}
                    </Text>
                  </View>
                  {sendingReceipt ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="send" size={20} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
                {!selectedInvoice?.clientPhone && (
                  <TextInput
                    style={styles.receiptInput}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.mutedForeground}
                    value={manualPhone}
                    onChangeText={setManualPhone}
                    keyboardType="phone-pad"
                  />
                )}
              </View>
            </View>
          </View>

          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={handleCloseReceiptModal} fullWidth>
              Skip - No Receipt Needed
            </Button>
          </View>
        </View>
      </Modal>
    );
  }
}

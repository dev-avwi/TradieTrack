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
import { format, isThisWeek, parseISO } from 'date-fns';
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
  recentPaymentsSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  recentPaymentItem: {
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
  recentPaymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  recentPaymentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentPaymentContent: {
    flex: 1,
  },
  recentPaymentClient: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  recentPaymentMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  recentPaymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
  },
  compactQuickLinksRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  compactQuickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  compactQuickLinkText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
  },
  invoicePickerScrollView: {
    flex: 1,
  },
  invoicePickerContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  invoicePickerItem: {
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
  invoicePickerItemContent: {
    flex: 1,
  },
  invoicePickerItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  invoicePickerItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  invoicePickerItemClient: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  invoicePickerItemAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  customAmountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  customAmountButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  invoicePickerEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  invoicePickerEmptyText: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginTop: spacing.md,
    textAlign: 'center',
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
  iconBackground,
  valueColor,
  colors
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  iconBackground?: string;
  valueColor?: string;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, iconBackground ? { backgroundColor: iconBackground } : undefined]}>
        {icon}
      </View>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
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
  
  // Record Payment Modal state
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [recordPaymentMethod, setRecordPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordDescription, setRecordDescription] = useState('');
  const [recordClientId, setRecordClientId] = useState<string | null>(null);
  const [recordInvoiceId, setRecordInvoiceId] = useState<string | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [recordPaymentSuccess, setRecordPaymentSuccess] = useState<{ receiptNumber: string; receiptId: string } | null>(null);
  
  // Payment Link Modal state
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [paymentLinkRequest, setPaymentLinkRequest] = useState<any>(null);
  const [linkRecipientEmail, setLinkRecipientEmail] = useState('');
  const [linkRecipientPhone, setLinkRecipientPhone] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  
  // Ongoing Payments state (includes pending payment requests + recent receipts)
  const [recentReceipts, setRecentReceipts] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  
  // Invoice Picker Modal state
  const [showInvoicePickerModal, setShowInvoicePickerModal] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'record' | 'qr' | 'link' | null>(null);
  
  const { invoices, fetchInvoices } = useInvoicesStore();
  const { clients, fetchClients } = useClientsStore();
  const terminal = useStripeTerminal();
  const tapToPaySupported = isTapToPayAvailable();

  const fetchReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const [receiptsResponse, requestsResponse] = await Promise.all([
        api.get<any[]>('/api/receipts?limit=10'),
        api.get<any[]>('/api/payment-requests')
      ]);
      if (receiptsResponse.data) {
        setRecentReceipts(receiptsResponse.data);
      }
      if (requestsResponse.data) {
        setPaymentRequests(requestsResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch payments data:', error);
    } finally {
      setReceiptsLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchInvoices(), fetchClients(), fetchReceipts()]);
    setIsLoading(false);
  }, [fetchInvoices, fetchClients, fetchReceipts]);

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
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalPending = pendingInvoices.reduce((sum, i) => {
    const total = typeof i.total === 'string' ? parseFloat(i.total) : (i.total || 0);
    const paid = typeof i.amountPaid === 'string' ? parseFloat(i.amountPaid) : (i.amountPaid || 0);
    return sum + (total - paid);
  }, 0);
  const overdueAmount = overdueInvoices.reduce((sum, i) => {
    const total = typeof i.total === 'string' ? parseFloat(i.total) : (i.total || 0);
    const paid = typeof i.amountPaid === 'string' ? parseFloat(i.amountPaid) : (i.amountPaid || 0);
    return sum + (total - paid);
  }, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;
  const pendingInvoiceCount = pendingInvoices.length;
  
  // Calculate collected this week from recent receipts
  const collectedThisWeek = useMemo(() => {
    return recentReceipts
      .filter(r => {
        try {
          const receiptDate = r.createdAt ? parseISO(r.createdAt) : null;
          return receiptDate && isThisWeek(receiptDate, { weekStartsOn: 1 });
        } catch {
          return false;
        }
      })
      .reduce((sum, r) => {
        const amount = typeof r.amount === 'string' ? parseFloat(r.amount) : (r.amount || 0);
        return sum + amount;
      }, 0);
  }, [recentReceipts]);

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
      eftpos: 'EFTPOS',
      cheque: 'Cheque',
      other: 'Other',
    };
    return labels[method] || method;
  };

  const getPaymentMethodIcon = (method: string): string => {
    const icons: Record<string, string> = {
      cash: 'dollar-sign',
      card: 'credit-card',
      bank_transfer: 'home',
      eftpos: 'credit-card',
      cheque: 'file-text',
      other: 'circle',
    };
    return icons[method] || 'circle';
  };

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

  const handleQRCode = () => {
    handleShowInvoicePicker('qr');
  };

  const handleQRCodeDirect = async () => {
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

  const handlePaymentLink = () => {
    handleShowInvoicePicker('link');
  };

  const handlePaymentLinkDirect = async () => {
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

  // Record Payment handlers
  const handleOpenRecordPayment = () => {
    handleShowInvoicePicker('record');
  };

  const handleOpenRecordPaymentDirect = () => {
    // Pre-fill from selected invoice if available
    if (selectedInvoice) {
      setRecordAmount(selectedInvoice.amountDue.toFixed(2));
      setRecordDescription(`Payment for ${selectedInvoice.invoiceNumber}`);
      setRecordClientId(selectedInvoice.clientId);
      setRecordInvoiceId(selectedInvoice.id);
    } else if (amount) {
      setRecordAmount(amount);
      setRecordDescription(description);
    }
    setShowRecordPaymentModal(true);
  };

  const handleCloseRecordPaymentModal = () => {
    setShowRecordPaymentModal(false);
    setRecordPaymentSuccess(null);
    setRecordAmount('');
    setRecordDescription('');
    setRecordClientId(null);
    setRecordInvoiceId(null);
    setRecordPaymentMethod('cash');
    setRecordingPayment(false);
  };

  const handleSubmitRecordPayment = async () => {
    const amountNum = parseFloat(recordAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    setRecordingPayment(true);
    try {
      const gstAmount = amountNum / 11; // Calculate GST (10% of GST-inclusive amount)
      const subtotal = amountNum - gstAmount;
      
      const response = await api.post<{
        id: string;
        receiptNumber: string;
        amount: string;
      }>('/api/receipts', {
        amount: amountNum.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        subtotal: subtotal.toFixed(2),
        paymentMethod: recordPaymentMethod,
        notes: recordDescription || undefined,
        description: recordDescription || undefined,
        clientId: recordClientId || undefined,
        invoiceId: recordInvoiceId || undefined,
      });

      if (response.data) {
        setRecordPaymentSuccess({
          receiptNumber: response.data.receiptNumber,
          receiptId: response.data.id,
        });
        
        // Refresh invoices if we linked to one
        if (recordInvoiceId) {
          fetchInvoices();
        }
      }
    } catch (error) {
      console.error('Failed to record payment:', error);
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleSendRecordedReceipt = async (method: 'email' | 'sms') => {
    if (!recordPaymentSuccess) return;
    
    const client = recordClientId ? clients.find(c => c.id === recordClientId) : null;
    
    if (method === 'email') {
      const email = client?.email;
      if (!email) {
        Alert.alert('No Email', 'No email address found for this client');
        return;
      }
      
      try {
        await api.post(`/api/receipts/${recordPaymentSuccess.receiptId}/send-email`, { email });
        Alert.alert('Success', `Receipt sent to ${email}`);
      } catch (error) {
        Alert.alert('Error', 'Failed to send receipt email');
      }
    } else {
      const phone = client?.phone;
      if (!phone) {
        Alert.alert('No Phone', 'No phone number found for this client');
        return;
      }
      
      try {
        await api.post(`/api/receipts/${recordPaymentSuccess.receiptId}/send-sms`, { phone });
        Alert.alert('Success', `Receipt sent to ${phone}`);
      } catch (error) {
        Alert.alert('Error', 'Failed to send receipt SMS');
      }
    }
  };

  // Get unpaid invoices, optionally filtered by client
  const getFilteredInvoices = () => {
    let filtered = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    if (recordClientId) {
      filtered = filtered.filter(i => i.clientId === recordClientId);
    }
    return filtered;
  };

  // Invoice Picker handlers
  const handleShowInvoicePicker = (method: 'record' | 'qr' | 'link') => {
    // If amount is already entered or invoice selected, skip the picker
    if (amount && parseFloat(amount) > 0) {
      proceedToPaymentMethod(method);
      return;
    }
    
    // If no pending invoices, skip the picker
    if (pendingInvoices.length === 0) {
      proceedToPaymentMethod(method);
      return;
    }
    
    // Show the invoice picker modal
    setPendingPaymentMethod(method);
    setShowInvoicePickerModal(true);
  };

  const handleSelectInvoiceFromPicker = (invoice: any) => {
    const client = getClient(invoice.clientId);
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
    
    setAmount(amountDue.toFixed(2));
    setDescription(`Payment for ${invoice.invoiceNumber}`);
    
    setShowInvoicePickerModal(false);
    
    // Proceed to the selected payment method
    if (pendingPaymentMethod) {
      proceedToPaymentMethod(pendingPaymentMethod);
    }
    setPendingPaymentMethod(null);
  };

  const handleCustomAmountFromPicker = () => {
    setShowInvoicePickerModal(false);
    
    // Proceed without an invoice
    if (pendingPaymentMethod) {
      proceedToPaymentMethod(pendingPaymentMethod);
    }
    setPendingPaymentMethod(null);
  };

  const proceedToPaymentMethod = (method: 'record' | 'qr' | 'link') => {
    switch (method) {
      case 'record':
        handleOpenRecordPaymentDirect();
        break;
      case 'qr':
        handleQRCodeDirect();
        break;
      case 'link':
        handlePaymentLinkDirect();
        break;
    }
  };

  const handleCloseInvoicePickerModal = () => {
    setShowInvoicePickerModal(false);
    setPendingPaymentMethod(null);
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

  const renderRecordPaymentModal = () => {
    const paymentMethods: Array<{ id: 'cash' | 'card' | 'bank_transfer'; label: string; icon: string }> = [
      { id: 'cash', label: 'Cash', icon: 'dollar-sign' },
      { id: 'card', label: 'Card/EFTPOS', icon: 'credit-card' },
      { id: 'bank_transfer', label: 'Bank Transfer', icon: 'home' },
    ];

    const filteredInvoices = getFilteredInvoices();

    return (
      <Modal
        visible={showRecordPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseRecordPaymentModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {recordPaymentSuccess ? 'Payment Recorded' : 'Record Payment'}
            </Text>
            <TouchableOpacity onPress={handleCloseRecordPaymentModal} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {recordPaymentSuccess ? (
            <View style={styles.modalContent}>
              <View style={styles.successIcon}>
                <Feather name="check-circle" size={48} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Receipt Created!</Text>
              <Text style={styles.successAmount}>{recordPaymentSuccess.receiptNumber}</Text>
              <Text style={[styles.modalStepSubtitle, { marginTop: spacing.sm }]}>
                ${parseFloat(recordAmount).toFixed(2)} recorded as {recordPaymentMethod === 'bank_transfer' ? 'bank transfer' : recordPaymentMethod}
              </Text>
              
              {recordClientId && (
                <View style={{ marginTop: spacing.xl, width: '100%', gap: spacing.md }}>
                  <Text style={styles.sectionLabel}>Send Receipt</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <Button 
                      variant="outline" 
                      onPress={() => handleSendRecordedReceipt('email')}
                      style={{ flex: 1 }}
                    >
                      <Feather name="mail" size={18} color={colors.foreground} />
                      <Text style={{ marginLeft: spacing.xs }}>Email</Text>
                    </Button>
                    <Button 
                      variant="outline" 
                      onPress={() => handleSendRecordedReceipt('sms')}
                      style={{ flex: 1 }}
                    >
                      <Feather name="message-circle" size={18} color={colors.foreground} />
                      <Text style={{ marginLeft: spacing.xs }}>SMS</Text>
                    </Button>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
              <View style={{ gap: spacing.lg }}>
                <View>
                  <Text style={styles.paymentLinkLabel}>Amount *</Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                      value={recordAmount}
                      onChangeText={setRecordAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.paymentLinkLabel}>Payment Method</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        onPress={() => setRecordPaymentMethod(method.id)}
                        style={{
                          flex: 1,
                          paddingVertical: spacing.md,
                          paddingHorizontal: spacing.sm,
                          borderRadius: radius.lg,
                          borderWidth: 2,
                          borderColor: recordPaymentMethod === method.id ? colors.primary : colors.border,
                          backgroundColor: recordPaymentMethod === method.id ? colors.primaryLight : colors.card,
                          alignItems: 'center',
                          gap: spacing.xs,
                        }}
                        activeOpacity={0.7}
                      >
                        <Feather 
                          name={method.icon as any} 
                          size={20} 
                          color={recordPaymentMethod === method.id ? colors.primary : colors.mutedForeground} 
                        />
                        <Text style={{ 
                          fontSize: 12, 
                          fontWeight: '500',
                          color: recordPaymentMethod === method.id ? colors.primary : colors.foreground,
                        }}>
                          {method.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={styles.paymentLinkLabel}>Description (optional)</Text>
                  <TextInput
                    style={[styles.descriptionInput, { marginTop: 0 }]}
                    placeholder="e.g., Cash payment for kitchen renovation"
                    placeholderTextColor={colors.mutedForeground}
                    value={recordDescription}
                    onChangeText={setRecordDescription}
                  />
                </View>

                <View>
                  <Text style={styles.paymentLinkLabel}>Link to Client (optional)</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: spacing.sm }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setRecordClientId(null);
                        setRecordInvoiceId(null);
                      }}
                      style={{
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: !recordClientId ? colors.primary : colors.border,
                        backgroundColor: !recordClientId ? colors.primaryLight : colors.card,
                        marginRight: spacing.sm,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ 
                        fontSize: 13, 
                        color: !recordClientId ? colors.primary : colors.foreground,
                      }}>
                        No Client
                      </Text>
                    </TouchableOpacity>
                    {clients.slice(0, 10).map((client) => (
                      <TouchableOpacity
                        key={client.id}
                        onPress={() => {
                          setRecordClientId(client.id);
                          setRecordInvoiceId(null); // Reset invoice when client changes
                        }}
                        style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: recordClientId === client.id ? colors.primary : colors.border,
                          backgroundColor: recordClientId === client.id ? colors.primaryLight : colors.card,
                          marginRight: spacing.sm,
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ 
                          fontSize: 13, 
                          color: recordClientId === client.id ? colors.primary : colors.foreground,
                        }}>
                          {client.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {recordClientId && filteredInvoices.length > 0 && (
                  <View>
                    <Text style={styles.paymentLinkLabel}>Link to Invoice (optional)</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: spacing.sm }}
                    >
                      <TouchableOpacity
                        onPress={() => setRecordInvoiceId(null)}
                        style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: !recordInvoiceId ? colors.primary : colors.border,
                          backgroundColor: !recordInvoiceId ? colors.primaryLight : colors.card,
                          marginRight: spacing.sm,
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ 
                          fontSize: 13, 
                          color: !recordInvoiceId ? colors.primary : colors.foreground,
                        }}>
                          No Invoice
                        </Text>
                      </TouchableOpacity>
                      {filteredInvoices.map((invoice) => {
                        const amountDue = (typeof invoice.total === 'string' ? parseFloat(invoice.total) : invoice.total || 0) - 
                                         (typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : invoice.amountPaid || 0);
                        return (
                          <TouchableOpacity
                            key={invoice.id}
                            onPress={() => {
                              setRecordInvoiceId(invoice.id);
                              setRecordAmount(amountDue.toFixed(2));
                              setRecordDescription(`Payment for ${invoice.invoiceNumber}`);
                            }}
                            style={{
                              paddingVertical: spacing.sm,
                              paddingHorizontal: spacing.md,
                              borderRadius: radius.lg,
                              borderWidth: 1,
                              borderColor: recordInvoiceId === invoice.id ? colors.primary : colors.border,
                              backgroundColor: recordInvoiceId === invoice.id ? colors.primaryLight : colors.card,
                              marginRight: spacing.sm,
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ 
                              fontSize: 13, 
                              fontWeight: '500',
                              color: recordInvoiceId === invoice.id ? colors.primary : colors.foreground,
                            }}>
                              {invoice.invoiceNumber}
                            </Text>
                            <Text style={{ 
                              fontSize: 11, 
                              color: colors.mutedForeground,
                            }}>
                              ${amountDue.toFixed(2)} due
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <View style={{
                  backgroundColor: colors.successLight,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}>
                  <Feather name="check-circle" size={20} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 13, flex: 1 }}>
                    No processing fees - great for cash & EFTPOS payments
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          {!recordPaymentSuccess && (
            <View style={styles.modalFooter}>
              <Button 
                variant="default" 
                onPress={handleSubmitRecordPayment} 
                fullWidth
                disabled={recordingPayment || !recordAmount || parseFloat(recordAmount) <= 0}
              >
                {recordingPayment ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="file-text" size={18} color={colors.primaryForeground} />
                    <Text style={{ marginLeft: spacing.xs, color: colors.primaryForeground, fontWeight: '600' }}>
                      Create Receipt
                    </Text>
                  </>
                )}
              </Button>
            </View>
          )}

          {recordPaymentSuccess && (
            <View style={styles.modalFooter}>
              <Button variant="outline" onPress={handleCloseRecordPaymentModal} fullWidth>
                Done
              </Button>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  const renderInvoicePickerModal = () => (
    <Modal
      visible={showInvoicePickerModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseInvoicePickerModal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Invoice</Text>
          <TouchableOpacity onPress={handleCloseInvoicePickerModal} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.invoicePickerScrollView}
          contentContainerStyle={styles.invoicePickerContent}
          showsVerticalScrollIndicator={false}
        >
          {pendingInvoices.length === 0 ? (
            <View style={styles.invoicePickerEmpty}>
              <Feather name="check-circle" size={48} color={colors.success} />
              <Text style={styles.invoicePickerEmptyText}>
                No pending invoices.{'\n'}Enter a custom amount below.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionLabel, { marginBottom: spacing.md }]}>
                {pendingInvoices.length} Pending Invoice{pendingInvoices.length !== 1 ? 's' : ''}
              </Text>
              {pendingInvoices.map(invoice => {
                const invoiceTotal = typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total || 0);
                const invoicePaid = typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : (invoice.amountPaid || 0);
                const amountDue = invoiceTotal - invoicePaid;
                const isOverdue = invoice.status === 'overdue';
                
                return (
                  <TouchableOpacity 
                    key={invoice.id}
                    style={styles.invoicePickerItem}
                    onPress={() => handleSelectInvoiceFromPicker(invoice)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.invoicePickerItemContent}>
                      <View style={styles.invoicePickerItemHeader}>
                        <Text style={styles.invoicePickerItemTitle}>{invoice.invoiceNumber}</Text>
                        {isOverdue && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                      </View>
                      <Text style={styles.invoicePickerItemClient}>{getClientName(invoice.clientId)}</Text>
                    </View>
                    <Text style={styles.invoicePickerItemAmount}>{formatCurrency(amountDue)}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <TouchableOpacity 
            style={styles.customAmountButton}
            onPress={handleCustomAmountFromPicker}
            activeOpacity={0.7}
          >
            <Feather name="edit-3" size={20} color={colors.foreground} />
            <Text style={styles.customAmountButtonText}>Custom Amount (No Invoice)</Text>
          </TouchableOpacity>
        </ScrollView>
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

          {/* Compact Quick Links */}
          <View style={styles.compactQuickLinksRow}>
            <TouchableOpacity 
              style={styles.compactQuickLink} 
              activeOpacity={0.7}
              onPress={() => router.push('/more/invoices')}
            >
              <Feather name="file-text" size={14} color={colors.foreground} />
              <Text style={styles.compactQuickLinkText}>Invoices</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.compactQuickLink} 
              activeOpacity={0.7}
              onPress={() => router.push('/more/payments')}
            >
              <Feather name="clock" size={14} color={colors.foreground} />
              <Text style={styles.compactQuickLinkText}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.compactQuickLink} 
              activeOpacity={0.7}
              onPress={() => router.push('/more/receipts')}
            >
              <Feather name="receipt" size={14} color={colors.foreground} />
              <Text style={styles.compactQuickLinkText}>Receipts</Text>
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

          <PaymentMethodCard
            icon={<Feather name="dollar-sign" size={24} color={colors.success} />}
            title="Record Payment"
            description="Cash, EFTPOS, or bank transfer already received"
            badge="No Fees"
            badgeVariant="success"
            onPress={handleOpenRecordPayment}
            colors={colors}
          />

          {/* Apple Requirement 5.5: Use SF Symbol wave.3.right.circle for Tap to Pay
              In native builds, replace Feather 'radio' with actual SF Symbol via react-native-sfsymbols
              The 'radio' icon from Feather resembles the wave pattern as a fallback */}
          <PaymentMethodCard
            icon={<Feather name="radio" size={24} color={colors.mutedForeground} />}
            title="Tap to Pay"
            description="Contactless payments - Coming Soon"
            badge="Coming Soon"
            badgeVariant="warning"
            onPress={() => {}}
            disabled={true}
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

          {/* Ongoing Payments Section - Shows pending requests + completed payments */}
          <View style={styles.recentPaymentsSection}>
            <View style={styles.pendingSectionHeader}>
              <Feather name="clock" size={18} color={colors.primary} />
              <Text style={styles.pendingSectionTitle}>Ongoing Payments</Text>
            </View>
            
            {receiptsLoading ? (
              <View style={styles.emptyPending}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.emptyPendingText}>Loading...</Text>
              </View>
            ) : paymentRequests.length === 0 && recentReceipts.length === 0 ? (
              <View style={styles.emptyPending}>
                <Feather name="inbox" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyPendingText}>No ongoing payments</Text>
              </View>
            ) : (
              <>
                {/* Pending Payment Requests (QR codes & Payment Links) */}
                {paymentRequests
                  .filter(req => req.status === 'pending')
                  .slice(0, 5)
                  .map((request, index) => {
                    const requestAmount = typeof request.amount === 'string' ? parseFloat(request.amount) : (request.amount || 0);
                    const requestDate = request.createdAt ? format(parseISO(request.createdAt), 'MMM d') : '';
                    const client = request.clientId ? clients.find(c => c.id === request.clientId) : null;
                    const clientName = client?.name || 'Customer';
                    const isQR = !!request.qrCodeUrl;
                    
                    return (
                      <View
                        key={`req-${request.id || index}`}
                        style={styles.recentPaymentItem}
                      >
                        <View style={styles.recentPaymentLeft}>
                          <View style={[styles.recentPaymentIconContainer, { backgroundColor: colors.warningLight }]}>
                            <Feather 
                              name={isQR ? 'grid' : 'link'} 
                              size={18} 
                              color={colors.warning} 
                            />
                          </View>
                          <View style={styles.recentPaymentContent}>
                            <Text style={styles.recentPaymentClient}>{clientName}</Text>
                            <Text style={styles.recentPaymentMeta}>
                              {isQR ? 'QR Code' : 'Payment Link'} • {requestDate}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.recentPaymentAmount, { color: colors.foreground }]}>
                            {formatCurrency(requestAmount)}
                          </Text>
                          <Badge variant="warning" style={{ marginTop: 4 }}>In Progress</Badge>
                        </View>
                      </View>
                    );
                  })}
                
                {/* Completed Payments (Receipts) */}
                {recentReceipts.slice(0, 5).map((receipt, index) => {
                  const receiptAmount = typeof receipt.amount === 'string' ? parseFloat(receipt.amount) : (receipt.amount || 0);
                  const receiptDate = receipt.createdAt ? format(parseISO(receipt.createdAt), 'MMM d') : '';
                  const client = receipt.clientId ? clients.find(c => c.id === receipt.clientId) : null;
                  const clientName = client?.name || 'Walk-in Customer';
                  const paymentMethod = getPaymentMethodLabel(receipt.paymentMethod || 'other');
                  
                  return (
                    <TouchableOpacity
                      key={`rcpt-${receipt.id || index}`}
                      style={styles.recentPaymentItem}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/more/receipt/${receipt.id}`)}
                    >
                      <View style={styles.recentPaymentLeft}>
                        <View style={[styles.recentPaymentIconContainer, { backgroundColor: colors.successLight }]}>
                          <Feather 
                            name={getPaymentMethodIcon(receipt.paymentMethod || 'other') as any} 
                            size={18} 
                            color={colors.success} 
                          />
                        </View>
                        <View style={styles.recentPaymentContent}>
                          <Text style={styles.recentPaymentClient}>{clientName}</Text>
                          <Text style={styles.recentPaymentMeta}>
                            {paymentMethod} • {receiptDate}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.recentPaymentAmount}>
                          +{formatCurrency(receiptAmount)}
                        </Text>
                        <Badge variant="success" style={{ marginTop: 4 }}>Paid</Badge>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                
                {/* Expired/Cancelled Payment Requests */}
                {paymentRequests
                  .filter(req => req.status === 'expired' || req.status === 'cancelled')
                  .slice(0, 3)
                  .map((request, index) => {
                    const requestAmount = typeof request.amount === 'string' ? parseFloat(request.amount) : (request.amount || 0);
                    const requestDate = request.createdAt ? format(parseISO(request.createdAt), 'MMM d') : '';
                    const client = request.clientId ? clients.find(c => c.id === request.clientId) : null;
                    const clientName = client?.name || 'Customer';
                    const isQR = !!request.qrCodeUrl;
                    
                    return (
                      <View
                        key={`exp-${request.id || index}`}
                        style={[styles.recentPaymentItem, { opacity: 0.6 }]}
                      >
                        <View style={styles.recentPaymentLeft}>
                          <View style={[styles.recentPaymentIconContainer, { backgroundColor: colors.mutedForeground + '20' }]}>
                            <Feather 
                              name={isQR ? 'grid' : 'link'} 
                              size={18} 
                              color={colors.mutedForeground} 
                            />
                          </View>
                          <View style={styles.recentPaymentContent}>
                            <Text style={[styles.recentPaymentClient, { color: colors.mutedForeground }]}>{clientName}</Text>
                            <Text style={styles.recentPaymentMeta}>
                              {isQR ? 'QR Code' : 'Payment Link'} • {requestDate}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.recentPaymentAmount, { color: colors.mutedForeground }]}>
                            {formatCurrency(requestAmount)}
                          </Text>
                          <Badge variant="secondary" style={{ marginTop: 4 }}>
                            {request.status === 'expired' ? 'Expired' : 'Cancelled'}
                          </Badge>
                        </View>
                      </View>
                    );
                  })}
              </>
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

        </ScrollView>

        {renderTapToPayModal()}
        {renderReceiptModal()}
        {renderQRModal()}
        {renderPaymentLinkModal()}
        {renderRecordPaymentModal()}
        {renderInvoicePickerModal()}
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

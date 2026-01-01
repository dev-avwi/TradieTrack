import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import { api, API_URL } from '../../src/lib/api';
import { format, formatDistanceToNow } from 'date-fns';

interface StripeConnectStatus {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}
// QR code display - using fallback visual since react-native-qrcode-svg has peer dependency conflicts
// The customer can still use the link/send options which work perfectly

interface PaymentRequest {
  id: string;
  amount: string;
  gstAmount: string;
  description: string;
  reference: string | null;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  token: string;
  expiresAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
  paymentUrl?: string;
  clientId?: string | null;
  invoiceId?: string | null;
  jobId?: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  total: string | number;
  status: string;
  clientId: string;
  jobId?: string | null;
}

interface QRCodeResponse {
  qrCode: string;
}

interface Job {
  id: string;
  title: string;
  address?: string | null;
  clientId?: string | null;
  status: string;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  amount: string;
  paymentMethod: string;
  paymentReference?: string | null;
  paidAt: string | null;
  clientId?: string | null;
  invoiceId?: string | null;
  jobId?: string | null;
  createdAt: string;
}

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export default function CollectPaymentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [shareTab, setShareTab] = useState<'qr' | 'link' | 'send'>('qr');
  
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newReference, setNewReference] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [expiresInHours, setExpiresInHours] = useState('24');
  
  const [recordAmount, setRecordAmount] = useState('');
  const [recordInvoiceId, setRecordInvoiceId] = useState('');
  const [recordPaymentMethod, setRecordPaymentMethod] = useState('cash');
  const [recordReference, setRecordReference] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState('cash');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptClientId, setReceiptClientId] = useState<string>('');
  const [receiptInvoiceId, setReceiptInvoiceId] = useState<string>('');
  const [receiptJobId, setReceiptJobId] = useState<string>('');
  
  const [sharePhone, setSharePhone] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // QR Code state
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [showInvoicePicker, setShowInvoicePicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [pickerContext, setPickerContext] = useState<'create' | 'record' | 'receipt'>('create');
  
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);

  const unpaidInvoices = useMemo(() => 
    invoices.filter(inv => inv.status !== 'paid'), [invoices]);
  const activeJobs = useMemo(() => 
    jobs.filter(job => job.status !== 'invoiced'), [jobs]);
  const pendingRequests = useMemo(() => 
    paymentRequests.filter(r => r.status === 'pending'), [paymentRequests]);
  const completedRequests = useMemo(() => 
    paymentRequests.filter(r => r.status !== 'pending'), [paymentRequests]);

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const invoiceMap = useMemo(() => new Map(invoices.map(i => [i.id, i])), [invoices]);
  const jobMap = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);

  const fetchData = useCallback(async () => {
    try {
      const [requestsRes, clientsRes, invoicesRes, jobsRes, receiptsRes, stripeRes] = await Promise.all([
        api.get<PaymentRequest[]>('/api/payment-requests').catch(() => ({ data: [] as PaymentRequest[] })),
        api.get<Client[]>('/api/clients').catch(() => ({ data: [] as Client[] })),
        api.get<Invoice[]>('/api/invoices').catch(() => ({ data: [] as Invoice[] })),
        api.get<Job[]>('/api/jobs').catch(() => ({ data: [] as Job[] })),
        api.get<Receipt[]>('/api/receipts').catch(() => ({ data: [] as Receipt[] })),
        api.get<StripeConnectStatus>('/api/stripe/connect/status').catch(() => ({ data: { connected: false } as StripeConnectStatus })),
      ]);
      
      if (requestsRes.data) setPaymentRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
      if (clientsRes.data) setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      if (invoicesRes.data) setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      if (jobsRes.data) setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
      if (receiptsRes.data) setReceipts(Array.isArray(receiptsRes.data) ? receiptsRes.data : []);
      if (stripeRes.data) setStripeStatus(stripeRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (invoice) {
        const total = typeof invoice.total === 'number' ? invoice.total.toFixed(2) : String(invoice.total || '0.00');
        setNewAmount(total);
        setNewDescription(`Payment for ${invoice.number}: ${invoice.title}`);
        setSelectedClientId(invoice.clientId);
        if (invoice.jobId) setSelectedJobId(invoice.jobId);
      }
    }
  }, [selectedInvoiceId, invoices]);

  useEffect(() => {
    if (recordInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.id === recordInvoiceId);
      if (invoice) {
        const total = typeof invoice.total === 'number' ? invoice.total.toFixed(2) : String(invoice.total || '0.00');
        setRecordAmount(total);
      }
    }
  }, [recordInvoiceId, invoices]);

  useEffect(() => {
    if (receiptInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.id === receiptInvoiceId);
      if (invoice) {
        const total = typeof invoice.total === 'number' ? invoice.total.toFixed(2) : String(invoice.total || '0.00');
        setReceiptAmount(total);
        setReceiptDescription(`Payment for ${invoice.number}: ${invoice.title}`);
        setReceiptClientId(invoice.clientId);
        if (invoice.jobId) setReceiptJobId(invoice.jobId);
      }
    }
  }, [receiptInvoiceId, invoices]);

  // Fetch QR code when share modal opens
  useEffect(() => {
    const fetchQrCode = async () => {
      if (showShareModal && selectedRequest) {
        setQrLoading(true);
        setQrCodeDataUrl(null);
        try {
          const response = await api.get<QRCodeResponse>(`/api/payment-requests/${selectedRequest.id}/qrcode`);
          if (response.data?.qrCode) {
            setQrCodeDataUrl(response.data.qrCode);
          }
        } catch (error) {
          console.error('Failed to fetch QR code:', error);
        } finally {
          setQrLoading(false);
        }
      }
    };
    fetchQrCode();
  }, [showShareModal, selectedRequest]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const resetCreateForm = () => {
    setNewAmount('');
    setNewDescription('');
    setNewReference('');
    setSelectedClientId('');
    setSelectedInvoiceId('');
    setSelectedJobId('');
    setExpiresInHours('24');
  };

  const resetRecordForm = () => {
    setRecordAmount('');
    setRecordInvoiceId('');
    setRecordPaymentMethod('cash');
    setRecordReference('');
    setRecordNotes('');
  };

  const resetReceiptForm = () => {
    setReceiptAmount('');
    setReceiptDescription('');
    setReceiptPaymentMethod('cash');
    setReceiptReference('');
    setReceiptClientId('');
    setReceiptInvoiceId('');
    setReceiptJobId('');
  };

  const handleCreateRequest = async () => {
    if (!newAmount || parseFloat(newAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!newDescription.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<PaymentRequest>('/api/payment-requests', {
        amount: parseFloat(newAmount),
        description: newDescription.trim(),
        reference: newReference.trim() || undefined,
        clientId: selectedClientId || undefined,
        invoiceId: selectedInvoiceId || undefined,
        jobId: selectedJobId || undefined,
        expiresInHours: parseInt(expiresInHours),
      });

      if (response.data) {
        setShowCreateModal(false);
        resetCreateForm();
        setSelectedRequest(response.data as PaymentRequest);
        setShowShareModal(true);
        fetchData();
        Alert.alert('Success', 'Payment request created');
      } else if (response.error) {
        Alert.alert('Error', response.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create payment request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!recordInvoiceId) {
      Alert.alert('Error', 'Please select an invoice');
      return;
    }
    if (!recordAmount || parseFloat(recordAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post(`/api/invoices/${recordInvoiceId}/record-payment`, {
        amount: recordAmount,
        paymentMethod: recordPaymentMethod,
        reference: recordReference || undefined,
        notes: recordNotes || undefined,
      });

      if (response.data || !response.error) {
        setShowRecordPaymentModal(false);
        resetRecordForm();
        fetchData();
        Alert.alert('Success', 'Payment recorded successfully');
      } else if (response.error) {
        Alert.alert('Error', response.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateReceipt = async () => {
    if (!receiptAmount || parseFloat(receiptAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<Receipt>('/api/receipts', {
        amount: parseFloat(receiptAmount),
        description: receiptDescription.trim() || 'Payment received',
        paymentMethod: receiptPaymentMethod,
        paymentReference: receiptReference || undefined,
        clientId: receiptClientId || undefined,
        invoiceId: receiptInvoiceId || undefined,
        jobId: receiptJobId || undefined,
      });

      if (response.data) {
        setShowReceiptModal(false);
        resetReceiptForm();
        fetchData();
        const receiptData = response.data as Receipt;
        Alert.alert('Success', `Receipt ${receiptData.receiptNumber} created`);
        router.push(`/more/receipt/${receiptData.id}`);
      } else if (response.error) {
        Alert.alert('Error', response.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this payment request?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/payment-requests/${id}/cancel`);
              fetchData();
              Alert.alert('Success', 'Payment request cancelled');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel request');
            }
          }
        },
      ]
    );
  };

  const getPaymentUrl = (request: PaymentRequest) => {
    return `${API_URL}/pay/${request.token}`;
  };

  const handleCopyLink = async () => {
    if (!selectedRequest) return;
    try {
      await Clipboard.setStringAsync(getPaymentUrl(selectedRequest));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      Alert.alert('Copied', 'Payment link copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  const handleSendSms = async () => {
    if (!selectedRequest || !sharePhone) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/payment-requests/${selectedRequest.id}/send-sms`, { 
        phoneNumber: sharePhone 
      });
      setSharePhone('');
      Alert.alert('Success', 'Payment link sent via SMS');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send SMS');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedRequest || !shareEmail) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/payment-requests/${selectedRequest.id}/send-email`, { 
        email: shareEmail 
      });
      setShareEmail('');
      Alert.alert('Success', 'Payment link sent via email');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComposeEmail = async () => {
    if (!selectedRequest) return;
    const client = selectedRequest.clientId ? clientMap.get(selectedRequest.clientId) : null;
    const paymentUrl = getPaymentUrl(selectedRequest);
    const subject = encodeURIComponent(`Payment Request - ${formatCurrency(selectedRequest.amount)}`);
    const body = encodeURIComponent(
      `Hi${client ? ` ${client.name}` : ''},\n\n` +
      `Please find your payment request for ${formatCurrency(selectedRequest.amount)}.\n\n` +
      `${selectedRequest.description}\n\n` +
      `Pay securely online: ${paymentUrl}\n\n` +
      `Thank you for your business.`
    );
    const email = client?.email || shareEmail || '';
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert('Error', 'No email app available');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open email app');
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: `${colors.warning}20`, text: colors.warning, label: 'Pending' },
      paid: { bg: `${colors.success}20`, text: colors.success, label: 'Paid' },
      cancelled: { bg: `${colors.destructive}20`, text: colors.destructive, label: 'Cancelled' },
      expired: { bg: colors.muted, text: colors.mutedForeground, label: 'Expired' },
    };
    const config = configs[status] || configs.pending;
    return (
      <View style={[styles.badge, { backgroundColor: config.bg }]}>
        <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
      </View>
    );
  };

  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'card', label: 'Card (in person)' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Other' },
  ];

  const expiryOptions = [
    { value: '1', label: '1 hour' },
    { value: '4', label: '4 hours' },
    { value: '24', label: '24 hours' },
    { value: '72', label: '3 days' },
    { value: '168', label: '1 week' },
  ];

  const renderHeader = () => (
    <View style={styles.headerActions}>
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={() => setShowReceiptModal(true)}
        activeOpacity={0.7}
      >
        <Feather name="file-text" size={iconSizes.md} color={colors.primary} />
        <Text style={styles.headerButtonText}>Receipt</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={() => setShowRecordPaymentModal(true)}
        activeOpacity={0.7}
      >
        <Feather name="dollar-sign" size={iconSizes.md} color={colors.primary} />
        <Text style={styles.headerButtonText}>Record</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.headerButton, styles.headerButtonPrimary]}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.7}
      >
        <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
        <Text style={[styles.headerButtonText, { color: colors.primaryForeground }]}>New Request</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContactlessInfo = () => (
    <View style={styles.contactlessCard}>
      <View style={styles.contactlessIcon}>
        <Feather name="wifi" size={iconSizes.xl} color={colors.white} />
      </View>
      <View style={styles.contactlessContent}>
        <View style={styles.contactlessHeader}>
          <Text style={styles.contactlessTitle}>Contactless Payments</Text>
          <View style={[styles.badge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>Works Now</Text>
          </View>
        </View>
        <Text style={styles.contactlessDescription}>
          Customer scans the QR code and pays with Apple Pay, Google Pay, or card.
        </Text>
        <View style={styles.contactlessCards}>
          <Feather name="credit-card" size={iconSizes.sm} color={colors.mutedForeground} />
          <Text style={styles.contactlessCardsText}>Visa, Mastercard, Amex</Text>
        </View>
      </View>
    </View>
  );

  const renderTapToPaySection = () => (
    <View style={styles.tapToPaySection}>
      <Text style={styles.sectionTitle}>Accept Card Payment</Text>
      <TouchableOpacity
        style={styles.applePayButton}
        onPress={() => {
          Alert.alert(
            'Tap to Pay Ready',
            'Tap to Pay on iPhone requires Stripe Terminal setup in production. Contact support to enable.',
            [{ text: 'OK' }]
          );
        }}
        activeOpacity={0.8}
      >
        <View style={styles.applePayButtonContent}>
          <Feather name="smartphone" size={24} color="#FFFFFF" />
          <Text style={styles.applePayButtonText}>Tap to Pay on iPhone</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.tapToPayHint}>Accept contactless cards, Apple Pay, and Google Pay</Text>
    </View>
  );

  const renderStripeWarning = () => {
    if (stripeStatus?.connected) return null;
    
    return (
      <TouchableOpacity 
        style={styles.stripeWarningCard}
        onPress={() => router.push('/more/money-hub')}
        activeOpacity={0.7}
      >
        <View style={styles.stripeWarningIcon}>
          <Feather name="alert-triangle" size={iconSizes.lg} color={colors.warning} />
        </View>
        <View style={styles.stripeWarningContent}>
          <Text style={styles.stripeWarningTitle}>Connect Stripe to Accept Payments</Text>
          <Text style={styles.stripeWarningDescription}>
            Set up Stripe to accept card payments and receive funds directly to your bank account.
          </Text>
        </View>
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderQuickLinks = () => {
    const unpaidCount = invoices.filter(inv => inv.status !== 'paid').length;
    const activeJobsCount = jobs.filter(job => job.status !== 'invoiced').length;
    const clientsCount = clients.length;
    
    const links = [
      { 
        icon: 'file-text' as const, 
        label: 'Invoices', 
        count: unpaidCount > 0 ? `${unpaidCount} unpaid` : null,
        route: '/more/invoices',
        color: colors.primary,
      },
      { 
        icon: 'briefcase' as const, 
        label: 'Jobs', 
        count: activeJobsCount > 0 ? `${activeJobsCount} active` : null,
        route: '/(tabs)/jobs',
        color: colors.info,
      },
      { 
        icon: 'users' as const, 
        label: 'Clients', 
        count: clientsCount > 0 ? `${clientsCount} total` : null,
        route: '/more/clients',
        color: colors.success,
      },
      { 
        icon: 'bar-chart-2' as const, 
        label: 'Reports', 
        count: null,
        route: '/more/reports',
        color: colors.warning,
      },
    ];
    
    return (
      <View style={styles.quickLinksContainer}>
        <Text style={styles.quickLinksTitle}>Quick Links</Text>
        <View style={styles.quickLinksGrid}>
          {links.map((link, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.quickLinkCard}
              onPress={() => router.push(link.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickLinkIconContainer, { backgroundColor: link.color + '20' }]}>
                <Feather name={link.icon} size={iconSizes.lg} color={link.color} />
              </View>
              <Text style={styles.quickLinkLabel}>{link.label}</Text>
              {link.count && (
                <Text style={styles.quickLinkCount}>{link.count}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderRequestCard = (request: PaymentRequest, isPending: boolean) => {
    const clientName = request.clientId ? clientMap.get(request.clientId)?.name : null;
    const invoiceNumber = request.invoiceId ? invoiceMap.get(request.invoiceId)?.number : null;
    const jobTitle = request.jobId ? jobMap.get(request.jobId)?.title : null;

    return (
      <View 
        key={request.id} 
        style={[styles.requestCard, !isPending && styles.requestCardCompleted]}
      >
        <View style={styles.requestCardContent}>
          <View style={styles.requestCardHeader}>
            <Text style={styles.requestAmount}>{formatCurrency(request.amount)}</Text>
            {getStatusBadge(request.status)}
          </View>
          <Text style={styles.requestDescription} numberOfLines={1}>{request.description}</Text>
          
          <View style={styles.requestLinks}>
            {invoiceNumber && (
              <TouchableOpacity 
                style={styles.linkBadge}
                onPress={() => router.push(`/more/invoice/${request.invoiceId}`)}
              >
                <Feather name="file-text" size={12} color={colors.primary} />
                <Text style={styles.linkBadgeText}>{invoiceNumber}</Text>
              </TouchableOpacity>
            )}
            {jobTitle && (
              <TouchableOpacity 
                style={styles.linkBadge}
                onPress={() => router.push(`/job/${request.jobId}`)}
              >
                <Feather name="briefcase" size={12} color={colors.primary} />
                <Text style={styles.linkBadgeText} numberOfLines={1}>{jobTitle}</Text>
              </TouchableOpacity>
            )}
            {clientName && (
              <TouchableOpacity 
                style={styles.linkBadge}
                onPress={() => router.push(`/more/client/${request.clientId}`)}
              >
                <Feather name="user" size={12} color={colors.primary} />
                <Text style={styles.linkBadgeText}>{clientName}</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {request.reference && (
            <Text style={styles.requestReference}>Ref: {request.reference}</Text>
          )}
          <Text style={styles.requestTime}>
            {request.paidAt 
              ? `Paid ${format(new Date(request.paidAt), 'dd MMM yyyy, h:mm a')}`
              : `Created ${formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}`
            }
          </Text>
        </View>
        
        {isPending && (
          <View style={styles.requestActions}>
            <TouchableOpacity 
              style={styles.requestActionButton}
              onPress={() => {
                setSelectedRequest(request);
                setShowShareModal(true);
              }}
            >
              <Feather name="share-2" size={iconSizes.md} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.requestActionButton}
              onPress={() => handleCancelRequest(request.id)}
            >
              <Feather name="x-circle" size={iconSizes.md} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderReceiptCard = (receipt: Receipt) => {
    const clientName = receipt.clientId ? clientMap.get(receipt.clientId)?.name : null;
    const invoiceNumber = receipt.invoiceId ? invoiceMap.get(receipt.invoiceId)?.number : null;

    return (
      <TouchableOpacity 
        key={receipt.id} 
        style={styles.requestCard}
        onPress={() => router.push(`/more/receipt/${receipt.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.requestCardContent}>
          <View style={styles.requestCardHeader}>
            <Text style={styles.requestAmount}>{formatCurrency(receipt.amount)}</Text>
            <View style={[styles.badge, { backgroundColor: `${colors.success}20` }]}>
              <Text style={[styles.badgeText, { color: colors.success }]}>Paid</Text>
            </View>
          </View>
          <Text style={styles.requestDescription}>{receipt.receiptNumber}</Text>
          
          <View style={styles.requestLinks}>
            {clientName && (
              <View style={styles.linkBadge}>
                <Feather name="user" size={12} color={colors.primary} />
                <Text style={styles.linkBadgeText}>{clientName}</Text>
              </View>
            )}
            {invoiceNumber && (
              <View style={styles.linkBadge}>
                <Feather name="file-text" size={12} color={colors.primary} />
                <Text style={styles.linkBadgeText}>{invoiceNumber}</Text>
              </View>
            )}
          </View>
          
          {receipt.paidAt && (
            <Text style={[styles.requestTime, { color: colors.success }]}>
              Paid {format(new Date(receipt.paidAt), 'dd MMM yyyy, h:mm a')}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: { value: string; label: string }[],
    selectedValue: string,
    onSelect: (value: string) => void,
    showNone?: boolean
  ) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={iconSizes.lg} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerScroll}>
            {showNone && (
              <TouchableOpacity
                style={[styles.pickerOption, selectedValue === '' && styles.pickerOptionSelected]}
                onPress={() => { onSelect(''); onClose(); }}
              >
                <Text style={styles.pickerOptionText}>None</Text>
                {selectedValue === '' && <Feather name="check" size={iconSizes.md} color={colors.primary} />}
              </TouchableOpacity>
            )}
            {options.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[styles.pickerOption, selectedValue === option.value && styles.pickerOptionSelected]}
                onPress={() => { onSelect(option.value); onClose(); }}
              >
                <Text style={styles.pickerOptionText} numberOfLines={2}>{option.label}</Text>
                {selectedValue === option.value && <Feather name="check" size={iconSizes.md} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderCreateModal = () => (
    <Modal visible={showCreateModal} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Feather name="maximize-2" size={iconSizes.lg} color={colors.primary} />
              <Text style={styles.modalTitle}>New Payment Request</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowCreateModal(false); resetCreateForm(); }}>
              <Feather name="x" size={iconSizes.xl} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Create a QR code or link for on-site payments</Text>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {unpaidInvoices.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Link to Invoice</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('create'); setShowInvoicePicker(true); }}
                >
                  <Text style={[styles.formSelectText, !selectedInvoiceId && styles.formSelectPlaceholder]}>
                    {selectedInvoiceId 
                      ? `${invoiceMap.get(selectedInvoiceId)?.number} - ${formatCurrency(invoiceMap.get(selectedInvoiceId)?.total || 0)}`
                      : 'Select an invoice (optional)'}
                  </Text>
                  <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
                </TouchableOpacity>
                <Text style={styles.formHint}>Selecting an invoice will auto-fill the amount and description</Text>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Amount (AUD) *</Text>
              <View style={styles.amountInput}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInputField}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  value={newAmount}
                  onChangeText={setNewAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              {newAmount && parseFloat(newAmount) > 0 && (
                <Text style={styles.formHint}>Includes ${(parseFloat(newAmount) / 11).toFixed(2)} GST</Text>
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="e.g., Kitchen tap repair"
                placeholderTextColor={colors.mutedForeground}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
                numberOfLines={2}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reference (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Job #123"
                placeholderTextColor={colors.mutedForeground}
                value={newReference}
                onChangeText={setNewReference}
              />
            </View>
            
            {clients.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Client (optional)</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('create'); setShowClientPicker(true); }}
                >
                  <Text style={[styles.formSelectText, !selectedClientId && styles.formSelectPlaceholder]}>
                    {selectedClientId ? clientMap.get(selectedClientId)?.name : 'Select a client'}
                  </Text>
                  <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
            
            {activeJobs.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Link to Job (optional)</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('create'); setShowJobPicker(true); }}
                >
                  <Text style={[styles.formSelectText, !selectedJobId && styles.formSelectPlaceholder]}>
                    {selectedJobId ? jobMap.get(selectedJobId)?.title : 'Select a job'}
                  </Text>
                  <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Link expires in</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => setShowExpiryPicker(true)}
              >
                <Text style={styles.formSelectText}>
                  {expiryOptions.find(o => o.value === expiresInHours)?.label || '24 hours'}
                </Text>
                <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalButtonSecondary}
              onPress={() => { setShowCreateModal(false); resetCreateForm(); }}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonPrimary, isSubmitting && styles.modalButtonDisabled]}
              onPress={handleCreateRequest}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="maximize-2" size={iconSizes.md} color={colors.primaryForeground} />
                  <Text style={styles.modalButtonPrimaryText}>Create Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderRecordPaymentModal = () => (
    <Modal visible={showRecordPaymentModal} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Feather name="dollar-sign" size={iconSizes.lg} color={colors.primary} />
              <Text style={styles.modalTitle}>Record Payment</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowRecordPaymentModal(false); resetRecordForm(); }}>
              <Feather name="x" size={iconSizes.xl} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Record a cash, bank transfer, or other offline payment</Text>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Invoice *</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => { setPickerContext('record'); setShowInvoicePicker(true); }}
              >
                <Text style={[styles.formSelectText, !recordInvoiceId && styles.formSelectPlaceholder]}>
                  {recordInvoiceId 
                    ? `${invoiceMap.get(recordInvoiceId)?.number} - ${formatCurrency(invoiceMap.get(recordInvoiceId)?.total || 0)}`
                    : 'Select an invoice'}
                </Text>
                <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Amount Received (AUD) *</Text>
              <View style={styles.amountInput}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInputField}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  value={recordAmount}
                  onChangeText={setRecordAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Method *</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => { setPickerContext('record'); setShowMethodPicker(true); }}
              >
                <Text style={styles.formSelectText}>
                  {paymentMethods.find(m => m.value === recordPaymentMethod)?.label || 'Cash'}
                </Text>
                <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Reference (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Bank transfer ref or cheque number"
                placeholderTextColor={colors.mutedForeground}
                value={recordReference}
                onChangeText={setRecordReference}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Any additional notes about this payment"
                placeholderTextColor={colors.mutedForeground}
                value={recordNotes}
                onChangeText={setRecordNotes}
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalButtonSecondary}
              onPress={() => { setShowRecordPaymentModal(false); resetRecordForm(); }}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonPrimary, (isSubmitting || !recordInvoiceId) && styles.modalButtonDisabled]}
              onPress={handleRecordPayment}
              disabled={isSubmitting || !recordInvoiceId}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="check-circle" size={iconSizes.md} color={colors.primaryForeground} />
                  <Text style={styles.modalButtonPrimaryText}>Record Payment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderReceiptModal = () => (
    <Modal visible={showReceiptModal} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Feather name="file-text" size={iconSizes.lg} color={colors.primary} />
              <Text style={styles.modalTitle}>Generate Receipt</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowReceiptModal(false); resetReceiptForm(); }}>
              <Feather name="x" size={iconSizes.xl} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Create a receipt for a payment received</Text>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Link to Invoice (optional)</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => { setPickerContext('receipt'); setShowInvoicePicker(true); }}
              >
                <Text style={[styles.formSelectText, !receiptInvoiceId && styles.formSelectPlaceholder]}>
                  {receiptInvoiceId 
                    ? `${invoiceMap.get(receiptInvoiceId)?.number} - ${formatCurrency(invoiceMap.get(receiptInvoiceId)?.total || 0)}`
                    : 'Select an invoice (optional)'}
                </Text>
                <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Amount Received (AUD) *</Text>
              <View style={styles.amountInput}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInputField}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  value={receiptAmount}
                  onChangeText={setReceiptAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Payment for plumbing services"
                placeholderTextColor={colors.mutedForeground}
                value={receiptDescription}
                onChangeText={setReceiptDescription}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Method *</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => { setPickerContext('receipt'); setShowMethodPicker(true); }}
              >
                <Text style={styles.formSelectText}>
                  {paymentMethods.find(m => m.value === receiptPaymentMethod)?.label || 'Cash'}
                </Text>
                <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Reference (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Bank transfer ref or cheque number"
                placeholderTextColor={colors.mutedForeground}
                value={receiptReference}
                onChangeText={setReceiptReference}
              />
            </View>
            
            {clients.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Client (optional)</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('receipt'); setShowClientPicker(true); }}
                >
                  <Text style={[styles.formSelectText, !receiptClientId && styles.formSelectPlaceholder]}>
                    {receiptClientId ? clientMap.get(receiptClientId)?.name : 'Select a client (optional)'}
                  </Text>
                  <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalButtonSecondary}
              onPress={() => { setShowReceiptModal(false); resetReceiptForm(); }}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonPrimary, (isSubmitting || !receiptAmount) && styles.modalButtonDisabled]}
              onPress={handleCreateReceipt}
              disabled={isSubmitting || !receiptAmount}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="file-text" size={iconSizes.md} color={colors.primaryForeground} />
                  <Text style={styles.modalButtonPrimaryText}>Generate Receipt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderShareModal = () => (
    <Modal visible={showShareModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Feather name="share-2" size={iconSizes.lg} color={colors.primary} />
              <Text style={styles.modalTitle}>Share Payment Request</Text>
            </View>
            <TouchableOpacity onPress={() => setShowShareModal(false)}>
              <Feather name="x" size={iconSizes.xl} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {selectedRequest && (
            <Text style={styles.modalSubtitle}>
              {formatCurrency(selectedRequest.amount)} - {selectedRequest.description}
            </Text>
          )}
          
          <View style={styles.shareTabs}>
            <TouchableOpacity 
              style={[styles.shareTab, shareTab === 'qr' && styles.shareTabActive]}
              onPress={() => setShareTab('qr')}
            >
              <Feather name="maximize-2" size={iconSizes.md} color={shareTab === 'qr' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.shareTabText, shareTab === 'qr' && styles.shareTabTextActive]}>QR Code</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.shareTab, shareTab === 'link' && styles.shareTabActive]}
              onPress={() => setShareTab('link')}
            >
              <Feather name="link-2" size={iconSizes.md} color={shareTab === 'link' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.shareTabText, shareTab === 'link' && styles.shareTabTextActive]}>Link</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.shareTab, shareTab === 'send' && styles.shareTabActive]}
              onPress={() => setShareTab('send')}
            >
              <Feather name="send" size={iconSizes.md} color={shareTab === 'send' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.shareTabText, shareTab === 'send' && styles.shareTabTextActive]}>Send</Text>
            </TouchableOpacity>
          </View>
          
          {selectedRequest && (
            <View style={styles.shareContent}>
              {shareTab === 'qr' && (
                <View style={styles.qrContainer}>
                  <View style={styles.qrWrapper}>
                    {qrLoading ? (
                      <View style={styles.qrLoading}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.qrLoadingText}>Generating QR Code...</Text>
                      </View>
                    ) : qrCodeDataUrl ? (
                      <Image 
                        source={{ uri: qrCodeDataUrl }} 
                        style={styles.qrImage} 
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.qrFallback}>
                        <Feather name="maximize-2" size={80} color={colors.primary} />
                        <Text style={styles.qrFallbackTitle}>Payment QR Code</Text>
                        <Text style={styles.qrFallbackAmount}>{formatCurrency(selectedRequest.amount)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.qrHint}>Customer can scan this code to pay</Text>
                  <TouchableOpacity 
                    style={styles.qrCopyButton}
                    onPress={handleCopyLink}
                  >
                    <Feather name={copied ? 'check' : 'copy'} size={iconSizes.md} color={colors.primaryForeground} />
                    <Text style={styles.qrCopyButtonText}>{copied ? 'Copied!' : 'Copy Payment Link'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {shareTab === 'link' && (
                <View style={styles.linkContainer}>
                  <View style={styles.linkInputRow}>
                    <TextInput
                      style={styles.linkInput}
                      value={getPaymentUrl(selectedRequest)}
                      editable={false}
                      selectTextOnFocus
                    />
                    <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
                      <Feather 
                        name={copied ? 'check' : 'copy'} 
                        size={iconSizes.md} 
                        color={copied ? colors.success : colors.primary} 
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.linkHint}>Share this link with your customer via any messaging app</Text>
                </View>
              )}
              
              {shareTab === 'send' && (
                <View style={styles.sendContainer}>
                  <TouchableOpacity
                    style={styles.composeEmailButton}
                    onPress={handleComposeEmail}
                    activeOpacity={0.8}
                  >
                    <Feather name="mail" size={iconSizes.md} color={colors.primaryForeground} />
                    <Text style={styles.composeEmailButtonText}>Open in Email App</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.sendDivider}>
                    <View style={styles.sendDividerLine} />
                    <Text style={styles.sendDividerText}>or send directly</Text>
                    <View style={styles.sendDividerLine} />
                  </View>
                  
                  <View style={styles.formGroup}>
                    <View style={styles.sendLabelRow}>
                      <Feather name="mail" size={iconSizes.md} color={colors.primary} />
                      <Text style={styles.formLabel}>Send via Email</Text>
                    </View>
                    <View style={styles.sendInputRow}>
                      <TextInput
                        style={styles.sendInput}
                        placeholder="customer@email.com"
                        placeholderTextColor={colors.mutedForeground}
                        value={shareEmail}
                        onChangeText={setShareEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                      <TouchableOpacity 
                        style={[styles.sendButton, (!shareEmail || isSubmitting) && styles.sendButtonDisabled]}
                        onPress={handleSendEmail}
                        disabled={!shareEmail || isSubmitting}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color={colors.primaryForeground} />
                        ) : (
                          <Text style={styles.sendButtonText}>Send</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.formGroup}>
                    <View style={styles.sendLabelRow}>
                      <Feather name="smartphone" size={iconSizes.md} color={colors.primary} />
                      <Text style={styles.formLabel}>Send via SMS</Text>
                    </View>
                    <View style={styles.sendInputRow}>
                      <TextInput
                        style={styles.sendInput}
                        placeholder="+61 400 000 000"
                        placeholderTextColor={colors.mutedForeground}
                        value={sharePhone}
                        onChangeText={setSharePhone}
                        keyboardType="phone-pad"
                      />
                      <TouchableOpacity 
                        style={[styles.sendButton, (!sharePhone || isSubmitting) && styles.sendButtonDisabled]}
                        onPress={handleSendSms}
                        disabled={!sharePhone || isSubmitting}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color={colors.primaryForeground} />
                        ) : (
                          <Text style={styles.sendButtonText}>Send</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const getInvoiceOptions = () => {
    const list = pickerContext === 'record' ? unpaidInvoices : invoices;
    return list.map(inv => ({
      value: inv.id,
      label: `${inv.number} - ${formatCurrency(inv.total)} (${inv.title})`,
    }));
  };

  const getClientOptions = () => clients.map(c => ({ value: c.id, label: c.name }));
  const getJobOptions = () => activeJobs.map(j => ({ value: j.id, label: j.title }));

  const handleInvoiceSelect = (value: string) => {
    if (pickerContext === 'create') setSelectedInvoiceId(value);
    else if (pickerContext === 'record') setRecordInvoiceId(value);
    else setReceiptInvoiceId(value);
  };

  const handleClientSelect = (value: string) => {
    if (pickerContext === 'create') setSelectedClientId(value);
    else setReceiptClientId(value);
  };

  const handleJobSelect = (value: string) => {
    if (pickerContext === 'create') setSelectedJobId(value);
    else setReceiptJobId(value);
  };

  const handleMethodSelect = (value: string) => {
    if (pickerContext === 'record') setRecordPaymentMethod(value);
    else setReceiptPaymentMethod(value);
  };

  const getSelectedInvoiceId = () => {
    if (pickerContext === 'create') return selectedInvoiceId;
    if (pickerContext === 'record') return recordInvoiceId;
    return receiptInvoiceId;
  };

  const getSelectedClientId = () => {
    if (pickerContext === 'create') return selectedClientId;
    return receiptClientId;
  };

  const getSelectedJobId = () => {
    if (pickerContext === 'create') return selectedJobId;
    return receiptJobId;
  };

  const getSelectedMethod = () => {
    if (pickerContext === 'record') return recordPaymentMethod;
    return receiptPaymentMethod;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Collect Payment',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderStripeWarning()}
        {renderContactlessInfo()}
        {renderTapToPaySection()}
        {renderQuickLinks()}
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : paymentRequests.length === 0 && receipts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Feather name="maximize-2" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No payment requests yet</Text>
            <Text style={styles.emptyDescription}>
              Create a payment request to get a QR code or shareable link that customers can use to pay you on-site.
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity 
                style={styles.emptyButtonSecondary}
                onPress={() => setShowRecordPaymentModal(true)}
              >
                <Feather name="dollar-sign" size={iconSizes.md} color={colors.primary} />
                <Text style={styles.emptyButtonSecondaryText}>Record Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.emptyButtonPrimary}
                onPress={() => setShowCreateModal(true)}
              >
                <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
                <Text style={styles.emptyButtonPrimaryText}>Create Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="clock" size={iconSizes.lg} color={colors.warning} />
                  <Text style={styles.sectionTitle}>Pending Payments ({pendingRequests.length})</Text>
                </View>
                {pendingRequests.map(r => renderRequestCard(r, true))}
              </View>
            )}
            
            {receipts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="file-text" size={iconSizes.lg} color={colors.mutedForeground} />
                  <Text style={styles.sectionTitle}>Receipts ({receipts.length})</Text>
                </View>
                {receipts.slice(0, 10).map(r => renderReceiptCard(r))}
              </View>
            )}
            
            {completedRequests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="check-circle" size={iconSizes.lg} color={colors.mutedForeground} />
                  <Text style={styles.sectionTitle}>Completed Requests ({completedRequests.length})</Text>
                </View>
                {completedRequests.slice(0, 10).map(r => renderRequestCard(r, false))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      
      {renderCreateModal()}
      {renderRecordPaymentModal()}
      {renderReceiptModal()}
      {renderShareModal()}
      
      {renderPickerModal(
        showInvoicePicker,
        () => setShowInvoicePicker(false),
        'Select Invoice',
        getInvoiceOptions(),
        getSelectedInvoiceId(),
        handleInvoiceSelect,
        pickerContext !== 'record'
      )}
      
      {renderPickerModal(
        showClientPicker,
        () => setShowClientPicker(false),
        'Select Client',
        getClientOptions(),
        getSelectedClientId(),
        handleClientSelect,
        true
      )}
      
      {renderPickerModal(
        showJobPicker,
        () => setShowJobPicker(false),
        'Select Job',
        getJobOptions(),
        getSelectedJobId(),
        handleJobSelect,
        true
      )}
      
      {renderPickerModal(
        showExpiryPicker,
        () => setShowExpiryPicker(false),
        'Link Expires In',
        expiryOptions,
        expiresInHours,
        setExpiresInHours,
        false
      )}
      
      {renderPickerModal(
        showMethodPicker,
        () => setShowMethodPicker(false),
        'Payment Method',
        paymentMethods,
        getSelectedMethod(),
        handleMethodSelect,
        false
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  headerButtonText: {
    ...typography.button,
    color: colors.primary,
  },
  contactlessCard: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.info + '30',
    marginBottom: spacing.lg,
  },
  contactlessIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  contactlessContent: {
    flex: 1,
  },
  contactlessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  contactlessTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  contactlessDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  contactlessCards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contactlessCardsText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  stripeWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: `${colors.warning}15`,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${colors.warning}40`,
    marginBottom: spacing.lg,
  },
  stripeWarningIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: `${colors.warning}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeWarningContent: {
    flex: 1,
  },
  stripeWarningTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  stripeWarningDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  quickLinksContainer: {
    marginBottom: spacing.lg,
  },
  quickLinksTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickLinkCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    alignItems: 'center',
  },
  quickLinkIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickLinkLabel: {
    ...typography.button,
    color: colors.foreground,
    marginBottom: 2,
  },
  quickLinkCount: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  loadingContainer: {
    padding: spacing['4xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing['3xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyButtonSecondaryText: {
    ...typography.button,
    color: colors.primary,
  },
  emptyButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  emptyButtonPrimaryText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  requestCardCompleted: {
    opacity: 0.7,
  },
  requestCardContent: {
    flex: 1,
  },
  requestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  requestAmount: {
    ...typography.headline,
    color: colors.foreground,
  },
  requestDescription: {
    ...typography.body,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  requestLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  linkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  linkBadgeText: {
    ...typography.captionSmall,
    color: colors.foreground,
    maxWidth: 100,
  },
  requestReference: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  requestTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.md,
  },
  requestActionButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    ...typography.badge,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    paddingBottom: spacing['2xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  modalScroll: {
    padding: spacing.lg,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  modalButtonSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalButtonSecondaryText: {
    ...typography.button,
    color: colors.foreground,
  },
  modalButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  modalButtonPrimaryText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  formInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
  },
  formTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  formSelectText: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  formSelectPlaceholder: {
    color: colors.mutedForeground,
  },
  formHint: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
  },
  amountPrefix: {
    ...typography.body,
    color: colors.mutedForeground,
    paddingLeft: spacing.md,
  },
  amountInputField: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
  },
  shareTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    marginTop: spacing.md,
  },
  shareTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  shareTabActive: {
    borderBottomColor: colors.primary,
  },
  shareTabText: {
    ...typography.button,
    color: colors.mutedForeground,
  },
  shareTabTextActive: {
    color: colors.primary,
  },
  shareContent: {
    padding: spacing.lg,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrWrapper: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    ...shadows.md,
  },
  qrFallback: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  qrFallbackTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  qrFallbackAmount: {
    ...typography.headline,
    color: colors.primary,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrLoading: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  qrLoadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  qrHint: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  qrCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  qrCopyButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  linkContainer: {
    gap: spacing.md,
  },
  linkInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  linkInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.captionSmall,
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkHint: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  sendContainer: {
    gap: spacing.lg,
  },
  sendLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sendInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sendInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
  },
  sendButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  pickerTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  pickerScroll: {
    padding: spacing.lg,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  pickerOptionSelected: {
    backgroundColor: colors.muted,
  },
  pickerOptionText: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.md,
  },
  tapToPaySection: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  applePayButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  applePayButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  applePayButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tapToPayHint: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  composeEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  composeEmailButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  sendDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sendDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  sendDividerText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});

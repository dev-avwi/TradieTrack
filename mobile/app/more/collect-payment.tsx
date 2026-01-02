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
import * as WebBrowser from 'expo-web-browser';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes, pageShell } from '../../src/lib/design-tokens';
import { api, API_URL } from '../../src/lib/api';
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';

const isIOS = Platform.OS === 'ios';

interface StripeConnectStatus {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

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

type TabType = 'collect' | 'history';

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const getDateGroup = (dateString: string): string => {
  const date = parseISO(dateString);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return 'This Week';
  return format(date, 'MMMM yyyy');
};

export default function CollectPaymentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ tab?: string; invoiceId?: string; jobId?: string }>();
  
  const [activeTab, setActiveTab] = useState<TabType>('collect');
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

  const totalPendingAmount = useMemo(() => {
    return pendingRequests.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
  }, [pendingRequests]);

  const totalReceived = useMemo(() => {
    return receipts.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
  }, [receipts]);

  const paidRequestsCount = useMemo(() => 
    paymentRequests.filter(r => r.status === 'paid').length, [paymentRequests]);

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const invoiceMap = useMemo(() => new Map(invoices.map(i => [i.id, i])), [invoices]);
  const jobMap = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);

  const [secondaryDataLoaded, setSecondaryDataLoaded] = useState(false);
  const [loadingSecondary, setLoadingSecondary] = useState(false);

  const groupedReceipts = useMemo(() => {
    const groups: { [key: string]: Receipt[] } = {};
    receipts.forEach(receipt => {
      const group = getDateGroup(receipt.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(receipt);
    });
    return groups;
  }, [receipts]);

  const fetchEssentialData = useCallback(async () => {
    try {
      const [requestsRes, stripeRes, receiptsRes] = await Promise.all([
        api.get<PaymentRequest[]>('/api/payment-requests').catch(() => ({ data: [] as PaymentRequest[] })),
        api.get<StripeConnectStatus>('/api/stripe/connect/status').catch(() => ({ data: { connected: false } as StripeConnectStatus })),
        api.get<Receipt[]>('/api/receipts').catch(() => ({ data: [] as Receipt[] })),
      ]);
      
      if (requestsRes.data) setPaymentRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
      if (stripeRes.data) setStripeStatus(stripeRes.data);
      if (receiptsRes.data) setReceipts(Array.isArray(receiptsRes.data) ? receiptsRes.data : []);
    } catch (error) {
      console.error('Error fetching essential data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchSecondaryData = useCallback(async () => {
    if (secondaryDataLoaded || loadingSecondary) return;
    setLoadingSecondary(true);
    try {
      const [clientsRes, invoicesRes, jobsRes] = await Promise.all([
        api.get<Client[]>('/api/clients').catch(() => ({ data: [] as Client[] })),
        api.get<Invoice[]>('/api/invoices').catch(() => ({ data: [] as Invoice[] })),
        api.get<Job[]>('/api/jobs').catch(() => ({ data: [] as Job[] })),
      ]);
      
      if (clientsRes.data) setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      if (invoicesRes.data) setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      if (jobsRes.data) setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
      setSecondaryDataLoaded(true);
    } catch (error) {
      console.error('Error fetching secondary data:', error);
    } finally {
      setLoadingSecondary(false);
    }
  }, [secondaryDataLoaded, loadingSecondary]);

  const fetchData = useCallback(async () => {
    setSecondaryDataLoaded(false);
    await fetchEssentialData();
  }, [fetchEssentialData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Track URL param processing state
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [pendingModalType, setPendingModalType] = useState<'qr' | 'link' | 'tap' | null>(null);

  // Step 1: Process URL parameters and pre-fill data, set pending modal type
  useEffect(() => {
    const processParams = async () => {
      // Skip if no params or already processed
      if (!params.invoiceId || paramsProcessed) return;
      
      // Ensure secondary data is loaded first
      if (!secondaryDataLoaded && !loadingSecondary) {
        await fetchSecondaryData();
        return; // Will re-run when secondaryDataLoaded becomes true
      }
      
      // Wait for invoices to be loaded
      if (invoices.length === 0) return;
      
      // Find the invoice to pre-fill data
      const selectedInvoice = invoices.find(inv => inv.id === params.invoiceId);
      if (!selectedInvoice) return;
      
      // Pre-select invoice and job for all form contexts
      setSelectedInvoiceId(params.invoiceId);
      setReceiptInvoiceId(params.invoiceId);
      
      // Also pre-fill job if provided
      const jobId = params.jobId || selectedInvoice.jobId;
      if (jobId) {
        setSelectedJobId(jobId);
        setReceiptJobId(jobId);
      }
      
      // Pre-fill amounts and details from invoice
      const invoiceTotal = typeof selectedInvoice.total === 'number' 
        ? selectedInvoice.total.toFixed(2) 
        : String(selectedInvoice.total || '0.00');
      
      // Pre-fill receipt modal fields
      setReceiptAmount(invoiceTotal);
      setReceiptDescription(`Payment for ${selectedInvoice.number}: ${selectedInvoice.title}`);
      setReceiptReference(selectedInvoice.number);
      setReceiptClientId(selectedInvoice.clientId);
      
      // Pre-fill create modal fields
      setNewAmount(invoiceTotal);
      setNewDescription(`Payment for ${selectedInvoice.number}: ${selectedInvoice.title}`);
      setNewReference(selectedInvoice.number);
      setSelectedClientId(selectedInvoice.clientId);
      
      // Set pending modal type (modal will open in next effect after state is applied)
      if (params.tab === 'qr') {
        setShareTab('qr');
        setPendingModalType('qr');
      } else if (params.tab === 'link') {
        setShareTab('link');
        setPendingModalType('link');
      } else if (params.tab === 'tap') {
        setReceiptPaymentMethod('card');
        setPendingModalType('tap');
      }
      
      setParamsProcessed(true);
    };
    
    processParams();
  }, [params.invoiceId, params.jobId, params.tab, secondaryDataLoaded, loadingSecondary, invoices.length, jobs.length, paramsProcessed]);

  // Step 2: Open modal after data is fully hydrated (separate effect for proper timing)
  useEffect(() => {
    if (!pendingModalType || !paramsProcessed) return;
    
    // Verify ALL required fields are hydrated before opening modal
    if (pendingModalType === 'tap') {
      // For tap-to-pay, verify receipt modal fields are ready
      if (receiptInvoiceId && receiptAmount && receiptClientId && receiptDescription) {
        setShowReceiptModal(true);
        setPendingModalType(null);
      }
    } else if (pendingModalType === 'qr' || pendingModalType === 'link') {
      // For QR/Link, verify create modal fields are ready
      if (selectedInvoiceId && newAmount && selectedClientId && newDescription) {
        setShowCreateModal(true);
        setPendingModalType(null);
      }
    }
  }, [pendingModalType, paramsProcessed, receiptInvoiceId, receiptAmount, receiptClientId, receiptDescription, selectedInvoiceId, newAmount, selectedClientId, newDescription]);

  useEffect(() => {
    if (selectedInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (invoice) {
        const total = typeof invoice.total === 'number' ? invoice.total.toFixed(2) : String(invoice.total || '0.00');
        setNewAmount(total);
        setNewDescription(`Payment for ${invoice.number}: ${invoice.title}`);
        setNewReference(invoice.number); // Auto-fill reference with invoice number
        setSelectedClientId(invoice.clientId);
        // Only auto-fill job if field is empty (respect manual overrides)
        if (invoice.jobId && !selectedJobId) setSelectedJobId(invoice.jobId);
      }
    }
  }, [selectedInvoiceId, invoices]);

  useEffect(() => {
    if (recordInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.id === recordInvoiceId);
      if (invoice) {
        const total = typeof invoice.total === 'number' ? invoice.total.toFixed(2) : String(invoice.total || '0.00');
        setRecordAmount(total);
        setRecordReference(invoice.number); // Auto-fill reference with invoice number
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
        setReceiptReference(invoice.number); // Auto-fill reference with invoice number
        setReceiptClientId(invoice.clientId);
        // Only auto-fill job if field is empty (respect manual overrides)
        if (invoice.jobId && !receiptJobId) setReceiptJobId(invoice.jobId);
      }
    }
  }, [receiptInvoiceId, invoices]);

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
    setSecondaryDataLoaded(false);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchSecondaryData();
    }
  }, [activeTab, fetchSecondaryData]);

  useEffect(() => {
    if (showCreateModal || showRecordPaymentModal || showReceiptModal) {
      fetchSecondaryData();
    }
  }, [showCreateModal, showRecordPaymentModal, showReceiptModal, fetchSecondaryData]);

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

  const handlePrintReceipt = async (receiptId: string) => {
    try {
      const pdfUrl = `${API_URL}/api/receipts/${receiptId}/pdf`;
      await WebBrowser.openBrowserAsync(pdfUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to open receipt');
    }
  };

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: 'dollar-sign' as const },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: 'send' as const },
    { value: 'card', label: 'Card', icon: 'credit-card' as const },
    { value: 'cheque', label: 'Cheque', icon: 'file-text' as const },
    { value: 'other', label: 'Other', icon: 'more-horizontal' as const },
  ];

  const expiryOptions = [
    { value: '1', label: '1 hour' },
    { value: '4', label: '4 hours' },
    { value: '24', label: '24 hours' },
    { value: '72', label: '3 days' },
    { value: '168', label: '1 week' },
  ];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: colors.warning, bgColor: colorWithOpacity(colors.warning, 0.12) };
      case 'paid':
        return { label: 'Paid', color: colors.success, bgColor: colorWithOpacity(colors.success, 0.12) };
      case 'cancelled':
        return { label: 'Cancelled', color: colors.destructive, bgColor: colorWithOpacity(colors.destructive, 0.12) };
      case 'expired':
        return { label: 'Expired', color: colors.mutedForeground, bgColor: colors.muted };
      default:
        return { label: status, color: colors.mutedForeground, bgColor: colors.muted };
    }
  };

  const renderHeroSection = () => (
    <View style={styles.heroSection}>
      {!stripeStatus?.connected && (
        <TouchableOpacity 
          style={styles.stripeConnectBanner}
          onPress={() => router.push('/more/money-hub')}
          activeOpacity={0.8}
          data-testid="button-connect-stripe"
        >
          <View style={styles.stripeBannerLeft}>
            <View style={styles.stripeBannerIcon}>
              <Feather name="zap" size={16} color={colors.warning} />
            </View>
            <View>
              <Text style={styles.stripeBannerTitle}>Enable Card Payments</Text>
              <Text style={styles.stripeBannerSubtitle}>Connect Stripe to accept cards</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      <View style={styles.heroCard}>
        <View style={styles.heroStats}>
          <View style={styles.heroStatMain}>
            <Text style={styles.heroStatLabel}>Outstanding</Text>
            <Text style={[styles.heroStatValue, totalPendingAmount > 0 && { color: colors.warning }]}>
              {formatCurrency(totalPendingAmount)}
            </Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatSecondary}>
            <View style={styles.miniStat}>
              <View style={[styles.miniStatDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.miniStatLabel}>{pendingRequests.length} pending</Text>
            </View>
            <View style={styles.miniStat}>
              <View style={[styles.miniStatDot, { backgroundColor: colors.success }]} />
              <Text style={styles.miniStatLabel}>{paidRequestsCount} paid</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.primaryCta}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
        data-testid="button-create-payment-request"
      >
        <Feather name="plus" size={22} color={colors.primaryForeground} />
        <Text style={styles.primaryCtaText}>Create Payment Request</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSegmentedControl = () => (
    <View style={styles.segmentedControl}>
      <TouchableOpacity
        style={[styles.segmentItem, activeTab === 'collect' && styles.segmentItemActive]}
        onPress={() => setActiveTab('collect')}
        activeOpacity={0.7}
        data-testid="tab-collect"
      >
        <Text style={[styles.segmentText, activeTab === 'collect' && styles.segmentTextActive]}>
          Collect
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segmentItem, activeTab === 'history' && styles.segmentItemActive]}
        onPress={() => setActiveTab('history')}
        activeOpacity={0.7}
        data-testid="tab-history"
      >
        <Text style={[styles.segmentText, activeTab === 'history' && styles.segmentTextActive]}>
          History
        </Text>
        {receipts.length > 0 && (
          <View style={styles.segmentBadge}>
            <Text style={styles.segmentBadgeText}>{receipts.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCollectTab = () => (
    <View style={styles.tabContent}>
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Requests</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pendingRequests.length}</Text>
            </View>
          </View>
          {pendingRequests.map((request) => {
            const statusConfig = getStatusConfig(request.status);
            const clientName = request.clientId ? clientMap.get(request.clientId)?.name : null;
            return (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestCardMain}>
                  <View style={styles.requestCardLeft}>
                    <Text style={styles.requestAmount}>{formatCurrency(request.amount)}</Text>
                    <Text style={styles.requestDescription} numberOfLines={1}>
                      {request.description}
                    </Text>
                    <View style={styles.requestMeta}>
                      {clientName && (
                        <Text style={styles.requestMetaText}>{clientName}</Text>
                      )}
                      {clientName && <Text style={styles.requestMetaDot}>·</Text>}
                      <Text style={styles.requestMetaText}>
                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.requestCardActions}>
                  <TouchableOpacity 
                    style={styles.requestActionBtn}
                    onPress={() => {
                      setSelectedRequest(request);
                      setShowShareModal(true);
                    }}
                    activeOpacity={0.7}
                    data-testid={`button-share-${request.id}`}
                  >
                    <Feather name="share-2" size={16} color={colors.primary} />
                    <Text style={[styles.requestActionText, { color: colors.primary }]}>Share</Text>
                  </TouchableOpacity>
                  <View style={styles.actionDivider} />
                  <TouchableOpacity 
                    style={styles.requestActionBtn}
                    onPress={() => handleCancelRequest(request.id)}
                    activeOpacity={0.7}
                    data-testid={`button-cancel-${request.id}`}
                  >
                    <Feather name="x-circle" size={16} color={colors.destructive} />
                    <Text style={[styles.requestActionText, { color: colors.destructive }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => setShowRecordPaymentModal(true)}
            activeOpacity={0.7}
            data-testid="button-record-payment"
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
              <Feather name="check-circle" size={20} color={colors.success} />
            </View>
            <Text style={styles.quickActionTitle}>Record Payment</Text>
            <Text style={styles.quickActionSubtitle}>Cash/Transfer</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => setShowReceiptModal(true)}
            activeOpacity={0.7}
            data-testid="button-create-receipt"
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colorWithOpacity(colors.info || colors.primary, 0.12) }]}>
              <Feather name="file-text" size={20} color={colors.info || colors.primary} />
            </View>
            <Text style={styles.quickActionTitle}>Issue Receipt</Text>
            <Text style={styles.quickActionSubtitle}>Generate PDF</Text>
          </TouchableOpacity>

          {stripeStatus?.connected && (
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => Alert.alert('Tap to Pay', 'Position phone near customer card to collect payment')}
              activeOpacity={0.7}
              data-testid="button-tap-to-pay"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
                <Feather name="smartphone" size={20} color={colors.primary} />
              </View>
              <Text style={styles.quickActionTitle}>Tap to Pay</Text>
              <Text style={styles.quickActionSubtitle}>Contactless</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {pendingRequests.length === 0 && (
        <View style={styles.emptyStateInline}>
          <View style={styles.emptyIcon}>
            <Feather name="credit-card" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptySubtitle}>
            Create a payment request to get started
          </Text>
        </View>
      )}
    </View>
  );

  const renderHistoryTab = () => (
    <View style={styles.tabContent}>
      {receipts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Receipts</Text>
            <Text style={styles.sectionSubtitle}>{formatCurrency(totalReceived)} total</Text>
          </View>
          {Object.entries(groupedReceipts).map(([group, groupReceipts]) => (
            <View key={group}>
              <Text style={styles.dateGroupHeader}>{group}</Text>
              {groupReceipts.map((receipt) => {
                const clientName = receipt.clientId ? clientMap.get(receipt.clientId)?.name : null;
                return (
                  <TouchableOpacity 
                    key={receipt.id}
                    style={styles.receiptCard}
                    onPress={() => router.push(`/more/receipt/${receipt.id}`)}
                    activeOpacity={0.7}
                    data-testid={`receipt-card-${receipt.id}`}
                  >
                    <View style={styles.receiptIconContainer}>
                      <Feather name="file-text" size={18} color={colors.success} />
                    </View>
                    <View style={styles.receiptContent}>
                      <View style={styles.receiptTop}>
                        <Text style={styles.receiptNumber}>{receipt.receiptNumber}</Text>
                        <Text style={styles.receiptAmount}>{formatCurrency(receipt.amount)}</Text>
                      </View>
                      <View style={styles.receiptBottom}>
                        <Text style={styles.receiptMeta}>
                          {clientName || 'No client'} · {paymentMethods.find(m => m.value === receipt.paymentMethod)?.label || receipt.paymentMethod}
                        </Text>
                        {receipt.paidAt && (
                          <Text style={[styles.receiptMeta, { color: colors.success }]}>
                            {format(new Date(receipt.paidAt), 'h:mm a')}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {completedRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Requests</Text>
          {completedRequests.slice(0, 10).map((request) => {
            const statusConfig = getStatusConfig(request.status);
            return (
              <View key={request.id} style={styles.pastRequestCard}>
                <View style={styles.pastRequestLeft}>
                  <Text style={styles.pastRequestAmount}>{formatCurrency(request.amount)}</Text>
                  <Text style={styles.pastRequestDescription} numberOfLines={1}>
                    {request.description}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {receipts.length === 0 && completedRequests.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="inbox" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptySubtitle}>
            Your completed payments and receipts will appear here.
          </Text>
        </View>
      )}
    </View>
  );

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
            <TouchableOpacity onPress={onClose} data-testid="button-close-picker">
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerScroll}>
            {showNone && (
              <TouchableOpacity
                style={[styles.pickerOption, selectedValue === '' && styles.pickerOptionSelected]}
                onPress={() => { onSelect(''); onClose(); }}
              >
                <Text style={styles.pickerOptionText}>None</Text>
                {selectedValue === '' && <Feather name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )}
            {options.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[styles.pickerOption, selectedValue === option.value && styles.pickerOptionSelected]}
                onPress={() => { onSelect(option.value); onClose(); }}
              >
                <Text style={styles.pickerOptionText} numberOfLines={2}>{option.label}</Text>
                {selectedValue === option.value && <Feather name="check" size={20} color={colors.primary} />}
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
            <Text style={styles.modalTitle}>New Payment Request</Text>
            <TouchableOpacity 
              onPress={() => { setShowCreateModal(false); resetCreateForm(); }}
              data-testid="button-close-create-modal"
            >
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {unpaidInvoices.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Link to Invoice</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('create'); setShowInvoicePicker(true); }}
                  data-testid="select-invoice"
                >
                  <Text style={[styles.formSelectText, !selectedInvoiceId && styles.formSelectPlaceholder]}>
                    {selectedInvoiceId 
                      ? `${invoiceMap.get(selectedInvoiceId)?.number} - ${formatCurrency(invoiceMap.get(selectedInvoiceId)?.total || 0)}`
                      : 'Select an invoice (optional)'}
                  </Text>
                  <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
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
                  data-testid="input-amount"
                />
              </View>
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
                data-testid="input-description"
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
                data-testid="input-reference"
              />
            </View>
            
            {clients.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Client (optional)</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('create'); setShowClientPicker(true); }}
                  data-testid="select-client"
                >
                  <Text style={[styles.formSelectText, !selectedClientId && styles.formSelectPlaceholder]}>
                    {selectedClientId ? clientMap.get(selectedClientId)?.name : 'Select a client'}
                  </Text>
                  <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Link expires in</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => setShowExpiryPicker(true)}
                data-testid="select-expiry"
              >
                <Text style={styles.formSelectText}>
                  {expiryOptions.find(o => o.value === expiresInHours)?.label || '24 hours'}
                </Text>
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalButtonSecondary}
              onPress={() => { setShowCreateModal(false); resetCreateForm(); }}
              data-testid="button-cancel"
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonPrimary, isSubmitting && styles.modalButtonDisabled]}
              onPress={handleCreateRequest}
              disabled={isSubmitting}
              data-testid="button-create-request"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>Create Request</Text>
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
            <Text style={styles.modalTitle}>Record Payment</Text>
            <TouchableOpacity 
              onPress={() => { setShowRecordPaymentModal(false); resetRecordForm(); }}
              data-testid="button-close-record-modal"
            >
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Invoice *</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => { setPickerContext('record'); setShowInvoicePicker(true); }}
                data-testid="select-invoice-record"
              >
                <Text style={[styles.formSelectText, !recordInvoiceId && styles.formSelectPlaceholder]}>
                  {recordInvoiceId 
                    ? `${invoiceMap.get(recordInvoiceId)?.number} - ${formatCurrency(invoiceMap.get(recordInvoiceId)?.total || 0)}`
                    : 'Select an invoice'}
                </Text>
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Amount (AUD) *</Text>
              <View style={styles.amountInput}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInputField}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  value={recordAmount}
                  onChangeText={setRecordAmount}
                  keyboardType="decimal-pad"
                  data-testid="input-record-amount"
                />
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Method</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => { setPickerContext('record'); setShowMethodPicker(true); }}
                data-testid="select-payment-method"
              >
                <Text style={styles.formSelectText}>
                  {paymentMethods.find(m => m.value === recordPaymentMethod)?.label || 'Cash'}
                </Text>
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reference (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Transaction ID"
                placeholderTextColor={colors.mutedForeground}
                value={recordReference}
                onChangeText={setRecordReference}
                data-testid="input-record-reference"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.mutedForeground}
                value={recordNotes}
                onChangeText={setRecordNotes}
                multiline
                numberOfLines={2}
                data-testid="input-record-notes"
              />
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalButtonSecondary}
              onPress={() => { setShowRecordPaymentModal(false); resetRecordForm(); }}
              data-testid="button-cancel-record"
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonPrimary, isSubmitting && styles.modalButtonDisabled]}
              onPress={handleRecordPayment}
              disabled={isSubmitting}
              data-testid="button-record"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>Record Payment</Text>
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
            <Text style={styles.modalTitle}>Issue Receipt</Text>
            <TouchableOpacity 
              onPress={() => { setShowReceiptModal(false); resetReceiptForm(); }}
              data-testid="button-close-receipt-modal"
            >
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {unpaidInvoices.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Link to Invoice</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('receipt'); setShowInvoicePicker(true); }}
                  data-testid="select-invoice-receipt"
                >
                  <Text style={[styles.formSelectText, !receiptInvoiceId && styles.formSelectPlaceholder]}>
                    {receiptInvoiceId 
                      ? `${invoiceMap.get(receiptInvoiceId)?.number} - ${formatCurrency(invoiceMap.get(receiptInvoiceId)?.total || 0)}`
                      : 'Select an invoice (optional)'}
                  </Text>
                  <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
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
                  value={receiptAmount}
                  onChangeText={setReceiptAmount}
                  keyboardType="decimal-pad"
                  data-testid="input-receipt-amount"
                />
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Payment for services"
                placeholderTextColor={colors.mutedForeground}
                value={receiptDescription}
                onChangeText={setReceiptDescription}
                multiline
                numberOfLines={2}
                data-testid="input-receipt-description"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Payment Method</Text>
              <TouchableOpacity 
                style={styles.formSelect}
                onPress={() => { setPickerContext('receipt'); setShowMethodPicker(true); }}
                data-testid="select-receipt-method"
              >
                <Text style={styles.formSelectText}>
                  {paymentMethods.find(m => m.value === receiptPaymentMethod)?.label || 'Cash'}
                </Text>
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            {clients.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Client (optional)</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('receipt'); setShowClientPicker(true); }}
                  data-testid="select-receipt-client"
                >
                  <Text style={[styles.formSelectText, !receiptClientId && styles.formSelectPlaceholder]}>
                    {receiptClientId ? clientMap.get(receiptClientId)?.name : 'Select a client'}
                  </Text>
                  <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reference (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Transaction ID"
                placeholderTextColor={colors.mutedForeground}
                value={receiptReference}
                onChangeText={setReceiptReference}
                data-testid="input-receipt-reference"
              />
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalButtonSecondary}
              onPress={() => { setShowReceiptModal(false); resetReceiptForm(); }}
              data-testid="button-cancel-receipt"
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonPrimary, { backgroundColor: colors.success }, isSubmitting && styles.modalButtonDisabled]}
              onPress={handleCreateReceipt}
              disabled={isSubmitting}
              data-testid="button-create-receipt"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>Issue Receipt</Text>
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
        <View style={styles.shareModalContainer}>
          <View style={styles.shareModalHeader}>
            <View style={styles.shareModalHandle} />
            <Text style={styles.shareModalTitle}>Share Payment Link</Text>
            <TouchableOpacity 
              onPress={() => setShowShareModal(false)}
              style={styles.shareModalClose}
              data-testid="button-close-share-modal"
            >
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          {selectedRequest && (
            <>
              <View style={styles.shareAmountBanner}>
                <Text style={styles.shareAmountLabel}>Amount Due</Text>
                <Text style={styles.shareAmountValue}>{formatCurrency(selectedRequest.amount)}</Text>
              </View>
              
              <View style={styles.shareTabsContainer}>
                <TouchableOpacity
                  style={[styles.shareTabItem, shareTab === 'qr' && styles.shareTabItemActive]}
                  onPress={() => setShareTab('qr')}
                  activeOpacity={0.7}
                >
                  <Feather name="maximize" size={16} color={shareTab === 'qr' ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.shareTabText, shareTab === 'qr' && styles.shareTabTextActive]}>QR Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareTabItem, shareTab === 'link' && styles.shareTabItemActive]}
                  onPress={() => setShareTab('link')}
                  activeOpacity={0.7}
                >
                  <Feather name="link" size={16} color={shareTab === 'link' ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.shareTabText, shareTab === 'link' && styles.shareTabTextActive]}>Link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareTabItem, shareTab === 'send' && styles.shareTabItemActive]}
                  onPress={() => setShareTab('send')}
                  activeOpacity={0.7}
                >
                  <Feather name="send" size={16} color={shareTab === 'send' ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.shareTabText, shareTab === 'send' && styles.shareTabTextActive]}>Send</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.shareContent} showsVerticalScrollIndicator={false}>
                {shareTab === 'qr' && (
                  <View style={styles.qrContainer}>
                    <View style={styles.qrWrapper}>
                      {qrLoading ? (
                        <View style={styles.qrLoading}>
                          <ActivityIndicator size="large" color={colors.primary} />
                          <Text style={styles.qrLoadingText}>Generating QR...</Text>
                        </View>
                      ) : qrCodeDataUrl ? (
                        <Image source={{ uri: qrCodeDataUrl }} style={styles.qrImage} resizeMode="contain" />
                      ) : (
                        <View style={styles.qrFallback}>
                          <Feather name="maximize" size={48} color={colors.mutedForeground} />
                          <Text style={styles.qrFallbackText}>QR Code</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.qrHint}>Customer scans to pay</Text>
                    <TouchableOpacity 
                      style={styles.copyLinkButton}
                      onPress={handleCopyLink}
                      activeOpacity={0.7}
                      data-testid="button-copy-link"
                    >
                      <Feather name={copied ? 'check' : 'copy'} size={18} color={colors.primaryForeground} />
                      <Text style={styles.copyLinkButtonText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {shareTab === 'link' && (
                  <View style={styles.linkContainer}>
                    <View style={styles.linkBox}>
                      <Text style={styles.linkText} selectable>{getPaymentUrl(selectedRequest)}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.copyLinkButton}
                      onPress={handleCopyLink}
                      activeOpacity={0.7}
                    >
                      <Feather name={copied ? 'check' : 'copy'} size={18} color={colors.primaryForeground} />
                      <Text style={styles.copyLinkButtonText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.linkHint}>Share this link with your customer</Text>
                  </View>
                )}
                
                {shareTab === 'send' && (
                  <View style={styles.sendContainer}>
                    <TouchableOpacity 
                      style={styles.emailAppButton}
                      onPress={handleComposeEmail}
                      activeOpacity={0.7}
                      data-testid="button-open-email"
                    >
                      <Feather name="mail" size={20} color={colors.primaryForeground} />
                      <Text style={styles.emailAppButtonText}>Open Email App</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or send directly</Text>
                      <View style={styles.dividerLine} />
                    </View>
                    
                    <View style={styles.sendInputGroup}>
                      <Text style={styles.sendInputLabel}>Send via SMS</Text>
                      <View style={styles.sendInputRow}>
                        <TextInput
                          style={styles.sendInput}
                          placeholder="Phone number"
                          placeholderTextColor={colors.mutedForeground}
                          value={sharePhone}
                          onChangeText={setSharePhone}
                          keyboardType="phone-pad"
                          data-testid="input-share-phone"
                        />
                        <TouchableOpacity 
                          style={[styles.sendButton, (!sharePhone || isSubmitting) && styles.sendButtonDisabled]}
                          onPress={handleSendSms}
                          disabled={!sharePhone || isSubmitting}
                          data-testid="button-send-sms"
                        >
                          {isSubmitting ? (
                            <ActivityIndicator size="small" color={colors.primaryForeground} />
                          ) : (
                            <Text style={styles.sendButtonText}>Send</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={styles.sendInputGroup}>
                      <Text style={styles.sendInputLabel}>Send via Email</Text>
                      <View style={styles.sendInputRow}>
                        <TextInput
                          style={styles.sendInput}
                          placeholder="Email address"
                          placeholderTextColor={colors.mutedForeground}
                          value={shareEmail}
                          onChangeText={setShareEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          data-testid="input-share-email"
                        />
                        <TouchableOpacity 
                          style={[styles.sendButton, (!shareEmail || isSubmitting) && styles.sendButtonDisabled]}
                          onPress={handleSendEmail}
                          disabled={!shareEmail || isSubmitting}
                          data-testid="button-send-email"
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
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Collect Payment' }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Collect Payment' }} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeroSection()}
        {renderSegmentedControl()}
        {activeTab === 'collect' ? renderCollectTab() : renderHistoryTab()}
      </ScrollView>

      {renderCreateModal()}
      {renderRecordPaymentModal()}
      {renderReceiptModal()}
      {renderShareModal()}
      
      {renderPickerModal(
        showInvoicePicker,
        () => setShowInvoicePicker(false),
        'Select Invoice',
        unpaidInvoices.map(inv => ({
          value: inv.id,
          label: `${inv.number} - ${formatCurrency(inv.total)} - ${inv.title}`,
        })),
        pickerContext === 'create' ? selectedInvoiceId : pickerContext === 'record' ? recordInvoiceId : receiptInvoiceId,
        (value) => {
          if (pickerContext === 'create') setSelectedInvoiceId(value);
          else if (pickerContext === 'record') setRecordInvoiceId(value);
          else setReceiptInvoiceId(value);
        },
        true
      )}
      
      {renderPickerModal(
        showClientPicker,
        () => setShowClientPicker(false),
        'Select Client',
        clients.map(c => ({ value: c.id, label: c.name })),
        pickerContext === 'create' ? selectedClientId : receiptClientId,
        (value) => {
          if (pickerContext === 'create') setSelectedClientId(value);
          else setReceiptClientId(value);
        },
        true
      )}
      
      {renderPickerModal(
        showJobPicker,
        () => setShowJobPicker(false),
        'Select Job',
        activeJobs.map(job => ({
          value: job.id,
          label: job.address ? `${job.title} • ${job.address}` : job.title,
        })),
        pickerContext === 'create' ? selectedJobId : receiptJobId,
        (value) => {
          if (pickerContext === 'create') setSelectedJobId(value);
          else setReceiptJobId(value);
        },
        true
      )}
      
      {renderPickerModal(
        showExpiryPicker,
        () => setShowExpiryPicker(false),
        'Link Expiry',
        expiryOptions,
        expiresInHours,
        setExpiresInHours
      )}
      
      {renderPickerModal(
        showMethodPicker,
        () => setShowMethodPicker(false),
        'Payment Method',
        paymentMethods.map(m => ({ value: m.value, label: m.label })),
        pickerContext === 'record' ? recordPaymentMethod : receiptPaymentMethod,
        (value) => {
          if (pickerContext === 'record') setRecordPaymentMethod(value);
          else setReceiptPaymentMethod(value);
        }
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing['3xl'],
    },

    heroSection: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    stripeConnectBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colorWithOpacity(colors.warning, 0.08),
      borderWidth: 1,
      borderColor: colorWithOpacity(colors.warning, 0.2),
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    stripeBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    stripeBannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colorWithOpacity(colors.warning, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    stripeBannerTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    stripeBannerSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
    },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroStatMain: {
      flex: 1,
    },
    heroStatLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    heroStatValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    heroStatDivider: {
      width: 1,
      height: 48,
      backgroundColor: colors.cardBorder,
      marginHorizontal: spacing.lg,
    },
    heroStatSecondary: {
      gap: spacing.sm,
    },
    miniStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    miniStatDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    miniStatLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    primaryCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      borderRadius: radius.lg,
      ...shadows.sm,
    },
    primaryCtaText: {
      ...typography.bodySemibold,
      color: colors.primaryForeground,
    },

    segmentedControl: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: 4,
    },
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    segmentItemActive: {
      backgroundColor: colors.card,
      ...shadows.xs,
    },
    segmentText: {
      ...typography.button,
      color: colors.mutedForeground,
    },
    segmentTextActive: {
      color: colors.foreground,
    },
    segmentBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
      minWidth: 20,
      alignItems: 'center',
    },
    segmentBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryForeground,
    },

    tabContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      ...typography.subtitle,
      color: colors.foreground,
    },
    sectionSubtitle: {
      ...typography.caption,
      color: colors.success,
      fontWeight: '600',
    },
    countBadge: {
      backgroundColor: colors.muted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
    },

    requestCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    requestCardMain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: spacing.md,
    },
    requestCardLeft: {
      flex: 1,
      marginRight: spacing.md,
    },
    requestAmount: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: 2,
    },
    requestDescription: {
      ...typography.body,
      color: colors.secondaryText,
      marginBottom: spacing.xs,
    },
    requestMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    requestMetaText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    requestMetaDot: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginHorizontal: spacing.xs,
    },
    requestCardActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    requestActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
    },
    requestActionText: {
      ...typography.button,
    },
    actionDivider: {
      width: 1,
      backgroundColor: colors.cardBorder,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },

    quickActionsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    quickActionCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      alignItems: 'center',
    },
    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    quickActionTitle: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.foreground,
      textAlign: 'center',
    },
    quickActionSubtitle: {
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: 'center',
    },

    emptyStateInline: {
      alignItems: 'center',
      paddingVertical: spacing['2xl'],
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
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
    emptySubtitle: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
    },

    dateGroupHeader: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    receiptCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    receiptIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colorWithOpacity(colors.success, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    receiptContent: {
      flex: 1,
    },
    receiptTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    receiptNumber: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    receiptAmount: {
      ...typography.bodySemibold,
      color: colors.success,
    },
    receiptBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    receiptMeta: {
      ...typography.caption,
      color: colors.mutedForeground,
    },

    pastRequestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    pastRequestLeft: {
      flex: 1,
      marginRight: spacing.md,
    },
    pastRequestAmount: {
      ...typography.body,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    pastRequestDescription: {
      ...typography.caption,
      color: colors.mutedForeground,
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
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    modalTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    modalScroll: {
      padding: spacing.lg,
      maxHeight: 400,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      paddingBottom: spacing['3xl'],
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    modalButtonSecondary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalButtonSecondaryText: {
      ...typography.button,
      color: colors.foreground,
    },
    modalButtonPrimary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
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
      ...typography.caption,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
      fontWeight: '600',
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
      fontWeight: '600',
    },
    amountInputField: {
      flex: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      ...typography.body,
      color: colors.foreground,
    },

    shareModalContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: '90%',
    },
    shareModalHeader: {
      alignItems: 'center',
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    shareModalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.md,
    },
    shareModalTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    shareModalClose: {
      position: 'absolute',
      right: spacing.lg,
      top: spacing.lg,
    },
    shareAmountBanner: {
      backgroundColor: colors.muted,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    shareAmountLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    shareAmountValue: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.foreground,
    },
    shareTabsContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    shareTabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    shareTabItemActive: {
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
      paddingBottom: spacing['3xl'],
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
    qrImage: {
      width: 180,
      height: 180,
    },
    qrLoading: {
      width: 180,
      height: 180,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    qrLoadingText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    qrFallback: {
      width: 180,
      height: 180,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    qrFallbackText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    qrHint: {
      ...typography.body,
      color: colors.mutedForeground,
      marginTop: spacing.lg,
    },
    copyLinkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    copyLinkButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },

    linkContainer: {
      alignItems: 'center',
    },
    linkBox: {
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: spacing.md,
      width: '100%',
    },
    linkText: {
      ...typography.caption,
      color: colors.foreground,
      fontFamily: isIOS ? 'Menlo' : 'monospace',
    },
    linkHint: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.md,
    },

    sendContainer: {
      gap: spacing.lg,
    },
    emailAppButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingVertical: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    emailAppButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.cardBorder,
    },
    dividerText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    sendInputGroup: {
      gap: spacing.sm,
    },
    sendInputLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
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
      paddingBottom: spacing['3xl'],
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
  });
};

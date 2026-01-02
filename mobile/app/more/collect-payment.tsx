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
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes, pageShell } from '../../src/lib/design-tokens';
import { api, API_URL } from '../../src/lib/api';
import { format, formatDistanceToNow } from 'date-fns';

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

export default function CollectPaymentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
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

  // KPI Stats Header
  const renderStatsHeader = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>OUTSTANDING</Text>
        <Text style={[styles.statValue, { color: colors.warning }]}>
          {formatCurrency(totalPendingAmount)}
        </Text>
        <Text style={styles.statSubtext}>{pendingRequests.length} pending</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>RECEIVED</Text>
        <Text style={[styles.statValue, { color: colors.success }]}>
          {formatCurrency(totalReceived)}
        </Text>
        <Text style={styles.statSubtext}>{receipts.length} receipts</Text>
      </View>
    </View>
  );

  // Professional Tab Bar
  const renderTabs = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabItem, activeTab === 'collect' && styles.tabItemActive]}
        onPress={() => setActiveTab('collect')}
        activeOpacity={0.7}
        data-testid="tab-collect"
      >
        <Feather 
          name="credit-card" 
          size={18} 
          color={activeTab === 'collect' ? colors.primary : colors.mutedForeground} 
        />
        <Text style={[styles.tabText, activeTab === 'collect' && styles.tabTextActive]}>
          Collect
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
        onPress={() => setActiveTab('history')}
        activeOpacity={0.7}
        data-testid="tab-history"
      >
        <Feather 
          name="clock" 
          size={18} 
          color={activeTab === 'history' ? colors.primary : colors.mutedForeground} 
        />
        <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
          History
        </Text>
        {(pendingRequests.length + receipts.length) > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{pendingRequests.length + receipts.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  // Payment Method Cards - Professional Grid Layout
  const renderCollectTab = () => (
    <View style={styles.tabContent}>
      {/* Stripe Connection Status */}
      {!stripeStatus?.connected && (
        <TouchableOpacity 
          style={styles.stripeCard}
          onPress={() => router.push('/more/money-hub')}
          activeOpacity={0.7}
          data-testid="button-connect-stripe"
        >
          <View style={styles.stripeIconContainer}>
            <Feather name="zap" size={24} color={colors.warning} />
          </View>
          <View style={styles.stripeContent}>
            <Text style={styles.stripeTitle}>Connect Stripe</Text>
            <Text style={styles.stripeSubtitle}>Accept card payments online</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      {/* Quick Actions - Clean Grid */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.7}
          data-testid="button-new-request"
        >
          <View style={[styles.actionIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
            <Feather name="link" size={24} color={colors.primary} />
          </View>
          <Text style={styles.actionTitle}>Payment Link</Text>
          <Text style={styles.actionSubtitle}>QR code or URL</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => setShowRecordPaymentModal(true)}
          activeOpacity={0.7}
          data-testid="button-record-payment"
        >
          <View style={[styles.actionIconContainer, { backgroundColor: colorWithOpacity(colors.success, 0.1) }]}>
            <Feather name="check-circle" size={24} color={colors.success} />
          </View>
          <Text style={styles.actionTitle}>Record Payment</Text>
          <Text style={styles.actionSubtitle}>Cash or transfer</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => setShowReceiptModal(true)}
          activeOpacity={0.7}
          data-testid="button-create-receipt"
        >
          <View style={[styles.actionIconContainer, { backgroundColor: colorWithOpacity(colors.warning, 0.1) }]}>
            <Feather name="file-text" size={24} color={colors.warning} />
          </View>
          <Text style={styles.actionTitle}>Issue Receipt</Text>
          <Text style={styles.actionSubtitle}>Generate PDF</Text>
        </TouchableOpacity>

        {stripeStatus?.connected && (
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => Alert.alert('Tap to Pay', 'Position phone near customer card to collect payment')}
            activeOpacity={0.7}
            data-testid="button-tap-to-pay"
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colorWithOpacity(colors.info || colors.primary, 0.1) }]}>
              <Feather name="smartphone" size={24} color={colors.info || colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Tap to Pay</Text>
            <Text style={styles.actionSubtitle}>Contactless</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Unpaid Invoices Quick List */}
      {unpaidInvoices.length > 0 && (
        <View style={styles.invoicesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Unpaid Invoices</Text>
            <TouchableOpacity 
              onPress={() => router.push('/more/documents')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {unpaidInvoices.slice(0, 3).map((invoice) => {
            const client = clientMap.get(invoice.clientId);
            return (
              <TouchableOpacity 
                key={invoice.id}
                style={styles.invoiceRow}
                onPress={() => {
                  setRecordInvoiceId(invoice.id);
                  setShowRecordPaymentModal(true);
                }}
                activeOpacity={0.7}
                data-testid={`invoice-row-${invoice.id}`}
              >
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceNumber}>{invoice.number}</Text>
                  <Text style={styles.invoiceClient} numberOfLines={1}>
                    {client?.name || 'Unknown client'}
                  </Text>
                </View>
                <View style={styles.invoiceRight}>
                  <Text style={styles.invoiceAmount}>{formatCurrency(invoice.total)}</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  // History Tab - Requests and Receipts
  const renderHistoryTab = () => (
    <View style={styles.tabContent}>
      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Active Requests</Text>
          {pendingRequests.map((request) => {
            const statusConfig = getStatusConfig(request.status);
            const clientName = request.clientId ? clientMap.get(request.clientId)?.name : null;
            return (
              <View key={request.id} style={styles.historyCard}>
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyAmount}>{formatCurrency(request.amount)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.historyDescription} numberOfLines={1}>
                  {request.description}
                </Text>
                <View style={styles.historyMeta}>
                  {clientName && (
                    <View style={styles.metaItem}>
                      <Feather name="user" size={12} color={colors.mutedForeground} />
                      <Text style={styles.metaText}>{clientName}</Text>
                    </View>
                  )}
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={12} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>
                      {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyActions}>
                  <TouchableOpacity 
                    style={styles.historyActionBtn}
                    onPress={() => {
                      setSelectedRequest(request);
                      setShowShareModal(true);
                    }}
                    activeOpacity={0.7}
                    data-testid={`button-share-${request.id}`}
                  >
                    <Feather name="share-2" size={16} color={colors.primary} />
                    <Text style={[styles.historyActionText, { color: colors.primary }]}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.historyActionBtn}
                    onPress={() => handleCancelRequest(request.id)}
                    activeOpacity={0.7}
                    data-testid={`button-cancel-${request.id}`}
                  >
                    <Feather name="x" size={16} color={colors.destructive} />
                    <Text style={[styles.historyActionText, { color: colors.destructive }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Receipts Section */}
      {receipts.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Recent Receipts</Text>
          {receipts.slice(0, 10).map((receipt) => {
            const clientName = receipt.clientId ? clientMap.get(receipt.clientId)?.name : null;
            return (
              <TouchableOpacity 
                key={receipt.id}
                style={styles.historyCard}
                onPress={() => router.push(`/more/receipt/${receipt.id}`)}
                activeOpacity={0.7}
                data-testid={`receipt-card-${receipt.id}`}
              >
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyAmount}>{formatCurrency(receipt.amount)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.success }]}>Paid</Text>
                  </View>
                </View>
                <Text style={styles.historyDescription}>{receipt.receiptNumber}</Text>
                <View style={styles.historyMeta}>
                  {clientName && (
                    <View style={styles.metaItem}>
                      <Feather name="user" size={12} color={colors.mutedForeground} />
                      <Text style={styles.metaText}>{clientName}</Text>
                    </View>
                  )}
                  {receipt.paidAt && (
                    <View style={styles.metaItem}>
                      <Feather name="check-circle" size={12} color={colors.success} />
                      <Text style={[styles.metaText, { color: colors.success }]}>
                        {format(new Date(receipt.paidAt), 'dd MMM yyyy')}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Completed Requests */}
      {completedRequests.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Past Requests</Text>
          {completedRequests.slice(0, 5).map((request) => {
            const statusConfig = getStatusConfig(request.status);
            return (
              <View key={request.id} style={[styles.historyCard, styles.historyCardFaded]}>
                <View style={styles.historyCardHeader}>
                  <Text style={[styles.historyAmount, { color: colors.mutedForeground }]}>
                    {formatCurrency(request.amount)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.historyDescription, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {request.description}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Empty State */}
      {pendingRequests.length === 0 && receipts.length === 0 && completedRequests.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="inbox" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No Payment History</Text>
          <Text style={styles.emptySubtitle}>
            Create a payment request or record a payment to get started.
          </Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => setActiveTab('collect')}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyButtonText}>Collect Payment</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Picker Modal Component
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

  // Create Payment Request Modal
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

  // Record Payment Modal
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

  // Create Receipt Modal
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

  // Share Payment Link Modal
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
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.pageTitle}>Collect Payment</Text>
              {totalPendingAmount > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{formatCurrency(totalPendingAmount)} pending</Text>
                </View>
              )}
            </View>
            {stripeStatus?.connected && (
              <View style={styles.stripeConnectedBadge}>
                <Feather name="check-circle" size={14} color={colors.success} />
                <Text style={styles.stripeConnectedText}>Stripe</Text>
              </View>
            )}
          </View>
          <Text style={styles.pageSubtitle}>Accept payments via QR code, link, or record manually</Text>
        </View>
        
        {/* KPI Stats */}
        {renderStatsHeader()}
        
        {/* Tab Bar */}
        {renderTabs()}
        
        {/* Tab Content */}
        {activeTab === 'collect' ? renderCollectTab() : renderHistoryTab()}
      </ScrollView>
      
      {/* Modals */}
      {renderCreateModal()}
      {renderRecordPaymentModal()}
      {renderReceiptModal()}
      {renderShareModal()}
      
      {/* Picker Modals */}
      {renderPickerModal(
        showInvoicePicker,
        () => setShowInvoicePicker(false),
        'Select Invoice',
        unpaidInvoices.map(inv => ({ 
          value: inv.id, 
          label: `${inv.number} - ${formatCurrency(inv.total)}` 
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
        showExpiryPicker,
        () => setShowExpiryPicker(false),
        'Link Expires In',
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
  const isIOS = Platform.OS === 'ios';
  
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
      gap: spacing.md,
    },
    loadingText: {
      ...typography.body,
      color: colors.mutedForeground,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: isIOS ? 60 : spacing.xl,
      paddingBottom: spacing['3xl'],
    },
    
    // Header
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    pageTitle: {
      ...typography.title,
      color: colors.foreground,
    },
    pageSubtitle: {
      ...typography.body,
      color: colors.mutedForeground,
    },
    pendingBadge: {
      backgroundColor: colorWithOpacity(colors.warning, 0.12),
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    pendingBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.warning,
    },
    stripeConnectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colorWithOpacity(colors.success, 0.12),
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    stripeConnectedText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
    },
    
    // Stats Cards
    statsContainer: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    statLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontWeight: '600',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 2,
    },
    statSubtext: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    
    // Tab Bar
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      padding: 4,
      marginBottom: spacing.lg,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    tabItemActive: {
      backgroundColor: colors.card,
      ...(isIOS ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      } : shadows.sm),
    },
    tabText: {
      ...typography.button,
      color: colors.mutedForeground,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    tabBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    tabBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    
    // Tab Content
    tabContent: {
      paddingHorizontal: spacing.lg,
    },
    
    // Stripe Card
    stripeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colorWithOpacity(colors.warning, 0.08),
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colorWithOpacity(colors.warning, 0.2),
    },
    stripeIconContainer: {
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      backgroundColor: colorWithOpacity(colors.warning, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    stripeContent: {
      flex: 1,
    },
    stripeTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
      marginBottom: 2,
    },
    stripeSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    
    // Section Headers
    sectionTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
      marginBottom: spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    viewAllText: {
      ...typography.button,
      color: colors.primary,
    },
    
    // Action Grid
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    actionCard: {
      width: '47%',
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    actionIconContainer: {
      width: 52,
      height: 52,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    actionTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
      textAlign: 'center',
      marginBottom: 2,
    },
    actionSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    
    // Invoices Section
    invoicesSection: {
      marginBottom: spacing.lg,
    },
    invoiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    invoiceInfo: {
      flex: 1,
    },
    invoiceNumber: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    invoiceClient: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    invoiceRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    invoiceAmount: {
      ...typography.bodySemibold,
      color: colors.primary,
    },
    
    // History Section
    historySection: {
      marginBottom: spacing.xl,
    },
    historyCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    historyCardFaded: {
      opacity: 0.7,
    },
    historyCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    historyAmount: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
    },
    historyDescription: {
      ...typography.body,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
    },
    historyMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    historyActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    historyActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    historyActionText: {
      ...typography.button,
      fontSize: 13,
    },
    
    // Status Badge
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    
    // Empty State
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
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
      marginBottom: spacing.xl,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
    },
    emptyButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    
    // Modal Styles
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
    
    // Form Styles
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
    
    // Share Modal
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
    
    // QR Code
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
    
    // Link Tab
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
    
    // Send Tab
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
    
    // Picker Modal
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

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

type TabType = 'requests' | 'record' | 'receipts';

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
  
  const [activeTab, setActiveTab] = useState<TabType>('requests');
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

  const tabs: { key: TabType; label: string; icon: keyof typeof Feather.glyphMap; count?: number }[] = [
    { key: 'requests', label: 'Requests', icon: 'credit-card', count: pendingRequests.length },
    { key: 'record', label: 'Record', icon: 'dollar-sign' },
    { key: 'receipts', label: 'Receipts', icon: 'file-text', count: receipts.length },
  ];

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>Collect Payment</Text>
        {totalPendingAmount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{formatCurrency(totalPendingAmount)} pending</Text>
          </View>
        )}
      </View>
      
      {!stripeStatus?.connected && (
        <TouchableOpacity 
          style={styles.stripeWarning}
          onPress={() => router.push('/more/money-hub')}
          activeOpacity={0.7}
        >
          <View style={styles.stripeWarningIcon}>
            <Feather name="alert-circle" size={iconSizes.md} color={colors.warning} />
          </View>
          <View style={styles.stripeWarningContent}>
            <Text style={styles.stripeWarningTitle}>Connect Stripe</Text>
            <Text style={styles.stripeWarningText}>Accept card payments online</Text>
          </View>
          <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => setActiveTab(tab.key)}
          activeOpacity={0.7}
        >
          <Feather 
            name={tab.icon} 
            size={iconSizes.md} 
            color={activeTab === tab.key ? colors.primary : colors.mutedForeground} 
          />
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
            {tab.label}
          </Text>
          {tab.count !== undefined && tab.count > 0 && (
            <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                {tab.count}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderRequestCard = (request: PaymentRequest) => {
    const statusConfig = getStatusConfig(request.status);
    const clientName = request.clientId ? clientMap.get(request.clientId)?.name : null;
    const isPending = request.status === 'pending';

    return (
      <View key={request.id} style={[styles.card, !isPending && styles.cardFaded]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardAmount}>{formatCurrency(request.amount)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>
        
        <Text style={styles.cardDescription} numberOfLines={2}>{request.description}</Text>
        
        {clientName && (
          <View style={styles.cardMeta}>
            <Feather name="user" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText}>{clientName}</Text>
          </View>
        )}
        
        <View style={styles.cardMeta}>
          <Feather name="clock" size={iconSizes.sm} color={colors.mutedForeground} />
          <Text style={styles.cardMetaText}>
            {request.paidAt 
              ? `Paid ${format(new Date(request.paidAt), 'dd MMM yyyy')}`
              : formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })
            }
          </Text>
        </View>
        
        {isPending && (
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={styles.cardActionPrimary}
              onPress={() => {
                setSelectedRequest(request);
                setShowShareModal(true);
              }}
              activeOpacity={0.7}
            >
              <Feather name="share-2" size={iconSizes.md} color={colors.primaryForeground} />
              <Text style={styles.cardActionPrimaryText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cardActionSecondary}
              onPress={() => handleCancelRequest(request.id)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={iconSizes.md} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderReceiptCard = (receipt: Receipt) => {
    const clientName = receipt.clientId ? clientMap.get(receipt.clientId)?.name : null;

    return (
      <TouchableOpacity 
        key={receipt.id} 
        style={styles.card}
        onPress={() => router.push(`/more/receipt/${receipt.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardAmount}>{formatCurrency(receipt.amount)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
              <Text style={[styles.statusBadgeText, { color: colors.success }]}>Paid</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.cardIconButton}
            onPress={(e) => {
              e.stopPropagation();
              handlePrintReceipt(receipt.id);
            }}
            activeOpacity={0.7}
          >
            <Feather name="printer" size={iconSizes.md} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.cardDescription}>{receipt.receiptNumber}</Text>
        
        {clientName && (
          <View style={styles.cardMeta}>
            <Feather name="user" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText}>{clientName}</Text>
          </View>
        )}
        
        {receipt.paidAt && (
          <View style={styles.cardMeta}>
            <Feather name="check-circle" size={iconSizes.sm} color={colors.success} />
            <Text style={[styles.cardMetaText, { color: colors.success }]}>
              {format(new Date(receipt.paidAt), 'dd MMM yyyy, h:mm a')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (type: 'requests' | 'receipts') => {
    const config = {
      requests: {
        icon: 'credit-card' as const,
        title: 'No Payment Requests',
        description: 'Create a payment request to collect payments via QR code or link.',
        action: () => setShowCreateModal(true),
        actionLabel: 'Create Request',
      },
      receipts: {
        icon: 'file-text' as const,
        title: 'No Receipts Yet',
        description: 'Generate receipts when you receive payments.',
        action: () => setShowReceiptModal(true),
        actionLabel: 'Create Receipt',
      },
    };
    const { icon, title, description, action, actionLabel } = config[type];

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateIcon}>
          <Feather name={icon} size={sizes.emptyIcon} color={colors.mutedForeground} />
        </View>
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateDescription}>{description}</Text>
        <TouchableOpacity style={styles.emptyStateButton} onPress={action} activeOpacity={0.7}>
          <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
          <Text style={styles.emptyStateButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRequestsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Payment Requests</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
          <Text style={styles.addButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {pendingRequests.length === 0 && completedRequests.length === 0 ? (
        renderEmptyState('requests')
      ) : (
        <>
          {pendingRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionSubtitle}>Active ({pendingRequests.length})</Text>
              {pendingRequests.map(renderRequestCard)}
            </View>
          )}
          
          {completedRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionSubtitle}>History</Text>
              {completedRequests.slice(0, 5).map(renderRequestCard)}
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderRecordTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.actionCard}>
        <View style={styles.actionCardIcon}>
          <Feather name="dollar-sign" size={iconSizes.xl} color={colors.primary} />
        </View>
        <Text style={styles.actionCardTitle}>Record Manual Payment</Text>
        <Text style={styles.actionCardDescription}>
          Record cash, bank transfer, or other offline payments against an invoice.
        </Text>
        <TouchableOpacity 
          style={styles.actionCardButton}
          onPress={() => setShowRecordPaymentModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus-circle" size={iconSizes.md} color={colors.primaryForeground} />
          <Text style={styles.actionCardButtonText}>Record Payment</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionCard}>
        <View style={[styles.actionCardIcon, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
          <Feather name="file-text" size={iconSizes.xl} color={colors.success} />
        </View>
        <Text style={styles.actionCardTitle}>Generate Receipt</Text>
        <Text style={styles.actionCardDescription}>
          Create a receipt for any payment received to share with your customer.
        </Text>
        <TouchableOpacity 
          style={[styles.actionCardButton, { backgroundColor: colors.success }]}
          onPress={() => setShowReceiptModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="file-plus" size={iconSizes.md} color={colors.white} />
          <Text style={styles.actionCardButtonText}>Create Receipt</Text>
        </TouchableOpacity>
      </View>

      {unpaidInvoices.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Unpaid Invoices ({unpaidInvoices.length})</Text>
          {unpaidInvoices.slice(0, 3).map((invoice) => (
            <TouchableOpacity 
              key={invoice.id}
              style={styles.invoiceCard}
              onPress={() => {
                setRecordInvoiceId(invoice.id);
                setShowRecordPaymentModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.invoiceCardContent}>
                <Text style={styles.invoiceNumber}>{invoice.number}</Text>
                <Text style={styles.invoiceTitle} numberOfLines={1}>{invoice.title}</Text>
              </View>
              <View style={styles.invoiceCardRight}>
                <Text style={styles.invoiceAmount}>{formatCurrency(invoice.total)}</Text>
                <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderReceiptsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Receipts</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowReceiptModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
          <Text style={styles.addButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {receipts.length === 0 ? (
        renderEmptyState('receipts')
      ) : (
        <View style={styles.section}>
          {receipts.map(renderReceiptCard)}
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
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={iconSizes.xl} color={colors.foreground} />
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
              <View style={styles.modalIcon}>
                <Feather name="credit-card" size={iconSizes.lg} color={colors.primary} />
              </View>
              <Text style={styles.modalTitle}>New Payment Request</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowCreateModal(false); resetCreateForm(); }}>
              <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
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
            <View style={styles.modalTitleRow}>
              <View style={styles.modalIcon}>
                <Feather name="dollar-sign" size={iconSizes.lg} color={colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Record Payment</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowRecordPaymentModal(false); resetRecordForm(); }}>
              <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
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
              <Text style={styles.formLabel}>Reference (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Bank transfer ref"
                placeholderTextColor={colors.mutedForeground}
                value={recordReference}
                onChangeText={setRecordReference}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Any additional notes"
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
            <View style={styles.modalTitleRow}>
              <View style={[styles.modalIcon, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
                <Feather name="file-text" size={iconSizes.lg} color={colors.success} />
              </View>
              <Text style={styles.modalTitle}>Generate Receipt</Text>
            </View>
            <TouchableOpacity onPress={() => { setShowReceiptModal(false); resetReceiptForm(); }}>
              <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
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
            
            {clients.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Client (optional)</Text>
                <TouchableOpacity 
                  style={styles.formSelect}
                  onPress={() => { setPickerContext('receipt'); setShowClientPicker(true); }}
                >
                  <Text style={[styles.formSelectText, !receiptClientId && styles.formSelectPlaceholder]}>
                    {receiptClientId ? clientMap.get(receiptClientId)?.name : 'Select a client'}
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
              style={[styles.modalButtonPrimary, { backgroundColor: colors.success }, (isSubmitting || !receiptAmount) && styles.modalButtonDisabled]}
              onPress={handleCreateReceipt}
              disabled={isSubmitting || !receiptAmount}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>Generate Receipt</Text>
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
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={styles.modalIcon}>
                <Feather name="share-2" size={iconSizes.lg} color={colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Share Request</Text>
            </View>
            <TouchableOpacity onPress={() => setShowShareModal(false)}>
              <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          {selectedRequest && (
            <View style={styles.shareAmountBanner}>
              <Text style={styles.shareAmountLabel}>Amount</Text>
              <Text style={styles.shareAmountValue}>{formatCurrency(selectedRequest.amount)}</Text>
            </View>
          )}
          
          <View style={styles.shareTabContainer}>
            {[
              { key: 'qr', label: 'QR Code', icon: 'maximize-2' },
              { key: 'link', label: 'Link', icon: 'link-2' },
              { key: 'send', label: 'Send', icon: 'send' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.shareTabItem, shareTab === tab.key && styles.shareTabItemActive]}
                onPress={() => setShareTab(tab.key as 'qr' | 'link' | 'send')}
              >
                <Feather 
                  name={tab.icon as any} 
                  size={iconSizes.md} 
                  color={shareTab === tab.key ? colors.primary : colors.mutedForeground} 
                />
                <Text style={[styles.shareTabText, shareTab === tab.key && styles.shareTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {selectedRequest && (
            <View style={styles.shareContent}>
              {shareTab === 'qr' && (
                <View style={styles.qrContainer}>
                  <View style={styles.qrWrapper}>
                    {qrLoading ? (
                      <View style={styles.qrLoading}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.qrLoadingText}>Generating...</Text>
                      </View>
                    ) : qrCodeDataUrl ? (
                      <Image 
                        source={{ uri: qrCodeDataUrl }} 
                        style={styles.qrImage} 
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.qrFallback}>
                        <Feather name="maximize-2" size={64} color={colors.primary} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.qrHint}>Customer scans to pay</Text>
                  <TouchableOpacity style={styles.copyLinkButton} onPress={handleCopyLink}>
                    <Feather name={copied ? 'check' : 'copy'} size={iconSizes.md} color={colors.primaryForeground} />
                    <Text style={styles.copyLinkButtonText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {shareTab === 'link' && (
                <View style={styles.linkContainer}>
                  <View style={styles.linkBox}>
                    <Text style={styles.linkText} numberOfLines={2}>{getPaymentUrl(selectedRequest)}</Text>
                  </View>
                  <TouchableOpacity style={styles.copyLinkButton} onPress={handleCopyLink}>
                    <Feather name={copied ? 'check' : 'copy'} size={iconSizes.md} color={colors.primaryForeground} />
                    <Text style={styles.copyLinkButtonText}>{copied ? 'Copied!' : 'Copy to Clipboard'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.linkHint}>Share this link via any messaging app</Text>
                </View>
              )}
              
              {shareTab === 'send' && (
                <View style={styles.sendContainer}>
                  <TouchableOpacity style={styles.emailAppButton} onPress={handleComposeEmail}>
                    <Feather name="mail" size={iconSizes.lg} color={colors.primaryForeground} />
                    <Text style={styles.emailAppButtonText}>Open Email App</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or send directly</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  
                  <View style={styles.sendInputGroup}>
                    <Text style={styles.sendInputLabel}>Email</Text>
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
                        <Text style={styles.sendButtonText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.sendInputGroup}>
                    <Text style={styles.sendInputLabel}>SMS</Text>
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
                        <Text style={styles.sendButtonText}>Send</Text>
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

  const handleInvoiceSelect = (value: string) => {
    if (pickerContext === 'create') setSelectedInvoiceId(value);
    else if (pickerContext === 'record') setRecordInvoiceId(value);
    else setReceiptInvoiceId(value);
  };

  const handleClientSelect = (value: string) => {
    if (pickerContext === 'create') setSelectedClientId(value);
    else setReceiptClientId(value);
  };

  const handleMethodSelect = (value: string) => {
    if (pickerContext === 'record') setRecordPaymentMethod(value);
    else setReceiptPaymentMethod(value);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Collect Payment', headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Collect Payment', headerShown: false }} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderTabs()}
        
        {activeTab === 'requests' && renderRequestsTab()}
        {activeTab === 'record' && renderRecordTab()}
        {activeTab === 'receipts' && renderReceiptsTab()}
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
        pickerContext === 'create' ? selectedInvoiceId : pickerContext === 'record' ? recordInvoiceId : receiptInvoiceId,
        handleInvoiceSelect,
        true
      )}
      {renderPickerModal(
        showClientPicker,
        () => setShowClientPicker(false),
        'Select Client',
        getClientOptions(),
        pickerContext === 'create' ? selectedClientId : receiptClientId,
        handleClientSelect,
        true
      )}
      {renderPickerModal(
        showMethodPicker,
        () => setShowMethodPicker(false),
        'Payment Method',
        paymentMethods,
        pickerContext === 'record' ? recordPaymentMethod : receiptPaymentMethod,
        handleMethodSelect
      )}
      {renderPickerModal(
        showExpiryPicker,
        () => setShowExpiryPicker(false),
        'Link Expires In',
        expiryOptions,
        expiresInHours,
        setExpiresInHours
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: pageShell.paddingHorizontal,
      paddingTop: pageShell.paddingTop,
      paddingBottom: 100,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    header: {
      marginBottom: spacing.lg,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    headerTitle: {
      ...typography.sectionTitle,
      color: colors.foreground,
    },
    headerBadge: {
      backgroundColor: colorWithOpacity(colors.warning, 0.12),
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    headerBadgeText: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.warning,
    },
    
    stripeWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colorWithOpacity(colors.warning, 0.08),
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colorWithOpacity(colors.warning, 0.2),
    },
    stripeWarningIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colorWithOpacity(colors.warning, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    stripeWarningContent: {
      flex: 1,
    },
    stripeWarningTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    stripeWarningText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      padding: spacing.xs,
      marginBottom: spacing.lg,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    tabActive: {
      backgroundColor: colors.card,
      ...shadows.sm,
    },
    tabText: {
      ...typography.button,
      color: colors.mutedForeground,
    },
    tabTextActive: {
      color: colors.primary,
    },
    tabBadge: {
      backgroundColor: colors.muted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
      minWidth: 20,
      alignItems: 'center',
    },
    tabBadgeActive: {
      backgroundColor: colorWithOpacity(colors.primary, 0.12),
    },
    tabBadgeText: {
      ...typography.badge,
      color: colors.mutedForeground,
    },
    tabBadgeTextActive: {
      color: colors.primary,
    },
    
    tabContent: {
      flex: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    sectionSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    section: {
      marginBottom: spacing.lg,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    addButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    cardFaded: {
      opacity: 0.7,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    cardAmount: {
      ...typography.headline,
      color: colors.foreground,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    statusBadgeText: {
      ...typography.badge,
    },
    cardDescription: {
      ...typography.body,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    cardMetaText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    cardActionPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    cardActionPrimaryText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    cardActionSecondary: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    cardIconButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.muted,
    },
    
    actionCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    actionCardIcon: {
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: colorWithOpacity(colors.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    actionCardTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    actionCardDescription: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    actionCardButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
    },
    actionCardButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    
    invoiceCard: {
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
    invoiceCardContent: {
      flex: 1,
    },
    invoiceNumber: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    invoiceTitle: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    invoiceCardRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    invoiceAmount: {
      ...typography.bodySemibold,
      color: colors.primary,
    },
    
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    emptyStateIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    emptyStateTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    emptyStateDescription: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    emptyStateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
    },
    emptyStateButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
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
    shareModalContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: '90%',
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
      gap: spacing.md,
    },
    modalIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colorWithOpacity(colors.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      paddingBottom: spacing['3xl'],
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
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
    },
    amountInputField: {
      flex: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      ...typography.body,
      color: colors.foreground,
    },
    
    shareAmountBanner: {
      backgroundColor: colors.muted,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    shareAmountLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    shareAmountValue: {
      ...typography.headline,
      color: colors.foreground,
    },
    shareTabContainer: {
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
    qrFallback: {
      width: 180,
      height: 180,
      alignItems: 'center',
      justifyContent: 'center',
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
    qrHint: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
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
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
}

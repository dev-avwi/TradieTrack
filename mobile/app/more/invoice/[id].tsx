import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
  Modal,
  Share,
  Linking,
} from 'react-native';
// Note: expo-clipboard requires a native build - using Share API as fallback for Expo Go
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useInvoicesStore, useClientsStore, useAuthStore, useQuotesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { spacing, radius } from '../../../src/lib/design-tokens';
import LiveDocumentPreview from '../../../src/components/LiveDocumentPreview';
import { EmailComposeModal } from '../../../src/components/EmailComposeModal';
import { API_URL, api } from '../../../src/lib/api';

interface Signature {
  id: string;
  signatureData: string;
  signerName?: string;
  signedAt?: string;
  documentType?: string;
  signerRole?: string;
}

const TEMPLATE_OPTIONS = [
  { id: 'professional', name: 'Professional', description: 'Clean, minimal design' },
  { id: 'modern', name: 'Modern', description: 'Contemporary with accent colors' },
  { id: 'classic', name: 'Classic', description: 'Traditional business style' },
  { id: 'bold', name: 'Bold', description: 'Strong branding focus' },
];

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getInvoice, updateInvoiceStatus, fetchInvoices } = useInvoicesStore();
  const { getQuote } = useQuotesStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, businessSettings } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const STATUS_CONFIG = useMemo(() => ({
    draft: { label: 'Draft', color: colors.warning, bg: colors.warningLight },
    sent: { label: 'Sent', color: colors.info, bg: colors.infoLight },
    paid: { label: 'Paid', color: colors.success, bg: colors.successLight },
    overdue: { label: 'Overdue', color: colors.destructive, bg: colors.destructiveLight },
    cancelled: { label: 'Cancelled', color: colors.mutedForeground, bg: colors.cardHover },
  }), [colors]);
  const [invoice, setInvoice] = useState<any>(null);
  const [linkedQuote, setLinkedQuote] = useState<any>(null);
  const [allSignatures, setAllSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [isTogglingPayment, setIsTogglingPayment] = useState(false);
  const [isGeneratingPaymentLink, setIsGeneratingPaymentLink] = useState(false);
  const [isRecordingOnSitePayment, setIsRecordingOnSitePayment] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(businessSettings?.documentTemplate || 'professional');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  
  const brandColor = businessSettings?.brandColor || user?.brandColor || '#2563eb';

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    const authToken = await api.getToken();
    const invoiceData = await getInvoice(id!);
    setInvoice(invoiceData);
    await fetchClients();
    
    const signatures: Signature[] = [];
    
    // Fetch linked quote if exists
    if (invoiceData?.quoteId) {
      const quoteData = await getQuote(invoiceData.quoteId);
      setLinkedQuote(quoteData);
      
      // Fetch quote signature
      try {
        const response = await fetch(`${API_URL}/api/digital-signatures?documentType=quote&documentId=${invoiceData.quoteId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
          const quoteSignatures = await response.json();
          quoteSignatures.forEach((sig: any) => {
            signatures.push({ ...sig, documentType: 'quote' });
          });
        }
      } catch (err) {
        console.log('Could not fetch quote signature:', err);
      }
    }
    
    // Fetch job signatures if invoice has jobId
    if (invoiceData?.jobId) {
      try {
        const response = await fetch(`${API_URL}/api/jobs/${invoiceData.jobId}/signatures`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
          const jobSignatures = await response.json();
          jobSignatures.forEach((sig: any) => {
            signatures.push({ 
              ...sig, 
              documentType: sig.documentType || 'job_completion' 
            });
          });
        }
      } catch (err) {
        console.log('Could not fetch job signatures:', err);
      }
    }
    
    // Fetch invoice-specific signatures
    try {
      const response = await fetch(`${API_URL}/api/digital-signatures?documentType=invoice&documentId=${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const invoiceSignatures = await response.json();
        invoiceSignatures.forEach((sig: any) => {
          signatures.push({ ...sig, documentType: 'invoice' });
        });
      }
    } catch (err) {
      console.log('Could not fetch invoice signatures:', err);
    }
    
    setAllSignatures(signatures);
    setIsLoading(false);
  };

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const formatCurrency = (amount: number) => {
    // Database stores dollars, not cents - no division needed
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(Number(amount) || 0);
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
    Alert.alert(
      'Send Invoice',
      'How would you like to send this invoice?',
      [
        {
          text: 'Open Email App',
          onPress: () => handleSendViaEmailApp(),
        },
        {
          text: 'Use TradieTrack',
          onPress: () => setShowEmailCompose(true),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  const handleSendViaEmailApp = async () => {
    if (!invoice) return;
    const client = getClient(invoice.clientId);
    
    if (!client?.email) {
      Alert.alert('No Email', 'This client doesn\'t have an email address on file.');
      return;
    }
    
    const invoiceNumber = invoice.invoiceNumber || invoice.id?.slice(0, 8);
    const total = formatCurrency(invoice.total);
    const subject = `Invoice ${invoiceNumber} - ${total}`;
    const paymentUrl = invoice.stripePaymentLink 
      || `${API_URL.replace('/api', '')}/invoices/${invoice.id}/pay`;
    
    const body = `G'day ${client.name || 'there'},\n\nPlease find your invoice for ${invoice.title || 'the completed work'}.\n\nTotal: ${total}\nDue: ${formatDate(invoice.dueDate)}\n\nPay online here:\n${paymentUrl}\n\nThanks for your business!\n\nCheers`;
    
    const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        Alert.alert(
          'Email App Opened',
          'Your email app has the invoice details ready. After you send it, would you like to mark this invoice as sent?',
          [
            { text: 'Not Yet', style: 'cancel' },
            { 
              text: 'Mark as Sent', 
              onPress: async () => {
                await updateInvoiceStatus(id!, 'sent');
                await loadData();
              }
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Unable to open email app. Please check your email settings.');
      }
    } catch (error) {
      console.log('Error opening email:', error);
      Alert.alert('Error', 'Failed to open email app.');
    }
  };

  const handleEmailSend = async (subject: string, message: string) => {
    const authToken = await api.getToken();
    let emailSent = false;
    let apiError = false;
    
    try {
      const response = await fetch(`${API_URL}/api/invoices/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          subject,
          message,
        }),
      });

      if (response.ok) {
        emailSent = true;
      } else {
        apiError = true;
      }
    } catch (networkError) {
      console.log('Network error sending invoice:', networkError);
      apiError = true;
    }

    if (emailSent) {
      await loadData();
      setShowEmailCompose(false);
      Alert.alert('Success', 'Invoice sent successfully to the client');
      return;
    }

    if (apiError) {
      const statusSuccess = await updateInvoiceStatus(id!, 'sent');
      if (statusSuccess) {
        await loadData();
        setShowEmailCompose(false);
        Alert.alert('Invoice Updated', 'Invoice marked as sent. Email delivery may be delayed due to network issues.');
        return;
      }
    }

    throw new Error('Unable to send invoice. Please check your connection and try again.');
  };

  const toggleOnlinePayment = async () => {
    if (!invoice || isTogglingPayment) return;
    
    const authToken = await api.getToken();
    const previousValue = invoice.allowOnlinePayment;
    const newValue = !previousValue;
    
    setInvoice(prev => prev ? { ...prev, allowOnlinePayment: newValue } : prev);
    setIsTogglingPayment(true);
    
    try {
      const response = await fetch(`${API_URL}/api/invoices/${id}/toggle-online-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          allowOnlinePayment: newValue,
        }),
      });

      if (response.ok) {
        await loadData();
        Alert.alert(
          'Success',
          newValue 
            ? 'Online payment enabled - clients can pay with card' 
            : 'Online payment disabled for this invoice'
        );
      } else {
        setInvoice(prev => prev ? { ...prev, allowOnlinePayment: previousValue } : prev);
        Alert.alert('Error', 'Failed to update payment settings');
      }
    } catch (error) {
      setInvoice(prev => prev ? { ...prev, allowOnlinePayment: previousValue } : prev);
      Alert.alert('Error', 'Failed to update payment settings');
    } finally {
      setIsTogglingPayment(false);
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
            const success = await updateInvoiceStatus(id!, 'paid');
            if (success) {
              await loadData();
              Alert.alert('Success', 'Invoice marked as paid');
            }
          }
        }
      ]
    );
  };

  const handleRecordOnSitePayment = async () => {
    if (!invoice || isRecordingOnSitePayment) return;
    
    Alert.alert(
      'Record On-Site Payment',
      `Record payment of ${formatCurrency(invoice.total)} received on-site from the client?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Record Payment',
          onPress: async () => {
            setIsRecordingOnSitePayment(true);
            try {
              const authToken = await api.getToken();
              const response = await fetch(`${API_URL}/api/invoices/${id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  status: 'paid',
                  paidAt: new Date().toISOString(),
                  amountPaid: invoice.total.toString(),
                  paymentMethod: 'on_site',
                }),
              });

              if (response.ok) {
                await loadData();
                Alert.alert('Payment Recorded', 'On-site payment has been recorded successfully');
              } else {
                const error = await response.json();
                Alert.alert('Error', error.error || 'Failed to record payment');
              }
            } catch (error) {
              console.log('Error recording on-site payment:', error);
              Alert.alert('Error', 'Failed to record payment. Please try again.');
            } finally {
              setIsRecordingOnSitePayment(false);
            }
          }
        }
      ]
    );
  };

  const generatePaymentLink = async () => {
    if (!invoice || isGeneratingPaymentLink) return;
    
    const authToken = await api.getToken();
    setIsGeneratingPaymentLink(true);
    try {
      const response = await fetch(`${API_URL}/api/invoices/${id}/generate-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        await loadData();
        Alert.alert('Success', 'Payment link generated successfully');
        return data.paymentUrl;
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to generate payment link');
      }
    } catch (error) {
      console.log('Error generating payment link:', error);
      Alert.alert('Error', 'Failed to generate payment link. Please try again.');
    } finally {
      setIsGeneratingPaymentLink(false);
    }
    return null;
  };

  const getPaymentLinkUrl = () => {
    // Prefer Stripe payment link, fall back to internal payment page
    if (invoice?.stripePaymentLink) {
      return invoice.stripePaymentLink;
    }
    if (invoice?.paymentToken) {
      const baseUrl = API_URL.replace(/\/api.*$/, '');
      return `${baseUrl}/pay/${invoice.paymentToken}`;
    }
    return null;
  };

  const sharePaymentLink = async () => {
    const paymentUrl = getPaymentLinkUrl();
    if (!paymentUrl) {
      Alert.alert('Error', 'No payment link available. Please generate one first.');
      return;
    }
    
    try {
      await Share.share({
        message: `Pay Invoice ${invoice.invoiceNumber}: ${paymentUrl}`,
        url: paymentUrl,
        title: `Invoice ${invoice.invoiceNumber} Payment Link`,
      });
    } catch (error) {
      console.log('Error sharing payment link:', error);
      Alert.alert('Error', 'Failed to share link');
    }
  };

  const copyPaymentLinkToClipboard = async () => {
    const paymentUrl = getPaymentLinkUrl();
    if (!paymentUrl) {
      Alert.alert('Error', 'No payment link available. Please generate one first.');
      return;
    }
    
    try {
      await Share.share({
        message: paymentUrl,
        title: 'Payment Link',
      });
    } catch (error) {
      Alert.alert('Share Payment Link', paymentUrl);
    }
  };

  const handleCollectPayment = () => {
    router.push(`/(tabs)/collect?invoiceId=${id}`);
  };

  const downloadPdfToCache = useCallback(async (): Promise<string | null> => {
    if (!invoice) return null;
    
    try {
      const authToken = await api.getToken();
      const fileUri = `${FileSystem.cacheDirectory}${invoice.invoiceNumber || 'invoice'}.pdf`;
      
      const downloadResult = await FileSystem.downloadAsync(
        `${API_URL}/api/invoices/${id}/pdf`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (downloadResult.status !== 200) {
        throw new Error('Failed to download PDF');
      }

      return downloadResult.uri;
    } catch (error) {
      console.log('PDF download error:', error);
      throw error;
    }
  }, [invoice, id]);

  const handleDownloadPdf = async () => {
    if (!invoice || isDownloadingPdf) return;
    
    setIsDownloadingPdf(true);
    try {
      const uri = await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }
      setPdfUri(uri);
      setShowShareSheet(true);
    } catch (error) {
      console.log('PDF download error:', error);
      Alert.alert('Error', 'Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    setShowShareSheet(false);
    
    try {
      const uri = pdfUri || await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${invoice?.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device. Try saving to device instead.');
      }
    } catch (error) {
      console.log('Share PDF error:', error);
      Alert.alert('Error', 'Failed to share PDF. Please try again.');
    }
  };

  const handleSaveToDevice = async () => {
    setShowShareSheet(false);
    setIsDownloadingPdf(true);
    
    try {
      const uri = pdfUri || await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }

      // Use native share sheet which includes "Save to Files" on iOS and "Save to Downloads" on Android
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save Invoice ${invoice?.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback: Copy to document directory
        const fileName = `${invoice?.invoiceNumber || 'invoice'}.pdf`;
        const destUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: destUri });
        Alert.alert('Saved', `PDF saved to app documents: ${fileName}`);
      }
    } catch (error) {
      console.log('Save to device error:', error);
      Alert.alert('Error', 'Failed to save PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleEmailInvoice = () => {
    setShowShareSheet(false);
    setShowEmailCompose(true);
  };

  const handleCopyPaymentLink = async () => {
    const paymentUrl = getPaymentLinkUrl();
    if (!paymentUrl) {
      Alert.alert('No Payment Link', 'Generate a payment link first to share it.');
      return;
    }
    
    setShowShareSheet(false);
    try {
      await Share.share({
        message: paymentUrl,
        title: 'Payment Link',
      });
    } catch (error) {
      Alert.alert('Share Payment Link', paymentUrl);
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
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={handleDownloadPdf}
              disabled={isDownloadingPdf}
            >
              {isDownloadingPdf ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="download" size={20} color={colors.primary} />
              )}
              <Text style={styles.quickActionText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => setShowTemplateSelector(true)}
            >
              <Feather name="layout" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Template</Text>
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

          {/* Recurring Invoice Section */}
          {invoice.isRecurring && (
            <>
              <Text style={styles.sectionTitle}>Recurring Schedule</Text>
              <View style={[styles.card, styles.recurringCard]}>
                <View style={styles.recurringHeader}>
                  <View style={styles.recurringBadge}>
                    <Feather name="repeat" size={14} color={colors.info} />
                    <Text style={styles.recurringBadgeText}>
                      {invoice.recurrencePattern === 'fortnightly' ? 'Fortnightly' : 
                       invoice.recurrencePattern?.charAt(0).toUpperCase() + invoice.recurrencePattern?.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.recurringActiveText}>Active</Text>
                </View>
                
                <View style={styles.recurringDetails}>
                  <View style={styles.recurringDetailRow}>
                    <Feather name="calendar" size={16} color={colors.mutedForeground} />
                    <View style={styles.recurringDetailContent}>
                      <Text style={styles.recurringDetailLabel}>Next Invoice</Text>
                      <Text style={styles.recurringDetailValue}>
                        {invoice.nextRecurrenceDate 
                          ? formatDate(invoice.nextRecurrenceDate)
                          : 'Not scheduled'}
                      </Text>
                    </View>
                  </View>
                  
                  {invoice.recurrenceEndDate && (
                    <View style={styles.recurringDetailRow}>
                      <Feather name="flag" size={16} color={colors.mutedForeground} />
                      <View style={styles.recurringDetailContent}>
                        <Text style={styles.recurringDetailLabel}>End Date</Text>
                        <Text style={styles.recurringDetailValue}>
                          {formatDate(invoice.recurrenceEndDate)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.recurringActions}>
                  <TouchableOpacity 
                    style={styles.recurringEditButton}
                    onPress={() => {
                      Alert.alert(
                        'Edit Schedule',
                        'To change the schedule, stop this recurring invoice and create a new one with your preferred settings.',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Feather name="edit-2" size={16} color={colors.primary} />
                    <Text style={styles.recurringEditButtonText}>Edit Schedule</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.recurringStopButton}
                    onPress={() => {
                      Alert.alert(
                        'Stop Recurring',
                        'Are you sure you want to stop this recurring invoice? No more invoices will be automatically generated.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Stop', 
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await api.patch(`/api/invoices/${invoice.id}`, {
                                  isRecurring: false,
                                  nextRecurrenceDate: null,
                                });
                                await fetchInvoices();
                                Alert.alert('Success', 'Recurring schedule has been stopped.');
                              } catch (error) {
                                Alert.alert('Error', 'Failed to stop recurring invoice.');
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Feather name="x-circle" size={16} color={colors.destructive} />
                    <Text style={styles.recurringStopButtonText}>Stop Recurring</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

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

          {/* Payment Options - Only show if not paid */}
          {invoice.status !== 'paid' && (
            <>
              <Text style={styles.sectionTitle}>Payment Options</Text>
              <View style={styles.card}>
                {/* Record On-Site Payment Button */}
                <TouchableOpacity 
                  style={styles.onSitePaymentButton}
                  onPress={handleRecordOnSitePayment}
                  disabled={isRecordingOnSitePayment}
                >
                  {isRecordingOnSitePayment ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Feather name="dollar-sign" size={20} color={colors.white} />
                  )}
                  <Text style={styles.onSitePaymentButtonText}>
                    Record On-Site Payment
                  </Text>
                </TouchableOpacity>
                <Text style={styles.onSitePaymentHint}>
                  Use when client pays cash, check, or direct transfer on-site
                </Text>
                
                <View style={styles.paymentDivider} />

                {/* Online Payment Toggle */}
                <View style={styles.paymentToggleRow}>
                  <View style={styles.paymentToggleInfo}>
                    <Feather name="credit-card" size={20} color={colors.primary} />
                    <View style={styles.paymentToggleText}>
                      <Text style={styles.paymentToggleTitle}>Accept Online Payments</Text>
                      <Text style={styles.paymentToggleDesc}>
                        Allow clients to pay with card, Apple Pay, or Google Pay
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={invoice.allowOnlinePayment || false}
                    onValueChange={async () => {
                      const newValue = !invoice.allowOnlinePayment;
                      await toggleOnlinePayment();
                      // If enabling and no payment link exists, generate one
                      if (newValue && !invoice.stripePaymentLink && !invoice.paymentToken) {
                        await generatePaymentLink();
                      }
                    }}
                    disabled={isTogglingPayment || isGeneratingPaymentLink}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={invoice.allowOnlinePayment ? colors.primary : colors.mutedForeground}
                  />
                </View>
                
                {/* Payment Link Section */}
                {invoice.allowOnlinePayment && (
                  <>
                    {(invoice.stripePaymentLink || invoice.paymentToken) ? (
                      <View style={styles.paymentLinkSection}>
                        <View style={styles.paymentLinkInfo}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                          <Text style={styles.paymentLinkText}>
                            Payment link active
                          </Text>
                        </View>
                        <View style={styles.paymentLinkActions}>
                          <TouchableOpacity 
                            style={styles.copyLinkButton}
                            onPress={sharePaymentLink}
                          >
                            <Feather name="share-2" size={16} color={colors.primary} />
                            <Text style={styles.copyLinkButtonText}>Share</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.copyLinkButton}
                            onPress={copyPaymentLinkToClipboard}
                          >
                            <Feather name="copy" size={16} color={colors.primary} />
                            <Text style={styles.copyLinkButtonText}>Copy</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.paymentLinkSection}>
                        <TouchableOpacity 
                          style={styles.generateLinkButton}
                          onPress={generatePaymentLink}
                          disabled={isGeneratingPaymentLink}
                        >
                          {isGeneratingPaymentLink ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <>
                              <Feather name="link" size={16} color={colors.primary} />
                              <Text style={styles.generateLinkButtonText}>Generate Payment Link</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}

          {/* Payment Info - Show when already paid */}
          {invoice.status === 'paid' && invoice.paidAt && (
            <>
              <Text style={styles.sectionTitle}>Payment Received</Text>
              <View style={[styles.card, styles.paidCard]}>
                <View style={styles.paidInfo}>
                  <Feather name="check-circle" size={24} color={colors.success} />
                  <View style={styles.paidInfoText}>
                    <Text style={styles.paidAmount}>{formatCurrency(invoice.amountPaid || invoice.total)}</Text>
                    <Text style={styles.paidDate}>Paid on {formatDate(invoice.paidAt)}</Text>
                    {invoice.paymentMethod && (
                      <Text style={styles.paidMethod}>
                        Method: {invoice.paymentMethod === 'on_site' ? 'On-Site Payment' : invoice.paymentMethod}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Notes */}
          {invoice.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={[styles.card, styles.notesCard, { borderLeftColor: brandColor }]}>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            </>
          )}

          {/* Signatures Section - Shows all related signatures */}
          {allSignatures.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Signatures ({allSignatures.length})
              </Text>
              {allSignatures.map((signature, index) => {
                const getSignatureLabel = (sig: Signature) => {
                  switch (sig.documentType) {
                    case 'quote':
                      return 'Quote Acceptance';
                    case 'job_completion':
                      return sig.signerRole === 'worker' ? 'Worker Completion' : 'Client Approval';
                    case 'invoice':
                      return 'Invoice Signature';
                    default:
                      return 'Signature';
                  }
                };
                
                return (
                  <View key={signature.id || index} style={styles.card}>
                    <View style={styles.signatureLabelRow}>
                      <Feather 
                        name={signature.documentType === 'quote' ? 'file-text' : signature.documentType === 'job_completion' ? 'check-square' : 'edit-3'} 
                        size={16} 
                        color={colors.primary} 
                      />
                      <Text style={styles.signatureLabel}>
                        {getSignatureLabel(signature)}
                      </Text>
                    </View>
                    <Image 
                      source={{ uri: signature.signatureData }} 
                      style={styles.signatureImage}
                      resizeMode="contain"
                    />
                    <View style={styles.signatureDetails}>
                      {signature.signerName && (
                        <Text style={styles.signatureInfo}>
                          Signed by: {signature.signerName}
                        </Text>
                      )}
                      {signature.signedAt && (
                        <Text style={styles.signatureInfo}>
                          Date: {formatDate(signature.signedAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* Footer */}
          <View style={[styles.footerSection, { borderTopColor: brandColor }]}>
            <Text style={styles.thankYouText}>Thank you for your business!</Text>
            {(user?.abn || businessSettings?.abn) && (
              <Text style={styles.abnFooter}>ABN: {user?.abn || businessSettings?.abn}</Text>
            )}
          </View>

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
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.previewModalContainer}>
          <View style={styles.previewModalHeader}>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.previewCloseButton}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.previewModalTitle}>Invoice Preview</Text>
            <View style={styles.previewActionButtons}>
              <TouchableOpacity 
                onPress={() => {
                  setShowPreview(false);
                  setTimeout(() => setShowEmailCompose(true), 300);
                }}
                style={styles.previewActionButton}
                data-testid="button-preview-email"
              >
                <Feather name="mail" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSharePdf}
                style={styles.previewActionButton}
                disabled={isDownloadingPdf}
                data-testid="button-preview-share"
              >
                <Feather name="share-2" size={20} color={isDownloadingPdf ? colors.mutedForeground : colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <LiveDocumentPreview
            type="invoice"
            documentNumber={invoice.invoiceNumber}
            date={invoice.createdAt}
            dueDate={invoice.dueDate}
            lineItems={lineItems.map((item: any) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            }))}
            notes={invoice.notes}
            business={{
              businessName: businessSettings?.businessName || user?.businessName,
              abn: businessSettings?.abn || user?.abn,
              address: businessSettings?.address || user?.address,
              phone: businessSettings?.phone || user?.phone,
              email: businessSettings?.email || user?.email,
              logoUrl: businessSettings?.logoUrl || user?.logoUrl,
              brandColor: brandColor,
              gstEnabled: user?.gstEnabled !== false,
            }}
            client={client ? {
              name: client.name,
              email: client.email,
              phone: client.phone,
              address: client.address,
            } : null}
            gstEnabled={user?.gstEnabled !== false}
            status={invoice.status}
            templateId={businessSettings?.documentTemplate}
            templateCustomization={businessSettings?.documentTemplateSettings}
            jobSignatures={allSignatures.map(sig => ({
              id: sig.id,
              signerName: sig.signerName || 'Client',
              signatureData: sig.signatureData,
              signedAt: sig.signedAt || new Date().toISOString(),
              documentType: sig.documentType,
            }))}
          />
        </View>
      </Modal>

      {/* Email Compose Modal */}
      <EmailComposeModal
        visible={showEmailCompose}
        onClose={() => setShowEmailCompose(false)}
        type="invoice"
        documentId={id!}
        clientName={client?.name || 'Client'}
        clientEmail={client?.email || ''}
        documentNumber={invoice?.invoiceNumber || ''}
        documentTitle={invoice?.title || 'Invoice'}
        total={formatCurrency(invoice?.total || 0)}
        businessName={user?.businessName}
        onSend={handleEmailSend}
      />

      {/* Template Selector Modal */}
      <Modal
        visible={showTemplateSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTemplateSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.templateModalContent}>
            <View style={styles.templateModalHeader}>
              <Text style={styles.templateModalTitle}>Select Template</Text>
              <TouchableOpacity onPress={() => setShowTemplateSelector(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            {TEMPLATE_OPTIONS.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateOption,
                  selectedTemplate === template.id && styles.templateOptionSelected
                ]}
                onPress={() => {
                  setSelectedTemplate(template.id);
                  setShowTemplateSelector(false);
                }}
              >
                <View style={styles.templateOptionContent}>
                  <Text style={styles.templateOptionName}>{template.name}</Text>
                  <Text style={styles.templateOptionDesc}>{template.description}</Text>
                </View>
                {selectedTemplate === template.id && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Share Action Sheet Modal */}
      <Modal
        visible={showShareSheet}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowShareSheet(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowShareSheet(false)}
        >
          <View style={styles.shareSheetContent}>
            <View style={styles.shareSheetHandle} />
            <Text style={styles.shareSheetTitle}>Share Invoice</Text>
            <Text style={styles.shareSheetSubtitle}>{invoice?.invoiceNumber}</Text>
            
            <View style={styles.shareOptions}>
              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleEmailInvoice}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="mail" size={22} color={colors.primary} />
                </View>
                <Text style={styles.shareOptionText}>Email to Client</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSharePdf}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.successLight }]}>
                  <Feather name="share-2" size={22} color={colors.success} />
                </View>
                <Text style={styles.shareOptionText}>Share PDF</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              {invoice?.allowOnlinePayment && (invoice?.stripePaymentLink || invoice?.paymentToken) && (
                <TouchableOpacity 
                  style={styles.shareOption}
                  onPress={handleCopyPaymentLink}
                >
                  <View style={[styles.shareOptionIcon, { backgroundColor: colors.infoLight }]}>
                    <Feather name="link" size={22} color={colors.info} />
                  </View>
                  <Text style={styles.shareOptionText}>Copy Payment Link</Text>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSaveToDevice}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: '#fef3c7' }]}>
                  <Feather name="download" size={22} color="#d97706" />
                </View>
                <Text style={styles.shareOptionText}>Save to Device</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSharePdf}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: '#f3e8ff' }]}>
                  <Feather name="printer" size={22} color="#9333ea" />
                </View>
                <Text style={styles.shareOptionText}>Print</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.shareSheetCancel}
              onPress={() => setShowShareSheet(false)}
            >
              <Text style={styles.shareSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
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
    padding: spacing.sm,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  invoiceNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
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
    marginTop: spacing.xs,
  },
  dueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
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
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
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
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.destructiveLight,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
    paddingVertical: spacing.md,
  },
  lineItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
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
    marginTop: spacing.sm,
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
    paddingVertical: spacing.sm,
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
    marginVertical: spacing.sm,
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
  paymentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentToggleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  paymentToggleText: {
    flex: 1,
  },
  paymentToggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  paymentToggleDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  paymentLinkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paymentLinkText: {
    fontSize: 13,
    color: colors.success,
  },
  paymentLinkSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  paymentLinkActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
  },
  copyLinkButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  generateLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  generateLinkButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  onSitePaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.success,
    borderRadius: radius.md,
  },
  onSitePaymentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  onSitePaymentHint: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  paidCard: {
    borderColor: colors.success,
    borderWidth: 1,
    backgroundColor: colors.successLight,
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  paidInfoText: {
    flex: 1,
  },
  paidAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
  },
  paidDate: {
    fontSize: 14,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  paidMethod: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  signatureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  signatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  actionsColumn: {
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
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
    padding: spacing.lg,
  },
  sendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    marginBottom: spacing['2xl'],
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
    marginBottom: spacing.sm,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.card,
    minHeight: 120,
    marginBottom: spacing['2xl'],
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing['2xl'],
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
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
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  notesCard: {
    borderLeftWidth: spacing.xs,
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  signatureImage: {
    width: '100%',
    height: 80,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signatureDetails: {
    gap: spacing.xs,
  },
  signatureInfo: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  footerSection: {
    marginTop: spacing.sm,
    marginBottom: spacing['2xl'],
    paddingTop: spacing.lg,
    borderTopWidth: 2,
    alignItems: 'center',
  },
  thankYouText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  abnFooter: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  templateModalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '70%',
  },
  templateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  templateModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  templateOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  templateOptionContent: {
    flex: 1,
  },
  templateOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateOptionDesc: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  previewCloseButton: {
    padding: spacing.sm,
    width: 40,
  },
  previewActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  previewActionButton: {
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  previewModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  shareSheetContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  shareSheetHandle: {
    width: 40,
    height: spacing.xs,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  shareSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  shareSheetSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  shareOptions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  shareOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  shareSheetCancel: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareSheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  recurringCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
  },
  recurringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.infoLight || colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  recurringBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.info,
  },
  recurringActiveText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recurringDetails: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  recurringDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recurringDetailContent: {
    flex: 1,
  },
  recurringDetailLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  recurringDetailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  recurringActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  recurringEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  recurringEditButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  recurringStopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.destructiveLight,
    borderRadius: radius.md,
  },
  recurringStopButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.destructive,
  },
});

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
  TextInput,
} from 'react-native';
// Note: expo-clipboard requires a native build - using Share API as fallback for Expo Go
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useInvoicesStore, useClientsStore, useAuthStore, useQuotesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
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
  const { id, autoEmail } = useLocalSearchParams<{ id: string; autoEmail?: string }>();
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
  const [linkedJob, setLinkedJob] = useState<any>(null);
  const [linkedReceipt, setLinkedReceipt] = useState<any>(null);
  const [allSignatures, setAllSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [isTogglingPayment, setIsTogglingPayment] = useState(false);
  const [isGeneratingPaymentLink, setIsGeneratingPaymentLink] = useState(false);
  const [isRecordingOnSitePayment, setIsRecordingOnSitePayment] = useState(false);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(businessSettings?.documentTemplate || 'professional');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  
  const brandColor = businessSettings?.brandColor || user?.brandColor || '#2563eb';
  
  const PAYMENT_METHODS = [
    { id: 'cash', label: 'Cash', icon: 'dollar-sign' },
    { id: 'bank_transfer', label: 'Bank Transfer', icon: 'briefcase' },
    { id: 'card', label: 'Card', icon: 'credit-card' },
    { id: 'cheque', label: 'Cheque', icon: 'file-text' },
    { id: 'other', label: 'Other', icon: 'more-horizontal' },
  ] as const;
  
  // Computed payment status
  const isPaid = invoice?.status === 'paid';

  const handleDeleteInvoice = () => {
    if (!invoice) return;
    
    Alert.alert(
      'Delete Invoice',
      'Are you sure you want to delete this invoice? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await api.delete(`/api/invoices/${invoice.id}`);
              Alert.alert('Success', 'Invoice deleted successfully');
              router.back();
            } catch (error) {
              console.error('Error deleting invoice:', error);
              Alert.alert('Error', 'Failed to delete invoice');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Auto-open email compose when navigated with autoEmail param
  useEffect(() => {
    if (autoEmail === 'true' && invoice && !isLoading) {
      setTimeout(() => setShowEmailCompose(true), 300);
    }
  }, [autoEmail, invoice, isLoading]);

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
    
    // Fetch linked job if exists (optional, clear state on failure)
    if (invoiceData?.jobId) {
      try {
        const jobResponse = await fetch(`${API_URL}/api/jobs/${invoiceData.jobId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (jobResponse.ok) {
          const jobData = await jobResponse.json();
          setLinkedJob(jobData);
        } else {
          setLinkedJob(null);
        }
      } catch (err) {
        console.log('Could not fetch linked job:', err);
        setLinkedJob(null);
      }
    } else {
      setLinkedJob(null);
    }
    
    // Fetch linked receipt if exists (optional, clear state on failure)
    try {
      const receiptResponse = await fetch(`${API_URL}/api/receipts?invoiceId=${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (receiptResponse.ok) {
        const receipts = await receiptResponse.json();
        if (receipts.length > 0) {
          setLinkedReceipt(receipts[0]);
        } else {
          setLinkedReceipt(null);
        }
      } else {
        setLinkedReceipt(null);
      }
    } catch (err) {
      console.log('Could not fetch linked receipt:', err);
      setLinkedReceipt(null);
    }
    
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
    
    try {
      // Use the email-with-pdf endpoint (same as web app) which attaches PDF automatically
      const response = await fetch(`${API_URL}/api/invoices/${id}/email-with-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          customSubject: subject,
          customMessage: message,
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch {
        result = { message: 'Server error - please try again' };
      }

      if (!response.ok) {
        // Show tradie-friendly error message from backend
        Alert.alert(
          result.title || "Couldn't send email",
          result.fix || result.message || "Please try again or use your email app instead."
        );
        return;
      }

      // Handle automatic mode (SendGrid) - email already sent
      if (result.sent) {
        await loadData();
        setShowEmailCompose(false);
        Alert.alert(
          'Invoice Sent!',
          `Email sent to ${result.recipientEmail} with PDF attached.`
        );
        return;
      }

      // Handle manual mode (Gmail draft) - open the draft URL
      if (result.draftUrl) {
        await loadData();
        setShowEmailCompose(false);
        
        // Open Gmail draft in browser
        const canOpen = await Linking.canOpenURL(result.draftUrl);
        if (canOpen) {
          await Linking.openURL(result.draftUrl);
          Alert.alert(
            'Gmail Draft Created!',
            'PDF attached automatically. Review and click Send in Gmail.'
          );
        } else {
          Alert.alert(
            'Draft Created',
            'Your email draft has been created. Open Gmail to review and send.'
          );
        }
        return;
      }

      // Fallback - status updated successfully even if email mechanism unclear
      await loadData();
      setShowEmailCompose(false);
      Alert.alert('Invoice Updated', 'Invoice has been processed.');

    } catch (networkError) {
      console.log('Network error sending invoice:', networkError);
      throw new Error('Unable to send invoice. Please check your connection and try again.');
    }
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

  const handleMarkPaid = () => {
    setShowPaymentMethodModal(true);
  };

  const handleRecordPayment = async () => {
    if (!invoice || isRecordingPayment) return;
    
    setIsRecordingPayment(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/invoices/${id}/record-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amount: Number(invoice.total) || 0,
          paymentMethod: selectedPaymentMethod,
          reference: paymentReference || undefined,
        }),
      });

      if (response.ok) {
        setShowPaymentMethodModal(false);
        setPaymentReference('');
        setSelectedPaymentMethod('cash');
        await loadData();
        const methodLabels: Record<string, string> = {
          cash: 'Cash',
          bank_transfer: 'Bank Transfer',
          cheque: 'Cheque',
          card: 'Card',
          other: 'Other'
        };
        Alert.alert(
          'Payment Recorded',
          `${formatCurrency(invoice.total)} received via ${methodLabels[selectedPaymentMethod]}`
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to record payment');
      }
    } catch (error) {
      console.log('Error recording payment:', error);
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    } finally {
      setIsRecordingPayment(false);
    }
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

  const handleSendReceipt = async () => {
    if (!invoice || !client?.email || isSendingReceipt) return;
    
    setIsSendingReceipt(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/invoices/${id}/send-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email: client.email }),
      });

      if (response.ok) {
        Alert.alert('Receipt Sent', `Receipt emailed to ${client.email}`);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to send receipt');
      }
    } catch (error) {
      console.log('Error sending receipt:', error);
      Alert.alert('Error', 'Failed to send receipt. Please try again.');
    } finally {
      setIsSendingReceipt(false);
    }
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
    let paymentUrl = getPaymentLinkUrl();
    
    // If no payment link exists, generate one first
    if (!paymentUrl) {
      const generatedUrl = await generatePaymentLink();
      if (!generatedUrl) {
        // generatePaymentLink already shows an error alert
        return;
      }
      paymentUrl = generatedUrl;
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
    
    // REQUIRED FIX: 15 second timeout as per requirements
    const PDF_TIMEOUT_MS = 15000; 
    
    const authToken = await api.getToken();
    if (!authToken) {
      throw new Error('Not authenticated. Please log in again.');
    }
    
    const fileUri = `${FileSystem.cacheDirectory}${invoice.invoiceNumber || 'invoice'}_${Date.now()}.pdf`;
    const pdfUrl = `${API_URL}/api/invoices/${id}/pdf`;
    
    console.log('[PDF] Downloading from:', pdfUrl);
    
    // Use createDownloadResumable for cancellation support
    const downloadResumable = FileSystem.createDownloadResumable(
      pdfUrl,
      fileUri,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Accept': 'application/pdf',
        },
      }
    );
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      const downloadPromise = downloadResumable.downloadAsync();
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            await downloadResumable.pauseAsync();
          } catch (e) {
            // Ignore pause errors
          }
          reject(new Error('PDF download timed out (15s limit). Please check your connection and try again.'));
        }, PDF_TIMEOUT_MS);
      });
      
      const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!downloadResult) {
        throw new Error('Download failed: No response from server.');
      }
      
      console.log('[PDF] Download result status:', downloadResult.status);

      if (downloadResult.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      
      if (downloadResult.status === 403) {
        throw new Error('You do not have permission to download this invoice.');
      }

      if (downloadResult.status === 404) {
        throw new Error('Invoice not found. It may have been deleted.');
      }
      
      if (downloadResult.status !== 200) {
        throw new Error(`Server returned error ${downloadResult.status}. Please try again later.`);
      }
      
      // Verify the file was downloaded and has content
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size < 100)) {
        throw new Error('Downloaded PDF is invalid or too small. Please try again.');
      }

      return downloadResult.uri;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      // Handle network errors gracefully
      if (error.message?.includes('Network request failed') || error.message?.includes('Network Error')) {
        throw new Error('Network error: Please check your internet connection and try again.');
      }

      console.log('[PDF] Download error details:', error);
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
    } catch (error: any) {
      console.log('PDF download error:', error);
      const message = error?.message || 'Failed to download PDF. Please try again.';
      Alert.alert('PDF Download', message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    setShowShareSheet(false);
    setIsDownloadingPdf(true);
    
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
    } catch (error: any) {
      console.log('Share PDF error:', error);
      const errorMessage = error?.message || 'Failed to share PDF.';
      Alert.alert(
        'PDF Share Failed',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => handleSharePdf() },
        ]
      );
    } finally {
      setIsDownloadingPdf(false);
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
    } catch (error: any) {
      console.log('Save to device error:', error);
      const errorMessage = error?.message || 'Failed to save PDF.';
      Alert.alert(
        'Save Failed',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => handleSaveToDevice() },
        ]
      );
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

  const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: any }) => (
    <View style={[{
      width: typeof width === 'string' ? width : width,
      height,
      backgroundColor: colors.muted,
      borderRadius: 8,
    }, style]} />
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Invoice' }} />
        <ScrollView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <SkeletonBox width={120} height={20} />
                <SkeletonBox width={60} height={24} style={{ borderRadius: 12 }} />
              </View>
              <SkeletonBox width={180} height={40} style={{ marginTop: 12 }} />
              <SkeletonBox width={100} height={16} style={{ marginTop: 8 }} />
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <SkeletonBox width={60} height={12} />
                  <SkeletonBox width="100%" height={16} style={{ marginTop: 4 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <SkeletonBox width={60} height={12} />
                  <SkeletonBox width="100%" height={16} style={{ marginTop: 4 }} />
                </View>
              </View>
            </View>
            <View style={styles.quickActions}>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonBox key={i} width={80} height={48} style={{ flex: 1, borderRadius: 10 }} />
              ))}
            </View>
            <SkeletonBox width={100} height={14} style={{ marginBottom: 8, marginTop: 16 }} />
            <View style={styles.card}>
              <SkeletonBox width="100%" height={60} />
            </View>
            <SkeletonBox width={80} height={14} style={{ marginBottom: 8 }} />
            <View style={styles.card}>
              <SkeletonBox width="100%" height={80} />
            </View>
          </View>
        </ScrollView>
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
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => setShowPreview(true)}
                style={styles.headerButton}
              >
                <Feather name="eye" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDeleteInvoice}
                style={styles.headerButton}
                disabled={isDeleting}
                data-testid="button-delete-invoice"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <Feather name="trash-2" size={22} color={colors.destructive} />
                )}
              </TouchableOpacity>
            </View>
          )
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Summary Card */}
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
            
            <View style={styles.summaryDetailsRow}>
              <View style={styles.summaryDetailItem}>
                <Feather name="user" size={14} color={colors.mutedForeground} />
                <View>
                  <Text style={styles.summaryDetailLabel}>Client</Text>
                  <Text style={styles.summaryDetailValue} numberOfLines={1}>{client?.name || 'Unknown'}</Text>
                </View>
              </View>
              <View style={styles.summaryDetailItem}>
                <Feather name="calendar" size={14} color={invoice.status === 'overdue' ? colors.destructive : colors.mutedForeground} />
                <View>
                  <Text style={styles.summaryDetailLabel}>Due Date</Text>
                  <Text style={[styles.summaryDetailValue, invoice.status === 'overdue' && { color: colors.destructive }]} numberOfLines={1}>
                    {invoice.dueDate ? formatDate(invoice.dueDate) : 'Not set'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Quick Actions - Primary */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {/* Primary Actions - Web-like prominent buttons */}
          <View style={styles.primaryActionsRow}>
            {/* Send Email - for draft/sent/overdue */}
            {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'overdue') && (
              <TouchableOpacity 
                style={[styles.primaryActionButton, { backgroundColor: '#007AFF' }]}
                onPress={handleSend}
                disabled={isSendingInvoice}
              >
                {isSendingInvoice ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="mail" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.primaryActionText}>
                  {isSendingInvoice ? 'Sending...' : 'Send Email'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Payment Link - for sent/overdue */}
            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
              <TouchableOpacity 
                style={[styles.primaryActionButton, { backgroundColor: '#34C759' }]}
                onPress={sharePaymentLink}
                disabled={isGeneratingPaymentLink}
              >
                {isGeneratingPaymentLink ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="link" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.primaryActionText}>Payment Link</Text>
              </TouchableOpacity>
            )}
            
            {/* Record Payment - for sent/overdue */}
            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
              <TouchableOpacity 
                style={[styles.primaryActionButton, { backgroundColor: '#FF9500' }]}
                onPress={handleRecordOnSitePayment}
              >
                <Feather name="dollar-sign" size={20} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Record Paid</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Secondary Quick Actions */}
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
              <Text style={styles.quickActionText}>{isDownloadingPdf ? 'Generating...' : 'PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => isPaid ? router.push(`/more/receipt/new?invoiceId=${id}`) : setShowTemplateSelector(true)}
            >
              <Feather name={isPaid ? "receipt" : "layout"} size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>{isPaid ? "Receipt" : "Template"}</Text>
            </TouchableOpacity>
            {invoice.status === 'draft' && (
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => router.push(`/more/invoice/new?editInvoiceId=${id}`)}
              >
                <Feather name="edit-2" size={20} color={colors.primary} />
                <Text style={styles.quickActionText}>Edit</Text>
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

          {/* Status History (Parity with Web Timeline) */}
          <Text style={styles.sectionTitle}>Status History</Text>
          <View style={styles.card}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineIndicator}>
                <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Invoice Created</Text>
                <Text style={styles.timelineDate}>{formatDate(invoice.createdAt)}</Text>
              </View>
            </View>
            {invoice.sentAt && (
              <View style={styles.timelineItem}>
                <View style={styles.timelineIndicator}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Invoice Sent</Text>
                  <Text style={styles.timelineDate}>{formatDate(invoice.sentAt)}</Text>
                </View>
              </View>
            )}
            {invoice.paidAt && (
              <View style={styles.timelineItem}>
                <View style={styles.timelineIndicator}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.success }]} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Payment Received</Text>
                  <Text style={styles.timelineDate}>{formatDate(invoice.paidAt)}</Text>
                </View>
              </View>
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

          {/* Related Documents */}
          {(linkedQuote || linkedJob || linkedReceipt) && (
            <>
              <Text style={styles.sectionTitle}>Related Documents</Text>
              <View style={styles.card}>
                {linkedQuote && (
                  <TouchableOpacity 
                    style={styles.linkedDocRow}
                    onPress={() => router.push(`/more/quote/${linkedQuote.id}`)}
                  >
                    <View style={[styles.linkedDocIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                      <Feather name="file" size={18} color="#3b82f6" />
                    </View>
                    <View style={styles.linkedDocInfo}>
                      <Text style={styles.linkedDocLabel}>Quote</Text>
                      <Text style={styles.linkedDocTitle}>{linkedQuote.quoteNumber || `Quote #${linkedQuote.id.slice(0,6)}`}</Text>
                    </View>
                    <View style={[styles.linkedDocStatus, { backgroundColor: linkedQuote.status === 'accepted' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)' }]}>
                      <Text style={[styles.linkedDocStatusText, { color: linkedQuote.status === 'accepted' ? '#22c55e' : '#3b82f6' }]}>
                        {linkedQuote.status.charAt(0).toUpperCase() + linkedQuote.status.slice(1)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                {linkedJob && (
                  <TouchableOpacity 
                    style={[styles.linkedDocRow, linkedQuote && styles.linkedDocRowBorder]}
                    onPress={() => router.push(`/job/${linkedJob.id}`)}
                  >
                    <View style={[styles.linkedDocIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="briefcase" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.linkedDocInfo}>
                      <Text style={styles.linkedDocLabel}>Job</Text>
                      <Text style={styles.linkedDocTitle} numberOfLines={1}>{linkedJob.title}</Text>
                    </View>
                    <View style={[styles.linkedDocStatus, { backgroundColor: linkedJob.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)' }]}>
                      <Text style={[styles.linkedDocStatusText, { color: linkedJob.status === 'completed' ? '#22c55e' : '#3b82f6' }]}>
                        {linkedJob.status.charAt(0).toUpperCase() + linkedJob.status.slice(1)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                {linkedReceipt && (
                  <TouchableOpacity 
                    style={[styles.linkedDocRow, (linkedQuote || linkedJob) && styles.linkedDocRowBorder]}
                    onPress={() => router.push(`/more/receipt/${linkedReceipt.id}`)}
                  >
                    <View style={[styles.linkedDocIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                      <Feather name="check-circle" size={18} color="#22c55e" />
                    </View>
                    <View style={styles.linkedDocInfo}>
                      <Text style={styles.linkedDocLabel}>Receipt</Text>
                      <Text style={styles.linkedDocTitle}>{linkedReceipt.receiptNumber || `Receipt #${linkedReceipt.id.slice(0,6)}`}</Text>
                    </View>
                    <View style={[styles.linkedDocStatus, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                      <Text style={[styles.linkedDocStatusText, { color: '#22c55e' }]}>Paid</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Recurring Invoice Section */}
          {(invoice as any).isRecurring && (
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
          {invoice.status === 'paid' && (
            <>
              <Text style={styles.sectionTitle}>Payment Received</Text>
              <View style={[styles.card, styles.paidCard]}>
                <View style={styles.paidInfo}>
                  <Feather name="check-circle" size={24} color={colors.success} />
                  <View style={styles.paidInfoText}>
                    <Text style={styles.paidAmount}>{formatCurrency(invoice.amountPaid || invoice.total)}</Text>
                    {invoice.paidAt && (
                      <Text style={styles.paidDate}>
                        {new Date(invoice.paidAt).toLocaleDateString('en-AU', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })} at {new Date(invoice.paidAt).toLocaleTimeString('en-AU', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Text>
                    )}
                    {invoice.paymentMethod && (
                      <Text style={styles.paidMethod}>
                        {invoice.paymentMethod === 'on_site' ? 'On-Site' : 
                         invoice.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                         invoice.paymentMethod === 'stripe' ? 'Online (Stripe)' :
                         invoice.paymentMethod === 'tap_to_pay' ? 'Tap to Pay' :
                         invoice.paymentMethod === 'cash' ? 'Cash' :
                         invoice.paymentMethod === 'card' ? 'Card' :
                         invoice.paymentMethod === 'cheque' ? 'Cheque' :
                         invoice.paymentMethod}
                      </Text>
                    )}
                    {invoice.paymentReference && (
                      <Text style={styles.paidReference}>Ref: {invoice.paymentReference}</Text>
                    )}
                  </View>
                </View>
                {/* Send Receipt Button */}
                {client?.email && (
                  <TouchableOpacity 
                    style={styles.sendReceiptButton}
                    onPress={handleSendReceipt}
                    disabled={isSendingReceipt}
                  >
                    {isSendingReceipt ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name="mail" size={16} color={colors.primary} />
                    )}
                    <Text style={styles.sendReceiptButtonText}>
                      {isSendingReceipt ? 'Sending...' : 'Send Receipt'}
                    </Text>
                  </TouchableOpacity>
                )}
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
            <TouchableOpacity 
              style={[styles.primaryButton, isSendingInvoice && styles.buttonDisabled]} 
              onPress={handleSend}
              disabled={isSendingInvoice}
            >
              {isSendingInvoice ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Feather name="send" size={20} color={colors.white} />
              )}
              <Text style={styles.primaryButtonText}>
                {isSendingInvoice ? 'Sending...' : 'Send to Client'}
              </Text>
            </TouchableOpacity>
          )}
          
          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
            <View style={styles.actionsColumn}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCollectPayment}>
                <Feather name="credit-card" size={20} color={colors.white} />
                <Text style={styles.primaryButtonText}>Collect Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.secondaryButton, isRecordingPayment && styles.buttonDisabled]} 
                onPress={handleMarkPaid}
                disabled={isRecordingPayment}
              >
                {isRecordingPayment ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="dollar-sign" size={20} color={colors.primary} />
                )}
                <Text style={styles.secondaryButtonText}>Record Payment</Text>
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

      {/* Payment Method Selection Modal */}
      <Modal
        visible={showPaymentMethodModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentMethodModalContent}>
            <View style={styles.shareSheetHandle} />
            <Text style={styles.shareSheetTitle}>Record Payment</Text>
            <Text style={styles.shareSheetSubtitle}>
              {formatCurrency(invoice?.total || 0)}
            </Text>
            
            <Text style={styles.paymentMethodSectionTitle}>Payment Method</Text>
            <View style={styles.paymentMethodOptions}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethodOption,
                    selectedPaymentMethod === method.id && styles.paymentMethodOptionSelected
                  ]}
                  onPress={() => setSelectedPaymentMethod(method.id)}
                >
                  <View style={[
                    styles.paymentMethodIcon,
                    selectedPaymentMethod === method.id && styles.paymentMethodIconSelected
                  ]}>
                    <Feather 
                      name={method.icon as any} 
                      size={20} 
                      color={selectedPaymentMethod === method.id ? colors.white : colors.primary} 
                    />
                  </View>
                  <Text style={[
                    styles.paymentMethodLabel,
                    selectedPaymentMethod === method.id && styles.paymentMethodLabelSelected
                  ]}>
                    {method.label}
                  </Text>
                  {selectedPaymentMethod === method.id && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.paymentMethodSectionTitle}>Reference (Optional)</Text>
            <TextInput
              style={styles.paymentReferenceInput}
              placeholder="e.g. Check #1234 or Transfer ID"
              placeholderTextColor={colors.mutedForeground}
              value={paymentReference}
              onChangeText={setPaymentReference}
            />

            <View style={styles.paymentMethodActions}>
              <TouchableOpacity
                style={styles.paymentMethodCancelButton}
                onPress={() => {
                  setShowPaymentMethodModal(false);
                  setPaymentReference('');
                  setSelectedPaymentMethod('cash');
                }}
              >
                <Text style={styles.paymentMethodCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentMethodConfirmButton, isRecordingPayment && styles.buttonDisabled]}
                onPress={handleRecordPayment}
                disabled={isRecordingPayment}
              >
                {isRecordingPayment ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Feather name="check" size={18} color={colors.white} />
                    <Text style={styles.paymentMethodConfirmText}>Record Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  summaryDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
  },
  summaryDetailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryDetailLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 2,
  },
  primaryActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  primaryActionButton: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
  timelineItem: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineIndicator: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  timelineDate: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkedDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  linkedDocRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkedDocIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedDocInfo: {
    flex: 1,
  },
  linkedDocLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  linkedDocTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  linkedDocStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  linkedDocStatusText: {
    fontSize: 11,
    fontWeight: '600',
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
  paymentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentToggleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    gap: 8,
  },
  paymentLinkText: {
    fontSize: 13,
    color: colors.success,
  },
  paymentLinkSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  paymentLinkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
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
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 8,
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
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.success,
    borderRadius: 10,
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
    marginTop: 8,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  paidCard: {
    borderColor: colors.success,
    borderWidth: 1,
    backgroundColor: colors.successLight,
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
    marginTop: 4,
  },
  paidMethod: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  paidReference: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sendReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  sendReceiptButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  signatureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  signatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
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
  notesCard: {
    borderLeftWidth: 4,
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  signatureImage: {
    width: '100%',
    height: 80,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signatureDetails: {
    gap: 4,
  },
  signatureInfo: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  footerSection: {
    marginTop: 8,
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 2,
    alignItems: 'center',
  },
  thankYouText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 4,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  templateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  templateModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  previewCloseButton: {
    padding: 8,
    width: 40,
  },
  previewActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewActionButton: {
    padding: 8,
    borderRadius: 8,
  },
  previewModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  shareSheetContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  shareSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  shareSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 4,
  },
  shareSheetSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 20,
  },
  shareOptions: {
    gap: 8,
    marginBottom: 16,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  shareOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  shareSheetCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
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
    marginBottom: 16,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.infoLight || colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
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
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  recurringDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    gap: 12,
  },
  recurringEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
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
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.destructiveLight,
    borderRadius: 10,
  },
  recurringStopButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.destructive,
  },
  paymentMethodModalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  paymentMethodSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 12,
  },
  paymentMethodOptions: {
    gap: 8,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: colors.primaryLight,
  },
  paymentMethodIconSelected: {
    backgroundColor: colors.primary,
  },
  paymentMethodLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  paymentMethodLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  paymentReferenceInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  paymentMethodActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  paymentMethodCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  paymentMethodConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.success,
  },
  paymentMethodConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});

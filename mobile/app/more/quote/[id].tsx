import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useQuotesStore, useClientsStore, useAuthStore, useJobsStore, useInvoicesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import LiveDocumentPreview from '../../../src/components/LiveDocumentPreview';
import { EmailComposeModal } from '../../../src/components/EmailComposeModal';
import { API_URL, api } from '../../../src/lib/api';

interface LinkedInvoice {
  id: string;
  invoiceNumber?: string;
  total: number;
  status: string;
}

interface LinkedJob {
  id: string;
  title: string;
  status: string;
}

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

export default function QuoteDetailScreen() {
  const { id, autoEmail } = useLocalSearchParams<{ id: string; autoEmail?: string }>();
  const { getQuote, updateQuoteStatus } = useQuotesStore();
  const { invoices, fetchInvoices } = useInvoicesStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, businessSettings } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const STATUS_CONFIG = useMemo(() => ({
    draft: { label: 'Draft', color: colors.warning, bg: colors.warningLight },
    sent: { label: 'Sent', color: colors.info, bg: colors.infoLight },
    accepted: { label: 'Accepted', color: colors.success, bg: colors.successLight },
    rejected: { label: 'Rejected', color: colors.destructive, bg: colors.destructiveLight },
    expired: { label: 'Expired', color: colors.mutedForeground, bg: colors.cardHover },
  }), [colors]);
  const [quote, setQuote] = useState<any>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<LinkedInvoice | null>(null);
  const [linkedJob, setLinkedJob] = useState<LinkedJob | null>(null);
  const [allSignatures, setAllSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(businessSettings?.documentTemplate || 'professional');
  const [showDepositEditor, setShowDepositEditor] = useState(false);
  const [depositPercent, setDepositPercent] = useState('');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  
  const brandColor = businessSettings?.brandColor || user?.brandColor || '#2563eb';

  const handleDeleteQuote = () => {
    if (!quote) return;
    
    Alert.alert(
      'Delete Quote',
      'Are you sure you want to delete this quote? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await api.delete(`/api/quotes/${quote.id}`);
              Alert.alert('Success', 'Quote deleted successfully');
              router.back();
            } catch (error) {
              console.error('Error deleting quote:', error);
              Alert.alert('Error', 'Failed to delete quote');
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
    if (autoEmail === 'true' && quote && !isLoading) {
      setTimeout(() => setShowEmailCompose(true), 300);
    }
  }, [autoEmail, quote, isLoading]);

  const loadData = async () => {
    setIsLoading(true);
    const quoteData = await getQuote(id!);
    setQuote(quoteData);
    
    // Fetch related data - don't block on optional fetches
    try {
      await fetchClients();
    } catch (e) {
      console.log('Could not fetch clients:', e);
    }
    
    // Fetch invoices and jobs for related documents (optional, don't block)
    try {
      await fetchInvoices();
    } catch (e) {
      console.log('Could not fetch invoices:', e);
    }
    try {
      await fetchJobs();
    } catch (e) {
      console.log('Could not fetch jobs:', e);
    }
    
    const signatures: Signature[] = [];
    const authToken = await api.getToken();
    
    // Fetch quote signatures
    try {
      const response = await fetch(`${API_URL}/api/digital-signatures?documentType=quote&documentId=${id}`, {
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
    
    // Fetch job signatures if quote has jobId
    if (quoteData?.jobId) {
      try {
        const response = await fetch(`${API_URL}/api/jobs/${quoteData.jobId}/signatures`, {
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
    
    setAllSignatures(signatures);
    
    // Find linked invoice (invoice created from this quote)
    const invoicesArray = useInvoicesStore.getState().invoices;
    const foundInvoice = invoicesArray.find((inv: any) => inv.quoteId === id);
    if (foundInvoice) {
      setLinkedInvoice({
        id: foundInvoice.id,
        invoiceNumber: foundInvoice.invoiceNumber,
        total: foundInvoice.total,
        status: foundInvoice.status,
      });
    } else {
      setLinkedInvoice(null);
    }
    
    // Find linked job (job created from this quote or quote linked to job)
    const jobsArray = useJobsStore.getState().jobs;
    const foundJob = jobsArray.find((job: any) => job.quoteId === id || quoteData?.jobId === job.id);
    if (foundJob) {
      setLinkedJob({
        id: foundJob.id,
        title: foundJob.title,
        status: foundJob.status,
      });
    } else {
      setLinkedJob(null);
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
    if (!quote) return;
    const client = getClient(quote.clientId);
    
    Alert.alert(
      'Send Quote',
      'How would you like to send this quote?',
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
    if (!quote) return;
    const client = getClient(quote.clientId);
    
    if (!client?.email) {
      Alert.alert('No Email', 'This client doesn\'t have an email address on file.');
      return;
    }
    
    const quoteNumber = quote.quoteNumber || quote.id?.slice(0, 8);
    const total = formatCurrency(quote.total);
    const subject = `Quote ${quoteNumber} - ${total}`;
    const publicUrl = quote.acceptanceToken 
      ? `${API_URL.replace('/api', '')}/q/${quote.acceptanceToken}` 
      : '';
    
    const body = `G'day ${client.name || 'there'},\n\nPlease find your quote for ${quote.title || 'the requested work'}.\n\nTotal: ${total}\n\n${publicUrl ? `View and accept your quote here:\n${publicUrl}\n\n` : ''}Let me know if you have any questions!\n\nCheers`;
    
    const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        // Mark quote as sent after opening email app
        Alert.alert(
          'Email App Opened',
          'Your email app has the quote details ready. After you send it, would you like to mark this quote as sent?',
          [
            { text: 'Not Yet', style: 'cancel' },
            { 
              text: 'Mark as Sent', 
              onPress: async () => {
                await updateQuoteStatus(id!, 'sent');
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
      const response = await fetch(`${API_URL}/api/quotes/${id}/email-with-pdf`, {
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
          'Quote Sent!',
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
      Alert.alert('Quote Updated', 'Quote has been processed.');

    } catch (networkError) {
      console.log('Network error sending quote:', networkError);
      throw new Error('Unable to send quote. Please check your connection and try again.');
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
    if (!quote || isCreatingInvoice) return;
    
    Alert.alert(
      'Create Invoice',
      'This will create an invoice from this quote. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Invoice',
          onPress: async () => {
            setIsCreatingInvoice(true);
            try {
              const authToken = await api.getToken();
              const client = getClient(quote.clientId);
              
              const response = await fetch(`${API_URL}/api/invoices`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  clientId: quote.clientId,
                  quoteId: quote.id,
                  title: quote.title || `Invoice from Quote #${quote.quoteNumber || id?.slice(0, 6)}`,
                  lineItems: quote.lineItems || [],
                  subtotal: quote.subtotal,
                  gstAmount: quote.gstAmount,
                  total: quote.total,
                  notes: quote.notes,
                  includesGst: quote.includesGst,
                  status: 'draft',
                }),
              });

              if (response.ok) {
                const newInvoice = await response.json();
                await fetchInvoices();
                await loadData();
                Alert.alert('Success', 'Invoice created from quote!', [
                  { text: 'View Invoice', onPress: () => router.push(`/more/invoice/${newInvoice.id}`) },
                  { text: 'OK' }
                ]);
              } else {
                const error = await response.json();
                Alert.alert('Error', error.error || 'Failed to create invoice');
              }
            } catch (error) {
              console.log('Error creating invoice from quote:', error);
              Alert.alert('Error', 'Failed to create invoice. Please try again.');
            } finally {
              setIsCreatingInvoice(false);
            }
          },
        },
      ]
    );
  };

  const handleConvertToJob = async () => {
    if (!quote || isCreatingJob) return;
    
    Alert.alert(
      'Create Job',
      'This will create a job from this quote. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Job',
          onPress: async () => {
            setIsCreatingJob(true);
            const { fetchJobs } = useJobsStore.getState();
            
            try {
              const authToken = await api.getToken();
              const response = await fetch(`${API_URL}/api/jobs`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  title: `Job from Quote #${quote?.quoteNumber || id?.slice(0, 6)}`,
                  description: quote?.notes || '',
                  clientId: quote?.clientId,
                  quoteId: id,
                  status: 'pending',
                  address: getClient(quote?.clientId)?.address || '',
                }),
              });

              if (response.ok) {
                const newJob = await response.json();
                await fetchJobs();
                await loadData();
                Alert.alert('Success', 'Job created from quote!', [
                  { text: 'View Job', onPress: () => router.push(`/job/${newJob.id}`) },
                  { text: 'OK' }
                ]);
              } else {
                const error = await response.json();
                Alert.alert('Error', error.error || 'Failed to create job');
              }
            } catch (error) {
              console.log('Error creating job from quote:', error);
              Alert.alert('Error', 'Failed to create job. Please try again.');
            } finally {
              setIsCreatingJob(false);
            }
          },
        },
      ]
    );
  };
  
  const handleMarkAsSent = async () => {
    if (!quote || isMarkingSent) return;
    
    setIsMarkingSent(true);
    try {
      const success = await updateQuoteStatus(id!, 'sent');
      if (success) {
        await loadData();
        Alert.alert('Success', 'Quote marked as sent');
      } else {
        Alert.alert('Error', 'Failed to update quote status');
      }
    } catch (error) {
      console.log('Error marking quote as sent:', error);
      Alert.alert('Error', 'Failed to update quote status');
    } finally {
      setIsMarkingSent(false);
    }
  };

  const downloadPdfToCache = useCallback(async (): Promise<string | null> => {
    if (!quote) return null;
    
    // REQUIRED FIX: 15 second timeout as per requirements
    const PDF_TIMEOUT_MS = 15000; 
    
    const authToken = await api.getToken();
    if (!authToken) {
      throw new Error('Not authenticated. Please log in again.');
    }
    
    const fileUri = `${FileSystem.cacheDirectory}${quote.quoteNumber || 'quote'}_${Date.now()}.pdf`;
    const pdfUrl = `${API_URL}/api/quotes/${id}/pdf`;
    
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
        throw new Error('You do not have permission to download this quote.');
      }

      if (downloadResult.status === 404) {
        throw new Error('Quote not found. It may have been deleted.');
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
  }, [quote, id]);

  const handleDownloadPdf = async () => {
    if (!quote || isDownloadingPdf) return;
    
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
    
    try {
      const uri = pdfUri || await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Quote ${quote?.quoteNumber}`,
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
          dialogTitle: `Save Quote ${quote?.quoteNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback: Copy to document directory
        const fileName = `${quote?.quoteNumber || 'quote'}.pdf`;
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

  const handleEmailQuote = () => {
    setShowShareSheet(false);
    setShowEmailCompose(true);
  };

  const handleCopyLink = async () => {
    if (!quote?.acceptanceToken) {
      Alert.alert('Link Not Available', 'This quote does not have a shareable link. Try sending the quote first.');
      return;
    }
    
    const publicUrl = `${API_URL.replace('/api', '')}/q/${quote.acceptanceToken}`;
    
    try {
      await Clipboard.setStringAsync(publicUrl);
      Alert.alert('Link Copied', 'The quote link has been copied to your clipboard. Share it with your client so they can view and accept the quote online.');
    } catch (error) {
      console.error('Failed to copy link:', error);
      Alert.alert('Error', 'Failed to copy link to clipboard');
    }
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
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => setShowPreview(true)}
                style={styles.headerButton}
              >
                <Feather name="eye" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDeleteQuote}
                style={styles.headerButton}
                disabled={isDeleting}
                data-testid="button-delete-quote"
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

          {/* Quick Actions Row 1 */}
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
              onPress={handleCopyLink}
            >
              <Feather name="link" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => setShowTemplateSelector(true)}
            >
              <Feather name="layout" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Template</Text>
            </TouchableOpacity>
          </View>
          
          {/* Quick Actions Row 2 - Draft status: Mark as Sent */}
          {quote.status === 'draft' && (
            <View style={[styles.quickActions, { marginTop: 8 }]}>
              <TouchableOpacity 
                style={[styles.quickAction, styles.quickActionPrimary]}
                onPress={handleSend}
                disabled={isMarkingSent}
                data-testid="button-send-to-client"
              >
                <Feather name="send" size={20} color={colors.white} />
                <Text style={[styles.quickActionText, { color: colors.white }]}>Send to Client</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickAction, { backgroundColor: colors.info }]}
                onPress={handleMarkAsSent}
                disabled={isMarkingSent}
                data-testid="button-mark-as-sent"
              >
                {isMarkingSent ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="check" size={20} color={colors.white} />
                )}
                <Text style={[styles.quickActionText, { color: colors.white }]}>
                  {isMarkingSent ? 'Updating...' : 'Mark as Sent'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Quick Actions Row 2 - Accepted status: Create Invoice/Job */}
          {quote.status === 'accepted' && !linkedInvoice && !linkedJob && (
            <View style={[styles.quickActions, { marginTop: 8 }]}>
              <TouchableOpacity 
                style={[styles.quickAction, styles.quickActionPrimary]}
                onPress={handleConvertToInvoice}
                disabled={isCreatingInvoice}
                data-testid="button-create-invoice"
              >
                {isCreatingInvoice ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="file-text" size={20} color={colors.white} />
                )}
                <Text style={[styles.quickActionText, { color: colors.white }]}>
                  {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickAction, { backgroundColor: colors.success }]}
                onPress={handleConvertToJob}
                disabled={isCreatingJob}
                data-testid="button-create-job"
              >
                {isCreatingJob ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="briefcase" size={20} color={colors.white} />
                )}
                <Text style={[styles.quickActionText, { color: colors.white }]}>
                  {isCreatingJob ? 'Creating...' : 'Create Job'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* If accepted but has one linked doc, show option to create the other */}
          {quote.status === 'accepted' && (linkedInvoice || linkedJob) && (!linkedInvoice || !linkedJob) && (
            <View style={[styles.quickActions, { marginTop: 8 }]}>
              {!linkedInvoice && (
                <TouchableOpacity 
                  style={[styles.quickAction, styles.quickActionPrimary, { flex: 1 }]}
                  onPress={handleConvertToInvoice}
                  disabled={isCreatingInvoice}
                  data-testid="button-create-invoice"
                >
                  {isCreatingInvoice ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Feather name="file-text" size={20} color={colors.white} />
                  )}
                  <Text style={[styles.quickActionText, { color: colors.white }]}>
                    {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                  </Text>
                </TouchableOpacity>
              )}
              {!linkedJob && (
                <TouchableOpacity 
                  style={[styles.quickAction, { backgroundColor: colors.success, flex: 1 }]}
                  onPress={handleConvertToJob}
                  disabled={isCreatingJob}
                  data-testid="button-create-job"
                >
                  {isCreatingJob ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Feather name="briefcase" size={20} color={colors.white} />
                  )}
                  <Text style={[styles.quickActionText, { color: colors.white }]}>
                    {isCreatingJob ? 'Creating...' : 'Create Job'}
                  </Text>
                </TouchableOpacity>
              )}
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

          {/* Related Documents */}
          {(linkedInvoice || linkedJob) && (
            <>
              <Text style={styles.sectionTitle}>Related Documents</Text>
              <View style={styles.card}>
                {linkedJob && (
                  <TouchableOpacity 
                    style={styles.linkedDocRow}
                    onPress={() => router.push(`/job/${linkedJob.id}`)}
                  >
                    <View style={styles.linkedDocIcon}>
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
                {linkedInvoice && (
                  <TouchableOpacity 
                    style={[styles.linkedDocRow, linkedJob && styles.linkedDocRowBorder]}
                    onPress={() => router.push(`/more/invoice/${linkedInvoice.id}`)}
                  >
                    <View style={[styles.linkedDocIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                      <Feather name="file-text" size={18} color="#f59e0b" />
                    </View>
                    <View style={styles.linkedDocInfo}>
                      <Text style={styles.linkedDocLabel}>Invoice</Text>
                      <Text style={styles.linkedDocTitle}>{linkedInvoice.invoiceNumber || `Invoice #${linkedInvoice.id.slice(0,6)}`}</Text>
                    </View>
                    <View style={[styles.linkedDocStatus, { 
                      backgroundColor: linkedInvoice.status === 'paid' ? 'rgba(34,197,94,0.1)' : 
                                       linkedInvoice.status === 'overdue' ? 'rgba(239,68,68,0.1)' : 
                                       'rgba(59,130,246,0.1)' 
                    }]}>
                      <Text style={[styles.linkedDocStatusText, { 
                        color: linkedInvoice.status === 'paid' ? '#22c55e' : 
                               linkedInvoice.status === 'overdue' ? '#ef4444' : 
                               '#3b82f6' 
                      }]}>
                        {linkedInvoice.status.charAt(0).toUpperCase() + linkedInvoice.status.slice(1)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
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
              <View style={[styles.card, styles.notesCard, { borderLeftColor: brandColor }]}>
                <Text style={styles.notesText}>{quote.notes}</Text>
              </View>
            </>
          )}

          {/* Quote Acceptance Section */}
          {quote.status !== 'accepted' && quote.status !== 'rejected' && (
            <>
              <Text style={styles.sectionTitle}>Quote Acceptance</Text>
              <View style={styles.acceptanceCard}>
                <Text style={styles.acceptanceText}>
                  By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
                </Text>
                <View style={styles.signaturePlaceholder}>
                  <Feather name="edit-3" size={16} color={colors.mutedForeground} />
                  <Text style={styles.signaturePlaceholderText}>Client signature area</Text>
                </View>
              </View>
            </>
          )}

          {/* Accepted Quote Signatures */}
          {quote.status === 'accepted' && allSignatures.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Quote Accepted</Text>
              {allSignatures.filter(sig => sig.documentType === 'quote').map((sig, index) => (
                <View key={sig.id || index} style={[styles.card, styles.acceptedCard]}>
                  <View style={styles.signatureImageContainer}>
                    <Text style={styles.signatureLabel}>Client Signature:</Text>
                  </View>
                  {sig.signerName && (
                    <Text style={styles.acceptedInfo}>
                      Accepted by: {sig.signerName}
                    </Text>
                  )}
                  {sig.signedAt && (
                    <Text style={styles.acceptedInfo}>
                      Date: {formatDate(sig.signedAt)}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}

          {quote.status === 'accepted' && allSignatures.filter(sig => sig.documentType === 'quote').length === 0 && quote.acceptedBy && (
            <>
              <Text style={styles.sectionTitle}>Quote Accepted</Text>
              <View style={[styles.card, styles.acceptedCard]}>
                <Text style={styles.acceptedInfo}>Accepted by: {quote.acceptedBy}</Text>
                {quote.acceptedAt && (
                  <Text style={styles.acceptedInfo}>Date: {formatDate(quote.acceptedAt)}</Text>
                )}
              </View>
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
          {quote.status === 'draft' && (
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={handleSend}
                disabled={isMarkingSent}
                data-testid="button-send-quote-bottom"
              >
                <Feather name="send" size={20} color={colors.white} />
                <Text style={styles.primaryButtonText}>Send to Client</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.secondaryButton, { marginTop: 12 }]} 
                onPress={handleMarkAsSent}
                disabled={isMarkingSent}
                data-testid="button-mark-sent-bottom"
              >
                {isMarkingSent ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
                <Text style={styles.secondaryButtonText}>
                  {isMarkingSent ? 'Updating...' : 'Mark as Sent'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {quote.status === 'sent' && (
            <TouchableOpacity style={styles.successButton} onPress={handleAccept}>
              <Feather name="check-circle" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Mark as Accepted</Text>
            </TouchableOpacity>
          )}

          {quote.status === 'accepted' && !linkedJob && (
            <TouchableOpacity 
              style={[styles.primaryButton, linkedInvoice && { marginBottom: 0 }]} 
              onPress={handleConvertToJob}
              disabled={isCreatingJob}
              data-testid="button-create-job-bottom"
            >
              {isCreatingJob ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Feather name="briefcase" size={20} color={colors.white} />
              )}
              <Text style={styles.primaryButtonText}>
                {isCreatingJob ? 'Creating Job...' : 'Create Job from Quote'}
              </Text>
            </TouchableOpacity>
          )}
          
          {quote.status === 'accepted' && !linkedInvoice && (
            <TouchableOpacity 
              style={[styles.primaryButton, { marginTop: linkedJob ? 0 : 12 }]} 
              onPress={handleConvertToInvoice}
              disabled={isCreatingInvoice}
              data-testid="button-create-invoice-bottom"
            >
              {isCreatingInvoice ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Feather name="file-text" size={20} color={colors.white} />
              )}
              <Text style={styles.primaryButtonText}>
                {isCreatingInvoice ? 'Creating Invoice...' : 'Convert to Invoice'}
              </Text>
            </TouchableOpacity>
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
            <Text style={styles.previewModalTitle}>Quote Preview</Text>
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
            type="quote"
            documentNumber={quote.quoteNumber}
            date={quote.createdAt}
            validUntil={quote.validUntil}
            lineItems={lineItems.map((item: any) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            }))}
            notes={quote.notes}
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
            showDepositSection={!!quote.depositAmount && quote.depositAmount > 0}
            depositPercent={quote.depositAmount && quote.total ? Math.round((quote.depositAmount / quote.total) * 100) : 0}
            gstEnabled={user?.gstEnabled !== false}
            status={quote.status}
            templateId={businessSettings?.documentTemplate}
            templateCustomization={businessSettings?.documentTemplateSettings}
            jobSignatures={allSignatures.map(sig => ({
              id: sig.id,
              signerName: sig.signerName || 'Client',
              signatureData: sig.signatureData,
              signedAt: sig.signedAt || new Date().toISOString(),
              documentType: sig.documentType,
            }))}
            acceptedAt={quote.acceptedAt}
            acceptedBy={quote.acceptedBy}
            clientSignatureData={client?.savedSignatureData}
          />
        </View>
      </Modal>

      {/* Email Compose Modal */}
      <EmailComposeModal
        visible={showEmailCompose}
        onClose={() => setShowEmailCompose(false)}
        type="quote"
        documentId={id!}
        clientName={client?.name || 'Client'}
        clientEmail={client?.email || ''}
        documentNumber={quote?.quoteNumber || ''}
        documentTitle={quote?.title || 'Quote'}
        total={formatCurrency(quote?.total || 0)}
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
            <Text style={styles.shareSheetTitle}>Share Quote</Text>
            <Text style={styles.shareSheetSubtitle}>{quote?.quoteNumber}</Text>
            
            <View style={styles.shareOptions}>
              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleEmailQuote}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="mail" size={22} color={colors.primary} />
                </View>
                <Text style={styles.shareOptionText}>Email to Client</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={() => {
                  setShowShareSheet(false);
                  handleCopyLink();
                }}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="link" size={22} color={colors.info} />
                </View>
                <Text style={styles.shareOptionText}>Copy Quote Link</Text>
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

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSaveToDevice}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="download" size={22} color={colors.info} />
                </View>
                <Text style={styles.shareOptionText}>Save to Device</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSharePdf}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="printer" size={22} color={colors.warning} />
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
    backgroundColor: colors.primaryLight,
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
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButtonsContainer: {
    marginTop: 8,
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
  acceptanceCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  acceptanceText: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginBottom: 16,
  },
  signaturePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signaturePlaceholderText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  acceptedCard: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  signatureImageContainer: {
    marginBottom: 12,
  },
  signatureLabel: {
    fontSize: 12,
    color: colors.successDark,
    marginBottom: 8,
  },
  acceptedInfo: {
    fontSize: 13,
    color: colors.successDark,
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
});

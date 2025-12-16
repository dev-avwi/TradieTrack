import { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQuotesStore, useClientsStore, useAuthStore } from '../../../src/lib/store';
import { colors } from '../../../src/lib/colors';
import LiveDocumentPreview from '../../../src/components/LiveDocumentPreview';
import { EmailComposeModal } from '../../../src/components/EmailComposeModal';
import { API_URL } from '../../../src/lib/api';

const TEMPLATE_OPTIONS = [
  { id: 'professional', name: 'Professional', description: 'Clean, minimal design' },
  { id: 'modern', name: 'Modern', description: 'Contemporary with accent colors' },
  { id: 'classic', name: 'Classic', description: 'Traditional business style' },
  { id: 'bold', name: 'Bold', description: 'Strong branding focus' },
];

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: colors.warning, bg: colors.warningLight },
  sent: { label: 'Sent', color: colors.info, bg: colors.infoLight },
  accepted: { label: 'Accepted', color: colors.success, bg: colors.successLight },
  rejected: { label: 'Rejected', color: colors.destructive, bg: colors.destructiveLight },
  expired: { label: 'Expired', color: colors.mutedForeground, bg: colors.cardHover },
};

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getQuote, updateQuoteStatus } = useQuotesStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, token, businessSettings } = useAuthStore();
  const [quote, setQuote] = useState<any>(null);
  const [quoteSignature, setQuoteSignature] = useState<any>(null);
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
  
  const brandColor = businessSettings?.primaryColor || user?.brandColor || '#2563eb';

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    const quoteData = await getQuote(id!);
    setQuote(quoteData);
    await fetchClients();
    
    // Fetch signature if quote is accepted
    if (quoteData?.status === 'accepted') {
      try {
        const response = await fetch(`${API_URL}/api/digital-signatures?documentType=quote&documentId=${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const signatures = await response.json();
          if (signatures.length > 0) {
            setQuoteSignature(signatures[0]);
          }
        }
      } catch (err) {
        console.log('Could not fetch signature:', err);
      }
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
    setShowEmailCompose(true);
  };

  const handleEmailSend = async (subject: string, message: string) => {
    let emailSent = false;
    let apiError = false;
    
    try {
      const response = await fetch(`${API_URL}/api/quotes/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
      console.log('Network error sending quote:', networkError);
      apiError = true;
    }

    if (emailSent) {
      await loadData();
      setShowEmailCompose(false);
      Alert.alert('Success', 'Quote sent successfully to the client');
      return;
    }

    if (apiError) {
      const statusSuccess = await updateQuoteStatus(id!, 'sent');
      if (statusSuccess) {
        await loadData();
        setShowEmailCompose(false);
        Alert.alert('Quote Updated', 'Quote marked as sent. Email delivery may be delayed due to network issues.');
        return;
      }
    }

    throw new Error('Unable to send quote. Please check your connection and try again.');
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
    router.push({
      pathname: '/more/invoice/new',
      params: { quoteId: id }
    });
  };

  const downloadPdfToCache = useCallback(async (): Promise<string | null> => {
    if (!quote) return null;
    
    try {
      const fileUri = `${FileSystem.cacheDirectory}${quote.quoteNumber || 'quote'}.pdf`;
      
      const downloadResult = await FileSystem.downloadAsync(
        `${API_URL}/api/quotes/${id}/pdf`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
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
  }, [quote, id, token]);

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
            {quote.status === 'accepted' && (
              <TouchableOpacity 
                style={[styles.quickAction, styles.quickActionPrimary]}
                onPress={handleConvertToInvoice}
              >
                <Feather name="arrow-right" size={20} color={colors.white} />
                <Text style={[styles.quickActionText, { color: colors.white }]}>Invoice</Text>
              </TouchableOpacity>
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

          {/* Accepted Quote Signature */}
          {quote.status === 'accepted' && quoteSignature && (
            <>
              <Text style={styles.sectionTitle}>Quote Accepted</Text>
              <View style={[styles.card, styles.acceptedCard]}>
                <View style={styles.signatureImageContainer}>
                  <Text style={styles.signatureLabel}>Client Signature:</Text>
                </View>
                {quoteSignature.signerName && (
                  <Text style={styles.acceptedInfo}>
                    Accepted by: {quoteSignature.signerName}
                  </Text>
                )}
                {quoteSignature.signedAt && (
                  <Text style={styles.acceptedInfo}>
                    Date: {formatDate(quoteSignature.signedAt)}
                  </Text>
                )}
              </View>
            </>
          )}

          {quote.status === 'accepted' && !quoteSignature && quote.acceptedBy && (
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
            <TouchableOpacity style={styles.primaryButton} onPress={handleSend}>
              <Feather name="send" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Send to Client</Text>
            </TouchableOpacity>
          )}
          
          {quote.status === 'sent' && (
            <TouchableOpacity style={styles.successButton} onPress={handleAccept}>
              <Feather name="check-circle" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Mark as Accepted</Text>
            </TouchableOpacity>
          )}

          {quote.status === 'accepted' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleConvertToInvoice}>
              <Feather name="arrow-right" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Convert to Invoice</Text>
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
            <View style={{ width: 40 }} />
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
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  signatureImageContainer: {
    marginBottom: 12,
  },
  signatureLabel: {
    fontSize: 12,
    color: '#166534',
    marginBottom: 8,
  },
  acceptedInfo: {
    fontSize: 13,
    color: '#166534',
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

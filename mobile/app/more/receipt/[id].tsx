import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Share,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { API_URL, api } from '../../../src/lib/api';
import { spacing, radius, shadows, typography, iconSizes } from '../../../src/lib/design-tokens';
import { format } from 'date-fns';

interface ReceiptData {
  id: string;
  userId: string;
  invoiceId: string | null;
  receiptNumber: string;
  amount: number;
  gstAmount: number | null;
  paymentMethod: string;
  paymentReference: string | null;
  paidAt: string | null;
  clientId: string | null;
  notes: string | null;
  createdAt: string;
}

interface ClientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  title: string | null;
  jobId: string | null;
}

interface JobData {
  id: string;
  title: string;
  address: string | null;
}

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, businessSettings } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  
  const brandColor = businessSettings?.brandColor || user?.brandColor || '#22c55e';

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const receiptRes = await api.get<ReceiptData>(`/api/receipts/${id}`);
      if (receiptRes.data) {
        setReceipt(receiptRes.data);
        
        if (receiptRes.data.clientId) {
          const clientRes = await api.get<ClientData>(`/api/clients/${receiptRes.data.clientId}`);
          if (clientRes.data) setClient(clientRes.data);
        }
        
        if (receiptRes.data.invoiceId) {
          const invoiceRes = await api.get<InvoiceData>(`/api/invoices/${receiptRes.data.invoiceId}`);
          if (invoiceRes.data) {
            setInvoice(invoiceRes.data);
            
            if (invoiceRes.data.jobId) {
              const jobRes = await api.get<JobData>(`/api/jobs/${invoiceRes.data.jobId}`);
              if (jobRes.data) setJob(jobRes.data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      'card': 'Card Payment',
      'tap_to_pay': 'Tap to Pay',
      'bank_transfer': 'Bank Transfer',
      'cash': 'Cash',
      'cheque': 'Cheque',
      'eftpos': 'EFTPOS',
      'stripe': 'Online Payment',
      'manual': 'Manual Payment',
      'payment_link': 'Payment Link',
      'qr_code': 'QR Code',
      'other': 'Other',
    };
    return methods[method?.toLowerCase()] || method;
  };

  const downloadPdfToCache = useCallback(async (): Promise<string | null> => {
    if (!receipt) return null;
    
    try {
      const authToken = await api.getToken();
      const fileUri = `${FileSystem.cacheDirectory}Receipt-${receipt.receiptNumber || id}.pdf`;
      
      const downloadResult = await FileSystem.downloadAsync(
        `${API_URL}/api/receipts/${id}/pdf`,
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
  }, [receipt, id]);

  const handleSharePdf = async () => {
    if (!receipt || isDownloadingPdf) return;
    
    setIsDownloadingPdf(true);
    try {
      const uri = await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Receipt ${receipt.receiptNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.log('Share PDF error:', error);
      Alert.alert('Error', 'Failed to share PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleNavigateToInvoice = () => {
    if (invoice) {
      router.push(`/more/invoice/${invoice.id}`);
    }
  };

  const handleNavigateToJob = () => {
    if (job) {
      router.push(`/job/${job.id}`);
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Receipt' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!receipt) {
    return (
      <>
        <Stack.Screen options={{ title: 'Receipt' }} />
        <View style={styles.errorContainer}>
          <Feather name="file" size={48} color={colors.mutedForeground} />
          <Text style={styles.errorTitle}>Receipt Not Found</Text>
          <Text style={styles.errorText}>This receipt could not be found or may have been deleted.</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const subtotal = receipt.gstAmount ? receipt.amount - receipt.gstAmount : receipt.amount;
  const gst = receipt.gstAmount || 0;

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: receipt.receiptNumber || 'Receipt',
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleSharePdf}
              style={styles.headerButton}
              disabled={isDownloadingPdf}
            >
              {isDownloadingPdf ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="share" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          )
        }} 
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <View style={[styles.headerSection, { borderBottomColor: brandColor }]}>
            <View style={styles.businessInfo}>
              {businessSettings?.logoUrl && (
                <Image 
                  source={{ uri: businessSettings.logoUrl }} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.businessName}>
                {businessSettings?.businessName || 'Your Business Name'}
              </Text>
              {businessSettings?.abn && (
                <Text style={styles.businessDetail}>ABN: {businessSettings.abn}</Text>
              )}
              {businessSettings?.address && (
                <Text style={styles.businessDetail}>{businessSettings.address}</Text>
              )}
              {businessSettings?.phone && (
                <Text style={styles.businessDetail}>Phone: {businessSettings.phone}</Text>
              )}
              {businessSettings?.email && (
                <Text style={styles.businessDetail}>Email: {businessSettings.email}</Text>
              )}
            </View>
            
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptTitle}>RECEIPT</Text>
              <Text style={styles.receiptNumber}>{receipt.receiptNumber}</Text>
              {receipt.paidAt && (
                <Text style={styles.receiptDate}>
                  {format(new Date(receipt.paidAt), 'd MMMM yyyy, h:mm a')}
                </Text>
              )}
              <View style={styles.paidBadge}>
                <Feather name="check-circle" size={14} color="#ffffff" />
                <Text style={styles.paidBadgeText}>Paid</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.infoColumn}>
                <Text style={styles.sectionLabel}>RECEIVED FROM</Text>
                <Text style={styles.clientName}>{client?.name || 'Customer'}</Text>
                {client?.address && <Text style={styles.infoText}>{client.address}</Text>}
                {client?.email && <Text style={styles.infoText}>{client.email}</Text>}
                {client?.phone && <Text style={styles.infoText}>{client.phone}</Text>}
              </View>
              
              <View style={styles.infoColumn}>
                <Text style={styles.sectionLabel}>PAYMENT DETAILS</Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Date: </Text>
                  {receipt.paidAt 
                    ? format(new Date(receipt.paidAt), 'd MMMM yyyy') 
                    : format(new Date(receipt.createdAt), 'd MMMM yyyy')}
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Method: </Text>
                  {formatPaymentMethod(receipt.paymentMethod)}
                </Text>
                {receipt.paymentReference && (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Reference: </Text>
                    {receipt.paymentReference}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={[styles.paymentSummary, { borderColor: '#22c55e' }]}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Payment Received</Text>
              <View style={styles.paidBadgeSmall}>
                <Text style={styles.paidBadgeSmallText}>Paid</Text>
              </View>
            </View>
            
            {gst > 0 && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal (excl. GST)</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryDivider]}>
                  <Text style={styles.summaryLabel}>GST (10%)</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(gst)}</Text>
                </View>
              </>
            )}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Amount Paid {gst > 0 ? '(incl. GST)' : ''}
              </Text>
              <Text style={styles.totalValue}>{formatCurrency(receipt.amount)}</Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>{formatPaymentMethod(receipt.paymentMethod)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValueSmall} numberOfLines={1}>{receipt.id}</Text>
            </View>
            {receipt.paidAt && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {format(new Date(receipt.paidAt), 'd MMMM yyyy, h:mm a')}
                </Text>
              </View>
            )}
            {receipt.paymentReference && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Reference</Text>
                <Text style={styles.detailValue}>{receipt.paymentReference}</Text>
              </View>
            )}
          </View>

          {invoice && (
            <TouchableOpacity 
              style={[styles.referenceCard, { borderLeftColor: brandColor }]}
              onPress={handleNavigateToInvoice}
              activeOpacity={0.7}
            >
              <Text style={styles.referenceLabel}>INVOICE REFERENCE</Text>
              <View style={styles.referenceRow}>
                <Text style={[styles.referenceLink, { color: brandColor }]}>
                  Invoice #{invoice.invoiceNumber}
                </Text>
                <Feather name="chevron-right" size={18} color={brandColor} />
              </View>
              {invoice.title && <Text style={styles.referenceSubtext}>{invoice.title}</Text>}
            </TouchableOpacity>
          )}

          {job && (
            <TouchableOpacity 
              style={[styles.referenceCard, { borderLeftColor: brandColor }]}
              onPress={handleNavigateToJob}
              activeOpacity={0.7}
            >
              <Text style={styles.referenceLabel}>JOB REFERENCE</Text>
              <View style={styles.referenceRow}>
                <Text style={[styles.referenceLink, { color: brandColor }]}>{job.title}</Text>
                <Feather name="chevron-right" size={18} color={brandColor} />
              </View>
              {job.address && <Text style={styles.referenceSubtext}>{job.address}</Text>}
            </TouchableOpacity>
          )}

          <View style={[styles.thankYouSection, { backgroundColor: `${brandColor}10` }]}>
            <Text style={[styles.thankYouText, { color: brandColor }]}>
              Thank you for your payment!
            </Text>
            <Text style={styles.thankYouSubtext}>
              This receipt confirms your payment has been received and processed.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Payment Receipt from {businessSettings?.businessName || 'Your Business'}
            </Text>
            {businessSettings?.abn && (
              <Text style={styles.footerText}>ABN: {businessSettings.abn}</Text>
            )}
            <Text style={styles.footerBrand}>Generated by TradieTrack</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleSharePdf}
          disabled={isDownloadingPdf}
          activeOpacity={0.7}
        >
          {isDownloadingPdf ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="download" size={18} color={colors.primaryForeground} />
              <Text style={styles.shareButtonText}>Download / Share PDF</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
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
    padding: spacing['2xl'],
    backgroundColor: colors.background,
  },
  errorTitle: {
    ...typography.sectionTitle,
    color: colors.foreground,
    marginTop: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  backButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  backButtonText: {
    ...typography.bodySemibold,
    color: colors.primaryForeground,
  },
  headerButton: {
    padding: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.md,
  },
  headerSection: {
    padding: spacing.lg,
    borderBottomWidth: 3,
  },
  businessInfo: {
    marginBottom: spacing.lg,
  },
  logo: {
    width: 120,
    height: 50,
    marginBottom: spacing.sm,
  },
  businessName: {
    ...typography.sectionTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  businessDetail: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  receiptHeader: {
    alignItems: 'flex-end',
  },
  receiptTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
    letterSpacing: 2,
  },
  receiptNumber: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  receiptDate: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  paidBadgeText: {
    ...typography.captionSemibold,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  section: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  infoColumn: {
    flex: 1,
  },
  sectionLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  clientName: {
    ...typography.bodySemibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  infoLabel: {
    fontWeight: '600',
  },
  paymentSummary: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: '#f0fdf4',
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.subtitle,
    color: '#15803d',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paidBadgeSmall: {
    backgroundColor: '#22c55e',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  paidBadgeSmallText: {
    ...typography.captionSmall,
    color: '#ffffff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  summaryLabel: {
    ...typography.body,
    color: '#15803d',
  },
  summaryValue: {
    ...typography.bodySemibold,
    color: '#15803d',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: '#22c55e',
  },
  totalLabel: {
    ...typography.cardTitle,
    color: '#15803d',
    fontWeight: '700',
  },
  totalValue: {
    ...typography.cardTitle,
    color: '#15803d',
    fontWeight: '700',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  detailItem: {
    width: '48%',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  detailValue: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  detailValueSmall: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  referenceCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  referenceLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  referenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  referenceLink: {
    ...typography.bodySemibold,
    textDecorationLine: 'underline',
  },
  referenceSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  thankYouSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  thankYouText: {
    ...typography.cardTitle,
    fontWeight: '600',
  },
  thankYouSubtext: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  footerBrand: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  shareButtonText: {
    ...typography.bodySemibold,
    color: colors.primaryForeground,
  },
});

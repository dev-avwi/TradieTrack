import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { 
  getTemplateStyles, 
  TemplateId, 
  TemplateCustomization, 
  DEFAULT_TEMPLATE,
  DOCUMENT_ACCENT_COLOR
} from '../lib/document-templates';
import { colors as themeColors } from '../lib/colors';

const tradieTrackLogo = require('../../assets/tradietrack-logo.png');

interface LineItem {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
}

interface BusinessInfo {
  businessName?: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  brandColor?: string;
  gstEnabled?: boolean;
  licenseNumber?: string;
  paymentInstructions?: string;
  bankDetails?: string;
  lateFeeRate?: string;
  warrantyPeriod?: string;
}

interface ClientInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface SignatureInfo {
  dataUrl: string;
  signedBy?: string;
  signedAt?: string;
}

interface LiveDocumentPreviewProps {
  type: 'quote' | 'invoice';
  documentNumber?: string;
  title?: string;
  description?: string;
  date?: string;
  validUntil?: string;
  dueDate?: string;
  lineItems: LineItem[];
  notes?: string;
  terms?: string;
  business: BusinessInfo;
  client: ClientInfo | null;
  showDepositSection?: boolean;
  depositPercent?: number;
  gstEnabled?: boolean;
  status?: string;
  jobAddress?: string;
  jobScheduledDate?: string;
  templateId?: TemplateId;
  templateCustomization?: TemplateCustomization;
  signature?: SignatureInfo;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const colors = {
  white: '#FFFFFF',
  background: themeColors.muted,
  text: themeColors.foreground,
  textMuted: themeColors.mutedForeground,
  textLight: themeColors.secondaryText,
  textLighter: themeColors.mutedForeground,
  border: themeColors.border,
  borderLight: themeColors.borderLight,
  success: themeColors.success,
  successBg: themeColors.successLight,
  successText: themeColors.successDark,
  destructive: themeColors.destructive,
  destructiveBg: themeColors.destructiveLight,
  destructiveText: themeColors.destructiveDark,
  warning: themeColors.warning,
  warningBg: themeColors.warningLight,
  warningText: themeColors.warningDark,
  info: themeColors.info,
  infoBg: themeColors.infoLight,
  primary: themeColors.primary,
  primaryLight: themeColors.primaryLight,
};

export default function LiveDocumentPreview({
  type,
  documentNumber,
  title,
  description,
  date,
  validUntil,
  dueDate,
  lineItems,
  notes,
  terms,
  business,
  client,
  showDepositSection = false,
  depositPercent = 50,
  gstEnabled = true,
  status,
  jobAddress,
  jobScheduledDate,
  templateId = DEFAULT_TEMPLATE,
  templateCustomization,
  signature,
}: LiveDocumentPreviewProps) {
  const safeParseFloat = (val: string | number): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateLineTotal = (item: LineItem): number => {
    const qty = safeParseFloat(item.quantity);
    const price = safeParseFloat(item.unitPrice);
    return qty * price;
  };

  const validLineItems = lineItems.filter(item => {
    const qty = safeParseFloat(item.quantity);
    const price = safeParseFloat(item.unitPrice);
    return item.description && qty > 0 && price >= 0;
  });

  const subtotal = validLineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const gst = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gst;
  const depositAmount = showDepositSection ? total * ((depositPercent || 0) / 100) : 0;
  
  const brandColor = business.brandColor || '#2563eb';
  const isPaid = status === 'paid';
  const isOverdue = status === 'overdue';
  const isAccepted = status === 'accepted';
  
  const templateStyles = getTemplateStyles(templateId, brandColor, templateCustomization);
  const { template, primaryColor, headingStyle, tableHeaderStyle, getTableRowStyle, getNoteStyle } = templateStyles;

  const documentTitle = type === 'quote' 
    ? 'QUOTE' 
    : gstEnabled 
      ? (isPaid ? 'TAX INVOICE / RECEIPT' : 'TAX INVOICE')
      : (isPaid ? 'INVOICE / RECEIPT' : 'INVOICE');

  const getStatusBadgeStyle = (s: string) => {
    switch (s) {
      case 'draft': return { background: colors.border, color: colors.text };
      case 'sent': return { background: colors.infoBg, color: colors.info };
      case 'accepted': return { background: colors.successBg, color: colors.successText };
      case 'declined': return { background: colors.destructiveBg, color: colors.destructiveText };
      case 'paid': return { background: colors.successBg, color: colors.successText };
      case 'overdue': return { background: colors.destructiveBg, color: colors.destructiveText };
      case 'pending': return { background: colors.warningBg, color: colors.warningText };
      default: return { background: colors.border, color: colors.text };
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 40,
    },
    documentCard: {
      backgroundColor: colors.white,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#e2e8f0',
    },
    documentContent: {
      padding: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24,
      paddingBottom: 16,
      borderBottomWidth: template.showHeaderDivider ? template.headerBorderWidth : 0,
      borderBottomColor: template.showHeaderDivider ? primaryColor : 'transparent',
    },
    companyInfo: {
      flex: 1,
      marginRight: 16,
    },
    logo: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginBottom: 12,
    },
    logoPlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: '#f1f5f9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    businessName: {
      fontSize: 20,
      fontWeight: headingStyle.fontWeight as any,
      color: headingStyle.color,
      marginBottom: 8,
    },
    businessDetails: {
      gap: 2,
    },
    businessDetail: {
      fontSize: 10,
      color: colors.textMuted,
      lineHeight: 16,
    },
    businessDetailBold: {
      fontWeight: '600',
    },
    documentMeta: {
      alignItems: 'flex-end',
    },
    documentType: {
      fontSize: gstEnabled && type === 'invoice' ? 20 : 24,
      fontWeight: headingStyle.fontWeight as any,
      color: isPaid ? colors.success : headingStyle.color,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    documentNumber: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 8,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    infoSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
      gap: 24,
    },
    infoColumn: {
      flex: 1,
    },
    sectionLabel: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textLight,
      fontWeight: '600',
      marginBottom: 6,
    },
    clientName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    clientDetail: {
      fontSize: 11,
      color: colors.text,
      lineHeight: 18,
    },
    placeholder: {
      fontSize: 12,
      color: colors.textLight,
      fontStyle: 'italic',
    },
    detailRow: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      marginRight: 4,
    },
    detailValue: {
      fontSize: 11,
      color: colors.text,
    },
    descriptionSection: {
      backgroundColor: '#f8f9fa',
      borderRadius: 6,
      padding: 16,
      marginBottom: 24,
    },
    descriptionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: primaryColor,
      marginBottom: 8,
    },
    descriptionText: {
      fontSize: 11,
      color: colors.text,
      lineHeight: 18,
    },
    table: {
      marginBottom: 24,
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: tableHeaderStyle.backgroundColor,
      borderBottomWidth: tableHeaderStyle.borderBottomWidth,
      borderBottomColor: tableHeaderStyle.borderBottomColor,
      borderRadius: template.borderRadius,
    },
    tableHeaderCell: {
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: tableHeaderStyle.color,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    tableCell: {
      fontSize: 11,
      color: colors.text,
    },
    descCol: { flex: 1 },
    qtyCol: { width: 40, textAlign: 'right' },
    priceCol: { width: 70, textAlign: 'right' },
    amountCol: { width: 70, textAlign: 'right' },
    emptyRow: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 11,
      color: colors.textLight,
      fontStyle: 'italic',
    },
    totalsContainer: {
      alignItems: 'flex-end',
      marginBottom: 24,
    },
    totalsBox: {
      width: '60%',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    totalLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    totalValue: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    grandTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      marginTop: 4,
      borderTopWidth: 2,
      borderTopColor: isPaid ? colors.success : primaryColor,
    },
    grandTotalLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: isPaid ? colors.success : primaryColor,
    },
    grandTotalValue: {
      fontSize: 14,
      fontWeight: '700',
      color: isPaid ? colors.success : primaryColor,
    },
    gstNote: {
      fontSize: 9,
      color: colors.textLight,
      textAlign: 'right',
      marginTop: 4,
    },
    depositSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    depositRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    depositLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    depositValue: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    notesSection: {
      marginBottom: 24,
      padding: 16,
    },
    notesSectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
    },
    notesText: {
      fontSize: 10,
      color: colors.textMuted,
      lineHeight: 16,
    },
    termsSection: {
      marginBottom: 24,
    },
    termsTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
    },
    termsText: {
      fontSize: 9,
      color: colors.textMuted,
      lineHeight: 14,
    },
    acceptanceSection: {
      marginTop: 24,
      padding: 20,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: '#ddd',
      borderRadius: 8,
    },
    acceptanceTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: '#333',
      marginBottom: 12,
    },
    acceptanceText: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 20,
      lineHeight: 16,
    },
    signatureRow: {
      flexDirection: 'row',
      gap: 16,
    },
    signatureBox: {
      flex: 1,
    },
    signatureLabel: {
      fontSize: 10,
      color: colors.textLight,
      marginBottom: 20,
    },
    signatureLine: {
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },
    confirmationBox: {
      backgroundColor: colors.successBg,
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
      borderRadius: 6,
      padding: 16,
      marginBottom: 24,
    },
    confirmationTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.successText,
      marginBottom: 4,
    },
    confirmationText: {
      fontSize: 10,
      color: colors.successText,
    },
    footer: {
      marginTop: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 9,
      color: colors.textLighter,
      textAlign: 'center',
      marginBottom: 4,
    },
    paidWatermarkContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      pointerEvents: 'none',
    },
    paidWatermark: {
      fontSize: 72,
      fontWeight: '800',
      color: colors.success,
      opacity: 0.08,
      transform: [{ rotate: '-30deg' }],
      letterSpacing: 8,
    },
    paidBadge: {
      position: 'absolute',
      top: 24,
      right: 24,
      backgroundColor: colors.successBg,
      borderWidth: 2,
      borderColor: colors.success,
      borderRadius: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
      zIndex: 10,
    },
    paidBadgeText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.successText,
      letterSpacing: 2,
    },
    signatureDisplaySection: {
      marginTop: 24,
      marginBottom: 24,
      padding: 20,
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    signatureDisplayTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 12,
    },
    signatureImage: {
      width: '100%',
      height: 80,
      backgroundColor: colors.white,
      borderRadius: 4,
      marginBottom: 8,
    },
    signatureMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    signatureMetaText: {
      fontSize: 10,
      color: colors.textMuted,
    },
    signatureMetaValue: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text,
    },
  }), [template, primaryColor, headingStyle, isPaid, gstEnabled, type, tableHeaderStyle]);

  const noteStyle = getNoteStyle();

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.documentCard}>
        {/* PAID Watermark - displayed for paid invoices */}
        {type === 'invoice' && isPaid && (
          <View style={styles.paidWatermarkContainer}>
            <Text style={styles.paidWatermark}>PAID</Text>
          </View>
        )}
        
        {/* PAID Badge - prominent indicator for paid invoices */}
        {type === 'invoice' && isPaid && (
          <View style={styles.paidBadge}>
            <Text style={styles.paidBadgeText}>PAID</Text>
          </View>
        )}
        
        <View style={styles.documentContent}>
          {/* Header - Business Info LEFT, Document Type RIGHT */}
          <View style={styles.header}>
            {/* Company Info - Left Side */}
            <View style={styles.companyInfo}>
              {business.logoUrl && (
                <Image 
                  source={{ uri: business.logoUrl }} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.businessName}>
                {business.businessName || 'Your Business Name'}
              </Text>
              <View style={styles.businessDetails}>
                {business.abn && (
                  <Text style={styles.businessDetail}>
                    <Text style={styles.businessDetailBold}>ABN:</Text> {business.abn}
                  </Text>
                )}
                {business.address && (
                  <Text style={styles.businessDetail}>{business.address}</Text>
                )}
                {business.phone && (
                  <Text style={styles.businessDetail}>Phone: {business.phone}</Text>
                )}
                {business.email && (
                  <Text style={styles.businessDetail}>Email: {business.email}</Text>
                )}
                {business.licenseNumber && (
                  <Text style={styles.businessDetail}>Licence No: {business.licenseNumber}</Text>
                )}
              </View>
            </View>

            {/* Document Type - Right Side */}
            <View style={styles.documentMeta}>
              <Text style={styles.documentType}>{documentTitle}</Text>
              <Text style={styles.documentNumber}>{documentNumber || 'AUTO'}</Text>
              {status && (
                <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeStyle(status).background }]}>
                  <Text style={[styles.statusText, { color: getStatusBadgeStyle(status).color }]}>
                    {status.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Info Section - Bill To & Document Details */}
          <View style={styles.infoSection}>
            {/* Bill To / Quote For */}
            <View style={styles.infoColumn}>
              <Text style={styles.sectionLabel}>
                {type === 'quote' ? 'Quote For' : 'Bill To'}
              </Text>
              {client ? (
                <>
                  <Text style={styles.clientName}>{client.name}</Text>
                  {client.address && <Text style={styles.clientDetail}>{client.address}</Text>}
                  {client.email && <Text style={styles.clientDetail}>{client.email}</Text>}
                  {client.phone && <Text style={styles.clientDetail}>{client.phone}</Text>}
                </>
              ) : (
                <Text style={styles.placeholder}>Select a client...</Text>
              )}
            </View>

            {/* Document Details */}
            <View style={styles.infoColumn}>
              <Text style={styles.sectionLabel}>
                {type === 'quote' ? 'Quote Details' : 'Invoice Details'}
              </Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date:</Text>
                <Text style={styles.detailValue}>{formatDate(date || new Date().toISOString())}</Text>
              </View>
              {type === 'quote' && validUntil && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Valid Until:</Text>
                  <Text style={styles.detailValue}>{formatDate(validUntil)}</Text>
                </View>
              )}
              {type === 'invoice' && dueDate && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Due Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(dueDate)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Job Site Location */}
          {jobAddress && (
            <View style={[styles.infoSection, { marginTop: 8 }]}>
              <View style={styles.infoColumn}>
                <Text style={styles.sectionLabel}>Job Site Location</Text>
                <Text style={styles.clientName}>{jobAddress}</Text>
                {jobScheduledDate && (
                  <Text style={[styles.clientDetail, { color: colors.textMuted }]}>
                    {type === 'quote' ? 'Scheduled:' : 'Completed:'} {formatDate(jobScheduledDate)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Description Section */}
          {(title || description) && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionTitle}>
                {title || `New ${type === 'quote' ? 'Quote' : 'Invoice'}`}
              </Text>
              {description && (
                <Text style={styles.descriptionText}>{description}</Text>
              )}
            </View>
          )}

          {/* Line Items Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.descCol]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.qtyCol]}>Qty</Text>
              <Text style={[styles.tableHeaderCell, styles.priceCol]}>Unit Price</Text>
              <Text style={[styles.tableHeaderCell, styles.amountCol]}>Amount</Text>
            </View>
            
            {validLineItems.length > 0 ? (
              validLineItems.map((item, index) => {
                const rowStyle = getTableRowStyle(index, index === validLineItems.length - 1);
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.tableRow, 
                      { 
                        borderBottomWidth: rowStyle.borderBottomWidth,
                        borderBottomColor: rowStyle.borderBottomColor,
                        backgroundColor: rowStyle.backgroundColor,
                      }
                    ]}
                  >
                    <Text style={[styles.tableCell, styles.descCol]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={[styles.tableCell, styles.qtyCol]}>
                      {safeParseFloat(item.quantity).toFixed(2)}
                    </Text>
                    <Text style={[styles.tableCell, styles.priceCol]}>
                      {formatCurrency(safeParseFloat(item.unitPrice))}
                    </Text>
                    <Text style={[styles.tableCell, styles.amountCol, { fontWeight: '600' }]}>
                      {formatCurrency(calculateLineTotal(item))}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Add line items to see them here...</Text>
              </View>
            )}
          </View>

          {/* Totals Section */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
              </View>
              {gstEnabled && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>GST (10%)</Text>
                  <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
                </View>
              )}
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>
                  {isPaid ? 'Amount Paid' : `Total${gstEnabled ? ' (incl. GST)' : ''}`}
                </Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
              </View>
              {gstEnabled && (
                <Text style={styles.gstNote}>GST included in total</Text>
              )}
              
              {/* Deposit Section */}
              {showDepositSection && depositPercent > 0 && (
                <View style={styles.depositSection}>
                  <View style={styles.depositRow}>
                    <Text style={styles.depositLabel}>Deposit Required ({depositPercent}%):</Text>
                    <Text style={styles.depositValue}>{formatCurrency(depositAmount)}</Text>
                  </View>
                  <View style={styles.depositRow}>
                    <Text style={styles.depositLabel}>Balance on completion:</Text>
                    <Text style={styles.depositValue}>{formatCurrency(total - depositAmount)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Notes Section */}
          {notes && (
            <View style={[styles.notesSection, noteStyle]}>
              <Text style={styles.notesSectionTitle}>Additional Notes</Text>
              <Text style={styles.notesText}>{notes}</Text>
            </View>
          )}

          {/* Terms Section */}
          {terms && (
            <View style={styles.termsSection}>
              <Text style={styles.termsTitle}>Terms & Conditions</Text>
              <Text style={styles.termsText}>{terms}</Text>
            </View>
          )}

          {/* Quote Acceptance Section */}
          {type === 'quote' && status !== 'accepted' && status !== 'declined' && (
            <View style={styles.acceptanceSection}>
              <Text style={styles.acceptanceTitle}>Quote Acceptance</Text>
              <Text style={styles.acceptanceText}>
                By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
              </Text>
              <View style={styles.signatureRow}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Client Signature</Text>
                  <View style={styles.signatureLine} />
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Print Name</Text>
                  <View style={styles.signatureLine} />
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Date</Text>
                  <View style={styles.signatureLine} />
                </View>
              </View>
            </View>
          )}

          {/* Accepted Quote Confirmation */}
          {type === 'quote' && status === 'accepted' && (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationTitle}>Quote Accepted</Text>
              <Text style={styles.confirmationText}>This quote has been accepted.</Text>
            </View>
          )}

          {/* Payment Received Confirmation */}
          {type === 'invoice' && isPaid && (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationTitle}>Payment Received - Thank You!</Text>
              <Text style={styles.confirmationText}>Amount: {formatCurrency(total)}</Text>
            </View>
          )}

          {/* Captured Signature Display */}
          {signature && signature.dataUrl && (
            <View style={styles.signatureDisplaySection}>
              <Text style={styles.signatureDisplayTitle}>
                <Feather name="edit-3" size={14} color={colors.primary} /> Authorised Signature
              </Text>
              <Image 
                source={{ uri: signature.dataUrl }} 
                style={styles.signatureImage}
                resizeMode="contain"
              />
              {(signature.signedBy || signature.signedAt) && (
                <View style={styles.signatureMetaRow}>
                  {signature.signedBy && (
                    <View>
                      <Text style={styles.signatureMetaText}>Signed by:</Text>
                      <Text style={styles.signatureMetaValue}>{signature.signedBy}</Text>
                    </View>
                  )}
                  {signature.signedAt && (
                    <View>
                      <Text style={styles.signatureMetaText}>Date:</Text>
                      <Text style={styles.signatureMetaValue}>{formatDate(signature.signedAt)}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your business!</Text>
            {business.abn && (
              <Text style={styles.footerText}>ABN: {business.abn}</Text>
            )}
            <Text style={styles.footerText}>Generated by TradieTrack</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

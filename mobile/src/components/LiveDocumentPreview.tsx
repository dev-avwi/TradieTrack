import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';

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
}

interface ClientInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
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

const documentColors = {
  white: '#FFFFFF',
  background: '#F8FAFC',
  text: '#1E293B',
  textMuted: '#64748B',
  textLight: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  primary: '#3B82F6',
  primaryLight: '#EFF6FF',
  destructive: '#EF4444',
  success: '#22C55E',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: documentColors.background,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 40,
  },
  documentCard: {
    backgroundColor: documentColors.white,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: documentColors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  businessSection: {
    flex: 1,
    marginRight: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: documentColors.background,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: documentColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: documentColors.border,
  },
  businessInfo: {
    flex: 1,
    flexShrink: 1,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '700',
    color: documentColors.text,
    marginBottom: 2,
  },
  abnText: {
    fontSize: 10,
    color: documentColors.textMuted,
    marginBottom: 2,
  },
  businessContactRow: {
    marginTop: 6,
  },
  businessDetail: {
    fontSize: 10,
    color: documentColors.textMuted,
    lineHeight: 14,
  },
  documentMeta: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  documentTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    marginBottom: 10,
  },
  documentType: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailsBox: {
    backgroundColor: documentColors.background,
    borderRadius: 6,
    padding: 8,
    minWidth: 130,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: documentColors.textMuted,
  },
  detailValue: {
    fontSize: 11,
    color: documentColors.text,
    fontWeight: '500',
  },
  detailValueMono: {
    fontSize: 11,
    fontWeight: '600',
    color: documentColors.text,
    fontFamily: 'monospace',
  },
  dueDateValue: {
    fontSize: 11,
    fontWeight: '600',
    color: documentColors.destructive,
  },
  documentContent: {
    padding: 20,
    gap: 16,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: documentColors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionBox: {
    backgroundColor: documentColors.background,
    borderRadius: 6,
    padding: 12,
  },
  descriptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: documentColors.text,
  },
  descriptionText: {
    fontSize: 12,
    color: documentColors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  clientName: {
    fontSize: 13,
    fontWeight: '600',
    color: documentColors.text,
  },
  clientDetails: {
    marginTop: 4,
    gap: 1,
  },
  clientDetail: {
    fontSize: 11,
    color: documentColors.textMuted,
    lineHeight: 16,
  },
  placeholder: {
    fontSize: 12,
    color: documentColors.textLight,
    fontStyle: 'italic',
  },
  tableContainer: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: documentColors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: documentColors.background,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: documentColors.border,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: documentColors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: documentColors.borderLight,
    backgroundColor: documentColors.white,
  },
  tableCell: {
    fontSize: 11,
    color: documentColors.text,
  },
  descCell: {
    flex: 1,
    paddingRight: 8,
  },
  qtyCell: {
    width: 35,
  },
  priceCell: {
    width: 65,
  },
  totalCell: {
    width: 65,
  },
  centerText: {
    textAlign: 'center',
  },
  rightText: {
    textAlign: 'right',
  },
  boldText: {
    fontWeight: '600',
  },
  emptyTableRow: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: documentColors.white,
  },
  emptyText: {
    fontSize: 11,
    color: documentColors.textLight,
    fontStyle: 'italic',
  },
  totalsSection: {
    alignItems: 'flex-end',
  },
  totalsContainer: {
    width: '55%',
    gap: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 11,
    color: documentColors.textMuted,
  },
  totalValue: {
    fontSize: 11,
    fontWeight: '600',
    color: documentColors.text,
  },
  grandTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: documentColors.text,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: documentColors.white,
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: documentColors.white,
  },
  depositSection: {
    width: '55%',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: documentColors.borderLight,
  },
  notesText: {
    fontSize: 11,
    color: documentColors.text,
    lineHeight: 17,
  },
  termsText: {
    fontSize: 10,
    color: documentColors.textMuted,
    lineHeight: 15,
  },
  signatureSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: documentColors.border,
    marginTop: 8,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signatureText: {
    fontSize: 11,
    color: documentColors.textMuted,
  },
  footer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: documentColors.border,
    alignItems: 'center',
    marginTop: 8,
  },
  footerContacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 6,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 10,
    color: documentColors.textMuted,
  },
  thankYouText: {
    fontSize: 10,
    color: documentColors.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
});

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
}: LiveDocumentPreviewProps) {
  const brandColor = business.brandColor || documentColors.primary;
  
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

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.documentCard}>
        {/* Header with Business Info and Document Meta */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.businessSection}>
              <View style={styles.logoRow}>
                {business.logoUrl ? (
                  <Image 
                    source={{ uri: business.logoUrl }} 
                    style={styles.logo}
                    resizeMode="contain"
                  />
                ) : (
                  <Image 
                    source={tradieTrackLogo}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                )}
                <View style={styles.businessInfo}>
                  <Text style={styles.businessName}>
                    {business.businessName || 'Your Business'}
                  </Text>
                  {business.abn && (
                    <Text style={styles.abnText}>ABN: {business.abn}</Text>
                  )}
                </View>
              </View>
              {(business.email || business.phone || business.address) && (
                <View style={styles.businessContactRow}>
                  {business.email && <Text style={styles.businessDetail}>{business.email}</Text>}
                  {business.phone && <Text style={styles.businessDetail}>{business.phone}</Text>}
                  {business.address && <Text style={styles.businessDetail}>{business.address}</Text>}
                </View>
              )}
            </View>

            <View style={styles.documentMeta}>
              <View style={[styles.documentTypeBadge, { backgroundColor: brandColor + '15' }]}>
                <Text style={[styles.documentType, { color: brandColor }]}>
                  {type === 'quote' ? 'QUOTE' : (gstEnabled ? 'TAX INVOICE' : 'INVOICE')}
                </Text>
              </View>
              
              <View style={styles.detailsBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{type === 'quote' ? 'Quote' : 'Invoice'} #</Text>
                  <Text style={styles.detailValueMono}>{documentNumber || 'AUTO'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatDate(date || new Date().toISOString())}</Text>
                </View>
                {type === 'quote' && validUntil && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Valid Until</Text>
                    <Text style={styles.detailValue}>{formatDate(validUntil)}</Text>
                  </View>
                )}
                {type === 'invoice' && dueDate && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Due Date</Text>
                    <Text style={styles.dueDateValue}>{formatDate(dueDate)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.documentContent}>
          {/* Bill To Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <View style={styles.sectionBox}>
              {client ? (
                <>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <View style={styles.clientDetails}>
                    {client.address && <Text style={styles.clientDetail}>{client.address}</Text>}
                    {client.phone && <Text style={styles.clientDetail}>{client.phone}</Text>}
                    {client.email && <Text style={styles.clientDetail}>{client.email}</Text>}
                  </View>
                </>
              ) : (
                <Text style={styles.placeholder}>Select a client...</Text>
              )}
            </View>
          </View>

          {/* Work Description */}
          {(title || description) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Work Completed</Text>
              <View style={styles.sectionBox}>
                <Text style={styles.descriptionTitle}>
                  {title || `New ${type === 'quote' ? 'Quote' : 'Invoice'}`}
                </Text>
                {description && (
                  <Text style={styles.descriptionText}>{description}</Text>
                )}
              </View>
            </View>
          )}

          {/* Line Items Table */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items & Services</Text>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.descCell]}>Description</Text>
                <Text style={[styles.tableHeaderCell, styles.qtyCell, styles.centerText]}>Qty</Text>
                <Text style={[styles.tableHeaderCell, styles.priceCell, styles.rightText]}>Price</Text>
                <Text style={[styles.tableHeaderCell, styles.totalCell, styles.rightText]}>Total</Text>
              </View>
              
              {validLineItems.length > 0 ? (
                validLineItems.map((item, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.descCell]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={[styles.tableCell, styles.qtyCell, styles.centerText]}>
                      {safeParseFloat(item.quantity)}
                    </Text>
                    <Text style={[styles.tableCell, styles.priceCell, styles.rightText]}>
                      {formatCurrency(safeParseFloat(item.unitPrice))}
                    </Text>
                    <Text style={[styles.tableCell, styles.totalCell, styles.rightText, styles.boldText]}>
                      {formatCurrency(calculateLineTotal(item))}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyTableRow}>
                  <Text style={styles.emptyText}>Add line items to see them here...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Totals Section */}
          <View style={styles.totalsSection}>
            {gstEnabled ? (
              <View style={styles.totalsContainer}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal:</Text>
                  <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>GST (10%):</Text>
                  <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
                </View>
                <View style={styles.grandTotalBox}>
                  <Text style={styles.grandTotalLabel}>Total:</Text>
                  <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.grandTotalBox}>
                <Text style={styles.grandTotalLabel}>Total:</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
              </View>
            )}
            
            {showDepositSection && depositPercent > 0 && (
              <View style={styles.depositSection}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Deposit ({depositPercent}%):</Text>
                  <Text style={styles.totalValue}>{formatCurrency(depositAmount)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Balance:</Text>
                  <Text style={styles.totalValue}>{formatCurrency(total - depositAmount)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Notes */}
          {notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.sectionBox}>
                <Text style={styles.notesText}>{notes}</Text>
              </View>
            </View>
          )}

          {/* Terms */}
          {terms && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Terms & Conditions</Text>
              <View style={styles.sectionBox}>
                <Text style={styles.termsText}>{terms}</Text>
              </View>
            </View>
          )}

          {/* Signature for Quotes */}
          {type === 'quote' && (
            <View style={styles.signatureSection}>
              <View style={styles.signatureRow}>
                <Feather name="edit-3" size={12} color={documentColors.textMuted} />
                <Text style={styles.signatureText}>Client signature area</Text>
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerContacts}>
              {business.phone && (
                <View style={styles.footerItem}>
                  <Feather name="phone" size={10} color={documentColors.textMuted} />
                  <Text style={styles.footerText}>{business.phone}</Text>
                </View>
              )}
              {business.email && (
                <View style={styles.footerItem}>
                  <Feather name="mail" size={10} color={documentColors.textMuted} />
                  <Text style={styles.footerText}>{business.email}</Text>
                </View>
              )}
            </View>
            <Text style={styles.thankYouText}>Thank you for your business</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

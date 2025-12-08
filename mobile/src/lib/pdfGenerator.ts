/**
 * Mobile PDF Generation Service
 * 
 * Generates PDF documents on-device for quotes, invoices, and other documents
 * without requiring a server round-trip. Uses Expo Print for native PDF creation.
 * 
 * MATCHES WEB VERSION: This generator produces PDFs identical to the web app
 * including logo support, status stamps, brand colors, and all business info.
 * 
 * INSTALLATION REQUIREMENTS:
 * npx expo install expo-print expo-sharing expo-file-system expo-image-manipulator
 */

let Print: any;
let Sharing: any;
let FileSystem: any;

try {
  Print = require('expo-print');
  Sharing = require('expo-sharing');
  FileSystem = require('expo-file-system');
} catch (error) {
  console.warn('[PDFGenerator] Missing dependencies. Run: npx expo install expo-print expo-sharing expo-file-system');
}

export interface BusinessInfo {
  businessName: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  brandColor?: string;
  licenseNumber?: string;
  regulatorRegistration?: string;
  warrantyPeriod?: string;
  insuranceProvider?: string;
  insuranceAmount?: string;
  insuranceDetails?: string;
  gstEnabled?: boolean;
  quoteTerms?: string;
  invoiceTerms?: string;
  lateFeeRate?: string;
  bankName?: string;
  bsb?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface TimeEntry {
  id: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  description?: string;
}

export interface JobInfo {
  id?: string;
  title?: string;
  address?: string;
  scheduledAt?: string;
}

export interface QuoteData {
  number: string;
  date: string;
  validUntil?: string;
  title?: string;
  description?: string;
  status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  clientPhone?: string;
  items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
  notes?: string;
  terms?: string;
  acceptanceUrl?: string;
  acceptedAt?: string;
  acceptedBy?: string;
  acceptanceIp?: string;
  job?: JobInfo;
}

export interface InvoiceData {
  number: string;
  date: string;
  dueDate: string;
  title?: string;
  description?: string;
  status?: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue';
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  clientPhone?: string;
  items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  notes?: string;
  paymentTerms?: string;
  bankDetails?: string;
  paymentUrl?: string;
  paidAt?: string;
  job?: JobInfo;
  timeEntries?: TimeEntry[];
}

const DEFAULT_QUOTE_TERMS = `1. This quote is valid for 30 days from the date shown above.
2. Payment terms: 50% deposit required before work commences, balance due on completion.
3. Any variations to the scope of work will be quoted separately.
4. All prices are in Australian Dollars (AUD) and include GST where applicable.
5. Work will be completed in a professional manner and in accordance with relevant Australian Standards.`;

const DEFAULT_INVOICE_TERMS = (lateFeeRate: string = '1.5% per month') => `1. Payment is due by the date shown above.
2. Late payments may incur a fee of ${lateFeeRate}.
3. All amounts are in Australian Dollars (AUD).
4. Queries regarding this invoice should be raised within 7 days.`;

class PDFGeneratorService {
  private formatCurrency(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(num || 0);
  }

  private formatDate(dateInput: string | Date | undefined | null): string {
    if (!dateInput) return '';
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return String(dateInput);
    }
  }

  private getMissingInfoWarnings(business: BusinessInfo, total: number): string[] {
    const warnings: string[] = [];
    if (total > 82.50 && !business.abn) {
      warnings.push('ABN required for invoices over $82.50');
    }
    if (!business.phone) warnings.push('Phone number');
    if (!business.address) warnings.push('Business address');
    return warnings;
  }

  private generateDocumentStyles(brandColor: string): string {
    return `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 11px;
          line-height: 1.5;
          color: #1a1a1a;
          background: #fff;
        }
        
        .document {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          position: relative;
        }
        
        .status-stamp {
          position: absolute;
          top: 80px;
          right: 40px;
          font-size: 48px;
          font-weight: 900;
          letter-spacing: 6px;
          transform: rotate(-15deg);
          opacity: 0.15;
          border: 6px solid;
          padding: 8px 24px;
          border-radius: 8px;
          text-transform: uppercase;
        }
        
        .status-stamp.accepted {
          color: #22c55e;
          border-color: #22c55e;
        }
        
        .status-stamp.paid {
          color: #22c55e;
          border-color: #22c55e;
        }
        
        .status-stamp.overdue {
          color: #dc2626;
          border-color: #dc2626;
        }
        
        .warning-banner {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 24px;
          color: #92400e;
          font-size: 11px;
        }
        
        .warning-title {
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid ${brandColor};
        }
        
        .company-info {
          flex: 1;
        }
        
        .logo {
          max-width: 150px;
          max-height: 60px;
          object-fit: contain;
          margin-bottom: 12px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: 700;
          color: ${brandColor};
          margin-bottom: 8px;
        }
        
        .company-details {
          color: #666;
          font-size: 10px;
          line-height: 1.6;
        }
        
        .company-details p {
          margin: 2px 0;
        }
        
        .document-type {
          text-align: right;
        }
        
        .document-title {
          font-size: 32px;
          font-weight: 700;
          color: ${brandColor};
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        
        .document-number {
          font-size: 14px;
          color: #666;
          margin-top: 4px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 8px;
        }
        
        .status-draft { background: #e5e7eb; color: #374151; }
        .status-sent { background: #dbeafe; color: #1d4ed8; }
        .status-accepted { background: #dcfce7; color: #166534; }
        .status-declined { background: #fee2e2; color: #991b1b; }
        .status-paid { background: #dcfce7; color: #166534; }
        .status-overdue { background: #fee2e2; color: #991b1b; }
        .status-viewed { background: #fef3c7; color: #92400e; }
        .status-partial { background: #fef3c7; color: #92400e; }
        
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          gap: 40px;
        }
        
        .info-block {
          flex: 1;
        }
        
        .info-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #888;
          margin-bottom: 6px;
          font-weight: 600;
        }
        
        .info-value {
          color: #1a1a1a;
          line-height: 1.5;
        }
        
        .info-value strong {
          font-weight: 600;
        }
        
        .description-section {
          margin-bottom: 30px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .description-title {
          font-weight: 600;
          margin-bottom: 8px;
          color: ${brandColor};
        }
        
        .line-items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        .line-items-table th {
          background: #f8f9fa;
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
          border-bottom: 2px solid ${brandColor};
        }
        
        .line-items-table th:last-child {
          text-align: right;
        }
        
        .line-items-table td {
          padding: 12px 8px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }
        
        .line-items-table td:last-child {
          text-align: right;
          font-weight: 500;
        }
        
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        
        .totals-table {
          width: 280px;
        }
        
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .totals-row.total {
          font-size: 16px;
          font-weight: 700;
          color: ${brandColor};
          border-bottom: 2px solid ${brandColor};
          padding-top: 12px;
        }
        
        .totals-row.due {
          background: #fef2f2;
          padding: 12px;
          border-radius: 6px;
          color: #dc2626;
          font-weight: 600;
          margin-top: 8px;
          border-bottom: none;
        }
        
        .totals-row.paid {
          background: #f0fdf4;
          padding: 12px;
          border-radius: 6px;
          color: #166534;
          font-weight: 600;
          margin-top: 8px;
          border-bottom: none;
        }
        
        .notes-section {
          background: #f8f9fa;
          border-left: 4px solid ${brandColor};
          border-radius: 0 6px 6px 0;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .notes-title {
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          color: ${brandColor};
        }
        
        .notes-content {
          font-size: 10px;
          line-height: 1.6;
          white-space: pre-wrap;
        }
        
        .terms-section {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
          font-size: 9px;
          color: #666;
        }
        
        .terms-title {
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          color: #333;
        }
        
        .terms-content {
          line-height: 1.6;
          white-space: pre-wrap;
        }
        
        .acceptance-section {
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 24px;
          margin: 30px 0;
          page-break-inside: avoid;
        }
        
        .acceptance-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          color: ${brandColor};
        }
        
        .signature-line {
          display: flex;
          gap: 32px;
          margin-top: 32px;
        }
        
        .signature-block {
          flex: 1;
        }
        
        .signature-label {
          font-size: 9px;
          color: #666;
          margin-bottom: 4px;
        }
        
        .signature-underline {
          border-bottom: 1px solid #000;
          height: 32px;
        }
        
        .bank-details-section {
          background: #f0f9ff;
          border-left: 4px solid #3b82f6;
          border-radius: 0 6px 6px 0;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .bank-details-title {
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          color: #1e40af;
        }
        
        .bank-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          font-size: 10px;
        }
        
        .bank-details-item strong {
          color: #1e40af;
        }
        
        .payment-button-section {
          text-align: center;
          margin: 24px 0;
          padding: 20px;
          background: linear-gradient(135deg, ${brandColor}10 0%, ${brandColor}05 100%);
          border: 2px solid ${brandColor};
          border-radius: 8px;
        }
        
        .payment-button-text {
          font-size: 12px;
          font-weight: 600;
          color: ${brandColor};
          margin-bottom: 8px;
        }
        
        .payment-url {
          display: inline-block;
          background: ${brandColor};
          color: white;
          padding: 10px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          font-size: 11px;
        }
        
        .time-tracking-section {
          margin-bottom: 20px;
        }
        
        .time-tracking-title {
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
          color: #333;
        }
        
        .time-tracking-summary {
          display: flex;
          gap: 20px;
          background: #f8f9fa;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 10px;
        }
        
        .time-tracking-item {
          display: flex;
          gap: 6px;
        }
        
        .time-tracking-item strong {
          color: ${brandColor};
        }
        
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #666;
          font-size: 10px;
        }
        
        .footer p {
          margin: 4px 0;
        }
        
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .document { padding: 20px; }
        }
      </style>
    `;
  }

  private generateItemsTable(items: LineItem[]): string {
    const rows = items.map(item => `
      <tr>
        <td>${item.description}</td>
        <td style="text-align: center;">${parseFloat(String(item.quantity)).toFixed(2)}</td>
        <td style="text-align: right;">${this.formatCurrency(item.unitPrice)}</td>
        <td>${this.formatCurrency(item.total)}</td>
      </tr>
    `).join('');

    return `
      <table class="line-items-table">
        <thead>
          <tr>
            <th style="width: 50%;">Description</th>
            <th style="width: 15%; text-align: center;">Qty</th>
            <th style="width: 17%; text-align: right;">Unit Price</th>
            <th style="width: 18%; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Generate a PDF quote document - Matches web version exactly
   */
  async generateQuotePDF(quote: QuoteData, business: BusinessInfo): Promise<string> {
    if (!Print) {
      throw new Error('PDF generation not available. Run: npx expo install expo-print');
    }
    
    const brandColor = business.brandColor || '#2563eb';
    const warnings = this.getMissingInfoWarnings(business, quote.total);
    const isGstRegistered = business.gstEnabled && quote.gst > 0;
    const quoteTerms = business.quoteTerms || quote.terms || DEFAULT_QUOTE_TERMS;
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quote ${quote.number} - ${business.businessName}</title>
        ${this.generateDocumentStyles(brandColor)}
      </head>
      <body>
        <div class="document">
          ${quote.status === 'accepted' ? `<div class="status-stamp accepted">ACCEPTED</div>` : ''}
          
          ${warnings.length > 0 ? `
            <div class="warning-banner">
              <div class="warning-title">Document Incomplete</div>
              <div>Please update your business settings: ${warnings.join(', ')}</div>
            </div>
          ` : ''}
          
          <div class="header">
            <div class="company-info">
              ${business.logoUrl ? `<img src="${business.logoUrl}" alt="${business.businessName}" class="logo" />` : ''}
              <div class="company-name">${business.businessName}</div>
              <div class="company-details">
                ${business.abn ? `<p><strong>ABN:</strong> ${business.abn}</p>` : ''}
                ${business.address ? `<p>${business.address}</p>` : ''}
                ${business.phone ? `<p>Phone: ${business.phone}</p>` : ''}
                ${business.email ? `<p>Email: ${business.email}</p>` : ''}
                ${business.licenseNumber ? `<p>Licence No: ${business.licenseNumber}</p>` : ''}
                ${business.regulatorRegistration ? `<p>Reg: ${business.regulatorRegistration}</p>` : ''}
              </div>
            </div>
            <div class="document-type">
              <div class="document-title">Quote</div>
              <div class="document-number">${quote.number}</div>
              ${quote.status ? `
                <span class="status-badge status-${quote.status}">${quote.status}</span>
              ` : ''}
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-block">
              <div class="info-label">Quote For</div>
              <div class="info-value">
                <strong>${quote.clientName}</strong><br/>
                ${quote.clientAddress ? `${quote.clientAddress}<br/>` : ''}
                ${quote.clientEmail ? `${quote.clientEmail}<br/>` : ''}
                ${quote.clientPhone ? `${quote.clientPhone}` : ''}
              </div>
            </div>
            <div class="info-block">
              <div class="info-label">Quote Details</div>
              <div class="info-value">
                <strong>Date:</strong> ${this.formatDate(quote.date)}<br/>
                ${quote.validUntil ? `<strong>Valid Until:</strong> ${this.formatDate(quote.validUntil)}<br/>` : ''}
                ${quote.acceptedAt ? `<strong>Accepted:</strong> ${this.formatDate(quote.acceptedAt)}` : ''}
              </div>
            </div>
          </div>
          
          ${quote.job?.address ? `
          <div class="info-section" style="margin-top: 16px;">
            <div class="info-block" style="flex: 1;">
              <div class="info-label">Job Site Location</div>
              <div class="info-value">
                <strong>${quote.job.address}</strong>
                ${quote.job.scheduledAt ? `<br/><span style="color: #666;">Scheduled: ${this.formatDate(quote.job.scheduledAt)}</span>` : ''}
              </div>
            </div>
          </div>
          ` : ''}
          
          ${quote.description ? `
            <div class="description-section">
              <div class="description-title">${quote.title || 'Description'}</div>
              <div>${quote.description}</div>
            </div>
          ` : ''}
          
          ${this.generateItemsTable(quote.items)}
          
          <div class="totals-section">
            <div class="totals-table">
              <div class="totals-row">
                <span>Subtotal</span>
                <span>${this.formatCurrency(quote.subtotal)}</span>
              </div>
              ${quote.gst > 0 ? `
                <div class="totals-row">
                  <span>GST (10%)</span>
                  <span>${this.formatCurrency(quote.gst)}</span>
                </div>
              ` : ''}
              <div class="totals-row total">
                <span>Total${isGstRegistered ? ' (incl. GST)' : ''}</span>
                <span>${this.formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>
          
          ${quote.acceptanceUrl && quote.status !== 'accepted' && quote.status !== 'declined' ? `
            <div class="payment-button-section">
              <p class="payment-button-text">Accept This Quote Online</p>
              <p style="font-size: 10px; color: #666; margin-bottom: 12px;">Click the link below to accept this quote</p>
              <a href="${quote.acceptanceUrl}" class="payment-url">${quote.acceptanceUrl}</a>
            </div>
          ` : ''}
          
          ${quote.notes ? `
            <div class="notes-section">
              <div class="notes-title">Additional Notes</div>
              <div class="notes-content">${quote.notes}</div>
            </div>
          ` : ''}
          
          <div class="terms-section">
            <div class="terms-title">Terms & Conditions</div>
            <div class="terms-content">${quoteTerms}</div>
          </div>
          
          ${business.warrantyPeriod ? `
            <div class="notes-section" style="margin-top: 16px;">
              <div class="notes-title">Warranty</div>
              <div class="notes-content">All work is guaranteed for ${business.warrantyPeriod} from completion date.</div>
            </div>
          ` : ''}
          
          ${business.insuranceDetails || business.insuranceProvider ? `
            <div class="notes-section" style="margin-top: 16px; background: #f0f9ff; border-left-color: #3b82f6;">
              <div class="notes-title" style="color: #1e40af;">Insurance & Licensing</div>
              <div class="notes-content" style="color: #1e40af;">
${business.licenseNumber ? `Licence: ${business.licenseNumber}\n` : ''}${business.insuranceProvider ? `Insurer: ${business.insuranceProvider}\n` : ''}${business.insuranceAmount ? `Coverage: ${business.insuranceAmount}` : ''}
              </div>
            </div>
          ` : ''}
          
          ${quote.status !== 'accepted' && quote.status !== 'declined' ? `
            <div class="acceptance-section">
              <div class="acceptance-title">Quote Acceptance</div>
              <p style="font-size: 10px; color: #666; margin-bottom: 20px;">
                By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
              </p>
              <div class="signature-line">
                <div class="signature-block">
                  <div class="signature-label">Client Signature</div>
                  <div class="signature-underline"></div>
                </div>
                <div class="signature-block">
                  <div class="signature-label">Print Name</div>
                  <div class="signature-underline"></div>
                </div>
                <div class="signature-block">
                  <div class="signature-label">Date</div>
                  <div class="signature-underline"></div>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${quote.status === 'accepted' && quote.acceptedBy ? `
            <div class="notes-section" style="background: #dcfce7; border-left-color: #22c55e;">
              <div class="notes-title" style="color: #166534;">Quote Accepted</div>
              <div class="notes-content" style="color: #166534;">
Accepted by: ${quote.acceptedBy}
Date: ${this.formatDate(quote.acceptedAt)}
${quote.acceptanceIp ? `IP Address: ${quote.acceptanceIp}` : ''}
              </div>
            </div>
          ` : ''}
          
          <div class="footer">
            <p>Thank you for your business!</p>
            ${business.abn ? `<p>ABN: ${business.abn}</p>` : ''}
            <p>Generated by TradieTrack • ${this.formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    return uri;
  }

  /**
   * Generate a PDF invoice document - Matches web version exactly
   */
  async generateInvoicePDF(invoice: InvoiceData, business: BusinessInfo): Promise<string> {
    if (!Print) {
      throw new Error('PDF generation not available. Run: npx expo install expo-print');
    }
    
    const brandColor = business.brandColor || '#dc2626';
    const warnings = this.getMissingInfoWarnings(business, invoice.total);
    const isGstRegistered = business.gstEnabled && invoice.gst > 0;
    const invoiceTerms = business.invoiceTerms || invoice.paymentTerms || DEFAULT_INVOICE_TERMS(business.lateFeeRate || '1.5% per month');
    
    const amountDue = invoice.amountDue ?? (invoice.total - (invoice.amountPaid || 0));
    const isPaid = invoice.status === 'paid';
    const isOverdue = invoice.status === 'overdue' || 
      (invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid');
    
    // Document title - must say "TAX INVOICE" for GST-registered businesses (ATO requirement)
    const documentTitle = isGstRegistered 
      ? (isPaid ? 'TAX INVOICE / RECEIPT' : 'TAX INVOICE')
      : (isPaid ? 'Invoice / Receipt' : 'Invoice');
    
    // Time tracking summary
    const totalMinutes = invoice.timeEntries?.reduce((sum, entry) => sum + (entry.duration || 0), 0) || 0;
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const timeTrackingFormatted = totalMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : null;
    
    // Bank details formatting
    const hasBankDetails = business.bankName || business.bsb || business.accountNumber;
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${documentTitle} ${invoice.number} - ${business.businessName}</title>
        ${this.generateDocumentStyles(brandColor)}
      </head>
      <body>
        <div class="document">
          ${isPaid ? `<div class="status-stamp paid">PAID</div>` : ''}
          ${isOverdue && !isPaid ? `<div class="status-stamp overdue">OVERDUE</div>` : ''}
          
          ${warnings.length > 0 ? `
            <div class="warning-banner">
              <div class="warning-title">${invoice.total > 82.50 && !business.abn ? 'ABN Required' : 'Document Incomplete'}</div>
              <div>Please update your business settings: ${warnings.join(', ')}</div>
            </div>
          ` : ''}
          
          <div class="header">
            <div class="company-info">
              ${business.logoUrl ? `<img src="${business.logoUrl}" alt="${business.businessName}" class="logo" />` : ''}
              <div class="company-name">${business.businessName}</div>
              <div class="company-details">
                ${business.abn ? `<p><strong>ABN:</strong> ${business.abn}</p>` : ''}
                ${business.address ? `<p>${business.address}</p>` : ''}
                ${business.phone ? `<p>Phone: ${business.phone}</p>` : ''}
                ${business.email ? `<p>Email: ${business.email}</p>` : ''}
                ${business.licenseNumber ? `<p>Licence No: ${business.licenseNumber}</p>` : ''}
                ${business.regulatorRegistration ? `<p>Reg: ${business.regulatorRegistration}</p>` : ''}
              </div>
            </div>
            <div class="document-type">
              <div class="document-title">${documentTitle}</div>
              <div class="document-number">${invoice.number}</div>
              ${invoice.status ? `
                <span class="status-badge status-${invoice.status}">${invoice.status}</span>
              ` : ''}
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-block">
              <div class="info-label">Bill To</div>
              <div class="info-value">
                <strong>${invoice.clientName}</strong><br/>
                ${invoice.clientAddress ? `${invoice.clientAddress}<br/>` : ''}
                ${invoice.clientEmail ? `${invoice.clientEmail}<br/>` : ''}
                ${invoice.clientPhone ? `${invoice.clientPhone}` : ''}
              </div>
            </div>
            <div class="info-block">
              <div class="info-label">Invoice Details</div>
              <div class="info-value">
                <strong>Invoice Date:</strong> ${this.formatDate(invoice.date)}<br/>
                <strong>Due Date:</strong> <span style="color: ${isOverdue ? '#dc2626' : '#1a1a1a'};">${this.formatDate(invoice.dueDate)}</span><br/>
                ${invoice.paidAt ? `<strong>Paid:</strong> ${this.formatDate(invoice.paidAt)}` : ''}
              </div>
            </div>
          </div>
          
          ${invoice.job?.address ? `
          <div class="info-section" style="margin-top: 16px;">
            <div class="info-block" style="flex: 1;">
              <div class="info-label">Job Site Location</div>
              <div class="info-value">
                <strong>${invoice.job.address}</strong>
                ${invoice.job.scheduledAt ? `<br/><span style="color: #666;">Completed: ${this.formatDate(invoice.job.scheduledAt)}</span>` : ''}
              </div>
            </div>
          </div>
          ` : ''}
          
          ${invoice.description ? `
            <div class="description-section">
              <div class="description-title">${invoice.title || 'Description'}</div>
              <div>${invoice.description}</div>
            </div>
          ` : ''}
          
          ${timeTrackingFormatted ? `
            <div class="time-tracking-section">
              <div class="time-tracking-title">Time Tracking Summary</div>
              <div class="time-tracking-summary">
                <div class="time-tracking-item">
                  <strong>Total Time:</strong>
                  <span>${timeTrackingFormatted}</span>
                </div>
                <div class="time-tracking-item">
                  <strong>Entries:</strong>
                  <span>${invoice.timeEntries?.length || 0}</span>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${this.generateItemsTable(invoice.items)}
          
          <div class="totals-section">
            <div class="totals-table">
              <div class="totals-row">
                <span>Subtotal</span>
                <span>${this.formatCurrency(invoice.subtotal)}</span>
              </div>
              ${invoice.gst > 0 ? `
                <div class="totals-row">
                  <span>GST (10%)</span>
                  <span>${this.formatCurrency(invoice.gst)}</span>
                </div>
              ` : ''}
              <div class="totals-row total">
                <span>Total${isGstRegistered ? ' (incl. GST)' : ''}</span>
                <span>${this.formatCurrency(invoice.total)}</span>
              </div>
              ${invoice.amountPaid && invoice.amountPaid > 0 ? `
                <div class="totals-row">
                  <span>Amount Paid</span>
                  <span>-${this.formatCurrency(invoice.amountPaid)}</span>
                </div>
              ` : ''}
              ${amountDue > 0 && !isPaid ? `
                <div class="totals-row due">
                  <span>Amount Due</span>
                  <span>${this.formatCurrency(amountDue)}</span>
                </div>
              ` : ''}
              ${isPaid ? `
                <div class="totals-row paid">
                  <span>✓ PAID IN FULL</span>
                  <span>${this.formatCurrency(invoice.amountPaid || invoice.total)}</span>
                </div>
              ` : ''}
            </div>
          </div>
          
          ${invoice.paymentUrl && !isPaid ? `
            <div class="payment-button-section">
              <p class="payment-button-text">Pay This Invoice Online</p>
              <p style="font-size: 10px; color: #666; margin-bottom: 12px;">Click the link below to pay securely online</p>
              <a href="${invoice.paymentUrl}" class="payment-url">Pay Now - ${this.formatCurrency(amountDue)}</a>
            </div>
          ` : ''}
          
          ${hasBankDetails && !isPaid ? `
            <div class="bank-details-section">
              <div class="bank-details-title">Bank Transfer Details</div>
              <div class="bank-details-grid">
                ${business.bankName ? `<div class="bank-details-item"><strong>Bank:</strong> ${business.bankName}</div>` : ''}
                ${business.accountName ? `<div class="bank-details-item"><strong>Account Name:</strong> ${business.accountName}</div>` : ''}
                ${business.bsb ? `<div class="bank-details-item"><strong>BSB:</strong> ${business.bsb}</div>` : ''}
                ${business.accountNumber ? `<div class="bank-details-item"><strong>Account:</strong> ${business.accountNumber}</div>` : ''}
              </div>
              <p style="font-size: 9px; color: #666; margin-top: 8px;">Reference: ${invoice.number}</p>
            </div>
          ` : ''}
          
          ${invoice.notes ? `
            <div class="notes-section">
              <div class="notes-title">Notes</div>
              <div class="notes-content">${invoice.notes}</div>
            </div>
          ` : ''}
          
          <div class="terms-section">
            <div class="terms-title">Payment Terms</div>
            <div class="terms-content">${invoiceTerms}</div>
          </div>
          
          ${business.warrantyPeriod ? `
            <div class="notes-section" style="margin-top: 16px;">
              <div class="notes-title">Warranty</div>
              <div class="notes-content">All work is guaranteed for ${business.warrantyPeriod} from completion date.</div>
            </div>
          ` : ''}
          
          ${business.insuranceDetails || business.insuranceProvider ? `
            <div class="notes-section" style="margin-top: 16px; background: #f0f9ff; border-left-color: #3b82f6;">
              <div class="notes-title" style="color: #1e40af;">Insurance & Licensing</div>
              <div class="notes-content" style="color: #1e40af;">
${business.licenseNumber ? `Licence: ${business.licenseNumber}\n` : ''}${business.insuranceProvider ? `Insurer: ${business.insuranceProvider}\n` : ''}${business.insuranceAmount ? `Coverage: ${business.insuranceAmount}` : ''}
              </div>
            </div>
          ` : ''}
          
          <div class="footer">
            <p>Thank you for your business!</p>
            ${business.abn ? `<p>ABN: ${business.abn}</p>` : ''}
            <p>Generated by TradieTrack • ${this.formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    return uri;
  }

  /**
   * Check if PDF generation is available
   */
  isAvailable(): boolean {
    return !!(Print && Sharing && FileSystem);
  }

  /**
   * Share a PDF file using the native share sheet
   */
  async sharePDF(uri: string, title?: string): Promise<void> {
    if (!Sharing) {
      throw new Error('Sharing module not available. Run: npx expo install expo-sharing');
    }
    
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: title || 'Share PDF',
      UTI: 'com.adobe.pdf',
    });
  }

  /**
   * Print a PDF file using the native print dialog
   */
  async printPDF(html: string): Promise<void> {
    if (!Print) {
      throw new Error('Print module not available. Run: npx expo install expo-print');
    }
    await Print.printAsync({ html });
  }

  /**
   * Save PDF to device storage
   */
  async savePDF(uri: string, fileName: string): Promise<string> {
    if (!FileSystem) {
      throw new Error('FileSystem module not available. Run: npx expo install expo-file-system');
    }
    const destinationUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: uri,
      to: destinationUri,
    });
    return destinationUri;
  }

  /**
   * Check if file exists
   */
  async fileExists(uri: string): Promise<boolean> {
    if (!FileSystem) {
      return false;
    }
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch {
      return false;
    }
  }

  /**
   * Delete a PDF file
   */
  async deletePDF(uri: string): Promise<void> {
    if (!FileSystem) {
      return;
    }
    const exists = await this.fileExists(uri);
    if (exists) {
      await FileSystem.deleteAsync(uri);
    }
  }
}

export const pdfGeneratorService = new PDFGeneratorService();
export default pdfGeneratorService;

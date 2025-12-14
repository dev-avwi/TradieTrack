import type { Quote, Invoice, QuoteLineItem, InvoiceLineItem, Client, BusinessSettings, DigitalSignature, Job, TimeEntry } from "@shared/schema";

// Document Template Definitions (mirrored from client/src/lib/document-templates.ts)
type TemplateId = 'professional' | 'modern' | 'minimal';

interface DocumentTemplate {
  id: TemplateId;
  fontFamily: string;
  tableStyle: 'bordered' | 'striped' | 'minimal';
  headerBorderWidth: string;
  showHeaderDivider: boolean;
  noteStyle: 'bordered' | 'highlighted' | 'simple';
  baseFontSize: string;
  headingWeight: number;
}

// Fixed document accent color - consistent navy blue across all templates
// This must match DOCUMENT_ACCENT_COLOR in client/src/lib/document-templates.ts
const DOCUMENT_ACCENT_COLOR = '#1e3a5f';

// All templates use Inter font for consistent modern appearance
const INTER_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const DOCUMENT_TEMPLATES: Record<TemplateId, DocumentTemplate> = {
  professional: {
    id: 'professional',
    fontFamily: INTER_FONT,
    tableStyle: 'bordered',
    headerBorderWidth: '2px',
    showHeaderDivider: true,
    noteStyle: 'bordered',
    baseFontSize: '11px',
    headingWeight: 700,
  },
  modern: {
    id: 'modern',
    fontFamily: INTER_FONT,
    tableStyle: 'striped',
    headerBorderWidth: '3px',
    showHeaderDivider: true,
    noteStyle: 'highlighted',
    baseFontSize: '12px',
    headingWeight: 600,
  },
  minimal: {
    id: 'minimal',
    fontFamily: INTER_FONT,
    tableStyle: 'minimal',
    headerBorderWidth: '1px',
    showHeaderDivider: false,
    noteStyle: 'simple',
    baseFontSize: '11px',
    headingWeight: 500,
  },
};

interface QuoteWithDetails {
  quote: Quote;
  lineItems: QuoteLineItem[];
  client: Client;
  business: BusinessSettings;
  signature?: DigitalSignature;
  token?: string; // For payment API calls
  canAcceptPayments?: boolean; // Whether business has Stripe Connect set up
  job?: Job; // Linked job for address/details
  acceptanceUrl?: string; // Public URL for client to accept quote online
}

interface InvoiceWithDetails {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  client: Client;
  business: BusinessSettings;
  job?: Job; // Linked job for address/details
  timeEntries?: TimeEntry[]; // Time tracking for labor billing
  paymentUrl?: string; // Public URL for client to pay invoice online
}

const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(num);
};

const formatDate = (date: Date | string | null): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const getMissingInfoWarnings = (business: BusinessSettings, total?: number): string[] => {
  const warnings: string[] = [];
  // ABN is mandatory for tax invoices over $82.50 (ATO requirement)
  if (!business.abn && total && total > 82.50) {
    warnings.push('ABN required for tax invoices over $82.50');
  } else if (!business.abn) {
    warnings.push('ABN not set');
  }
  if (!business.address) warnings.push('Business address not set');
  if (!business.phone) warnings.push('Phone number not set');
  if (!business.email) warnings.push('Email not set');
  return warnings;
};

// Default Australian trade terms and conditions
const getDefaultQuoteTerms = (): string => `
1. ACCEPTANCE: This quote is valid for 30 days from the date of issue. Acceptance of this quote constitutes a binding agreement.
2. PAYMENT: A deposit of 50% may be required before work commences. Balance due on completion unless otherwise agreed.
3. VARIATIONS: Any variations to the quoted work must be agreed in writing and may result in additional charges.
4. MATERIALS: All materials remain the property of the contractor until full payment is received.
5. WARRANTY: All workmanship is guaranteed for 12 months from completion, unless otherwise specified.
6. ACCESS: The client must provide safe and reasonable access to the work site.
7. CANCELLATION: Cancellation after acceptance may incur costs for materials ordered or work commenced.
`.trim();

const getDefaultInvoiceTerms = (lateFeeRate: string = '1.5% per month'): string => `
1. PAYMENT TERMS: Payment is due within 14 days of invoice date unless otherwise agreed.
2. LATE PAYMENT: Overdue accounts will incur interest at ${lateFeeRate} on outstanding balances.
3. DISPUTES: Any disputes must be raised within 7 days of receiving this invoice.
4. OWNERSHIP: Goods remain the property of the supplier until payment is received in full.
`.trim();

const generateGoogleFontsLink = (): string => {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;
};

const generateDocumentStyles = (_brandColor: string, templateId: string = 'minimal') => {
  const template = DOCUMENT_TEMPLATES[templateId as TemplateId] || DOCUMENT_TEMPLATES.minimal;
  // Use the fixed accent color for all templates - ignore brandColor
  const brandColor = DOCUMENT_ACCENT_COLOR;
  
  // Table header styles based on template
  const tableHeaderStyles = template.tableStyle === 'minimal' 
    ? `background: transparent; color: #1a1a1a; border-bottom: 2px solid ${brandColor};`
    : `background: ${brandColor}; color: white;`;
  
  // Table row styles based on template
  const getTableRowStyles = () => {
    switch (template.tableStyle) {
      case 'striped':
        return `
    .line-items-table tbody tr:nth-child(odd) { background: #f9fafb; }
    .line-items-table tbody tr:nth-child(even) { background: transparent; }
    .line-items-table td { border-bottom: none; }`;
      case 'minimal':
        return `
    .line-items-table td { border-bottom: 1px solid #e5e7eb; }`;
      case 'bordered':
      default:
        return `
    .line-items-table td { border-bottom: 1px solid #eee; }`;
    }
  };
  
  // Note section styles based on template
  const getNoteStyles = () => {
    switch (template.noteStyle) {
      case 'highlighted':
        return `
    .notes-section {
      margin-bottom: 30px;
      padding: 16px;
      background: linear-gradient(135deg, ${brandColor}10, ${brandColor}05);
      border: 1px solid ${brandColor}30;
      border-radius: 8px;
    }`;
      case 'simple':
        return `
    .notes-section {
      margin-bottom: 30px;
      padding: 16px 0;
      background: transparent;
      border-top: 1px solid #e5e7eb;
      border-left: none;
      border-radius: 0;
    }`;
      case 'bordered':
      default:
        return `
    .notes-section {
      margin-bottom: 30px;
      padding: 16px;
      background: #fafafa;
      border-left: 4px solid ${brandColor};
      border-radius: 0 6px 6px 0;
    }`;
    }
  };
  
  // Header border based on template
  const headerBorder = template.showHeaderDivider 
    ? `border-bottom: ${template.headerBorderWidth} solid ${brandColor};`
    : 'border-bottom: none;';

  return `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: ${template.fontFamily};
      font-size: ${template.baseFontSize};
      line-height: 1.5;
      color: #1a1a1a;
      background: #fff;
    }
    
    .document {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      ${headerBorder}
    }
    
    .company-info {
      flex: 1;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: ${template.headingWeight};
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
      font-weight: ${template.headingWeight};
      color: ${brandColor};
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .document-number {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }
    
    .logo {
      max-width: 150px;
      max-height: 60px;
      object-fit: contain;
      margin-bottom: 12px;
    }
    
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
      background: ${template.noteStyle === 'simple' ? 'transparent' : '#f8f9fa'};
      border-radius: 6px;
    }
    
    .description-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 8px;
      color: ${brandColor};
    }
    
    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    
    .line-items-table th {
      ${tableHeaderStyles}
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .line-items-table th:nth-child(2),
    .line-items-table th:nth-child(3),
    .line-items-table th:nth-child(4) {
      text-align: right;
    }
    
    .line-items-table td {
      padding: 12px;
      vertical-align: top;
    }
    
    .line-items-table td:nth-child(2),
    .line-items-table td:nth-child(3),
    .line-items-table td:nth-child(4) {
      text-align: right;
      white-space: nowrap;
    }
    
    .line-items-table tr:last-child td {
      border-bottom: 2px solid ${brandColor};
    }
    ${getTableRowStyles()}
    
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
      border-bottom: 1px solid #eee;
    }
    
    .totals-row.total {
      border-bottom: none;
      border-top: 2px solid ${brandColor};
      padding-top: 12px;
      margin-top: 4px;
    }
    
    .totals-row.total .totals-label,
    .totals-row.total .totals-value {
      font-size: 16px;
      font-weight: ${template.headingWeight};
      color: ${brandColor};
    }
    
    .totals-label {
      color: #666;
    }
    
    .totals-value {
      font-weight: 600;
    }
    
    .gst-note {
      text-align: right;
      font-size: 9px;
      color: #888;
      margin-top: 4px;
    }
    ${getNoteStyles()}
    
    .notes-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 8px;
      color: #333;
    }
    
    .notes-content {
      color: #666;
      font-size: 10px;
      white-space: pre-wrap;
    }
    
    .payment-section {
      margin-bottom: 30px;
      padding: 20px;
      background: linear-gradient(135deg, ${brandColor}10, ${brandColor}05);
      border: 1px solid ${brandColor}30;
      border-radius: 8px;
    }
    
    .payment-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 12px;
      color: ${brandColor};
      font-size: 12px;
    }
    
    .payment-details {
      color: #444;
      font-size: 10px;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    
    .terms-section {
      margin-bottom: 30px;
    }
    
    .terms-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 8px;
      color: #333;
      font-size: 11px;
    }
    
    .terms-content {
      color: #666;
      font-size: 9px;
      line-height: 1.6;
    }
    
    .acceptance-section {
      margin-top: 40px;
      padding: 20px;
      border: 2px dashed #ddd;
      border-radius: 8px;
    }
    
    .acceptance-title {
      font-weight: ${template.headingWeight};
      margin-bottom: 16px;
      color: #333;
    }
    
    .signature-line {
      display: flex;
      gap: 40px;
      margin-top: 20px;
    }
    
    .signature-block {
      flex: 1;
    }
    
    .signature-label {
      font-size: 10px;
      color: #888;
      margin-bottom: 30px;
    }
    
    .signature-underline {
      border-bottom: 1px solid #333;
      height: 1px;
    }
    
    .accepted-stamp {
      position: absolute;
      top: 100px;
      right: 60px;
      padding: 10px 20px;
      border: 3px solid #22c55e;
      color: #22c55e;
      font-size: 18px;
      font-weight: ${template.headingWeight};
      text-transform: uppercase;
      transform: rotate(-15deg);
      opacity: 0.8;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 9px;
      color: #999;
    }
    
    .warning-banner {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      padding: 10px 16px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 10px;
    }
    
    .warning-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-draft { background: #e5e7eb; color: #374151; }
    .status-sent { background: #dbeafe; color: #1d4ed8; }
    .status-accepted { background: #dcfce7; color: #166534; }
    .status-declined { background: #fee2e2; color: #991b1b; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .document { padding: 20px; }
    }
  </style>
`;
};

export const generateQuotePDF = (data: QuoteWithDetails): string => {
  const { quote, lineItems, client, business, job, acceptanceUrl } = data;
  const brandColor = business.brandColor || '#2563eb';
  const templateId = (business as any).documentTemplate || 'minimal';
  
  const subtotal = parseFloat(quote.subtotal as unknown as string);
  const gstAmount = parseFloat(quote.gstAmount as unknown as string);
  const total = parseFloat(quote.total as unknown as string);
  
  const warnings = getMissingInfoWarnings(business, total);
  const isGstRegistered = business.gstEnabled && gstAmount > 0;
  const quoteTerms = (business as any).quoteTerms || getDefaultQuoteTerms();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote ${quote.number} - ${business.businessName}</title>
  ${generateGoogleFontsLink()}
  ${generateDocumentStyles(brandColor, templateId)}
</head>
<body>
  <div class="document">
    ${quote.status === 'accepted' ? `<div class="accepted-stamp">ACCEPTED</div>` : ''}
    
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
          ${(business as any).regulatorRegistration ? `<p>Reg: ${(business as any).regulatorRegistration}</p>` : ''}
        </div>
      </div>
      <div class="document-type">
        <div class="document-title">Quote</div>
        <div class="document-number">${quote.number}</div>
        <div style="margin-top: 8px;">
          <span class="status-badge status-${quote.status}">${quote.status}</span>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Quote For</div>
        <div class="info-value">
          <strong>${client.name}</strong><br/>
          ${client.address ? `${client.address}<br/>` : ''}
          ${client.email ? `${client.email}<br/>` : ''}
          ${client.phone ? `${client.phone}` : ''}
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Quote Details</div>
        <div class="info-value">
          <strong>Date:</strong> ${formatDate(quote.createdAt)}<br/>
          ${quote.validUntil ? `<strong>Valid Until:</strong> ${formatDate(quote.validUntil)}<br/>` : ''}
          ${quote.acceptedAt ? `<strong>Accepted:</strong> ${formatDate(quote.acceptedAt)}` : ''}
        </div>
      </div>
    </div>
    
    ${job?.address ? `
    <div class="info-section" style="margin-top: 16px;">
      <div class="info-block" style="flex: 1;">
        <div class="info-label">Job Site Location</div>
        <div class="info-value">
          <strong>${job.address}</strong>
          ${job.scheduledAt ? `<br/><span style="color: #666;">Scheduled: ${formatDate(job.scheduledAt)}</span>` : ''}
        </div>
      </div>
    </div>
    ` : ''}
    
    ${quote.description ? `
      <div class="description-section">
        <div class="description-title">${quote.title}</div>
        <div>${quote.description}</div>
      </div>
    ` : ''}
    
    <table class="line-items-table">
      <thead>
        <tr>
          <th style="width: 50%;">Description</th>
          <th style="width: 15%;">Qty</th>
          <th style="width: 17%;">Unit Price</th>
          <th style="width: 18%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map(item => `
          <tr>
            <td>${item.description}</td>
            <td>${parseFloat(item.quantity as unknown as string).toFixed(2)}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="totals-section">
      <div class="totals-table">
        <div class="totals-row">
          <span class="totals-label">Subtotal</span>
          <span class="totals-value">${formatCurrency(subtotal)}</span>
        </div>
        ${gstAmount > 0 ? `
          <div class="totals-row">
            <span class="totals-label">GST (10%)</span>
            <span class="totals-value">${formatCurrency(gstAmount)}</span>
          </div>
        ` : ''}
        <div class="totals-row total">
          <span class="totals-label">Total${gstAmount > 0 ? ' (incl. GST)' : ''}</span>
          <span class="totals-value">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>
    
    ${acceptanceUrl && quote.status !== 'accepted' && quote.status !== 'declined' ? `
      <div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, ${brandColor}10 0%, ${brandColor}05 100%); border-radius: 8px; border: 2px solid ${brandColor}; text-align: center;">
        <p style="font-size: 12px; font-weight: 600; color: ${brandColor}; margin: 0 0 8px 0;">Accept This Quote Online</p>
        <p style="font-size: 10px; color: #666; margin: 0 0 12px 0;">Click the link or scan the QR code to accept this quote</p>
        <a href="${acceptanceUrl}" style="display: inline-block; background: ${brandColor}; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 11px;">${acceptanceUrl}</a>
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
      <div class="terms-content" style="white-space: pre-wrap;">${quoteTerms}</div>
    </div>
    
    ${business.warrantyPeriod ? `
      <div class="notes-section" style="margin-top: 16px;">
        <div class="notes-title">Warranty</div>
        <div class="notes-content">All work is guaranteed for ${business.warrantyPeriod} from completion date.</div>
      </div>
    ` : ''}
    
    ${(business as any).insuranceDetails || (business as any).insuranceProvider ? `
      <div class="notes-section" style="margin-top: 16px; background: #f0f9ff; border-left-color: #3b82f6;">
        <div class="notes-title" style="color: #1e40af;">Insurance & Licensing</div>
        <div class="notes-content" style="color: #1e40af;">
${business.licenseNumber ? `Licence: ${business.licenseNumber}` : ''}
${(business as any).insuranceProvider ? `Insurer: ${(business as any).insuranceProvider}` : ''}
${(business as any).insuranceAmount ? `Coverage: ${(business as any).insuranceAmount}` : ''}
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
Date: ${formatDate(quote.acceptedAt)}
${(quote as any).acceptanceIp ? `IP Address: ${(quote as any).acceptanceIp}` : ''}
        </div>
      </div>
    ` : ''}
    
    ${(business as any).includeSignatureOnQuotes && (business as any).defaultSignature ? `
      <div style="margin-top: 24px; padding: 20px; border-top: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: flex-end;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #666; margin-bottom: 8px;">Prepared by:</div>
            <img src="${(business as any).defaultSignature}" alt="Signature" style="max-height: 60px; width: auto; margin-bottom: 4px;" />
            ${(business as any).signatureName ? `<div style="font-size: 11px; font-weight: 500; color: #333;">${(business as any).signatureName}</div>` : ''}
            <div style="font-size: 10px; color: #666;">${business.businessName}</div>
          </div>
        </div>
      </div>
    ` : ''}
    
    <div class="footer">
      <p>Thank you for your business!</p>
      ${business.abn ? `<p style="margin-top: 4px;">ABN: ${business.abn}</p>` : ''}
      <p style="margin-top: 4px;">Generated by TradieTrack • ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
  `;
};

export const generateInvoicePDF = (data: InvoiceWithDetails): string => {
  const { invoice, lineItems, client, business, job, timeEntries, paymentUrl } = data;
  const brandColor = business.brandColor || '#dc2626';
  const templateId = (business as any).documentTemplate || 'minimal';
  
  // Calculate time tracking totals if present
  const totalMinutes = timeEntries?.reduce((sum, entry) => sum + (entry.duration || 0), 0) || 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const timeTrackingFormatted = totalMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : null;
  
  const subtotal = parseFloat(invoice.subtotal as unknown as string);
  const gstAmount = parseFloat(invoice.gstAmount as unknown as string);
  const total = parseFloat(invoice.total as unknown as string);
  
  const warnings = getMissingInfoWarnings(business, total);
  const isGstRegistered = business.gstEnabled && gstAmount > 0;
  const invoiceTerms = (business as any).invoiceTerms || getDefaultInvoiceTerms(business.lateFeeRate || '1.5% per month');
  
  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.status === 'overdue' || 
    (invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid');
  
  // Determine document title - must say "TAX INVOICE" for GST-registered businesses (ATO requirement)
  const documentTitle = isGstRegistered 
    ? (isPaid ? 'TAX INVOICE / RECEIPT' : 'TAX INVOICE')
    : (isPaid ? 'Invoice / Receipt' : 'Invoice');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle} ${invoice.number} - ${business.businessName}</title>
  ${generateGoogleFontsLink()}
  ${generateDocumentStyles(brandColor, templateId)}
</head>
<body>
  <div class="document">
    ${isPaid ? `<div class="accepted-stamp" style="border-color: #22c55e; color: #22c55e;">PAID</div>` : ''}
    ${isOverdue && !isPaid ? `<div class="accepted-stamp" style="border-color: #dc2626; color: #dc2626;">OVERDUE</div>` : ''}
    
    ${warnings.length > 0 ? `
      <div class="warning-banner">
        <div class="warning-title">${total > 82.50 && !business.abn ? 'ABN Required' : 'Document Incomplete'}</div>
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
          ${(business as any).regulatorRegistration ? `<p>Reg: ${(business as any).regulatorRegistration}</p>` : ''}
        </div>
      </div>
      <div class="document-type">
        <div class="document-title" style="color: ${isPaid ? '#22c55e' : brandColor}; font-size: ${isGstRegistered ? '28px' : '32px'};">
          ${documentTitle}
        </div>
        <div class="document-number">${invoice.number}</div>
        <div style="margin-top: 8px;">
          <span class="status-badge status-${invoice.status}">${invoice.status}</span>
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Bill To</div>
        <div class="info-value">
          <strong>${client.name}</strong><br/>
          ${client.address ? `${client.address}<br/>` : ''}
          ${client.email ? `${client.email}<br/>` : ''}
          ${client.phone ? `${client.phone}` : ''}
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Invoice Details</div>
        <div class="info-value">
          <strong>Issue Date:</strong> ${formatDate(invoice.createdAt)}<br/>
          ${invoice.dueDate ? `<strong>Due Date:</strong> ${formatDate(invoice.dueDate)}<br/>` : ''}
          ${invoice.paidAt ? `<strong>Paid:</strong> ${formatDate(invoice.paidAt)}` : ''}
        </div>
      </div>
    </div>
    
    ${job?.address || timeTrackingFormatted ? `
    <div class="info-section" style="margin-top: 16px;">
      ${job?.address ? `
      <div class="info-block">
        <div class="info-label">Job Site Location</div>
        <div class="info-value">
          <strong>${job.address}</strong>
          ${job.scheduledAt ? `<br/><span style="color: #666;">Completed: ${formatDate(job.scheduledAt)}</span>` : ''}
        </div>
      </div>
      ` : ''}
      ${timeTrackingFormatted ? `
      <div class="info-block">
        <div class="info-label">Time Worked</div>
        <div class="info-value">
          <strong>${timeTrackingFormatted}</strong>
          <span style="color: #666;"> (${timeEntries?.length || 0} session${(timeEntries?.length || 0) !== 1 ? 's' : ''})</span>
        </div>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    ${invoice.description ? `
      <div class="description-section">
        <div class="description-title">${invoice.title}</div>
        <div>${invoice.description}</div>
      </div>
    ` : ''}
    
    <table class="line-items-table">
      <thead>
        <tr>
          <th style="width: 50%;">Description</th>
          <th style="width: 15%;">Qty</th>
          <th style="width: 17%;">Unit Price</th>
          <th style="width: 18%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map(item => `
          <tr>
            <td>${item.description}</td>
            <td>${parseFloat(item.quantity as unknown as string).toFixed(2)}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="totals-section">
      <div class="totals-table">
        <div class="totals-row">
          <span class="totals-label">Subtotal</span>
          <span class="totals-value">${formatCurrency(subtotal)}</span>
        </div>
        ${gstAmount > 0 ? `
          <div class="totals-row">
            <span class="totals-label">GST (10%)</span>
            <span class="totals-value">${formatCurrency(gstAmount)}</span>
          </div>
        ` : ''}
        <div class="totals-row total" style="${isPaid ? 'border-top-color: #22c55e;' : ''}">
          <span class="totals-label" style="${isPaid ? 'color: #22c55e;' : ''}">
            ${isPaid ? 'Amount Paid' : `Total${gstAmount > 0 ? ' (incl. GST)' : ''}`}
          </span>
          <span class="totals-value" style="${isPaid ? 'color: #22c55e;' : ''}">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>
    ${gstAmount > 0 ? `<div class="gst-note">GST included in total</div>` : ''}
    
    ${paymentUrl && !isPaid ? `
      <div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #22c55e10 0%, #22c55e05 100%); border-radius: 8px; border: 2px solid #22c55e; text-align: center;">
        <p style="font-size: 12px; font-weight: 600; color: #16a34a; margin: 0 0 8px 0;">Pay This Invoice Online</p>
        <p style="font-size: 10px; color: #666; margin: 0 0 12px 0;">Click the link below to view and pay this invoice securely</p>
        <a href="${paymentUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 11px;">${paymentUrl}</a>
      </div>
    ` : ''}
    
    ${!isPaid ? `
      <div class="payment-section">
        <div class="payment-title">Payment Details</div>
        <div class="payment-details">
${business.paymentInstructions || 'Please contact us for payment options.'}

${(business as any).bankDetails ? `Bank Details:\n${(business as any).bankDetails}` : ''}

${invoice.dueDate ? `Payment is due by ${formatDate(invoice.dueDate)}.` : ''}
${business.lateFeeRate ? `Late payments may incur interest at ${business.lateFeeRate}.` : ''}
        </div>
      </div>
    ` : ''}
    
    ${invoice.notes ? `
      <div class="notes-section">
        <div class="notes-title">Additional Notes</div>
        <div class="notes-content">${invoice.notes}</div>
      </div>
    ` : ''}
    
    <div class="terms-section">
      <div class="terms-title">Terms & Conditions</div>
      <div class="terms-content" style="white-space: pre-wrap;">${invoiceTerms}</div>
    </div>
    
    ${isPaid && invoice.paymentReference ? `
      <div class="notes-section" style="background: #dcfce7; border-left-color: #22c55e;">
        <div class="notes-title" style="color: #166534;">Payment Received - Thank You!</div>
        <div class="notes-content" style="color: #166534;">
Reference: ${invoice.paymentReference}
${invoice.paymentMethod ? `Method: ${invoice.paymentMethod}` : ''}
Date: ${formatDate(invoice.paidAt)}
Amount: ${formatCurrency(total)}
        </div>
      </div>
    ` : ''}
    
    ${business.warrantyPeriod ? `
      <div class="notes-section" style="margin-top: 16px;">
        <div class="notes-title">Warranty</div>
        <div class="notes-content">All work is guaranteed for ${business.warrantyPeriod} from completion date.</div>
      </div>
    ` : ''}
    
    ${(business as any).insuranceDetails || (business as any).insuranceProvider ? `
      <div class="notes-section" style="margin-top: 16px; background: #f0f9ff; border-left-color: #3b82f6;">
        <div class="notes-title" style="color: #1e40af;">Insurance & Licensing</div>
        <div class="notes-content" style="color: #1e40af;">
${business.licenseNumber ? `Licence: ${business.licenseNumber}` : ''}
${(business as any).insuranceProvider ? `Insurer: ${(business as any).insuranceProvider}` : ''}
${(business as any).insuranceAmount ? `Coverage: ${(business as any).insuranceAmount}` : ''}
        </div>
      </div>
    ` : ''}
    
    ${(business as any).includeSignatureOnInvoices && (business as any).defaultSignature ? `
      <div style="margin-top: 24px; padding: 20px; border-top: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: flex-end;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #666; margin-bottom: 8px;">Issued by:</div>
            <img src="${(business as any).defaultSignature}" alt="Signature" style="max-height: 60px; width: auto; margin-bottom: 4px;" />
            ${(business as any).signatureName ? `<div style="font-size: 11px; font-weight: 500; color: #333;">${(business as any).signatureName}</div>` : ''}
            <div style="font-size: 10px; color: #666;">${business.businessName}</div>
          </div>
        </div>
      </div>
    ` : ''}
    
    <div class="footer">
      <p>Thank you for your business!</p>
      ${business.abn ? `<p style="margin-top: 4px;">ABN: ${business.abn}</p>` : ''}
      <p style="margin-top: 4px;">Generated by TradieTrack • ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
  `;
};

export const generateQuoteAcceptancePage = (data: QuoteWithDetails, acceptanceUrl: string): string => {
  const { quote, lineItems, client, business, signature, token, canAcceptPayments } = data;
  const brandColor = business.brandColor || '#2563eb';
  
  const subtotal = parseFloat(quote.subtotal as unknown as string);
  const gstAmount = parseFloat(quote.gstAmount as unknown as string);
  const total = parseFloat(quote.total as unknown as string);
  
  // Calculate deposit amount
  let depositAmount = 0;
  if ((quote as any).depositRequired) {
    if ((quote as any).depositAmount) {
      depositAmount = parseFloat((quote as any).depositAmount as unknown as string);
    } else if ((quote as any).depositPercent) {
      const percent = parseFloat((quote as any).depositPercent as unknown as string);
      depositAmount = total * (percent / 100);
    } else {
      depositAmount = total * 0.2; // Default 20%
    }
  }
  const depositPaid = (quote as any).depositPaid || false;
  const depositRequired = (quote as any).depositRequired || false;
  
  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();
  const isAlreadyActioned = quote.status === 'accepted' || quote.status === 'declined';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote ${quote.number} - ${business.businessName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 700px;
      margin: 0 auto;
    }
    
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      overflow: hidden;
      margin-bottom: 20px;
    }
    
    .header {
      background: ${brandColor};
      color: white;
      padding: 24px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 24px;
      margin-bottom: 4px;
    }
    
    .header p {
      opacity: 0.9;
      font-size: 14px;
    }
    
    .content {
      padding: 24px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    
    @media (max-width: 500px) {
      .info-grid { grid-template-columns: 1fr; }
    }
    
    .info-block h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    
    .info-block p {
      color: #1f2937;
      line-height: 1.6;
    }
    
    .description {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    
    .description h4 {
      color: ${brandColor};
      margin-bottom: 8px;
    }
    
    .line-items {
      margin-bottom: 24px;
    }
    
    .line-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .line-item:last-child {
      border-bottom: none;
    }
    
    .line-item-desc {
      flex: 1;
    }
    
    .line-item-desc small {
      color: #6b7280;
      font-size: 12px;
    }
    
    .line-item-amount {
      font-weight: 600;
      text-align: right;
    }
    
    .totals {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    
    .total-row.final {
      border-top: 2px solid ${brandColor};
      margin-top: 8px;
      padding-top: 16px;
      font-size: 20px;
      font-weight: 700;
      color: ${brandColor};
    }
    
    .status-banner {
      padding: 16px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 24px;
    }
    
    .status-accepted {
      background: #dcfce7;
      color: #166534;
    }
    
    .status-declined {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .status-expired {
      background: #fef3c7;
      color: #92400e;
    }
    
    .actions {
      display: flex;
      gap: 12px;
    }
    
    @media (max-width: 500px) {
      .actions { flex-direction: column; }
    }
    
    .btn {
      flex: 1;
      padding: 16px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-accept {
      background: #22c55e;
      color: white;
    }
    
    .btn-accept:hover {
      background: #16a34a;
    }
    
    .btn-decline {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }
    
    .btn-decline:hover {
      background: #e5e7eb;
    }
    
    .form-group {
      margin-bottom: 16px;
    }
    
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #374151;
    }
    
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 16px;
    }
    
    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: ${brandColor};
      box-shadow: 0 0 0 3px ${brandColor}20;
    }
    
    .signature-pad-container {
      margin-bottom: 16px;
    }
    
    .signature-pad-container label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #374151;
    }
    
    .signature-pad-wrapper {
      position: relative;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      background: #fafafa;
      touch-action: none;
    }
    
    .signature-pad-wrapper.has-signature {
      border-style: solid;
      border-color: ${brandColor};
    }
    
    .signature-canvas {
      display: block;
      width: 100%;
      height: 150px;
      cursor: crosshair;
      touch-action: none;
    }
    
    .signature-placeholder {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #9ca3af;
      font-size: 14px;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .signature-placeholder.hidden {
      display: none;
    }
    
    .signature-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      gap: 8px;
    }
    
    .signature-btn {
      padding: 6px 12px;
      font-size: 13px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: white;
      color: #374151;
      cursor: pointer;
    }
    
    .signature-btn:hover {
      background: #f3f4f6;
    }
    
    .signature-error {
      color: #dc2626;
      font-size: 13px;
      margin-top: 4px;
    }
    
    .signature-display {
      margin-top: 16px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .signature-display-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    
    .signature-display img {
      max-width: 100%;
      max-height: 100px;
      display: block;
    }
    
    .signature-display-info {
      margin-top: 8px;
      font-size: 13px;
      color: #6b7280;
    }
    
    /* Payment section styles */
    .payment-section {
      margin-top: 24px;
      padding: 20px;
      background: #f0fdf4;
      border-radius: 12px;
      border: 1px solid #bbf7d0;
    }
    
    .payment-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .payment-header svg {
      color: #16a34a;
    }
    
    .payment-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: #166534;
    }
    
    .payment-amount {
      font-size: 28px;
      font-weight: 700;
      color: #166534;
      margin-bottom: 4px;
    }
    
    .payment-label {
      font-size: 13px;
      color: #15803d;
      margin-bottom: 20px;
    }
    
    .payment-form-container {
      background: white;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    #payment-form {
      margin-bottom: 16px;
    }
    
    #payment-element {
      margin-bottom: 16px;
    }
    
    .payment-btn {
      width: 100%;
      padding: 14px 24px;
      background: #16a34a;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 48px;
    }
    
    .payment-btn:hover {
      background: #15803d;
    }
    
    .payment-btn:disabled {
      background: #86efac;
      cursor: not-allowed;
    }
    
    .payment-error {
      color: #dc2626;
      font-size: 14px;
      margin-top: 12px;
      padding: 12px;
      background: #fef2f2;
      border-radius: 6px;
      display: none;
    }
    
    .payment-success {
      text-align: center;
      padding: 24px;
    }
    
    .payment-success svg {
      color: #16a34a;
      margin-bottom: 12px;
    }
    
    .payment-success h3 {
      font-size: 18px;
      font-weight: 600;
      color: #166534;
      margin-bottom: 8px;
    }
    
    .payment-success p {
      color: #15803d;
      font-size: 14px;
    }
    
    .deposit-paid-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #dcfce7;
      border-radius: 8px;
      margin-top: 16px;
    }
    
    .deposit-paid-banner svg {
      color: #16a34a;
      flex-shrink: 0;
    }
    
    .deposit-paid-banner span {
      color: #166534;
      font-weight: 500;
    }
    
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid white;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .hidden {
      display: none;
    }
    
    .footer {
      text-align: center;
      padding: 20px;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>${business.businessName}</h1>
        <p>Quote ${quote.number}</p>
      </div>
      
      <div class="content">
        ${isAlreadyActioned ? `
          <div class="status-banner ${quote.status === 'accepted' ? 'status-accepted' : 'status-declined'}">
            <strong>This quote has been ${quote.status}</strong>
            ${quote.acceptedAt ? `<br><small>on ${formatDate(quote.acceptedAt)}</small>` : ''}
            ${quote.rejectedAt ? `<br><small>on ${formatDate(quote.rejectedAt)}</small>` : ''}
            ${quote.acceptedBy ? `<br><small>by ${quote.acceptedBy}</small>` : ''}
          </div>
          ${quote.status === 'accepted' && signature ? `
            <div class="signature-display">
              <div class="signature-display-label">Client Signature</div>
              <img src="${signature.signatureData}" alt="Client signature" />
              <div class="signature-display-info">
                Signed by ${signature.signerName} on ${formatDate(signature.signedAt)}
              </div>
            </div>
          ` : ''}
          ${quote.status === 'accepted' && depositRequired && canAcceptPayments ? `
            ${depositPaid ? `
              <div class="deposit-paid-banner">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Deposit of ${formatCurrency(depositAmount)} has been paid. Thank you!</span>
              </div>
            ` : `
              <div class="payment-section" id="payment-section">
                <div class="payment-header">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <h3>Pay Deposit Now</h3>
                </div>
                <div class="payment-amount">${formatCurrency(depositAmount)}</div>
                <div class="payment-label">Deposit required to secure your booking</div>
                
                <div id="payment-loading">
                  <div class="payment-form-container">
                    <p style="text-align: center; color: #6b7280;">Loading payment form...</p>
                  </div>
                </div>
                
                <div id="payment-container" class="hidden">
                  <div class="payment-form-container">
                    <form id="payment-form">
                      <div id="payment-element"></div>
                      <button type="submit" class="payment-btn" id="payment-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                          <path d="M9 12l2 2 4-4"/>
                        </svg>
                        Pay ${formatCurrency(depositAmount)}
                      </button>
                    </form>
                    <div class="payment-error" id="payment-error"></div>
                  </div>
                </div>
                
                <div id="payment-success" class="hidden">
                  <div class="payment-success">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <h3>Payment Successful!</h3>
                    <p>Your deposit has been received. We'll be in touch soon to confirm your booking.</p>
                  </div>
                </div>
              </div>
              
              <script src="https://js.stripe.com/v3/"></script>
              <script>
                (async function initPayment() {
                  const token = '${token || ''}';
                  if (!token) {
                    document.getElementById('payment-loading').innerHTML = '<p style="text-align: center; color: #dc2626;">Payment not available</p>';
                    return;
                  }
                  
                  try {
                    // Create payment intent
                    const response = await fetch('/api/public/quote/' + token + '/pay', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to initialize payment');
                    }
                    
                    const { clientSecret, publishableKey } = await response.json();
                    
                    if (!clientSecret || !publishableKey) {
                      throw new Error('Payment configuration error');
                    }
                    
                    // Initialize Stripe
                    const stripe = Stripe(publishableKey);
                    const elements = stripe.elements({ clientSecret });
                    const paymentElement = elements.create('payment');
                    paymentElement.mount('#payment-element');
                    
                    // Show payment form
                    document.getElementById('payment-loading').classList.add('hidden');
                    document.getElementById('payment-container').classList.remove('hidden');
                    
                    // Handle form submission
                    const form = document.getElementById('payment-form');
                    const submitBtn = document.getElementById('payment-btn');
                    const errorDiv = document.getElementById('payment-error');
                    
                    form.addEventListener('submit', async (e) => {
                      e.preventDefault();
                      submitBtn.disabled = true;
                      submitBtn.innerHTML = '<div class="spinner"></div> Processing...';
                      errorDiv.style.display = 'none';
                      
                      const { error, paymentIntent } = await stripe.confirmPayment({
                        elements,
                        confirmParams: {
                          return_url: window.location.href
                        },
                        redirect: 'if_required'
                      });
                      
                      if (error) {
                        errorDiv.textContent = error.message;
                        errorDiv.style.display = 'block';
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9 12l2 2 4-4"/></svg> Pay ${formatCurrency(depositAmount).replace('$', '\\$')}';
                      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                        document.getElementById('payment-container').classList.add('hidden');
                        document.getElementById('payment-success').classList.remove('hidden');
                      }
                    });
                    
                  } catch (err) {
                    document.getElementById('payment-loading').innerHTML = '<p style="text-align: center; color: #dc2626;">' + (err.message || 'Payment not available') + '</p>';
                  }
                })();
              </script>
            `}
          ` : ''}
        ` : isExpired ? `
          <div class="status-banner status-expired">
            <strong>This quote has expired</strong>
            <br><small>Expired on ${formatDate(quote.validUntil)}</small>
          </div>
        ` : ''}
        
        <div class="info-grid">
          <div class="info-block">
            <h3>Prepared For</h3>
            <p>
              <strong>${client.name}</strong><br/>
              ${client.address ? `${client.address}<br/>` : ''}
              ${client.email || ''}
            </p>
          </div>
          <div class="info-block">
            <h3>Quote Details</h3>
            <p>
              <strong>Date:</strong> ${formatDate(quote.createdAt)}<br/>
              ${quote.validUntil ? `<strong>Valid Until:</strong> ${formatDate(quote.validUntil)}` : ''}
            </p>
          </div>
        </div>
        
        ${quote.description ? `
          <div class="description">
            <h4>${quote.title}</h4>
            <p>${quote.description}</p>
          </div>
        ` : ''}
        
        <div class="line-items">
          ${lineItems.map(item => `
            <div class="line-item">
              <div class="line-item-desc">
                ${item.description}
                <br><small>${parseFloat(item.quantity as unknown as string)} × ${formatCurrency(item.unitPrice)}</small>
              </div>
              <div class="line-item-amount">${formatCurrency(item.total)}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          ${gstAmount > 0 ? `
            <div class="total-row">
              <span>GST (10%)</span>
              <span>${formatCurrency(gstAmount)}</span>
            </div>
          ` : ''}
          <div class="total-row final">
            <span>Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>
        
        ${quote.notes ? `
          <div class="description" style="margin-bottom: 24px;">
            <h4>Terms & Conditions</h4>
            <p style="white-space: pre-wrap; font-size: 13px; color: #4b5563;">${quote.notes}</p>
          </div>
        ` : ''}
        
        ${!isAlreadyActioned && !isExpired ? `
          <form id="acceptance-form" method="POST" action="${acceptanceUrl}">
            <div id="accept-section" class="hidden">
              <div class="form-group">
                <label for="accepted_by">Your Name *</label>
                <input type="text" id="accepted_by" name="accepted_by" required placeholder="Enter your full name" value="${client.name}"/>
              </div>
              
              <div class="signature-pad-container">
                <label>Your Signature *</label>
                <div class="signature-pad-wrapper" id="signature-wrapper">
                  <canvas id="signature-canvas" class="signature-canvas"></canvas>
                  <div class="signature-placeholder" id="signature-placeholder">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                    </svg>
                    <span>Draw your signature here</span>
                  </div>
                </div>
                <div class="signature-actions">
                  <button type="button" class="signature-btn" onclick="clearSignature()">Clear</button>
                </div>
                <div class="signature-error hidden" id="signature-error">Please provide your signature</div>
                <input type="hidden" id="signature_data" name="signature_data" />
              </div>
              
              <div class="form-group">
                <label for="notes">Additional Notes (optional)</label>
                <textarea id="notes" name="notes" rows="3" placeholder="Any special requests or notes?"></textarea>
              </div>
              <input type="hidden" name="action" value="accept"/>
            </div>
            
            <div id="decline-section" class="hidden">
              <div class="form-group">
                <label for="decline_reason">Reason for Declining (optional)</label>
                <textarea id="decline_reason" name="decline_reason" rows="3" placeholder="Help us understand why..."></textarea>
              </div>
              <input type="hidden" name="action" value="decline"/>
            </div>
            
            <div class="actions" id="action-buttons">
              <button type="button" class="btn btn-accept" onclick="showAcceptForm()">Accept Quote</button>
              <button type="button" class="btn btn-decline" onclick="showDeclineForm()">Decline</button>
            </div>
            
            <div class="actions hidden" id="confirm-accept">
              <button type="submit" class="btn btn-accept" onclick="return validateAndSubmit()">Confirm Acceptance</button>
              <button type="button" class="btn btn-decline" onclick="resetForm()">Cancel</button>
            </div>
            
            <div class="actions hidden" id="confirm-decline">
              <button type="submit" class="btn btn-decline" style="background: #ef4444; color: white;">Confirm Decline</button>
              <button type="button" class="btn btn-decline" onclick="resetForm()">Cancel</button>
            </div>
          </form>
          
          <script>
            // Signature pad variables
            let canvas, ctx, isDrawing = false, hasSignature = false;
            let lastX = 0, lastY = 0;
            
            // Initialize signature pad
            document.addEventListener('DOMContentLoaded', function() {
              canvas = document.getElementById('signature-canvas');
              ctx = canvas.getContext('2d');
              
              // Set canvas size to match display size
              function resizeCanvas() {
                const rect = canvas.parentElement.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                canvas.width = rect.width * dpr;
                canvas.height = 150 * dpr;
                canvas.style.width = rect.width + 'px';
                canvas.style.height = '150px';
                ctx.scale(dpr, dpr);
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#1f2937';
              }
              
              resizeCanvas();
              window.addEventListener('resize', resizeCanvas);
              
              // Mouse events
              canvas.addEventListener('mousedown', startDrawing);
              canvas.addEventListener('mousemove', draw);
              canvas.addEventListener('mouseup', stopDrawing);
              canvas.addEventListener('mouseout', stopDrawing);
              
              // Touch events for mobile
              canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
              canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
              canvas.addEventListener('touchend', stopDrawing);
            });
            
            function getPos(e) {
              const rect = canvas.getBoundingClientRect();
              return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              };
            }
            
            function handleTouchStart(e) {
              e.preventDefault();
              const touch = e.touches[0];
              const pos = getPos(touch);
              lastX = pos.x;
              lastY = pos.y;
              isDrawing = true;
            }
            
            function handleTouchMove(e) {
              e.preventDefault();
              if (!isDrawing) return;
              const touch = e.touches[0];
              const pos = getPos(touch);
              ctx.beginPath();
              ctx.moveTo(lastX, lastY);
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
              lastX = pos.x;
              lastY = pos.y;
              updateSignatureState();
            }
            
            function startDrawing(e) {
              isDrawing = true;
              const pos = getPos(e);
              lastX = pos.x;
              lastY = pos.y;
            }
            
            function draw(e) {
              if (!isDrawing) return;
              const pos = getPos(e);
              ctx.beginPath();
              ctx.moveTo(lastX, lastY);
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
              lastX = pos.x;
              lastY = pos.y;
              updateSignatureState();
            }
            
            function stopDrawing() {
              isDrawing = false;
            }
            
            function updateSignatureState() {
              hasSignature = true;
              document.getElementById('signature-wrapper').classList.add('has-signature');
              document.getElementById('signature-placeholder').classList.add('hidden');
              document.getElementById('signature-error').classList.add('hidden');
              // Save signature data
              document.getElementById('signature_data').value = canvas.toDataURL('image/png');
            }
            
            function clearSignature() {
              const dpr = window.devicePixelRatio || 1;
              ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
              hasSignature = false;
              document.getElementById('signature-wrapper').classList.remove('has-signature');
              document.getElementById('signature-placeholder').classList.remove('hidden');
              document.getElementById('signature_data').value = '';
            }
            
            function validateAndSubmit() {
              const nameInput = document.getElementById('accepted_by');
              if (!nameInput.value.trim()) {
                nameInput.focus();
                return false;
              }
              
              if (!hasSignature) {
                document.getElementById('signature-error').classList.remove('hidden');
                return false;
              }
              
              return true;
            }
            
            function showAcceptForm() {
              document.getElementById('accept-section').classList.remove('hidden');
              document.getElementById('decline-section').classList.add('hidden');
              document.getElementById('action-buttons').classList.add('hidden');
              document.getElementById('confirm-accept').classList.remove('hidden');
              document.getElementById('confirm-decline').classList.add('hidden');
              document.querySelector('input[name="action"]').value = 'accept';
              
              // Resize canvas after showing (fixes sizing issues)
              setTimeout(function() {
                const rect = canvas.parentElement.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                canvas.width = rect.width * dpr;
                canvas.height = 150 * dpr;
                canvas.style.width = rect.width + 'px';
                canvas.style.height = '150px';
                ctx.scale(dpr, dpr);
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#1f2937';
              }, 50);
            }
            
            function showDeclineForm() {
              document.getElementById('decline-section').classList.remove('hidden');
              document.getElementById('accept-section').classList.add('hidden');
              document.getElementById('action-buttons').classList.add('hidden');
              document.getElementById('confirm-decline').classList.remove('hidden');
              document.getElementById('confirm-accept').classList.add('hidden');
              document.querySelector('input[name="action"]').value = 'decline';
            }
            
            function resetForm() {
              document.getElementById('accept-section').classList.add('hidden');
              document.getElementById('decline-section').classList.add('hidden');
              document.getElementById('action-buttons').classList.remove('hidden');
              document.getElementById('confirm-accept').classList.add('hidden');
              document.getElementById('confirm-decline').classList.add('hidden');
              clearSignature();
            }
          </script>
        ` : ''}
      </div>
    </div>
    
    <div class="footer">
      <p>Quote from ${business.businessName}${business.abn ? ` • ABN ${business.abn}` : ''}</p>
      <p style="margin-top: 4px;">Powered by TradieTrack</p>
    </div>
  </div>
</body>
</html>
  `;
};

// Convert HTML to actual PDF using Puppeteer
export const generatePDFBuffer = async (html: string): Promise<Buffer> => {
  const puppeteer = await import('puppeteer');
  const { execSync } = await import('child_process');
  
  console.log('[PDF] Starting PDF generation...');
  
  // Find system-installed Chromium executable
  let chromiumPath: string | undefined;
  try {
    chromiumPath = execSync('which chromium').toString().trim();
    console.log('[PDF] Found Chromium at:', chromiumPath);
  } catch {
    console.log('[PDF] Chromium not found in PATH, using Puppeteer default');
  }
  
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--single-process',
    ],
    timeout: 60000,
  });
  
  try {
    console.log('[PDF] Browser launched, creating page...');
    const page = await browser.newPage();
    
    // Set longer timeout for content loading
    page.setDefaultTimeout(30000);
    
    console.log('[PDF] Setting page content...');
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    // Wait a bit for fonts to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('[PDF] Generating PDF buffer...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
      timeout: 30000,
    });
    
    console.log('[PDF] PDF generated successfully, size:', pdfBuffer.length);
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('[PDF] Error generating PDF:', error);
    throw error;
  } finally {
    console.log('[PDF] Closing browser...');
    await browser.close();
  }
};

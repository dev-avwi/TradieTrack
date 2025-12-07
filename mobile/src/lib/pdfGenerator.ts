/**
 * Mobile PDF Generation Service
 * 
 * Generates PDF documents on-device for quotes, invoices, and other documents
 * without requiring a server round-trip. Uses Expo Print for native PDF creation.
 * 
 * INSTALLATION REQUIREMENTS:
 * npx expo install expo-print expo-sharing expo-file-system expo-image-manipulator
 * 
 * These packages are required for on-device PDF generation and sharing.
 */

// These imports require: npx expo install expo-print expo-sharing expo-file-system
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
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteData {
  number: string;
  date: string;
  validUntil: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
  notes?: string;
  terms?: string;
}

export interface InvoiceData {
  number: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  notes?: string;
  paymentTerms?: string;
  bankDetails?: string;
}

class PDFGeneratorService {
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  private getBaseStyles(): string {
    return `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #1a1a1a;
          padding: 40px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .business-info h1 {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        .business-info p {
          color: #666;
          margin-bottom: 4px;
        }
        .document-info {
          text-align: right;
        }
        .document-type {
          font-size: 28px;
          font-weight: 700;
          color: #3b82f6;
          margin-bottom: 8px;
        }
        .document-meta {
          color: #666;
        }
        .document-meta strong {
          color: #1a1a1a;
        }
        .client-section {
          background: #f8fafc;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .client-section h2 {
          font-size: 12px;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 8px;
        }
        .client-name {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th {
          background: #f1f5f9;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        th:last-child {
          text-align: right;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        td:last-child {
          text-align: right;
        }
        .totals {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        .totals-table {
          width: 250px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .totals-row.total {
          font-size: 16px;
          font-weight: 700;
          border-bottom: none;
          padding-top: 12px;
        }
        .totals-row.due {
          background: #fef2f2;
          padding: 12px;
          border-radius: 6px;
          color: #dc2626;
          margin-top: 8px;
        }
        .notes-section {
          background: #f8fafc;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .notes-section h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 8px;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 11px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
      </style>
    `;
  }

  private generateItemsTable(items: LineItem[]): string {
    const rows = items.map(item => `
      <tr>
        <td>${item.description}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${this.formatCurrency(item.unitPrice)}</td>
        <td>${this.formatCurrency(item.total)}</td>
      </tr>
    `).join('');

    return `
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Generate a PDF quote document
   */
  async generateQuotePDF(quote: QuoteData, business: BusinessInfo): Promise<string> {
    if (!Print) {
      throw new Error('PDF generation not available. Run: npx expo install expo-print');
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          ${this.getBaseStyles()}
        </head>
        <body>
          <div class="header">
            <div class="business-info">
              <h1>${business.businessName}</h1>
              ${business.abn ? `<p>ABN: ${business.abn}</p>` : ''}
              ${business.address ? `<p>${business.address}</p>` : ''}
              ${business.phone ? `<p>${business.phone}</p>` : ''}
              ${business.email ? `<p>${business.email}</p>` : ''}
            </div>
            <div class="document-info">
              <div class="document-type">QUOTE</div>
              <div class="document-meta">
                <p><strong>Quote #:</strong> ${quote.number}</p>
                <p><strong>Date:</strong> ${this.formatDate(quote.date)}</p>
                <p><strong>Valid Until:</strong> ${this.formatDate(quote.validUntil)}</p>
              </div>
            </div>
          </div>

          <div class="client-section">
            <h2>Quote For</h2>
            <p class="client-name">${quote.clientName}</p>
            ${quote.clientEmail ? `<p>${quote.clientEmail}</p>` : ''}
            ${quote.clientAddress ? `<p>${quote.clientAddress}</p>` : ''}
          </div>

          ${this.generateItemsTable(quote.items)}

          <div class="totals">
            <div class="totals-table">
              <div class="totals-row">
                <span>Subtotal</span>
                <span>${this.formatCurrency(quote.subtotal)}</span>
              </div>
              <div class="totals-row">
                <span>GST (10%)</span>
                <span>${this.formatCurrency(quote.gst)}</span>
              </div>
              <div class="totals-row total">
                <span>Total (AUD)</span>
                <span>${this.formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          ${quote.notes ? `
            <div class="notes-section">
              <h3>Notes</h3>
              <p>${quote.notes}</p>
            </div>
          ` : ''}

          ${quote.terms ? `
            <div class="notes-section">
              <h3>Terms & Conditions</h3>
              <p>${quote.terms}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your business</p>
            ${business.website ? `<p>${business.website}</p>` : ''}
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
   * Generate a PDF invoice document
   */
  async generateInvoicePDF(invoice: InvoiceData, business: BusinessInfo): Promise<string> {
    if (!Print) {
      throw new Error('PDF generation not available. Run: npx expo install expo-print');
    }
    
    const amountDue = invoice.amountDue ?? (invoice.total - (invoice.amountPaid || 0));
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          ${this.getBaseStyles()}
        </head>
        <body>
          <div class="header">
            <div class="business-info">
              <h1>${business.businessName}</h1>
              ${business.abn ? `<p>ABN: ${business.abn}</p>` : ''}
              ${business.address ? `<p>${business.address}</p>` : ''}
              ${business.phone ? `<p>${business.phone}</p>` : ''}
              ${business.email ? `<p>${business.email}</p>` : ''}
            </div>
            <div class="document-info">
              <div class="document-type">TAX INVOICE</div>
              <div class="document-meta">
                <p><strong>Invoice #:</strong> ${invoice.number}</p>
                <p><strong>Date:</strong> ${this.formatDate(invoice.date)}</p>
                <p><strong>Due Date:</strong> <span style="color: #dc2626;">${this.formatDate(invoice.dueDate)}</span></p>
              </div>
            </div>
          </div>

          <div class="client-section">
            <h2>Bill To</h2>
            <p class="client-name">${invoice.clientName}</p>
            ${invoice.clientEmail ? `<p>${invoice.clientEmail}</p>` : ''}
            ${invoice.clientAddress ? `<p>${invoice.clientAddress}</p>` : ''}
          </div>

          ${this.generateItemsTable(invoice.items)}

          <div class="totals">
            <div class="totals-table">
              <div class="totals-row">
                <span>Subtotal</span>
                <span>${this.formatCurrency(invoice.subtotal)}</span>
              </div>
              <div class="totals-row">
                <span>GST (10%)</span>
                <span>${this.formatCurrency(invoice.gst)}</span>
              </div>
              <div class="totals-row total">
                <span>Total (AUD)</span>
                <span>${this.formatCurrency(invoice.total)}</span>
              </div>
              ${invoice.amountPaid ? `
                <div class="totals-row">
                  <span>Amount Paid</span>
                  <span>-${this.formatCurrency(invoice.amountPaid)}</span>
                </div>
              ` : ''}
              ${amountDue > 0 ? `
                <div class="totals-row due">
                  <span>Amount Due</span>
                  <span>${this.formatCurrency(amountDue)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          ${invoice.bankDetails ? `
            <div class="notes-section">
              <h3>Payment Details</h3>
              <p style="white-space: pre-line;">${invoice.bankDetails}</p>
            </div>
          ` : ''}

          ${invoice.notes ? `
            <div class="notes-section">
              <h3>Notes</h3>
              <p>${invoice.notes}</p>
            </div>
          ` : ''}

          ${invoice.paymentTerms ? `
            <div class="notes-section">
              <h3>Payment Terms</h3>
              <p>${invoice.paymentTerms}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your business</p>
            ${business.website ? `<p>${business.website}</p>` : ''}
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

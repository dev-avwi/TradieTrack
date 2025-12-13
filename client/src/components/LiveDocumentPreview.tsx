import { Separator } from "@/components/ui/separator";
import { FileCheck, Phone, Mail, MapPin, Building2 } from "lucide-react";

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
  type: "quote" | "invoice";
  documentNumber?: string;
  title: string;
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

  return (
    <div 
      className="print-document bg-white rounded-lg shadow-lg overflow-hidden w-full max-w-full border border-slate-200"
      style={{ '--print-brand-color': brandColor } as React.CSSProperties}
      data-print-document
    >
      {/* Status stamp for accepted/paid documents */}
      {status === 'accepted' && (
        <div className="print-stamp hidden print:block">ACCEPTED</div>
      )}
      {status === 'paid' && (
        <div className="print-stamp hidden print:block">PAID</div>
      )}

      {/* Header - Matches PDF .header class */}
      <div className="print-header border-b p-4 sm:p-6 bg-slate-50 print:bg-transparent print:border-b-[3px]" style={{ borderBottomColor: brandColor }} data-print-header>
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 items-start">
          {/* Company Information with Logo */}
          <div className="print-company-info flex-1 flex items-start gap-3 print:block">
            {business.logoUrl ? (
              <img 
                src={business.logoUrl} 
                alt={business.businessName || 'Business Logo'} 
                className="print-logo h-12 w-12 sm:h-14 sm:w-14 object-contain rounded-lg border border-slate-200 bg-white p-1 flex-shrink-0 print:max-w-[150px] print:max-h-[60px] print:h-auto print:w-auto print:rounded-none print:border-0 print:p-0 print:mb-3"
              />
            ) : (
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 print:hidden">
                <Building2 className="h-6 w-6 text-slate-500" />
              </div>
            )}
            <div className="print:mt-0">
              <h1 className="print-company-name text-xl sm:text-2xl font-bold text-slate-900 mb-1 print:text-[24px]" style={{ color: brandColor }}>
                {business.businessName || 'Your Business Name'}
              </h1>
              <div className="print-company-details text-sm text-slate-600 space-y-0.5 print:text-[10px] print:leading-[1.6] print:text-[#666]">
                {business.abn && (
                  <p className="mb-1">
                    <span className="font-medium">ABN:</span> {business.abn}
                  </p>
                )}
                {business.address && (
                  <p className="break-words">{business.address}</p>
                )}
                {business.phone && (
                  <p>Phone: {business.phone}</p>
                )}
                {business.email && (
                  <p className="break-words">Email: {business.email}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Document Title & Details */}
          <div className="print-document-type w-full sm:w-auto sm:text-right print:text-right">
            <h2 className="print-document-title text-lg sm:text-xl font-bold text-slate-800 mb-3 print:text-[32px] print:uppercase print:tracking-[2px]" style={{ color: brandColor }}>
              {type === 'quote' ? 'QUOTE' : (gstEnabled ? 'TAX INVOICE' : 'INVOICE')}
            </h2>
            <div className="print-document-number bg-white border border-slate-200 rounded-lg p-3 shadow-sm print:bg-transparent print:border-0 print:p-0 print:shadow-none print:text-[14px] print:text-[#666]">
              <div className="space-y-1.5 text-sm print:space-y-1">
                <div className="flex justify-between gap-4 print:justify-end">
                  <span className="font-medium text-slate-600 print:hidden">{type === 'quote' ? 'Quote' : 'Invoice'} #:</span>
                  <span className="font-mono font-semibold text-slate-900 print:text-[#666]">{documentNumber || 'AUTO'}</span>
                </div>
                {status && (
                  <div className="flex justify-end mt-2 print:mt-2">
                    <span className={`print-status-badge px-3 py-1 rounded-full text-xs font-semibold uppercase print-status-${status}`}>
                      {status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="p-4 sm:p-6 space-y-5 print:p-0 print:space-y-6">
        {/* Info Section - Client & Date Details */}
        <div className="print-info-section grid grid-cols-1 sm:grid-cols-2 gap-4 print:flex print:justify-between print:gap-10">
          {/* Bill To Section */}
          <div className="print-info-block">
            <h3 className="print-info-label text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide print:text-[10px] print:text-[#888] print:tracking-[1px]">
              {type === 'quote' ? 'Quote For' : 'Bill To'}
            </h3>
            <div className="print-info-value bg-slate-50 p-3 rounded border border-slate-200 print:bg-transparent print:p-0 print:border-0 print:rounded-none">
              {client ? (
                <>
                  <p className="font-semibold text-slate-900 print:font-bold">{client.name}</p>
                  <div className="text-sm text-slate-600 space-y-0.5 mt-1 print:text-[#1a1a1a] print:leading-[1.5]">
                    {client.address && <p className="whitespace-pre-line">{client.address}</p>}
                    {client.email && <p>{client.email}</p>}
                    {client.phone && <p>{client.phone}</p>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 italic print:text-[#666]">Select a client...</p>
              )}
            </div>
          </div>

          {/* Document Details */}
          <div className="print-info-block">
            <h3 className="print-info-label text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide print:text-[10px] print:text-[#888] print:tracking-[1px]">
              {type === 'quote' ? 'Quote Details' : 'Invoice Details'}
            </h3>
            <div className="print-info-value bg-slate-50 p-3 rounded border border-slate-200 print:bg-transparent print:p-0 print:border-0 print:rounded-none print:text-[#1a1a1a] print:leading-[1.5]">
              <p><strong>Date:</strong> {formatDate(date || new Date().toISOString())}</p>
              {type === 'quote' && validUntil && (
                <p><strong>Valid Until:</strong> {formatDate(validUntil)}</p>
              )}
              {type === 'invoice' && dueDate && (
                <p><strong>Due Date:</strong> <span className="text-red-600 font-semibold print:text-[#dc2626]">{formatDate(dueDate)}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Description Section */}
        {(title || description) && (
          <div className="print-description-section print:mb-6 print:p-4 print:bg-[#f8f9fa] print:rounded-md">
            <p className="print-description-title font-medium text-slate-900 print:font-semibold print:mb-2" style={{ color: brandColor }}>
              {title || `New ${type === 'quote' ? 'Quote' : 'Invoice'}`}
            </p>
            {description && (
              <p className="text-sm text-slate-600 mt-1 print:text-[#1a1a1a]">{description}</p>
            )}
          </div>
        )}

        {/* Line Items Table */}
        <div className="print-avoid-break">
          <div className="overflow-x-auto">
            <table className="print-line-items-table w-full border-collapse border border-slate-200 rounded-lg overflow-hidden text-sm print:border-0 print:rounded-none" data-print-table>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 print:border-0" style={{ backgroundColor: brandColor }}>
                  <th className="px-3 sm:px-4 py-2 text-left font-semibold text-slate-700 print:text-white print:py-3 print:px-3 print:text-[10px] print:uppercase print:tracking-[0.5px]" style={{ width: '50%' }}>Description</th>
                  <th className="px-3 sm:px-4 py-2 text-center w-12 sm:w-16 font-semibold text-slate-700 print:text-white print:text-right print:py-3 print:px-3 print:text-[10px] print:uppercase print:tracking-[0.5px]" style={{ width: '15%' }}>Qty</th>
                  <th className="px-3 sm:px-4 py-2 text-right w-20 sm:w-24 font-semibold text-slate-700 print:text-white print:py-3 print:px-3 print:text-[10px] print:uppercase print:tracking-[0.5px]" style={{ width: '17%' }}>Price</th>
                  <th className="px-3 sm:px-4 py-2 text-right w-20 sm:w-24 font-semibold text-slate-700 print:text-white print:py-3 print:px-3 print:text-[10px] print:uppercase print:tracking-[0.5px]" style={{ width: '18%' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {validLineItems.length > 0 ? (
                  validLineItems.map((item, index) => (
                    <tr key={index} className="border-b border-slate-200 print:border-b print:border-[#eee]">
                      <td className="px-3 sm:px-4 py-3 text-slate-900 break-words print:py-3 print:px-3 print:text-[#1a1a1a]">{item.description}</td>
                      <td className="px-3 sm:px-4 py-3 text-center text-slate-700 print:text-right print:py-3 print:px-3 print:whitespace-nowrap">
                        {safeParseFloat(item.quantity).toFixed(2)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right text-slate-700 print:py-3 print:px-3 print:whitespace-nowrap">
                        {formatCurrency(safeParseFloat(item.unitPrice))}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-semibold text-slate-900 print:py-3 print:px-3 print:whitespace-nowrap">
                        {formatCurrency(calculateLineTotal(item))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 italic print:py-4 print:text-[#888]">
                      Add line items to see them here...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section - Right aligned like PDF */}
        <div className="print-totals-section flex justify-end">
          <div className="print-totals-table w-full sm:w-72 print:w-[280px]">
            {gstEnabled ? (
              <div className="space-y-2 print:space-y-0">
                <div className="print-totals-row flex justify-between py-1 text-sm print:py-2 print:border-b print:border-[#eee]">
                  <span className="print-totals-label text-slate-600 print:text-[#666]">Subtotal</span>
                  <span className="print-totals-value font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="print-totals-row flex justify-between py-1 text-sm print:py-2 print:border-b print:border-[#eee]">
                  <span className="print-totals-label text-slate-600 print:text-[#666]">GST (10%)</span>
                  <span className="print-totals-value font-semibold text-slate-900">{formatCurrency(gst)}</span>
                </div>
                <div className="print-totals-row print-total-final border-t border-slate-300 pt-2 print:border-t-2 print:border-b-0 print:pt-3 print:mt-1" style={{ borderTopColor: brandColor }}>
                  <div className="flex justify-between items-center bg-slate-100 p-3 rounded print:bg-transparent print:p-0 print:rounded-none">
                    <span className="print-totals-label font-bold text-slate-900 print:text-[16px]" style={{ color: brandColor }}>Total (incl. GST)</span>
                    <span className="print-totals-value text-lg font-bold text-slate-900 print:text-[16px]" style={{ color: brandColor }}>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="print-totals-row print-total-final bg-slate-100 p-3 rounded print:bg-transparent print:p-0 print:rounded-none print:border-t-2" style={{ borderTopColor: brandColor }}>
                <div className="flex justify-between items-center">
                  <span className="print-totals-label font-bold text-slate-900 print:text-[16px]" style={{ color: brandColor }}>Total Amount</span>
                  <span className="print-totals-value text-lg font-bold text-slate-900 print:text-[16px]" style={{ color: brandColor }}>{formatCurrency(total)}</span>
                </div>
              </div>
            )}
            
            {gstEnabled && (
              <p className="print-gst-note text-right text-xs text-slate-500 mt-1 print:text-[9px] print:text-[#888] print:mt-1">
                GST included in total
              </p>
            )}
            
            {showDepositSection && depositPercent > 0 && (
              <div className="pt-2 space-y-1 print:pt-4">
                <div className="flex justify-between text-sm print:py-1">
                  <span className="text-slate-600 print:text-[#666]">Deposit Required ({depositPercent}%):</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(depositAmount)}</span>
                </div>
                <div className="flex justify-between text-sm print:py-1">
                  <span className="text-slate-600 print:text-[#666]">Balance on completion:</span>
                  <span className="text-slate-900">{formatCurrency(total - depositAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes Section */}
        {notes && (
          <div className="print-notes-section print:mb-6 print:p-4 print:bg-[#fafafa] print:border-l-4 print:rounded-r-md" style={{ borderLeftColor: brandColor }}>
            <h3 className="print-notes-title text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide print:text-[#333] print:text-[11px] print:normal-case print:tracking-normal print:font-semibold">
              Additional Notes
            </h3>
            <p className="print-notes-content text-sm text-slate-700 whitespace-pre-wrap print:text-[10px] print:text-[#666]">{notes}</p>
          </div>
        )}

        {/* Terms Section */}
        {terms && (
          <div className="print-terms-section print:mb-6">
            <h3 className="print-terms-title text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide print:text-[#333] print:text-[11px] print:normal-case print:tracking-normal print:font-semibold">
              Terms & Conditions
            </h3>
            <div className="bg-slate-50 p-3 rounded border border-slate-200 print:bg-transparent print:p-0 print:border-0 print:rounded-none">
              <p className="print-terms-content text-xs text-slate-600 whitespace-pre-wrap print:text-[9px] print:text-[#666] print:leading-[1.6]">{terms}</p>
            </div>
          </div>
        )}

        {/* Quote Signature Area */}
        {type === 'quote' && (
          <div className="print-acceptance-section pt-4 border-t border-slate-200 print:mt-8 print:pt-5 print:border-2 print:border-dashed print:border-[#ddd] print:rounded-lg print:p-5">
            <h3 className="print-acceptance-title font-semibold text-slate-700 mb-4 print:text-[#333] print:mb-4">Quote Acceptance</h3>
            <p className="text-xs text-slate-500 mb-4 print:text-[10px] print:text-[#666] print:mb-5">
              By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
            </p>
            <div className="print-signature-line flex flex-col sm:flex-row gap-6 print:flex print:flex-row print:gap-10 print:mt-5">
              <div className="print-signature-block flex-1">
                <p className="print-signature-label text-xs text-slate-500 mb-8 print:text-[10px] print:text-[#888] print:mb-8">Client Signature</p>
                <div className="print-signature-underline border-b border-slate-300 print:border-b print:border-[#333]"></div>
              </div>
              <div className="print-signature-block flex-1">
                <p className="print-signature-label text-xs text-slate-500 mb-8 print:text-[10px] print:text-[#888] print:mb-8">Print Name</p>
                <div className="print-signature-underline border-b border-slate-300 print:border-b print:border-[#333]"></div>
              </div>
              <div className="print-signature-block flex-1">
                <p className="print-signature-label text-xs text-slate-500 mb-8 print:text-[10px] print:text-[#888] print:mb-8">Date</p>
                <div className="print-signature-underline border-b border-slate-300 print:border-b print:border-[#333]"></div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="print-footer pt-4 border-t border-slate-200 print:mt-8 print:pt-4 print:border-t print:border-[#eee] print:text-center">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 mb-2 print:hidden">
            {business.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                <span>{business.phone}</span>
              </div>
            )}
            {business.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                <span>{business.email}</span>
              </div>
            )}
            {business.address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                <span>{business.address}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 text-center print:text-[9px] print:text-[#999]">
            Thank you for your business!
          </p>
          {business.abn && (
            <p className="text-xs text-slate-400 text-center mt-1 print:text-[9px] print:text-[#999] print:mt-1">
              ABN: {business.abn}
            </p>
          )}
          <p className="text-xs text-slate-400 text-center mt-1 print:text-[9px] print:text-[#999] print:mt-1">
            Generated by TradieTrack • {formatDate(new Date())}
          </p>
        </div>
      </div>
    </div>
  );
}

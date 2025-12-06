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

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden w-full max-w-full border border-slate-200">
      {/* Header - Matches InvoiceDetailView style */}
      <div className="border-b p-4 sm:p-6 bg-slate-50">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 items-start">
          {/* Company Information with Logo */}
          <div className="flex-1 flex items-start gap-3">
            {business.logoUrl ? (
              <img 
                src={business.logoUrl} 
                alt={business.businessName || 'Business Logo'} 
                className="h-12 w-12 sm:h-14 sm:w-14 object-contain rounded-lg border border-slate-200 bg-white p-1 flex-shrink-0"
              />
            ) : (
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-slate-500" />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                {business.businessName || 'Your Business Name'}
              </h1>
              {business.abn && (
                <p className="text-sm text-slate-600 mb-1">
                  <span className="font-medium">ABN:</span> {business.abn}
                </p>
              )}
              <div className="text-sm text-slate-600 space-y-0.5">
                {business.email && (
                  <p className="break-words">{business.email}</p>
                )}
                {business.phone && (
                  <p>{business.phone}</p>
                )}
                {business.address && (
                  <p className="break-words">{business.address}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Document Title & Details */}
          <div className="w-full sm:w-auto sm:text-right">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">
              {type === 'quote' ? 'QUOTE' : (gstEnabled ? 'TAX INVOICE' : 'INVOICE')}
            </h2>
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-medium text-slate-600">{type === 'quote' ? 'Quote' : 'Invoice'} #:</span>
                  <span className="font-mono font-semibold text-slate-900">{documentNumber || 'AUTO'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-medium text-slate-600">Date:</span>
                  <span className="text-slate-900">{formatDate(date || new Date().toISOString())}</span>
                </div>
                {type === 'quote' && validUntil && (
                  <div className="flex justify-between gap-4">
                    <span className="font-medium text-slate-600">Valid Until:</span>
                    <span className="text-slate-900">{formatDate(validUntil)}</span>
                  </div>
                )}
                {type === 'invoice' && dueDate && (
                  <div className="flex justify-between gap-4">
                    <span className="font-medium text-slate-600">Due Date:</span>
                    <span className="font-semibold text-red-600">{formatDate(dueDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="p-4 sm:p-6 space-y-5">
        {/* Description Section */}
        {(title || description) && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">Description</h3>
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <p className="font-medium text-slate-900">{title || `New ${type === 'quote' ? 'Quote' : 'Invoice'}`}</p>
              {description && (
                <p className="text-sm text-slate-600 mt-1">{description}</p>
              )}
            </div>
          </div>
        )}

        {/* Bill To Section */}
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">Bill To:</h3>
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            {client ? (
              <>
                <p className="font-semibold text-slate-900">{client.name}</p>
                <div className="text-sm text-slate-600 space-y-0.5 mt-1">
                  {client.email && <p>{client.email}</p>}
                  {client.phone && <p>{client.phone}</p>}
                  {client.address && <p className="whitespace-pre-line">{client.address}</p>}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 italic">Select a client...</p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">Items & Services</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 rounded-lg overflow-hidden text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="px-3 sm:px-4 py-2 text-left font-semibold text-slate-700">Description</th>
                  <th className="px-3 sm:px-4 py-2 text-center w-12 sm:w-16 font-semibold text-slate-700">Qty</th>
                  <th className="px-3 sm:px-4 py-2 text-right w-20 sm:w-24 font-semibold text-slate-700">Price</th>
                  <th className="px-3 sm:px-4 py-2 text-right w-20 sm:w-24 font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {validLineItems.length > 0 ? (
                  validLineItems.map((item, index) => (
                    <tr key={index} className="border-b border-slate-200">
                      <td className="px-3 sm:px-4 py-3 text-slate-900 break-words">{item.description}</td>
                      <td className="px-3 sm:px-4 py-3 text-center text-slate-700">
                        {safeParseFloat(item.quantity)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right text-slate-700">
                        {formatCurrency(safeParseFloat(item.unitPrice))}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(calculateLineTotal(item))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                      Add line items to see them here...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72">
            {gstEnabled ? (
              <div className="space-y-2">
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-slate-600">GST (10%):</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(gst)}</span>
                </div>
                <div className="border-t border-slate-300 pt-2">
                  <div className="flex justify-between items-center bg-slate-100 p-3 rounded">
                    <span className="font-bold text-slate-900">Total Amount:</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 p-3 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">Total Amount:</span>
                  <span className="text-lg font-bold text-slate-900">{formatCurrency(total)}</span>
                </div>
              </div>
            )}
            
            {showDepositSection && depositPercent > 0 && (
              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Deposit Required ({depositPercent}%):</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(depositAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Balance on completion:</span>
                  <span className="text-slate-900">{formatCurrency(total - depositAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes Section */}
        {notes && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">Notes</h3>
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{notes}</p>
            </div>
          </div>
        )}

        {/* Terms Section */}
        {terms && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">Terms & Conditions</h3>
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{terms}</p>
            </div>
          </div>
        )}

        {/* Quote Signature Area */}
        {type === 'quote' && (
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FileCheck className="h-4 w-4" />
              <span>Signature area for client acceptance</span>
            </div>
          </div>
        )}

        {/* Footer with Icons */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 mb-2">
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
          <p className="text-xs text-slate-500 text-center">
            Thank you for your business
          </p>
        </div>
      </div>
    </div>
  );
}

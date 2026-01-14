import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, ArrowLeft, Send, FileText, CreditCard, Download, Copy, ExternalLink, Loader2, Sparkles, RefreshCw, Share2, Check, Upload, Mail, AlertTriangle, ChevronRight, FolderOpen, DollarSign, Receipt, CalendarClock } from "lucide-react";
import { SiXero } from "react-icons/si";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useIntegrationHealth, isStripeReady } from "@/hooks/use-integration-health";
import { useMarkInvoicePaid, useRecordPayment } from "@/hooks/use-invoices";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { apiRequest, queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "./StatusBadge";
import SendDocumentModal from "./SendDocumentModal";
import { getTemplateStyles, TemplateId, DEFAULT_TEMPLATE } from "@/lib/document-templates";
import DemoPaymentSimulator from "./DemoPaymentSimulator";
import type { BusinessTemplate } from "@shared/schema";

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {};
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

interface InvoiceDetailViewProps {
  invoiceId: string;
  onBack?: () => void;
  onSend?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
}

export default function InvoiceDetailView({ 
  invoiceId, 
  onBack, 
  onSend, 
  onMarkPaid 
}: InvoiceDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showDemoPayment, setShowDemoPayment] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [paymentPlanInstallments, setPaymentPlanInstallments] = useState<number>(3);
  const [paymentPlanFrequency, setPaymentPlanFrequency] = useState<'weekly' | 'fortnightly' | 'monthly'>('fortnightly');
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const { data: businessSettings } = useBusinessSettings();
  const markPaidMutation = useMarkInvoicePaid();
  const recordPaymentMutation = useRecordPayment();
  const { data: integrationHealth } = useIntegrationHealth();
  const stripeConnected = isStripeReady(integrationHealth);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
  });
  const isDemoUser = user?.email === 'demo@tradietrack.com.au';

  const brandColor = businessSettings?.brandColor || '#2563eb';
  const templateId = (businessSettings?.documentTemplate as TemplateId) || DEFAULT_TEMPLATE;
  const templateStyles = getTemplateStyles(templateId, brandColor);
  const { template, primaryColor, headingStyle, tableHeaderStyle, getTableRowStyle, getNoteStyle } = templateStyles;

  const connectEnabled = businessSettings?.connectChargesEnabled === true;

  const { data: invoice, isLoading, refetch: refetchInvoice } = useQuery({
    queryKey: ['/api/invoices', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}?_t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    }
  });

  const { data: client } = useQuery({
    queryKey: ['/api/clients', invoice?.clientId],
    queryFn: async () => {
      if (!invoice?.clientId) return null;
      const response = await fetch(`/api/clients/${invoice.clientId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    },
    enabled: !!invoice?.clientId
  });

  const { data: job } = useQuery({
    queryKey: ['/api/jobs', invoice?.jobId],
    queryFn: async () => {
      if (!invoice?.jobId) return null;
      const response = await fetch(`/api/jobs/${invoice.jobId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!invoice?.jobId
  });

  const { data: linkedQuote } = useQuery({
    queryKey: ['/api/quotes', invoice?.quoteId],
    queryFn: async () => {
      if (!invoice?.quoteId) return null;
      const response = await fetch(`/api/quotes/${invoice.quoteId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch linked quote');
      return response.json();
    },
    enabled: !!invoice?.quoteId
  });

  const { data: quoteSignature } = useQuery({
    queryKey: ['/api/digital-signatures', invoice?.quoteId, 'quote_acceptance'],
    queryFn: async () => {
      if (!invoice?.quoteId) return null;
      const response = await fetch(`/api/digital-signatures?documentType=quote_acceptance&documentId=${invoice.quoteId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) return null;
      const signatures = await response.json();
      return signatures.length > 0 ? signatures[0] : null;
    },
    enabled: !!invoice?.quoteId && businessSettings?.includeSignatureOnInvoices === true
  });

  const { data: termsTemplate } = useQuery<BusinessTemplate>({
    queryKey: ["/api/business-templates/active/terms_conditions"],
    enabled: !!invoice,
  });

  const { data: warrantyTemplate } = useQuery<BusinessTemplate>({
    queryKey: ["/api/business-templates/active/warranty"],
    enabled: !!invoice,
  });

  // Get related receipt for paid invoices
  const { data: relatedReceipt } = useQuery({
    queryKey: ['/api/invoices', invoiceId, 'receipt'],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}/receipt`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: invoice?.status === 'paid'
  });

  // Get existing payment schedule for this invoice
  const { data: paymentSchedule, refetch: refetchPaymentSchedule } = useQuery({
    queryKey: ['/api/payment-schedules', 'invoice', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/payment-schedules/invoice/${invoiceId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch payment schedule');
      return response.json();
    },
    enabled: !!invoice && invoice.status !== 'paid'
  });

  const createPaymentPlanMutation = useMutation({
    mutationFn: async (data: { numberOfInstallments: number; frequency: string }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      return apiRequest('POST', '/api/payment-schedules', {
        invoiceId,
        numberOfInstallments: data.numberOfInstallments,
        frequency: data.frequency,
        startDate: startDate.toISOString(),
      });
    },
    onSuccess: () => {
      refetchPaymentSchedule();
      setShowPaymentPlanDialog(false);
      toast({
        title: "Payment plan created",
        description: `${paymentPlanInstallments} installment payment plan set up successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating payment plan",
        description: error.message || "Failed to create payment plan",
        variant: "destructive",
      });
    }
  });

  const toggleOnlinePaymentMutation = useMutation({
    mutationFn: async (allowOnlinePayment: boolean) => {
      return apiRequest('PATCH', `/api/invoices/${invoiceId}/online-payment`, {
        allowOnlinePayment
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
      toast({
        title: invoice?.allowOnlinePayment ? "Online payment disabled" : "Online payment enabled",
        description: invoice?.allowOnlinePayment 
          ? "Customers can no longer pay online for this invoice."
          : "Customers can now pay this invoice online via card.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update online payment setting",
        variant: "destructive",
      });
    }
  });

  const { data: xeroStatus } = useQuery<{ configured: boolean; connected: boolean }>({
    queryKey: ['/api/integrations/xero/status'],
  });

  const pushToXeroMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/integrations/xero/push-invoice/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
      toast({
        title: "Pushed to Xero",
        description: "Invoice has been synced to Xero successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Push to Xero Failed",
        description: error.message || "Failed to push invoice to Xero",
        variant: "destructive",
      });
    }
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/invoices/${invoiceId}/send-payment-link`);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Payment link sent",
        description: data.message || "Payment link emailed to customer",
      });
    },
    onError: (error: any) => {
      toast({
        title: error.title || "Error sending payment link",
        description: error.message || "Failed to send payment link",
        variant: "destructive",
      });
    }
  });

  const handleCopyPaymentLink = () => {
    if (invoice?.paymentToken) {
      const paymentUrl = `${window.location.origin}/pay/${invoice.paymentToken}`;
      navigator.clipboard.writeText(paymentUrl);
      toast({
        title: "Link copied",
        description: "Payment link copied to clipboard",
      });
    }
  };

  const handleEmailPaymentLink = () => {
    if (!invoice || !client || !businessSettings) return;
    
    const paymentUrl = `${window.location.origin}/pay/${invoice.paymentToken}`;
    const businessName = businessSettings.businessName || 'Your Tradie';
    const invoiceNumber = invoice.number || invoice.id?.substring(0, 8).toUpperCase();
    const formattedTotal = new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
    }).format(parseFloat(invoice.total || '0'));
    
    const subject = encodeURIComponent(`Payment Link for Invoice #${invoiceNumber} from ${businessName}`);
    const body = encodeURIComponent(
`G'day ${client.name},

Here's a quick link to pay your invoice online. It only takes a minute!

Invoice #${invoiceNumber}
Amount: ${formattedTotal}

Pay Online: ${paymentUrl}

Secure payment powered by Stripe.

Cheers,
${businessName}
${businessSettings.phone ? `Phone: ${businessSettings.phone}` : ''}
${businessSettings.email ? `Email: ${businessSettings.email}` : ''}`
    );
    
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email)}&su=${subject}&body=${body}`, '_blank');
    
    toast({
      title: "Gmail opened",
      description: "Review the email and click Send in Gmail",
    });
  };

  // Send receipt email for paid invoice
  const handleSendReceipt = async () => {
    if (!invoice || !client?.email) return;
    
    setSendingReceipt(true);
    try {
      const response = await apiRequest("POST", `/api/invoices/${invoice.id}/send-receipt`, {
        email: client.email
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send receipt');
      }
      toast({
        title: "Receipt sent",
        description: `Receipt emailed to ${client.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send receipt",
        variant: "destructive",
      });
    } finally {
      setSendingReceipt(false);
    }
  };

  // Record payment and mark invoice as paid
  const handleRecordPayment = async () => {
    if (!invoice) return;
    
    try {
      await recordPaymentMutation.mutateAsync({
        invoiceId: invoice.id,
        amount: parseFloat(invoice.total || '0'),
        paymentMethod,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
      });
      const amount = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(invoice.total || '0'));
      const methodLabels: Record<string, string> = {
        cash: 'Cash',
        bank_transfer: 'Bank Transfer',
        cheque: 'Cheque',
        card: 'Card',
        other: 'Other'
      };
      toast({
        title: "Payment recorded",
        description: `${invoice.number} - ${amount} received via ${methodLabels[paymentMethod]}`,
      });
      setShowRecordPaymentDialog(false);
      // Reset form
      setPaymentMethod('cash');
      setPaymentReference('');
      setPaymentNotes('');
      // Refetch invoice to update status
      refetchInvoice();
      // Call legacy callback if provided
      if (onMarkPaid) onMarkPaid(invoice.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    if (!invoice || !businessSettings) {
      toast({ title: "Error", description: "Document not ready to print", variant: "destructive" });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Error", description: "Please allow popups to print", variant: "destructive" });
      return;
    }

    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '<br/>');
    };

    const subtotalVal = (invoice.lineItems || []).reduce((acc: number, item: any) => {
      const itemTotal = Number(item.total) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      return acc + itemTotal;
    }, 0);
    const gstVal = invoice.includesGst ? subtotalVal * 0.10 : 0;
    const totalVal = subtotalVal + gstVal;

    const lineItemsHtml = (invoice.lineItems || []).map((item: any) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const itemTotal = Number(item.total) || (qty * unitPrice);
      return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #1a1a1a;">${item.description || ''}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #666;">${qty.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #666;">$${unitPrice.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #1a1a1a;">$${itemTotal.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const logoHtml = businessSettings.logoUrl ? `<img src="${businessSettings.logoUrl}" alt="Logo" style="max-width: 150px; max-height: 60px; object-fit: contain; margin-bottom: 12px;" />` : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.number || ''}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #1a1a1a;
            background: white;
          }
          .document { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 3px solid ${primaryColor}; }
          .company-name { font-size: 22px; font-weight: 700; color: ${primaryColor}; margin-bottom: 8px; }
          .company-details { color: #666; font-size: 10px; line-height: 1.6; }
          .document-title { font-size: 28px; font-weight: 700; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
          .document-number { color: #666; margin-top: 4px; text-align: right; }
          .info-section { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 40px; }
          .info-block { flex: 1; }
          .info-label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px; }
          .info-value { color: #1a1a1a; line-height: 1.6; }
          .info-value strong { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: ${primaryColor}; color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          th:not(:first-child) { text-align: right; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
          .totals-box { width: 250px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .totals-row.total { border-top: 2px solid ${primaryColor}; border-bottom: none; padding-top: 12px; margin-top: 8px; }
          .totals-row.total span { font-size: 14px; font-weight: 700; color: ${primaryColor}; }
          .notes { background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
          .notes-title { font-weight: 600; margin-bottom: 8px; color: #1a1a1a; }
          .payment-box { background: linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05); border: 1px solid ${primaryColor}30; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
          .payment-title { font-weight: 600; margin-bottom: 8px; color: ${primaryColor}; font-size: 12px; }
          .terms { border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; }
          .terms-title { font-weight: 600; margin-bottom: 8px; color: ${primaryColor}; font-size: 12px; }
          .terms-content { color: #666; font-size: 10px; line-height: 1.6; white-space: pre-wrap; }
          @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <div class="header">
            <div>
              ${logoHtml}
              <div class="company-name">${businessSettings.businessName || 'Your Business'}</div>
              <div class="company-details">
                ${businessSettings.abn ? `<div>ABN: ${businessSettings.abn}</div>` : ''}
                ${businessSettings.address ? `<div>${businessSettings.address}</div>` : ''}
                ${businessSettings.phone ? `<div>Phone: ${businessSettings.phone}</div>` : ''}
                ${businessSettings.email ? `<div>Email: ${businessSettings.email}</div>` : ''}
                ${businessSettings.licenseNumber ? `<div>Licence: ${businessSettings.licenseNumber}</div>` : ''}
              </div>
            </div>
            <div>
              <div class="document-title">${invoice.status === 'paid' ? 'TAX INVOICE' : 'INVOICE'}</div>
              <div class="document-number">${invoice.number || ''}</div>
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-block">
              <div class="info-label">Bill To</div>
              <div class="info-value">
                <strong>${client?.name || ''}</strong><br/>
                ${client?.address || ''}<br/>
                ${client?.email || ''}<br/>
                ${client?.phone || ''}
              </div>
            </div>
            <div class="info-block">
              <div class="info-label">Invoice Details</div>
              <div class="info-value">
                <strong>Date:</strong> ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-AU') : ''}<br/>
                ${invoice.dueDate ? `<strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-AU')}` : ''}
              </div>
            </div>
          </div>

          ${invoice.title || invoice.description ? `
            <div class="notes">
              <div class="notes-title">${invoice.title || 'Description'}</div>
              <div>${invoice.description || ''}</div>
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th style="width: 50%">Description</th>
                <th style="width: 15%">Qty</th>
                <th style="width: 17%">Unit Price</th>
                <th style="width: 18%">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-box">
              <div class="totals-row">
                <span>Subtotal</span>
                <span>$${subtotalVal.toFixed(2)}</span>
              </div>
              ${gstVal > 0 ? `
                <div class="totals-row">
                  <span>GST (10%)</span>
                  <span>$${gstVal.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="totals-row total">
                <span>Total${gstVal > 0 ? ' (incl. GST)' : ''}</span>
                <span>$${totalVal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          ${businessSettings.paymentInstructions ? `
            <div class="payment-box">
              <div class="payment-title">Payment Details</div>
              <div style="color: #666; font-size: 11px; line-height: 1.6;">${escapeHtml(businessSettings.paymentInstructions)}</div>
            </div>
          ` : ''}

          ${invoice.notes ? `
            <div class="notes">
              <div class="notes-title">Additional Notes</div>
              <div style="color: #666;">${escapeHtml(invoice.notes)}</div>
            </div>
          ` : ''}

          ${termsTemplate?.content ? `
            <div class="terms">
              <div class="terms-title">Terms & Conditions</div>
              <div class="terms-content">${escapeHtml(termsTemplate.content)}</div>
            </div>
          ` : ''}

          ${warrantyTemplate?.content ? `
            <div class="terms">
              <div class="terms-title">Warranty Information</div>
              <div class="terms-content">${escapeHtml(warrantyTemplate.content)}</div>
            </div>
          ` : ''}
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    
    // Add a delay to ensure styles and content are fully loaded before printing
    setTimeout(() => {
      if (printWindow) {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.onafterprint = function() { printWindow.close(); };
        }, 100);
      }
    }, 800);
  };

  // Feature detection: check if download attribute is supported
  const supportsDownloadAttribute = () => {
    return 'download' in document.createElement('a');
  };

  // Detect iOS Safari specifically (needs special handling for blob downloads)
  const isIOSSafari = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isWebKit = /WebKit/.test(ua);
    const isChrome = /CriOS/.test(ua); // Chrome on iOS
    const isFirefox = /FxiOS/.test(ua); // Firefox on iOS
    return isIOS && isWebKit && !isChrome && !isFirefox;
  };

  const handleSaveAsPDF = async () => {
    setIsPrinting(true);
    
    const pdfUrl = `/api/invoices/${invoiceId}/pdf`;
    const filename = `Invoice-${invoice?.number || invoice?.id || invoiceId}.pdf`;
    
    // For iOS Safari: open window SYNCHRONOUSLY before any async operations
    // This prevents Safari from blocking it as a popup
    let pdfWindow: Window | null = null;
    if (isIOSSafari()) {
      pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write('<html><head><title>Generating PDF...</title></head><body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;"><p>Generating PDF, please wait...</p></body></html>');
      }
    }
    
    try {
      const response = await fetch(pdfUrl, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      if (isIOSSafari() && pdfWindow) {
        // iOS Safari: convert blob to data URL and write to already-open window
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          pdfWindow!.document.write(`<html><head><title>${filename}</title></head><body style="margin:0;"><embed width="100%" height="100%" src="${dataUrl}" type="application/pdf" /></body></html>`);
          pdfWindow!.document.close();
        };
        reader.readAsDataURL(blob);
        window.URL.revokeObjectURL(url);
        toast({
          title: "PDF Opened",
          description: "PDF opened in new tab.",
        });
      } else if (supportsDownloadAttribute()) {
        // Desktop and most modern mobile browsers: use anchor click with download attribute
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
        toast({
          title: "PDF Downloaded",
          description: "Invoice PDF has been downloaded successfully.",
        });
      } else {
        // Fallback for browsers without download attribute support
        window.location.href = url;
        toast({
          title: "PDF Ready",
          description: "PDF opened. Use your browser's save option to download.",
        });
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (pdfWindow) {
        pdfWindow.close();
      }
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    // Use the public payment URL with the payment token - NOT the dashboard URL
    const publicUrl = invoice?.stripePaymentLink 
      || (invoice?.paymentToken ? `${window.location.origin}/pay/${invoice.paymentToken}` : null);
    
    if (!publicUrl) {
      toast({
        title: "Cannot Share",
        description: "No payment link available. Try sending the invoice first.",
        variant: "destructive",
      });
      return;
    }
    
    const shareData = {
      title: `Invoice ${invoice?.number || invoiceId}`,
      text: `Invoice for ${invoice?.title || 'work'} - ${formatCurrency(Number(invoice?.total || 0))}`,
      url: publicUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast({
          title: "Shared",
          description: "Invoice link shared successfully.",
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink(publicUrl);
        }
      }
    } else {
      handleCopyLink(publicUrl);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link Copied",
        description: "Invoice payment link copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Generate the public invoice payment URL
  const getPublicPaymentUrl = () => {
    return invoice?.paymentToken 
      ? `${window.location.origin}/pay/${invoice.paymentToken}`
      : undefined;
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  const subtotal = Number(invoice.subtotal || 0);
  const gstAmount = Number(invoice.gstAmount || 0);
  const total = Number(invoice.total || 0);
  const isGstRegistered = businessSettings?.gstEnabled && gstAmount > 0;
  const documentTitle = isGstRegistered ? 'TAX INVOICE' : 'INVOICE';

  return (
    <>
      <style>{`
        @media print {
          * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            height: auto !important;
            overflow: visible !important;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Logical breadcrumb navigation */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 no-print">
          <button 
            onClick={() => navigate('/documents?tab=invoices')} 
            className="hover:text-foreground transition-colors flex items-center gap-1"
            data-testid="breadcrumb-documents"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Documents
          </button>
          {linkedQuote && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <button 
                onClick={() => navigate(`/quotes/${linkedQuote.id}`)} 
                className="hover:text-foreground transition-colors"
                data-testid="breadcrumb-quote"
              >
                Quote {linkedQuote.number}
              </button>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{invoice.number || `INV-${invoice.id?.substring(0,8).toUpperCase()}`}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack || (() => navigate('/documents?tab=invoices'))} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl sm:text-2xl font-bold">Invoice Details</h1>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Primary action - Send Invoice via Email with PDF */}
            {(invoice.status === 'draft' || invoice.status === 'sent') && client?.email && (
              <Button onClick={() => setShowEmailCompose(true)} className="w-full sm:w-auto" data-testid="button-send-email">
                <Mail className="h-4 w-4 mr-2" />
                {invoice.status === 'draft' ? 'Send Invoice' : 'Resend'}
              </Button>
            )}
            {/* Legacy onSend prop support */}
            {invoice.status === 'draft' && onSend && !client?.email && (
              <Button onClick={() => onSend(invoice.id)} className="w-full sm:w-auto" data-testid={`button-send-${invoice.id}`}>
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
              <Button onClick={() => setShowRecordPaymentDialog(true)} className="w-full sm:w-auto" data-testid="button-record-payment">
                <DollarSign className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            )}
            {invoice.status === 'paid' && client?.email && (
              <Button onClick={handleSendReceipt} disabled={sendingReceipt} className="w-full sm:w-auto" data-testid="button-send-receipt">
                {sendingReceipt ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                Send Receipt
              </Button>
            )}
            {xeroStatus?.connected && invoice.status === 'sent' && !invoice.xeroInvoiceId && (
              <Button 
                variant="outline" 
                onClick={() => pushToXeroMutation.mutate()}
                disabled={pushToXeroMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="button-push-to-xero"
              >
                {pushToXeroMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <SiXero className="h-4 w-4 mr-2" />
                )}
                Push to Xero
              </Button>
            )}
            <Button variant="outline" onClick={handlePrint} className="w-full sm:w-auto" data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleSaveAsPDF} className="w-full sm:w-auto" data-testid="button-save-pdf">
              <Download className="h-4 w-4 mr-2" />
              Save as PDF
            </Button>
            <Button variant="outline" onClick={handleShare} className="w-full sm:w-auto" data-testid="button-share">
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Share'}
            </Button>
          </div>
        </div>

        {connectEnabled && invoice.status !== 'paid' && (
          <Card className="mb-6 no-print">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">Online Payment</h3>
                    <p className="text-sm text-muted-foreground">
                      Allow customers to pay this invoice online via card
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={invoice.allowOnlinePayment || false}
                    onCheckedChange={(checked) => toggleOnlinePaymentMutation.mutate(checked)}
                    disabled={toggleOnlinePaymentMutation.isPending || !stripeConnected}
                    data-testid="switch-online-payment"
                  />
                  {toggleOnlinePaymentMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </div>

              {!stripeConnected && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-md mt-4" data-testid="info-manual-payments">
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                        Collect payment directly - no processing fees!
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Accept cash, bank transfer, or EFTPOS and use "Record Payment" to mark this invoice as paid.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button 
                          size="sm"
                          onClick={() => setShowRecordPaymentDialog(true)}
                          data-testid="button-quick-record-payment"
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                          Record Payment
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate("/integrations")}
                          data-testid="button-setup-stripe-optional"
                        >
                          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                          Setup Online Payments (Optional)
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {stripeConnected && invoice.allowOnlinePayment && invoice.paymentToken && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Label className="text-sm font-medium">Payment Link:</Label>
                      <div className="flex-1 flex items-center gap-2">
                        <code className="text-xs bg-background p-2 rounded flex-1 overflow-x-auto">
                          {`${window.location.origin}/pay/${invoice.paymentToken}`}
                        </code>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={handleCopyPaymentLink}
                          data-testid="button-copy-payment-link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => window.open(`/pay/${invoice.paymentToken}`, '_blank')}
                          data-testid="button-open-payment-link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <p className="text-sm text-muted-foreground">
                        Send this link to your customer so they can pay online
                      </p>
                      <Button
                        size="sm"
                        onClick={handleEmailPaymentLink}
                        disabled={!client?.email}
                        data-testid="button-send-payment-link"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email to Customer
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {!connectEnabled && invoice.status !== 'paid' && (
          <Card className="mb-6 no-print border-dashed">
            <div className="p-4">
              <div className="flex items-center gap-4">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <h3 className="font-semibold text-muted-foreground">Online Payment</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account in Settings to enable online payments for invoices.
                  </p>
                </div>
                {isDemoUser && (
                  <Button
                    variant="outline"
                    onClick={() => setShowDemoPayment(true)}
                    className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30"
                    data-testid="button-simulate-payment"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Simulate Payment
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {invoice.status !== 'paid' && (
          <Card className="mb-6 no-print">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <CalendarClock className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold">Payment Plan</h3>
                  {paymentSchedule ? (
                    <p className="text-sm text-muted-foreground">
                      {paymentSchedule.numberOfInstallments}-installment plan ({paymentSchedule.frequency})
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Offer flexible payment options to your customer
                    </p>
                  )}
                </div>
                {!paymentSchedule && (
                  <Button
                    onClick={() => setShowPaymentPlanDialog(true)}
                    data-testid="button-setup-payment-plan"
                  >
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Set Up Payment Plan
                  </Button>
                )}
              </div>

              {paymentSchedule && paymentSchedule.installments && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="space-y-2">
                    {paymentSchedule.installments.map((installment: any) => (
                      <div 
                        key={installment.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            #{installment.installmentNumber}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(installment.dueDate).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">
                            ${Number(installment.amount).toFixed(2)}
                          </span>
                          <Badge 
                            variant={
                              installment.status === 'paid' ? 'default' :
                              installment.status === 'overdue' ? 'destructive' :
                              installment.status === 'due' ? 'secondary' :
                              'outline'
                            }
                            className="text-xs"
                          >
                            {installment.status === 'paid' ? 'Paid' :
                             installment.status === 'overdue' ? 'Overdue' :
                             installment.status === 'due' ? 'Due' :
                             'Pending'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {paymentSchedule.installments.filter((i: any) => i.status === 'paid').length} of {paymentSchedule.numberOfInstallments} paid
                    </span>
                    <span className="font-semibold">
                      Total: ${Number(paymentSchedule.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <Dialog open={showPaymentPlanDialog} onOpenChange={setShowPaymentPlanDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set Up Payment Plan</DialogTitle>
              <DialogDescription>
                Create an installment plan for invoice {invoice?.number}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Number of Installments</Label>
                <Select
                  value={paymentPlanInstallments.toString()}
                  onValueChange={(val) => setPaymentPlanInstallments(Number(val))}
                >
                  <SelectTrigger data-testid="select-installments">
                    <SelectValue placeholder="Select installments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 installments</SelectItem>
                    <SelectItem value="3">3 installments</SelectItem>
                    <SelectItem value="4">4 installments</SelectItem>
                    <SelectItem value="6">6 installments</SelectItem>
                    <SelectItem value="12">12 installments</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Frequency</Label>
                <Select
                  value={paymentPlanFrequency}
                  onValueChange={(val: 'weekly' | 'fortnightly' | 'monthly') => setPaymentPlanFrequency(val)}
                >
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {invoice?.total && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="text-sm font-semibold mb-3">Payment Preview</h4>
                  <div className="space-y-2">
                    {Array.from({ length: paymentPlanInstallments }).map((_, index) => {
                      const installmentAmount = Number(invoice.total) / paymentPlanInstallments;
                      const isLast = index === paymentPlanInstallments - 1;
                      const amount = isLast 
                        ? Number(invoice.total) - (Math.floor(installmentAmount * 100) / 100 * (paymentPlanInstallments - 1))
                        : Math.floor(installmentAmount * 100) / 100;
                      
                      const startDate = new Date();
                      startDate.setDate(startDate.getDate() + 7);
                      const dueDate = new Date(startDate);
                      if (paymentPlanFrequency === 'weekly') {
                        dueDate.setDate(dueDate.getDate() + (7 * index));
                      } else if (paymentPlanFrequency === 'fortnightly') {
                        dueDate.setDate(dueDate.getDate() + (14 * index));
                      } else {
                        dueDate.setMonth(dueDate.getMonth() + index);
                      }

                      return (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            #{index + 1} - {dueDate.toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="font-medium">${amount.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold">${Number(invoice.total).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowPaymentPlanDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createPaymentPlanMutation.mutate({
                  numberOfInstallments: paymentPlanInstallments,
                  frequency: paymentPlanFrequency
                })}
                disabled={createPaymentPlanMutation.isPending}
                data-testid="button-create-payment-plan"
              >
                {createPaymentPlanMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Payment Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {isDemoUser && (
          <DemoPaymentSimulator
            invoiceId={invoiceId}
            invoiceNumber={invoice?.number || 'INV-001'}
            invoiceTotal={invoice?.total || '0'}
            clientName={client?.name || 'Client'}
            isOpen={showDemoPayment}
            onClose={() => setShowDemoPayment(false)}
            onPaymentComplete={async () => {
              // Force refetch the specific invoice to update UI immediately
              await refetchInvoice();
              // Also invalidate the list for other views
              queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
            }}
          />
        )}

        <div className="print-content">
          <Card 
            className="bg-white shadow-lg border overflow-hidden"
            style={{ fontFamily: template.fontFamily, fontSize: template.baseFontSize, fontWeight: template.bodyWeight }}
          >
            <div 
              className="p-6 sm:p-8"
              style={{ borderBottom: template.showHeaderDivider ? `${template.headerBorderWidth} solid ${primaryColor}` : 'none' }}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between gap-6 items-start">
                <div className="flex-1">
                  {businessSettings?.logoUrl && (
                    <img 
                      src={businessSettings.logoUrl} 
                      alt={businessSettings?.businessName || 'Logo'} 
                      className="max-w-[150px] max-h-[60px] object-contain mb-3"
                    />
                  )}
                  <h1 
                    className="text-2xl sm:text-3xl mb-2"
                    style={{ ...headingStyle }}
                  >
                    {businessSettings?.businessName || 'Your Business Name'}
                  </h1>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    {businessSettings?.abn && (
                      <p><strong>ABN:</strong> {businessSettings.abn}</p>
                    )}
                    {businessSettings?.address && <p>{businessSettings.address}</p>}
                    {businessSettings?.phone && <p>Phone: {businessSettings.phone}</p>}
                    {businessSettings?.email && <p>Email: {businessSettings.email}</p>}
                    {businessSettings?.licenseNumber && (
                      <p>Licence No: {businessSettings.licenseNumber}</p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <h2 
                    className="text-2xl sm:text-3xl uppercase tracking-wide"
                    style={{ ...headingStyle }}
                  >
                    {documentTitle}
                  </h2>
                  <p className="text-gray-600 mt-1">{invoice.number}</p>
                  <div className="mt-2">
                    <StatusBadge status={invoice.status} />
                  </div>
                  {/* Xero sync status */}
                  {invoice.xeroInvoiceId && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Xero Synced
                      </Badge>
                      {invoice.xeroSyncedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(invoice.xeroSyncedAt).toLocaleDateString('en-AU')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-8 mb-8">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Bill To</p>
                  <div className="text-gray-800">
                    <p className="font-semibold">{client?.name || 'Loading...'}</p>
                    {client?.address && <p>{client.address}</p>}
                    {client?.email && <p>{client.email}</p>}
                    {client?.phone && <p>{client.phone}</p>}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Invoice Details</p>
                  <div className="text-gray-800 space-y-1">
                    <p><strong>Date:</strong> {formatDate(invoice.createdAt)}</p>
                    {invoice.dueDate && (
                      <p><strong>Due Date:</strong> {formatDate(invoice.dueDate)}</p>
                    )}
                  </div>
                </div>
              </div>

              {job?.address && (
                <div className="mb-8">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Job Site Location</p>
                  <div className="text-gray-800">
                    <p className="font-semibold">{job.address}</p>
                    {job.scheduledAt && (
                      <p className="text-gray-600 text-sm">Scheduled: {formatDate(job.scheduledAt)}</p>
                    )}
                  </div>
                </div>
              )}

              {(invoice.title || invoice.description) && (
                <div 
                  className="mb-8 p-4"
                  style={{ backgroundColor: template.sectionBackground, borderRadius: template.borderRadius }}
                >
                  <p 
                    className="font-semibold mb-2"
                    style={{ color: primaryColor }}
                  >
                    {invoice.title || 'Description'}
                  </p>
                  {invoice.description && (
                    <p className="text-gray-700">{invoice.description}</p>
                  )}
                </div>
              )}

              <div className="mb-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={tableHeaderStyle}>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider" style={{ width: '50%', color: tableHeaderStyle.color }}>Description</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '15%', color: tableHeaderStyle.color }}>Qty</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '17%', color: tableHeaderStyle.color }}>Unit Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '18%', color: tableHeaderStyle.color }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems?.map((item: any, index: number) => {
                      const isLast = index === (invoice.lineItems?.length || 0) - 1;
                      return (
                        <tr key={index} style={getTableRowStyle(index, isLast)}>
                          <td className="px-4 py-3 text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{Number(item.quantity).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(Number(item.unitPrice))}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(Number(item.total))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-8">
                <div className="w-72">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">{formatCurrency(subtotal)}</span>
                  </div>
                  {gstAmount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">GST (10%)</span>
                      <span className="font-semibold">{formatCurrency(gstAmount)}</span>
                    </div>
                  )}
                  <div 
                    className="flex justify-between py-3 mt-1"
                    style={{ borderTop: `2px solid ${primaryColor}` }}
                  >
                    <span 
                      className="text-lg"
                      style={{ ...headingStyle }}
                    >
                      Total{gstAmount > 0 ? ' (incl. GST)' : ''}
                    </span>
                    <span 
                      className="text-lg"
                      style={{ ...headingStyle }}
                    >
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bank Transfer Details - show when bank details are configured */}
              {(businessSettings?.bankBsb || businessSettings?.bankAccountNumber || businessSettings?.bankAccountName) && (
                <div 
                  className="mb-8 p-5 rounded-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
                    border: `1px solid ${primaryColor}30`
                  }}
                  data-testid="bank-transfer-details"
                >
                  <h3 
                    className="font-semibold mb-3 text-sm"
                    style={{ color: primaryColor }}
                  >
                    Bank Transfer Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {businessSettings.bankAccountName && (
                      <div>
                        <span className="text-gray-500 text-xs">Account Name</span>
                        <div className="font-medium text-gray-900" data-testid="bank-account-name">
                          {businessSettings.bankAccountName}
                        </div>
                      </div>
                    )}
                    {businessSettings.bankBsb && (
                      <div>
                        <span className="text-gray-500 text-xs">BSB</span>
                        <div className="font-medium text-gray-900 font-mono" data-testid="bank-bsb">
                          {businessSettings.bankBsb}
                        </div>
                      </div>
                    )}
                    {businessSettings.bankAccountNumber && (
                      <div>
                        <span className="text-gray-500 text-xs">Account Number</span>
                        <div className="font-medium text-gray-900 font-mono" data-testid="bank-account-number">
                          {businessSettings.bankAccountNumber}
                        </div>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <span className="text-gray-500 text-xs">Reference</span>
                      <div className="font-medium text-gray-900" data-testid="bank-reference">
                        {invoice.number || `INV-${invoice.id?.substring(0,8).toUpperCase()}`}
                      </div>
                    </div>
                  </div>
                  {businessSettings.paymentInstructions && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-gray-600 text-xs whitespace-pre-wrap">
                        {businessSettings.paymentInstructions}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Instructions only - when no bank details but has instructions */}
              {!businessSettings?.bankBsb && !businessSettings?.bankAccountNumber && !businessSettings?.bankAccountName && businessSettings?.paymentInstructions && (
                <div 
                  className="mb-8 p-5 rounded-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
                    border: `1px solid ${primaryColor}30`
                  }}
                >
                  <h3 
                    className="font-semibold mb-3 text-sm"
                    style={{ color: primaryColor }}
                  >
                    Payment Details
                  </h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                    {businessSettings.paymentInstructions}
                  </p>
                </div>
              )}

              {invoice.notes && (
                <div 
                  className="mb-8 p-4"
                  style={getNoteStyle()}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Additional Notes</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              {invoice.status === 'sent' && invoice.dueDate && (
                <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">
                    <strong>Payment Due:</strong> This invoice is due on {formatDate(invoice.dueDate)}
                  </p>
                </div>
              )}

              {invoice.status === 'paid' && (
                <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg" data-testid="payment-details-paid">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <h3 className="text-sm font-semibold text-green-800">Payment Received</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-green-700">Amount</span>
                      <div className="font-semibold text-green-900">
                        {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(invoice.total || '0'))}
                      </div>
                    </div>
                    {invoice.paidAt && (
                      <div>
                        <span className="text-green-700">Date & Time</span>
                        <div className="font-medium text-green-900">
                          {new Date(invoice.paidAt).toLocaleDateString('en-AU', { 
                            weekday: 'short', 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric' 
                          })} at {new Date(invoice.paidAt).toLocaleTimeString('en-AU', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    )}
                    {invoice.paymentMethod && (
                      <div>
                        <span className="text-green-700">Method</span>
                        <div className="font-medium text-green-900 capitalize">
                          {invoice.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 
                           invoice.paymentMethod === 'stripe' ? 'Online (Stripe)' :
                           invoice.paymentMethod === 'tap_to_pay' ? 'Tap to Pay' :
                           invoice.paymentMethod}
                        </div>
                      </div>
                    )}
                    {invoice.paymentReference && (
                      <div>
                        <span className="text-green-700">Reference</span>
                        <div className="font-medium text-green-900">{invoice.paymentReference}</div>
                      </div>
                    )}
                  </div>
                  {relatedReceipt && (
                    <div className="mt-4 pt-3 border-t border-green-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/receipts/${relatedReceipt.id}`)}
                        data-testid="link-invoice-receipt"
                      >
                        <Receipt className="h-4 w-4 mr-2" />
                        View Receipt ({relatedReceipt.number})
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {businessSettings?.includeSignatureOnInvoices && quoteSignature && (
                <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold mb-3 text-gray-800 text-sm">Quote Acceptance Signature</h3>
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex-shrink-0">
                      <img 
                        src={quoteSignature.signatureData} 
                        alt="Client Signature" 
                        className="max-w-[200px] max-h-[80px] object-contain border-b border-gray-300"
                      />
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {quoteSignature.signerName && (
                        <p><strong>Signed by:</strong> {quoteSignature.signerName}</p>
                      )}
                      {quoteSignature.signedAt && (
                        <p><strong>Date:</strong> {formatDate(quoteSignature.signedAt)}</p>
                      )}
                      {linkedQuote?.number && (
                        <p><strong>Quote:</strong> {linkedQuote.number}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Terms & Warranty Section - Full content with compact styling */}
              {termsTemplate?.content && (
                <div className="mb-4 pt-3 border-t border-gray-100">
                  <h4 className="font-medium text-gray-500 text-[10px] uppercase tracking-wide mb-2">Terms & Conditions</h4>
                  <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap">{termsTemplate.content}</p>
                </div>
              )}

              {(warrantyTemplate?.content || businessSettings?.warrantyPeriod) && (
                <div className="mb-4 pt-3 border-t border-gray-100">
                  <h4 className="font-medium text-gray-500 text-[10px] uppercase tracking-wide mb-2">Warranty</h4>
                  <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap">
                    {warrantyTemplate?.content || `All work is guaranteed for ${businessSettings?.warrantyPeriod} from completion date.`}
                  </p>
                </div>
              )}

              <div className="mt-10 pt-5 border-t border-gray-200 text-center text-gray-500 text-sm">
                <p>Thank you for your business!</p>
                {businessSettings?.abn && (
                  <p className="mt-1">ABN: {businessSettings.abn}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Record Payment Confirmation Dialog */}
      {invoice && (
        <Dialog open={showRecordPaymentDialog} onOpenChange={(open) => {
          setShowRecordPaymentDialog(open);
          if (!open) {
            setPaymentMethod('cash');
            setPaymentReference('');
            setPaymentNotes('');
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                Record Payment
              </DialogTitle>
              <DialogDescription>
                Record a payment received in person - no processing fees!
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <div>
                  <div className="text-sm text-muted-foreground">Invoice {invoice.number}</div>
                  <div className="font-medium">{client?.name || 'Unknown'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold" style={{ color: 'hsl(var(--trade))' }}>
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(invoice.total || '0'))}
                  </div>
                  <Badge variant="secondary" className="text-xs mt-1">
                    You keep 100%
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment-method" className="text-sm font-medium">Payment Method</Label>
                  <Select 
                    value={paymentMethod} 
                    onValueChange={(value: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other') => setPaymentMethod(value)}
                  >
                    <SelectTrigger id="payment-method" className="mt-1" data-testid="select-payment-method">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="card">Card (EFTPOS/Credit)</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="payment-reference" className="text-sm font-medium">Reference (optional)</Label>
                  <Input 
                    id="payment-reference"
                    placeholder="e.g. Receipt #, Transfer ref"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="mt-1"
                    data-testid="input-payment-reference"
                  />
                </div>
                
                <div>
                  <Label htmlFor="payment-notes" className="text-sm font-medium">Notes (optional)</Label>
                  <Textarea 
                    id="payment-notes"
                    placeholder="Any additional payment notes..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="mt-1 resize-none"
                    rows={2}
                    data-testid="input-payment-notes"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowRecordPaymentDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRecordPayment} 
                disabled={recordPaymentMutation.isPending}
                data-testid="button-confirm-payment"
              >
                {recordPaymentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Send Document Modal with email/SMS support */}
      {invoice && client && (
        <SendDocumentModal
          isOpen={showEmailCompose}
          onClose={() => setShowEmailCompose(false)}
          type="invoice"
          documentId={invoiceId}
          clientName={client.name || ''}
          clientEmail={client.email || ''}
          clientPhone={client?.phone}
          documentNumber={invoice.number || invoice.id.slice(0, 8)}
          documentTitle={invoice.title || 'Invoice'}
          total={invoice.total || '0'}
          businessName={businessSettings?.businessName}
          publicUrl={getPublicPaymentUrl()}
        />
      )}
    </>
  );
}
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft,
  FileText,
  ExternalLink,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  Paperclip,
  X,
  Copy,
  Check,
  User,
  Phone,
  Calendar,
  ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { ActivityLog } from "@shared/schema";

interface CommunicationItem {
  id: string;
  type: 'email' | 'sms';
  direction: 'outbound' | 'inbound';
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  recipient: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  body: string;
  fullBody?: string;
  timestamp: Date;
  entityType?: string;
  entityId?: string;
  entityNumber?: string;
  hasAttachment?: boolean;
  attachmentType?: string;
  metadata?: Record<string, any>;
  deliveryInfo?: {
    sentAt?: string;
    deliveredAt?: string;
    provider?: string;
    messageId?: string;
  };
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'delivered':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'sent':
      return <Send className="h-4 w-4 text-blue-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-500" />;
    default:
      return <Send className="h-4 w-4 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    sent: { label: 'Sent', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  };
  const variant = variants[status] || variants.pending;
  return <Badge className={variant.className}>{variant.label}</Badge>;
}

function TypeIcon({ type }: { type: 'email' | 'sms' }) {
  return type === 'email' 
    ? <Mail className="h-4 w-4" /> 
    : <MessageSquare className="h-4 w-4" />;
}

function CommunicationCard({ 
  item, 
  onViewEntity, 
  onViewDetails 
}: { 
  item: CommunicationItem; 
  onViewEntity?: (type: string, id: string) => void;
  onViewDetails?: (item: CommunicationItem) => void;
}) {
  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all"
      onClick={() => onViewDetails?.(item)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${item.type === 'email' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
              <TypeIcon type={item.type} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{item.recipient}</span>
                {item.recipientPhone && (
                  <span className="text-xs text-muted-foreground">{item.recipientPhone}</span>
                )}
                {item.hasAttachment && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Paperclip className="h-3 w-3" />
                    PDF
                  </Badge>
                )}
              </div>
              
              {item.subject && (
                <p className="text-sm font-medium mt-1 truncate">{item.subject}</p>
              )}
              
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.body}</p>
              
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(item.timestamp), "d MMM yyyy, h:mm a")}
                </span>
                
                {item.entityType && item.entityId && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewEntity?.(item.entityType!, item.entityId!);
                    }}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    data-testid={`link-view-${item.entityType}-${item.entityId}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    View {item.entityType} {item.entityNumber ? `#${item.entityNumber}` : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={item.status} />
            <Badge variant="outline" className="text-xs">
              {item.type === 'email' ? 'Email' : 'SMS'}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(item);
              }}
              data-testid={`button-view-${item.id}`}
            >
              <Eye className="h-3 w-3" />
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommunicationDetailSheet({ 
  item, 
  open, 
  onClose,
  onViewEntity 
}: { 
  item: CommunicationItem | null; 
  open: boolean; 
  onClose: () => void;
  onViewEntity?: (type: string, id: string) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const copyContent = async () => {
    if (!item) return;
    const content = item.fullBody || item.body;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Message content copied successfully",
    });
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (!item) return null;
  
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg w-full">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.type === 'email' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
              <TypeIcon type={item.type} />
            </div>
            <div className="flex-1">
              <SheetTitle className="flex items-center gap-2">
                {item.type === 'email' ? 'Email' : 'SMS'} Details
                <StatusBadge status={item.status} />
              </SheetTitle>
              <SheetDescription>
                Sent {format(new Date(item.timestamp), "EEEE, d MMMM yyyy 'at' h:mm a")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="space-y-4 pr-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Recipient
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.recipient}</span>
                </div>
                {item.recipientEmail && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {item.recipientEmail}
                  </div>
                )}
                {item.recipientPhone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {item.recipientPhone}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <StatusIcon status={item.status} />
                  Delivery Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      item.status === 'delivered' ? 'bg-green-500' : 
                      item.status === 'sent' ? 'bg-blue-500' :
                      item.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <span className="text-sm font-medium capitalize">{item.status}</span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sent at</span>
                    <span>{format(new Date(item.timestamp), "h:mm:ss a")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span>{item.type === 'email' ? 'SendGrid' : 'Twilio'}</span>
                  </div>
                  {item.hasAttachment && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Attachment</span>
                      <Badge variant="outline" className="gap-1">
                        <Paperclip className="h-3 w-3" />
                        PDF Document
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="bg-muted/50 rounded-lg p-3 mt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>Message accepted by {item.type === 'email' ? 'SendGrid' : 'Twilio'} for delivery</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {item.entityType && item.entityId && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Related Document
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between"
                    onClick={() => onViewEntity?.(item.entityType!, item.entityId!)}
                    data-testid="button-view-document"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      View {item.entityType} {item.entityNumber ? `#${item.entityNumber}` : ''}
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Message Content
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 gap-1"
                    onClick={copyContent}
                    data-testid="button-copy-content"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {item.subject && (
                  <>
                    <div className="mb-3">
                      <span className="text-xs text-muted-foreground">Subject</span>
                      <p className="font-medium">{item.subject}</p>
                    </div>
                    <Separator className="mb-3" />
                  </>
                )}
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-sm whitespace-pre-wrap">{item.fullBody || item.body}</p>
                  </div>
                </div>
                
                {item.hasAttachment && (
                  <div className="mt-3 flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.attachmentType || 'Document'}.pdf</p>
                      <p className="text-xs text-muted-foreground">PDF attachment sent with this message</p>
                    </div>
                    <Badge variant="secondary">Attached</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Proof of Sending</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This message was sent via {item.type === 'email' ? 'SendGrid' : 'Twilio'} on{' '}
                      {format(new Date(item.timestamp), "d MMM yyyy 'at' h:mm:ss a")}.
                      The message was accepted by the provider for delivery to the recipient.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="font-mono">
                        ID: {item.id.split('-').slice(1, 3).join('-')}
                      </Badge>
                      <Badge variant="outline">
                        {format(new Date(item.timestamp), "yyyy-MM-dd'T'HH:mm:ss")}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function CommunicationsHub() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<CommunicationItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  const { data: smsConversations = [], isLoading: smsLoading, refetch: refetchSms } = useQuery<any[]>({
    queryKey: ['/api/sms/conversations'],
  });
  
  const { data: activityLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity/recent/100'],
  });
  
  const isLoading = smsLoading || logsLoading;
  
  const communications: CommunicationItem[] = [];
  
  if (activityLogs && Array.isArray(activityLogs)) {
    activityLogs
      .filter(log => 
        log.type?.includes('sent') || 
        log.type?.includes('email') ||
        log.type === 'quote_sent' ||
        log.type === 'invoice_sent' ||
        log.type === 'receipt_sent'
      )
      .forEach(log => {
        const metadata = (log.metadata || {}) as Record<string, any>;
        const entityType = log.entityType as string | undefined;
        
        let subject = '';
        let attachmentType = '';
        let hasAttachment = false;
        
        if (log.type === 'quote_sent') {
          subject = `Quote ${metadata.quoteNumber || ''} - ${metadata.quoteTitle || 'Quote'}`;
          hasAttachment = true;
          attachmentType = 'Quote';
        } else if (log.type === 'invoice_sent') {
          subject = `Invoice ${metadata.invoiceNumber || ''} - ${metadata.invoiceTitle || 'Invoice'}`;
          hasAttachment = true;
          attachmentType = 'Invoice';
        } else if (log.type === 'receipt_sent') {
          subject = `Receipt ${metadata.receiptNumber || ''} - Payment Confirmation`;
          hasAttachment = true;
          attachmentType = 'Receipt';
        } else {
          subject = log.title || `${log.type?.replace(/_/g, ' ')}`;
        }
        
        const fullBody = metadata.emailBody || metadata.messageBody || log.description || '';
        
        communications.push({
          id: `email-${log.id}`,
          type: 'email',
          direction: 'outbound',
          status: 'sent',
          recipient: metadata.clientName || metadata.recipientName || 'Client',
          recipientEmail: metadata.recipientEmail || metadata.clientEmail,
          subject,
          body: log.description || '',
          fullBody,
          timestamp: new Date(log.createdAt || new Date()),
          entityType: entityType || undefined,
          entityId: log.entityId || undefined,
          entityNumber: metadata.quoteNumber || metadata.invoiceNumber || metadata.receiptNumber,
          hasAttachment,
          attachmentType,
          metadata,
        });
      });
  }
  
  if (smsConversations && Array.isArray(smsConversations)) {
    smsConversations.forEach((conv: any) => {
      if (conv.messages && Array.isArray(conv.messages)) {
        conv.messages
          .filter((msg: any) => msg.direction === 'outbound')
          .forEach((msg: any) => {
            communications.push({
              id: `sms-${msg.id}`,
              type: 'sms',
              direction: 'outbound',
              status: msg.status || 'sent',
              recipient: conv.clientName || 'Client',
              recipientPhone: conv.clientPhone,
              body: msg.body || '',
              fullBody: msg.body || '',
              timestamp: new Date(msg.createdAt || new Date()),
              entityType: conv.jobId ? 'job' : undefined,
              entityId: conv.jobId || undefined,
            });
          });
      }
    });
  }
  
  communications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const filteredCommunications = communications.filter(item => {
    if (activeTab !== 'all' && item.type !== activeTab) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.recipient.toLowerCase().includes(query) ||
        item.body.toLowerCase().includes(query) ||
        item.subject?.toLowerCase().includes(query) ||
        item.recipientEmail?.toLowerCase().includes(query) ||
        item.recipientPhone?.includes(query)
      );
    }
    return true;
  });
  
  const stats = {
    total: communications.length,
    emails: communications.filter(c => c.type === 'email').length,
    sms: communications.filter(c => c.type === 'sms').length,
    delivered: communications.filter(c => c.status === 'delivered' || c.status === 'sent').length,
    failed: communications.filter(c => c.status === 'failed').length,
    withAttachments: communications.filter(c => c.hasAttachment).length,
  };
  
  const handleViewEntity = (type: string, id: string) => {
    setShowDetail(false);
    switch (type) {
      case 'quote':
        navigate(`/quotes/${id}`);
        break;
      case 'invoice':
        navigate(`/invoices/${id}`);
        break;
      case 'job':
        navigate(`/jobs/${id}`);
        break;
      case 'client':
        navigate(`/clients/${id}`);
        break;
      case 'receipt':
        navigate(`/receipts/${id}`);
        break;
    }
  };
  
  const handleViewDetails = (item: CommunicationItem) => {
    setSelectedItem(item);
    setShowDetail(true);
  };
  
  const handleRefresh = () => {
    refetchSms();
    refetchLogs();
  };
  
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6 w-full">
        <div className="flex items-center gap-4 mb-6">
          {/* Back button only visible on mobile - desktop has sidebar navigation */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="md:hidden"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Communications Hub</h1>
            <p className="text-sm text-muted-foreground">View all sent emails and SMS with delivery proof</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.emails}</p>
                  <p className="text-xs text-muted-foreground">Emails</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sms}</p>
                  <p className="text-xs text-muted-foreground">SMS</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Paperclip className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.withAttachments}</p>
                  <p className="text-xs text-muted-foreground">With PDFs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by recipient, email, phone, content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="all" className="gap-2" data-testid="tab-all">
              <Send className="h-4 w-4" />
              All ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
              <Mail className="h-4 w-4" />
              Email ({stats.emails})
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2" data-testid="tab-sms">
              <MessageSquare className="h-4 w-4" />
              SMS ({stats.sms})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="space-y-3">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : filteredCommunications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-3">
                    {activeTab === 'email' ? (
                      <Mail className="h-12 w-12 text-muted-foreground" />
                    ) : activeTab === 'sms' ? (
                      <MessageSquare className="h-12 w-12 text-muted-foreground" />
                    ) : (
                      <Send className="h-12 w-12 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">No communications found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {searchQuery || statusFilter !== 'all' 
                          ? 'Try adjusting your filters'
                          : 'Sent emails and SMS messages will appear here'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredCommunications.map((item) => (
                <CommunicationCard 
                  key={item.id} 
                  item={item} 
                  onViewEntity={handleViewEntity}
                  onViewDetails={handleViewDetails}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
        
        {stats.failed > 0 && (
          <Card className="mt-6 border-red-200 dark:border-red-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                Failed Communications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.failed} message(s) failed to send. Check your Twilio and SendGrid settings in the 
                <Button 
                  variant="link" 
                  className="px-1 h-auto" 
                  onClick={() => navigate('/settings')}
                  data-testid="link-settings"
                >
                  Settings
                </Button>
                page.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      
      <CommunicationDetailSheet 
        item={selectedItem}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        onViewEntity={handleViewEntity}
      />
    </div>
  );
}

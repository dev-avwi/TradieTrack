import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft,
  Filter,
  FileText,
  Receipt,
  User,
  ExternalLink,
  Search,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { SmsMessage, ActivityLog } from "@shared/schema";

interface CommunicationItem {
  id: string;
  type: 'email' | 'sms';
  direction: 'outbound' | 'inbound';
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  recipient: string;
  recipientPhone?: string;
  subject?: string;
  body: string;
  timestamp: Date;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'delivered':
    case 'sent':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
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

function CommunicationCard({ item, onViewEntity }: { item: CommunicationItem; onViewEntity?: (type: string, id: string) => void }) {
  return (
    <Card className="hover-elevate cursor-pointer transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg ${item.type === 'email' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
              <TypeIcon type={item.type} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{item.recipient}</span>
                {item.recipientPhone && (
                  <span className="text-xs text-muted-foreground">{item.recipientPhone}</span>
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
                    View {item.entityType}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunicationsHub() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
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
        log.type === 'invoice_sent'
      )
      .forEach(log => {
        const metadata = (log.metadata || {}) as Record<string, any>;
        communications.push({
          id: `email-${log.id}`,
          type: 'email',
          direction: 'outbound',
          status: 'sent',
          recipient: metadata.clientName || metadata.recipientEmail || 'Client',
          subject: log.title || `${log.type?.replace(/_/g, ' ')}`,
          body: log.description || '',
          timestamp: new Date(log.createdAt || new Date()),
          entityType: log.entityType || undefined,
          entityId: log.entityId || undefined,
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
        item.subject?.toLowerCase().includes(query)
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
  };
  
  const handleViewEntity = (type: string, id: string) => {
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
    }
  };
  
  const handleRefresh = () => {
    refetchSms();
    refetchLogs();
  };
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/more')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Communications Hub</h1>
            <p className="text-sm text-muted-foreground">Track all sent emails and SMS messages</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by recipient, content..."
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
    </div>
  );
}

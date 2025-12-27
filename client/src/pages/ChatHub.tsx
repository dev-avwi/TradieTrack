import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatComposer } from "@/components/ChatComposer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import ClientInsightsPanel from "@/components/ClientInsightsPanel";
import { 
  Users, 
  Loader2, 
  Pin, 
  MessageCircle, 
  Mail, 
  Briefcase,
  ArrowLeft,
  Search,
  Send,
  Check,
  CheckCheck,
  Phone,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  ExternalLink,
  Plus,
  User,
  X,
  Trash2,
  Info,
  FileText,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";
import { useSmsSocket } from "@/hooks/use-sms-socket";
import { useIntegrationHealth, isTwilioReady } from "@/hooks/use-integration-health";
import { TwilioWarning } from "@/components/IntegrationWarning";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import type { MessageTemplate } from "@shared/schema";

interface TeamChatMessage {
  id: string;
  businessOwnerId: string;
  senderId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
}

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  profileImageUrl?: string | null;
  status: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  clientId?: string;
  address?: string;
  scheduledAt?: string;
}

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  otherUser: User;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

interface UnreadCounts {
  teamChat: number;
  directMessages: number;
  jobChats: number;
  sms: number;
}

interface SmsConversation {
  id: string;
  businessOwnerId: string;
  clientId: string | null;
  clientPhone: string;
  clientName: string | null;
  jobId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  deletedAt: string | null;
}

interface SmsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  senderUserId: string | null;
  status: string;
  twilioSid: string | null;
  isQuickAction: boolean;
  quickActionType: string | null;
  readAt: string | null;
  createdAt: string;
  isJobRequest?: boolean;
  intentConfidence?: 'high' | 'medium' | 'low' | null;
  intentType?: 'quote_request' | 'job_request' | 'enquiry' | 'followup' | 'other' | null;
  suggestedJobTitle?: string | null;
  jobCreatedFromSms?: string | null;
}

interface Client {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

type FilterType = 'all' | 'team' | 'direct' | 'jobs' | 'sms';
type ViewType = 'list' | 'team-chat' | 'direct-message' | 'job-chat' | 'sms-chat';

interface ConversationItem {
  id: string;
  type: 'team' | 'direct' | 'job' | 'sms';
  title: string;
  subtitle?: string;
  avatar?: string | null;
  avatarFallback: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  status?: string;
  data: any;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#6B7280',
  scheduled: '#3B82F6',
  in_progress: '#F59E0B',
  done: '#10B981',
  invoiced: '#8B5CF6',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Completed',
  invoiced: 'Invoiced',
};

const QUICK_REPLY_TEMPLATES = [
  { id: 'omw', label: "On my way!", message: "G'day! Just letting you know I'm on my way now. Should be there in about 20 minutes." },
  { id: 'running-late', label: "Running late", message: "Apologies, I'm running a bit behind schedule. Will be there as soon as I can - should only be another 15-20 minutes." },
  { id: 'job-done', label: "Job done", message: "All done! The job's been completed. Let me know if you have any questions or need anything else." },
  { id: 'thanks', label: "Thanks", message: "Thanks for your business mate! Really appreciate it. Don't hesitate to reach out if you need anything." },
  { id: 'confirm', label: "Confirm", message: "Just confirming our appointment. Please reply to let me know you're still available, or give us a bell if you need to reschedule." },
  { id: 'quote-sent', label: "Quote sent", message: "I've sent through your quote. Have a look and let me know if you've got any questions or want to go ahead." },
];

function ConversationSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OfflineBanner({ isConnected }: { isConnected: boolean }) {
  if (isConnected) return null;
  
  return (
    <div className="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">You're offline</span>
        <span className="text-xs text-amber-600 dark:text-amber-500">
          — messages will send when reconnected
        </span>
      </div>
    </div>
  );
}

interface JobContextCardProps {
  job: Job;
  onViewJob: () => void;
}

function JobContextCard({ job, onViewJob }: JobContextCardProps) {
  const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS.pending;
  const statusLabel = STATUS_LABELS[job.status] || 'Unknown';
  
  return (
    <Card className="shrink-0 mx-4 mt-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: statusColor + '20' }}
            >
              <Briefcase className="h-5 w-5" style={{ color: statusColor }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{job.title}</span>
                <Badge 
                  variant="secondary" 
                  className="shrink-0 text-xs px-1.5 py-0"
                  style={{ backgroundColor: statusColor + '20', color: statusColor }}
                >
                  {statusLabel}
                </Badge>
              </div>
              {job.address && (
                <p className="text-xs text-muted-foreground truncate">{job.address.split(',')[0]}</p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onViewJob}
            className="shrink-0 gap-1.5"
            data-testid="button-view-job-context"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Job
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChatHub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  const { isOwner, isManager } = useAppMode();
  
  const showDirectFilter = isOwner || isManager;
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [view, setView] = useState<ViewType>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDirectUser, setSelectedDirectUser] = useState<User | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedSmsConversation, setSelectedSmsConversation] = useState<SmsConversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [smsNewMessage, setSmsNewMessage] = useState('');
  const [showClientInsights, setShowClientInsights] = useState(false);
  
  // New SMS dialog state
  const [newSmsDialogOpen, setNewSmsDialogOpen] = useState(false);
  const [newSmsClientSearch, setNewSmsClientSearch] = useState('');
  const [newSmsSelectedClient, setNewSmsSelectedClient] = useState<Client | null>(null);
  const [newSmsPhoneNumber, setNewSmsPhoneNumber] = useState('');
  const [newSmsInitialMessage, setNewSmsInitialMessage] = useState('');
  const [newSmsPhoneError, setNewSmsPhoneError] = useState('');
  
  // Delete SMS conversation state
  const [smsToDelete, setSmsToDelete] = useState<SmsConversation | null>(null);
  
  // Create client from SMS dialog state
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const handleSmsNotification = useCallback((notification: {
    conversationId: string;
    senderPhone: string;
    senderName: string | null;
    messagePreview: string;
    jobId?: string | null;
    unreadCount: number;
    timestamp: number;
  }) => {
    toast({
      title: `New SMS from ${notification.senderName || notification.senderPhone}`,
      description: notification.messagePreview.slice(0, 60) + (notification.messagePreview.length > 60 ? '...' : ''),
    });
    
    if (selectedSmsConversation?.id === notification.conversationId) {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', notification.conversationId, 'messages'] });
    }
  }, [toast, queryClient, selectedSmsConversation]);

  const { isConnected: smsSocketConnected } = useSmsSocket({
    businessId: currentUser?.id || '',
    enabled: !!currentUser?.id,
    onSmsNotification: handleSmsNotification,
  });

  const { data: integrationHealth } = useIntegrationHealth();
  const twilioConnected = isTwilioReady(integrationHealth);

  const { data: unreadCounts = { teamChat: 0, directMessages: 0, jobChats: 0, sms: 0 } } = useQuery<UnreadCounts>({
    queryKey: ['/api/chat/unread-counts'],
    refetchInterval: 10000,
  });

  const { data: teamMessages = [], isLoading: teamLoading } = useQuery<TeamChatMessage[]>({
    queryKey: ['/api/team-chat'],
    refetchInterval: view === 'team-chat' ? 3000 : 30000,
  });

  const { data: dmConversations = [], isLoading: dmLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/direct-messages/conversations'],
    enabled: showDirectFilter,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: showDirectFilter,
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: smsConversations = [], isLoading: smsLoading } = useQuery<SmsConversation[]>({
    queryKey: ['/api/sms/conversations'],
    refetchInterval: 30000,
  });

  const { data: userSmsTemplates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ['/api/message-templates', 'sms'],
    queryFn: async () => {
      const res = await fetch('/api/message-templates?channel=sms', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled: newSmsDialogOpen,
  });

  const { data: directMessages = [], refetch: refetchDirectMessages } = useQuery<DirectMessage[]>({
    queryKey: ['/api/direct-messages', selectedDirectUser?.id],
    enabled: !!selectedDirectUser && view === 'direct-message',
  });

  const { data: smsMessages = [], refetch: refetchSmsMessages } = useQuery<SmsMessage[]>({
    queryKey: ['/api/sms/conversations', selectedSmsConversation?.id, 'messages'],
    enabled: !!selectedSmsConversation && view === 'sms-chat',
  });

  const sendTeamMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/team-chat', {
        message,
        messageType: 'text',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const sendDirectMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedDirectUser) throw new Error("No user selected");
      return apiRequest('POST', `/api/direct-messages/${selectedDirectUser.id}`, { content: message });
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/direct-messages', selectedDirectUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/direct-messages/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
  });

  const pinMessageMutation = useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      const response = await apiRequest('PATCH', `/api/team-chat/${messageId}/pin`, { pinned });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest('DELETE', `/api/team-chat/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async ({ clientId, clientPhone, message }: { clientId?: string; clientPhone: string; message: string }) => {
      const response = await apiRequest('POST', '/api/sms/send', {
        clientId,
        clientPhone,
        message,
      });
      return response.json();
    },
    onSuccess: () => {
      setSmsNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      if (selectedSmsConversation) {
        queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', selectedSmsConversation.id, 'messages'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send SMS",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const markSmsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest('POST', `/api/sms/conversations/${conversationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
  });

  const deleteSmsConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest('DELETE', `/api/sms/conversations/${conversationId}`);
    },
    onSuccess: (_, deletedId) => {
      toast({
        title: "Conversation deleted",
        description: "The SMS conversation has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
      // Clear selected conversation if it was deleted
      if (selectedSmsConversation?.id === deletedId) {
        setSelectedSmsConversation(null);
        setView('list');
      }
      setSmsToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete conversation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setSmsToDelete(null);
    },
  });

  const createJobFromSmsMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await apiRequest('POST', `/api/sms/messages/${messageId}/create-job`, {});
      return response.json();
    },
    onSuccess: (data: { job: { id: string; title: string } }) => {
      toast({
        title: "Job Created",
        description: `Job "${data.job.title}" has been created from this SMS.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', selectedSmsConversation?.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      
      // Update local state with the new jobId so the header shows "View Job" immediately
      if (selectedSmsConversation) {
        setSelectedSmsConversation({
          ...selectedSmsConversation,
          jobId: data.job.id
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create job",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createClientFromSmsMutation = useMutation({
    mutationFn: async ({ name, phone, email, address }: { name: string; phone: string; email?: string; address?: string }) => {
      const response = await apiRequest('POST', '/api/clients', {
        name,
        phone,
        email: email || undefined,
        address: address || undefined,
      });
      return response.json() as Promise<{ id: string; name: string }>;
    },
    onSuccess: async (newClient) => {
      if (selectedSmsConversation && selectedSmsConversation.id !== 'new') {
        await apiRequest('PATCH', `/api/sms/conversations/${selectedSmsConversation.id}`, {
          clientId: newClient.id,
          clientName: newClient.name,
        });
        
        setSelectedSmsConversation({
          ...selectedSmsConversation,
          clientId: newClient.id,
          clientName: newClient.name,
        });
      }
      
      toast({
        title: "Client Created",
        description: `${newClient.name} has been added and linked to this conversation.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      
      setCreateClientDialogOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientAddress('');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create client",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreateClientDialog = () => {
    if (selectedSmsConversation) {
      setNewClientPhone(selectedSmsConversation.clientPhone);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientAddress('');
      setCreateClientDialogOpen(true);
    }
  };

  const handleCreateClientSubmit = () => {
    if (!newClientName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the client",
        variant: "destructive",
      });
      return;
    }
    
    createClientFromSmsMutation.mutate({
      name: newClientName.trim(),
      phone: newClientPhone,
      email: newClientEmail.trim() || undefined,
      address: newClientAddress.trim() || undefined,
    });
  };

  const isUnknownClient = selectedSmsConversation && 
    (!selectedSmsConversation.clientId || 
     (selectedSmsConversation.clientName?.toLowerCase().includes('unknown')));

  const applySmsTemplateFields = (text: string, conversation: SmsConversation) => {
    if (!text) return text;
    const clientName = conversation?.clientName || 'Customer';
    const clientFirstName = clientName.split(' ')[0];
    return text
      .replace(/\{client_name\}/g, clientName)
      .replace(/\{client_first_name\}/g, clientFirstName)
      .replace(/\{business_name\}/g, 'Our business'); // Could be fetched from settings if available
  };

  // Handle deep-link navigation
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const targetUserId = params.get('to');
    const targetType = params.get('type');
    const smsClientId = params.get('smsClientId');
    const smsPhone = params.get('phone');
    
    // Handle SMS deep link
    if (smsClientId || smsPhone) {
      // Check if conversation already exists
      const existingConvo = smsConversations.find(c => 
        (smsClientId && c.clientId === smsClientId) || 
        (smsPhone && c.clientPhone === smsPhone)
      );
      
      if (existingConvo) {
        setSelectedSmsConversation(existingConvo);
        setView('sms-chat');
        markSmsReadMutation.mutate(existingConvo.id);
        setLocation('/chat', { replace: true });
      } else if (smsPhone) {
        // Create a temporary conversation object for new SMS
        const tempConvo: SmsConversation = {
          id: 'new',
          businessOwnerId: '',
          clientId: smsClientId || null,
          clientPhone: smsPhone,
          clientName: null,
          jobId: null,
          lastMessageAt: null,
          unreadCount: 0,
          deletedAt: null,
        };
        setSelectedSmsConversation(tempConvo);
        setView('sms-chat');
        setLocation('/chat', { replace: true });
      }
      return;
    }
    
    if (targetUserId && targetType === 'direct') {
      const convo = dmConversations.find(c => c.otherUser.id === targetUserId);
      if (convo) {
        setSelectedDirectUser(convo.otherUser);
        setView('direct-message');
        setLocation('/chat', { replace: true });
      } else {
        const member = teamMembers.find(m => m.userId === targetUserId);
        if (member) {
          setSelectedDirectUser({
            id: member.userId,
            email: member.email,
            firstName: member.name.split(' ')[0],
            lastName: member.name.split(' ').slice(1).join(' '),
            profileImageUrl: member.profileImageUrl,
          });
          setView('direct-message');
          setLocation('/chat', { replace: true });
        }
      }
    }
  }, [searchString, dmConversations, teamMembers, smsConversations, setLocation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (view === 'team-chat' && teamMessages.length > 0 && scrollRef.current) {
      const latestId = teamMessages[teamMessages.length - 1]?.id;
      if (latestId !== lastMessageRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        lastMessageRef.current = latestId;
      }
    }
  }, [teamMessages, view]);

  useEffect(() => {
    if (view === 'direct-message') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [directMessages, view]);

  // Polling for direct messages
  useEffect(() => {
    if (view === 'direct-message' && selectedDirectUser) {
      const interval = setInterval(() => refetchDirectMessages(), 3000);
      return () => clearInterval(interval);
    }
  }, [view, selectedDirectUser, refetchDirectMessages]);

  // Polling for SMS messages
  useEffect(() => {
    if (view === 'sms-chat' && selectedSmsConversation && selectedSmsConversation.id !== 'new') {
      const interval = setInterval(() => refetchSmsMessages(), 3000);
      return () => clearInterval(interval);
    }
  }, [view, selectedSmsConversation, refetchSmsMessages]);

  const formatTime = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'd MMM');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email || 'Unknown';
  };

  // Build unified conversation list
  const buildConversationList = (): ConversationItem[] => {
    const items: ConversationItem[] = [];

    // Team chat as single conversation
    if (filter === 'all' || filter === 'team') {
      const lastTeamMsg = teamMessages[teamMessages.length - 1];
      items.push({
        id: 'team-chat',
        type: 'team',
        title: 'Team Chat',
        subtitle: `${teamMembers.filter(m => m.status === 'accepted').length + 1} members`,
        avatarFallback: 'TC',
        lastMessage: lastTeamMsg?.message,
        lastMessageTime: lastTeamMsg?.createdAt,
        unreadCount: unreadCounts.teamChat,
        data: null,
      });
    }

    // Direct message conversations
    if ((filter === 'all' || filter === 'direct') && showDirectFilter) {
      dmConversations.forEach(convo => {
        items.push({
          id: `dm-${convo.otherUser.id}`,
          type: 'direct',
          title: getUserDisplayName(convo.otherUser),
          subtitle: convo.otherUser.email || undefined,
          avatar: convo.otherUser.profileImageUrl,
          avatarFallback: getInitials(getUserDisplayName(convo.otherUser)),
          lastMessage: convo.lastMessage?.content,
          lastMessageTime: convo.lastMessage?.createdAt,
          unreadCount: convo.unreadCount,
          data: convo.otherUser,
        });
      });
    }

    // Active jobs
    if (filter === 'all' || filter === 'jobs') {
      const activeJobs = jobs.filter(j => 
        j.status !== 'done' && j.status !== 'invoiced' && j.status !== 'cancelled'
      );
      activeJobs.forEach(job => {
        items.push({
          id: `job-${job.id}`,
          type: 'job',
          title: job.title,
          subtitle: job.address?.split(',')[0],
          avatarFallback: job.title[0]?.toUpperCase() || 'J',
          status: job.status,
          unreadCount: 0,
          data: job,
        });
      });
    }

    // SMS conversations
    if (filter === 'all' || filter === 'sms') {
      smsConversations.forEach(convo => {
        items.push({
          id: `sms-${convo.id}`,
          type: 'sms',
          title: convo.clientName || convo.clientPhone,
          subtitle: convo.clientName ? convo.clientPhone : undefined,
          avatarFallback: (convo.clientName || convo.clientPhone)[0]?.toUpperCase() || 'S',
          lastMessageTime: convo.lastMessageAt || undefined,
          unreadCount: convo.unreadCount,
          data: convo,
        });
      });
    }

    // Sort by last message time (most recent first), with team chat at top
    items.sort((a, b) => {
      if (a.id === 'team-chat') return -1;
      if (b.id === 'team-chat') return 1;
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return items.filter(item => 
        item.title.toLowerCase().includes(term) ||
        item.subtitle?.toLowerCase().includes(term)
      );
    }

    return items;
  };

  const handleConversationClick = (item: ConversationItem) => {
    if (item.type === 'team') {
      setView('team-chat');
    } else if (item.type === 'direct') {
      setSelectedDirectUser(item.data);
      setView('direct-message');
    } else if (item.type === 'job') {
      setLocation(`/jobs/${item.data.id}?tab=chat`);
    } else if (item.type === 'sms') {
      setSelectedSmsConversation(item.data);
      setView('sms-chat');
      if (item.data.id !== 'new' && item.unreadCount > 0) {
        markSmsReadMutation.mutate(item.data.id);
      }
    }
  };

  const handleBack = () => {
    setView('list');
    setSelectedDirectUser(null);
    setSelectedJob(null);
    setSelectedSmsConversation(null);
    setNewMessage('');
    setSmsNewMessage('');
  };

  const handleSendTeamMessage = (message: string) => {
    sendTeamMessageMutation.mutate(message);
  };

  const handleSendDirectMessage = () => {
    if (!newMessage.trim()) return;
    sendDirectMessageMutation.mutate(newMessage.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendDirectMessage();
    }
  };

  const handleSendSms = () => {
    if (!smsNewMessage.trim() || !selectedSmsConversation) return;
    sendSmsMutation.mutate({
      clientId: selectedSmsConversation.clientId || undefined,
      clientPhone: selectedSmsConversation.clientPhone,
      message: smsNewMessage.trim(),
    });
  };

  const handleSmsKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendSms();
    }
  };

  // Australian phone number formatting and validation
  const formatAustralianPhone = (value: string): string => {
    // Remove all non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '');
    
    // Handle +61 format
    if (cleaned.startsWith('+61')) {
      const digits = cleaned.slice(3);
      if (digits.length <= 3) return `+61 ${digits}`;
      if (digits.length <= 6) return `+61 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }
    
    // Handle 04xx format (Australian mobile)
    if (cleaned.startsWith('04') || cleaned.startsWith('0')) {
      if (cleaned.length <= 4) return cleaned;
      if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)}`;
    }
    
    // Just return cleaned value for other cases
    return cleaned;
  };

  const normalizePhoneForApi = (phone: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Convert 04xx to +614xx format
    if (cleaned.startsWith('04')) {
      cleaned = '+61' + cleaned.slice(1);
    } else if (cleaned.startsWith('0')) {
      cleaned = '+61' + cleaned.slice(1);
    } else if (!cleaned.startsWith('+')) {
      // Assume Australian number if no country code
      cleaned = '+61' + cleaned;
    }
    
    return cleaned;
  };

  const validateAustralianPhone = (phone: string): string | null => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Check for +61 format
    if (cleaned.startsWith('+61')) {
      const digits = cleaned.slice(3);
      if (digits.length !== 9) {
        return 'Australian mobile numbers should have 9 digits after +61';
      }
      if (!digits.startsWith('4')) {
        return 'Australian mobile numbers should start with 04 or +614';
      }
      return null;
    }
    
    // Check for 04xx format
    if (cleaned.startsWith('04')) {
      if (cleaned.length !== 10) {
        return 'Australian mobile numbers should be 10 digits (e.g., 0412 345 678)';
      }
      return null;
    }
    
    // Check for 0x format (landline)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return null;
    }
    
    return 'Please enter a valid Australian phone number (e.g., 0412 345 678 or +61 412 345 678)';
  };

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAustralianPhone(e.target.value);
    setNewSmsPhoneNumber(formatted);
    setNewSmsPhoneError('');
  };

  // Filtered clients for search
  const filteredClients = useMemo(() => {
    if (!newSmsClientSearch.trim()) return [];
    const search = newSmsClientSearch.toLowerCase();
    return allClients
      .filter(c => 
        (c.name?.toLowerCase().includes(search) || 
         c.phone?.toLowerCase().includes(search) ||
         c.email?.toLowerCase().includes(search)) &&
        c.phone // Only show clients with phone numbers
      )
      .slice(0, 5);
  }, [allClients, newSmsClientSearch]);

  const resetNewSmsDialog = () => {
    setNewSmsClientSearch('');
    setNewSmsSelectedClient(null);
    setNewSmsPhoneNumber('');
    setNewSmsInitialMessage('');
    setNewSmsPhoneError('');
  };

  const handleStartNewSms = () => {
    // Validate phone if manually entered
    if (!newSmsSelectedClient && newSmsPhoneNumber) {
      const error = validateAustralianPhone(newSmsPhoneNumber);
      if (error) {
        setNewSmsPhoneError(error);
        return;
      }
    }
    
    const phone = newSmsSelectedClient?.phone || normalizePhoneForApi(newSmsPhoneNumber);
    const clientId = newSmsSelectedClient?.id;
    const clientName = newSmsSelectedClient?.name;
    
    if (!phone) {
      setNewSmsPhoneError('Please select a client or enter a phone number');
      return;
    }
    
    // Check if conversation already exists
    const existingConvo = smsConversations.find(c => 
      (clientId && c.clientId === clientId) || 
      c.clientPhone === phone
    );
    
    if (existingConvo) {
      // Open existing conversation
      setSelectedSmsConversation(existingConvo);
      setView('sms-chat');
      markSmsReadMutation.mutate(existingConvo.id);
      
      // If there's an initial message, send it
      if (newSmsInitialMessage.trim()) {
        sendSmsMutation.mutate({
          clientId: existingConvo.clientId || undefined,
          clientPhone: existingConvo.clientPhone,
          message: newSmsInitialMessage.trim(),
        });
      }
    } else {
      // Create temporary conversation and optionally send first message
      const tempConvo: SmsConversation = {
        id: 'new',
        businessOwnerId: '',
        clientId: clientId || null,
        clientPhone: phone,
        clientName: clientName || null,
        jobId: null,
        lastMessageAt: null,
        unreadCount: 0,
        deletedAt: null,
      };
      setSelectedSmsConversation(tempConvo);
      setView('sms-chat');
      
      // If there's an initial message, send it
      if (newSmsInitialMessage.trim()) {
        sendSmsMutation.mutate({
          clientId: clientId,
          clientPhone: phone,
          message: newSmsInitialMessage.trim(),
        });
      }
    }
    
    setNewSmsDialogOpen(false);
    resetNewSmsDialog();
  };

  // Calculate total SMS unread count
  const smsUnreadCount = smsConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const pinnedMessages = teamMessages.filter(m => m.isPinned);
  const conversationList = buildConversationList();
  const isLoading = teamLoading || (showDirectFilter && dmLoading) || jobsLoading || smsLoading;

  // Team Chat View
  if (view === 'team-chat') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 p-4 border-b bg-background flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Team Chat</h2>
            <p className="text-xs text-muted-foreground">
              {teamMembers.filter(m => m.status === 'accepted').length + 1} members
            </p>
          </div>
        </div>

        {pinnedMessages.length > 0 && (
          <Card className="shrink-0 mx-4 mt-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-2 px-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium mb-1">
                <Pin className="h-3.5 w-3.5" />
                Pinned ({pinnedMessages.length})
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {pinnedMessages[pinnedMessages.length - 1]?.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Offline Banner */}
        <OfflineBanner isConnected={smsSocketConnected} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2">
          {teamMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-base mb-1">Team chat's quiet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Share updates, coordinate jobs, or just check in with your crew
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {teamMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  id={msg.id}
                  message={msg.message}
                  messageType={msg.messageType}
                  senderName={msg.senderName}
                  senderAvatar={msg.senderAvatar}
                  isCurrentUser={msg.senderId === currentUser?.id}
                  isAnnouncement={msg.isAnnouncement}
                  isPinned={msg.isPinned}
                  attachmentUrl={msg.attachmentUrl}
                  attachmentName={msg.attachmentName}
                  createdAt={msg.createdAt}
                  onPin={(isOwner || isManager) ? (id, pinned) => pinMessageMutation.mutate({ messageId: id, pinned }) : undefined}
                  onDelete={msg.senderId === currentUser?.id || isOwner ? (id) => deleteMessageMutation.mutate(id) : undefined}
                  canPin={isOwner || isManager}
                />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t bg-background">
          <ChatComposer
            onSend={handleSendTeamMessage}
            placeholder="Message your team..."
            disabled={sendTeamMessageMutation.isPending}
          />
        </div>
      </div>
    );
  }

  // Direct Message View
  if (view === 'direct-message' && selectedDirectUser) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 p-4 border-b bg-background flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={selectedDirectUser.profileImageUrl || undefined} />
            <AvatarFallback>{getInitials(getUserDisplayName(selectedDirectUser))}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{getUserDisplayName(selectedDirectUser)}</h2>
            <p className="text-xs text-muted-foreground truncate">{selectedDirectUser.email}</p>
          </div>
        </div>

        {/* Offline Banner */}
        <OfflineBanner isConnected={smsSocketConnected} />

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {directMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-base mb-1">Start chatting</h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Message {getUserDisplayName(selectedDirectUser)} directly — great for quick updates or questions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {directMessages.map((msg) => {
                const isOwn = msg.senderId !== selectedDirectUser.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        <span className={`text-xs ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {isOwn && (
                          msg.isRead 
                            ? <CheckCheck className={`h-3 w-3 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
                            : <Check className={`h-3 w-3 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              data-testid="input-message"
            />
            <Button
              onClick={handleSendDirectMessage}
              disabled={!newMessage.trim() || sendDirectMessageMutation.isPending}
              size="icon"
              data-testid="button-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // SMS Chat View
  if (view === 'sms-chat' && selectedSmsConversation) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="shrink-0 p-4 border-b bg-background flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back-sms">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold truncate">
                {selectedSmsConversation.clientName || selectedSmsConversation.clientPhone}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {selectedSmsConversation.clientName ? selectedSmsConversation.clientPhone : 'SMS Conversation'}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 gap-1">
              <Phone className="h-3 w-3" />
              SMS
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowClientInsights(true)}
              data-testid="button-show-client-insights"
            >
              <Info className="h-5 w-5" />
            </Button>
          </div>

          {/* Offline Banner */}
          <OfflineBanner isConnected={smsSocketConnected} />

          {/* Twilio Warning - SMS won't work without it */}
          {!twilioConnected && <TwilioWarning />}

          {/* Job Context Card for linked jobs */}
          {selectedSmsConversation.jobId && (() => {
            const linkedJob = jobs.find(j => j.id === selectedSmsConversation.jobId);
            if (linkedJob) {
              return (
                <JobContextCard 
                  job={linkedJob} 
                  onViewJob={() => setLocation(`/jobs/${selectedSmsConversation.jobId}`)} 
                />
              );
            }
            return null;
          })()}

          {/* Create Client Banner for unknown numbers */}
          {isUnknownClient && selectedSmsConversation.id !== 'new' && (
            <Card className="shrink-0 mx-4 mt-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">Unknown contact</p>
                      <p className="text-xs text-muted-foreground">
                        Save this number as a new client
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleOpenCreateClientDialog}
                    className="shrink-0 gap-1.5"
                    data-testid="button-create-client-from-sms"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Client
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-2">
          {smsMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Phone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-base mb-1">No messages yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Send a text to {selectedSmsConversation.clientName || 'this client'} — perfect for quick updates or appointment reminders
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {smsMessages.map((msg) => {
                const isOwn = msg.direction === 'outbound';
                const isJobRequest = msg.isJobRequest && msg.direction === 'inbound';
                const jobAlreadyCreated = !!msg.jobCreatedFromSms;
                
                const getIntentLabel = (intentType: string | null | undefined) => {
                  switch (intentType) {
                    case 'quote_request': return 'Quote Request';
                    case 'job_request': return 'Job Request';
                    case 'enquiry': return 'Enquiry';
                    case 'followup': return 'Follow-up';
                    default: return 'Request';
                  }
                };
                
                const getConfidenceColor = (confidence: string | null | undefined) => {
                  switch (confidence) {
                    case 'high': return 'bg-green-500/15 text-green-700 dark:text-green-400';
                    case 'medium': return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
                    case 'low': return 'bg-gray-500/15 text-gray-600 dark:text-gray-400';
                    default: return 'bg-gray-500/15 text-gray-600';
                  }
                };
                
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isJobRequest ? 'space-y-2' : ''}`}>
                      {isJobRequest && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <Badge 
                            variant="secondary" 
                            className="bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs"
                            data-testid={`badge-intent-${msg.id}`}
                          >
                            <Briefcase className="h-3 w-3 mr-1" />
                            {getIntentLabel(msg.intentType)}
                          </Badge>
                          {msg.intentConfidence && (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getConfidenceColor(msg.intentConfidence)}`}
                              data-testid={`badge-confidence-${msg.id}`}
                            >
                              {msg.intentConfidence.charAt(0).toUpperCase() + msg.intentConfidence.slice(1)} confidence
                            </Badge>
                          )}
                          {jobAlreadyCreated && (
                            <Badge 
                              variant="secondary" 
                              className="bg-green-500/15 text-green-700 dark:text-green-400 text-xs"
                              data-testid={`badge-job-created-${msg.id}`}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Job Created
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isOwn ? 'bg-green-600 text-white' : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                          <span className={`text-xs ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {formatTime(msg.createdAt)}
                          </span>
                          {isOwn && msg.status === 'delivered' && (
                            <CheckCheck className="h-3 w-3 text-white/70" />
                          )}
                          {isOwn && msg.status === 'sent' && (
                            <Check className="h-3 w-3 text-white/70" />
                          )}
                        </div>
                      </div>
                      
                      {isJobRequest && (
                        <div className="mt-2 space-y-2">
                          {msg.suggestedJobTitle && (
                            <p className="text-xs text-muted-foreground" data-testid={`suggested-title-${msg.id}`}>
                              <span className="font-medium">Suggested job:</span> {msg.suggestedJobTitle}
                            </p>
                          )}
                          {jobAlreadyCreated ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/jobs/${msg.jobCreatedFromSms}`)}
                              className="gap-1.5"
                              data-testid={`button-view-job-${msg.id}`}
                            >
                              <Briefcase className="h-3.5 w-3.5" />
                              View Job
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              disabled={createJobFromSmsMutation.isPending}
                              onClick={() => createJobFromSmsMutation.mutate(msg.id)}
                              className="gap-1.5"
                              data-testid={`button-create-job-${msg.id}`}
                            >
                              {createJobFromSmsMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Briefcase className="h-3.5 w-3.5" />
                              )}
                              Create Job from SMS
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

          {/* Quick Reply Templates */}
          <div className="shrink-0 px-4 pt-3 flex items-center gap-2 overflow-x-auto no-scrollbar border-t">
            <span className="text-xs text-muted-foreground shrink-0">Quick:</span>
            {QUICK_REPLY_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                variant="secondary"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setSmsNewMessage(template.message)}
                data-testid={`quick-reply-${template.id}`}
              >
                {template.label}
              </Button>
            ))}
            {userSmsTemplates.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground shrink-0 ml-2 border-l pl-2">Custom:</span>
                {userSmsTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => setSmsNewMessage(applySmsTemplateFields(template.body, selectedSmsConversation!))}
                    data-testid={`user-template-${template.id}`}
                  >
                    {template.name}
                  </Button>
                ))}
              </>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className="shrink-0 px-4 pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <a href={`tel:${selectedSmsConversation.clientPhone}`}>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" data-testid="quick-action-call">
                <Phone className="h-3.5 w-3.5" />
                Call
              </Button>
            </a>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 shrink-0"
              onClick={() => {
                const params = new URLSearchParams();
                if (selectedSmsConversation.clientId) {
                  params.set('clientId', selectedSmsConversation.clientId);
                } else {
                  params.set('phone', selectedSmsConversation.clientPhone);
                }
                setLocation(`/jobs/new?${params.toString()}`);
              }}
              data-testid="quick-action-create-job"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Create Job
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 shrink-0"
              onClick={() => {
                const params = new URLSearchParams();
                if (selectedSmsConversation.clientId) {
                  params.set('clientId', selectedSmsConversation.clientId);
                } else {
                  params.set('phone', selectedSmsConversation.clientPhone);
                }
                setLocation(`/quotes/new?${params.toString()}`);
              }}
              data-testid="quick-action-create-quote"
            >
              <FileText className="h-3.5 w-3.5" />
              Create Quote
            </Button>
          </div>

          <div className="shrink-0 p-4 border-t bg-background">
            <div className="flex gap-2">
              <Input
                placeholder="Type an SMS message..."
                value={smsNewMessage}
                onChange={(e) => setSmsNewMessage(e.target.value)}
                onKeyPress={handleSmsKeyPress}
                className="flex-1"
                data-testid="input-sms-message"
              />
              <Button
                onClick={handleSendSms}
                disabled={!smsNewMessage.trim() || sendSmsMutation.isPending}
                size="icon"
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-send-sms"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop: Side panel when showClientInsights is true */}
        {showClientInsights && (
          <div className="hidden md:flex w-[320px] shrink-0 border-l bg-background" data-testid="desktop-insights-panel">
            <ClientInsightsPanel
              clientId={selectedSmsConversation.clientId}
              clientPhone={selectedSmsConversation.clientPhone}
              conversationId={selectedSmsConversation.id}
              onClose={() => setShowClientInsights(false)}
              onNavigateToJob={(jobId) => { setShowClientInsights(false); setLocation(`/jobs/${jobId}`); }}
              onNavigateToInvoice={(invoiceId) => { setShowClientInsights(false); setLocation(`/invoices/${invoiceId}`); }}
              onCreateJob={() => { setShowClientInsights(false); setLocation('/jobs/new?clientId=' + selectedSmsConversation.clientId); }}
              onCreateQuote={() => { setShowClientInsights(false); setLocation('/quotes/new?clientId=' + selectedSmsConversation.clientId); }}
            />
          </div>
        )}

        {/* Mobile: Sheet slides in from the right */}
        <Sheet open={showClientInsights} onOpenChange={setShowClientInsights}>
          <SheetContent side="right" className="w-[85vw] sm:w-[400px] p-0 md:hidden" hideClose>
            <ClientInsightsPanel
              clientId={selectedSmsConversation.clientId}
              clientPhone={selectedSmsConversation.clientPhone}
              conversationId={selectedSmsConversation.id}
              onClose={() => setShowClientInsights(false)}
              onNavigateToJob={(jobId) => { setShowClientInsights(false); setLocation(`/jobs/${jobId}`); }}
              onNavigateToInvoice={(invoiceId) => { setShowClientInsights(false); setLocation(`/invoices/${invoiceId}`); }}
              onCreateJob={() => { setShowClientInsights(false); setLocation('/jobs/new?clientId=' + selectedSmsConversation.clientId); }}
              onCreateQuote={() => { setShowClientInsights(false); setLocation('/quotes/new?clientId=' + selectedSmsConversation.clientId); }}
            />
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Main Conversation List View
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 pb-3 border-b bg-background">
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
          >
            <MessageCircle className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Messages</h1>
            <p className="text-xs text-muted-foreground">
              Stay connected with your team
            </p>
          </div>
          {(filter === 'all' || filter === 'sms') && (
            <Button
              onClick={() => setNewSmsDialogOpen(true)}
              size="sm"
              className="shrink-0 gap-1.5 bg-green-600 hover:bg-green-700"
              data-testid="button-new-sms"
            >
              <Plus className="h-4 w-4" />
              New SMS
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="shrink-0"
            data-testid="filter-all"
          >
            All
            {(unreadCounts.teamChat + unreadCounts.directMessages + unreadCounts.jobChats + smsUnreadCount) > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1.5">
                {unreadCounts.teamChat + unreadCounts.directMessages + unreadCounts.jobChats + smsUnreadCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={filter === 'team' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('team')}
            className="shrink-0 gap-1.5"
            data-testid="filter-team"
          >
            <Users className="h-3.5 w-3.5" />
            Team
            {unreadCounts.teamChat > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {unreadCounts.teamChat}
              </Badge>
            )}
          </Button>
          {showDirectFilter && (
            <Button
              variant={filter === 'direct' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('direct')}
              className="shrink-0 gap-1.5"
              data-testid="filter-direct"
            >
              <Mail className="h-3.5 w-3.5" />
              Direct
              {unreadCounts.directMessages > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                  {unreadCounts.directMessages}
                </Badge>
              )}
            </Button>
          )}
          <Button
            variant={filter === 'jobs' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('jobs')}
            className="shrink-0 gap-1.5"
            data-testid="filter-jobs"
          >
            <Briefcase className="h-3.5 w-3.5" />
            Jobs
            {unreadCounts.jobChats > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {unreadCounts.jobChats}
              </Badge>
            )}
          </Button>
          <Button
            variant={filter === 'sms' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('sms')}
            className="shrink-0 gap-1.5"
            data-testid="filter-sms"
          >
            <Phone className="h-3.5 w-3.5" />
            SMS
            {smsUnreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {smsUnreadCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Offline Banner */}
      <OfflineBanner isConnected={smsSocketConnected} />

      {/* Twilio Warning - Show when SMS tab is active and Twilio not connected */}
      {filter === 'sms' && !twilioConnected && <TwilioWarning />}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationSkeleton />
        ) : conversationList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-base mb-1">No messages yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              {filter === 'direct' 
                ? 'Message your crew directly — conversations with team members will show up here'
                : filter === 'jobs'
                ? 'Job chat threads will appear here when you create jobs'
                : filter === 'sms'
                ? 'Text your clients directly — SMS conversations will appear here'
                : 'Your team chat and messages will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {conversationList.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-4 hover-elevate cursor-pointer group"
                onClick={() => handleConversationClick(item)}
                data-testid={`conversation-${item.id}`}
              >
                {/* Avatar */}
                {item.type === 'team' ? (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                ) : item.type === 'job' ? (
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (STATUS_COLORS[item.status || 'pending'] || '#6B7280') + '20' }}
                  >
                    <Briefcase 
                      className="h-6 w-6" 
                      style={{ color: STATUS_COLORS[item.status || 'pending'] || '#6B7280' }} 
                    />
                  </div>
                ) : item.type === 'sms' ? (
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <Phone className="h-6 w-6 text-green-600" />
                  </div>
                ) : (
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={item.avatar || undefined} />
                    <AvatarFallback>{item.avatarFallback}</AvatarFallback>
                  </Avatar>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{item.title}</span>
                      <Badge variant="outline" className="shrink-0 text-xs px-1.5 py-0">
                        {item.type === 'team' ? 'Team' : item.type === 'direct' ? 'DM' : item.type === 'sms' ? 'SMS' : 'Job'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.lastMessageTime && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(item.lastMessageTime), { addSuffix: true })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-sm text-muted-foreground truncate">
                      {item.lastMessage || item.subtitle || 'No messages yet'}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.unreadCount > 0 && (
                        <Badge className="shrink-0 h-5 min-w-5 px-1.5 bg-destructive text-destructive-foreground">
                          {item.unreadCount}
                        </Badge>
                      )}
                      {item.type === 'sms' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSmsToDelete(item.data);
                          }}
                          data-testid={`button-delete-sms-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* New conversation prompt for direct messages */}
            {filter === 'direct' && showDirectFilter && teamMembers.filter(m => m.status === 'accepted').length > 0 && (
              <div className="p-4">
                <p className="text-sm text-muted-foreground mb-3">Start a new conversation</p>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {teamMembers
                    .filter(m => m.status === 'accepted')
                    .filter(m => !dmConversations.some(c => c.otherUser.id === m.userId))
                    .map((member) => (
                      <div
                        key={member.id}
                        className="flex flex-col items-center gap-1.5 cursor-pointer p-2 rounded-lg hover-elevate min-w-[72px]"
                        onClick={() => {
                          setSelectedDirectUser({
                            id: member.userId,
                            email: member.email,
                            firstName: member.name.split(' ')[0],
                            lastName: member.name.split(' ').slice(1).join(' '),
                            profileImageUrl: member.profileImageUrl,
                          });
                          setView('direct-message');
                        }}
                        data-testid={`new-dm-${member.id}`}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.profileImageUrl || undefined} />
                          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-center truncate w-full">{member.name.split(' ')[0]}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New SMS Dialog */}
      <Dialog open={newSmsDialogOpen} onOpenChange={(open) => {
        setNewSmsDialogOpen(open);
        if (!open) resetNewSmsDialog();
      }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-new-sms">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              New SMS Conversation
            </DialogTitle>
            <DialogDescription>
              Search for an existing client or enter a phone number to start a new SMS conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected Client Display */}
            {newSmsSelectedClient && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{newSmsSelectedClient.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{newSmsSelectedClient.phone}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setNewSmsSelectedClient(null);
                    setNewSmsClientSearch('');
                  }}
                  data-testid="button-clear-selected-client"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Client Search or Phone Entry */}
            {!newSmsSelectedClient && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="client-search">Search clients</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="client-search"
                      placeholder="Search by name or phone..."
                      value={newSmsClientSearch}
                      onChange={(e) => setNewSmsClientSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-client-search"
                    />
                  </div>

                  {/* Client Search Results */}
                  {filteredClients.length > 0 && (
                    <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                      {filteredClients.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center gap-3 p-3 cursor-pointer hover-elevate"
                          onClick={() => {
                            setNewSmsSelectedClient(client);
                            setNewSmsClientSearch('');
                            setNewSmsPhoneNumber('');
                          }}
                          data-testid={`client-option-${client.id}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{client.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{client.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {newSmsClientSearch && filteredClients.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No clients found with that name or phone number
                    </p>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-number">Enter phone number</Label>
                  <Input
                    id="phone-number"
                    placeholder="0412 345 678 or +61 412 345 678"
                    value={newSmsPhoneNumber}
                    onChange={handlePhoneInputChange}
                    className={newSmsPhoneError ? 'border-destructive' : ''}
                    data-testid="input-phone-number"
                  />
                  {newSmsPhoneError && (
                    <p className="text-sm text-destructive flex items-center gap-1" data-testid="text-phone-error">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {newSmsPhoneError}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Initial Message */}
            <div className="space-y-2">
              <Label htmlFor="initial-message">Initial message (optional)</Label>
              <Textarea
                id="initial-message"
                placeholder="Type your first message..."
                value={newSmsInitialMessage}
                onChange={(e) => setNewSmsInitialMessage(e.target.value)}
                rows={3}
                data-testid="textarea-initial-message"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to just open the conversation without sending a message.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setNewSmsDialogOpen(false);
                resetNewSmsDialog();
              }}
              data-testid="button-cancel-new-sms"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartNewSms}
              disabled={!newSmsSelectedClient && !newSmsPhoneNumber.trim()}
              className="gap-1.5 bg-green-600 hover:bg-green-700"
              data-testid="button-start-sms"
            >
              {sendSmsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              {newSmsInitialMessage.trim() ? 'Send & Open' : 'Open Conversation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete SMS Conversation Confirmation Dialog */}
      <AlertDialog open={!!smsToDelete} onOpenChange={(open) => !open && setSmsToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-sms-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SMS Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the conversation with{' '}
              <span className="font-medium">
                {smsToDelete?.clientName || smsToDelete?.clientPhone}
              </span>
              ? This action cannot be undone and all messages will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setSmsToDelete(null)}
              data-testid="button-cancel-delete-sms"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (smsToDelete) {
                  deleteSmsConversationMutation.mutate(smsToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteSmsConversationMutation.isPending}
              data-testid="button-confirm-delete-sms"
            >
              {deleteSmsConversationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Client from SMS Dialog */}
      <Dialog open={createClientDialogOpen} onOpenChange={setCreateClientDialogOpen}>
        <DialogContent data-testid="dialog-create-client-from-sms">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Create Client from SMS
            </DialogTitle>
            <DialogDescription>
              Add this phone number as a new client. They'll be linked to this conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="client-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                placeholder="e.g., John Smith or ABC Constructions"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                data-testid="input-create-client-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-phone">Phone Number</Label>
              <Input
                id="client-phone"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="0412 345 678"
                data-testid="input-create-client-phone"
              />
              <p className="text-xs text-muted-foreground">
                Pre-filled from the SMS conversation
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-email">Email (optional)</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="client@example.com"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                data-testid="input-create-client-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-address">Address (optional)</Label>
              <Input
                id="client-address"
                placeholder="123 Main Street, Sydney NSW 2000"
                value={newClientAddress}
                onChange={(e) => setNewClientAddress(e.target.value)}
                data-testid="input-create-client-address"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCreateClientDialogOpen(false)}
              data-testid="button-cancel-create-client"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClientSubmit}
              disabled={!newClientName.trim() || createClientFromSmsMutation.isPending}
              data-testid="button-submit-create-client"
            >
              {createClientFromSmsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

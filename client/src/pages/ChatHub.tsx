import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatComposer } from "@/components/ChatComposer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  PanelRightClose,
  PanelRight,
  MapPin,
  Calendar,
  Circle,
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

type FilterType = 'all' | 'team' | 'customers' | 'jobs';

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
  isOnline?: boolean;
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
    <div className="space-y-1 p-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3 w-12" />
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

function getTypeIcon(type: string) {
  switch (type) {
    case 'team':
      return <Users className="h-4 w-4" />;
    case 'sms':
      return <Phone className="h-4 w-4" />;
    case 'job':
      return <Briefcase className="h-4 w-4" />;
    case 'direct':
      return <Mail className="h-4 w-4" />;
    default:
      return <MessageCircle className="h-4 w-4" />;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'team':
      return 'bg-primary/10 text-primary';
    case 'sms':
      return 'bg-green-500/10 text-green-600';
    case 'job':
      return 'bg-blue-500/10 text-blue-600';
    case 'direct':
      return 'bg-purple-500/10 text-purple-600';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'team':
      return 'Team';
    case 'sms':
      return 'Customer';
    case 'job':
      return 'Job';
    case 'direct':
      return 'Direct';
    default:
      return '';
  }
}

export default function ChatHub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isOwner, isManager } = useAppMode();
  
  const showDirectFilter = isOwner || isManager;
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [selectedDirectUser, setSelectedDirectUser] = useState<User | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedSmsConversation, setSelectedSmsConversation] = useState<SmsConversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [smsNewMessage, setSmsNewMessage] = useState('');
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  
  const [newSmsDialogOpen, setNewSmsDialogOpen] = useState(false);
  const [newSmsClientSearch, setNewSmsClientSearch] = useState('');
  const [newSmsSelectedClient, setNewSmsSelectedClient] = useState<Client | null>(null);
  const [newSmsPhoneNumber, setNewSmsPhoneNumber] = useState('');
  const [newSmsInitialMessage, setNewSmsInitialMessage] = useState('');
  const [newSmsPhoneError, setNewSmsPhoneError] = useState('');
  
  const [smsToDelete, setSmsToDelete] = useState<SmsConversation | null>(null);
  
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
    refetchInterval: selectedConversation?.type === 'team' ? 3000 : 30000,
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
    enabled: !!selectedDirectUser && selectedConversation?.type === 'direct',
  });

  const { data: smsMessages = [], refetch: refetchSmsMessages } = useQuery<SmsMessage[]>({
    queryKey: ['/api/sms/conversations', selectedSmsConversation?.id, 'messages'],
    enabled: !!selectedSmsConversation && selectedConversation?.type === 'sms',
  });

  // Find SMS conversation for the selected job - prefer jobId match, then clientId
  const jobSmsConversation = useMemo(() => {
    if (selectedConversation?.type !== 'job' || !selectedJob) return null;
    // First try to find by jobId (most accurate)
    const byJobId = smsConversations.find(c => c.jobId === selectedJob.id);
    if (byJobId) return byJobId;
    // Fallback to clientId match
    if (selectedJob.clientId) {
      return smsConversations.find(c => c.clientId === selectedJob.clientId) || null;
    }
    return null;
  }, [selectedJob, smsConversations, selectedConversation?.type]);

  // Separate query for job's SMS messages to avoid state pollution
  const { data: jobSmsMessages = [] } = useQuery<SmsMessage[]>({
    queryKey: ['/api/sms/conversations', jobSmsConversation?.id, 'messages'],
    enabled: !!jobSmsConversation?.id && selectedConversation?.type === 'job',
  });

  // Get the client for the selected job (fetch single client by ID)
  const { data: selectedJobClient, isError: clientFetchError } = useQuery<Client>({
    queryKey: ['/api/clients', 'single', selectedJob?.clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${selectedJob?.clientId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch client');
      return res.json();
    },
    enabled: !!selectedJob?.clientId && selectedConversation?.type === 'job',
    retry: 1,
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
      // Also invalidate job SMS messages if viewing a job
      if (jobSmsConversation) {
        queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', jobSmsConversation.id, 'messages'] });
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
      if (selectedSmsConversation?.id === deletedId) {
        setSelectedSmsConversation(null);
        setSelectedConversation(null);
        setMobileShowChat(false);
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
      .replace(/\{business_name\}/g, 'Our business');
  };

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const targetUserId = params.get('to');
    const targetType = params.get('type');
    const smsClientId = params.get('smsClientId');
    const smsPhone = params.get('phone');

    if (targetUserId && targetType === 'dm') {
      const member = teamMembers.find(m => m.userId === targetUserId);
      if (member) {
        const user: User = {
          id: member.userId,
          email: member.email,
          firstName: member.name.split(' ')[0],
          lastName: member.name.split(' ').slice(1).join(' '),
          profileImageUrl: member.profileImageUrl,
        };
        setSelectedDirectUser(user);
        setSelectedConversation({
          id: `dm-${member.userId}`,
          type: 'direct',
          title: member.name,
          avatar: member.profileImageUrl,
          avatarFallback: getInitials(member.name),
          unreadCount: 0,
          data: user,
        });
        setMobileShowChat(true);
      }
    }
    
    if (smsClientId || smsPhone) {
      const existingConvo = smsConversations.find(c => 
        (smsClientId && c.clientId === smsClientId) ||
        (smsPhone && c.clientPhone === smsPhone)
      );
      
      if (existingConvo) {
        setSelectedSmsConversation(existingConvo);
        setSelectedConversation({
          id: existingConvo.id,
          type: 'sms',
          title: existingConvo.clientName || existingConvo.clientPhone,
          subtitle: existingConvo.clientName ? existingConvo.clientPhone : undefined,
          avatarFallback: (existingConvo.clientName || existingConvo.clientPhone).slice(0, 2).toUpperCase(),
          unreadCount: existingConvo.unreadCount,
          data: existingConvo,
        });
        setMobileShowChat(true);
        markSmsReadMutation.mutate(existingConvo.id);
      } else if (smsPhone) {
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
        setSelectedConversation({
          id: 'new',
          type: 'sms',
          title: smsPhone,
          avatarFallback: smsPhone.slice(0, 2).toUpperCase(),
          unreadCount: 0,
          data: tempConvo,
        });
        setMobileShowChat(true);
      }
    }
  }, [searchString, teamMembers, smsConversations]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [teamMessages, directMessages, smsMessages]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email?.split('@')[0] || 'User';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'MMM d');
  };

  const buildConversationList = useCallback((): ConversationItem[] => {
    const items: ConversationItem[] = [];
    
    if (filter === 'all' || filter === 'team') {
      if (teamMessages.length > 0) {
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
      } else {
        items.push({
          id: 'team-chat',
          type: 'team',
          title: 'Team Chat',
          subtitle: `${teamMembers.filter(m => m.status === 'accepted').length + 1} members`,
          avatarFallback: 'TC',
          lastMessage: 'Start a conversation with your team',
          unreadCount: 0,
          data: null,
        });
      }
    }
    
    if ((filter === 'all' || filter === 'team') && showDirectFilter) {
      dmConversations.forEach(dm => {
        const displayName = getUserDisplayName(dm.otherUser);
        items.push({
          id: `dm-${dm.otherUser.id}`,
          type: 'direct',
          title: displayName,
          avatar: dm.otherUser.profileImageUrl,
          avatarFallback: getInitials(displayName),
          lastMessage: dm.lastMessage?.content,
          lastMessageTime: dm.lastMessage?.createdAt,
          unreadCount: dm.unreadCount,
          isOnline: true,
          data: dm.otherUser,
        });
      });
    }
    
    if (filter === 'all' || filter === 'customers') {
      smsConversations.forEach(sms => {
        items.push({
          id: sms.id,
          type: 'sms',
          title: sms.clientName || sms.clientPhone,
          subtitle: sms.clientName ? sms.clientPhone : undefined,
          avatarFallback: (sms.clientName || sms.clientPhone).slice(0, 2).toUpperCase(),
          lastMessageTime: sms.lastMessageAt || undefined,
          unreadCount: sms.unreadCount,
          data: sms,
        });
      });
    }
    
    if (filter === 'all' || filter === 'jobs') {
      jobs.slice(0, 10).forEach(job => {
        items.push({
          id: `job-${job.id}`,
          type: 'job',
          title: job.title,
          subtitle: job.address?.split(',')[0],
          avatarFallback: job.title.slice(0, 2).toUpperCase(),
          status: job.status,
          unreadCount: 0,
          data: job,
        });
      });
    }
    
    items.sort((a, b) => {
      if (a.type === 'team' && b.type !== 'team') return -1;
      if (b.type === 'team' && a.type !== 'team') return 1;
      
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      
      const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return bTime - aTime;
    });
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      return items.filter(item => 
        item.title.toLowerCase().includes(search) ||
        item.subtitle?.toLowerCase().includes(search) ||
        item.lastMessage?.toLowerCase().includes(search)
      );
    }
    
    return items;
  }, [filter, teamMessages, dmConversations, smsConversations, jobs, teamMembers, unreadCounts, showDirectFilter, searchTerm]);

  const handleConversationClick = (item: ConversationItem) => {
    setSelectedConversation(item);
    setMobileShowChat(true);
    
    if (item.type === 'team') {
      setSelectedDirectUser(null);
      setSelectedSmsConversation(null);
      setSelectedJob(null);
    } else if (item.type === 'direct') {
      setSelectedDirectUser(item.data);
      setSelectedSmsConversation(null);
      setSelectedJob(null);
    } else if (item.type === 'sms') {
      setSelectedSmsConversation(item.data);
      setSelectedDirectUser(null);
      setSelectedJob(null);
      if (item.data.id !== 'new') {
        markSmsReadMutation.mutate(item.data.id);
      }
    } else if (item.type === 'job') {
      setSelectedJob(item.data);
      setSelectedDirectUser(null);
      setSelectedSmsConversation(null);
    }
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setSelectedDirectUser(null);
    setSelectedSmsConversation(null);
    setSelectedJob(null);
    setMobileShowChat(false);
    setShowContextPanel(false);
  };

  const handleSendTeamMessage = (message: string) => {
    sendTeamMessageMutation.mutate(message);
  };

  const handleSendDirectMessage = () => {
    if (newMessage.trim()) {
      sendDirectMessageMutation.mutate(newMessage.trim());
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendDirectMessage();
    }
  };

  const handleSmsKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendSms();
    }
  };

  const formatAustralianPhone = (input: string): string => {
    const cleaned = input.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+614')) {
      const digits = cleaned.slice(3);
      if (digits.length <= 3) return `+61 ${digits}`;
      if (digits.length <= 6) return `+61 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }
    
    if (cleaned.startsWith('04')) {
      if (cleaned.length <= 4) return cleaned;
      if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)}`;
    }
    
    return input;
  };

  const normalizePhoneForApi = (phone: string): string => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('04') && cleaned.length === 10) {
      return '+61' + cleaned.slice(1);
    }
    return cleaned;
  };

  const validateAustralianPhone = (phone: string): string | null => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('+61')) {
      const digits = cleaned.slice(3);
      if (digits.length !== 9) {
        return 'Australian mobile numbers should have 9 digits after +61 (e.g., +61 412 345 678)';
      }
      if (!digits.startsWith('4')) {
        return 'Australian mobile numbers should start with 4 after +61';
      }
      return null;
    }
    
    if (cleaned.startsWith('04')) {
      if (cleaned.length !== 10) {
        return 'Australian mobile numbers should be 10 digits (e.g., 0412 345 678)';
      }
      return null;
    }
    
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

  const filteredClients = useMemo(() => {
    if (!newSmsClientSearch.trim()) return [];
    const search = newSmsClientSearch.toLowerCase();
    return allClients
      .filter(c => 
        (c.name?.toLowerCase().includes(search) || 
         c.phone?.toLowerCase().includes(search) ||
         c.email?.toLowerCase().includes(search)) &&
        c.phone
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
    
    const existingConvo = smsConversations.find(c => 
      (clientId && c.clientId === clientId) || 
      c.clientPhone === phone
    );
    
    if (existingConvo) {
      setSelectedSmsConversation(existingConvo);
      setSelectedConversation({
        id: existingConvo.id,
        type: 'sms',
        title: existingConvo.clientName || existingConvo.clientPhone,
        avatarFallback: (existingConvo.clientName || existingConvo.clientPhone).slice(0, 2).toUpperCase(),
        unreadCount: existingConvo.unreadCount,
        data: existingConvo,
      });
      setMobileShowChat(true);
      markSmsReadMutation.mutate(existingConvo.id);
      
      if (newSmsInitialMessage.trim()) {
        sendSmsMutation.mutate({
          clientId: existingConvo.clientId || undefined,
          clientPhone: existingConvo.clientPhone,
          message: newSmsInitialMessage.trim(),
        });
      }
    } else {
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
      setSelectedConversation({
        id: 'new',
        type: 'sms',
        title: clientName || phone,
        avatarFallback: (clientName || phone).slice(0, 2).toUpperCase(),
        unreadCount: 0,
        data: tempConvo,
      });
      setMobileShowChat(true);
      
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

  const smsUnreadCount = smsConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const pinnedMessages = teamMessages.filter(m => m.isPinned);
  const conversationList = buildConversationList();
  const isLoading = teamLoading || (showDirectFilter && dmLoading) || jobsLoading || smsLoading;

  const renderConversationList = () => (
    <div className="flex flex-col h-full border-r bg-background" data-testid="conversation-list">
      <div className="shrink-0 p-4 pb-3 border-b">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold">Job Communications</h1>
            <p className="text-xs text-muted-foreground">SMS, team & job discussions</p>
          </div>
          <Button
            onClick={() => setNewSmsDialogOpen(true)}
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-700"
            data-testid="button-new-sms"
          >
            <Plus className="h-4 w-4" />
            New SMS
          </Button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search"
          />
        </div>

        <div className="flex gap-1.5">
          {(['all', 'team', 'customers', 'jobs'] as FilterType[]).map((f) => {
            const count = f === 'all' 
              ? unreadCounts.teamChat + unreadCounts.directMessages + smsUnreadCount
              : f === 'team' 
              ? unreadCounts.teamChat + unreadCounts.directMessages
              : f === 'customers'
              ? smsUnreadCount
              : 0;
            
            return (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter(f)}
                className="h-7 text-xs capitalize"
                data-testid={`filter-${f}`}
              >
                {f}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      <OfflineBanner isConnected={smsSocketConnected} />
      {filter === 'customers' && !twilioConnected && <TwilioWarning />}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <ConversationSkeleton />
        ) : conversationList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-sm mb-1">No conversations</h3>
            <p className="text-xs text-muted-foreground text-center max-w-[200px]">
              {filter === 'customers' 
                ? 'Customer SMS conversations will appear here'
                : filter === 'jobs'
                ? 'Job chat threads will appear here'
                : 'Your messages will appear here'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {conversationList.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                  selectedConversation?.id === item.id 
                    ? 'bg-accent' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleConversationClick(item)}
                data-testid={`conversation-${item.id}`}
              >
                <div className="relative shrink-0">
                  {item.type === 'team' ? (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  ) : item.type === 'job' ? (
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: (STATUS_COLORS[item.status || 'pending'] || '#6B7280') + '20' }}
                    >
                      <Briefcase className="h-5 w-5" style={{ color: STATUS_COLORS[item.status || 'pending'] || '#6B7280' }} />
                    </div>
                  ) : item.type === 'sms' ? (
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-green-600" />
                    </div>
                  ) : (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.avatar || undefined} />
                      <AvatarFallback className="text-xs">{item.avatarFallback}</AvatarFallback>
                    </Avatar>
                  )}
                  {item.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-sm truncate">{item.title}</span>
                      <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${getTypeColor(item.type)}`}>
                        {getTypeIcon(item.type)}
                      </div>
                    </div>
                    {item.lastMessageTime && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(item.lastMessageTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {item.lastMessage || item.subtitle || 'No messages yet'}
                    </p>
                    {item.unreadCount > 0 && (
                      <Badge className="shrink-0 h-4 min-w-4 px-1 text-[10px] bg-primary">
                        {item.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderChatView = () => {
    if (!selectedConversation) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/30" data-testid="empty-chat-view">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Select a conversation</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Choose a conversation from the list to start messaging
          </p>
        </div>
      );
    }

    if (selectedConversation.type === 'team') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden" data-testid="team-chat-view">
          <div className="shrink-0 p-3 border-b bg-background flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm">Team Chat</h2>
              <p className="text-xs text-muted-foreground">
                {teamMembers.filter(m => m.status === 'accepted').length + 1} members
              </p>
            </div>
            {pinnedMessages.length > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Pin className="h-3 w-3" />
                {pinnedMessages.length}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowContextPanel(!showContextPanel)}
              data-testid="button-toggle-context"
            >
              {showContextPanel ? <PanelRightClose className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4 py-2" ref={scrollRef}>
            {teamMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Users className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-sm mb-1">Team chat's quiet</h3>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Share updates, coordinate jobs, or check in with your crew
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
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="shrink-0 p-3 border-t bg-background">
            <ChatComposer
              onSend={handleSendTeamMessage}
              placeholder="Message your team..."
              disabled={sendTeamMessageMutation.isPending}
            />
          </div>
        </div>
      );
    }

    if (selectedConversation.type === 'direct' && selectedDirectUser) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden" data-testid="direct-chat-view">
          <div className="shrink-0 p-3 border-b bg-background flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="relative">
              <Avatar className="h-9 w-9">
                <AvatarImage src={selectedDirectUser.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">{getInitials(getUserDisplayName(selectedDirectUser))}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate">{getUserDisplayName(selectedDirectUser)}</h2>
              <p className="text-xs text-muted-foreground truncate">{selectedDirectUser.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowContextPanel(!showContextPanel)}
              data-testid="button-toggle-context"
            >
              {showContextPanel ? <PanelRightClose className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4 py-2">
            {directMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <MessageCircle className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-sm mb-1">Start chatting</h3>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Message {getUserDisplayName(selectedDirectUser)} directly
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {directMessages.map((msg) => {
                  const isOwn = msg.senderId !== selectedDirectUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : ''}`}>
                          <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatTime(msg.createdAt)}
                          </span>
                          {isOwn && (msg.isRead ? <CheckCheck className="h-3 w-3 text-primary-foreground/70" /> : <Check className="h-3 w-3 text-primary-foreground/70" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="shrink-0 p-3 border-t bg-background">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
                data-testid="input-message"
              />
              <Button onClick={handleSendDirectMessage} disabled={!newMessage.trim() || sendDirectMessageMutation.isPending} size="icon" data-testid="button-send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (selectedConversation.type === 'sms' && selectedSmsConversation) {
      const linkedJob = selectedSmsConversation.jobId ? jobs.find(j => j.id === selectedSmsConversation.jobId) : null;
      
      return (
        <div className="flex-1 flex flex-col overflow-hidden" data-testid="sms-chat-view">
          <div className="shrink-0 p-3 border-b bg-background flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBack} data-testid="button-back-sms">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate">
                {selectedSmsConversation.clientName || selectedSmsConversation.clientPhone}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {selectedSmsConversation.clientName ? selectedSmsConversation.clientPhone : 'SMS'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {linkedJob && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setLocation(`/jobs/${linkedJob.id}`)} data-testid="button-view-linked-job">
                  <Briefcase className="h-3 w-3" />
                  View Job
                </Button>
              )}
              <a href={`tel:${selectedSmsConversation.clientPhone}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-call">
                  <Phone className="h-4 w-4" />
                </Button>
              </a>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowContextPanel(!showContextPanel)} data-testid="button-toggle-context">
                {showContextPanel ? <PanelRightClose className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <OfflineBanner isConnected={smsSocketConnected} />
          {!twilioConnected && <TwilioWarning />}

          {isUnknownClient && selectedSmsConversation.id !== 'new' && (
            <div className="shrink-0 mx-3 mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Unknown contact</span>
                </div>
                <Button size="sm" className="h-6 text-xs gap-1" onClick={handleOpenCreateClientDialog} data-testid="button-create-client-from-sms">
                  <Plus className="h-3 w-3" />
                  Add Client
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 px-4 py-2">
            {smsMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Phone className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-sm mb-1">No messages yet</h3>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Send a text to {selectedSmsConversation.clientName || 'this customer'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {smsMessages.map((msg) => {
                  const isOwn = msg.direction === 'outbound';
                  const isJobRequest = msg.isJobRequest && msg.direction === 'inbound';
                  const jobAlreadyCreated = !!msg.jobCreatedFromSms;
                  
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] space-y-1.5">
                        {isJobRequest && (
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[10px] h-5">
                              <Briefcase className="h-2.5 w-2.5 mr-0.5" />
                              {msg.intentType?.replace('_', ' ') || 'Request'}
                            </Badge>
                            {jobAlreadyCreated && (
                              <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400 text-[10px] h-5">
                                <Check className="h-2.5 w-2.5 mr-0.5" />
                                Job Created
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        <div className={`rounded-2xl px-3.5 py-2 ${isOwn ? 'bg-green-600 text-white' : 'bg-muted'}`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : ''}`}>
                            <span className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
                              {formatTime(msg.createdAt)}
                            </span>
                            {isOwn && msg.status === 'delivered' && <CheckCheck className="h-3 w-3 text-white/70" />}
                            {isOwn && msg.status === 'sent' && <Check className="h-3 w-3 text-white/70" />}
                          </div>
                        </div>
                        
                        {isJobRequest && !jobAlreadyCreated && (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={createJobFromSmsMutation.isPending}
                            onClick={() => createJobFromSmsMutation.mutate(msg.id)}
                            data-testid={`button-create-job-${msg.id}`}
                          >
                            {createJobFromSmsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Briefcase className="h-3 w-3" />}
                            Create Job
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="shrink-0 px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar border-t">
            {QUICK_REPLY_TEMPLATES.slice(0, 4).map((template) => (
              <Button
                key={template.id}
                variant="secondary"
                size="sm"
                className="shrink-0 text-[11px] h-7"
                onClick={() => setSmsNewMessage(template.message)}
                data-testid={`quick-reply-${template.id}`}
              >
                {template.label}
              </Button>
            ))}
          </div>

          <div className="shrink-0 p-3 border-t bg-background">
            <div className="flex gap-2">
              <Input
                placeholder="Type an SMS..."
                value={smsNewMessage}
                onChange={(e) => setSmsNewMessage(e.target.value)}
                onKeyPress={handleSmsKeyPress}
                className="flex-1"
                data-testid="input-sms-message"
              />
              <Button onClick={handleSendSms} disabled={!smsNewMessage.trim() || sendSmsMutation.isPending} size="icon" className="bg-green-600 hover:bg-green-700" data-testid="button-send-sms">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (selectedConversation.type === 'job' && selectedJob) {
      // Derive client info with fallbacks, accounting for fetch errors
      const clientName = !clientFetchError 
        ? (selectedJobClient?.name || jobSmsConversation?.clientName || 'Client')
        : (jobSmsConversation?.clientName || 'Client');
      const clientPhone = !clientFetchError 
        ? (selectedJobClient?.phone || jobSmsConversation?.clientPhone)
        : jobSmsConversation?.clientPhone;
      const hasClientConversation = !!jobSmsConversation || !!clientPhone;

      // Handler to send SMS from job context
      const handleSendJobSms = () => {
        if (!smsNewMessage.trim() || !clientPhone) return;
        sendSmsMutation.mutate({
          clientId: selectedJob.clientId,
          clientPhone: clientPhone,
          message: smsNewMessage.trim(),
        });
      };

      return (
        <div className="flex-1 flex flex-col overflow-hidden" data-testid="job-chat-view">
          <div className="shrink-0 p-3 border-b bg-background flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div 
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: (STATUS_COLORS[selectedJob.status] || '#6B7280') + '20' }}
            >
              <Briefcase className="h-5 w-5" style={{ color: STATUS_COLORS[selectedJob.status] || '#6B7280' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate">{selectedJob.title}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5" style={{ backgroundColor: (STATUS_COLORS[selectedJob.status] || '#6B7280') + '20', color: STATUS_COLORS[selectedJob.status] || '#6B7280' }}>
                  {STATUS_LABELS[selectedJob.status] || 'Unknown'}
                </Badge>
                {clientName && (
                  <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <User className="h-3 w-3" /> {clientName}
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setLocation(`/jobs/${selectedJob.id}`)} data-testid="button-view-job">
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowContextPanel(!showContextPanel)} data-testid="button-toggle-context">
              {showContextPanel ? <PanelRightClose className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </Button>
          </div>

          {/* Internal Team Note Banner */}
          <div className="shrink-0 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-medium">Team Only</span>
              <span className="text-amber-600 dark:text-amber-400">- Client cannot see this conversation history</span>
            </div>
          </div>

          {hasClientConversation && jobSmsMessages.length > 0 ? (
            <>
              {/* SMS Messages Thread */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {jobSmsMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.direction === 'outbound' 
                          ? 'bg-green-600 text-white rounded-br-md' 
                          : 'bg-muted rounded-bl-md'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        <div className={`flex items-center gap-1 mt-1 text-[10px] ${
                          msg.direction === 'outbound' ? 'text-green-100' : 'text-muted-foreground'
                        }`}>
                          <span>{format(new Date(msg.createdAt), 'h:mm a')}</span>
                          {msg.direction === 'outbound' && (
                            msg.status === 'delivered' ? (
                              <CheckCheck className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* SMS Input for Job */}
              {twilioConnected && clientPhone ? (
                <div className="shrink-0 p-3 border-t bg-background">
                  <div className="flex gap-2">
                    <Input
                      placeholder={`SMS to ${clientName}...`}
                      value={smsNewMessage}
                      onChange={(e) => setSmsNewMessage(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendJobSms(); } }}
                      className="flex-1"
                      data-testid="input-job-sms-message"
                    />
                    <Button onClick={handleSendJobSms} disabled={!smsNewMessage.trim() || sendSmsMutation.isPending} size="icon" className="bg-green-600 hover:bg-green-700" data-testid="button-send-job-sms">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : !twilioConnected && clientPhone ? (
                <div className="shrink-0 p-3 border-t bg-background">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => {
                      const message = `Hi! Update on ${selectedJob.title} - `;
                      window.open(`sms:${clientPhone}?body=${encodeURIComponent(message)}`, '_blank');
                    }}
                    data-testid="button-manual-sms"
                  >
                    <Phone className="h-4 w-4" />
                    Open SMS App to Text {clientName}
                  </Button>
                </div>
              ) : null}
            </>
          ) : hasClientConversation && clientPhone ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                <MessageCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-medium text-sm mb-1">Start Conversation</h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                No messages yet with {clientName}. Send an SMS to start the conversation.
              </p>
              {twilioConnected ? (
                <div className="flex gap-2 w-full max-w-xs px-4">
                  <Input
                    placeholder={`Message to ${clientName}...`}
                    value={smsNewMessage}
                    onChange={(e) => setSmsNewMessage(e.target.value)}
                    className="flex-1"
                    data-testid="input-job-first-sms"
                  />
                  <Button onClick={handleSendJobSms} disabled={!smsNewMessage.trim() || sendSmsMutation.isPending} size="icon" className="bg-green-600 hover:bg-green-700">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline"
                  onClick={() => {
                    const message = `Hi! Just wanted to touch base about ${selectedJob.title}.`;
                    window.open(`sms:${clientPhone}?body=${encodeURIComponent(message)}`, '_blank');
                  }}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Open SMS App
                </Button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Briefcase className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-sm mb-1">No Client Linked</h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                This job doesn't have a client with a phone number. Add a client to enable SMS communication.
              </p>
              <Button variant="outline" size="sm" onClick={() => setLocation(`/jobs/${selectedJob.id}`)} data-testid="button-view-job-details">
                View Job Details
              </Button>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const renderContextPanel = () => {
    if (!selectedConversation) return null;

    if (selectedConversation.type === 'team') {
      return (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Team Info</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowContextPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            {pinnedMessages.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Pin className="h-3 w-3" />
                  Pinned Messages
                </h4>
                <div className="space-y-2">
                  {pinnedMessages.slice(0, 3).map((msg) => (
                    <div key={msg.id} className="p-2 rounded-lg bg-muted/50 text-xs">
                      <p className="font-medium mb-0.5">{msg.senderName}</p>
                      <p className="text-muted-foreground line-clamp-2">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Members ({teamMembers.filter(m => m.status === 'accepted').length + 1})
              </h4>
              <div className="space-y-2">
                {teamMembers.filter(m => m.status === 'accepted').map((member) => {
                  const handleStartDM = () => {
                    const user: User = {
                      id: member.userId,
                      email: member.email,
                      firstName: member.name.split(' ')[0],
                      lastName: member.name.split(' ').slice(1).join(' '),
                      profileImageUrl: member.profileImageUrl,
                    };
                    const dmConversation: ConversationItem = {
                      id: `dm-${member.userId}`,
                      type: 'direct',
                      title: member.name,
                      avatar: member.profileImageUrl,
                      avatarFallback: getInitials(member.name),
                      unreadCount: 0,
                      data: user,
                    };
                    setSelectedConversation(dmConversation);
                    setSelectedDirectUser(user);
                    setSelectedSmsConversation(null);
                    setSelectedJob(null);
                    setMobileShowChat(true);
                    setShowContextPanel(false);
                  };
                  
                  return (
                    <div 
                      key={member.id} 
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                      onClick={handleStartDM}
                      data-testid={`team-member-${member.userId}`}
                    >
                      <div className="relative">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={member.profileImageUrl || undefined} />
                          <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{member.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{member.role}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleStartDM(); }}
                        data-testid={`dm-button-${member.userId}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (selectedConversation.type === 'sms' && selectedSmsConversation) {
      return (
        <ClientInsightsPanel
          clientId={selectedSmsConversation.clientId}
          clientPhone={selectedSmsConversation.clientPhone}
          conversationId={selectedSmsConversation.id}
          onClose={() => setShowContextPanel(false)}
          onNavigateToJob={(jobId) => { setShowContextPanel(false); setLocation(`/jobs/${jobId}`); }}
          onNavigateToInvoice={(invoiceId) => { setShowContextPanel(false); setLocation(`/invoices/${invoiceId}`); }}
          onCreateJob={() => { setShowContextPanel(false); setLocation('/jobs/new?clientId=' + selectedSmsConversation.clientId); }}
          onCreateQuote={() => { setShowContextPanel(false); setLocation('/quotes/new?clientId=' + selectedSmsConversation.clientId); }}
        />
      );
    }

    if (selectedConversation.type === 'job' && selectedJob) {
      return (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Job Details</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowContextPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Status</h4>
                <Badge style={{ backgroundColor: (STATUS_COLORS[selectedJob.status] || '#6B7280') + '20', color: STATUS_COLORS[selectedJob.status] || '#6B7280' }}>
                  {STATUS_LABELS[selectedJob.status] || 'Unknown'}
                </Badge>
              </div>
              
              {selectedJob.address && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Address
                  </h4>
                  <p className="text-sm">{selectedJob.address}</p>
                </div>
              )}
              
              {selectedJob.scheduledAt && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Scheduled
                  </h4>
                  <p className="text-sm">{format(new Date(selectedJob.scheduledAt), 'PPP p')}</p>
                </div>
              )}
              
              <Button className="w-full" variant="outline" onClick={() => setLocation(`/jobs/${selectedJob.id}`)}>
                View Full Details
              </Button>
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (selectedConversation.type === 'direct' && selectedDirectUser) {
      return (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Contact Info</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowContextPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="p-4">
            <div className="flex flex-col items-center mb-4">
              <Avatar className="h-16 w-16 mb-2">
                <AvatarImage src={selectedDirectUser.profileImageUrl || undefined} />
                <AvatarFallback>{getInitials(getUserDisplayName(selectedDirectUser))}</AvatarFallback>
              </Avatar>
              <h4 className="font-medium">{getUserDisplayName(selectedDirectUser)}</h4>
              <p className="text-sm text-muted-foreground">{selectedDirectUser.email}</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex h-full overflow-hidden" data-testid="chat-hub">
      <div className={`w-full md:w-80 shrink-0 ${mobileShowChat ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        {renderConversationList()}
      </div>

      <div className={`flex-1 flex flex-col min-w-0 ${!mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        {renderChatView()}
      </div>

      {showContextPanel && selectedConversation && (
        <div className="hidden lg:flex w-80 shrink-0 border-l bg-background flex-col" data-testid="context-panel">
          {renderContextPanel()}
        </div>
      )}

      <Sheet open={showContextPanel && !!selectedConversation} onOpenChange={setShowContextPanel}>
        <SheetContent side="right" className="w-[85vw] sm:w-[400px] p-0 lg:hidden" hideClose>
          {renderContextPanel()}
        </SheetContent>
      </Sheet>

      <Dialog open={newSmsDialogOpen} onOpenChange={(open) => {
        setNewSmsDialogOpen(open);
        if (!open) resetNewSmsDialog();
      }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-new-sms">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              New SMS
            </DialogTitle>
            <DialogDescription>
              Search for a client or enter a phone number
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {newSmsSelectedClient && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{newSmsSelectedClient.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{newSmsSelectedClient.phone}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setNewSmsSelectedClient(null); setNewSmsClientSearch(''); }} data-testid="button-clear-selected-client">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

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

                  {filteredClients.length > 0 && (
                    <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                      {filteredClients.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                          onClick={() => { setNewSmsSelectedClient(client); setNewSmsClientSearch(''); setNewSmsPhoneNumber(''); }}
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
                    placeholder="0412 345 678"
                    value={newSmsPhoneNumber}
                    onChange={handlePhoneInputChange}
                    className={newSmsPhoneError ? 'border-destructive' : ''}
                    data-testid="input-phone-number"
                  />
                  {newSmsPhoneError && <p className="text-xs text-destructive">{newSmsPhoneError}</p>}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="initial-message">Message (optional)</Label>
              <Input
                id="initial-message"
                placeholder="Type your first message..."
                value={newSmsInitialMessage}
                onChange={(e) => setNewSmsInitialMessage(e.target.value)}
                data-testid="input-initial-message"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSmsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartNewSms} disabled={!newSmsSelectedClient && !newSmsPhoneNumber} className="bg-green-600 hover:bg-green-700" data-testid="button-start-sms">
              Start Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createClientDialogOpen} onOpenChange={setCreateClientDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-client">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Add this phone number as a new client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-client-name">Name *</Label>
              <Input id="new-client-name" placeholder="Client name" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} data-testid="input-new-client-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-phone">Phone</Label>
              <Input id="new-client-phone" value={newClientPhone} disabled className="bg-muted" data-testid="input-new-client-phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-email">Email</Label>
              <Input id="new-client-email" type="email" placeholder="email@example.com" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} data-testid="input-new-client-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-address">Address</Label>
              <Input id="new-client-address" placeholder="123 Main St" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} data-testid="input-new-client-address" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateClientDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClientSubmit} disabled={!newClientName.trim() || createClientFromSmsMutation.isPending} data-testid="button-create-client-submit">
              {createClientFromSmsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!smsToDelete} onOpenChange={(open) => !open && setSmsToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-sms">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this SMS conversation with {smsToDelete?.clientName || smsToDelete?.clientPhone}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => smsToDelete && deleteSmsConversationMutation.mutate(smsToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSmsConversationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

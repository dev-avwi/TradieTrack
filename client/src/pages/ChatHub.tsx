import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatComposer } from "@/components/ChatComposer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";
import { useSmsSocket } from "@/hooks/use-sms-socket";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";

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
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations', selectedSmsConversation?.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create job",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

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

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2">
          {teamMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-base mb-1">No messages yet</h3>
              <p className="text-sm text-muted-foreground text-center">
                Start a conversation with your team
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {teamMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  currentUserId={currentUser?.id || ''}
                  onPin={isOwner || isManager ? () => pinMessageMutation.mutate({ messageId: msg.id, pinned: !msg.isPinned }) : undefined}
                  onDelete={msg.senderId === currentUser?.id || isOwner ? () => deleteMessageMutation.mutate(msg.id) : undefined}
                  showPinned={msg.isPinned}
                  showAnnouncement={msg.isAnnouncement}
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

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {directMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Start the conversation!</p>
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
      <div className="flex flex-col h-full overflow-hidden">
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
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {smsMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Send your first SMS!</p>
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
                          <Button
                            size="sm"
                            variant={jobAlreadyCreated ? "outline" : "default"}
                            disabled={jobAlreadyCreated || createJobFromSmsMutation.isPending}
                            onClick={() => createJobFromSmsMutation.mutate(msg.id)}
                            className="gap-1.5"
                            data-testid={`button-create-job-${msg.id}`}
                          >
                            {createJobFromSmsMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : jobAlreadyCreated ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Briefcase className="h-3.5 w-3.5" />
                            )}
                            {jobAlreadyCreated ? 'Job Created' : 'Create Job from SMS'}
                          </Button>
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
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Messages</h1>
            <p className="text-xs text-muted-foreground">
              Stay connected with your team
            </p>
          </div>
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

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : conversationList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-base mb-1">No conversations</h3>
            <p className="text-sm text-muted-foreground text-center">
              {filter === 'direct' 
                ? 'Start a conversation with a team member'
                : filter === 'jobs'
                ? 'Create a job to start chatting'
                : filter === 'sms'
                ? 'Send an SMS to a client to start chatting'
                : 'Your messages will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {conversationList.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-4 hover-elevate cursor-pointer"
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
                    {item.lastMessageTime && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(item.lastMessageTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-sm text-muted-foreground truncate">
                      {item.lastMessage || item.subtitle || 'No messages yet'}
                    </p>
                    {item.unreadCount > 0 && (
                      <Badge className="shrink-0 h-5 min-w-5 px-1.5 bg-destructive text-destructive-foreground">
                        {item.unreadCount}
                      </Badge>
                    )}
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
    </div>
  );
}

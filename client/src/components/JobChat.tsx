import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChatMessage } from "./ChatMessage";
import { ChatComposer } from "./ChatComposer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Loader2, Users, Eye, User, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface JobChatMessage {
  id: string;
  jobId: string;
  userId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isSystemMessage?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  avatar?: string | null;
}

interface ClientInfo {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface JobChatParticipants {
  participants: Participant[];
  jobTitle: string;
  participantCount: number;
  client?: ClientInfo | null;
}

interface JobChatProps {
  jobId: string;
  currentUserId: string;
  className?: string;
}

export function JobChat({ jobId, currentUserId, className }: JobChatProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);

  const { data: messages = [], isLoading } = useQuery<JobChatMessage[]>({
    queryKey: ['/api/jobs', jobId, 'chat'],
    refetchInterval: 5000,
  });

  // Job chat participants - who can see these messages
  const { data: participantsData } = useQuery<JobChatParticipants>({
    queryKey: ['/api/jobs', jobId, 'chat', 'participants'],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', `/api/jobs/${jobId}/chat`, {
        message,
        messageType: 'text',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'chat'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest('DELETE', `/api/jobs/${jobId}/chat/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'chat'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      const latestMessageId = messages[messages.length - 1]?.id;
      if (latestMessageId !== lastMessageRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        lastMessageRef.current = latestMessageId;
      }
    }
  }, [messages]);

  const handleSend = (message: string) => {
    sendMessageMutation.mutate(message);
  };

  const handleDelete = (messageId: string) => {
    deleteMessageMutation.mutate(messageId);
  };

  return (
    <Card className={className} data-testid="job-chat-container">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Job Discussion</CardTitle>
        </div>
        <Badge variant="secondary" className="text-xs">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </Badge>
      </CardHeader>
      
      {/* Client Banner - Who this job is for */}
      {participantsData?.client && (
        <div className="mx-4 mb-3 px-3 py-2.5 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-100 dark:border-green-900/50">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                Client for this job:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-green-700 dark:text-green-200">
                  {participantsData.client.name}
                </span>
                {participantsData.client.phone && (
                  <a 
                    href={`tel:${participantsData.client.phone}`}
                    className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                    data-testid="client-phone-link"
                  >
                    <Phone className="h-3 w-3" />
                    {participantsData.client.phone}
                  </a>
                )}
                {participantsData.client.email && (
                  <a 
                    href={`mailto:${participantsData.client.email}`}
                    className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                    data-testid="client-email-link"
                  >
                    <Mail className="h-3 w-3" />
                    {participantsData.client.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Participants Banner - Who can see these messages */}
      {participantsData && participantsData.participants.length > 0 && (
        <div className="mx-4 mb-3 px-3 py-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50">
          <div className="flex items-start gap-2">
            <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1.5">
                Who can see these messages:
              </p>
              <div className="flex flex-wrap gap-2">
                {participantsData.participants.map((p) => (
                  <div 
                    key={p.id} 
                    className="inline-flex items-center gap-1.5 bg-white dark:bg-blue-900/50 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-800"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={p.avatar || undefined} />
                      <AvatarFallback className="text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                        {p.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                      {p.name.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-blue-500 dark:text-blue-400">
                      ({p.role})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <CardContent className="p-0">
        <div className="flex flex-col h-[400px]">
          <ScrollArea className="flex-1 px-4" ref={scrollRef}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Start the conversation about this job</p>
              </div>
            ) : (
              <div className="py-4 space-y-1 group">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    id={msg.id}
                    message={msg.message}
                    messageType={msg.messageType}
                    senderName={msg.senderName}
                    senderAvatar={msg.senderAvatar}
                    isCurrentUser={msg.userId === currentUserId}
                    isSystemMessage={msg.isSystemMessage}
                    attachmentUrl={msg.attachmentUrl}
                    attachmentName={msg.attachmentName}
                    createdAt={msg.createdAt}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
          
          <ChatComposer
            onSend={handleSend}
            placeholder="Message about this job..."
            isSending={sendMessageMutation.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}

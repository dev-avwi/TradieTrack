import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pin, Trash2, AlertCircle, Image as ImageIcon, FileText, Info } from "lucide-react";

interface ChatMessageProps {
  id: string;
  message: string;
  messageType?: string;
  senderName: string;
  senderAvatar?: string | null;
  isCurrentUser: boolean;
  isSystemMessage?: boolean;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  createdAt: string | Date;
  onDelete?: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
  canPin?: boolean;
}

export function ChatMessage({
  id,
  message,
  messageType = 'text',
  senderName,
  senderAvatar,
  isCurrentUser,
  isSystemMessage,
  isAnnouncement,
  isPinned,
  attachmentUrl,
  attachmentName,
  createdAt,
  onDelete,
  onPin,
  canPin,
}: ChatMessageProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  if (isSystemMessage) {
    return (
      <div className="flex justify-center py-2" data-testid={`chat-message-system-${id}`}>
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full text-sm text-muted-foreground">
          <Info className="w-4 h-4" />
          <span>{message}</span>
          <span className="text-xs opacity-70">{timeAgo}</span>
        </div>
      </div>
    );
  }

  if (isAnnouncement) {
    return (
      <div className="py-2" data-testid={`chat-message-announcement-${id}`}>
        <div className="bg-primary/10 border-l-4 border-primary rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{senderName}</span>
                <Badge variant="secondary" className="text-xs">Announcement</Badge>
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>
              <p className="text-sm">{message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 py-2 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
      data-testid={`chat-message-${id}`}
    >
      <Avatar className="w-8 h-8 shrink-0">
        {senderAvatar && <AvatarImage src={senderAvatar} alt={senderName} />}
        <AvatarFallback className="text-xs">{getInitials(senderName)}</AvatarFallback>
      </Avatar>
      
      <div className={`flex flex-col max-w-[75%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground">{senderName}</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          {isPinned && <Pin className="w-3 h-3 text-primary" />}
        </div>
        
        <div
          className={`rounded-2xl px-4 py-2 ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted rounded-bl-md'
          }`}
        >
          {messageType === 'image' && attachmentUrl && (
            <div className="mb-2">
              <img
                src={attachmentUrl}
                alt={attachmentName || 'Attached image'}
                className="max-w-full rounded-lg max-h-48 object-cover"
              />
            </div>
          )}
          
          {messageType === 'file' && attachmentUrl && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mb-2 p-2 bg-background/20 rounded-lg hover:bg-background/30"
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm underline">{attachmentName || 'Download file'}</span>
            </a>
          )}
          
          <p className="text-sm whitespace-pre-wrap break-words">{message}</p>
        </div>
        
        {(isCurrentUser || canPin) && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canPin && onPin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onPin(id, !isPinned)}
                data-testid={`button-pin-${id}`}
              >
                <Pin className={`w-3 h-3 ${isPinned ? 'text-primary' : ''}`} />
              </Button>
            )}
            {isCurrentUser && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => onDelete(id)}
                data-testid={`button-delete-${id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

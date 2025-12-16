import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface ChatComposerProps {
  onSend: (message: string) => void;
  placeholder?: string;
  isSending?: boolean;
  disabled?: boolean;
}

export function ChatComposer({
  onSend,
  placeholder = "Type a message...",
  isSending = false,
  disabled = false,
}: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isSending && !disabled) {
      onSend(trimmedMessage);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t bg-background">
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSending}
        className="min-h-[44px] max-h-[120px] resize-none border-0 bg-muted focus-visible:ring-0 focus-visible:ring-offset-0 rounded-full px-4 py-3"
        rows={1}
        data-testid="input-chat-message"
      />
      <Button
        size="icon"
        onClick={handleSubmit}
        disabled={!message.trim() || isSending || disabled}
        className="h-11 w-11 rounded-full shrink-0"
        data-testid="button-send-message"
      >
        {isSending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </Button>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2, Lightbulb } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "How can I follow up with overdue invoices?",
  "Generate a weekly performance summary",
  "What jobs need my attention today?",
  "Draft a quote for a bathroom renovation",
  "Tips for improving my cash flow",
  "How do I track expenses efficiently?"
];

export default function AIAssistant() {
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);

  // Fetch AI suggestions
  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["/api/ai/suggestions"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const suggestions = (suggestionsData as any)?.suggestions || [];

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message })
      });
      
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data, message) => {
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: data.response }
      ]);
      setChatMessage("");
    }
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatMutation.isPending) return;
    chatMutation.mutate(chatMessage);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setChatMessage(suggestion);
  };

  return (
    <Card className="flex flex-col" data-testid="ai-assistant">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <div 
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ 
              backgroundColor: 'hsl(var(--trade) / 0.1)',
              border: '1px solid hsl(var(--trade) / 0.2)'
            }}
          >
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: 'hsl(var(--trade))' }} />
          </div>
          <span className="truncate">AI Assistant</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Get help with your business tasks
        </p>

        {/* Suggested Prompts - only show when no chat history */}
        {chatHistory.length === 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
            </div>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setChatMessage(prompt)}
                  className="w-full text-left p-2.5 sm:p-3 rounded-lg bg-muted hover-elevate active-elevate-2 text-xs sm:text-sm transition-all"
                  data-testid={`suggested-prompt-${index}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI-Generated Suggestions */}
        {suggestionsLoading ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Smart Suggestions:</p>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing your business...
            </div>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Smart Suggestions:</p>
            <div className="space-y-2">
              {suggestions.map((suggestion: string, index: number) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left p-2.5 sm:p-3 rounded-lg hover-elevate active-elevate-2 text-xs sm:text-sm transition-all"
                  style={{
                    backgroundColor: 'hsl(var(--trade) / 0.05)',
                    border: '1px solid hsl(var(--trade) / 0.15)'
                  }}
                  data-testid={`ai-suggestion-${index}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Chat History */}
        {chatHistory.length > 0 && (
          <div className="flex-1 space-y-2 sm:space-y-3 overflow-y-auto max-h-48 sm:max-h-64">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${
                  msg.role === 'user'
                    ? 'bg-muted ml-4 sm:ml-8'
                    : 'mr-4 sm:mr-8'
                }`}
                style={msg.role === 'assistant' ? {
                  backgroundColor: 'hsl(var(--trade) / 0.05)',
                  border: '1px solid hsl(var(--trade) / 0.1)'
                } : {}}
              >
                <p className="text-xs font-medium mb-1 text-muted-foreground">
                  {msg.role === 'user' ? 'You' : 'TradieTrack AI'}
                </p>
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="flex gap-2 mt-auto">
          <Input
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="Ask anything..."
            disabled={chatMutation.isPending}
            className="flex-1 text-sm"
            data-testid="input-ai-chat"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!chatMessage.trim() || chatMutation.isPending}
            style={{
              backgroundColor: 'hsl(var(--trade))',
              borderColor: 'hsl(var(--trade-border))',
              color: 'white'
            }}
            data-testid="button-send-ai-message"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

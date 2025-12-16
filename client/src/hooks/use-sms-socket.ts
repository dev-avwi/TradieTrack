import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface SmsNotification {
  conversationId: string;
  senderPhone: string;
  senderName: string | null;
  messagePreview: string;
  jobId?: string | null;
  unreadCount: number;
  timestamp: number;
}

interface UseSmsSocketOptions {
  businessId: string;
  enabled?: boolean;
  onSmsNotification?: (notification: SmsNotification) => void;
}

export function useSmsSocket({
  businessId,
  enabled = true,
  onSmsNotification,
}: UseSmsSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<SmsNotification | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (!enabled || !businessId) return;

    const origin = window.location.origin;
    const wsUrl = origin.replace(/^http/, 'ws') + `/ws/location?businessId=${businessId}&isTradie=false`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[SmsSocket] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'sms_notification') {
            const notification: SmsNotification = {
              conversationId: message.conversationId,
              senderPhone: message.senderPhone,
              senderName: message.senderName,
              messagePreview: message.messagePreview,
              jobId: message.jobId,
              unreadCount: message.unreadCount,
              timestamp: message.timestamp,
            };
            setLastNotification(notification);
            onSmsNotification?.(notification);
            
            queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
          }
        } catch (error) {
          console.error('[SmsSocket] Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[SmsSocket] Disconnected');
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < maxReconnectAttempts && enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`[SmsSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[SmsSocket] Error:', error);
      };
    } catch (error) {
      console.error('[SmsSocket] Failed to connect:', error);
    }
  }, [enabled, businessId, onSmsNotification, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastNotification,
    disconnect,
    reconnect: connect,
  };
}

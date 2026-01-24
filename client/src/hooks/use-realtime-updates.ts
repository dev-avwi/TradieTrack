import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvalidateQueries } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface JobStatusEvent {
  type: 'job_status_changed';
  jobId: string;
  status: string;
  title?: string;
  updatedBy?: string;
  timestamp: number;
}

interface TimerEvent {
  type: 'timer_event';
  jobId: string;
  userId: string;
  action: 'started' | 'stopped' | 'paused' | 'resumed';
  timeEntryId?: string;
  elapsedSeconds?: number;
  timestamp: number;
}

interface DocumentStatusEvent {
  type: 'document_status_changed';
  documentType: 'quote' | 'invoice';
  documentId: string;
  status: string;
  clientName?: string;
  amount?: number;
  timestamp: number;
}

interface PaymentReceivedEvent {
  type: 'payment_received';
  amount: number;
  invoiceNumber?: string;
  clientName?: string;
  paymentMethod?: string;
  timestamp: number;
}

interface SmsNotificationEvent {
  type: 'sms_notification';
  conversationId: string;
  senderPhone: string;
  senderName: string | null;
  messagePreview: string;
  jobId?: string | null;
  unreadCount: number;
  timestamp: number;
}

interface NotificationEvent {
  type: 'notification';
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  entityType?: string;
  entityId?: string;
  timestamp: number;
}

interface BusinessSettingsChangedEvent {
  type: 'business_settings_changed';
  updatedFields: string[];
  documentTemplate?: string;
  timestamp: number;
}

interface TemplateChangedEvent {
  type: 'template_changed';
  action: 'created' | 'updated' | 'deleted';
  templateId: string;
  templateType?: string;
  templateName?: string;
  timestamp: number;
}

interface FormChangedEvent {
  type: 'form_changed';
  action: 'created' | 'updated' | 'deleted';
  formId: string;
  formType?: string;
  formName?: string;
  timestamp: number;
}

type RealtimeEvent = 
  | JobStatusEvent 
  | TimerEvent 
  | DocumentStatusEvent 
  | PaymentReceivedEvent 
  | SmsNotificationEvent
  | NotificationEvent
  | BusinessSettingsChangedEvent
  | TemplateChangedEvent
  | FormChangedEvent;

interface UseRealtimeUpdatesOptions {
  businessId: string;
  enabled?: boolean;
  onJobStatusChange?: (event: JobStatusEvent) => void;
  onTimerEvent?: (event: TimerEvent) => void;
  onDocumentStatusChange?: (event: DocumentStatusEvent) => void;
  onPaymentReceived?: (event: PaymentReceivedEvent) => void;
  onSmsNotification?: (event: SmsNotificationEvent) => void;
  onNotification?: (event: NotificationEvent) => void;
}

export function useRealtimeUpdates({
  businessId,
  enabled = true,
  onJobStatusChange,
  onTimerEvent,
  onDocumentStatusChange,
  onPaymentReceived,
  onSmsNotification,
  onNotification,
}: UseRealtimeUpdatesOptions) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);

  // Use refs for callbacks to avoid reconnection on callback changes
  const callbacksRef = useRef({
    onJobStatusChange,
    onTimerEvent,
    onDocumentStatusChange,
    onPaymentReceived,
    onSmsNotification,
    onNotification,
  });

  useEffect(() => {
    callbacksRef.current = {
      onJobStatusChange,
      onTimerEvent,
      onDocumentStatusChange,
      onPaymentReceived,
      onSmsNotification,
      onNotification,
    };
  }, [onJobStatusChange, onTimerEvent, onDocumentStatusChange, onPaymentReceived, onSmsNotification, onNotification]);

  const handleMessage = useCallback((event: RealtimeEvent) => {
    const callbacks = callbacksRef.current;

    switch (event.type) {
      case 'job_status_changed':
        callbacks.onJobStatusChange?.(event);
        // Auto-invalidate job queries
        safeInvalidateQueries({ queryKey: ['/api/jobs'] });
        safeInvalidateQueries({ queryKey: ['/api/jobs', event.jobId] });
        safeInvalidateQueries({ queryKey: ['/api/dashboard'] });
        break;

      case 'timer_event':
        callbacks.onTimerEvent?.(event);
        // Auto-invalidate time entry queries
        safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
        safeInvalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
        if (event.jobId) {
          safeInvalidateQueries({ queryKey: ['/api/jobs', event.jobId] });
        }
        break;

      case 'document_status_changed':
        callbacks.onDocumentStatusChange?.(event);
        if (event.documentType === 'quote') {
          safeInvalidateQueries({ queryKey: ['/api/quotes'] });
          safeInvalidateQueries({ queryKey: ['/api/quotes', event.documentId] });
        } else {
          safeInvalidateQueries({ queryKey: ['/api/invoices'] });
          safeInvalidateQueries({ queryKey: ['/api/invoices', event.documentId] });
        }
        safeInvalidateQueries({ queryKey: ['/api/dashboard'] });
        break;

      case 'payment_received':
        callbacks.onPaymentReceived?.(event);
        // Show celebratory toast
        toast({
          title: "Payment Received!",
          description: `$${(event.amount / 100).toFixed(2)} from ${event.clientName || 'a client'}`,
        });
        safeInvalidateQueries({ queryKey: ['/api/invoices'] });
        safeInvalidateQueries({ queryKey: ['/api/payments'] });
        safeInvalidateQueries({ queryKey: ['/api/dashboard'] });
        break;

      case 'sms_notification':
        callbacks.onSmsNotification?.(event);
        safeInvalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
        safeInvalidateQueries({ queryKey: ['/api/sms/conversations'] });
        break;

      case 'notification':
        callbacks.onNotification?.(event);
        toast({
          title: event.title,
          description: event.message,
          variant: event.severity === 'error' ? 'destructive' : 'default',
        });
        safeInvalidateQueries({ queryKey: ['/api/notifications'] });
        break;

      case 'business_settings_changed':
        // Note: We intentionally do NOT invalidate the cache here.
        // The mutation that triggered the change already handles cache invalidation.
        // Invalidating here causes flickering on the same device due to race conditions
        // with React Query's stale state during refetch.
        // Cross-device sync will still work because TanStack Query has refetchOnWindowFocus.
        break;

      case 'template_changed':
        // Invalidate template queries for cross-device sync
        safeInvalidateQueries({ queryKey: ['/api/templates'] });
        safeInvalidateQueries({ queryKey: ['/api/style-presets'] });
        safeInvalidateQueries({ queryKey: ['/api/business-templates'] });
        break;

      case 'form_changed':
        // Invalidate form queries for cross-device sync
        safeInvalidateQueries({ queryKey: ['/api/custom-forms'] });
        break;
    }
  }, [toast]);

  const connect = useCallback(() => {
    if (!enabled || !businessId) return;
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;

    isConnectingRef.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/location?businessId=${businessId}&isTradie=false`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[RealtimeUpdates] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle all known event types
          if (message.type && [
            'job_status_changed',
            'timer_event',
            'document_status_changed',
            'payment_received',
            'sms_notification',
            'notification',
            'business_settings_changed',
            'template_changed',
            'form_changed'
          ].includes(message.type)) {
            handleMessage(message as RealtimeEvent);
          }
        } catch (error) {
          console.error('[RealtimeUpdates] Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        isConnectingRef.current = false;

        if (reconnectAttempts.current < maxReconnectAttempts && enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`[RealtimeUpdates] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        isConnectingRef.current = false;
      };
    } catch (error) {
      console.error('[RealtimeUpdates] Failed to connect:', error);
      isConnectingRef.current = false;
    }
  }, [enabled, businessId, handleMessage]);

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
    isConnectingRef.current = false;
    reconnectAttempts.current = maxReconnectAttempts;
  }, []);

  useEffect(() => {
    if (enabled && businessId) {
      reconnectAttempts.current = 0;
      connect();
    }
    return () => {
      disconnect();
    };
  }, [enabled, businessId, connect, disconnect]);

  return {
    isConnected,
    disconnect,
    reconnect: connect,
  };
}

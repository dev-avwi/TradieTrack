import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvalidateQueries, isRemoteChange } from '@/lib/queryClient';
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
        // Only invalidate if this is a change from another device
        // The isRemoteChange function checks if we recently made a local change
        // If we did, we already have the data and don't need to refetch
        if (isRemoteChange('/api/business-settings', event.timestamp)) {
          console.log('[RealtimeUpdates] Remote business settings change detected, syncing...');
          safeInvalidateQueries({ queryKey: ['/api/business-settings'] });
        }
        break;

      case 'template_changed':
        // Only invalidate if this is a change from another device
        if (isRemoteChange('/api/templates', event.timestamp)) {
          console.log('[RealtimeUpdates] Remote template change detected, syncing...');
          safeInvalidateQueries({ queryKey: ['/api/templates'] });
          safeInvalidateQueries({ queryKey: ['/api/business-settings'] });
        }
        break;

      case 'form_changed':
        // Only invalidate if this is a change from another device
        if (isRemoteChange('/api/forms', event.timestamp)) {
          console.log('[RealtimeUpdates] Remote form change detected, syncing...');
          safeInvalidateQueries({ queryKey: ['/api/custom-forms'] });
          safeInvalidateQueries({ queryKey: ['/api/safety-forms'] });
        }
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
        console.log('[RealtimeUpdates] Socket opened, waiting for auth...');
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle successful authentication - only now are we truly connected
          if (message.type === 'connected') {
            console.log('[RealtimeUpdates] Authenticated successfully');
            setIsConnected(true);
            reconnectAttempts.current = 0;
            return;
          }
          
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

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;
        isConnectingRef.current = false;

        // Don't reconnect if authentication failed (4001) or access denied (4003)
        // These are permanent failures that won't resolve with retries
        if (event.code === 4001 || event.code === 4003) {
          console.log(`[RealtimeUpdates] Authentication failed (${event.code}), not reconnecting`);
          return;
        }

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

import { useState, useEffect, useCallback, useRef } from 'react';

interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  activityStatus?: 'online' | 'driving' | 'working' | 'idle' | 'offline';
  timestamp: number;
}

interface UseLocationSocketOptions {
  userId: string;
  businessId: string;
  isTradie?: boolean;
  onLocationUpdate?: (update: LocationUpdate) => void;
  enabled?: boolean;
}

export function useLocationSocket({
  userId,
  businessId,
  isTradie = false,
  onLocationUpdate,
  enabled = true,
}: UseLocationSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<LocationUpdate | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || !userId || !businessId) return;

    // Use origin for correct URL in Replit environment (HTTPS proxied)
    // Note: userId is NOT passed in query - server derives identity from session cookie
    const origin = window.location.origin;
    const wsUrl = origin.replace(/^http/, 'ws') + `/ws/location?businessId=${businessId}&isTradie=${isTradie}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[LocationSocket] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'team_location_update') {
            const update: LocationUpdate = {
              userId: message.userId,
              latitude: message.latitude,
              longitude: message.longitude,
              speed: message.speed,
              heading: message.heading,
              batteryLevel: message.batteryLevel,
              isCharging: message.isCharging,
              activityStatus: message.activityStatus,
              timestamp: message.timestamp,
            };
            setLastUpdate(update);
            onLocationUpdate?.(update);
          }
        } catch (error) {
          console.error('[LocationSocket] Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[LocationSocket] Disconnected');
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < maxReconnectAttempts && enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`[LocationSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[LocationSocket] Error:', error);
      };
    } catch (error) {
      console.error('[LocationSocket] Failed to connect:', error);
    }
  }, [enabled, userId, businessId, isTradie, onLocationUpdate]);

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

  const sendLocationUpdate = useCallback((location: {
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    batteryLevel?: number;
    isCharging?: boolean;
    activityStatus?: 'online' | 'driving' | 'working' | 'idle' | 'offline';
  }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'location_update',
        userId,
        businessId,
        ...location,
      }));
    }
  }, [userId, businessId]);

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
    lastUpdate,
    sendLocationUpdate,
    disconnect,
    reconnect: connect,
  };
}

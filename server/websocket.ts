import { WebSocket, WebSocketServer } from 'ws';
import { Server, IncomingMessage } from 'http';
import { parse } from 'url';
import cookie from 'cookie';
import { storage } from './storage';

interface LocationUpdate {
  type: 'location_update';
  userId: string;
  businessId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  activityStatus?: 'online' | 'driving' | 'working' | 'idle' | 'offline';
}

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  businessId: string;
  isTradie: boolean;
}

const connections = new Map<string, ClientConnection>();

let wss: WebSocketServer | null = null;
let sessionStore: any = null;

export function setupWebSocket(server: Server, store?: any) {
  wss = new WebSocketServer({ server, path: '/ws/location' });
  sessionStore = store;

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      const authenticatedUser = await authenticateConnection(req);
      
      if (!authenticatedUser) {
        ws.close(4001, 'Authentication required');
        return;
      }

      const params = parse(req.url || '', true).query;
      const businessId = params.businessId as string;
      const isTradie = params.isTradie === 'true';

      if (!businessId) {
        ws.close(4002, 'Missing businessId');
        return;
      }

      // Validate user has access to this business
      const hasAccess = await validateBusinessAccess(authenticatedUser.userId, businessId);
      if (!hasAccess) {
        ws.close(4003, 'Access denied to business');
        return;
      }

      const connectionId = `${authenticatedUser.userId}-${Date.now()}`;
      connections.set(connectionId, { 
        ws, 
        userId: authenticatedUser.userId, 
        businessId, 
        isTradie 
      });

      console.log(`[WebSocket] Client connected: ${authenticatedUser.userId} (${isTradie ? 'tradie' : 'owner/manager'})`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          handleMessage(connectionId, message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      });

      ws.on('close', () => {
        connections.delete(connectionId);
        console.log(`[WebSocket] Client disconnected: ${authenticatedUser.userId}`);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for ${authenticatedUser.userId}:`, error);
        connections.delete(connectionId);
      });

      ws.send(JSON.stringify({ type: 'connected', userId: authenticatedUser.userId }));
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      ws.close(4000, 'Connection error');
    }
  });

  console.log('[WebSocket] Location tracking server initialized');
}

async function authenticateConnection(req: IncomingMessage): Promise<{ userId: string } | null> {
  // Parse cookies from request
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionId = cookies['tradietrack.sid'];

  if (!sessionId) {
    console.log('[WebSocket] No session cookie found');
    return null;
  }

  // Extract the actual session ID (remove 's:' prefix and signature if present)
  let rawSessionId = sessionId;
  if (rawSessionId.startsWith('s:')) {
    rawSessionId = rawSessionId.slice(2).split('.')[0];
  }

  // Try to get session from store
  if (sessionStore) {
    return new Promise((resolve) => {
      sessionStore.get(rawSessionId, (err: any, session: any) => {
        if (err || !session || !session.userId) {
          console.log('[WebSocket] Session not found or expired');
          resolve(null);
          return;
        }
        resolve({ userId: session.userId });
      });
    });
  }

  console.log('[WebSocket] No session store available');
  return null;
}

async function validateBusinessAccess(userId: string, businessId: string): Promise<boolean> {
  try {
    // Check if user owns this business or is a team member
    const user = await storage.getUser(userId);
    if (!user) return false;

    // Owner always has access to their own business
    if (userId === businessId) return true;

    // Check if user is a team member of this business
    const teamMember = await storage.getTeamMemberByUserIdAndBusiness(userId, businessId);
    if (teamMember && teamMember.status === 'accepted') {
      return true;
    }

    return false;
  } catch (error) {
    console.error('[WebSocket] Error validating business access:', error);
    return false;
  }
}

function handleMessage(connectionId: string, message: any) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  switch (message.type) {
    case 'location_update':
      handleLocationUpdate(connection, message);
      break;
    case 'ping':
      connection.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    default:
      console.log('[WebSocket] Unknown message type:', message.type);
  }
}

function handleLocationUpdate(sender: ClientConnection, update: LocationUpdate) {
  // Broadcast to all other users in the same business
  connections.forEach((conn) => {
    if (conn.businessId === sender.businessId && 
        conn.userId !== sender.userId && 
        conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({
        type: 'team_location_update',
        userId: sender.userId,
        latitude: update.latitude,
        longitude: update.longitude,
        speed: update.speed,
        heading: update.heading,
        batteryLevel: update.batteryLevel,
        isCharging: update.isCharging,
        activityStatus: update.activityStatus,
        timestamp: Date.now(),
      }));
    }
  });
}

export function broadcastToBusinessUsers(businessId: string, message: any) {
  connections.forEach((conn) => {
    if (conn.businessId === businessId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  });
}

export function getActiveConnections(businessId: string): string[] {
  const active: string[] = [];
  connections.forEach((conn) => {
    if (conn.businessId === businessId && conn.ws.readyState === WebSocket.OPEN) {
      active.push(conn.userId);
    }
  });
  return active;
}

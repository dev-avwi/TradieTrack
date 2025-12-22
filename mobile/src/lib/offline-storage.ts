/**
 * Offline Storage Module using SQLite
 * 
 * Provides local caching of jobs, clients, quotes, invoices, and time entries
 * for offline access. Automatically syncs with the server when connectivity is restored.
 * 
 * Enhanced features:
 * - Delta sync: Only transfers items changed since last sync
 * - Conflict resolution: Server wins with local backup for review
 * - Background sync: Periodic sync using expo-background-fetch
 * - Attachment caching: Downloads remote files for offline access
 * 
 * Uses expo-sqlite for local database storage.
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';
import api from './api';

// Background task name
const BACKGROUND_SYNC_TASK = 'background-sync-task';

// Max retry attempts before giving up on a sync item
const MAX_RETRY_ATTEMPTS = 10;

// ============ TYPES ============

export interface CachedJob {
  id: string;
  title: string;
  description?: string;
  address?: string;
  status: string;
  scheduledAt?: string;
  clientId?: string;
  clientName?: string;
  assignedTo?: string;
  notes?: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string; // For locally created items
}

export interface CachedClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string;
}

export interface CachedQuote {
  id: string;
  quoteNumber: string;
  clientId: string;
  clientName?: string;
  jobId?: string;
  status: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string;
}

export interface CachedInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  jobId?: string;
  quoteId?: string;
  status: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  amountPaid: number;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string;
}

export interface CachedTimeEntry {
  id: string;
  userId: string;
  jobId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  notes?: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
  localId?: string;
}

export interface CachedQuoteLineItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  cachedAt: number;
}

export interface CachedInvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  cachedAt: number;
}

export interface CachedAttachment {
  id: string;
  jobId?: string;
  quoteId?: string;
  invoiceId?: string;
  clientId?: string;
  type: 'photo' | 'signature' | 'document';
  filename: string;
  mimeType: string;
  localUri?: string; // Local file path on device (nullable for server-fetched attachments)
  remoteUrl?: string; // Server URL once synced
  fileSize?: number;
  description?: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'delete';
  localId?: string;
}

export interface PendingSyncItem {
  id: string;
  type: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry' | 'attachment';
  action: 'create' | 'update' | 'delete';
  data: string; // JSON stringified
  createdAt: number;
  retryCount: number;
  lastError?: string;
  lastAttemptedAt?: number; // For exponential backoff
}

export interface ConflictRecord {
  id: string;
  entityType: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry';
  entityId: string;
  localData: string; // JSON stringified local version
  serverData: string; // JSON stringified server version
  conflictedAt: number;
  resolved: boolean;
  resolution?: 'kept_server' | 'kept_local' | 'merged';
  resolvedAt?: number;
}

// ============ OFFLINE STATE STORE ============

interface OfflineState {
  isOnline: boolean;
  isInitialized: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingSyncCount: number;
  syncError: string | null;
  unresolvedConflictCount: number;
  backgroundSyncEnabled: boolean;
  
  setOnline: (online: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number | null) => void;
  setPendingSyncCount: (count: number) => void;
  setSyncError: (error: string | null) => void;
  setUnresolvedConflictCount: (count: number) => void;
  setBackgroundSyncEnabled: (enabled: boolean) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  isInitialized: false,
  isSyncing: false,
  lastSyncTime: null,
  pendingSyncCount: 0,
  syncError: null,
  unresolvedConflictCount: 0,
  backgroundSyncEnabled: false,
  
  setOnline: (online) => set({ isOnline: online }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncTime: (time) => {
    set({ lastSyncTime: time });
    // Persist to metadata (fire and forget)
    if (time !== null) {
      offlineStorage.setMetadata('last_sync_time', time.toString()).catch(() => {});
    }
  },
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setSyncError: (error) => set({ syncError: error }),
  setUnresolvedConflictCount: (count) => set({ unresolvedConflictCount: count }),
  setBackgroundSyncEnabled: (enabled) => set({ backgroundSyncEnabled: enabled }),
}));

// ============ OFFLINE STORAGE SERVICE ============

class OfflineStorageService {
  private db: SQLite.SQLiteDatabase | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private syncInProgress = false;

  /**
   * Initialize the SQLite database and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Open database
      this.db = await SQLite.openDatabaseAsync('tradietrack_offline.db');
      
      // Create all tables
      await this.db.execAsync(`
        -- Jobs table
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          address TEXT,
          status TEXT NOT NULL,
          scheduled_at TEXT,
          client_id TEXT,
          client_name TEXT,
          assigned_to TEXT,
          notes TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Clients table
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          notes TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Quotes table
        CREATE TABLE IF NOT EXISTS quotes (
          id TEXT PRIMARY KEY,
          quote_number TEXT,
          client_id TEXT,
          client_name TEXT,
          job_id TEXT,
          status TEXT NOT NULL,
          subtotal REAL DEFAULT 0,
          gst_amount REAL DEFAULT 0,
          total REAL DEFAULT 0,
          valid_until TEXT,
          notes TEXT,
          created_at TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Invoices table
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number TEXT,
          client_id TEXT,
          client_name TEXT,
          job_id TEXT,
          quote_id TEXT,
          status TEXT NOT NULL,
          subtotal REAL DEFAULT 0,
          gst_amount REAL DEFAULT 0,
          total REAL DEFAULT 0,
          amount_paid REAL DEFAULT 0,
          due_date TEXT,
          paid_at TEXT,
          notes TEXT,
          created_at TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Time entries table
        CREATE TABLE IF NOT EXISTS time_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          job_id TEXT,
          description TEXT,
          start_time TEXT NOT NULL,
          end_time TEXT,
          notes TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Sync queue for pending changes with exponential backoff support
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          action TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER DEFAULT 0,
          last_error TEXT,
          last_attempted_at INTEGER
        );
        
        -- Metadata for sync timestamps
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        
        -- Cached auth data for offline access
        CREATE TABLE IF NOT EXISTS cached_auth (
          id TEXT PRIMARY KEY DEFAULT 'current_user',
          user_data TEXT,
          business_settings TEXT,
          role_info TEXT,
          cached_at INTEGER NOT NULL
        );
        
        -- Attachments table for photos, signatures, documents
        -- local_uri is nullable for server-fetched attachments that don't have local copies yet
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          job_id TEXT,
          quote_id TEXT,
          invoice_id TEXT,
          client_id TEXT,
          type TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          local_uri TEXT,
          remote_url TEXT,
          file_size INTEGER,
          description TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT,
          local_id TEXT
        );
        
        -- Conflicts table for tracking sync conflicts
        CREATE TABLE IF NOT EXISTS conflicts (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          local_data TEXT NOT NULL,
          server_data TEXT NOT NULL,
          conflicted_at INTEGER NOT NULL,
          resolved INTEGER DEFAULT 0,
          resolution TEXT,
          resolved_at INTEGER
        );
        
        -- Delta sync timestamps per entity type
        CREATE TABLE IF NOT EXISTS delta_sync (
          entity_type TEXT PRIMARY KEY,
          last_synced_at INTEGER NOT NULL,
          last_server_timestamp TEXT
        );
        
        -- Quote line items table for offline access
        CREATE TABLE IF NOT EXISTS quote_line_items (
          id TEXT PRIMARY KEY,
          quote_id TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL DEFAULT 1,
          unit_price REAL DEFAULT 0,
          total REAL DEFAULT 0,
          cached_at INTEGER NOT NULL
        );
        
        -- Invoice line items table for offline access
        CREATE TABLE IF NOT EXISTS invoice_line_items (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL DEFAULT 1,
          unit_price REAL DEFAULT 0,
          total REAL DEFAULT 0,
          cached_at INTEGER NOT NULL
        );
        
        -- Create indexes for line items
        CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id ON quote_line_items(quote_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
      `);
      
      // Run migrations to fix old schemas with NOT NULL constraints
      await this.runMigrations();
      
      // Set up network listener
      this.networkUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange);
      
      // Check initial network state
      const netState = await NetInfo.fetch();
      useOfflineStore.getState().setOnline(netState.isConnected ?? false);
      useOfflineStore.getState().setInitialized(true);
      
      // Update pending count and conflict count
      await this.updatePendingSyncCount();
      await this.updateUnresolvedConflictCount();
      
      // Load last sync time from metadata
      const lastSyncStr = await this.getMetadata('last_sync_time');
      if (lastSyncStr) {
        useOfflineStore.getState().setLastSyncTime(parseInt(lastSyncStr, 10));
      }
      
      // Clean up permanently failed sync items (exceeded max retries)
      await this.cleanupFailedSyncItems();
      
      // Register background sync (non-blocking)
      this.registerBackgroundSync().catch(err => {
        console.warn('[OfflineStorage] Background sync registration failed:', err);
      });
      
      console.log('[OfflineStorage] Initialized successfully');
    } catch (error) {
      console.error('[OfflineStorage] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Run schema migrations to fix old databases with NOT NULL constraints
   * SQLite doesn't support ALTER COLUMN, so we need to recreate tables
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) return;
    
    try {
      // Check if we need to migrate quotes table (check for NOT NULL on quote_number)
      const quotesInfo = await this.db.getAllAsync("PRAGMA table_info(quotes)");
      const quoteNumberCol = (quotesInfo as any[]).find((c: any) => c.name === 'quote_number');
      
      if (quoteNumberCol && quoteNumberCol.notnull === 1) {
        console.log('[OfflineStorage] Migrating quotes table to allow NULL quote_number...');
        await this.db.execAsync(`
          BEGIN TRANSACTION;
          
          -- Create new quotes table with correct schema
          CREATE TABLE IF NOT EXISTS quotes_new (
            id TEXT PRIMARY KEY,
            quote_number TEXT,
            client_id TEXT,
            client_name TEXT,
            job_id TEXT,
            status TEXT NOT NULL,
            subtotal REAL DEFAULT 0,
            gst_amount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            valid_until TEXT,
            notes TEXT,
            created_at TEXT,
            cached_at INTEGER NOT NULL,
            pending_sync INTEGER DEFAULT 0,
            sync_action TEXT,
            local_id TEXT
          );
          
          -- Copy data from old table
          INSERT INTO quotes_new SELECT * FROM quotes;
          
          -- Drop old table and rename new one
          DROP TABLE quotes;
          ALTER TABLE quotes_new RENAME TO quotes;
          
          -- Recreate indexes
          CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
          CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
          
          COMMIT;
        `);
        console.log('[OfflineStorage] Quotes table migrated successfully');
      }
      
      // Check if we need to migrate invoices table
      const invoicesInfo = await this.db.getAllAsync("PRAGMA table_info(invoices)");
      const invoiceNumberCol = (invoicesInfo as any[]).find((c: any) => c.name === 'invoice_number');
      
      if (invoiceNumberCol && invoiceNumberCol.notnull === 1) {
        console.log('[OfflineStorage] Migrating invoices table to allow NULL invoice_number...');
        await this.db.execAsync(`
          BEGIN TRANSACTION;
          
          -- Create new invoices table with correct schema
          CREATE TABLE IF NOT EXISTS invoices_new (
            id TEXT PRIMARY KEY,
            invoice_number TEXT,
            client_id TEXT,
            client_name TEXT,
            job_id TEXT,
            quote_id TEXT,
            status TEXT NOT NULL,
            subtotal REAL DEFAULT 0,
            gst_amount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            amount_paid REAL DEFAULT 0,
            due_date TEXT,
            paid_at TEXT,
            notes TEXT,
            created_at TEXT,
            cached_at INTEGER NOT NULL,
            pending_sync INTEGER DEFAULT 0,
            sync_action TEXT,
            local_id TEXT
          );
          
          -- Copy data from old table
          INSERT INTO invoices_new SELECT * FROM invoices;
          
          -- Drop old table and rename new one
          DROP TABLE invoices;
          ALTER TABLE invoices_new RENAME TO invoices;
          
          -- Recreate indexes
          CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
          CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
          
          COMMIT;
        `);
        console.log('[OfflineStorage] Invoices table migrated successfully');
      }
      
      // Check if we need to migrate attachments table (local_uri should be nullable)
      const attachmentsInfo = await this.db.getAllAsync("PRAGMA table_info(attachments)");
      const localUriCol = (attachmentsInfo as any[]).find((c: any) => c.name === 'local_uri');
      
      if (localUriCol && localUriCol.notnull === 1) {
        console.log('[OfflineStorage] Migrating attachments table to allow NULL local_uri...');
        await this.db.execAsync(`
          BEGIN TRANSACTION;
          
          -- Create new attachments table with correct schema (local_uri nullable)
          CREATE TABLE IF NOT EXISTS attachments_new (
            id TEXT PRIMARY KEY,
            job_id TEXT,
            quote_id TEXT,
            invoice_id TEXT,
            client_id TEXT,
            type TEXT NOT NULL,
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            local_uri TEXT,
            remote_url TEXT,
            file_size INTEGER,
            description TEXT,
            cached_at INTEGER NOT NULL,
            pending_sync INTEGER DEFAULT 0,
            sync_action TEXT,
            local_id TEXT
          );
          
          -- Copy data from old table
          INSERT INTO attachments_new SELECT * FROM attachments;
          
          -- Drop old table and rename new one
          DROP TABLE attachments;
          ALTER TABLE attachments_new RENAME TO attachments;
          
          COMMIT;
        `);
        console.log('[OfflineStorage] Attachments table migrated successfully');
      }
      
      // Check if clients table is missing the "notes" column (added in a later version)
      const clientsInfo = await this.db.getAllAsync("PRAGMA table_info(clients)");
      const clientsNotesCol = (clientsInfo as any[]).find((c: any) => c.name === 'notes');
      
      if (!clientsNotesCol) {
        console.log('[OfflineStorage] Adding missing "notes" column to clients table...');
        await this.db.execAsync(`ALTER TABLE clients ADD COLUMN notes TEXT`);
        console.log('[OfflineStorage] Clients table "notes" column added successfully');
      }
      
    } catch (error) {
      console.error('[OfflineStorage] Migration error:', error);
      // Don't throw - we don't want to block initialization
    }
  }

  private handleNetworkChange = async (state: NetInfoState) => {
    const wasOffline = !useOfflineStore.getState().isOnline;
    const isNowOnline = state.isConnected ?? false;
    
    useOfflineStore.getState().setOnline(isNowOnline);
    
    // If we just came online, trigger sync
    if (wasOffline && isNowOnline) {
      console.log('[OfflineStorage] Network restored, triggering sync...');
      await this.syncPendingChanges();
    }
  };

  // ============ JOBS ============

  async cacheJobs(jobs: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const job of jobs) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO jobs 
         (id, title, description, address, status, scheduled_at, client_id, client_name, assigned_to, notes, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
           COALESCE((SELECT pending_sync FROM jobs WHERE id = ?), 0),
           (SELECT sync_action FROM jobs WHERE id = ?))`,
        [job.id, job.title, job.description, job.address, job.status, 
         job.scheduledAt, job.clientId, job.clientName, job.assignedTo, job.notes, now,
         job.id, job.id]
      );
    }
    
    await this.setMetadata('last_jobs_sync', now.toString());
    console.log(`[OfflineStorage] Cached ${jobs.length} jobs`);
  }

  async getCachedJobs(status?: string): Promise<CachedJob[]> {
    if (!this.db) return [];
    
    let query = 'SELECT * FROM jobs WHERE sync_action != "delete" OR sync_action IS NULL';
    const params: any[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY scheduled_at ASC NULLS LAST';
    
    const rows = await this.db.getAllAsync(query, params);
    
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      address: row.address,
      status: row.status,
      scheduledAt: row.scheduled_at,
      clientId: row.client_id,
      clientName: row.client_name,
      assignedTo: row.assigned_to,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedJob(id: string): Promise<CachedJob | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM jobs WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      address: row.address,
      status: row.status,
      scheduledAt: row.scheduled_at,
      clientId: row.client_id,
      clientName: row.client_name,
      assignedTo: row.assigned_to,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  async saveJobOffline(job: Partial<CachedJob>, action: 'create' | 'update'): Promise<CachedJob> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = action === 'create' ? `local_${now}_${Math.random().toString(36).substr(2, 9)}` : undefined;
    const id = job.id || localId!;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO jobs 
       (id, title, description, address, status, scheduled_at, client_id, client_name, assigned_to, notes, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, job.title || '', job.description ?? null, job.address ?? null, job.status || 'pending', 
       job.scheduledAt ?? null, job.clientId ?? null, job.clientName ?? null, job.assignedTo ?? null, job.notes ?? null, now, action, localId ?? null]
    );
    
    await this.addToSyncQueue('job', action, { ...job, id, localId });
    await this.updatePendingSyncCount();
    
    return { ...job, id, cachedAt: now, pendingSync: true, syncAction: action, localId } as CachedJob;
  }

  async updateJobOffline(jobId: string, updates: Partial<CachedJob>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedJob(jobId);
    
    if (existing) {
      const updated = { ...existing, ...updates, cachedAt: now, pendingSync: true, syncAction: 'update' as const };
      
      await this.db.runAsync(
        `UPDATE jobs SET 
          title = ?, description = ?, address = ?, status = ?, scheduled_at = ?,
          client_id = ?, client_name = ?, assigned_to = ?, notes = ?,
          cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [updated.title, updated.description ?? null, updated.address ?? null, updated.status, updated.scheduledAt ?? null,
         updated.clientId ?? null, updated.clientName ?? null, updated.assignedTo ?? null, updated.notes ?? null,
         now, 'update', jobId]
      );
      
      await this.addToSyncQueue('job', 'update', { 
        id: jobId, 
        ...updates,
        _previousValues: {
          status: existing.status,
          title: existing.title,
          description: existing.description,
          address: existing.address,
          notes: existing.notes,
        }
      });
      await this.updatePendingSyncCount();
    }
  }

  /**
   * Update job status offline with status progression tracking
   * Specialized method for status changes that tracks the previous status
   */
  async updateJobStatusOffline(jobId: string, newStatus: string, previousStatus: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedJob(jobId);
    
    if (existing) {
      await this.db.runAsync(
        `UPDATE jobs SET 
          status = ?, cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [newStatus, now, 'update', jobId]
      );
      
      await this.addToSyncQueue('job', 'update', { 
        id: jobId, 
        status: newStatus,
        _previousValues: {
          status: previousStatus
        },
        _statusChange: {
          from: previousStatus,
          to: newStatus,
          changedAt: new Date().toISOString()
        }
      });
      await this.updatePendingSyncCount();
      
      console.log(`[OfflineStorage] Updated job ${jobId} status: ${previousStatus} -> ${newStatus}`);
    }
  }

  // ============ CLIENTS ============

  async cacheClients(clients: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const client of clients) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO clients 
         (id, name, email, phone, address, notes, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM clients WHERE id = ?), 0),
           (SELECT sync_action FROM clients WHERE id = ?))`,
        [client.id, client.name, client.email, client.phone, client.address, client.notes, now, client.id, client.id]
      );
    }
    
    await this.setMetadata('last_clients_sync', now.toString());
    console.log(`[OfflineStorage] Cached ${clients.length} clients`);
  }

  async getCachedClients(): Promise<CachedClient[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM clients WHERE sync_action != "delete" OR sync_action IS NULL ORDER BY name ASC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedClient(id: string): Promise<CachedClient | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  async saveClientOffline(client: Partial<CachedClient>, action: 'create' | 'update'): Promise<CachedClient> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = action === 'create' ? `local_${now}_${Math.random().toString(36).substr(2, 9)}` : undefined;
    const id = client.id || localId!;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO clients 
       (id, name, email, phone, address, notes, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, client.name || '', client.email ?? null, client.phone ?? null, client.address ?? null, client.notes ?? null, now, action, localId ?? null]
    );
    
    await this.addToSyncQueue('client', action, { ...client, id, localId });
    await this.updatePendingSyncCount();
    
    return { ...client, id, cachedAt: now, pendingSync: true, syncAction: action, localId } as CachedClient;
  }

  async updateClientOffline(clientId: string, updates: Partial<CachedClient>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedClient(clientId);
    
    if (existing) {
      const updated = { ...existing, ...updates, cachedAt: now, pendingSync: true, syncAction: 'update' as const };
      
      await this.db.runAsync(
        `UPDATE clients SET 
          name = ?, email = ?, phone = ?, address = ?, notes = ?,
          cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [updated.name, updated.email ?? null, updated.phone ?? null, updated.address ?? null, updated.notes ?? null,
         now, 'update', clientId]
      );
      
      await this.addToSyncQueue('client', 'update', { 
        id: clientId, 
        ...updates,
        _previousValues: {
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          address: existing.address,
          notes: existing.notes,
        }
      });
      await this.updatePendingSyncCount();
    }
  }

  // ============ QUOTES ============

  async cacheQuotes(quotes: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const quote of quotes) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO quotes 
         (id, quote_number, client_id, client_name, job_id, status, subtotal, gst_amount, total, valid_until, notes, created_at, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM quotes WHERE id = ?), 0),
           (SELECT sync_action FROM quotes WHERE id = ?))`,
        [quote.id, quote.quoteNumber, quote.clientId, quote.clientName, quote.jobId, quote.status,
         quote.subtotal, quote.gstAmount, quote.total, quote.validUntil, quote.notes, quote.createdAt, now,
         quote.id, quote.id]
      );
    }
    
    await this.setMetadata('last_quotes_sync', now.toString());
    console.log(`[OfflineStorage] Cached ${quotes.length} quotes`);
  }

  async getCachedQuotes(): Promise<CachedQuote[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM quotes WHERE sync_action != "delete" OR sync_action IS NULL ORDER BY created_at DESC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      quoteNumber: row.quote_number,
      clientId: row.client_id,
      clientName: row.client_name,
      jobId: row.job_id,
      status: row.status,
      subtotal: row.subtotal,
      gstAmount: row.gst_amount,
      total: row.total,
      validUntil: row.valid_until,
      notes: row.notes,
      createdAt: row.created_at,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedQuote(id: string): Promise<CachedQuote | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      quoteNumber: row.quote_number,
      clientId: row.client_id,
      clientName: row.client_name,
      jobId: row.job_id,
      status: row.status,
      subtotal: row.subtotal,
      gstAmount: row.gst_amount,
      total: row.total,
      validUntil: row.valid_until,
      notes: row.notes,
      createdAt: row.created_at,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  async updateQuoteOffline(quoteId: string, updates: Partial<CachedQuote>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedQuote(quoteId);
    
    if (existing) {
      const updated = { ...existing, ...updates, cachedAt: now, pendingSync: true, syncAction: 'update' as const };
      
      await this.db.runAsync(
        `UPDATE quotes SET 
          status = ?, subtotal = ?, gst_amount = ?, total = ?, valid_until = ?, notes = ?,
          cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [updated.status, updated.subtotal, updated.gstAmount, updated.total, updated.validUntil ?? null, updated.notes ?? null,
         now, 'update', quoteId]
      );
      
      await this.addToSyncQueue('quote', 'update', { id: quoteId, ...updates });
      await this.updatePendingSyncCount();
    }
  }

  /**
   * Save a quote offline for later sync
   * Includes line items which will be sent along with the quote
   */
  async saveQuoteOffline(quote: {
    clientId: string;
    clientName?: string;
    jobId?: string;
    title?: string;
    description?: string;
    notes?: string;
    validUntil?: string;
    subtotal: number;
    gstAmount: number;
    total: number;
    depositRequired?: boolean;
    depositPercent?: number;
    depositAmount?: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<CachedQuote> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const id = localId;
    
    // Insert quote record
    await this.db.runAsync(
      `INSERT INTO quotes 
       (id, quote_number, client_id, client_name, job_id, status, subtotal, gst_amount, total, valid_until, notes, created_at, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'create', ?)`,
      [id, null, quote.clientId, quote.clientName ?? null, quote.jobId ?? null, 'draft', 
       quote.subtotal, quote.gstAmount, quote.total, quote.validUntil ?? null, quote.notes ?? null,
       new Date().toISOString(), now, localId]
    );
    
    // Cache line items locally
    const lineItemsWithIds = quote.lineItems.map((item, index) => ({
      id: `${localId}_item_${index}`,
      quoteId: id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));
    
    await this.cacheQuoteLineItems(id, lineItemsWithIds);
    
    // Add to sync queue with all data including line items
    await this.addToSyncQueue('quote', 'create', { 
      ...quote, 
      id, 
      localId,
      lineItems: quote.lineItems 
    });
    await this.updatePendingSyncCount();
    
    console.log(`[OfflineStorage] Saved quote offline: ${id}`);
    return { 
      id, 
      quoteNumber: '', 
      clientId: quote.clientId,
      clientName: quote.clientName,
      jobId: quote.jobId,
      status: 'draft',
      subtotal: quote.subtotal,
      gstAmount: quote.gstAmount,
      total: quote.total,
      validUntil: quote.validUntil,
      notes: quote.notes,
      createdAt: new Date().toISOString(),
      cachedAt: now, 
      pendingSync: true, 
      syncAction: 'create', 
      localId 
    };
  }

  // ============ QUOTE LINE ITEMS ============

  async cacheQuoteLineItems(quoteId: string, lineItems: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    // Clear existing line items for this quote
    await this.db.runAsync('DELETE FROM quote_line_items WHERE quote_id = ?', [quoteId]);
    
    for (const item of lineItems) {
      await this.db.runAsync(
        `INSERT INTO quote_line_items 
         (id, quote_id, description, quantity, unit_price, total, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, quoteId, item.description, item.quantity || 1, item.unitPrice || 0, item.total || 0, now]
      );
    }
    
    console.log(`[OfflineStorage] Cached ${lineItems.length} line items for quote ${quoteId}`);
  }

  async getCachedQuoteLineItems(quoteId: string): Promise<CachedQuoteLineItem[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM quote_line_items WHERE quote_id = ?',
      [quoteId]
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      quoteId: row.quote_id,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      total: row.total,
      cachedAt: row.cached_at,
    }));
  }

  // ============ INVOICES ============

  async cacheInvoices(invoices: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const invoice of invoices) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO invoices 
         (id, invoice_number, client_id, client_name, job_id, quote_id, status, subtotal, gst_amount, total, amount_paid, due_date, paid_at, notes, created_at, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM invoices WHERE id = ?), 0),
           (SELECT sync_action FROM invoices WHERE id = ?))`,
        [invoice.id, invoice.invoiceNumber, invoice.clientId, invoice.clientName, invoice.jobId, invoice.quoteId, invoice.status,
         invoice.subtotal, invoice.gstAmount, invoice.total, invoice.amountPaid, invoice.dueDate, invoice.paidAt, invoice.notes, invoice.createdAt, now,
         invoice.id, invoice.id]
      );
    }
    
    await this.setMetadata('last_invoices_sync', now.toString());
    console.log(`[OfflineStorage] Cached ${invoices.length} invoices`);
  }

  async getCachedInvoices(): Promise<CachedInvoice[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM invoices WHERE sync_action != "delete" OR sync_action IS NULL ORDER BY created_at DESC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      clientId: row.client_id,
      clientName: row.client_name,
      jobId: row.job_id,
      quoteId: row.quote_id,
      status: row.status,
      subtotal: row.subtotal,
      gstAmount: row.gst_amount,
      total: row.total,
      amountPaid: row.amount_paid,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      notes: row.notes,
      createdAt: row.created_at,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedInvoice(id: string): Promise<CachedInvoice | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      clientId: row.client_id,
      clientName: row.client_name,
      jobId: row.job_id,
      quoteId: row.quote_id,
      status: row.status,
      subtotal: row.subtotal,
      gstAmount: row.gst_amount,
      total: row.total,
      amountPaid: row.amount_paid,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      notes: row.notes,
      createdAt: row.created_at,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  async updateInvoiceOffline(invoiceId: string, updates: Partial<CachedInvoice>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const existing = await this.getCachedInvoice(invoiceId);
    
    if (existing) {
      const updated = { ...existing, ...updates, cachedAt: now, pendingSync: true, syncAction: 'update' as const };
      
      await this.db.runAsync(
        `UPDATE invoices SET 
          status = ?, subtotal = ?, gst_amount = ?, total = ?, amount_paid = ?, due_date = ?, paid_at = ?, notes = ?,
          cached_at = ?, pending_sync = 1, sync_action = ?
         WHERE id = ?`,
        [updated.status, updated.subtotal, updated.gstAmount, updated.total, updated.amountPaid, updated.dueDate ?? null, updated.paidAt ?? null, updated.notes ?? null,
         now, 'update', invoiceId]
      );
      
      await this.addToSyncQueue('invoice', 'update', { 
        id: invoiceId, 
        ...updates,
        _previousValues: {
          status: existing.status,
          subtotal: existing.subtotal,
          gstAmount: existing.gstAmount,
          total: existing.total,
          amountPaid: existing.amountPaid,
          dueDate: existing.dueDate,
          paidAt: existing.paidAt,
          notes: existing.notes,
        }
      });
      await this.updatePendingSyncCount();
    }
  }

  /**
   * Save an invoice offline for later sync
   * Includes line items which will be sent along with the invoice
   */
  async saveInvoiceOffline(invoice: {
    clientId: string;
    clientName?: string;
    jobId?: string;
    quoteId?: string;
    title?: string;
    description?: string;
    notes?: string;
    dueDate?: string;
    subtotal: number;
    gstAmount: number;
    total: number;
    isRecurring?: boolean;
    recurrencePattern?: string;
    recurrenceEndDate?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<CachedInvoice> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const id = localId;
    
    // Insert invoice record
    await this.db.runAsync(
      `INSERT INTO invoices 
       (id, invoice_number, client_id, client_name, job_id, quote_id, status, subtotal, gst_amount, total, amount_paid, due_date, paid_at, notes, created_at, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'create', ?)`,
      [id, null, invoice.clientId, invoice.clientName ?? null, invoice.jobId ?? null, invoice.quoteId ?? null, 'draft', 
       invoice.subtotal, invoice.gstAmount, invoice.total, 0, invoice.dueDate ?? null, null, invoice.notes ?? null,
       new Date().toISOString(), now, localId]
    );
    
    // Cache line items locally
    const lineItemsWithIds = invoice.lineItems.map((item, index) => ({
      id: `${localId}_item_${index}`,
      invoiceId: id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));
    
    await this.cacheInvoiceLineItems(id, lineItemsWithIds);
    
    // Add to sync queue with all data including line items
    await this.addToSyncQueue('invoice', 'create', { 
      ...invoice, 
      id, 
      localId,
      lineItems: invoice.lineItems 
    });
    await this.updatePendingSyncCount();
    
    console.log(`[OfflineStorage] Saved invoice offline: ${id}`);
    return { 
      id, 
      invoiceNumber: '', 
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      jobId: invoice.jobId,
      quoteId: invoice.quoteId,
      status: 'draft',
      subtotal: invoice.subtotal,
      gstAmount: invoice.gstAmount,
      total: invoice.total,
      amountPaid: 0,
      dueDate: invoice.dueDate,
      paidAt: undefined,
      notes: invoice.notes,
      createdAt: new Date().toISOString(),
      cachedAt: now, 
      pendingSync: true, 
      syncAction: 'create', 
      localId 
    };
  }

  // ============ INVOICE LINE ITEMS ============

  async cacheInvoiceLineItems(invoiceId: string, lineItems: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    // Clear existing line items for this invoice
    await this.db.runAsync('DELETE FROM invoice_line_items WHERE invoice_id = ?', [invoiceId]);
    
    for (const item of lineItems) {
      await this.db.runAsync(
        `INSERT INTO invoice_line_items 
         (id, invoice_id, description, quantity, unit_price, total, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, invoiceId, item.description, item.quantity || 1, item.unitPrice || 0, item.total || 0, now]
      );
    }
    
    console.log(`[OfflineStorage] Cached ${lineItems.length} line items for invoice ${invoiceId}`);
  }

  async getCachedInvoiceLineItems(invoiceId: string): Promise<CachedInvoiceLineItem[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM invoice_line_items WHERE invoice_id = ?',
      [invoiceId]
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      total: row.total,
      cachedAt: row.cached_at,
    }));
  }

  // ============ TIME ENTRIES ============

  async cacheTimeEntries(entries: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const entry of entries) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO time_entries 
         (id, user_id, job_id, description, start_time, end_time, notes, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM time_entries WHERE id = ?), 0),
           (SELECT sync_action FROM time_entries WHERE id = ?))`,
        [entry.id, entry.userId, entry.jobId, entry.description, entry.startTime, entry.endTime, entry.notes, now,
         entry.id, entry.id]
      );
    }
    
    await this.setMetadata('last_time_entries_sync', now.toString());
    console.log(`[OfflineStorage] Cached ${entries.length} time entries`);
  }

  async getCachedTimeEntries(): Promise<CachedTimeEntry[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM time_entries WHERE sync_action != "delete" OR sync_action IS NULL ORDER BY start_time DESC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async saveTimeEntryOffline(entry: Partial<CachedTimeEntry>, action: 'create' | 'update'): Promise<CachedTimeEntry> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = action === 'create' ? `local_${now}_${Math.random().toString(36).substr(2, 9)}` : undefined;
    const id = entry.id || localId!;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO time_entries 
       (id, user_id, job_id, description, start_time, end_time, notes, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, entry.userId || '', entry.jobId ?? null, entry.description ?? null, entry.startTime || new Date().toISOString(), entry.endTime ?? null, entry.notes ?? null, now, action, localId ?? null]
    );
    
    await this.addToSyncQueue('timeEntry', action, { ...entry, id, localId });
    await this.updatePendingSyncCount();
    
    return { ...entry, id, cachedAt: now, pendingSync: true, syncAction: action, localId } as CachedTimeEntry;
  }

  /**
   * Start a time entry offline with local timestamp
   * Creates a new time entry with the current time as start time
   */
  async startTimeEntryOffline(userId: string, jobId?: string, description?: string): Promise<CachedTimeEntry> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();
    
    await this.db.runAsync(
      `INSERT INTO time_entries 
       (id, user_id, job_id, description, start_time, end_time, notes, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'create', ?)`,
      [localId, userId, jobId ?? null, description ?? null, startTime, null, null, now, localId]
    );
    
    const entry: CachedTimeEntry = {
      id: localId,
      userId,
      jobId,
      description,
      startTime,
      endTime: undefined,
      notes: undefined,
      cachedAt: now,
      pendingSync: true,
      syncAction: 'create',
      localId,
    };
    
    await this.addToSyncQueue('timeEntry', 'create', entry);
    await this.updatePendingSyncCount();
    
    console.log(`[OfflineStorage] Started time entry offline: ${localId}`);
    return entry;
  }

  /**
   * Stop a time entry offline and queue for sync
   * Updates the end time of an existing time entry
   */
  async stopTimeEntryOffline(entryId: string): Promise<CachedTimeEntry | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const endTime = new Date().toISOString();
    
    // Get existing entry
    const row = await this.db.getFirstAsync(
      'SELECT * FROM time_entries WHERE id = ?',
      [entryId]
    ) as any;
    
    if (!row) {
      console.warn(`[OfflineStorage] Time entry ${entryId} not found`);
      return null;
    }
    
    // Update the entry with end time
    await this.db.runAsync(
      `UPDATE time_entries SET 
        end_time = ?, cached_at = ?, pending_sync = 1, sync_action = ?
       WHERE id = ?`,
      [endTime, now, 'update', entryId]
    );
    
    const entry: CachedTimeEntry = {
      id: row.id,
      userId: row.user_id,
      jobId: row.job_id,
      description: row.description,
      startTime: row.start_time,
      endTime,
      notes: row.notes,
      cachedAt: now,
      pendingSync: true,
      syncAction: 'update',
      localId: row.local_id,
    };
    
    await this.addToSyncQueue('timeEntry', 'update', { 
      id: entryId, 
      endTime,
      _previousValues: {
        endTime: row.end_time
      }
    });
    await this.updatePendingSyncCount();
    
    console.log(`[OfflineStorage] Stopped time entry offline: ${entryId}`);
    return entry;
  }

  // ============ ATTACHMENTS ============

  async cacheAttachments(attachments: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const attachment of attachments) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO attachments 
         (id, job_id, quote_id, invoice_id, client_id, type, filename, mime_type, local_uri, remote_url, file_size, description, cached_at, pending_sync, sync_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           COALESCE((SELECT pending_sync FROM attachments WHERE id = ?), 0),
           (SELECT sync_action FROM attachments WHERE id = ?))`,
        [attachment.id, attachment.jobId, attachment.quoteId, attachment.invoiceId, attachment.clientId,
         attachment.type, attachment.filename, attachment.mimeType, attachment.localUri,
         attachment.remoteUrl, attachment.fileSize, attachment.description, now,
         attachment.id, attachment.id]
      );
    }
    
    await this.setMetadata('last_attachments_sync', now.toString());
    console.log(`[OfflineStorage] Cached ${attachments.length} attachments`);
  }

  async getCachedAttachments(filter?: { jobId?: string; quoteId?: string; invoiceId?: string; clientId?: string; type?: string }): Promise<CachedAttachment[]> {
    if (!this.db) return [];
    
    let query = 'SELECT * FROM attachments WHERE (sync_action != "delete" OR sync_action IS NULL)';
    const params: any[] = [];
    
    if (filter?.jobId) {
      query += ' AND job_id = ?';
      params.push(filter.jobId);
    }
    if (filter?.quoteId) {
      query += ' AND quote_id = ?';
      params.push(filter.quoteId);
    }
    if (filter?.invoiceId) {
      query += ' AND invoice_id = ?';
      params.push(filter.invoiceId);
    }
    if (filter?.clientId) {
      query += ' AND client_id = ?';
      params.push(filter.clientId);
    }
    if (filter?.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }
    
    query += ' ORDER BY cached_at DESC';
    
    const rows = await this.db.getAllAsync(query, params);
    
    return rows.map((row: any) => ({
      id: row.id,
      jobId: row.job_id,
      quoteId: row.quote_id,
      invoiceId: row.invoice_id,
      clientId: row.client_id,
      type: row.type,
      filename: row.filename,
      mimeType: row.mime_type,
      localUri: row.local_uri,
      remoteUrl: row.remote_url,
      fileSize: row.file_size,
      description: row.description,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    }));
  }

  async getCachedAttachment(id: string): Promise<CachedAttachment | null> {
    if (!this.db) return null;
    
    const row = await this.db.getFirstAsync(
      'SELECT * FROM attachments WHERE id = ?',
      [id]
    ) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      jobId: row.job_id,
      quoteId: row.quote_id,
      invoiceId: row.invoice_id,
      clientId: row.client_id,
      type: row.type,
      filename: row.filename,
      mimeType: row.mime_type,
      localUri: row.local_uri,
      remoteUrl: row.remote_url,
      fileSize: row.file_size,
      description: row.description,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
      localId: row.local_id,
    };
  }

  /**
   * Save an attachment offline for later sync
   * The attachment file is stored locally and will be uploaded when online
   */
  async saveAttachmentOffline(attachment: Partial<CachedAttachment>): Promise<CachedAttachment> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const id = attachment.id || localId;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO attachments 
       (id, job_id, quote_id, invoice_id, client_id, type, filename, mime_type, local_uri, remote_url, file_size, description, cached_at, pending_sync, sync_action, local_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'create', ?)`,
      [id, attachment.jobId ?? null, attachment.quoteId ?? null, attachment.invoiceId ?? null, attachment.clientId ?? null,
       attachment.type ?? 'photo', attachment.filename ?? 'unknown', attachment.mimeType ?? 'application/octet-stream', attachment.localUri ?? null,
       attachment.remoteUrl ?? null, attachment.fileSize ?? null, attachment.description ?? null, now, localId]
    );
    
    // Add to sync queue - attachment upload handled specially
    await this.addToSyncQueue('attachment', 'create', { ...attachment, id, localId });
    await this.updatePendingSyncCount();
    
    console.log(`[OfflineStorage] Saved attachment offline: ${attachment.filename}`);
    return { ...attachment, id, cachedAt: now, pendingSync: true, syncAction: 'create', localId } as CachedAttachment;
  }

  /**
   * Delete an attachment (mark for deletion on sync)
   */
  async deleteAttachmentOffline(attachmentId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const existing = await this.getCachedAttachment(attachmentId);
    if (!existing) return;
    
    // If it's a local-only attachment, just delete it
    if (existing.localId && !existing.remoteUrl) {
      await this.db.runAsync('DELETE FROM attachments WHERE id = ?', [attachmentId]);
      await this.db.runAsync('DELETE FROM sync_queue WHERE data LIKE ?', [`%"id":"${attachmentId}"%`]);
    } else {
      // Mark for deletion on next sync
      await this.db.runAsync(
        'UPDATE attachments SET pending_sync = 1, sync_action = ? WHERE id = ?',
        ['delete', attachmentId]
      );
      await this.addToSyncQueue('attachment', 'delete', { id: attachmentId });
    }
    
    await this.updatePendingSyncCount();
  }

  // ============ SYNC QUEUE ============

  private async addToSyncQueue(
    type: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry' | 'attachment',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    // Check for existing sync item for the same entity
    const existing = await this.db.getFirstAsync(
      `SELECT * FROM sync_queue WHERE type = ? AND json_extract(data, '$.id') = ?`,
      [type, data.id]
    );
    
    if (existing) {
      // Update existing sync item
      await this.db.runAsync(
        `UPDATE sync_queue SET action = ?, data = ?, created_at = ? WHERE id = ?`,
        [action, JSON.stringify(data), now, (existing as any).id]
      );
    } else {
      // Insert new sync item
      await this.db.runAsync(
        `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [id, type, action, JSON.stringify(data), now]
      );
    }
    
    console.log(`[OfflineStorage] Added to sync queue: ${type} ${action}`);
  }

  /**
   * Calculate backoff delay in milliseconds based on retry count
   * Product spec: 30s → 2m → 5m → 15m → 30m (then capped at 30m)
   */
  private getBackoffDelay(retryCount: number): number {
    // First attempt has no delay
    if (retryCount === 0) return 0;
    
    // Specific delay sequence per product spec
    const delays = [
      30 * 1000,       // 30 seconds (retry 1)
      2 * 60 * 1000,   // 2 minutes (retry 2)
      5 * 60 * 1000,   // 5 minutes (retry 3)
      15 * 60 * 1000,  // 15 minutes (retry 4)
      30 * 60 * 1000,  // 30 minutes (retry 5+)
    ];
    
    // Use the delay for the retry count, capping at the maximum delay
    const index = Math.min(retryCount - 1, delays.length - 1);
    return delays[index];
  }

  async getPendingSyncItems(): Promise<PendingSyncItem[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );
    
    const now = Date.now();
    
    // Filter items that are ready for retry based on exponential backoff
    return rows
      .map((row: any) => ({
        id: row.id,
        type: row.type,
        action: row.action,
        data: row.data,
        createdAt: row.created_at,
        retryCount: row.retry_count,
        lastError: row.last_error,
        lastAttemptedAt: row.last_attempted_at,
      }))
      .filter((item) => {
        // Skip items that have exceeded max retries
        if (item.retryCount >= MAX_RETRY_ATTEMPTS) return false;
        
        // First attempt - always ready
        if (!item.lastAttemptedAt || item.retryCount === 0) return true;
        
        // Calculate backoff delay
        const delay = this.getBackoffDelay(item.retryCount);
        const nextRetryTime = item.lastAttemptedAt + delay;
        
        // Check if enough time has passed
        return now >= nextRetryTime;
      });
  }

  /**
   * Clean up sync items that have permanently failed (exceeded max retries)
   * Moves them to a failed state and notifies the user
   */
  private async cleanupFailedSyncItems(): Promise<void> {
    if (!this.db) return;
    
    try {
      const failedItems = await this.db.getAllAsync(
        `SELECT * FROM sync_queue WHERE retry_count >= ?`,
        [MAX_RETRY_ATTEMPTS]
      ) as any[];
      
      if (failedItems.length === 0) return;
      
      console.log(`[OfflineStorage] Cleaning up ${failedItems.length} permanently failed sync items`);
      
      for (const item of failedItems) {
        // Log the failed item for debugging
        console.warn(`[OfflineStorage] Permanently failed: ${item.type} ${item.action} - ${item.last_error}`);
        
        // Mark the cached item as having a sync failure
        const data = JSON.parse(item.data);
        const tableMap: Record<string, string> = {
          job: 'jobs', client: 'clients', quote: 'quotes',
          invoice: 'invoices', timeEntry: 'time_entries', attachment: 'attachments'
        };
        const table = tableMap[item.type];
        
        if (table && data.id) {
          // Keep the local data but clear the sync action (user can retry manually)
          await this.db.runAsync(
            `UPDATE ${table} SET pending_sync = 0, sync_action = 'failed' WHERE id = ?`,
            [data.id]
          );
        }
        
        // Remove from sync queue
        await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
      }
      
      await this.updatePendingSyncCount();
    } catch (error) {
      console.error('[OfflineStorage] Failed to cleanup failed sync items:', error);
    }
  }

  private async updatePendingSyncCount(): Promise<void> {
    if (!this.db) return;
    
    const result = await this.db.getFirstAsync(
      'SELECT COUNT(*) as count FROM sync_queue'
    ) as any;
    
    useOfflineStore.getState().setPendingSyncCount(result?.count ?? 0);
  }

  /**
   * Sync pending changes with the server
   */
  async syncPendingChanges(): Promise<{ success: boolean; synced: number; failed: number }> {
    if (!this.db) return { success: false, synced: 0, failed: 0 };
    if (this.syncInProgress) {
      console.log('[OfflineStorage] Sync already in progress');
      return { success: false, synced: 0, failed: 0 };
    }
    if (!useOfflineStore.getState().isOnline) {
      console.log('[OfflineStorage] Cannot sync - offline');
      return { success: false, synced: 0, failed: 0 };
    }
    
    this.syncInProgress = true;
    useOfflineStore.getState().setSyncing(true);
    useOfflineStore.getState().setSyncError(null);
    
    let synced = 0;
    let failed = 0;
    
    try {
      const items = await this.getPendingSyncItems();
      
      if (items.length === 0) {
        console.log('[OfflineStorage] No pending changes to sync');
        this.syncInProgress = false;
        useOfflineStore.getState().setSyncing(false);
        return { success: true, synced: 0, failed: 0 };
      }
      
      console.log(`[OfflineStorage] Syncing ${items.length} pending changes...`);
      
      for (const item of items) {
        try {
          const data = JSON.parse(item.data);
          
          // Attempt the actual sync (API call)
          const success = await this.syncItem(item.type, item.action, data);
          
          // Only record attempt time AFTER actual network attempt
          const attemptTime = Date.now();
          
          if (success) {
            // Remove from queue on success
            await this.db!.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
            
            // Update the cached item to mark as synced
            // Skip for attachments since syncAttachment handles its own pending_sync updates
            // (via updateLocalIdWithServerId for ID changes or direct UPDATE for same ID)
            if (item.type !== 'attachment') {
              await this.markItemSynced(item.type, data.id);
            }
            synced++;
          } else {
            // Increment retry count and record attempt time (backoff applies on next attempt)
            await this.db!.runAsync(
              'UPDATE sync_queue SET retry_count = retry_count + 1, last_attempted_at = ? WHERE id = ?',
              [attemptTime, item.id]
            );
            failed++;
            
            // Log backoff info
            const nextDelay = this.getBackoffDelay(item.retryCount + 1);
            console.log(`[OfflineStorage] Sync failed, retry #${item.retryCount + 1} in ${nextDelay / 1000}s`);
          }
        } catch (error: any) {
          console.error(`[OfflineStorage] Failed to sync item ${item.id}:`, error);
          
          // Update with error, increment retry count, and record attempt time
          await this.db!.runAsync(
            'UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ?, last_attempted_at = ? WHERE id = ?',
            [error.message || 'Unknown error', Date.now(), item.id]
          );
          failed++;
          
          // Log backoff info
          const nextDelay = this.getBackoffDelay(item.retryCount + 1);
          console.log(`[OfflineStorage] Sync error, retry #${item.retryCount + 1} in ${nextDelay / 1000}s`);
        }
      }
      
      await this.updatePendingSyncCount();
      useOfflineStore.getState().setLastSyncTime(Date.now());
      
      console.log(`[OfflineStorage] Sync complete: ${synced} synced, ${failed} failed`);
      return { success: failed === 0, synced, failed };
    } catch (error: any) {
      console.error('[OfflineStorage] Sync failed:', error);
      useOfflineStore.getState().setSyncError(error.message || 'Sync failed');
      return { success: false, synced, failed };
    } finally {
      this.syncInProgress = false;
      useOfflineStore.getState().setSyncing(false);
    }
  }

  private async syncItem(
    type: string,
    action: string,
    data: any
  ): Promise<boolean> {
    // Handle attachments separately (they require file upload)
    if (type === 'attachment') {
      return this.syncAttachment(action, data);
    }
    
    const endpoints: Record<string, string> = {
      job: '/api/jobs',
      client: '/api/clients',
      quote: '/api/quotes',
      invoice: '/api/invoices',
      timeEntry: '/api/time-entries',
    };
    
    const endpoint = endpoints[type];
    if (!endpoint) {
      console.error(`[OfflineStorage] Unknown type: ${type}`);
      return false;
    }
    
    try {
      let response;
      
      switch (action) {
        case 'create':
          // Remove local id and metadata before sending
          const createData = { ...data };
          delete createData.id;
          delete createData.localId;
          delete createData.cachedAt;
          delete createData.pendingSync;
          delete createData.syncAction;
          
          response = await api.post(endpoint, createData);
          
          if (response.data && data.localId) {
            // Update local record with server ID
            await this.updateLocalIdWithServerId(type, data.localId, (response.data as any).id);
          }
          break;
          
        case 'update':
          const updateData = { ...data };
          delete updateData.localId;
          delete updateData.cachedAt;
          delete updateData.pendingSync;
          delete updateData.syncAction;
          delete updateData.id;
          
          response = await api.patch(`${endpoint}/${data.id}`, updateData);
          break;
          
        case 'delete':
          response = await api.delete(`${endpoint}/${data.id}`);
          break;
          
        default:
          console.error(`[OfflineStorage] Unknown action: ${action}`);
          return false;
      }
      
      if (response.error) {
        console.error(`[OfflineStorage] API error for ${type} ${action}:`, response.error);
        return false;
      }
      
      console.log(`[OfflineStorage] Successfully synced ${type} ${action}`);
      return true;
    } catch (error) {
      console.error(`[OfflineStorage] Failed to sync ${type} ${action}:`, error);
      return false;
    }
  }

  /**
   * Sync an attachment - handles file upload via multipart form data
   * Returns true on success - processSyncQueue handles queue cleanup for all cases
   */
  private async syncAttachment(action: string, data: any): Promise<boolean> {
    try {
      if (action === 'delete') {
        // Delete attachment from server
        const response = await api.delete(`/api/attachments/${data.id}`);
        if (response.error) {
          console.error('[OfflineStorage] Failed to delete attachment:', response.error);
          return false;
        }
        // Remove from local cache - processSyncQueue will handle sync_queue cleanup
        await this.db?.runAsync('DELETE FROM attachments WHERE id = ?', [data.id]);
        return true;
      }
      
      if (action === 'create') {
        // For photo uploads, we need to use FormData
        // The localUri is the file path on device
        const formData = new FormData();
        
        // Build the file object for upload
        const file = {
          uri: data.localUri,
          type: data.mimeType || 'application/octet-stream',
          name: data.filename || 'attachment',
        };
        
        formData.append('file', file as any);
        
        if (data.jobId) formData.append('jobId', data.jobId);
        if (data.quoteId) formData.append('quoteId', data.quoteId);
        if (data.invoiceId) formData.append('invoiceId', data.invoiceId);
        if (data.clientId) formData.append('clientId', data.clientId);
        if (data.type) formData.append('type', data.type);
        if (data.description) formData.append('description', data.description);
        
        // Determine upload endpoint based on attachment type
        let endpoint = '/api/attachments';
        if (data.jobId) {
          endpoint = `/api/jobs/${data.jobId}/photos`;
        }
        
        const response = await api.uploadFile(endpoint, formData);
        
        if (response.error || !response.data) {
          console.error('[OfflineStorage] Failed to upload attachment:', response.error);
          return false;
        }
        
        // Update local record with server data and proper ID reconciliation
        const serverData = response.data as any;
        const serverId = serverData.id || data.id;
        const remoteUrl = serverData.url || serverData.signedUrl;
        
        if (serverId !== data.id && data.localId) {
          // Server returned a different ID - update the local record
          // updateLocalIdWithServerId sets id, clears local_id, and sets pending_sync=0
          const idUpdated = await this.updateLocalIdWithServerId('attachment', data.localId, serverId);
          if (!idUpdated) {
            console.error('[OfflineStorage] Failed to reconcile attachment ID');
            return false;
          }
          
          // Also update the remote URL on the new record
          const urlResult = await this.db?.runAsync(
            'UPDATE attachments SET remote_url = ? WHERE id = ?',
            [remoteUrl, serverId]
          );
          
          // Verify the URL update succeeded
          if ((urlResult as any)?.changes === 0) {
            console.error('[OfflineStorage] Failed to update remote_url after ID reconciliation');
            return false;
          }
        } else {
          // Same ID or no local ID - just update the record
          const result = await this.db?.runAsync(
            `UPDATE attachments SET 
              remote_url = ?,
              pending_sync = 0,
              sync_action = NULL
             WHERE id = ?`,
            [remoteUrl, data.id]
          );
          
          // Verify the update succeeded
          if ((result as any)?.changes === 0) {
            console.error('[OfflineStorage] Failed to update attachment record');
            return false;
          }
        }
        
        // processSyncQueue will handle sync_queue cleanup
        console.log('[OfflineStorage] Successfully uploaded attachment:', data.filename);
        return true;
      }
      
      console.error('[OfflineStorage] Unknown attachment action:', action);
      return false;
    } catch (error) {
      console.error('[OfflineStorage] Failed to sync attachment:', error);
      return false;
    }
  }

  private async markItemSynced(type: string, id: string): Promise<void> {
    if (!this.db) return;
    
    const tableMap: Record<string, string> = {
      job: 'jobs',
      client: 'clients',
      quote: 'quotes',
      invoice: 'invoices',
      timeEntry: 'time_entries',
      attachment: 'attachments',
    };
    
    const table = tableMap[type];
    if (table) {
      await this.db.runAsync(
        `UPDATE ${table} SET pending_sync = 0, sync_action = NULL WHERE id = ?`,
        [id]
      );
    }
  }

  private async updateLocalIdWithServerId(type: string, localId: string, serverId: string): Promise<boolean> {
    if (!this.db) return false;
    
    const tableMap: Record<string, string> = {
      job: 'jobs',
      client: 'clients',
      quote: 'quotes',
      invoice: 'invoices',
      timeEntry: 'time_entries',
      attachment: 'attachments',
    };
    
    const table = tableMap[type];
    if (!table) return false;
    
    // Find row by local_id (more reliable than id since id might already be the server id)
    const result = await this.db.runAsync(
      `UPDATE ${table} SET id = ?, local_id = NULL, pending_sync = 0, sync_action = NULL WHERE local_id = ?`,
      [serverId, localId]
    );
    
    if ((result as any).changes > 0) {
      console.log(`[OfflineStorage] Updated ${type} ID from ${localId} to ${serverId}`);
      return true;
    }
    
    // Fall back to id if local_id match fails (for backwards compatibility)
    const fallbackResult = await this.db.runAsync(
      `UPDATE ${table} SET id = ?, local_id = NULL, pending_sync = 0, sync_action = NULL WHERE id = ?`,
      [serverId, localId]
    );
    
    if ((fallbackResult as any).changes > 0) {
      console.log(`[OfflineStorage] Updated ${type} ID from ${localId} to ${serverId} (fallback)`);
      return true;
    }
    
    console.error(`[OfflineStorage] Failed to update ${type} ID: row not found for localId=${localId}`);
    return false;
  }

  // ============ METADATA & UTILITIES ============

  async setMetadata(key: string, value: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.runAsync(
      'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
      [key, value]
    );
  }

  async getMetadata(key: string): Promise<string | null> {
    if (!this.db) return null;
    
    const result = await this.db.getFirstAsync(
      'SELECT value FROM metadata WHERE key = ?',
      [key]
    ) as any;
    
    return result?.value ?? null;
  }

  async getLastSyncTime(type?: string): Promise<number | null> {
    const key = type ? `last_${type}_sync` : 'last_jobs_sync';
    const value = await this.getMetadata(key);
    return value ? parseInt(value, 10) : null;
  }

  async clearCache(): Promise<void> {
    if (!this.db) return;
    
    await this.db.execAsync(`
      DELETE FROM jobs;
      DELETE FROM clients;
      DELETE FROM quotes;
      DELETE FROM invoices;
      DELETE FROM time_entries;
      DELETE FROM attachments;
      DELETE FROM sync_queue;
      DELETE FROM metadata;
    `);
    
    await this.updatePendingSyncCount();
    useOfflineStore.getState().setLastSyncTime(null);
    
    console.log('[OfflineStorage] Cache cleared');
  }

  // ============ DELTA SYNC ============

  /**
   * Get the last sync timestamp for an entity type
   */
  async getDeltaSyncTimestamp(entityType: string): Promise<number | null> {
    if (!this.db) return null;
    
    const result = await this.db.getFirstAsync(
      'SELECT last_synced_at FROM delta_sync WHERE entity_type = ?',
      [entityType]
    ) as any;
    
    return result?.last_synced_at ?? null;
  }

  /**
   * Set the last sync timestamp for an entity type
   */
  async setDeltaSyncTimestamp(entityType: string, timestamp: number, serverTimestamp?: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO delta_sync (entity_type, last_synced_at, last_server_timestamp)
       VALUES (?, ?, ?)`,
      [entityType, timestamp, serverTimestamp || null]
    );
  }

  /**
   * Delta sync jobs - fetch only jobs updated since last sync
   */
  async deltaSyncJobs(): Promise<void> {
    if (!this.db || !useOfflineStore.getState().isOnline) return;
    
    try {
      const lastSync = await this.getDeltaSyncTimestamp('jobs');
      const params = lastSync ? `?since=${new Date(lastSync).toISOString()}` : '';
      
      const response = await api.get<any[]>(`/api/jobs${params}`);
      
      if (response.data && response.data.length > 0) {
        // Check for conflicts before caching
        for (const job of response.data) {
          await this.detectAndSaveConflict('job', job.id, job);
        }
        await this.cacheJobs(response.data);
      }
      
      await this.setDeltaSyncTimestamp('jobs', Date.now());
      console.log(`[OfflineStorage] Delta synced ${response.data?.length || 0} jobs`);
    } catch (error) {
      console.error('[OfflineStorage] Delta sync jobs failed:', error);
    }
  }

  /**
   * Delta sync clients - fetch only clients updated since last sync
   */
  async deltaSyncClients(): Promise<void> {
    if (!this.db || !useOfflineStore.getState().isOnline) return;
    
    try {
      const lastSync = await this.getDeltaSyncTimestamp('clients');
      const params = lastSync ? `?since=${new Date(lastSync).toISOString()}` : '';
      
      const response = await api.get<any[]>(`/api/clients${params}`);
      
      if (response.data && response.data.length > 0) {
        for (const client of response.data) {
          await this.detectAndSaveConflict('client', client.id, client);
        }
        await this.cacheClients(response.data);
      }
      
      await this.setDeltaSyncTimestamp('clients', Date.now());
      console.log(`[OfflineStorage] Delta synced ${response.data?.length || 0} clients`);
    } catch (error) {
      console.error('[OfflineStorage] Delta sync clients failed:', error);
    }
  }

  /**
   * Delta sync quotes - fetch only quotes updated since last sync
   */
  async deltaSyncQuotes(): Promise<void> {
    if (!this.db || !useOfflineStore.getState().isOnline) return;
    
    try {
      const lastSync = await this.getDeltaSyncTimestamp('quotes');
      const params = lastSync ? `?since=${new Date(lastSync).toISOString()}` : '';
      
      const response = await api.get<any[]>(`/api/quotes${params}`);
      
      if (response.data && response.data.length > 0) {
        for (const quote of response.data) {
          await this.detectAndSaveConflict('quote', quote.id, quote);
        }
        await this.cacheQuotes(response.data);
      }
      
      await this.setDeltaSyncTimestamp('quotes', Date.now());
      console.log(`[OfflineStorage] Delta synced ${response.data?.length || 0} quotes`);
    } catch (error) {
      console.error('[OfflineStorage] Delta sync quotes failed:', error);
    }
  }

  /**
   * Delta sync invoices - fetch only invoices updated since last sync
   */
  async deltaSyncInvoices(): Promise<void> {
    if (!this.db || !useOfflineStore.getState().isOnline) return;
    
    try {
      const lastSync = await this.getDeltaSyncTimestamp('invoices');
      const params = lastSync ? `?since=${new Date(lastSync).toISOString()}` : '';
      
      const response = await api.get<any[]>(`/api/invoices${params}`);
      
      if (response.data && response.data.length > 0) {
        for (const invoice of response.data) {
          await this.detectAndSaveConflict('invoice', invoice.id, invoice);
        }
        await this.cacheInvoices(response.data);
      }
      
      await this.setDeltaSyncTimestamp('invoices', Date.now());
      console.log(`[OfflineStorage] Delta synced ${response.data?.length || 0} invoices`);
    } catch (error) {
      console.error('[OfflineStorage] Delta sync invoices failed:', error);
    }
  }

  // ============ CONFLICT RESOLUTION ============

  /**
   * Detect if there's a pending local change that conflicts with server data
   */
  private async detectAndSaveConflict(
    entityType: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry',
    entityId: string,
    serverData: any
  ): Promise<boolean> {
    if (!this.db) return false;
    
    const tableMap = {
      job: 'jobs',
      client: 'clients', 
      quote: 'quotes',
      invoice: 'invoices',
      timeEntry: 'time_entries'
    };
    
    const table = tableMap[entityType];
    
    // Check if we have pending sync for this entity
    const localRow = await this.db.getFirstAsync(
      `SELECT * FROM ${table} WHERE id = ? AND pending_sync = 1`,
      [entityId]
    ) as any;
    
    if (!localRow) return false;
    
    // If this is a pending create with a local_id, the server returned the same record
    // This means our create was successful - update local ID mapping instead of conflict
    if (localRow.sync_action === 'create' && localRow.local_id) {
      console.log(`[OfflineStorage] Pending create matched server record, updating ID mapping`);
      await this.updateLocalIdWithServerId(entityType, localRow.local_id, entityId);
      return false; // Not a conflict
    }
    
    // For updates/deletes, we have a local pending change - save as conflict
    await this.saveConflict(entityType, entityId, localRow, serverData);
    return true;
  }

  /**
   * Save a conflict for later review
   */
  async saveConflict(
    entityType: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry',
    entityId: string,
    localData: any,
    serverData: any
  ): Promise<void> {
    if (!this.db) return;
    
    const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.runAsync(
      `INSERT INTO conflicts (id, entity_type, entity_id, local_data, server_data, conflicted_at, resolved)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [conflictId, entityType, entityId, JSON.stringify(localData), JSON.stringify(serverData), Date.now()]
    );
    
    await this.updateUnresolvedConflictCount();
    console.log(`[OfflineStorage] Saved conflict for ${entityType} ${entityId}`);
  }

  /**
   * Get list of conflicts
   */
  async getConflicts(resolved?: boolean): Promise<ConflictRecord[]> {
    if (!this.db) return [];
    
    let query = 'SELECT * FROM conflicts';
    const params: any[] = [];
    
    if (resolved !== undefined) {
      query += ' WHERE resolved = ?';
      params.push(resolved ? 1 : 0);
    }
    
    query += ' ORDER BY conflicted_at DESC';
    
    const rows = await this.db.getAllAsync(query, params);
    
    return rows.map((row: any) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      localData: row.local_data,
      serverData: row.server_data,
      conflictedAt: row.conflicted_at,
      resolved: row.resolved === 1,
      resolution: row.resolution,
      resolvedAt: row.resolved_at,
    }));
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'kept_server' | 'kept_local' | 'merged',
    mergedData?: any
  ): Promise<void> {
    if (!this.db) return;
    
    const conflict = await this.db.getFirstAsync(
      'SELECT * FROM conflicts WHERE id = ?',
      [conflictId]
    ) as any;
    
    if (!conflict) return;
    
    const entityType = conflict.entity_type;
    const entityId = conflict.entity_id;
    
    // Apply the resolution
    if (resolution === 'kept_server') {
      // Server data already applied, just clear pending sync
      const tableMap: Record<string, string> = {
        job: 'jobs', client: 'clients', quote: 'quotes', 
        invoice: 'invoices', timeEntry: 'time_entries'
      };
      await this.db.runAsync(
        `UPDATE ${tableMap[entityType]} SET pending_sync = 0, sync_action = NULL WHERE id = ?`,
        [entityId]
      );
      // Remove from sync queue
      await this.db.runAsync(
        'DELETE FROM sync_queue WHERE id LIKE ? AND type = ?',
        [`%${entityId}%`, entityType]
      );
    } else if (resolution === 'kept_local') {
      // Keep local and retry sync
      console.log(`[OfflineStorage] Keeping local version for ${entityType} ${entityId}`);
    } else if (resolution === 'merged' && mergedData) {
      // Apply merged data
      // This would need entity-specific logic to update the local cache
      console.log(`[OfflineStorage] Applied merged data for ${entityType} ${entityId}`);
    }
    
    // Mark conflict as resolved
    await this.db.runAsync(
      'UPDATE conflicts SET resolved = 1, resolution = ?, resolved_at = ? WHERE id = ?',
      [resolution, Date.now(), conflictId]
    );
    
    await this.updateUnresolvedConflictCount();
    await this.updatePendingSyncCount();
  }

  /**
   * Update the unresolved conflict count in the store
   */
  async updateUnresolvedConflictCount(): Promise<void> {
    if (!this.db) return;
    
    const result = await this.db.getFirstAsync(
      'SELECT COUNT(*) as count FROM conflicts WHERE resolved = 0'
    ) as any;
    
    useOfflineStore.getState().setUnresolvedConflictCount(result?.count || 0);
  }

  // ============ BACKGROUND SYNC ============

  /**
   * Register background sync task
   */
  async registerBackgroundSync(): Promise<boolean> {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      useOfflineStore.getState().setBackgroundSyncEnabled(true);
      console.log('[OfflineStorage] Background sync registered');
      return true;
    } catch (error) {
      console.error('[OfflineStorage] Failed to register background sync:', error);
      return false;
    }
  }

  /**
   * Unregister background sync task
   */
  async unregisterBackgroundSync(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      useOfflineStore.getState().setBackgroundSyncEnabled(false);
      console.log('[OfflineStorage] Background sync unregistered');
    } catch (error) {
      console.error('[OfflineStorage] Failed to unregister background sync:', error);
    }
  }

  /**
   * Execute background sync (called by task manager)
   * Returns true if sync completed successfully, false if skipped/failed
   */
  async executeBackgroundSync(): Promise<boolean> {
    console.log('[OfflineStorage] Executing background sync...');
    
    if (!useOfflineStore.getState().isOnline) {
      console.log('[OfflineStorage] Background sync skipped - offline');
      return false; // NoData - offline
    }
    
    try {
      // Sync pending changes first
      await this.syncPendingChanges();
      
      // Then do delta sync
      await Promise.all([
        this.deltaSyncJobs(),
        this.deltaSyncClients(),
        this.deltaSyncQuotes(),
        this.deltaSyncInvoices(),
      ]);
      
      useOfflineStore.getState().setLastSyncTime(Date.now());
      console.log('[OfflineStorage] Background sync complete');
      return true; // NewData
    } catch (error) {
      console.error('[OfflineStorage] Background sync failed:', error);
      throw error; // Rethrow so task handler can catch it
    }
  }

  // ============ ATTACHMENT FILE CACHING ============

  private readonly ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

  /**
   * Ensure the attachments directory exists
   */
  private async ensureAttachmentsDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.ATTACHMENTS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.ATTACHMENTS_DIR, { intermediates: true });
    }
  }

  /**
   * Download a remote attachment file to local filesystem
   */
  async downloadAttachmentFile(attachment: CachedAttachment): Promise<string | null> {
    if (!attachment.remoteUrl) return null;
    
    try {
      await this.ensureAttachmentsDir();
      
      // Sanitize filename to avoid path issues
      const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const localPath = `${this.ATTACHMENTS_DIR}${attachment.id}_${safeFilename}`;
      
      // Check if already downloaded and valid
      const existingFile = await FileSystem.getInfoAsync(localPath);
      if (existingFile.exists && 'size' in existingFile && existingFile.size > 0) {
        return localPath;
      }
      
      // Download the file
      const downloadResult = await FileSystem.downloadAsync(
        attachment.remoteUrl,
        localPath
      );
      
      if (downloadResult.status === 200) {
        // Verify file was actually written
        const newFileInfo = await FileSystem.getInfoAsync(localPath);
        if (!newFileInfo.exists) {
          console.error('[OfflineStorage] Download reported success but file not found');
          return null;
        }
        
        // Update the local cache with local_uri - with compensating cleanup on failure
        if (this.db) {
          try {
            await this.db.runAsync(
              'UPDATE attachments SET local_uri = ? WHERE id = ?',
              [localPath, attachment.id]
            );
          } catch (dbError) {
            // DB update failed - remove downloaded file to stay consistent
            console.error('[OfflineStorage] DB update failed, cleaning up file:', dbError);
            await FileSystem.deleteAsync(localPath, { idempotent: true });
            return null;
          }
        }
        
        console.log(`[OfflineStorage] Downloaded attachment: ${attachment.filename}`);
        return localPath;
      }
      
      console.error(`[OfflineStorage] Download failed with status: ${downloadResult.status}`);
      return null;
    } catch (error) {
      console.error('[OfflineStorage] Failed to download attachment:', error);
      return null;
    }
  }

  /**
   * Get local URI for an attachment if cached
   */
  async getLocalAttachmentUri(attachmentId: string): Promise<string | null> {
    if (!this.db) return null;
    
    const result = await this.db.getFirstAsync(
      'SELECT local_uri FROM attachments WHERE id = ?',
      [attachmentId]
    ) as any;
    
    if (!result?.local_uri) return null;
    
    // Verify file still exists
    const fileInfo = await FileSystem.getInfoAsync(result.local_uri);
    if (!fileInfo.exists) {
      // Clear the stale local_uri
      await this.db.runAsync(
        'UPDATE attachments SET local_uri = NULL WHERE id = ?',
        [attachmentId]
      );
      return null;
    }
    
    return result.local_uri;
  }

  /**
   * Cache all remote attachments for a job
   */
  async cacheRemoteAttachments(jobId: string): Promise<void> {
    if (!this.db) return;
    
    const attachments = await this.db.getAllAsync(
      'SELECT * FROM attachments WHERE job_id = ? AND remote_url IS NOT NULL AND local_uri IS NULL',
      [jobId]
    ) as any[];
    
    console.log(`[OfflineStorage] Caching ${attachments.length} attachments for job ${jobId}`);
    
    for (const row of attachments) {
      const attachment: CachedAttachment = {
        id: row.id,
        jobId: row.job_id,
        quoteId: row.quote_id,
        invoiceId: row.invoice_id,
        clientId: row.client_id,
        type: row.type,
        filename: row.filename,
        mimeType: row.mime_type,
        localUri: row.local_uri,
        remoteUrl: row.remote_url,
        fileSize: row.file_size,
        description: row.description,
        cachedAt: row.cached_at,
        pendingSync: row.pending_sync === 1,
        syncAction: row.sync_action,
        localId: row.local_id,
      };
      
      await this.downloadAttachmentFile(attachment);
    }
  }

  /**
   * Clear cached attachment files to free up space
   */
  async clearAttachmentCache(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.ATTACHMENTS_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.ATTACHMENTS_DIR, { idempotent: true });
        console.log('[OfflineStorage] Cleared attachment cache');
      }
      
      // Clear local_uri from database
      if (this.db) {
        await this.db.runAsync('UPDATE attachments SET local_uri = NULL WHERE remote_url IS NOT NULL');
      }
    } catch (error) {
      console.error('[OfflineStorage] Failed to clear attachment cache:', error);
    }
  }

  /**
   * Get total size of cached attachments
   */
  async getAttachmentCacheSize(): Promise<number> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.ATTACHMENTS_DIR);
      if (!dirInfo.exists) return 0;
      
      const files = await FileSystem.readDirectoryAsync(this.ATTACHMENTS_DIR);
      let totalSize = 0;
      
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${this.ATTACHMENTS_DIR}${file}`);
        if (fileInfo.exists && 'size' in fileInfo) {
          totalSize += fileInfo.size || 0;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('[OfflineStorage] Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * Full sync - download all data from server and cache locally
   */
  async fullSync(): Promise<void> {
    if (!useOfflineStore.getState().isOnline) {
      console.log('[OfflineStorage] Cannot full sync - offline');
      return;
    }
    
    useOfflineStore.getState().setSyncing(true);
    
    try {
      // First sync any pending changes
      await this.syncPendingChanges();
      
      // Then download fresh data
      const [jobsRes, clientsRes, quotesRes, invoicesRes] = await Promise.all([
        api.get<any[]>('/api/jobs'),
        api.get<any[]>('/api/clients'),
        api.get<any[]>('/api/quotes'),
        api.get<any[]>('/api/invoices'),
      ]);
      
      if (jobsRes.data) await this.cacheJobs(jobsRes.data);
      if (clientsRes.data) await this.cacheClients(clientsRes.data);
      if (quotesRes.data) await this.cacheQuotes(quotesRes.data);
      if (invoicesRes.data) await this.cacheInvoices(invoicesRes.data);
      
      useOfflineStore.getState().setLastSyncTime(Date.now());
      console.log('[OfflineStorage] Full sync complete');
    } catch (error) {
      console.error('[OfflineStorage] Full sync failed:', error);
    } finally {
      useOfflineStore.getState().setSyncing(false);
    }
  }

  /**
   * Remove an item from cache by entity type and id
   */
  async removeFromCache(entityType: 'jobs' | 'clients' | 'quotes' | 'invoices', id: string): Promise<void> {
    if (!this.db) return;
    
    try {
      await this.db.runAsync(
        `DELETE FROM ${entityType} WHERE id = ?`,
        [id]
      );
      console.log(`[OfflineStorage] Removed ${entityType} ${id} from cache`);
    } catch (error) {
      console.error(`[OfflineStorage] Failed to remove ${entityType} from cache:`, error);
    }
  }

  /**
   * Cleanup - remove network listener
   */
  cleanup(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }

  // ============ CACHED AUTH DATA ============
  // Note: NO passwords or credentials are stored - only user profile data and settings
  // Session tokens are handled separately by SecureStore in api.ts

  /**
   * Cache user and business settings for offline access
   * This enables the app to work offline with cached user data
   */
  async cacheAuthData(userData: any, businessSettings: any, roleInfo?: any): Promise<void> {
    if (!this.db) return;
    
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO cached_auth (id, user_data, business_settings, role_info, cached_at)
         VALUES ('current_user', ?, ?, ?, ?)`,
        [
          JSON.stringify(userData),
          JSON.stringify(businessSettings),
          roleInfo ? JSON.stringify(roleInfo) : null,
          Date.now()
        ]
      );
      console.log('[OfflineStorage] Cached auth data for offline access');
    } catch (error) {
      console.error('[OfflineStorage] Failed to cache auth data:', error);
    }
  }

  /**
   * Get cached auth data for offline login
   * Returns null if no cached data or cache is too old (7 days)
   */
  async getCachedAuthData(): Promise<{
    userData: any;
    businessSettings: any;
    roleInfo: any;
    cachedAt: number;
  } | null> {
    if (!this.db) return null;
    
    try {
      const result = await this.db.getFirstAsync(
        'SELECT user_data, business_settings, role_info, cached_at FROM cached_auth WHERE id = ?',
        ['current_user']
      ) as any;
      
      if (!result) return null;
      
      // Check if cache is too old (7 days)
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - result.cached_at > sevenDaysMs) {
        console.log('[OfflineStorage] Cached auth data expired (>7 days old)');
        return null;
      }
      
      return {
        userData: result.user_data ? JSON.parse(result.user_data) : null,
        businessSettings: result.business_settings ? JSON.parse(result.business_settings) : null,
        roleInfo: result.role_info ? JSON.parse(result.role_info) : null,
        cachedAt: result.cached_at,
      };
    } catch (error) {
      console.error('[OfflineStorage] Failed to get cached auth data:', error);
      return null;
    }
  }

  /**
   * Clear cached auth data (on logout)
   */
  async clearCachedAuthData(): Promise<void> {
    if (!this.db) return;
    
    try {
      await this.db.runAsync('DELETE FROM cached_auth');
      console.log('[OfflineStorage] Cleared cached auth data');
    } catch (error) {
      console.error('[OfflineStorage] Failed to clear cached auth data:', error);
    }
  }

  /**
   * Check if we have valid cached auth data for offline use
   */
  async hasCachedAuth(): Promise<boolean> {
    const cached = await this.getCachedAuthData();
    return cached !== null && cached.userData !== null;
  }
}

export const offlineStorage = new OfflineStorageService();
export default offlineStorage;

// ============ BACKGROUND TASK DEFINITION ============
// Define the background sync task handler
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log('[BackgroundSync] Task started');
    const hasNewData = await offlineStorage.executeBackgroundSync();
    if (hasNewData) {
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundSync] Task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

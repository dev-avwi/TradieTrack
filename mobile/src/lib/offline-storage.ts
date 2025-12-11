/**
 * Offline Storage Module using SQLite
 * 
 * Provides local caching of jobs, clients, quotes, invoices, and time entries
 * for offline access. Automatically syncs with the server when connectivity is restored.
 * 
 * Uses expo-sqlite for local database storage.
 */

import * as SQLite from 'expo-sqlite';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';
import api from './api';

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

export interface PendingSyncItem {
  id: string;
  type: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry';
  action: 'create' | 'update' | 'delete';
  data: string; // JSON stringified
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

// ============ OFFLINE STATE STORE ============

interface OfflineState {
  isOnline: boolean;
  isInitialized: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingSyncCount: number;
  syncError: string | null;
  
  setOnline: (online: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number | null) => void;
  setPendingSyncCount: (count: number) => void;
  setSyncError: (error: string | null) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  isInitialized: false,
  isSyncing: false,
  lastSyncTime: null,
  pendingSyncCount: 0,
  syncError: null,
  
  setOnline: (online) => set({ isOnline: online }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setSyncError: (error) => set({ syncError: error }),
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
        
        -- Sync queue for pending changes
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          action TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER DEFAULT 0,
          last_error TEXT
        );
        
        -- Metadata for sync timestamps
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      
      // Set up network listener
      this.networkUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange);
      
      // Check initial network state
      const netState = await NetInfo.fetch();
      useOfflineStore.getState().setOnline(netState.isConnected ?? false);
      useOfflineStore.getState().setInitialized(true);
      
      // Update pending count
      await this.updatePendingSyncCount();
      
      console.log('[OfflineStorage] Initialized successfully');
    } catch (error) {
      console.error('[OfflineStorage] Initialization failed:', error);
      throw error;
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
      [id, job.title || '', job.description, job.address, job.status || 'pending', 
       job.scheduledAt, job.clientId, job.clientName, job.assignedTo, job.notes, now, action, localId]
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
        [updated.title, updated.description, updated.address, updated.status, updated.scheduledAt,
         updated.clientId, updated.clientName, updated.assignedTo, updated.notes,
         now, 'update', jobId]
      );
      
      await this.addToSyncQueue('job', 'update', { id: jobId, ...updates });
      await this.updatePendingSyncCount();
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
      [id, client.name || '', client.email, client.phone, client.address, client.notes, now, action, localId]
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
        [updated.name, updated.email, updated.phone, updated.address, updated.notes,
         now, 'update', clientId]
      );
      
      await this.addToSyncQueue('client', 'update', { id: clientId, ...updates });
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
        [updated.status, updated.subtotal, updated.gstAmount, updated.total, updated.validUntil, updated.notes,
         now, 'update', quoteId]
      );
      
      await this.addToSyncQueue('quote', 'update', { id: quoteId, ...updates });
      await this.updatePendingSyncCount();
    }
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
        [updated.status, updated.subtotal, updated.gstAmount, updated.total, updated.amountPaid, updated.dueDate, updated.paidAt, updated.notes,
         now, 'update', invoiceId]
      );
      
      await this.addToSyncQueue('invoice', 'update', { id: invoiceId, ...updates });
      await this.updatePendingSyncCount();
    }
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
      [id, entry.userId || '', entry.jobId, entry.description, entry.startTime || new Date().toISOString(), entry.endTime, entry.notes, now, action, localId]
    );
    
    await this.addToSyncQueue('timeEntry', action, { ...entry, id, localId });
    await this.updatePendingSyncCount();
    
    return { ...entry, id, cachedAt: now, pendingSync: true, syncAction: action, localId } as CachedTimeEntry;
  }

  // ============ SYNC QUEUE ============

  private async addToSyncQueue(
    type: 'job' | 'client' | 'quote' | 'invoice' | 'timeEntry',
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

  async getPendingSyncItems(): Promise<PendingSyncItem[]> {
    if (!this.db) return [];
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      action: row.action,
      data: row.data,
      createdAt: row.created_at,
      retryCount: row.retry_count,
      lastError: row.last_error,
    }));
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
          const success = await this.syncItem(item.type, item.action, data);
          
          if (success) {
            // Remove from queue
            await this.db!.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
            
            // Update the cached item to mark as synced
            await this.markItemSynced(item.type, data.id);
            synced++;
          } else {
            // Increment retry count
            await this.db!.runAsync(
              'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
              [item.id]
            );
            failed++;
          }
        } catch (error: any) {
          console.error(`[OfflineStorage] Failed to sync item ${item.id}:`, error);
          
          // Update with error
          await this.db!.runAsync(
            'UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?',
            [error.message || 'Unknown error', item.id]
          );
          failed++;
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

  private async markItemSynced(type: string, id: string): Promise<void> {
    if (!this.db) return;
    
    const tableMap: Record<string, string> = {
      job: 'jobs',
      client: 'clients',
      quote: 'quotes',
      invoice: 'invoices',
      timeEntry: 'time_entries',
    };
    
    const table = tableMap[type];
    if (table) {
      await this.db.runAsync(
        `UPDATE ${table} SET pending_sync = 0, sync_action = NULL WHERE id = ?`,
        [id]
      );
    }
  }

  private async updateLocalIdWithServerId(type: string, localId: string, serverId: string): Promise<void> {
    if (!this.db) return;
    
    const tableMap: Record<string, string> = {
      job: 'jobs',
      client: 'clients',
      quote: 'quotes',
      invoice: 'invoices',
      timeEntry: 'time_entries',
    };
    
    const table = tableMap[type];
    if (table) {
      await this.db.runAsync(
        `UPDATE ${table} SET id = ?, local_id = NULL, pending_sync = 0, sync_action = NULL WHERE id = ?`,
        [serverId, localId]
      );
    }
  }

  // ============ METADATA & UTILITIES ============

  private async setMetadata(key: string, value: string): Promise<void> {
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
      DELETE FROM sync_queue;
      DELETE FROM metadata;
    `);
    
    await this.updatePendingSyncCount();
    useOfflineStore.getState().setLastSyncTime(null);
    
    console.log('[OfflineStorage] Cache cleared');
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
}

export const offlineStorage = new OfflineStorageService();
export default offlineStorage;

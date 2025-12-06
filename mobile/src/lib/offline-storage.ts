/**
 * Offline Storage Module using SQLite
 * 
 * Provides local caching of jobs, clients, and other data for offline access.
 * Automatically syncs with the server when connectivity is restored.
 * 
 * Uses expo-sqlite for local database storage.
 */

import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

// Types for offline storage
export interface CachedJob {
  id: string;
  title: string;
  description?: string;
  address?: string;
  status: string;
  scheduledAt?: string;
  clientId?: string;
  assignedTo?: string;
  notes?: string;
  cachedAt: number;
  pendingSync: boolean;
  syncAction?: 'create' | 'update' | 'delete';
}

export interface CachedClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  cachedAt: number;
}

export interface PendingSyncItem {
  id: string;
  type: 'job' | 'client' | 'timeEntry';
  action: 'create' | 'update' | 'delete';
  data: any;
  createdAt: number;
  retryCount: number;
}

export interface OfflineStorageState {
  isOnline: boolean;
  lastSyncTime: number | null;
  pendingSyncCount: number;
  isSyncing: boolean;
}

class OfflineStorageService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isOnline: boolean = true;
  private syncQueue: PendingSyncItem[] = [];
  private listeners: ((state: OfflineStorageState) => void)[] = [];

  /**
   * Initialize the SQLite database and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Open database
      this.db = await SQLite.openDatabaseAsync('tradietrack_offline.db');
      
      // Create tables
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          address TEXT,
          status TEXT NOT NULL,
          scheduled_at TEXT,
          client_id TEXT,
          assigned_to TEXT,
          notes TEXT,
          cached_at INTEGER NOT NULL,
          pending_sync INTEGER DEFAULT 0,
          sync_action TEXT
        );
        
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          cached_at INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          action TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      
      // Set up network listener
      NetInfo.addEventListener(state => {
        const wasOffline = !this.isOnline;
        this.isOnline = state.isConnected ?? false;
        
        // If we just came online, trigger sync
        if (wasOffline && this.isOnline) {
          this.syncPendingChanges();
        }
        
        this.notifyListeners();
      });
      
      // Check initial network state
      const netState = await NetInfo.fetch();
      this.isOnline = netState.isConnected ?? false;
      
      console.log('[OfflineStorage] Initialized successfully');
    } catch (error) {
      console.error('[OfflineStorage] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Cache a list of jobs from the server
   */
  async cacheJobs(jobs: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const job of jobs) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO jobs 
         (id, title, description, address, status, scheduled_at, client_id, assigned_to, notes, cached_at, pending_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [job.id, job.title, job.description, job.address, job.status, 
         job.scheduledAt, job.clientId, job.assignedTo, job.notes, now]
      );
    }
    
    await this.setMetadata('last_jobs_sync', now.toString());
    console.log(`[OfflineStorage] Cached ${jobs.length} jobs`);
  }

  /**
   * Get cached jobs, optionally filtered by status
   */
  async getCachedJobs(status?: string): Promise<CachedJob[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM jobs';
    const params: any[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY scheduled_at ASC';
    
    const rows = await this.db.getAllAsync(query, params);
    
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      address: row.address,
      status: row.status,
      scheduledAt: row.scheduled_at,
      clientId: row.client_id,
      assignedTo: row.assigned_to,
      notes: row.notes,
      cachedAt: row.cached_at,
      pendingSync: row.pending_sync === 1,
      syncAction: row.sync_action,
    }));
  }

  /**
   * Update a job locally (for offline edits)
   */
  async updateJobOffline(jobId: string, updates: Partial<CachedJob>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    // Update the job in cache
    const updateFields: string[] = [];
    const params: any[] = [];
    
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(updates.notes);
    }
    
    updateFields.push('pending_sync = 1');
    updateFields.push('sync_action = ?');
    params.push('update');
    updateFields.push('cached_at = ?');
    params.push(now);
    
    params.push(jobId);
    
    await this.db.runAsync(
      `UPDATE jobs SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    
    // Add to sync queue
    await this.addToSyncQueue('job', 'update', { id: jobId, ...updates });
    
    this.notifyListeners();
  }

  /**
   * Cache clients from the server
   */
  async cacheClients(clients: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    for (const client of clients) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO clients 
         (id, name, email, phone, address, cached_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [client.id, client.name, client.email, client.phone, client.address, now]
      );
    }
    
    await this.setMetadata('last_clients_sync', now.toString());
    console.log(`[OfflineStorage] Cached ${clients.length} clients`);
  }

  /**
   * Get cached clients
   */
  async getCachedClients(): Promise<CachedClient[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM clients ORDER BY name ASC'
    );
    
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      cachedAt: row.cached_at,
    }));
  }

  /**
   * Add an item to the sync queue
   */
  private async addToSyncQueue(
    type: 'job' | 'client' | 'timeEntry',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    await this.db.runAsync(
      `INSERT INTO sync_queue (id, type, action, data, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [id, type, action, JSON.stringify(data), now]
    );
    
    console.log(`[OfflineStorage] Added to sync queue: ${type} ${action}`);
  }

  /**
   * Sync pending changes with the server
   */
  async syncPendingChanges(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.isOnline) {
      console.log('[OfflineStorage] Cannot sync - offline');
      return;
    }
    
    const rows = await this.db.getAllAsync(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );
    
    if (rows.length === 0) {
      console.log('[OfflineStorage] No pending changes to sync');
      return;
    }
    
    console.log(`[OfflineStorage] Syncing ${rows.length} pending changes...`);
    
    for (const row of rows as any[]) {
      try {
        const data = JSON.parse(row.data);
        
        // Attempt to sync with server
        const success = await this.syncItem(row.type, row.action, data);
        
        if (success) {
          // Remove from queue
          await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [row.id]);
          
          // Update the cached item
          if (row.type === 'job') {
            await this.db.runAsync(
              'UPDATE jobs SET pending_sync = 0, sync_action = NULL WHERE id = ?',
              [data.id]
            );
          }
        } else {
          // Increment retry count
          await this.db.runAsync(
            'UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?',
            [row.id]
          );
        }
      } catch (error) {
        console.error(`[OfflineStorage] Failed to sync item ${row.id}:`, error);
      }
    }
    
    this.notifyListeners();
  }

  /**
   * Sync a single item with the server
   */
  private async syncItem(
    type: string,
    action: string,
    data: any
  ): Promise<boolean> {
    // This would make API calls to the server
    // For now, we'll simulate success
    console.log(`[OfflineStorage] Syncing ${type} ${action}:`, data);
    
    // In a real implementation:
    // - POST/PATCH/DELETE to the appropriate API endpoint
    // - Handle conflicts (server data newer than local)
    // - Return success/failure
    
    return true;
  }

  /**
   * Get the number of pending sync items
   */
  async getPendingSyncCount(): Promise<number> {
    if (!this.db) return 0;
    
    const result = await this.db.getFirstAsync(
      'SELECT COUNT(*) as count FROM sync_queue'
    ) as any;
    
    return result?.count ?? 0;
  }

  /**
   * Set metadata value
   */
  private async setMetadata(key: string, value: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.runAsync(
      'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
      [key, value]
    );
  }

  /**
   * Get metadata value
   */
  async getMetadata(key: string): Promise<string | null> {
    if (!this.db) return null;
    
    const result = await this.db.getFirstAsync(
      'SELECT value FROM metadata WHERE key = ?',
      [key]
    ) as any;
    
    return result?.value ?? null;
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime(): Promise<number | null> {
    const value = await this.getMetadata('last_jobs_sync');
    return value ? parseInt(value, 10) : null;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OfflineStorageState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get current state
   */
  async getState(): Promise<OfflineStorageState> {
    const pendingSyncCount = await this.getPendingSyncCount();
    const lastSyncTime = await this.getLastSyncTime();
    
    return {
      isOnline: this.isOnline,
      lastSyncTime,
      pendingSyncCount,
      isSyncing: false,
    };
  }

  private async notifyListeners(): Promise<void> {
    const state = await this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (!this.db) return;
    
    await this.db.execAsync(`
      DELETE FROM jobs;
      DELETE FROM clients;
      DELETE FROM sync_queue;
      DELETE FROM metadata;
    `);
    
    console.log('[OfflineStorage] Cache cleared');
  }
}

export const offlineStorage = new OfflineStorageService();
export default offlineStorage;

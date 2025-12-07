import { getDatabase } from './database';
import NetInfo from '@react-native-community/netinfo';
import api from './api';

interface MutationQueueItem {
  id: number;
  table_name: string;
  record_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  created_at: string;
  synced_at: string | null;
  retry_count: number;
  error: string | null;
}

interface SyncMetadata {
  table_name: string;
  last_synced_at: string | null;
  last_cursor: string | null;
}

class OfflineStore {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private unsubscribeNetInfo: (() => void) | null = null;

  async initialize(): Promise<void> {
    await getDatabase();
    this.startNetworkMonitoring();
    console.log('[OfflineStore] Initialized');
  }

  private startNetworkMonitoring(): void {
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOffline && this.isOnline) {
        console.log('[OfflineStore] Back online - starting sync');
        this.syncAll();
      }
    });
  }

  async isNetworkAvailable(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  async getClients(): Promise<any[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync('SELECT * FROM clients ORDER BY name ASC');
    return results;
  }

  async getClient(id: string): Promise<any | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync('SELECT * FROM clients WHERE id = ?', [id]);
    return result || null;
  }

  async saveClient(client: any): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT OR REPLACE INTO clients (
        id, user_id, name, email, phone, address, city, state, postal_code, 
        country, notes, latitude, longitude, created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client.id, client.userId, client.name, client.email, client.phone,
      client.address, client.city, client.state, client.postalCode,
      client.country || 'Australia', client.notes, client.latitude, client.longitude,
      client.createdAt, client.updatedAt, client.isDirty || 0
    ]);
  }

  async saveClients(clients: any[]): Promise<void> {
    const db = await getDatabase();
    for (const client of clients) {
      await this.saveClient(client);
    }
  }

  async getJobs(): Promise<any[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync('SELECT * FROM jobs ORDER BY scheduled_at DESC');
    return results;
  }

  async getJob(id: string): Promise<any | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync('SELECT * FROM jobs WHERE id = ?', [id]);
    return result || null;
  }

  async saveJob(job: any): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT OR REPLACE INTO jobs (
        id, user_id, client_id, title, description, status, priority,
        address, city, latitude, longitude, scheduled_at, started_at,
        completed_at, estimated_hours, actual_hours, assigned_to,
        created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      job.id, job.userId, job.clientId, job.title, job.description,
      job.status, job.priority, job.address, job.city, job.latitude,
      job.longitude, job.scheduledAt, job.startedAt, job.completedAt,
      job.estimatedHours, job.actualHours, job.assignedTo,
      job.createdAt, job.updatedAt, job.isDirty || 0
    ]);
  }

  async saveJobs(jobs: any[]): Promise<void> {
    for (const job of jobs) {
      await this.saveJob(job);
    }
  }

  async getQuotes(): Promise<any[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync('SELECT * FROM quotes ORDER BY created_at DESC');
    return results;
  }

  async saveQuote(quote: any): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT OR REPLACE INTO quotes (
        id, user_id, client_id, job_id, quote_number, status,
        subtotal, gst, total, deposit_amount, deposit_percentage,
        valid_until, notes, terms, sent_at, accepted_at,
        created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      quote.id, quote.userId, quote.clientId, quote.jobId, quote.quoteNumber,
      quote.status, quote.subtotal, quote.gst, quote.total,
      quote.depositAmount, quote.depositPercentage, quote.validUntil,
      quote.notes, quote.terms, quote.sentAt, quote.acceptedAt,
      quote.createdAt, quote.updatedAt, quote.isDirty || 0
    ]);
  }

  async getInvoices(): Promise<any[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync('SELECT * FROM invoices ORDER BY created_at DESC');
    return results;
  }

  async saveInvoice(invoice: any): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT OR REPLACE INTO invoices (
        id, user_id, client_id, job_id, quote_id, invoice_number, status,
        subtotal, gst, total, amount_paid, due_date, notes, terms,
        sent_at, paid_at, created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice.id, invoice.userId, invoice.clientId, invoice.jobId, invoice.quoteId,
      invoice.invoiceNumber, invoice.status, invoice.subtotal, invoice.gst,
      invoice.total, invoice.amountPaid, invoice.dueDate, invoice.notes,
      invoice.terms, invoice.sentAt, invoice.paidAt, invoice.createdAt,
      invoice.updatedAt, invoice.isDirty || 0
    ]);
  }

  async getAssets(): Promise<any[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync('SELECT * FROM assets ORDER BY name ASC');
    return results;
  }

  async saveAsset(asset: any): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT OR REPLACE INTO assets (
        id, user_id, name, type, serial_number, purchase_date,
        purchase_price, condition, notes, photo_url, next_maintenance_date,
        created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      asset.id, asset.userId, asset.name, asset.type, asset.serialNumber,
      asset.purchaseDate, asset.purchasePrice, asset.condition, asset.notes,
      asset.photoUrl, asset.nextMaintenanceDate, asset.createdAt,
      asset.updatedAt, asset.isDirty || 0
    ]);
  }

  async getMessages(chatType?: string, jobId?: string): Promise<any[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM messages';
    const params: any[] = [];
    
    if (chatType || jobId) {
      query += ' WHERE';
      if (chatType) {
        query += ' chat_type = ?';
        params.push(chatType);
      }
      if (jobId) {
        if (chatType) query += ' AND';
        query += ' job_id = ?';
        params.push(jobId);
      }
    }
    
    query += ' ORDER BY created_at DESC LIMIT 100';
    return await db.getAllAsync(query, params);
  }

  async saveMessage(message: any): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT OR REPLACE INTO messages (
        id, sender_id, recipient_id, job_id, chat_type, content,
        read_at, created_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      message.id, message.senderId, message.recipientId, message.jobId,
      message.chatType, message.content, message.readAt, message.createdAt,
      message.isDirty || 0
    ]);
  }

  async getTimeEntries(jobId?: string): Promise<any[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM time_entries';
    const params: any[] = [];
    
    if (jobId) {
      query += ' WHERE job_id = ?';
      params.push(jobId);
    }
    
    query += ' ORDER BY started_at DESC';
    return await db.getAllAsync(query, params);
  }

  async saveTimeEntry(entry: any): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT OR REPLACE INTO time_entries (
        id, user_id, job_id, started_at, ended_at, duration_minutes,
        notes, created_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entry.id, entry.userId, entry.jobId, entry.startedAt, entry.endedAt,
      entry.durationMinutes, entry.notes, entry.createdAt, entry.isDirty || 0
    ]);
  }

  async addToMutationQueue(
    tableName: string,
    recordId: string,
    operation: 'create' | 'update' | 'delete',
    payload: any
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT INTO mutation_queue (table_name, record_id, operation, payload, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [tableName, recordId, operation, JSON.stringify(payload)]);
    console.log(`[OfflineStore] Added to mutation queue: ${operation} ${tableName}/${recordId}`);
  }

  async getPendingMutations(): Promise<MutationQueueItem[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<MutationQueueItem>(
      'SELECT * FROM mutation_queue WHERE synced_at IS NULL ORDER BY created_at ASC'
    );
    return results;
  }

  async markMutationSynced(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE mutation_queue SET synced_at = datetime('now') WHERE id = ?",
      [id]
    );
  }

  async markMutationFailed(id: number, error: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE mutation_queue SET retry_count = retry_count + 1, error = ? WHERE id = ?',
      [error, id]
    );
  }

  async saveLocationHistory(location: {
    userId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    altitude?: number;
    batteryLevel?: number;
    activityType?: string;
  }): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT INTO location_history (
        user_id, latitude, longitude, accuracy, speed, heading,
        altitude, battery_level, activity_type, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      location.userId, location.latitude, location.longitude,
      location.accuracy, location.speed, location.heading,
      location.altitude, location.batteryLevel, location.activityType
    ]);
  }

  async getUnsyncedLocations(): Promise<any[]> {
    const db = await getDatabase();
    return await db.getAllAsync(
      'SELECT * FROM location_history WHERE synced_at IS NULL ORDER BY recorded_at ASC LIMIT 100'
    );
  }

  async markLocationsSynced(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE location_history SET synced_at = datetime('now') WHERE id IN (${placeholders})`,
      ids
    );
  }

  async savePushToken(userId: string, token: string, platform: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      INSERT OR REPLACE INTO push_tokens (user_id, token, platform)
      VALUES (?, ?, ?)
    `, [userId, token, platform]);
  }

  async syncAll(): Promise<void> {
    if (this.syncInProgress) {
      console.log('[OfflineStore] Sync already in progress');
      return;
    }
    
    if (!await this.isNetworkAvailable()) {
      console.log('[OfflineStore] No network - skipping sync');
      return;
    }

    this.syncInProgress = true;
    console.log('[OfflineStore] Starting full sync');

    try {
      await this.syncMutationQueue();
      await this.syncLocationHistory();
      await this.pullLatestData();
    } catch (error) {
      console.error('[OfflineStore] Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncMutationQueue(): Promise<void> {
    const mutations = await this.getPendingMutations();
    console.log(`[OfflineStore] Processing ${mutations.length} pending mutations`);

    for (const mutation of mutations) {
      if (mutation.retry_count >= 5) {
        console.warn(`[OfflineStore] Skipping mutation ${mutation.id} - max retries exceeded`);
        continue;
      }

      try {
        const payload = JSON.parse(mutation.payload);
        let endpoint = '';
        let method = 'POST';

        switch (mutation.table_name) {
          case 'clients':
            endpoint = mutation.operation === 'create' 
              ? '/api/clients' 
              : `/api/clients/${mutation.record_id}`;
            method = mutation.operation === 'delete' ? 'DELETE' : 
                     mutation.operation === 'update' ? 'PATCH' : 'POST';
            break;
          case 'jobs':
            endpoint = mutation.operation === 'create'
              ? '/api/jobs'
              : `/api/jobs/${mutation.record_id}`;
            method = mutation.operation === 'delete' ? 'DELETE' :
                     mutation.operation === 'update' ? 'PATCH' : 'POST';
            break;
          case 'time_entries':
            endpoint = mutation.operation === 'create'
              ? '/api/time-entries'
              : `/api/time-entries/${mutation.record_id}`;
            method = mutation.operation === 'delete' ? 'DELETE' :
                     mutation.operation === 'update' ? 'PATCH' : 'POST';
            break;
          case 'quotes':
            endpoint = mutation.operation === 'create'
              ? '/api/quotes'
              : `/api/quotes/${mutation.record_id}`;
            method = mutation.operation === 'delete' ? 'DELETE' :
                     mutation.operation === 'update' ? 'PATCH' : 'POST';
            break;
          case 'invoices':
            endpoint = mutation.operation === 'create'
              ? '/api/invoices'
              : `/api/invoices/${mutation.record_id}`;
            method = mutation.operation === 'delete' ? 'DELETE' :
                     mutation.operation === 'update' ? 'PATCH' : 'POST';
            break;
          case 'assets':
            endpoint = mutation.operation === 'create'
              ? '/api/assets'
              : `/api/assets/${mutation.record_id}`;
            method = mutation.operation === 'delete' ? 'DELETE' :
                     mutation.operation === 'update' ? 'PATCH' : 'POST';
            break;
          case 'messages':
            endpoint = '/api/messages';
            method = 'POST';
            break;
          default:
            console.warn(`[OfflineStore] Unknown table: ${mutation.table_name}`);
            continue;
        }

        const response = await api.request(method, endpoint, mutation.operation !== 'delete' ? payload : undefined);
        
        if (response && mutation.operation === 'create' && mutation.record_id.startsWith('temp-')) {
          await this.reconcileTempId(mutation.table_name, mutation.record_id, response.id);
        }
        
        await this.markMutationSynced(mutation.id);
        
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE ${mutation.table_name} SET is_dirty = 0 WHERE id = ?`,
          [mutation.record_id]
        );
        
        console.log(`[OfflineStore] Synced mutation ${mutation.id}`);
      } catch (error: any) {
        if (error.status === 409) {
          console.log(`[OfflineStore] Conflict detected for ${mutation.id}, using last-write-wins`);
          await this.markMutationSynced(mutation.id);
        } else {
          await this.markMutationFailed(mutation.id, error.message);
          console.error(`[OfflineStore] Failed to sync mutation ${mutation.id}:`, error);
        }
      }
    }
  }

  private async reconcileTempId(tableName: string, tempId: string, realId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE ${tableName} SET id = ? WHERE id = ?`,
      [realId, tempId]
    );
    console.log(`[OfflineStore] Reconciled ${tableName} temp ID ${tempId} -> ${realId}`);
  }

  private async syncLocationHistory(): Promise<void> {
    const locations = await this.getUnsyncedLocations();
    if (locations.length === 0) return;

    try {
      await api.post('/api/team/location/batch', { locations });
      const ids = locations.map((l: any) => l.id);
      await this.markLocationsSynced(ids);
      console.log(`[OfflineStore] Synced ${locations.length} locations`);
    } catch (error) {
      console.error('[OfflineStore] Failed to sync locations:', error);
    }
  }

  private async pullLatestData(): Promise<void> {
    try {
      const [clients, jobs, quotes, invoices] = await Promise.all([
        api.get('/api/clients'),
        api.get('/api/jobs'),
        api.get('/api/quotes'),
        api.get('/api/invoices'),
      ]);

      if (clients) await this.saveClients(clients);
      if (jobs) await this.saveJobs(jobs);
      for (const quote of (quotes || [])) {
        await this.saveQuote(quote);
      }
      for (const invoice of (invoices || [])) {
        await this.saveInvoice(invoice);
      }

      console.log('[OfflineStore] Pulled latest data from server');
    } catch (error) {
      console.error('[OfflineStore] Failed to pull data:', error);
    }
  }

  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }
}

export const offlineStore = new OfflineStore();
export default offlineStore;

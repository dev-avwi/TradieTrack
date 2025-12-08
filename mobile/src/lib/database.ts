import * as SQLite from 'expo-sqlite';

const DB_NAME = 'tradietrack.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    
    -- Sync metadata table
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL UNIQUE,
      last_synced_at TEXT,
      last_cursor TEXT
    );
    
    -- Mutation queue for offline changes
    CREATE TABLE IF NOT EXISTS mutation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      retry_count INTEGER DEFAULT 0,
      error TEXT
    );
    
    -- Cached user session for offline auth
    CREATE TABLE IF NOT EXISTS user_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_data TEXT NOT NULL,
      business_settings TEXT,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    -- Clients table
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT DEFAULT 'Australia',
      notes TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT,
      updated_at TEXT,
      is_dirty INTEGER DEFAULT 0
    );
    
    -- Jobs table
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      address TEXT,
      city TEXT,
      latitude REAL,
      longitude REAL,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      estimated_hours REAL,
      actual_hours REAL,
      assigned_to TEXT,
      created_at TEXT,
      updated_at TEXT,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );
    
    -- Quotes table
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT,
      job_id TEXT,
      quote_number TEXT,
      status TEXT DEFAULT 'draft',
      subtotal INTEGER DEFAULT 0,
      gst INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      deposit_amount INTEGER,
      deposit_percentage REAL,
      valid_until TEXT,
      notes TEXT,
      terms TEXT,
      sent_at TEXT,
      accepted_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
    
    -- Quote line items
    CREATE TABLE IF NOT EXISTS quote_line_items (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
    );
    
    -- Invoices table
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT,
      job_id TEXT,
      quote_id TEXT,
      invoice_number TEXT,
      status TEXT DEFAULT 'draft',
      subtotal INTEGER DEFAULT 0,
      gst INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      amount_paid INTEGER DEFAULT 0,
      due_date TEXT,
      notes TEXT,
      terms TEXT,
      sent_at TEXT,
      paid_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (quote_id) REFERENCES quotes(id)
    );
    
    -- Invoice line items
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );
    
    -- Assets/Equipment table
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      serial_number TEXT,
      purchase_date TEXT,
      purchase_price INTEGER,
      condition TEXT DEFAULT 'good',
      notes TEXT,
      photo_url TEXT,
      next_maintenance_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      is_dirty INTEGER DEFAULT 0
    );
    
    -- Job assets (equipment used per job)
    CREATE TABLE IF NOT EXISTS job_assets (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      assigned_at TEXT,
      returned_at TEXT,
      notes TEXT,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );
    
    -- Messages (team/direct/job chat)
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      recipient_id TEXT,
      job_id TEXT,
      chat_type TEXT NOT NULL CHECK (chat_type IN ('team', 'direct', 'job')),
      content TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT,
      is_dirty INTEGER DEFAULT 0
    );
    
    -- Time entries
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      created_at TEXT,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
    
    -- Job form responses
    CREATE TABLE IF NOT EXISTS job_form_responses (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      template_id TEXT,
      responses TEXT,
      submitted_at TEXT,
      submitted_by TEXT,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
    
    -- Job signatures
    CREATE TABLE IF NOT EXISTS job_signatures (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      signature_data TEXT NOT NULL,
      signer_name TEXT,
      signer_role TEXT,
      signed_at TEXT,
      is_dirty INTEGER DEFAULT 0,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
    
    -- Push notification tokens
    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    
    -- Location history for background tracking
    CREATE TABLE IF NOT EXISTS location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      altitude REAL,
      battery_level REAL,
      activity_type TEXT,
      recorded_at TEXT NOT NULL,
      synced_at TEXT
    );
    
    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_mutation_queue_synced ON mutation_queue(synced_at);
    CREATE INDEX IF NOT EXISTS idx_location_history_synced ON location_history(synced_at);
  `);
  
  console.log('[Database] SQLite initialized successfully');
}

export async function clearDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM mutation_queue;
    DELETE FROM location_history;
    DELETE FROM push_tokens;
    DELETE FROM job_signatures;
    DELETE FROM job_form_responses;
    DELETE FROM time_entries;
    DELETE FROM messages;
    DELETE FROM job_assets;
    DELETE FROM assets;
    DELETE FROM invoice_line_items;
    DELETE FROM invoices;
    DELETE FROM quote_line_items;
    DELETE FROM quotes;
    DELETE FROM jobs;
    DELETE FROM clients;
    DELETE FROM sync_metadata;
  `);
  console.log('[Database] All data cleared');
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// Session caching for offline auth
export async function cacheUserSession(user: any, businessSettings?: any): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO user_session (id, user_data, business_settings, cached_at) 
     VALUES (1, ?, ?, datetime('now'))`,
    [JSON.stringify(user), businessSettings ? JSON.stringify(businessSettings) : null]
  );
  console.log('[Database] User session cached for offline use');
}

export async function getCachedSession(): Promise<{ user: any; businessSettings: any } | null> {
  try {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ user_data: string; business_settings: string | null }>(
      'SELECT user_data, business_settings FROM user_session WHERE id = 1'
    );
    
    if (result) {
      return {
        user: JSON.parse(result.user_data),
        businessSettings: result.business_settings ? JSON.parse(result.business_settings) : null
      };
    }
    return null;
  } catch (error) {
    console.error('[Database] Failed to get cached session:', error);
    return null;
  }
}

export async function clearCachedSession(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM user_session WHERE id = 1');
  console.log('[Database] Cached session cleared');
}

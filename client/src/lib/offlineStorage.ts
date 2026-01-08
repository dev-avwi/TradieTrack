const DB_NAME = 'tradietrack-offline';
const DB_VERSION = 1;

const STORE_NAMES = ['clients', 'jobs', 'quotes', 'invoices', 'receipts', 'syncQueue'] as const;
type StoreName = typeof STORE_NAMES[number];

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  storeName: 'clients' | 'jobs' | 'quotes' | 'invoices';
  data: any;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  createdAt: number;
  retries: number;
}

let dbInstance: IDBDatabase | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      STORE_NAMES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
  });
}

export async function saveItem<T extends { id: string | number }>(
  storeName: StoreName,
  item: T
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(new Error(`Failed to save item to ${storeName}`));
  });
}

export async function getItem<T>(
  storeName: StoreName,
  id: string | number
): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(new Error(`Failed to get item from ${storeName}`));
  });
}

export async function getAllItems<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(new Error(`Failed to get all items from ${storeName}`));
  });
}

export async function deleteItem(
  storeName: StoreName,
  id: string | number
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to delete item from ${storeName}`));
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
  });
}

export async function addToSyncQueue(
  operation: Omit<SyncOperation, 'id' | 'createdAt' | 'retries'>
): Promise<SyncOperation> {
  const syncOperation: SyncOperation = {
    ...operation,
    id: generateOfflineId(),
    createdAt: Date.now(),
    retries: 0,
  };

  await saveItem('syncQueue', syncOperation);
  return syncOperation;
}

export async function getSyncQueue(): Promise<SyncOperation[]> {
  return getAllItems<SyncOperation>('syncQueue');
}

export async function removeSyncItem(id: string): Promise<void> {
  return deleteItem('syncQueue', id);
}

export async function clearSyncQueue(): Promise<void> {
  return clearStore('syncQueue');
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function generateOfflineId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

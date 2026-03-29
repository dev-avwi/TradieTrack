import {
  getSyncQueue,
  removeSyncItem,
  saveItem,
  getAllItems,
  getItem,
  deleteItem,
  getFileAttachment,
  markFileAttachmentSynced,
  type SyncOperation,
} from './offlineStorage';
import { getSessionToken } from './queryClient';
import { queryClient } from './queryClient';

const MAX_RETRIES = 3;
const ID_MAPPING_KEY = 'jobrunner_id_mapping';

export interface IdMapping {
  [offlineId: string]: number | string;
}

function getIdMapping(): IdMapping {
  try {
    const stored = localStorage.getItem(ID_MAPPING_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveIdMapping(mapping: IdMapping): void {
  try {
    localStorage.setItem(ID_MAPPING_KEY, JSON.stringify(mapping));
  } catch {
    console.warn('Failed to save ID mapping');
  }
}

export function addIdMapping(offlineId: string, serverId: number | string): void {
  const mapping = getIdMapping();
  mapping[offlineId] = serverId;
  saveIdMapping(mapping);
}

export function getServerId(offlineId: string): number | string | undefined {
  return getIdMapping()[offlineId];
}

export function resolveId(id: string | number): string | number {
  if (typeof id === 'string' && id.startsWith('offline_')) {
    return getServerId(id) ?? id;
  }
  return id;
}

export function clearIdMapping(): void {
  localStorage.removeItem(ID_MAPPING_KEY);
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ operation: SyncOperation; error: string }>;
}

async function makeApiCall(
  endpoint: string,
  method: string,
  data?: unknown
): Promise<Response> {
  const headers: HeadersInit = {};
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(endpoint, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });
}

async function updateRelatedReferences(
  storeName: 'clients' | 'jobs' | 'quotes' | 'invoices',
  offlineId: string,
  serverId: number | string
): Promise<void> {
  if (storeName === 'clients') {
    const jobs = await getAllItems<any>('jobs');
    for (const job of jobs) {
      if (job.clientId === offlineId) {
        job.clientId = serverId;
        await saveItem('jobs', job);
      }
    }

    const quotes = await getAllItems<any>('quotes');
    for (const quote of quotes) {
      if (quote.clientId === offlineId) {
        quote.clientId = serverId;
        await saveItem('quotes', quote);
      }
    }

    const invoices = await getAllItems<any>('invoices');
    for (const invoice of invoices) {
      if (invoice.clientId === offlineId) {
        invoice.clientId = serverId;
        await saveItem('invoices', invoice);
      }
    }
  }

  if (storeName === 'jobs') {
    const quotes = await getAllItems<any>('quotes');
    for (const quote of quotes) {
      if (quote.jobId === offlineId) {
        quote.jobId = serverId;
        await saveItem('quotes', quote);
      }
    }

    const invoices = await getAllItems<any>('invoices');
    for (const invoice of invoices) {
      if (invoice.jobId === offlineId) {
        invoice.jobId = serverId;
        await saveItem('invoices', invoice);
      }
    }
  }

  if (storeName === 'quotes') {
    const invoices = await getAllItems<any>('invoices');
    for (const invoice of invoices) {
      if (invoice.quoteId === offlineId) {
        invoice.quoteId = serverId;
        await saveItem('invoices', invoice);
      }
    }
  }
}

function resolveDataReferences(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const resolved = { ...data };
  const mapping = getIdMapping();
  
  const refFields = ['clientId', 'jobId', 'quoteId', 'invoiceId'];
  for (const field of refFields) {
    if (resolved[field] && typeof resolved[field] === 'string' && resolved[field].startsWith('offline_')) {
      const serverId = mapping[resolved[field]];
      if (serverId) {
        resolved[field] = serverId;
      }
    }
  }
  
  return resolved;
}

async function uploadAndLinkAttachments(
  operation: SyncOperation,
  entityId: string | number
): Promise<void> {
  if (!operation.fileAttachmentIds?.length) return;

  const uploadedUrls: Array<{ url: string; type: string; filename: string }> = [];

  for (const attachmentId of operation.fileAttachmentIds) {
    const attachment = await getFileAttachment(attachmentId);
    if (!attachment || attachment.synced) continue;

    const formData = new FormData();
    formData.append('file', attachment.blob, attachment.filename);
    formData.append('type', `${attachment.entityType}_${attachment.type}`);

    const response = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Attachment upload failed: ${response.statusText}`);
    }

    const uploadResult = await response.json();
    const url = uploadResult.url || '';
    await markFileAttachmentSynced(attachmentId, url);
    if (url) {
      uploadedUrls.push({ url, type: attachment.type, filename: attachment.filename });
    }
  }

  if (uploadedUrls.length === 0) return;

  const entityEndpoint = `/api/${operation.storeName}/${entityId}`;
  const entityResponse = await makeApiCall(entityEndpoint, 'GET');
  if (!entityResponse.ok) return;

  const entity = await entityResponse.json();
  const patchData: Record<string, unknown> = {};

  const photoUrls = uploadedUrls.filter(u => u.type === 'photo' || u.type === 'image');
  const signatureUrls = uploadedUrls.filter(u => u.type === 'signature');
  const voiceNoteUrls = uploadedUrls.filter(u => u.type === 'voice_note' || u.type === 'audio');
  const documentUrls = uploadedUrls.filter(u => u.type === 'document' || u.type === 'file');

  if (photoUrls.length > 0) {
    const existingPhotos = Array.isArray(entity.photos) ? entity.photos : [];
    patchData.photos = [
      ...existingPhotos,
      ...photoUrls.map(u => ({ url: u.url, uploadedAt: new Date().toISOString(), source: 'offline_sync' })),
    ];
  }

  if (signatureUrls.length > 0) {
    patchData.signatureUrl = signatureUrls[signatureUrls.length - 1].url;
  }

  if (voiceNoteUrls.length > 0) {
    const existingNotes = Array.isArray(entity.voiceNotes) ? entity.voiceNotes : [];
    patchData.voiceNotes = [
      ...existingNotes,
      ...voiceNoteUrls.map(u => ({ url: u.url, filename: u.filename, uploadedAt: new Date().toISOString() })),
    ];
  }

  if (documentUrls.length > 0) {
    const existingDocs = Array.isArray(entity.documents) ? entity.documents : [];
    patchData.documents = [
      ...existingDocs,
      ...documentUrls.map(u => ({ url: u.url, filename: u.filename, uploadedAt: new Date().toISOString() })),
    ];
  }

  if (Object.keys(patchData).length > 0) {
    await makeApiCall(entityEndpoint, 'PATCH', patchData);
  }
}

export async function processSyncQueue(): Promise<SyncResult> {
  const queue = await getSyncQueue();
  
  if (queue.length === 0) {
    return { success: true, synced: 0, failed: 0, errors: [] };
  }

  const sortedQueue = [...queue].sort((a, b) => a.createdAt - b.createdAt);
  
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  for (const operation of sortedQueue) {
    if (operation.retries >= MAX_RETRIES) {
      result.failed++;
      result.errors.push({ operation, error: 'Max retries exceeded' });
      await removeSyncItem(operation.id);
      continue;
    }

    try {
      const resolvedData = resolveDataReferences(operation.data);
      let endpoint = operation.endpoint;
      
      if (operation.type === 'update' || operation.type === 'delete') {
        const urlParts = endpoint.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart.startsWith('offline_')) {
          const serverId = getServerId(lastPart);
          if (serverId) {
            urlParts[urlParts.length - 1] = String(serverId);
            endpoint = urlParts.join('/');
          }
        }
      }
      
      const response = await makeApiCall(
        endpoint,
        operation.method,
        operation.type !== 'delete' ? resolvedData : undefined
      );

      if (response.ok) {
        if (operation.type === 'create') {
          const serverResponse = await response.json();
          const offlineId = operation.data?.id;
          const serverId = serverResponse.id;
          
          if (offlineId && serverId && String(offlineId).startsWith('offline_')) {
            addIdMapping(offlineId, serverId);
            await updateRelatedReferences(operation.storeName, offlineId, serverId);
            
            await deleteItem(operation.storeName, offlineId);
            await saveItem(operation.storeName, serverResponse);
            
            queryClient.removeQueries({ queryKey: [`/api/${operation.storeName}`, offlineId] });
            queryClient.setQueryData([`/api/${operation.storeName}`, String(serverId)], serverResponse);
          } else {
            await saveItem(operation.storeName, serverResponse);
            if (serverId) {
              queryClient.setQueryData([`/api/${operation.storeName}`, String(serverId)], serverResponse);
            }
          }

          if (operation.fileAttachmentIds?.length && serverId) {
            await uploadAndLinkAttachments(operation, serverId);
          }
        } else if (operation.type === 'update') {
          const serverResponse = await response.json();
          await saveItem(operation.storeName, serverResponse);
          if (serverResponse.id) {
            queryClient.setQueryData([`/api/${operation.storeName}`, String(serverResponse.id)], serverResponse);
          }

          if (operation.fileAttachmentIds?.length && serverResponse.id) {
            await uploadAndLinkAttachments(operation, serverResponse.id);
          }
        } else if (operation.type === 'delete') {
          const itemId = operation.data?.id;
          if (itemId) {
            await deleteItem(operation.storeName, itemId);
            // Remove from detail cache
            queryClient.removeQueries({ queryKey: [`/api/${operation.storeName}`, String(itemId)] });
          }
        }

        await removeSyncItem(operation.id);
        result.synced++;
        
        // Invalidate list cache to refresh the list view
        queryClient.invalidateQueries({ queryKey: [`/api/${operation.storeName}`] });
      } else {
        const errorText = await response.text().catch(() => response.statusText);
        
        if (response.status >= 400 && response.status < 500) {
          result.failed++;
          result.errors.push({ operation, error: `${response.status}: ${errorText}` });
          result.success = false;
          await removeSyncItem(operation.id);
        } else {
          operation.retries++;
          await saveItem('syncQueue', operation);
          result.failed++;
          result.errors.push({ operation, error: `${response.status}: ${errorText}` });
          result.success = false;
        }
      }
    } catch (error) {
      if (!navigator.onLine) {
        result.success = false;
        break;
      }

      operation.retries++;
      await saveItem('syncQueue', operation);
      result.failed++;
      result.errors.push({ 
        operation, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      result.success = false;
    }
  }

  return result;
}

let autoSyncHandler: (() => void) | null = null;

export function startAutoSync(): void {
  if (autoSyncHandler) return;
  
  autoSyncHandler = () => {
    if (navigator.onLine) {
      processSyncQueue().catch(console.error);
    }
  };

  window.addEventListener('online', autoSyncHandler);
  
  if (navigator.onLine) {
    processSyncQueue().catch(console.error);
  }
}

export function stopAutoSync(): void {
  if (autoSyncHandler) {
    window.removeEventListener('online', autoSyncHandler);
    autoSyncHandler = null;
  }
}

export async function getPendingSyncCount(): Promise<number> {
  const queue = await getSyncQueue();
  return queue.length;
}

export async function hasPendingSyncs(): Promise<boolean> {
  const count = await getPendingSyncCount();
  return count > 0;
}

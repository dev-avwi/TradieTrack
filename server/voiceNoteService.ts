import { storage as dbStorage } from './storage';
import { objectStorageClient } from './objectStorage';
import crypto from 'crypto';

const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || '.private';
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export function isObjectStorageConfigured(): boolean {
  return !!BUCKET_ID;
}

export interface VoiceNoteUploadResult {
  success: boolean;
  voiceNoteId?: string;
  objectStorageKey?: string;
  error?: string;
}

export interface VoiceNoteMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  title?: string;
}

export async function uploadVoiceNote(
  userId: string,
  jobId: string,
  fileBuffer: Buffer,
  metadata: VoiceNoteMetadata
): Promise<VoiceNoteUploadResult> {
  if (!isObjectStorageConfigured()) {
    return { 
      success: false, 
      error: 'Voice note storage is not available. Please contact support to enable this feature.' 
    };
  }
  
  if (!BUCKET_ID) {
    return { success: false, error: 'Object storage bucket not configured' };
  }

  try {
    const fileExtension = metadata.fileName.split('.').pop() || 'webm';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const objectKey = `${PRIVATE_OBJECT_DIR}/voice-notes/${jobId}/${uniqueId}.${fileExtension}`;

    // Use Replit's object storage client
    const bucket = objectStorageClient.bucket(BUCKET_ID);
    const file = bucket.file(objectKey);
    
    await file.save(fileBuffer, {
      contentType: metadata.mimeType,
      metadata: {
        userId,
        jobId,
        originalFileName: metadata.fileName,
        duration: metadata.duration?.toString(),
        title: metadata.title,
      },
    });

    const voiceNote = await dbStorage.createVoiceNote({
      userId,
      jobId,
      objectStorageKey: objectKey,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      duration: metadata.duration,
      title: metadata.title,
      recordedBy: userId,
    });

    return {
      success: true,
      voiceNoteId: voiceNote.id,
      objectStorageKey: objectKey,
    };
  } catch (error: any) {
    console.error('Error uploading voice note:', error);
    return { success: false, error: error.message };
  }
}

export async function getSignedVoiceNoteUrl(
  objectStorageKey: string,
  expiresInMinutes: number = 60
): Promise<{ url?: string; error?: string }> {
  if (!objectStorageKey) {
    return { error: 'No object storage key provided' };
  }
  
  if (!BUCKET_ID) {
    return { error: 'Object storage not configured' };
  }

  try {
    // Remove leading slash if present for consistent object name
    const objectName = objectStorageKey.startsWith("/") ? objectStorageKey.slice(1) : objectStorageKey;
    
    // Use Replit's sidecar to generate a signed URL (works in Replit environment)
    const request = {
      bucket_name: BUCKET_ID,
      object_name: objectName,
      method: 'GET',
      expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
    };
    
    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
    
    if (!response.ok) {
      // Fallback: Try using Replit's object storage client directly
      const bucket = objectStorageClient.bucket(BUCKET_ID);
      const file = bucket.file(objectName);
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });
      
      return { url: signedUrl };
    }

    const { signed_url: signedURL } = await response.json();
    return { url: signedURL };
  } catch (error: any) {
    console.error('Error getting signed URL for voice note:', error);
    return { error: error.message };
  }
}

export async function deleteVoiceNote(
  voiceNoteId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!BUCKET_ID) {
    return { success: false, error: 'Object storage not configured' };
  }

  try {
    const voiceNote = await dbStorage.getVoiceNote(voiceNoteId, userId);
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found' };
    }

    // Use Replit's object storage client
    const bucket = objectStorageClient.bucket(BUCKET_ID);
    const file = bucket.file(voiceNote.objectStorageKey);
    
    try {
      await file.delete();
    } catch (e) {
      console.warn('File may not exist in storage:', e);
    }

    await dbStorage.deleteVoiceNote(voiceNoteId, userId);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting voice note:', error);
    return { success: false, error: error.message };
  }
}

export async function getJobVoiceNotes(
  jobId: string,
  userId: string
): Promise<Array<{
  id: string;
  fileName: string;
  duration: number | null;
  title: string | null;
  transcription: string | null;
  createdAt: Date | null;
  signedUrl?: string;
}>> {
  try {
    const voiceNotes = await dbStorage.getJobVoiceNotes(jobId, userId);
    
    const notesWithUrls = await Promise.all(
      voiceNotes.map(async (note) => {
        const { url } = await getSignedVoiceNoteUrl(note.objectStorageKey);
        return {
          id: note.id,
          fileName: note.fileName,
          duration: note.duration,
          title: note.title,
          transcription: note.transcription,
          createdAt: note.createdAt,
          signedUrl: url,
        };
      })
    );
    
    return notesWithUrls;
  } catch (error) {
    console.error('Error getting job voice notes:', error);
    return [];
  }
}

export async function updateVoiceNoteTitle(
  voiceNoteId: string,
  userId: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbStorage.updateVoiceNote(voiceNoteId, userId, { title });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating voice note title:', error);
    return { success: false, error: error.message };
  }
}

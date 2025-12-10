import { Storage } from '@google-cloud/storage';
import { storage as dbStorage } from './storage';
import crypto from 'crypto';

const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || '.private';
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

let gcsStorage: Storage | null = null;

function getGCSStorage(): Storage | null {
  if (!gcsStorage && BUCKET_ID) {
    try {
      gcsStorage = new Storage();
    } catch (error) {
      console.error('Failed to initialize GCS storage:', error);
      return null;
    }
  }
  return gcsStorage;
}

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
  
  const storage = getGCSStorage();
  if (!storage || !BUCKET_ID) {
    return { success: false, error: 'Failed to initialize storage' };
  }

  try {
    const fileExtension = metadata.fileName.split('.').pop() || 'webm';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const objectKey = `${PRIVATE_OBJECT_DIR}/voice-notes/${jobId}/${uniqueId}.${fileExtension}`;

    const bucket = storage.bucket(BUCKET_ID);
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
  const storage = getGCSStorage();
  
  if (!storage || !BUCKET_ID) {
    return { error: 'Object storage not configured' };
  }

  try {
    const bucket = storage.bucket(BUCKET_ID);
    const file = bucket.file(objectStorageKey);
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

    return { url };
  } catch (error: any) {
    console.error('Error getting signed URL:', error);
    return { error: error.message };
  }
}

export async function deleteVoiceNote(
  voiceNoteId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const storage = getGCSStorage();
  
  if (!storage || !BUCKET_ID) {
    return { success: false, error: 'Object storage not configured' };
  }

  try {
    const voiceNote = await dbStorage.getVoiceNote(voiceNoteId, userId);
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found' };
    }

    const bucket = storage.bucket(BUCKET_ID);
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

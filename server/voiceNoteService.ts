import { storage as dbStorage } from './storage';
import { objectStorageClient } from './objectStorage';
import crypto from 'crypto';

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Sanitize PRIVATE_OBJECT_DIR - strip bucket name prefix if present
function getPrivateObjectDir(): string {
  let dir = process.env.PRIVATE_OBJECT_DIR || '.private';
  // If the path contains the bucket name, strip it
  if (BUCKET_ID && dir.includes(BUCKET_ID)) {
    // Remove the bucket prefix (e.g., /replit-objstore-xxx/.private -> .private)
    dir = dir.replace(new RegExp(`^/?${BUCKET_ID}/`), '');
  }
  // Remove leading slash if present
  if (dir.startsWith('/')) {
    dir = dir.slice(1);
  }
  return dir;
}

const PRIVATE_OBJECT_DIR = getPrivateObjectDir();

// Parse object path - extract bucket name and object name from the full path
// Path format: /<bucket_name>/<object_name> or just <object_path> (relative to BUCKET_ID)
function parseObjectPath(objectKey: string): { bucketName: string; objectName: string } {
  if (!BUCKET_ID) {
    throw new Error("Object storage bucket not configured");
  }
  
  // Clean the path
  let cleanPath = objectKey.startsWith("/") ? objectKey.slice(1) : objectKey;
  
  // Check if the path starts with the bucket name
  if (cleanPath.startsWith(BUCKET_ID + "/")) {
    // Remove bucket prefix and use as object name
    const objectName = cleanPath.slice(BUCKET_ID.length + 1);
    return { bucketName: BUCKET_ID, objectName };
  }
  
  // Check if the path starts with a replit-objstore bucket pattern
  if (cleanPath.startsWith("replit-objstore-")) {
    const slashIndex = cleanPath.indexOf("/");
    if (slashIndex > 0) {
      const bucketName = cleanPath.slice(0, slashIndex);
      const objectName = cleanPath.slice(slashIndex + 1);
      return { bucketName, objectName };
    }
  }
  
  // The path is relative (e.g., ".private/voice-notes/...") - use BUCKET_ID
  return { bucketName: BUCKET_ID, objectName: cleanPath };
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
  
  if (!BUCKET_ID) {
    return { success: false, error: 'Object storage bucket not configured' };
  }

  try {
    const fileExtension = metadata.fileName.split('.').pop() || 'webm';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const objectKey = `${PRIVATE_OBJECT_DIR}/voice-notes/${jobId}/${uniqueId}.${fileExtension}`;

    // Use Replit's object storage client
    console.log('[VoiceNoteService] Uploading voice note:', {
      bucketId: BUCKET_ID,
      objectKey,
      fileSize: fileBuffer.length,
      mimeType: metadata.mimeType,
    });
    
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
    
    // Verify the file was uploaded
    const [exists] = await file.exists();
    console.log('[VoiceNoteService] Upload complete, file exists:', exists);

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

  try {
    // Parse the full path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(objectStorageKey);
    
    console.log('[VoiceNoteService] Requesting signed URL for:', { bucketName, objectName });
    
    // Use Replit's sidecar to generate a signed URL (works in Replit environment)
    const request = {
      bucket_name: bucketName,
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
      const errorText = await response.text();
      console.error('[VoiceNoteService] Sidecar error:', response.status, errorText);
      
      // Fallback: Try using Replit's object storage client directly
      try {
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + expiresInMinutes * 60 * 1000,
        });
        
        console.log('[VoiceNoteService] GCS fallback successful');
        return { url: signedUrl };
      } catch (gcsError: any) {
        console.error('[VoiceNoteService] GCS fallback failed:', gcsError.message);
        return { error: `Sidecar: ${errorText}, GCS: ${gcsError.message}` };
      }
    }

    const { signed_url: signedURL } = await response.json();
    console.log('[VoiceNoteService] Signed URL generated successfully');
    return { url: signedURL };
  } catch (error: any) {
    console.error('[VoiceNoteService] Error getting signed URL:', error);
    return { error: error.message };
  }
}

export async function deleteVoiceNote(
  voiceNoteId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const voiceNote = await dbStorage.getVoiceNote(voiceNoteId, userId);
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found' };
    }

    // Parse the path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(voiceNote.objectStorageKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
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

// AI Transcription using OpenAI Whisper
export async function transcribeVoiceNote(
  voiceNoteId: string,
  userId: string
): Promise<{ success: boolean; transcription?: string; error?: string }> {
  try {
    const { default: OpenAI } = await import('openai');
    
    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
    
    // Get the voice note from database
    const voiceNote = await dbStorage.getVoiceNote(voiceNoteId, userId);
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found' };
    }
    
    // Download the audio file from object storage
    const audioBuffer = await downloadVoiceNoteFile(voiceNote.objectStorageKey);
    if (!audioBuffer) {
      return { success: false, error: 'Failed to download audio file' };
    }
    
    // Create a File object for OpenAI
    const file = new File([audioBuffer], voiceNote.fileName || 'audio.webm', {
      type: voiceNote.mimeType || 'audio/webm'
    });
    
    console.log('[VoiceNoteService] Transcribing audio file:', {
      voiceNoteId,
      fileName: voiceNote.fileName,
      mimeType: voiceNote.mimeType,
      size: audioBuffer.length
    });
    
    // Call OpenAI Whisper for transcription
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });
    
    console.log('[VoiceNoteService] Transcription complete:', transcription.substring(0, 100) + '...');
    
    // Save transcription to database
    await dbStorage.updateVoiceNote(voiceNoteId, userId, { 
      transcription: transcription.toString() 
    });
    
    return { success: true, transcription: transcription.toString() };
  } catch (error: any) {
    console.error('Error transcribing voice note:', error);
    return { success: false, error: error.message };
  }
}

// Download voice note file from object storage
async function downloadVoiceNoteFile(objectStorageKey: string): Promise<Buffer | null> {
  if (!objectStorageKey || !BUCKET_ID) {
    return null;
  }
  
  try {
    const { bucketName, objectName } = parseObjectPath(objectStorageKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [contents] = await file.download();
    return contents;
  } catch (error) {
    console.error('Error downloading voice note file:', error);
    return null;
  }
}

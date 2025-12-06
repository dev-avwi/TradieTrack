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

// Check if object storage is configured
export function isObjectStorageConfigured(): boolean {
  return !!BUCKET_ID;
}

export interface PhotoUploadResult {
  success: boolean;
  photoId?: string;
  objectStorageKey?: string;
  error?: string;
}

export interface PhotoMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  category?: 'before' | 'after' | 'progress' | 'materials' | 'general';
  caption?: string;
  takenAt?: Date;
}

export async function uploadJobPhoto(
  userId: string,
  jobId: string,
  fileBuffer: Buffer,
  metadata: PhotoMetadata
): Promise<PhotoUploadResult> {
  if (!isObjectStorageConfigured()) {
    return { 
      success: false, 
      error: 'Photo storage is not available. Please contact support to enable this feature.' 
    };
  }
  
  const storage = getGCSStorage();
  if (!storage || !BUCKET_ID) {
    return { success: false, error: 'Failed to initialize storage' };
  }

  try {
    const fileExtension = metadata.fileName.split('.').pop() || 'jpg';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const objectKey = `${PRIVATE_OBJECT_DIR}/jobs/${jobId}/${uniqueId}.${fileExtension}`;

    const bucket = storage.bucket(BUCKET_ID);
    const file = bucket.file(objectKey);
    
    await file.save(fileBuffer, {
      contentType: metadata.mimeType,
      metadata: {
        userId,
        jobId,
        originalFileName: metadata.fileName,
        category: metadata.category || 'general',
        caption: metadata.caption,
        takenAt: metadata.takenAt?.toISOString(),
      },
    });

    const photo = await dbStorage.createJobPhoto({
      userId,
      jobId,
      objectStorageKey: objectKey,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      category: metadata.category || 'general',
      caption: metadata.caption,
      takenAt: metadata.takenAt,
    });

    return {
      success: true,
      photoId: photo.id,
      objectStorageKey: objectKey,
    };
  } catch (error: any) {
    console.error('Error uploading job photo:', error);
    return { success: false, error: error.message };
  }
}

export async function getSignedPhotoUrl(
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

export async function deleteJobPhoto(
  photoId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const storage = getGCSStorage();
  
  if (!storage || !BUCKET_ID) {
    return { success: false, error: 'Object storage not configured' };
  }

  try {
    const photo = await dbStorage.getJobPhoto(photoId, userId);
    if (!photo) {
      return { success: false, error: 'Photo not found' };
    }

    const bucket = storage.bucket(BUCKET_ID);
    const file = bucket.file(photo.objectStorageKey);
    
    try {
      await file.delete();
    } catch (e) {
      console.warn('File may not exist in storage:', e);
    }

    await dbStorage.deleteJobPhoto(photoId, userId);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting job photo:', error);
    return { success: false, error: error.message };
  }
}

export async function getJobPhotos(
  jobId: string,
  userId: string
): Promise<Array<{
  id: string;
  fileName: string;
  category: string;
  caption: string | null;
  takenAt: Date | null;
  signedUrl?: string;
}>> {
  try {
    const photos = await dbStorage.getJobPhotos(jobId, userId);
    
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const { url } = await getSignedPhotoUrl(photo.objectStorageKey);
        return {
          id: photo.id,
          fileName: photo.fileName,
          category: photo.category || 'general',
          caption: photo.caption,
          takenAt: photo.takenAt,
          signedUrl: url,
        };
      })
    );
    
    return photosWithUrls;
  } catch (error) {
    console.error('Error getting job photos:', error);
    return [];
  }
}

export async function updatePhotoMetadata(
  photoId: string,
  userId: string,
  updates: {
    category?: string;
    caption?: string;
    sortOrder?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbStorage.updateJobPhoto(photoId, userId, updates);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating photo metadata:', error);
    return { success: false, error: error.message };
  }
}

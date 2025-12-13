import { storage as dbStorage } from './storage';
import { objectStorageClient } from './objectStorage';
import crypto from 'crypto';

const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || '.private';
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

// Parse full object path to extract bucket name and object name
function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return { bucketName, objectName };
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
  
  if (!PRIVATE_OBJECT_DIR) {
    return { success: false, error: 'Private object directory not configured' };
  }

  try {
    const fileExtension = metadata.fileName.split('.').pop() || 'jpg';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    // Store the full path including bucket name for later retrieval
    const objectKey = `${PRIVATE_OBJECT_DIR}/jobs/${jobId}/${uniqueId}.${fileExtension}`;

    // Parse the path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(objectKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
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

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export async function getSignedPhotoUrl(
  objectStorageKey: string,
  expiresInMinutes: number = 60
): Promise<{ url?: string; error?: string }> {
  if (!objectStorageKey) {
    return { error: 'No object storage key provided' };
  }

  try {
    // Parse the full path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(objectStorageKey);
    
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
      // Fallback: Try using the GCS client directly
      const bucket = objectStorageClient.bucket(bucketName);
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
    console.error('Error getting signed URL for photo:', error);
    return { error: error.message };
  }
}

export async function deleteJobPhoto(
  photoId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const photo = await dbStorage.getJobPhoto(photoId, userId);
    if (!photo) {
      return { success: false, error: 'Photo not found' };
    }

    // Parse the path to get bucket name and object name
    const { bucketName, objectName } = parseObjectPath(photo.objectStorageKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
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

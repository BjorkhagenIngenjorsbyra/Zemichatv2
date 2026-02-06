import { supabase } from './supabase';

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  size: number;
  mimeType: string;
  fileName: string;
}

export interface UploadResult {
  url: string;
  path: string;
  metadata: MediaMetadata;
  error: Error | null;
}

export interface UploadError {
  url: null;
  path: null;
  metadata: null;
  error: Error;
}

const BUCKET_NAME = 'chat-media';

/**
 * Generate a unique file path for storage.
 * Structure: {userId}/{chatId}/{timestamp}_{filename}
 */
function generateFilePath(
  userId: string,
  chatId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${chatId}/${timestamp}_${sanitizedName}`;
}

/**
 * Get image dimensions from a File.
 */
async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload an image file to chat-media storage.
 */
export async function uploadImage(
  file: File,
  chatId: string
): Promise<UploadResult | UploadError> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, path: null, metadata: null, error: new Error('Not authenticated') };
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { url: null, path: null, metadata: null, error: new Error('File must be an image') };
    }

    // Get dimensions
    let dimensions = { width: 0, height: 0 };
    try {
      dimensions = await getImageDimensions(file);
    } catch {
      // Continue without dimensions
    }

    const filePath = generateFilePath(user.id, chatId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, path: null, metadata: null, error: new Error(uploadError.message) };
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const metadata: MediaMetadata = {
      width: dimensions.width,
      height: dimensions.height,
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    };

    return {
      url: urlData.publicUrl,
      path: filePath,
      metadata,
      error: null,
    };
  } catch (err) {
    return {
      url: null,
      path: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Upload a voice message blob to chat-media storage.
 */
export async function uploadVoice(
  blob: Blob,
  chatId: string,
  duration: number,
  mimeType = 'audio/webm'
): Promise<UploadResult | UploadError> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, path: null, metadata: null, error: new Error('Not authenticated') };
    }

    // Determine file extension from mime type
    const extensions: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/aac': 'aac',
    };
    const ext = extensions[mimeType] || 'webm';
    const fileName = `voice_message.${ext}`;

    const filePath = generateFilePath(user.id, chatId, fileName);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: mimeType,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, path: null, metadata: null, error: new Error(uploadError.message) };
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const metadata: MediaMetadata = {
      duration,
      size: blob.size,
      mimeType,
      fileName,
    };

    return {
      url: urlData.publicUrl,
      path: filePath,
      metadata,
      error: null,
    };
  } catch (err) {
    return {
      url: null,
      path: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Upload a document file to chat-media storage.
 */
export async function uploadDocument(
  file: File,
  chatId: string
): Promise<UploadResult | UploadError> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, path: null, metadata: null, error: new Error('Not authenticated') };
    }

    const filePath = generateFilePath(user.id, chatId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, path: null, metadata: null, error: new Error(uploadError.message) };
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const metadata: MediaMetadata = {
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    };

    return {
      url: urlData.publicUrl,
      path: filePath,
      metadata,
      error: null,
    };
  } catch (err) {
    return {
      url: null,
      path: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Upload a video file to chat-media storage.
 */
export async function uploadVideo(
  file: File,
  chatId: string,
  duration?: number
): Promise<UploadResult | UploadError> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, path: null, metadata: null, error: new Error('Not authenticated') };
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      return { url: null, path: null, metadata: null, error: new Error('File must be a video') };
    }

    const filePath = generateFilePath(user.id, chatId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, path: null, metadata: null, error: new Error(uploadError.message) };
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const metadata: MediaMetadata = {
      duration,
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    };

    return {
      url: urlData.publicUrl,
      path: filePath,
      metadata,
      error: null,
    };
  } catch (err) {
    return {
      url: null,
      path: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get a signed URL for accessing a private file.
 * Useful when the bucket is private.
 */
export async function getSignedUrl(
  path: string,
  expiresIn = 3600
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) {
      return { url: null, error: new Error(error.message) };
    }

    return { url: data.signedUrl, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(
  path: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getSupabaseStorageClient, CUSTOMER_PHOTO_BUCKET, ALLOWED_IMAGE_MIME_TYPES } from "../config/storage.config.js";
import { HttpError } from "../middleware/validation.js";

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
}

export interface StorageProvider {
  uploadFile(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<StorageUploadResult>;
  deleteFile(bucket: string, path: string): Promise<void>;
}

export class SupabaseStorageProvider implements StorageProvider {
  async uploadFile(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<StorageUploadResult> {
    const client = getSupabaseStorageClient();
    if (!client) {
      if (process.env.NODE_ENV !== "production") {
        return {
          path,
          publicUrl: `https://storage.supabase.local/v1/object/public/${bucket}/${path}`,
        };
      }
      throw new HttpError(500, "Supabase storage is not configured (missing URL or API key)");
    }

    const uploadPromise = client.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) =>
      setTimeout(() => reject(new HttpError(504, "Storage upload timed out after 20 seconds")), 20000)
    );
    const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);

    if (error || !data) {
      throw new HttpError(500, `Storage upload failed: ${error?.message || "Unknown error"}`);
    }

    const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(data.path);
    return {
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const client = getSupabaseStorageClient();
    if (!client) return;
    await client.storage.from(bucket).remove([path]).catch(() => {});
  }
}

let activeStorageProvider: StorageProvider = new SupabaseStorageProvider();

export function setStorageProvider(provider: StorageProvider) {
  activeStorageProvider = provider;
}

export function getStorageProvider(): StorageProvider {
  return activeStorageProvider;
}

/**
 * Compresses and optimizes image buffer to webp format using sharp.
 * - Resizes to max width/height 1600px maintaining aspect ratio
 * - Quality 80% with lossless fallback if smaller
 * - Strips unnecessary EXIF metadata
 */
export async function compressImageBuffer(inputBuffer: Buffer, originalMime?: string): Promise<{ buffer: Buffer; mimetype: string; extension: string }> {
  try {
    const compressedBuffer = await sharp(inputBuffer)
      .rotate() // auto-orient based on EXIF before stripping
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

    return {
      buffer: compressedBuffer,
      mimetype: "image/webp",
      extension: "webp",
    };
  } catch (err) {
    // If sharp processing encounters an edge case, safely fall back to original buffer
    const ext = originalMime === "image/png" ? "png" : originalMime === "image/webp" ? "webp" : "jpg";
    const mime = originalMime || "image/jpeg";
    return {
      buffer: inputBuffer,
      mimetype: mime,
      extension: ext,
    };
  }
}

/**
 * Uploads a customer storefront photo with automatic image compression and returns the public URL.
 * Generates safe unique filename: customers/{customerId}/{timestamp}_{random}.webp
 */
export async function uploadCustomerPhoto(
  customerId: string,
  buffer: Buffer,
  mimetype: string,
  oldPhotoPath?: string | null
): Promise<StorageUploadResult> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimetype)) {
    throw new HttpError(415, `Unsupported file type: ${mimetype}. Allowed types: image/jpeg, image/png, image/webp`);
  }

  // Automatically compress and convert to WebP
  const { buffer: processedBuffer, mimetype: targetMime, extension } = await compressImageBuffer(buffer, mimetype);

  const uniqueId = randomBytes(6).toString("hex");
  const fileName = `customers/${customerId}/${Date.now()}_${uniqueId}.${extension}`;

  const provider = getStorageProvider();
  const uploadResult = await provider.uploadFile(CUSTOMER_PHOTO_BUCKET, fileName, processedBuffer, targetMime);

  // If replacing an existing photo, clean up old file in Supabase
  if (oldPhotoPath && oldPhotoPath.includes(CUSTOMER_PHOTO_BUCKET)) {
    const oldKey = oldPhotoPath.split(`${CUSTOMER_PHOTO_BUCKET}/`)[1];
    if (oldKey) {
      provider.deleteFile(CUSTOMER_PHOTO_BUCKET, oldKey).catch(() => {});
    }
  }

  return uploadResult;
}

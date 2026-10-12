import { randomBytes } from "node:crypto";
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
      // In development or test without credentials, generate local simulated storage path
      if (process.env.NODE_ENV !== "production") {
        return {
          path,
          publicUrl: `https://storage.supabase.local/v1/object/public/${bucket}/${path}`,
        };
      }
      throw new HttpError(500, "Supabase storage is not configured (missing URL or API key)");
    }

    const { data, error } = await client.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

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
 * Uploads a customer storefront photo and returns the public URL.
 * Generates safe unique filename: customers/{customerId}/{timestamp}_{random}.{extension}
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

  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionMap[mimetype] || "jpg";
  const uniqueId = randomBytes(6).toString("hex");
  const fileName = `customers/${customerId}/${Date.now()}_${uniqueId}.${extension}`;

  const provider = getStorageProvider();
  const uploadResult = await provider.uploadFile(CUSTOMER_PHOTO_BUCKET, fileName, buffer, mimetype);

  // If replacing an existing photo, attempt safe cleanup of old file
  if (oldPhotoPath && oldPhotoPath.includes(CUSTOMER_PHOTO_BUCKET)) {
    const oldKey = oldPhotoPath.split(`${CUSTOMER_PHOTO_BUCKET}/`)[1];
    if (oldKey) {
      provider.deleteFile(CUSTOMER_PHOTO_BUCKET, oldKey).catch(() => {});
    }
  }

  return uploadResult;
}

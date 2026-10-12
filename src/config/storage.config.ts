import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvironment } from "./env.js";

const env = loadEnvironment();

export const CUSTOMER_PHOTO_BUCKET = env.SUPABASE_CUSTOMER_BUCKET || "customer-photos";
export const MAX_PHOTO_SIZE_BYTES = (env.MAX_PHOTO_SIZE_MB || 5) * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

let supabaseStorageClient: SupabaseClient | null = null;

export function getSupabaseStorageClient(): SupabaseClient | null {
  if (supabaseStorageClient) return supabaseStorageClient;

  const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    supabaseStorageClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    return supabaseStorageClient;
  }
  return null;
}

export function setSupabaseStorageClient(client: SupabaseClient | null) {
  supabaseStorageClient = client;
}

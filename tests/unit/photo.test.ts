import test from "node:test";
import assert from "node:assert/strict";
import { uploadCustomerPhoto, setStorageProvider, type StorageProvider } from "../../src/services/storage.service.js";

test("Customer Photo Upload & Storage Service Unit Tests", async (t) => {
  const uploadedFiles: { bucket: string; path: string; buffer: Buffer; contentType: string }[] = [];
  const deletedFiles: string[] = [];

  const mockStorage: StorageProvider = {
    async uploadFile(bucket, path, buffer, contentType) {
      uploadedFiles.push({ bucket, path, buffer, contentType });
      return {
        path,
        publicUrl: `https://storage.mock.supabase.co/${bucket}/${path}`,
      };
    },
    async deleteFile(bucket, path) {
      deletedFiles.push(path);
    },
  };

  setStorageProvider(mockStorage);

  t.beforeEach(() => {
    uploadedFiles.length = 0;
    deletedFiles.length = 0;
  });

  await t.test("Valid JPEG upload generates safe unique path and returns public URL", async () => {
    const buffer = Buffer.from("fake-jpeg-binary-data");
    const result = await uploadCustomerPhoto("cust-123", buffer, "image/jpeg");

    assert.ok(result.publicUrl.includes("https://storage.mock.supabase.co/customer-photos/customers/cust-123/"));
    assert.ok(result.path.endsWith(".jpg"));
    assert.equal(uploadedFiles.length, 1);
    assert.equal(uploadedFiles[0]?.contentType, "image/jpeg");
  });

  await t.test("Valid PNG upload succeeds", async () => {
    const buffer = Buffer.from("fake-png-binary-data");
    const result = await uploadCustomerPhoto("cust-456", buffer, "image/png");

    assert.ok(result.path.endsWith(".png"));
    assert.equal(uploadedFiles[0]?.contentType, "image/png");
  });

  await t.test("Valid WebP upload succeeds", async () => {
    const buffer = Buffer.from("fake-webp-binary-data");
    const result = await uploadCustomerPhoto("cust-789", buffer, "image/webp");

    assert.ok(result.path.endsWith(".webp"));
    assert.equal(uploadedFiles[0]?.contentType, "image/webp");
  });

  await t.test("Rejects unsupported MIME types (e.g. PDF, text, gif, executable)", async () => {
    const buffer = Buffer.from("fake-pdf-data");
    await assert.rejects(
      async () => uploadCustomerPhoto("cust-123", buffer, "application/pdf"),
      { message: /Unsupported file type: application\/pdf/i }
    );

    await assert.rejects(
      async () => uploadCustomerPhoto("cust-123", buffer, "image/gif"),
      { message: /Unsupported file type: image\/gif/i }
    );

    await assert.rejects(
      async () => uploadCustomerPhoto("cust-123", buffer, "application/octet-stream"),
      { message: /Unsupported file type/i }
    );
  });

  await t.test("Replaces old photo safely by invoking storage cleanup", async () => {
    const oldPath = "https://storage.mock.supabase.co/customer-photos/customers/cust-123/old_photo_123.jpg";
    const buffer = Buffer.from("new-image-data");

    const result = await uploadCustomerPhoto("cust-123", buffer, "image/jpeg", oldPath);
    assert.ok(result.publicUrl);
    assert.equal(deletedFiles.length, 1);
    assert.equal(deletedFiles[0], "customers/cust-123/old_photo_123.jpg");
  });
});

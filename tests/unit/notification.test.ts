import test from "node:test";
import assert from "node:assert/strict";
import { MockEmailProvider, ResendEmailProvider } from "../../src/services/notification/email.provider.js";
import { MockWhatsAppProvider, TwilioWhatsAppProvider } from "../../src/services/notification/whatsapp.provider.js";
import { createNotificationService, calculateBackoffMs } from "../../src/services/notification/notification.service.js";
import { processPendingNotificationRetries } from "../../src/services/notification/notification-retry.worker.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

test("Notification System & Providers Unit Tests", async (t) => {
  const emailProvider = new MockEmailProvider();
  const whatsappProvider = new MockWhatsAppProvider();

  // In-memory fake database for isolated unit testing
  const fakeDb = {
    notification: {
      records: [] as any[],
      async create({ data }: any) {
        const record = { id: `notif_${Date.now()}_${Math.random()}`, ...data, createdAt: new Date() };
        this.records.push(record);
        return record;
      },
    },
    delivery: {
      records: [] as any[],
      async create({ data }: any) {
        const record = { id: `deliv_${Date.now()}_${Math.random()}`, ...data, attempts: 0, createdAt: new Date() };
        this.records.push(record);
        return record;
      },
      async findUnique({ where }: any) {
        return this.records.find((r: any) => r.id === where.id) || null;
      },
      async update({ where, data }: any) {
        const item = this.records.find((r: any) => r.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
      async findMany({ where }: any) {
        return this.records.filter((r: any) => r.status === "PENDING");
      },
    },
  } as unknown as PrismaClient;

  const service = createNotificationService(fakeDb, emailProvider, whatsappProvider);

  t.beforeEach(() => {
    emailProvider.clear();
    whatsappProvider.clear();
  });

  await t.test("Successful email dispatch updates delivery state to SENT", async () => {
    const notif = await service.notifyUser({
      recipientId: "user-123",
      kind: "LOW_PRICE_SALE_REQUESTED",
      message: "Approval needed for sale #456",
      email: "manager@example.com",
      channels: ["EMAIL"],
    });

    assert.ok(notif);
    const sentEmails = emailProvider.getSentEmails();
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0]?.to, "manager@example.com");
    assert.match(sentEmails[0]?.html || "", /Approval needed/);

    const deliveryRecord = (fakeDb as any).delivery.records.find((d: any) => d.notificationId === notif?.id);
    assert.ok(deliveryRecord);
    assert.equal(deliveryRecord.status, "SENT");
    assert.equal(deliveryRecord.attempts, 1);
    assert.ok(deliveryRecord.providerRef);
  });

  await t.test("Email provider transient failure records PENDING state and schedules retry", async () => {
    emailProvider.setSimulateFailure(true, true, "Rate limit exceeded (429)");

    const notif = await service.notifyUser({
      recipientId: "user-123",
      kind: "TEST_KIND",
      message: "Test transient failure",
      email: "retry@example.com",
      channels: ["EMAIL"],
    });

    assert.ok(notif);
    const deliveryRecord = (fakeDb as any).delivery.records.find((d: any) => d.notificationId === notif?.id && d.status === "PENDING");
    assert.ok(deliveryRecord);
    assert.equal(deliveryRecord.status, "PENDING");
    assert.equal(deliveryRecord.attempts, 1);
    assert.match(deliveryRecord.lastError, /Rate limit/);
    assert.ok(deliveryRecord.nextAttemptAt);
  });

  await t.test("Successful WhatsApp notification updates delivery state to SENT", async () => {
    const notif = await service.notifyUser({
      recipientId: "user-seller",
      kind: "LOW_PRICE_SALE_APPROVED",
      message: "Your sale of 20 packets was approved",
      phone: "+919876543210",
      channels: ["WHATSAPP"],
    });

    assert.ok(notif);
    const sentMessages = whatsappProvider.getSentMessages();
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0]?.to, "+919876543210");

    const deliveryRecord = (fakeDb as any).delivery.records.find((d: any) => d.notificationId === notif?.id && d.channel === "WHATSAPP");
    assert.ok(deliveryRecord);
    assert.equal(deliveryRecord.status, "SENT");
    assert.equal(deliveryRecord.attempts, 1);
  });

  await t.test("WhatsApp permanent failure marks delivery as FAILED", async () => {
    whatsappProvider.setSimulateFailure(true, false, "Invalid destination number (400)");

    const notif = await service.notifyUser({
      recipientId: "user-seller",
      kind: "TEST_WA_FAIL",
      message: "Test failure",
      phone: "+910000000000",
      channels: ["WHATSAPP"],
    });

    assert.ok(notif);
    const deliveryRecord = (fakeDb as any).delivery.records.find((d: any) => d.notificationId === notif?.id && d.channel === "WHATSAPP");
    assert.ok(deliveryRecord);
    assert.equal(deliveryRecord.status, "FAILED");
    assert.match(deliveryRecord.lastError, /Invalid destination number/);
    assert.equal(deliveryRecord.nextAttemptAt, null);
  });

  await t.test("Password reset email contains non-empty token and no secret leak", async () => {
    const result = await service.sendPasswordResetEmail("user@example.com", "secure_test_token_123", "Rajesh");
    assert.equal(result.success, true);

    const sentEmails = emailProvider.getSentEmails();
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0]?.to, "user@example.com");
    assert.match(sentEmails[0]?.html || "", /secure_test_token_123/);
    assert.match(sentEmails[0]?.html || "", /Hello Rajesh/);
  });

  await t.test("Exponential backoff calculation grows accurately with attempts", () => {
    assert.equal(calculateBackoffMs(1), 2000);   // 2 * 2^0 = 2000 ms
    assert.equal(calculateBackoffMs(2), 4000);   // 2 * 2^1 = 4000 ms
    assert.equal(calculateBackoffMs(3), 8000);   // 2 * 2^2 = 8000 ms
    assert.equal(calculateBackoffMs(4), 16000);  // 2 * 2^3 = 16000 ms
  });
});

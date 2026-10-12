import type { PrismaClient } from "../../generated/prisma/client.js";
import type { EmailProvider, WhatsAppProvider } from "./notification.types.js";
import { dispatchEmailDelivery, dispatchWhatsAppDelivery } from "./notification.service.js";
import { loadEnvironment } from "../../config/env.js";

const env = loadEnvironment();
const MAX_RETRIES = env.NOTIFICATION_MAX_RETRIES || 3;

export async function processPendingNotificationRetries(
  database: PrismaClient,
  emailProvider: EmailProvider,
  whatsappProvider: WhatsAppProvider,
  options: { limit?: number; now?: Date } = {}
) {
  const now = options.now || new Date();
  const limit = options.limit || 50;

  // Find deliveries that are PENDING, have exceeded nextAttemptAt, and haven't exceeded MAX_RETRIES
  const pendingDeliveries = await database.delivery.findMany({
    where: {
      status: "PENDING",
      attempts: { lt: MAX_RETRIES },
      OR: [
        { nextAttemptAt: { lte: now } },
        { nextAttemptAt: null, attempts: 0 },
      ],
    },
    include: {
      notification: {
        include: {
          recipient: true,
        },
      },
      invoice: {
        include: {
          sale: {
            include: {
              customer: true,
            },
          },
        },
      },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  for (const delivery of pendingDeliveries) {
    results.processed++;

    if (delivery.channel === "EMAIL") {
      const email = delivery.notification?.recipient?.email || delivery.invoice?.sale?.customer?.email;
      if (!email) {
        // Cannot deliver without email address -> mark permanently failed
        await database.delivery.update({
          where: { id: delivery.id },
          data: { status: "FAILED", lastError: "Recipient has no email address configured" },
        });
        results.failed++;
        continue;
      }

      const subject = delivery.invoice
        ? `Invoice #${delivery.invoice.number}`
        : `Notification: ${delivery.notification?.kind || "Notice"}`;
      const message = delivery.notification?.message || "You have a new notification";

      await dispatchEmailDelivery(
        database,
        emailProvider,
        delivery.id,
        email,
        subject,
        `<p>${message}</p>`
      );
    } else if (delivery.channel === "WHATSAPP") {
      const phone = delivery.notification?.recipient?.phone || delivery.invoice?.sale?.customer?.phone;
      if (!phone) {
        await database.delivery.update({
          where: { id: delivery.id },
          data: { status: "FAILED", lastError: "Recipient has no phone number configured" },
        });
        results.failed++;
        continue;
      }

      const message = delivery.notification?.message || `Your invoice #${delivery.invoice?.number || ""} is ready.`;

      await dispatchWhatsAppDelivery(
        database,
        whatsappProvider,
        delivery.id,
        phone,
        message
      );
    }

    // Check final status
    const updated = await database.delivery.findUnique({ where: { id: delivery.id } });
    if (updated?.status === "SENT") {
      results.succeeded++;
    } else {
      results.failed++;
    }
  }

  return results;
}

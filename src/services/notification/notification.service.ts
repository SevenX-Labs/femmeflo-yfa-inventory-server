import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  EmailProvider,
  WhatsAppProvider,
  NotificationDispatchOptions,
  DeliveryChannelType,
} from "./notification.types.js";
import { loadEnvironment } from "../../config/env.js";

const env = loadEnvironment();
const MAX_RETRIES = env.NOTIFICATION_MAX_RETRIES || 3;
const BASE_RETRY_DELAY_MS = 2000; // 2 seconds

export function calculateBackoffMs(attempts: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1));
}

export function createNotificationService(
  database: PrismaClient,
  emailProvider: EmailProvider,
  whatsappProvider: WhatsAppProvider
) {
  return {
    /**
     * Creates Notification and Delivery records in DB, then triggers delivery attempts.
     * Prevents any external provider failure from throwing or crashing caller workflows.
     */
    notifyUser: async (options: NotificationDispatchOptions) => {
      try {
        const channels: DeliveryChannelType[] = options.channels && options.channels.length > 0
          ? options.channels
          : options.email ? ["EMAIL"] : [];

        // 1. Create Notification record
        const notification = await database.notification.create({
          data: {
            recipientId: options.recipientId,
            kind: options.kind,
            message: options.message,
            saleId: options.saleId ?? null,
          },
        });

        // 2. Create pending Delivery records for each channel
        const deliveries = await Promise.all(
          channels.map(async (channel) => {
            return database.delivery.create({
              data: {
                notificationId: notification.id,
                invoiceId: options.invoiceId ?? null,
                channel,
                status: "PENDING",
                attempts: 0,
              },
            });
          })
        );

        // 3. Dispatch deliveries
        for (const delivery of deliveries) {
          if (delivery.channel === "EMAIL" && options.email) {
            await dispatchEmailDelivery(
              database,
              emailProvider,
              delivery.id,
              options.email,
              `FemmeFlo Notification: ${options.kind.replace(/_/g, " ")}`,
              `<p>${options.message}</p>`
            );
          } else if (delivery.channel === "WHATSAPP" && options.phone) {
            await dispatchWhatsAppDelivery(
              database,
              whatsappProvider,
              delivery.id,
              options.phone,
              options.message
            );
          }
        }

        return notification;
      } catch (error) {
        console.error("Failed to create/dispatch notification:", error);
        return null;
      }
    },

    /**
     * Dispatch an invoice delivery
     */
    sendInvoiceDelivery: async (invoiceId: string, channels: DeliveryChannelType[] = ["EMAIL", "WHATSAPP"]) => {
      try {
        const invoice = await database.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            sale: {
              include: {
                customer: true,
                seller: true,
              },
            },
          },
        });

        if (!invoice) return;

        const customer = invoice.sale.customer;
        const message = `Hello ${customer.contactName}, your invoice #${invoice.number} for ₹${(invoice.sale.totalPaise / 100).toFixed(2)} has been generated. Thank you for your business!`;

        // Deliver to customer
        for (const channel of channels) {
          if (channel === "EMAIL" && customer.email) {
            const delivery = await database.delivery.create({
              data: {
                invoiceId: invoice.id,
                channel: "EMAIL",
                status: "PENDING",
                attempts: 0,
              },
            });
            await dispatchEmailDelivery(
              database,
              emailProvider,
              delivery.id,
              customer.email,
              `Your FemmeFlo Invoice ${invoice.number}`,
              `<p>${message}</p>`
            );
          } else if (channel === "WHATSAPP" && customer.phone) {
            const delivery = await database.delivery.create({
              data: {
                invoiceId: invoice.id,
                channel: "WHATSAPP",
                status: "PENDING",
                attempts: 0,
              },
            });
            await dispatchWhatsAppDelivery(
              database,
              whatsappProvider,
              delivery.id,
              customer.phone,
              message
            );
          }
        }
      } catch (err) {
        console.error("Failed to send invoice delivery:", err);
      }
    },

    /**
     * Send password reset email
     */
    sendPasswordResetEmail: async (email: string, resetToken: string, userName: string = "User") => {
      try {
        const resetUrl = `https://app.femmeflo.com/reset-password?token=${encodeURIComponent(resetToken)}`;
        const subject = "Reset Your FemmeFlo Password";
        const html = `
          <h2>Hello ${userName},</h2>
          <p>We received a request to reset your FemmeFlo account password.</p>
          <p>Click the link below or copy it into your browser to set a new password:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
        `;

        const result = await emailProvider.sendEmail({
          to: email,
          subject,
          html,
          text: `Reset your password: ${resetUrl}`,
        });

        return result;
      } catch (error) {
        console.error("Failed to send password reset email:", error);
        return { success: false, error: String(error) };
      }
    },
  };
}

export async function dispatchEmailDelivery(
  database: PrismaClient,
  emailProvider: EmailProvider,
  deliveryId: string,
  to: string,
  subject: string,
  html: string
) {
  const delivery = await database.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery || delivery.status === "SENT") return;

  const currentAttempts = delivery.attempts + 1;
  const result = await emailProvider.sendEmail({ to, subject, html });

  if (result.success) {
    await database.delivery.update({
      where: { id: deliveryId },
      data: {
        status: "SENT",
        attempts: currentAttempts,
        providerRef: result.providerRef ?? null,
        lastError: null,
        nextAttemptAt: null,
      },
    });
  } else {
    const isTransient = result.isTransient ?? true;
    const isPermanentlyFailed = !isTransient || currentAttempts >= MAX_RETRIES;
    const nextAttemptAt = isPermanentlyFailed
      ? null
      : new Date(Date.now() + calculateBackoffMs(currentAttempts));

    await database.delivery.update({
      where: { id: deliveryId },
      data: {
        status: isPermanentlyFailed ? "FAILED" : "PENDING",
        attempts: currentAttempts,
        lastError: result.error || "Unknown delivery failure",
        nextAttemptAt,
      },
    });
  }
}

export async function dispatchWhatsAppDelivery(
  database: PrismaClient,
  whatsappProvider: WhatsAppProvider,
  deliveryId: string,
  to: string,
  message: string
) {
  const delivery = await database.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery || delivery.status === "SENT") return;

  const currentAttempts = delivery.attempts + 1;
  const result = await whatsappProvider.sendWhatsApp({ to, message });

  if (result.success) {
    await database.delivery.update({
      where: { id: deliveryId },
      data: {
        status: "SENT",
        attempts: currentAttempts,
        providerRef: result.providerRef ?? null,
        lastError: null,
        nextAttemptAt: null,
      },
    });
  } else {
    const isTransient = result.isTransient ?? true;
    const isPermanentlyFailed = !isTransient || currentAttempts >= MAX_RETRIES;
    const nextAttemptAt = isPermanentlyFailed
      ? null
      : new Date(Date.now() + calculateBackoffMs(currentAttempts));

    await database.delivery.update({
      where: { id: deliveryId },
      data: {
        status: isPermanentlyFailed ? "FAILED" : "PENDING",
        attempts: currentAttempts,
        lastError: result.error || "Unknown delivery failure",
        nextAttemptAt,
      },
    });
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>;

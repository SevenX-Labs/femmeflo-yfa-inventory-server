import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { PublicUser } from "../services/auth/auth.types.js";
import { parseInput, idSchema } from "../middleware/validation.js";

function mapNotificationItem(
  row: {
    id: string;
    kind: string;
    message: string;
    readAt: Date | null;
    createdAt: Date;
    saleId: string | null;
    sale: {
      id: string;
      status: string;
      totalPaise: number;
      paymentMode: string;
      customer: { shopName: string } | null;
    } | null;
  },
  role: string
) {
  let type: "SALE" | "APPROVAL" | "INVENTORY" | "SHIFT" | "CUSTOMER" | "OFFICER" | "SYSTEM" = "SALE";
  let title = "System Notification";
  let categoryLabel = "Sales Orders";
  let actionUrl: string | undefined;

  switch (row.kind) {
    case "PAYMENT_SENT_TO_COMPANY":
      type = "SALE";
      title = "Cash / Payment Sent to FemmeFlo";
      categoryLabel = "Company Remittance";
      actionUrl = role === "SUPER_ADMIN" ? "/(admin)/sales" : "/(seller)/sales";
      break;
    case "PAYMENT_RECEIVED_COMPLETED":
      type = "SALE";
      title = "Amount Received in FemmeFlo Account";
      categoryLabel = "Sale Completed";
      actionUrl = row.saleId
        ? role === "SUPER_ADMIN"
          ? "/(admin)/sales"
          : `/(seller)/sales/${row.saleId}`
        : undefined;
      break;
    case "LOW_PRICE_APPROVAL_REQUEST":
      type = "APPROVAL";
      title = "Low-Price Sale Approval Request";
      categoryLabel = "Approval Alerts";
      actionUrl = "/(admin)/approvals";
      break;
    case "LOW_PRICE_SALE_APPROVED":
      type = "APPROVAL";
      title = "Sale Approved";
      categoryLabel = "Approval Alerts";
      actionUrl = row.saleId ? `/(seller)/sales/${row.saleId}` : undefined;
      break;
    case "LOW_PRICE_SALE_REJECTED":
      type = "APPROVAL";
      title = "Sale Rejected — Revision Required";
      categoryLabel = "Approval Alerts";
      actionUrl = row.saleId ? `/(seller)/sales/${row.saleId}` : undefined;
      break;
    default:
      type = "SYSTEM";
      title = row.kind.replace(/_/g, " ");
      categoryLabel = "Notifications";
      break;
  }

  return {
    id: row.id,
    title,
    message: row.message,
    type,
    categoryLabel,
    read: Boolean(row.readAt),
    createdAt: row.createdAt.toISOString(),
    actionUrl,
    metadata: row.sale
      ? {
          saleId: row.sale.id,
          status: row.sale.status,
          totalPaise: row.sale.totalPaise,
          paymentMode: row.sale.paymentMode,
          shopName: row.sale.customer?.shopName,
        }
      : undefined,
  };
}

export function createNotificationRoutes(database: PrismaClient) {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      const user = response.locals.authUser as PublicUser;
      const rows = await database.notification.findMany({
        where: { recipientId: user.id },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
        include: {
          sale: {
            select: {
              id: true,
              status: true,
              totalPaise: true,
              paymentMode: true,
              customer: { select: { shopName: true } },
            },
          },
        },
      });

      const items = rows.map((r) => mapNotificationItem(r, user.role));
      const unreadCount = items.reduce((acc, item) => (item.read ? acc : acc + 1), 0);

      response.json({
        success: true,
        message: "Notifications retrieved",
        data: {
          items,
          notifications: items,
          unreadCount,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id/read", async (request, response, next) => {
    try {
      const user = response.locals.authUser as PublicUser;
      const id = parseInput(idSchema, request.params["id"]);
      await database.notification.updateMany({
        where: { id, recipientId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      response.json({
        success: true,
        message: "Notification marked as read",
        data: { success: true },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/read-all", async (_request, response, next) => {
    try {
      const user = response.locals.authUser as PublicUser;
      await database.notification.updateMany({
        where: { recipientId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      response.json({
        success: true,
        message: "All notifications marked as read",
        data: { success: true },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

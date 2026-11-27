import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { HttpError } from "../../middleware/validation.js";
import { realtimeHub } from "../realtime/realtime.service.js";
import { getISTDateComponents, istToUtcDate } from "../../utils/timezone.utils.js";

/**
 * Sale statuses representing valid revenue-bearing, stock-deducted, incentive-eligible orders.
 */
export const SETTLED_SALE_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

export function isSettledSaleStatus(status?: string | null): boolean {
  return status === "CONFIRMED" || status === "COMPLETED";
}

function getISTCalendarKey(date: Date): string {
  const { year, month, day } = getISTDateComponents(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatISTReadable(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Parses an optional remittance date input (`YYYY-MM-DD` or ISO datetime).
 * When `YYYY-MM-DD` matches today's IST calendar date, preserves current timestamp;
 * for historical `YYYY-MM-DD`, anchors at 12:00 IST so it never shifts across UTC dates.
 */
export function parseRemittanceTimestamp(raw?: string | null, fallback = new Date()): Date {
  if (!raw || !raw.trim()) return fallback;
  const trimmed = raw.trim();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateMatch) {
    if (trimmed === getISTCalendarKey(fallback)) {
      return fallback;
    }
    const year = Number(dateMatch[1]);
    const monthIndex = Number(dateMatch[2]) - 1;
    const day = Number(dateMatch[3]);
    const anchored = istToUtcDate(year, monthIndex, day, 12, 0, 0, 0);
    if (Number.isNaN(anchored.getTime())) {
      throw new HttpError(400, "Invalid date value");
    }
    return anchored;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Invalid date/time format");
  }
  return parsed;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const SALE_REMITTANCE_INCLUDE = {
  customer: {
    select: {
      id: true,
      shopName: true,
      contactName: true,
      phone: true,
      state: true,
      district: true,
      village: true,
    },
  },
  seller: { select: { id: true, name: true, phone: true } },
  invoice: { select: { id: true, number: true } },
  paymentSentBy: { select: { id: true, name: true } },
  paymentReceivedBy: { select: { id: true, name: true } },
  lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
} satisfies Prisma.SaleInclude;

export async function markSalePaymentSent(
  database: PrismaClient,
  actorId: string,
  saleId: string,
  input: { remark?: string | undefined; sentAt?: string | undefined }
) {
  const sale = await database.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: { select: { shopName: true } },
      seller: { select: { id: true, name: true, managerId: true } },
      invoice: { select: { number: true } },
    },
  });

  if (!sale || sale.sellerId !== actorId) {
    throw new HttpError(404, "Sale record not found");
  }
  if (sale.status === "COMPLETED" || sale.paymentReceivedAt) {
    throw new HttpError(409, "Payment for this sale has already been received by FemmeFlo and completed.");
  }
  if (sale.status !== "CONFIRMED") {
    throw new HttpError(409, `Only confirmed sales can be marked sent (current status: ${sale.status}).`);
  }
  if (sale.paymentMode !== "CASH" && sale.paymentMode !== "BANK") {
    throw new HttpError(409, "Collect Cash or Bank/UPI payment from the retailer before marking sent to company.");
  }

  const sentAt = parseRemittanceTimestamp(input.sentAt);
  const remark = input.remark?.trim() || null;

  const updatedSale = await database.$transaction(async (tx) => {
    const updated = await tx.sale.update({
      where: { id: saleId },
      data: {
        paymentSentAt: sentAt,
        paymentSentRemark: remark,
        paymentSentById: actorId,
      },
      include: SALE_REMITTANCE_INCLUDE,
    });

    const admins = await tx.user.findMany({
      where: { role: "SUPER_ADMIN", active: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      const invoiceRef = sale.invoice?.number || `Order #${sale.id.slice(0, 8)}`;
      const remarkSuffix = remark ? ` Remark: ${remark}` : "";
      const dateStr = formatISTReadable(sentAt);
      await tx.notification.createMany({
        data: admins.map((admin) => ({
          recipientId: admin.id,
          saleId: sale.id,
          kind: "PAYMENT_SENT_TO_COMPANY",
          message: `${sale.seller.name} sent ${formatRupees(sale.totalPaise)} (${sale.paymentMode}, ${sale.quantity} pkts — ${sale.customer.shopName}, ${invoiceRef}) to FemmeFlo on ${dateStr}.${remarkSuffix}`,
        })),
      });
    }

    return updated;
  });

  realtimeHub.publish({
    type: "SALE_STATUS_UPDATE",
    actorId,
    role: "SELLER",
    entityId: saleId,
    action: "PAYMENT_SENT",
    targetUserIds: [actorId],
    targetRoles: ["SUPER_ADMIN", "MANAGER"],
    data: {
      saleId,
      paymentSentAt: sentAt.toISOString(),
      paymentSentRemark: remark,
    },
  });

  return updatedSale;
}

export async function receiveAndCompleteSales(
  database: PrismaClient,
  adminId: string,
  saleIds: string[],
  input: { remark?: string | undefined; receivedAt?: string | undefined }
) {
  const uniqueIds = Array.from(new Set(saleIds));
  if (uniqueIds.length === 0) {
    throw new HttpError(400, "Select at least one confirmed sale to complete.");
  }

  const sales = await database.sale.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      customer: { select: { shopName: true } },
      seller: { select: { id: true, name: true } },
      invoice: { select: { number: true } },
      payments: { select: { id: true } },
    },
  });

  if (sales.length !== uniqueIds.length) {
    throw new HttpError(404, "One or more selected sales could not be found.");
  }

  const ineligible = sales.filter((s) => s.status !== "CONFIRMED");
  if (ineligible.length > 0) {
    const labels = ineligible
      .slice(0, 3)
      .map((s) => `${s.customer.shopName} (${s.status})`)
      .join(", ");
    throw new HttpError(
      409,
      `Only CONFIRMED sales can be marked received & completed. Ineligible: ${labels}`
    );
  }

  const unpaid = sales.filter((s) => s.paymentMode !== "CASH" && s.paymentMode !== "BANK");
  if (unpaid.length > 0) {
    const labels = unpaid
      .slice(0, 3)
      .map((s) => s.customer.shopName)
      .join(", ");
    throw new HttpError(
      409,
      `Customer payment is still PENDING for: ${labels}. Collect Cash or Bank/UPI first.`
    );
  }

  const receivedAt = parseRemittanceTimestamp(input.receivedAt);
  const remark = input.remark?.trim() || null;
  const dateStr = formatISTReadable(receivedAt);

  const completedSales = await database.$transaction(async (tx) => {
    const updatedList = await Promise.all(
      sales.map(async (sale) => {
        const updated = await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: "COMPLETED",
            paymentReceivedAt: receivedAt,
            paymentReceivedRemark: remark,
            paymentReceivedById: adminId,
          },
          include: SALE_REMITTANCE_INCLUDE,
        });

        if (!sale.payments || sale.payments.length === 0) {
          await tx.paymentRecord.create({
            data: {
              saleId: sale.id,
              collectorId: sale.sellerId,
              mode: sale.paymentMode,
              amountPaise: sale.totalPaise,
            },
          });
        }

        return updated;
      })
    );

    const remarkSuffix = remark ? ` Remark: ${remark}` : "";
    await tx.notification.createMany({
      data: sales.map((sale) => {
        const invoiceRef = sale.invoice?.number || `Order #${sale.id.slice(0, 8)}`;
        return {
          recipientId: sale.sellerId,
          saleId: sale.id,
          kind: "PAYMENT_RECEIVED_COMPLETED",
          message: `Yes! ${formatRupees(sale.totalPaise)} (${sale.paymentMode}, ${sale.quantity} pkts for ${sale.customer.shopName}, ${invoiceRef}) was received in FemmeFlo account on ${dateStr}. Sale is now COMPLETED.${remarkSuffix}`,
        };
      }),
    });

    return updatedList;
  });

  const sellerIds = Array.from(new Set(sales.map((s) => s.sellerId)));
  for (const sale of completedSales) {
    realtimeHub.publish({
      type: "SALE_STATUS_UPDATE",
      actorId: adminId,
      role: "SUPER_ADMIN",
      entityId: sale.id,
      action: "PAYMENT_RECEIVED_COMPLETED",
      targetUserIds: sellerIds,
      targetRoles: ["SUPER_ADMIN", "MANAGER"],
      data: {
        saleId: sale.id,
        status: "COMPLETED",
        paymentReceivedAt: receivedAt.toISOString(),
        paymentReceivedRemark: remark,
      },
    });
  }

  return completedSales;
}

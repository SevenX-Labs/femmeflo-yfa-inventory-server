import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { CreateSaleInput, ListSalesInput } from "../../controller/sales.validation.js";
import { HttpError } from "../../middleware/validation.js";

// Helper function to build date range filters for month boundaries (Asia/Kolkata or UTC)
export function getPeriodDateRange(period?: "all" | "this_month" | "last_month"): { gte?: Date; lte?: Date } | undefined {
  if (!period || period === "all") return undefined;

  const now = new Date();
  if (period === "this_month") {
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { gte: startOfMonth };
  }
  if (period === "last_month") {
    const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const endOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    return { gte: startOfLastMonth, lte: endOfLastMonth };
  }
  return undefined;
}

export function createSellerSalesService(database: PrismaClient) {
  return {
    create: async (sellerId: string, input: CreateSaleInput) => {
      // 1. Verify Customer belongs to Seller
      const customer = await database.customer.findUnique({
        where: { id: input.customerId },
        include: { category: true },
      });

      if (!customer || !customer.active) {
        throw new HttpError(400, "Invalid or inactive customer ID");
      }
      if (customer.sellerId !== sellerId) {
        throw new HttpError(403, "Customer is not assigned to you");
      }

      const seller = await database.user.findUnique({ where: { id: sellerId } });
      if (!seller || !seller.active) {
        throw new HttpError(404, "Seller account not found or inactive");
      }

      // Check for duplicate requestKey if provided
      if (input.requestKey) {
        const existingSale = await database.sale.findUnique({ where: { requestKey: input.requestKey } });
        if (existingSale) return existingSale;
      }

      const totalPaise = input.quantity * input.unitPricePaise;

      // 2. Fetch BusinessSettings for price threshold & incentive rate
      let settings = await database.businessSettings.findUnique({ where: { id: 1 } });
      if (!settings) {
        settings = await database.businessSettings.create({
          data: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: null },
        });
      }

      const isLowPrice = input.unitPricePaise < settings.minimumPricePaise;

      if (isLowPrice) {
        // Require Admin Approval. Do NOT deduct stock or calculate incentive yet.
        const saleData: Record<string, unknown> = {
          sellerId,
          customerId: input.customerId,
          quantity: input.quantity,
          unitPricePaise: input.unitPricePaise,
          totalPaise,
          paymentMode: input.paymentMode,
          status: "PENDING_APPROVAL",
        };
        if (input.requestKey !== undefined) saleData["requestKey"] = input.requestKey;

        const sale = await database.sale.create({
          data: saleData as Prisma.SaleCreateInput,
          include: {
            customer: { select: { id: true, shopName: true, contactName: true } },
            seller: { select: { id: true, name: true, phone: true } },
          },
        });

        // Notify Admin
        const admins = await database.user.findMany({ where: { role: "SUPER_ADMIN", active: true } });
        if (admins.length > 0) {
          await database.notification.createMany({
            data: admins.map((admin) => ({
              recipientId: admin.id,
              saleId: sale.id,
              kind: "LOW_PRICE_APPROVAL_REQUEST",
              message: `Low-price sale approval request from ${seller.name}: ${sale.quantity} packets @ ₹${(sale.unitPricePaise / 100).toFixed(2)}/packet`,
            })),
          });
        }

        return sale;
      }

      // Unit price >= ₹25: Confirm immediately in atomic transaction
      return database.$transaction(async (tx) => {
        // Find seller stock location
        const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId } });
        if (!sellerLoc) {
          throw new HttpError(404, "Stock location for seller not found");
        }
        if (sellerLoc.balance < input.quantity) {
          throw new HttpError(409, `Insufficient stock balance. Available: ${sellerLoc.balance}, Requested: ${input.quantity}`);
        }

        // Calculate incentive snapshot
        const incentiveRatePaise = settings.incentiveRatePaise;
        const incentiveAmountPaise = incentiveRatePaise !== null && incentiveRatePaise !== undefined ? input.quantity * incentiveRatePaise : null;

        // Deduct seller stock
        await tx.stockLocation.update({
          where: { id: sellerLoc.id },
          data: { balance: { decrement: input.quantity } },
        });

        // Create Sale record
        const saleData: Record<string, unknown> = {
          sellerId,
          customerId: input.customerId,
          quantity: input.quantity,
          unitPricePaise: input.unitPricePaise,
          totalPaise,
          paymentMode: input.paymentMode,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          incentiveRatePaise: incentiveRatePaise ?? null,
          incentiveAmountPaise: incentiveAmountPaise ?? null,
        };
        if (input.requestKey !== undefined) saleData["requestKey"] = input.requestKey;

        const sale = await tx.sale.create({
          data: saleData as Prisma.SaleCreateInput,
          include: {
            customer: { select: { id: true, shopName: true, contactName: true, phone: true, email: true, state: true, district: true, village: true } },
            seller: { select: { id: true, name: true, phone: true, email: true } },
          },
        });

        // Record Sale StockMovement
        await tx.stockMovement.create({
          data: {
            type: "SALE",
            quantity: input.quantity,
            sourceId: sellerLoc.id,
            actorId: sellerId,
            saleId: sale.id,
          },
        });

        // Generate Invoice
        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const invoiceSnapshot = {
          invoiceNumber,
          saleId: sale.id,
          date: sale.createdAt.toISOString(),
          customer: {
            shopName: customer.shopName,
            contactName: customer.contactName,
            phone: customer.phone,
            state: customer.state,
            district: customer.district,
            village: customer.village,
          },
          seller: {
            name: seller.name,
            phone: seller.phone,
          },
          quantity: sale.quantity,
          unitPricePaise: sale.unitPricePaise,
          totalPaise: sale.totalPaise,
          paymentMode: sale.paymentMode,
        };

        const invoice = await tx.invoice.create({
          data: {
            saleId: sale.id,
            number: invoiceNumber,
            snapshot: invoiceSnapshot as Prisma.InputJsonValue,
          },
        });

        // Record PaymentRecord if Cash/Bank
        if (input.paymentMode === "CASH" || input.paymentMode === "BANK") {
          await tx.paymentRecord.create({
            data: {
              saleId: sale.id,
              collectorId: sellerId,
              mode: input.paymentMode,
              amountPaise: totalPaise,
            },
          });
        }

        return { ...sale, invoice };
      });
    },

    list: async (sellerId: string, query: ListSalesInput) => {
      const where: Prisma.SaleWhereInput = { sellerId };

      if (query.status) where.status = query.status;
      if (query.paymentMode) where.paymentMode = query.paymentMode;
      if (query.customerId) where.customerId = query.customerId;

      const dateRange = getPeriodDateRange(query.period);
      if (dateRange) where.createdAt = dateRange;

      if (query.search) {
        where.customer = {
          OR: [
            { shopName: { contains: query.search, mode: "insensitive" } },
            { contactName: { contains: query.search, mode: "insensitive" } },
          ],
        };
      }

      const total = await database.sale.count({ where });
      const totalPages = Math.ceil(total / query.pageSize);
      const items = await database.sale.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
          invoice: { select: { id: true, number: true } },
        },
      });

      return {
        items,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: totalPages === 0 && total === 0 ? 0 : Math.max(1, totalPages),
        },
      };
    },

    get: async (sellerId: string, id: string) => {
      const sale = await database.sale.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
          invoice: true,
          payments: true,
        },
      });

      if (!sale || sale.sellerId !== sellerId) {
        throw new HttpError(404, "Sale record not found");
      }
      return sale;
    },

    collectPayment: async (sellerId: string, saleId: string, mode: "CASH" | "BANK") => {
      const sale = await database.sale.findUnique({
        where: { id: saleId },
        include: { payments: true },
      });

      if (!sale || sale.sellerId !== sellerId) {
        throw new HttpError(404, "Sale record not found");
      }
      if (sale.paymentMode !== "PENDING") {
        throw new HttpError(409, `Payment for this sale has already been set to ${sale.paymentMode}`);
      }

      return database.$transaction(async (tx) => {
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: { paymentMode: mode },
        });

        const payment = await tx.paymentRecord.create({
          data: {
            saleId: sale.id,
            collectorId: sellerId,
            mode,
            amountPaise: sale.totalPaise,
          },
        });

        return { sale: updatedSale, payment };
      });
    },
  };
}

export type SellerSalesService = ReturnType<typeof createSellerSalesService>;

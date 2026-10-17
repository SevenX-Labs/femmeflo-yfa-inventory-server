import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { ListSalesInput, RejectSaleInput } from "../../controller/sales.validation.js";
import { HttpError } from "../../middleware/validation.js";
import { processInvoicePdf } from "../pdf.service.js";

export function createAdminApprovalService(database: PrismaClient) {
  return {
    listPending: async (query: ListSalesInput) => {
      const where: Prisma.SaleWhereInput = { status: "PENDING_APPROVAL" };

      if (query.sellerId) where.sellerId = query.sellerId;
      if (query.customerId) where.customerId = query.customerId;
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
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
          seller: { select: { id: true, name: true, phone: true } },
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

    approve: async (adminId: string, saleId: string) => {
      const result = await database.$transaction(async (tx) => {

        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
            seller: { select: { id: true, name: true, phone: true, email: true } },
          },
        });

        if (!sale) {
          throw new HttpError(404, "Sale record not found");
        }
        if (sale.status !== "PENDING_APPROVAL") {
          throw new HttpError(409, `Sale has already been decided with status: ${sale.status}`);
        }

        // Check seller stock balance
        const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId: sale.sellerId } });
        if (!sellerLoc) {
          throw new HttpError(404, "Stock location for seller not found");
        }
        if (sellerLoc.balance < sale.quantity) {
          throw new HttpError(409, `Insufficient stock at seller location. Available: ${sellerLoc.balance}, Requested: ${sale.quantity}`);
        }

        // Read BusinessSettings for incentive rate
        let settings = await tx.businessSettings.findUnique({ where: { id: 1 } });
        if (!settings) {
          settings = await tx.businessSettings.create({ data: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: null } });
        }

        const sellerUser = await tx.user.findUnique({
          where: { id: sale.sellerId },
          select: { incentiveRatePaise: true },
        });
        const incentiveRatePaise = sellerUser?.incentiveRatePaise ?? settings.incentiveRatePaise;
        const incentiveAmountPaise = incentiveRatePaise !== null && incentiveRatePaise !== undefined ? sale.quantity * incentiveRatePaise : null;

        // Deduct seller stock
        await tx.stockLocation.update({
          where: { id: sellerLoc.id },
          data: { balance: { decrement: sale.quantity } },
        });

        // Record Sale StockMovement
        await tx.stockMovement.create({
          data: {
            type: "SALE",
            quantity: sale.quantity,
            sourceId: sellerLoc.id,
            actorId: sale.sellerId,
            saleId: sale.id,
          },
        });

        // Generate Invoice
        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const invoiceSnapshot = {
          invoiceNumber,
          saleId: sale.id,
          date: new Date().toISOString(),
          company: {
            name: settings.companyName,
            gst: settings.companyGst,
            pan: settings.companyPan,
            address: settings.companyAddress,
            phone: settings.companyPhone,
            email: settings.companyEmail,
            terms: settings.invoiceTerms,
          },
          customer: {
            shopName: sale.customer.shopName,
            contactName: sale.customer.contactName,
            phone: sale.customer.phone,
            state: sale.customer.state,
            district: sale.customer.district,
            village: sale.customer.village,
          },
          seller: {
            name: sale.seller.name,
            phone: sale.seller.phone,
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
        if (sale.paymentMode === "CASH" || sale.paymentMode === "BANK") {
          await tx.paymentRecord.create({
            data: {
              saleId: sale.id,
              collectorId: sale.sellerId,
              mode: sale.paymentMode,
              amountPaise: sale.totalPaise,
            },
          });
        }

        // Update Sale record to CONFIRMED
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            decidedAt: new Date(),
            decidedById: adminId,
            incentiveRatePaise,
            incentiveAmountPaise,
          },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true } },
            seller: { select: { id: true, name: true } },
          },
        });

        // Create Notification for Seller
        await tx.notification.create({
          data: {
            recipientId: sale.sellerId,
            saleId: sale.id,
            kind: "LOW_PRICE_SALE_APPROVED",
            message: `Your low-price sale of ${sale.quantity} packets to ${sale.customer.shopName} was approved by Admin.`,
          },
        });

        return { updatedSale, invoice };
      }, { timeout: 30000, maxWait: 10000 });

      // Process Invoice PDF after transaction completes
      const pdfPath = await processInvoicePdf(database, result.invoice.id).catch(() => null);
      const invoice = pdfPath ? { ...result.invoice, pdfPath } : result.invoice;
      return { ...result.updatedSale, invoice };
    },

    reject: async (adminId: string, saleId: string, input: RejectSaleInput) => {
      const sale = await database.sale.findUnique({
        where: { id: saleId },
        include: { customer: { select: { shopName: true } } },
      });

      if (!sale) {
        throw new HttpError(404, "Sale record not found");
      }
      if (sale.status !== "PENDING_APPROVAL") {
        throw new HttpError(409, `Sale has already been decided with status: ${sale.status}`);
      }

      const updatedSale = await database.sale.update({
        where: { id: saleId },
        data: {
          status: "REJECTED",
          decidedAt: new Date(),
          decidedById: adminId,
          rejectionReason: input.reason ?? "Price below minimum threshold rejected by Admin",
        },
      });

      // Create Notification for Seller
      await database.notification.create({
        data: {
          recipientId: sale.sellerId,
          saleId: sale.id,
          kind: "LOW_PRICE_SALE_REJECTED",
          message: `Your low-price sale of ${sale.quantity} packets to ${sale.customer.shopName} was rejected by Admin. ${input.reason ? `Reason: ${input.reason}` : ""}`,
        },
      });

      return updatedSale;
    },
  };
}

export type AdminApprovalService = ReturnType<typeof createAdminApprovalService>;

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
          lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
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
            lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
          },
        });

        if (!sale) {
          throw new HttpError(404, "Sale record not found");
        }
        if (sale.status !== "PENDING_APPROVAL") {
          throw new HttpError(409, `Sale has already been decided with status: ${sale.status}`);
        }

        const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId: sale.sellerId } });
        if (!sellerLoc) {
          throw new HttpError(404, "Stock location for seller not found");
        }

        let settings = await tx.businessSettings.findUnique({ where: { id: 1 } });
        if (!settings) {
          settings = await tx.businessSettings.create({
            data: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: null, companyName: "MASAKO ENTERPRISES PRIVATE LIMITED" },
          });
        }

        const sellerUser = await tx.user.findUnique({
          where: { id: sale.sellerId },
          select: { incentiveRatePaise: true },
        });
        const incentiveRatePaise = sellerUser?.incentiveRatePaise ?? settings.incentiveRatePaise;
        const totalQuantity = sale.lineItems.length > 0
          ? sale.lineItems.reduce((sum, li) => sum + li.quantity, 0)
          : sale.quantity;
        const incentiveAmountPaise = incentiveRatePaise !== null && incentiveRatePaise !== undefined ? totalQuantity * incentiveRatePaise : null;

        if (sale.lineItems.length > 0) {
          // Multi-product: deduct per-product stock
          for (const li of sale.lineItems) {
            const pb = await tx.productBalance.findUnique({
              where: { productId_stockLocationId: { productId: li.productId, stockLocationId: sellerLoc.id } },
            });
            if (!pb || pb.balance < li.quantity) {
              throw new HttpError(409, `Insufficient stock of ${li.product.name}. Available: ${pb?.balance ?? 0}, Requested: ${li.quantity}`);
            }
            await tx.productBalance.update({
              where: { productId_stockLocationId: { productId: li.productId, stockLocationId: sellerLoc.id } },
              data: { balance: { decrement: li.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                type: "SALE",
                quantity: li.quantity,
                sourceId: sellerLoc.id,
                actorId: sale.sellerId,
                saleId: sale.id,
                productId: li.productId,
              },
            });
          }
          await tx.stockLocation.update({
            where: { id: sellerLoc.id },
            data: { balance: { decrement: totalQuantity } },
          });
        } else {
          // Legacy single-product sale
          if (sellerLoc.balance < sale.quantity) {
            throw new HttpError(409, `Insufficient stock at seller location. Available: ${sellerLoc.balance}, Requested: ${sale.quantity}`);
          }
          await tx.stockLocation.update({
            where: { id: sellerLoc.id },
            data: { balance: { decrement: sale.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              type: "SALE",
              quantity: sale.quantity,
              sourceId: sellerLoc.id,
              actorId: sale.sellerId,
              saleId: sale.id,
            },
          });
        }

        // Generate Invoice
        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const snapshotLineItems = sale.lineItems.length > 0
          ? sale.lineItems.map((li) => ({
              productName: li.product.name,
              productSku: li.product.sku,
              quantity: li.quantity,
              unitPricePaise: li.unitPricePaise,
              totalPaise: li.totalPaise,
            }))
          : undefined;

        const invoiceSnapshot = {
          invoiceNumber,
          saleId: sale.id,
          date: new Date().toISOString(),
          company: {
            name: settings.companyName || "MASAKO ENTERPRISES PRIVATE LIMITED",
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
          lineItems: snapshotLineItems,
          paymentMode: sale.paymentMode,
        };

        const invoice = await tx.invoice.create({
          data: {
            saleId: sale.id,
            number: invoiceNumber,
            snapshot: invoiceSnapshot as Prisma.InputJsonValue,
          },
        });

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
            lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
          },
        });

        await tx.notification.create({
          data: {
            recipientId: sale.sellerId,
            saleId: sale.id,
            kind: "LOW_PRICE_SALE_APPROVED",
            message: `Your sale to ${sale.customer.shopName} (${totalQuantity} items, ₹${(sale.totalPaise / 100).toFixed(2)}) was approved by Admin.`,
          },
        });

        return { updatedSale, invoice };
      }, { timeout: 30000, maxWait: 10000 });

      const pdfPath = await processInvoicePdf(database, result.invoice.id).catch(() => null);
      const invoice = pdfPath ? { ...result.invoice, pdfPath } : result.invoice;
      return { ...result.updatedSale, invoice };
    },

    reject: async (adminId: string, saleId: string, input: RejectSaleInput) => {
      const sale = await database.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: { select: { shopName: true } },
          lineItems: { include: { product: { select: { name: true } } } },
        },
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
        include: {
          lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      });

      const totalQty = sale.lineItems.length > 0
        ? sale.lineItems.reduce((sum, li) => sum + li.quantity, 0)
        : sale.quantity;

      await database.notification.create({
        data: {
          recipientId: sale.sellerId,
          saleId: sale.id,
          kind: "LOW_PRICE_SALE_REJECTED",
          message: `Your sale of ${totalQty} items to ${sale.customer.shopName} was rejected by Admin. ${input.reason ? `Reason: ${input.reason}` : ""}`,
        },
      });

      return updatedSale;
    },
  };
}

export type AdminApprovalService = ReturnType<typeof createAdminApprovalService>;

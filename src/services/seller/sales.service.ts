import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { CreateSaleInput, ListSalesInput, UpdateSaleInput } from "../../controller/sales.validation.js";
import { HttpError } from "../../middleware/validation.js";
import { processInvoicePdf } from "../pdf.service.js";

import { getISTPeriodDateRange } from "../../utils/timezone.utils.js";

// Helper function to build date range filters for month boundaries in Asia/Kolkata (IST UTC+05:30)
export function getPeriodDateRange(period?: "all" | "this_month" | "last_month"): { gte?: Date; lte?: Date } | undefined {
  return getISTPeriodDateRange(period);
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
        if (existingSale) {
          if (existingSale.sellerId !== sellerId) {
            throw new HttpError(403, "Request key belongs to another seller");
          }
          return existingSale;
        }
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
      const result = await database.$transaction(async (tx) => {

        // Find seller stock location
        const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId } });
        if (!sellerLoc) {
          throw new HttpError(404, "Stock location for seller not found");
        }
        if (sellerLoc.balance < input.quantity) {
          throw new HttpError(409, `Insufficient stock balance. Available: ${sellerLoc.balance}, Requested: ${input.quantity}`);
        }

        // Calculate incentive snapshot (user specific rate takes precedence over business default)
        const sellerUser = await tx.user.findUnique({
          where: { id: sellerId },
          select: { incentiveRatePaise: true },
        });
        const incentiveRatePaise = sellerUser?.incentiveRatePaise ?? settings.incentiveRatePaise;
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

        return { sale, invoice };
      }, { timeout: 30000, maxWait: 10000 });

      const pdfPath = await processInvoicePdf(database, result.invoice.id).catch(() => null);
      const invoice = pdfPath ? { ...result.invoice, pdfPath } : result.invoice;
      return { ...result.sale, invoice };
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
      if (sale.status === "REJECTED") {
        throw new HttpError(409, "Cannot collect payment for a rejected sale");
      }
      if (sale.status !== "CONFIRMED") {
        throw new HttpError(409, `Payment cannot be collected for sale in ${sale.status} status`);
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

    update: async (sellerId: string, saleId: string, input: UpdateSaleInput) => {
      const sale = await database.sale.findUnique({
        where: { id: saleId },
        include: { invoice: true, payments: true, customer: true },
      });

      if (!sale || sale.sellerId !== sellerId) {
        throw new HttpError(404, "Sale record not found");
      }

      // 48-hour edit window rule for Seller
      const now = new Date();
      const createdAt = new Date(sale.createdAt);
      const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      if (diffHours > 48) {
        throw new HttpError(
          403,
          "Field officers can only edit a sale within 48 hours of creation. Please contact your manager or admin to request modifications."
        );
      }

      if (sale.status === "REJECTED") {
        throw new HttpError(409, "Cannot edit a rejected sale");
      }

      // If customer changed, verify new customer belongs to this seller
      let targetCustomer = sale.customer;
      if (input.customerId && input.customerId !== sale.customerId) {
        const newCust = await database.customer.findUnique({
          where: { id: input.customerId },
        });
        if (!newCust || !newCust.active) {
          throw new HttpError(400, "Invalid or inactive customer ID");
        }
        if (newCust.sellerId !== sellerId) {
          throw new HttpError(403, "Customer is not assigned to you");
        }
        targetCustomer = newCust;
      }

      const newQty = input.quantity ?? sale.quantity;
      const newUnitPricePaise = input.unitPricePaise ?? sale.unitPricePaise;
      const newPaymentMode = input.paymentMode ?? sale.paymentMode;
      const newTotalPaise = newQty * newUnitPricePaise;

      return database.$transaction(async (tx) => {
        // If confirmed sale and quantity changed, adjust seller stock balance
        if (sale.status === "CONFIRMED") {
          const qtyDiff = newQty - sale.quantity;
          if (qtyDiff !== 0) {
            const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId } });
            if (!sellerLoc) {
              throw new HttpError(404, "Stock location for seller not found");
            }
            if (qtyDiff > 0 && sellerLoc.balance < qtyDiff) {
              throw new HttpError(
                409,
                `Insufficient stock balance to increase sale by ${qtyDiff} packets. Available: ${sellerLoc.balance}`
              );
            }

            // Adjust seller location balance
            await tx.stockLocation.update({
              where: { id: sellerLoc.id },
              data: { balance: { decrement: qtyDiff } },
            });

            // Adjust associated stock movement
            const movement = await tx.stockMovement.findFirst({ where: { saleId: sale.id } });
            if (movement) {
              await tx.stockMovement.update({
                where: { id: movement.id },
                data: { quantity: newQty },
              });
            }
          }
        }

        // Calculate updated incentive if quantity changed
        let updatedIncentiveAmountPaise = sale.incentiveAmountPaise;
        if (sale.incentiveRatePaise !== null && sale.incentiveRatePaise !== undefined) {
          updatedIncentiveAmountPaise = newQty * sale.incentiveRatePaise;
        }

        // Update sale record
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            customerId: targetCustomer.id,
            quantity: newQty,
            unitPricePaise: newUnitPricePaise,
            totalPaise: newTotalPaise,
            paymentMode: newPaymentMode,
            incentiveAmountPaise: updatedIncentiveAmountPaise,
          },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
            seller: { select: { id: true, name: true, phone: true } },
            invoice: { select: { id: true, number: true } },
          },
        });

        // Update payment record if exists and total changed or mode changed
        if (sale.payments && sale.payments.length > 0 && sale.payments[0]) {
          const firstPayment = sale.payments[0];
          await tx.paymentRecord.update({
            where: { id: firstPayment.id },
            data: {
              amountPaise: newTotalPaise,
              mode: newPaymentMode,
            },
          });
        }

        // Update invoice snapshot if invoice exists
        if (sale.invoice) {
          const existingSnapshot = (sale.invoice.snapshot as any) || {};
          const updatedSnapshot = {
            ...existingSnapshot,
            quantity: newQty,
            unitPricePaise: newUnitPricePaise,
            totalPaise: newTotalPaise,
            paymentMode: newPaymentMode,
            customer: {
              ...existingSnapshot.customer,
              shopName: targetCustomer.shopName,
              contactName: targetCustomer.contactName,
              phone: targetCustomer.phone,
            },
          };

          await tx.invoice.update({
            where: { id: sale.invoice.id },
            data: {
              snapshot: updatedSnapshot as Prisma.InputJsonValue,
            },
          });
        }

        return updatedSale;
      }, { timeout: 30000, maxWait: 10000 });
    },
  };
}

export type SellerSalesService = ReturnType<typeof createSellerSalesService>;

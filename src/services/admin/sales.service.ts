import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { ListSalesInput, UpdateSaleInput } from "../../controller/sales.validation.js";
import { HttpError } from "../../middleware/validation.js";
import { getPeriodDateRange } from "../seller/sales.service.js";

export function createAdminSalesService(database: PrismaClient) {
  return {
    list: async (query: ListSalesInput) => {
      const where: Prisma.SaleWhereInput = {};

      if (query.status) where.status = query.status;
      if (query.paymentMode) where.paymentMode = query.paymentMode;
      if (query.sellerId) where.sellerId = query.sellerId;
      if (query.customerId) where.customerId = query.customerId;

      const dateRange = getPeriodDateRange(query.period);
      if (dateRange) where.createdAt = dateRange;

      if (query.search) {
        where.OR = [
          { customer: { shopName: { contains: query.search, mode: "insensitive" } } },
          { customer: { contactName: { contains: query.search, mode: "insensitive" } } },
          { seller: { name: { contains: query.search, mode: "insensitive" } } },
        ];
      }

      const total = await database.sale.count({ where });
      const totalPages = Math.ceil(total / query.pageSize);
      const items = await database.sale.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
          seller: { select: { id: true, name: true, phone: true } },
          invoice: { select: { id: true, number: true } },
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

    get: async (id: string) => {
      const sale = await database.sale.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
          seller: { select: { id: true, name: true, phone: true, email: true } },
          invoice: true,
          payments: true,
          decidedBy: { select: { id: true, name: true } },
          lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      });

      if (!sale) {
        throw new HttpError(404, "Sale record not found");
      }
      return sale;
    },

    update: async (adminId: string, saleId: string, input: UpdateSaleInput) => {
      // Admin can edit anytime (no 48-hour restriction)
      const sale = await database.sale.findUnique({
        where: { id: saleId },
        include: { invoice: true, payments: true, customer: true, seller: true },
      });

      if (!sale) {
        throw new HttpError(404, "Sale record not found");
      }

      let targetCustomer = sale.customer;
      if (input.customerId && input.customerId !== sale.customerId) {
        const newCust = await database.customer.findUnique({
          where: { id: input.customerId },
        });
        if (!newCust) {
          throw new HttpError(400, "Invalid customer ID");
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
            const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId: sale.sellerId } });
            if (sellerLoc) {
              if (qtyDiff > 0 && sellerLoc.balance < qtyDiff) {
                throw new HttpError(
                  409,
                  `Insufficient stock balance to increase sale by ${qtyDiff} packets. Available at officer location: ${sellerLoc.balance}`
                );
              }
              await tx.stockLocation.update({
                where: { id: sellerLoc.id },
                data: { balance: { decrement: qtyDiff } },
              });

              const movement = await tx.stockMovement.findFirst({ where: { saleId: sale.id } });
              if (movement) {
                await tx.stockMovement.update({
                  where: { id: movement.id },
                  data: { quantity: newQty },
                });
              }
            }
          }
        }

        let updatedIncentiveAmountPaise = sale.incentiveAmountPaise;
        if (sale.incentiveRatePaise !== null && sale.incentiveRatePaise !== undefined) {
          updatedIncentiveAmountPaise = newQty * sale.incentiveRatePaise;
        }

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

export type AdminSalesService = ReturnType<typeof createAdminSalesService>;

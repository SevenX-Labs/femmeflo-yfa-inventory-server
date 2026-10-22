import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { ListSalesInput, UpdateSaleInput } from "../../controller/sales.validation.js";
import { HttpError } from "../../middleware/validation.js";
import { getPeriodDateRange } from "../seller/sales.service.js";
import { processInvoicePdf } from "../pdf.service.js";

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

      const [total, items] = await Promise.all([
        database.sale.count({ where }),
        database.sale.findMany({
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
        }),
      ]);
      const totalPages = Math.ceil(total / query.pageSize);

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
        include: { invoice: true, payments: true, customer: true, seller: true, lineItems: { include: { product: true } } },
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

      const wasUnconfirmed = sale.status === "REJECTED" || sale.status === "PENDING_APPROVAL";

      const result = await database.$transaction(async (tx) => {
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

        // For REJECTED/PENDING_APPROVAL: re-check price and transition state
        if (wasUnconfirmed) {
          let isLowPrice = false;
          if (sale.lineItems.length > 0) {
            for (const li of sale.lineItems) {
              const itemPrice = input.unitPricePaise ?? li.unitPricePaise;
              if (itemPrice < li.product.minimumPricePaise) {
                isLowPrice = true;
                break;
              }
            }
          } else {
            const settings = await tx.businessSettings.findUnique({ where: { id: 1 } });
            const defaultProduct = settings?.defaultProductId
              ? await tx.product.findUnique({ where: { id: settings.defaultProductId } })
              : null;
            const minPrice = defaultProduct?.minimumPricePaise ?? settings?.minimumPricePaise ?? 0;
            if (newUnitPricePaise < minPrice) {
              isLowPrice = true;
            }
          }

          if (isLowPrice) {
            // Still below minimum: set to PENDING_APPROVAL
            const updatedSale = await tx.sale.update({
              where: { id: saleId },
              data: {
                customerId: targetCustomer.id, quantity: newQty, unitPricePaise: newUnitPricePaise,
                totalPaise: newTotalPaise, paymentMode: newPaymentMode,
                status: "PENDING_APPROVAL", rejectionReason: null, decidedAt: null, decidedById: null,
              },
              include: {
                customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
                seller: { select: { id: true, name: true, phone: true } },
                invoice: { select: { id: true, number: true } },
                lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
              },
            });
            if (input.unitPricePaise !== undefined && sale.lineItems.length > 0) {
              for (const li of sale.lineItems) {
                await tx.saleLineItem.update({
                  where: { id: li.id },
                  data: { unitPricePaise: newUnitPricePaise, totalPaise: li.quantity * newUnitPricePaise },
                });
              }
            }
            return { sale: updatedSale, newInvoiceId: null as string | null };
          }

          // Price now above minimum: auto-confirm
          const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId: sale.sellerId } });
          if (!sellerLoc) {
            throw new HttpError(404, "Stock location for seller not found");
          }

          if (sale.lineItems.length > 0) {
            for (const li of sale.lineItems) {
              const itemQty = input.quantity ?? li.quantity;
              const pb = await tx.productBalance.findUnique({
                where: { productId_stockLocationId: { productId: li.productId, stockLocationId: sellerLoc.id } },
              });
              if (!pb || pb.balance < itemQty) {
                throw new HttpError(409, `Insufficient stock of ${li.product.name}. Available: ${pb?.balance ?? 0}, Requested: ${itemQty}`);
              }
              await tx.productBalance.update({
                where: { productId_stockLocationId: { productId: li.productId, stockLocationId: sellerLoc.id } },
                data: { balance: { decrement: itemQty } },
              });
              await tx.stockMovement.create({
                data: { type: "SALE", quantity: itemQty, sourceId: sellerLoc.id, actorId: sale.sellerId, saleId: sale.id, productId: li.productId },
              });
            }
            await tx.stockLocation.update({ where: { id: sellerLoc.id }, data: { balance: { decrement: newQty } } });
          } else {
            if (sellerLoc.balance < newQty) {
              throw new HttpError(409, `Insufficient stock. Available: ${sellerLoc.balance}, Requested: ${newQty}`);
            }
            await tx.stockLocation.update({ where: { id: sellerLoc.id }, data: { balance: { decrement: newQty } } });
            await tx.stockMovement.create({
              data: { type: "SALE", quantity: newQty, sourceId: sellerLoc.id, actorId: sale.sellerId, saleId: sale.id },
            });
          }

          let settings = await tx.businessSettings.findUnique({ where: { id: 1 } });
          if (!settings) {
            settings = await tx.businessSettings.create({
              data: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: null, companyName: "MASAKO ENTERPRISES PRIVATE LIMITED" },
            });
          }
          const sellerUser = await tx.user.findUnique({ where: { id: sale.sellerId }, select: { incentiveRatePaise: true, name: true, phone: true, email: true } });
          const incentiveRatePaise = sellerUser?.incentiveRatePaise ?? settings.incentiveRatePaise;
          const incentiveAmountPaise = incentiveRatePaise != null ? newQty * incentiveRatePaise : null;

          if (input.unitPricePaise !== undefined && sale.lineItems.length > 0) {
            for (const li of sale.lineItems) {
              await tx.saleLineItem.update({
                where: { id: li.id },
                data: { unitPricePaise: newUnitPricePaise, totalPaise: li.quantity * newUnitPricePaise },
              });
            }
          }

          const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const snapshotLineItems = sale.lineItems.length > 0
            ? sale.lineItems.map((li) => ({
                productName: li.product.name, productSku: li.product.sku,
                quantity: input.quantity ?? li.quantity,
                unitPricePaise: input.unitPricePaise ?? li.unitPricePaise,
                totalPaise: (input.quantity ?? li.quantity) * (input.unitPricePaise ?? li.unitPricePaise),
              }))
            : undefined;

          const invoiceSnapshot = {
            invoiceNumber, saleId: sale.id, date: new Date().toISOString(),
            company: {
              name: settings.companyName || "MASAKO ENTERPRISES PRIVATE LIMITED",
              gst: settings.companyGst, pan: settings.companyPan, address: settings.companyAddress,
              phone: settings.companyPhone, email: settings.companyEmail, terms: settings.invoiceTerms,
            },
            customer: {
              shopName: targetCustomer.shopName, contactName: targetCustomer.contactName,
              phone: targetCustomer.phone, state: targetCustomer.state,
              district: targetCustomer.district, village: targetCustomer.village,
            },
            seller: { name: sellerUser?.name ?? sale.seller.name, phone: sellerUser?.phone ?? sale.seller.phone },
            quantity: newQty, unitPricePaise: newUnitPricePaise, totalPaise: newTotalPaise,
            lineItems: snapshotLineItems, paymentMode: newPaymentMode,
          };

          const invoice = await tx.invoice.create({
            data: { saleId: sale.id, number: invoiceNumber, snapshot: invoiceSnapshot as Prisma.InputJsonValue },
          });

          if (newPaymentMode === "CASH" || newPaymentMode === "BANK") {
            await tx.paymentRecord.create({
              data: { saleId: sale.id, collectorId: sale.sellerId, mode: newPaymentMode, amountPaise: newTotalPaise },
            });
          }

          const updatedSale = await tx.sale.update({
            where: { id: saleId },
            data: {
              customerId: targetCustomer.id, quantity: newQty, unitPricePaise: newUnitPricePaise,
              totalPaise: newTotalPaise, paymentMode: newPaymentMode,
              status: "CONFIRMED", confirmedAt: new Date(),
              rejectionReason: null, decidedAt: new Date(), decidedById: adminId,
              incentiveRatePaise: incentiveRatePaise ?? null, incentiveAmountPaise: incentiveAmountPaise ?? null,
            },
            include: {
              customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
              seller: { select: { id: true, name: true, phone: true } },
              invoice: { select: { id: true, number: true } },
              lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
            },
          });

          await tx.notification.create({
            data: {
              recipientId: sale.sellerId, saleId: sale.id, kind: "LOW_PRICE_SALE_APPROVED",
              message: `Your sale to ${targetCustomer.shopName} was updated and confirmed by Admin.`,
            },
          });

          return { sale: updatedSale, newInvoiceId: invoice.id as string | null };
        }

        // CONFIRMED sale: existing update logic
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
            lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
          },
        });

        if (sale.payments && sale.payments.length > 0 && sale.payments[0]) {
          const firstPayment = sale.payments[0];
          await tx.paymentRecord.update({
            where: { id: firstPayment.id },
            data: { amountPaise: newTotalPaise, mode: newPaymentMode },
          });
        }

        if (sale.invoice) {
          const existingSnapshot = (sale.invoice.snapshot as any) || {};
          const updatedSnapshot = {
            ...existingSnapshot,
            quantity: newQty, unitPricePaise: newUnitPricePaise, totalPaise: newTotalPaise,
            paymentMode: newPaymentMode,
            customer: {
              ...existingSnapshot.customer,
              shopName: targetCustomer.shopName, contactName: targetCustomer.contactName, phone: targetCustomer.phone,
            },
          };
          await tx.invoice.update({
            where: { id: sale.invoice.id },
            data: { snapshot: updatedSnapshot as Prisma.InputJsonValue },
          });
        }

        return { sale: updatedSale, newInvoiceId: null as string | null };
      }, { timeout: 30000, maxWait: 10000 });

      if (result.newInvoiceId) {
        processInvoicePdf(database, result.newInvoiceId).catch((err) => {
          console.warn("Background PDF generation warning:", err);
        });
      }

      return result.sale;
    },
  };
}

export type AdminSalesService = ReturnType<typeof createAdminSalesService>;

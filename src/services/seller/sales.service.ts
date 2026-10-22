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
  async function resolveDefaultProductId(): Promise<string> {
    const settings = await database.businessSettings.findUnique({ where: { id: 1 } });
    if (settings?.defaultProductId) {
      const exists = await database.product.findUnique({ where: { id: settings.defaultProductId } });
      if (exists) {
        return exists.id;
      }
    }
    const activeProduct = await database.product.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
    if (activeProduct) {
      await database.businessSettings.upsert({
        where: { id: 1 },
        update: { defaultProductId: activeProduct.id },
        create: { id: 1, minimumPricePaise: 2500, defaultProductId: activeProduct.id },
      });
      return activeProduct.id;
    }
    throw new HttpError(400, "No active product found in the system. Please ensure at least one product is created in Admin > Products.");
  }

  type NormalizedItem = { productId: string; quantity: number; unitPricePaise: number };

  type NormalizedResult = { customerId: string; items: NormalizedItem[]; paymentMode: "CASH" | "BANK" | "PENDING"; requestKey: string | undefined };

  async function normalizeInput(input: CreateSaleInput): Promise<NormalizedResult> {
    if ("items" in input) {
      return { customerId: input.customerId, items: input.items, paymentMode: input.paymentMode, requestKey: input.requestKey };
    }
    const defaultProductId = await resolveDefaultProductId();
    return {
      customerId: input.customerId,
      items: [{ productId: defaultProductId, quantity: input.quantity, unitPricePaise: input.unitPricePaise }],
      paymentMode: input.paymentMode,
      requestKey: input.requestKey,
    };  
  }

  return {
    create: async (sellerId: string, input: CreateSaleInput) => {
      const normalized = await normalizeInput(input);

      // 1. Verify Customer belongs to Seller
      const customer = await database.customer.findUnique({
        where: { id: normalized.customerId },
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
      if (normalized.requestKey) {
        const existingSale = await database.sale.findUnique({ where: { requestKey: normalized.requestKey } });
        if (existingSale) {
          if (existingSale.sellerId !== sellerId) {
            throw new HttpError(403, "Request key belongs to another seller");
          }
          return existingSale;
        }
      }

      // Calculate totals
      const lineItems = normalized.items.map((item) => ({
        ...item,
        totalPaise: item.quantity * item.unitPricePaise,
      }));
      const totalQuantity = lineItems.reduce((sum, li) => sum + li.quantity, 0);
      const grandTotalPaise = lineItems.reduce((sum, li) => sum + li.totalPaise, 0);

      // 2. Fetch BusinessSettings + validate per-product minimum prices
      let settings = await database.businessSettings.findUnique({ where: { id: 1 } });
      if (!settings) {
        settings = await database.businessSettings.create({
          data: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: null, companyName: "MASAKO ENTERPRISES PRIVATE LIMITED" },
        });
      }

      // Resolve products and check prices
      let isLowPrice = false;
      const productLookup = new Map<string, { id: string; name: string; sku: string | null; minimumPricePaise: number }>();
      for (const item of lineItems) {
        if (!productLookup.has(item.productId)) {
          const product = await database.product.findUnique({ where: { id: item.productId } });
          if (!product || !product.active) {
            throw new HttpError(400, `Product not found or inactive: ${item.productId}`);
          }
          productLookup.set(item.productId, { id: product.id, name: product.name, sku: product.sku, minimumPricePaise: product.minimumPricePaise });
        }
        const product = productLookup.get(item.productId)!;
        if (item.unitPricePaise < product.minimumPricePaise) {
          isLowPrice = true;
        }
      }

      if (isLowPrice) {
        const saleData: Record<string, unknown> = {
          sellerId,
          customerId: normalized.customerId,
          quantity: totalQuantity,
          unitPricePaise: lineItems.length === 1 ? lineItems[0]!.unitPricePaise : (totalQuantity > 0 ? Math.round(grandTotalPaise / totalQuantity) : 0),
          totalPaise: grandTotalPaise,
          paymentMode: normalized.paymentMode,
          status: "PENDING_APPROVAL",
        };
        if (normalized.requestKey !== undefined) saleData["requestKey"] = normalized.requestKey;

        const sale = await database.sale.create({
          data: saleData as Prisma.SaleCreateInput,
          include: {
            customer: { select: { id: true, shopName: true, contactName: true } },
            seller: { select: { id: true, name: true, phone: true } },
          },
        });

        // Create SaleLineItems
        await database.saleLineItem.createMany({
          data: lineItems.map((li) => ({
            saleId: sale.id,
            productId: li.productId,
            quantity: li.quantity,
            unitPricePaise: li.unitPricePaise,
            totalPaise: li.totalPaise,
          })),
        });

        // Notify Admin
        const admins = await database.user.findMany({ where: { role: "SUPER_ADMIN", active: true } });
        if (admins.length > 0) {
          const itemSummary = lineItems.map((li) => {
            const p = productLookup.get(li.productId)!;
            return `${p.name}: ${li.quantity} × ₹${(li.unitPricePaise / 100).toFixed(2)}`;
          }).join(", ");
          await database.notification.createMany({
            data: admins.map((admin) => ({
              recipientId: admin.id,
              saleId: sale.id,
              kind: "LOW_PRICE_APPROVAL_REQUEST",
              message: `Low-price sale approval request from ${seller.name}: ${itemSummary}`,
            })),
          });
        }

        const created = await database.sale.findUnique({
          where: { id: sale.id },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true } },
            seller: { select: { id: true, name: true, phone: true } },
            lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
          },
        });
        return created!;
      }

      // Price OK: Confirm immediately in atomic transaction
      const result = await database.$transaction(async (tx) => {
        const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId } });
        if (!sellerLoc) {
          throw new HttpError(404, "Stock location for seller not found");
        }

        // Check per-product stock
        for (const item of lineItems) {
          const pb = await tx.productBalance.findUnique({
            where: { productId_stockLocationId: { productId: item.productId, stockLocationId: sellerLoc.id } },
          });
          if (!pb || pb.balance < item.quantity) {
            const product = productLookup.get(item.productId)!;
            throw new HttpError(409, `Insufficient stock of ${product.name}. Available: ${pb?.balance ?? 0}, Requested: ${item.quantity}`);
          }
        }

        // Calculate incentive
        const sellerUser = await tx.user.findUnique({
          where: { id: sellerId },
          select: { incentiveRatePaise: true },
        });
        const incentiveRatePaise = sellerUser?.incentiveRatePaise ?? settings.incentiveRatePaise;
        const incentiveAmountPaise = incentiveRatePaise !== null && incentiveRatePaise !== undefined ? totalQuantity * incentiveRatePaise : null;

        // Deduct per-product stock + location total
        for (const item of lineItems) {
          await tx.productBalance.update({
            where: { productId_stockLocationId: { productId: item.productId, stockLocationId: sellerLoc.id } },
            data: { balance: { decrement: item.quantity } },
          });
        }
        await tx.stockLocation.update({
          where: { id: sellerLoc.id },
          data: { balance: { decrement: totalQuantity } },
        });

        // Create Sale
        const saleData: Record<string, unknown> = {
          sellerId,
          customerId: normalized.customerId,
          quantity: totalQuantity,
          unitPricePaise: lineItems.length === 1 ? lineItems[0]!.unitPricePaise : (totalQuantity > 0 ? Math.round(grandTotalPaise / totalQuantity) : 0),
          totalPaise: grandTotalPaise,
          paymentMode: normalized.paymentMode,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          incentiveRatePaise: incentiveRatePaise ?? null,
          incentiveAmountPaise: incentiveAmountPaise ?? null,
        };
        if (normalized.requestKey !== undefined) saleData["requestKey"] = normalized.requestKey;

        const sale = await tx.sale.create({
          data: saleData as Prisma.SaleCreateInput,
          include: {
            customer: { select: { id: true, shopName: true, contactName: true, phone: true, email: true, state: true, district: true, village: true } },
            seller: { select: { id: true, name: true, phone: true, email: true } },
          },
        });

        // Create SaleLineItems
        await tx.saleLineItem.createMany({
          data: lineItems.map((li) => ({
            saleId: sale.id,
            productId: li.productId,
            quantity: li.quantity,
            unitPricePaise: li.unitPricePaise,
            totalPaise: li.totalPaise,
          })),
        });

        // Record per-product StockMovements
        if (lineItems.length > 0) {
          await tx.stockMovement.createMany({
            data: lineItems.map((item) => ({
              type: "SALE" as const,
              quantity: item.quantity,
              sourceId: sellerLoc.id,
              actorId: sellerId,
              saleId: sale.id,
              productId: item.productId,
            })),
          });
        }

        // Generate Invoice with multi-line snapshot
        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const snapshotLineItems = lineItems.map((li) => {
          const p = productLookup.get(li.productId)!;
          return { productName: p.name, productSku: p.sku, quantity: li.quantity, unitPricePaise: li.unitPricePaise, totalPaise: li.totalPaise };
        });

        const invoiceSnapshot = {
          invoiceNumber,
          saleId: sale.id,
          date: sale.createdAt.toISOString(),
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
            shopName: customer.shopName,
            contactName: customer.contactName,
            phone: customer.phone,
            state: customer.state,
            district: customer.district,
            village: customer.village,
          },
          seller: { name: seller.name, phone: seller.phone },
          quantity: totalQuantity,
          unitPricePaise: lineItems.length === 1 ? lineItems[0]!.unitPricePaise : 0,
          totalPaise: grandTotalPaise,
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

        // Record PaymentRecord if Cash/Bank
        if (normalized.paymentMode === "CASH" || normalized.paymentMode === "BANK") {
          await tx.paymentRecord.create({
            data: {
              saleId: sale.id,
              collectorId: sellerId,
              mode: normalized.paymentMode,
              amountPaise: grandTotalPaise,
            },
          });
        }

        return { sale, invoice };
      }, { timeout: 30000, maxWait: 10000 });

      // Process PDF in the background to avoid blocking the HTTP response and causing timeouts
      processInvoicePdf(database, result.invoice.id).catch((err) => {
        console.warn("Background PDF generation warning:", err);
      });
      return { ...result.sale, invoice: result.invoice };
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

      const [total, items] = await Promise.all([
        database.sale.count({ where }),
        database.sale.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          include: {
            customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
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

    get: async (sellerId: string, id: string) => {
      const sale = await database.sale.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, shopName: true, contactName: true, phone: true, state: true, district: true, village: true } },
          invoice: true,
          payments: true,
          lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
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
        include: { invoice: true, payments: true, customer: true, lineItems: { include: { product: true } } },
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

      const wasUnconfirmed = sale.status === "REJECTED" || sale.status === "PENDING_APPROVAL";

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
            // Still below minimum: set/keep PENDING_APPROVAL
            const updatedSale = await tx.sale.update({
              where: { id: saleId },
              data: {
                customerId: targetCustomer.id,
                quantity: newQty,
                unitPricePaise: newUnitPricePaise,
                totalPaise: newTotalPaise,
                paymentMode: newPaymentMode,
                status: "PENDING_APPROVAL",
                rejectionReason: null,
                decidedAt: null,
                decidedById: null,
              },
              include: {
                customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
                seller: { select: { id: true, name: true, phone: true } },
                invoice: { select: { id: true, number: true } },
                lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
              },
            });

            // Update line items if unitPricePaise changed
            if (input.unitPricePaise !== undefined && sale.lineItems.length > 0) {
              for (const li of sale.lineItems) {
                await tx.saleLineItem.update({
                  where: { id: li.id },
                  data: {
                    unitPricePaise: newUnitPricePaise,
                    totalPaise: li.quantity * newUnitPricePaise,
                  },
                });
              }
            }

            // Notify admins about re-submission
            const seller = await tx.user.findUnique({ where: { id: sellerId } });
            const admins = await tx.user.findMany({ where: { role: "SUPER_ADMIN", active: true } });
            if (admins.length > 0) {
              await tx.notification.createMany({
                data: admins.map((admin) => ({
                  recipientId: admin.id,
                  saleId: sale.id,
                  kind: "LOW_PRICE_APPROVAL_REQUEST" as const,
                  message: `Re-submitted low-price sale from ${seller?.name ?? "Seller"}: ${newQty} × ₹${(newUnitPricePaise / 100).toFixed(2)}`,
                })),
              });
            }

            return updatedSale;
          }

          // Price is now above minimum: auto-confirm
          const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId } });
          if (!sellerLoc) {
            throw new HttpError(404, "Stock location for seller not found");
          }

          // Check & deduct per-product stock
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
                data: { type: "SALE", quantity: itemQty, sourceId: sellerLoc.id, actorId: sellerId, saleId: sale.id, productId: li.productId },
              });
            }
            await tx.stockLocation.update({
              where: { id: sellerLoc.id },
              data: { balance: { decrement: newQty } },
            });
          } else {
            if (sellerLoc.balance < newQty) {
              throw new HttpError(409, `Insufficient stock. Available: ${sellerLoc.balance}, Requested: ${newQty}`);
            }
            await tx.stockLocation.update({
              where: { id: sellerLoc.id },
              data: { balance: { decrement: newQty } },
            });
            await tx.stockMovement.create({
              data: { type: "SALE", quantity: newQty, sourceId: sellerLoc.id, actorId: sellerId, saleId: sale.id },
            });
          }

          // Calculate incentive
          let settings = await tx.businessSettings.findUnique({ where: { id: 1 } });
          if (!settings) {
            settings = await tx.businessSettings.create({
              data: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: null, companyName: "MASAKO ENTERPRISES PRIVATE LIMITED" },
            });
          }
          const sellerUser = await tx.user.findUnique({ where: { id: sellerId }, select: { incentiveRatePaise: true, name: true, phone: true, email: true } });
          const incentiveRatePaise = sellerUser?.incentiveRatePaise ?? settings.incentiveRatePaise;
          const incentiveAmountPaise = incentiveRatePaise != null ? newQty * incentiveRatePaise : null;

          // Update line items if unitPricePaise changed
          if (input.unitPricePaise !== undefined && sale.lineItems.length > 0) {
            for (const li of sale.lineItems) {
              await tx.saleLineItem.update({
                where: { id: li.id },
                data: {
                  unitPricePaise: newUnitPricePaise,
                  totalPaise: li.quantity * newUnitPricePaise,
                },
              });
            }
          }

          // Generate invoice
          const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const snapshotLineItems = sale.lineItems.length > 0
            ? sale.lineItems.map((li) => ({
                productName: li.product.name,
                productSku: li.product.sku,
                quantity: input.quantity ?? li.quantity,
                unitPricePaise: input.unitPricePaise ?? li.unitPricePaise,
                totalPaise: (input.quantity ?? li.quantity) * (input.unitPricePaise ?? li.unitPricePaise),
              }))
            : undefined;

          const invoiceSnapshot = {
            invoiceNumber,
            saleId: sale.id,
            date: new Date().toISOString(),
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
            seller: { name: sellerUser?.name ?? "", phone: sellerUser?.phone ?? "" },
            quantity: newQty, unitPricePaise: newUnitPricePaise, totalPaise: newTotalPaise,
            lineItems: snapshotLineItems, paymentMode: newPaymentMode,
          };

          const invoice = await tx.invoice.create({
            data: { saleId: sale.id, number: invoiceNumber, snapshot: invoiceSnapshot as Prisma.InputJsonValue },
          });

          if (newPaymentMode === "CASH" || newPaymentMode === "BANK") {
            await tx.paymentRecord.create({
              data: { saleId: sale.id, collectorId: sellerId, mode: newPaymentMode, amountPaise: newTotalPaise },
            });
          }

          const updatedSale = await tx.sale.update({
            where: { id: saleId },
            data: {
              customerId: targetCustomer.id,
              quantity: newQty,
              unitPricePaise: newUnitPricePaise,
              totalPaise: newTotalPaise,
              paymentMode: newPaymentMode,
              status: "CONFIRMED",
              confirmedAt: new Date(),
              rejectionReason: null,
              decidedAt: null,
              decidedById: null,
              incentiveRatePaise: incentiveRatePaise ?? null,
              incentiveAmountPaise: incentiveAmountPaise ?? null,
            },
            include: {
              customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
              seller: { select: { id: true, name: true, phone: true } },
              invoice: { select: { id: true, number: true } },
              lineItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
            },
          });

          processInvoicePdf(database, invoice.id).catch((err) => {
            console.warn("Background PDF generation warning:", err);
          });

          return updatedSale;
        }

        // CONFIRMED sale: existing update logic (no state change)
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
            data: { snapshot: updatedSnapshot as Prisma.InputJsonValue },
          });
        }

        return updatedSale;
      }, { timeout: 30000, maxWait: 10000 });
    },
  };
}

export type SellerSalesService = ReturnType<typeof createSellerSalesService>;

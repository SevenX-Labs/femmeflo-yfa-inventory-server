import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { CreateWarehouseInput, ListTransactionsInput, UpdateLocationBalanceInput } from "../../controller/inventory.validation.js";
import { HttpError } from "../../middleware/validation.js";

type CreateReceiptInput = { quantity: number } | { items: Array<{ productId: string; quantity: number }> };
type CreateTransferInput = { sourceId: string; destinationId: string; quantity: number } | { sourceId: string; destinationId: string; items: Array<{ productId: string; quantity: number }> };

export function createAdminInventoryService(database: PrismaClient) {
  async function resolveDefaultProductItems(quantity: number) {
    const settings = await database.businessSettings.findUnique({ where: { id: 1 } });
    if (!settings?.defaultProductId) {
      throw new HttpError(400, "No default product configured. Please run the multi-product migration first.");
    }
    return [{ productId: settings.defaultProductId, quantity }];
  }

  // Helper to ensure HQ exists
  async function getOrCreateHQ(tx: Prisma.TransactionClient | PrismaClient = database) {
    let hq = await tx.stockLocation.findFirst({ where: { type: "HQ" } });
    if (!hq) {
      hq = await tx.stockLocation.create({
        data: { type: "HQ", name: "Headquarters (HQ)", balance: 0 },
      });
    }
    return hq;
  }

  return {
    getSummary: async () => {
      const hq = await getOrCreateHQ();
      const locations = await database.stockLocation.findMany({
        include: {
          seller: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });

      const totalHqBalance = hq.balance;
      let totalWarehouseBalance = 0;
      let totalSellerBalance = 0;

      for (const loc of locations) {
        if (loc.type === "WAREHOUSE") totalWarehouseBalance += loc.balance;
        if (loc.type === "SELLER") totalSellerBalance += loc.balance;
      }

      // Movement aggregates for cumulative metrics
      const movementSummary = await database.stockMovement.groupBy({
        by: ["type"],
        _sum: { quantity: true },
      });

      let totalReceived = 0;
      let totalTransferred = 0;
      let totalSold = 0;

      for (const item of movementSummary) {
        if (item.type === "RECEIPT") totalReceived = item._sum.quantity ?? 0;
        if (item.type === "TRANSFER") totalTransferred = item._sum.quantity ?? 0;
        if (item.type === "SALE") totalSold = item._sum.quantity ?? 0;
      }

      // Group inbound movements by destinationId and type
      const inboundByLocation = await database.stockMovement.groupBy({
        by: ["destinationId", "type"],
        _sum: { quantity: true },
      });

      // Group outbound movements by sourceId and type
      const outboundByLocation = await database.stockMovement.groupBy({
        by: ["sourceId", "type"],
        _sum: { quantity: true },
      });

      // Recent movement timestamps per location
      const recentMovements = await database.stockMovement.findMany({
        take: 200,
        orderBy: { createdAt: "desc" },
        select: { sourceId: true, destinationId: true, createdAt: true },
      });

      const locationsWithMetrics = locations.map((loc) => {
        const locId = loc.id;
        const received = inboundByLocation.find((g) => g.destinationId === locId && g.type === "RECEIPT")?._sum.quantity ?? 0;
        const transferredIn = inboundByLocation.find((g) => g.destinationId === locId && g.type === "TRANSFER")?._sum.quantity ?? 0;
        const transferredOut = outboundByLocation.find((g) => g.sourceId === locId && g.type === "TRANSFER")?._sum.quantity ?? 0;
        const sold = outboundByLocation.find((g) => g.sourceId === locId && g.type === "SALE")?._sum.quantity ?? 0;
        const lastMove = recentMovements.find((m) => m.sourceId === locId || m.destinationId === locId);

        return {
          ...loc,
          received: loc.type === "HQ" ? received : transferredIn,
          transferredIn,
          transferredOut,
          sold,
          lastMovementAt: lastMove ? lastMove.createdAt.toISOString() : null,
        };
      });

      // Per-product balance summary
      const productBalances = await database.productBalance.findMany({
        include: { product: { select: { id: true, name: true, sku: true } }, stockLocation: { select: { id: true, type: true } } },
      });

      const productMap = new Map<string, { id: string; name: string; sku: string | null; totalBalance: number; hqBalance: number; warehouseBalance: number; sellerBalance: number }>();
      for (const pb of productBalances) {
        let entry = productMap.get(pb.productId);
        if (!entry) {
          entry = { id: pb.product.id, name: pb.product.name, sku: pb.product.sku, totalBalance: 0, hqBalance: 0, warehouseBalance: 0, sellerBalance: 0 };
          productMap.set(pb.productId, entry);
        }
        entry.totalBalance += pb.balance;
        if (pb.stockLocation.type === "HQ") entry.hqBalance += pb.balance;
        else if (pb.stockLocation.type === "WAREHOUSE") entry.warehouseBalance += pb.balance;
        else if (pb.stockLocation.type === "SELLER") entry.sellerBalance += pb.balance;
      }

      // Per-location product balances
      const locationProductMap = new Map<string, Array<{ productId: string; productName: string; balance: number }>>();
      for (const pb of productBalances) {
        let arr = locationProductMap.get(pb.stockLocationId);
        if (!arr) { arr = []; locationProductMap.set(pb.stockLocationId, arr); }
        arr.push({ productId: pb.productId, productName: pb.product.name, balance: pb.balance });
      }

      const locationsWithProducts = locationsWithMetrics.map((loc) => ({
        ...loc,
        productBalances: locationProductMap.get(loc.id) ?? [],
      }));

      return {
        totalStock: totalHqBalance + totalWarehouseBalance + totalSellerBalance,
        hqStock: totalHqBalance,
        warehouseStock: totalWarehouseBalance,
        sellerStock: totalSellerBalance,
        totalReceived,
        totalTransferred,
        totalSold,
        products: Array.from(productMap.values()),
        locations: locationsWithProducts,
      };
    },

    createWarehouse: async (input: CreateWarehouseInput) => {
      const existing = await database.stockLocation.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" }, type: "WAREHOUSE" },
      });
      if (existing) {
        throw new HttpError(409, "Warehouse with this name already exists");
      }
      return database.stockLocation.create({
        data: {
          type: "WAREHOUSE",
          name: input.name,
          balance: 0,
        },
      });
    },

    listWarehouses: async () => {
      return database.stockLocation.findMany({
        where: { type: "WAREHOUSE" },
        orderBy: { name: "asc" },
      });
    },

    deleteWarehouse: async (id: string) => {
      const location = await database.stockLocation.findUnique({
        where: { id },
      });
      if (!location) {
        throw new HttpError(404, "Warehouse not found");
      }
      if (location.type === "HQ") {
        throw new HttpError(400, "Central HQ warehouse cannot be deleted");
      }
      if (location.type === "SELLER") {
        throw new HttpError(400, "Field officer locations cannot be deleted from warehouse management");
      }
      if (location.balance > 0) {
        throw new HttpError(
          400,
          `Cannot delete warehouse with active stock balance (${location.balance} packets). Reset stock to 0 or transfer it first.`
        );
      }

      return database.$transaction(async (tx) => {
        await tx.productBalance.deleteMany({
          where: { stockLocationId: id },
        });

        await tx.stockMovement.deleteMany({
          where: {
            OR: [{ sourceId: id }, { destinationId: id }],
          },
        });

        return tx.stockLocation.delete({
          where: { id },
        });
      });
    },

    addReceipt: async (actorId: string, input: CreateReceiptInput) => {
      const items = "items" in input
        ? input.items
        : await resolveDefaultProductItems(input.quantity);

      return database.$transaction(async (tx) => {
        const hq = await getOrCreateHQ(tx);
        const movements = [];
        let totalQty = 0;

        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product || !product.active) {
            throw new HttpError(400, `Product not found or inactive: ${item.productId}`);
          }

          await tx.productBalance.upsert({
            where: { productId_stockLocationId: { productId: item.productId, stockLocationId: hq.id } },
            update: { balance: { increment: item.quantity } },
            create: { productId: item.productId, stockLocationId: hq.id, balance: item.quantity },
          });

          const movement = await tx.stockMovement.create({
            data: {
              type: "RECEIPT",
              quantity: item.quantity,
              destinationId: hq.id,
              actorId,
              productId: item.productId,
            },
          });
          movements.push(movement);
          totalQty += item.quantity;
        }

        const updatedHQ = await tx.stockLocation.update({
          where: { id: hq.id },
          data: { balance: { increment: totalQty } },
        });

        return { hq: updatedHQ, movements };
      });
    },

    transfer: async (actorId: string, input: CreateTransferInput) => {
      if (input.sourceId === input.destinationId) {
        throw new HttpError(400, "Source and destination cannot be the same location");
      }

      const items = "items" in input
        ? input.items
        : await resolveDefaultProductItems(input.quantity);

      return database.$transaction(async (tx) => {
        const source = await tx.stockLocation.findUnique({ where: { id: input.sourceId } });
        const destination = await tx.stockLocation.findUnique({ where: { id: input.destinationId } });

        if (!source || !destination) {
          throw new HttpError(404, "Source or destination stock location not found");
        }

        const movements = [];
        let totalQty = 0;

        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product || !product.active) {
            throw new HttpError(400, `Product not found or inactive: ${item.productId}`);
          }

          const srcBalance = await tx.productBalance.findUnique({
            where: { productId_stockLocationId: { productId: item.productId, stockLocationId: source.id } },
          });

          if (!srcBalance || srcBalance.balance < item.quantity) {
            throw new HttpError(409, `Insufficient stock of ${product.name} at ${source.name}. Available: ${srcBalance?.balance ?? 0}, Requested: ${item.quantity}`);
          }

          await tx.productBalance.update({
            where: { productId_stockLocationId: { productId: item.productId, stockLocationId: source.id } },
            data: { balance: { decrement: item.quantity } },
          });

          await tx.productBalance.upsert({
            where: { productId_stockLocationId: { productId: item.productId, stockLocationId: destination.id } },
            update: { balance: { increment: item.quantity } },
            create: { productId: item.productId, stockLocationId: destination.id, balance: item.quantity },
          });

          const movement = await tx.stockMovement.create({
            data: {
              type: "TRANSFER",
              quantity: item.quantity,
              sourceId: source.id,
              destinationId: destination.id,
              actorId,
              productId: item.productId,
            },
          });
          movements.push(movement);
          totalQty += item.quantity;
        }

        const updatedSource = await tx.stockLocation.update({
          where: { id: source.id },
          data: { balance: { decrement: totalQty } },
        });

        const updatedDestination = await tx.stockLocation.update({
          where: { id: destination.id },
          data: { balance: { increment: totalQty } },
        });

        return { source: updatedSource, destination: updatedDestination, movements };
      }, { timeout: 30000, maxWait: 10000 });
    },

    updateLocationBalance: async (actorId: string, locationId: string, input: UpdateLocationBalanceInput) => {
      return database.$transaction(async (tx) => {
        const location = await tx.stockLocation.findUnique({ where: { id: locationId } });
        if (!location) {
          throw new HttpError(404, "Stock location not found");
        }

        const oldBalance = location.balance;
        const newBalance = input.balance;
        const diff = newBalance - oldBalance;

        if (diff === 0) {
          return { location, movement: null, diff: 0 };
        }

        const updatedLocation = await tx.stockLocation.update({
          where: { id: location.id },
          data: { balance: newBalance },
        });

        const productBalances = await tx.productBalance.findMany({
          where: { stockLocationId: location.id },
          orderBy: { updatedAt: "desc" },
        });

        let movement = null;

        if (newBalance === 0) {
          // Zero out all product balances at this location
          await tx.productBalance.updateMany({
            where: { stockLocationId: location.id },
            data: { balance: 0 },
          });

          // If HQ, adjust/remove recent receipts matching oldBalance so Total Received matches 0
          if (location.type === "HQ") {
            const recentReceipts = await tx.stockMovement.findMany({
              where: { destinationId: location.id, type: "RECEIPT" },
              orderBy: { createdAt: "desc" },
            });
            let toDeduct = Math.abs(diff);
            for (const receipt of recentReceipts) {
              if (toDeduct <= 0) break;
              if (receipt.quantity <= toDeduct) {
                toDeduct -= receipt.quantity;
                await tx.stockMovement.delete({ where: { id: receipt.id } });
              } else {
                await tx.stockMovement.update({
                  where: { id: receipt.id },
                  data: { quantity: receipt.quantity - toDeduct },
                });
                toDeduct = 0;
              }
            }
          }
        } else if (diff < 0) {
          // Deduct difference from product balances
          let remDeduct = Math.abs(diff);
          for (const pb of productBalances) {
            if (remDeduct <= 0) break;
            const deduct = Math.min(pb.balance, remDeduct);
            if (deduct > 0) {
              await tx.productBalance.update({
                where: { id: pb.id },
                data: { balance: pb.balance - deduct },
              });
              remDeduct -= deduct;
            }
          }

          // If HQ, reduce recent receipts by the deducted amount so Total Received matches Available Stock + Sold
          if (location.type === "HQ") {
            const recentReceipts = await tx.stockMovement.findMany({
              where: { destinationId: location.id, type: "RECEIPT" },
              orderBy: { createdAt: "desc" },
            });
            let toDeduct = Math.abs(diff);
            for (const receipt of recentReceipts) {
              if (toDeduct <= 0) break;
              if (receipt.quantity <= toDeduct) {
                toDeduct -= receipt.quantity;
                await tx.stockMovement.delete({ where: { id: receipt.id } });
              } else {
                await tx.stockMovement.update({
                  where: { id: receipt.id },
                  data: { quantity: receipt.quantity - toDeduct },
                });
                toDeduct = 0;
              }
            }
          }
        } else {
          // diff > 0: Increment product balance
          const targetPb = productBalances.find((p) => p.balance > 0) || productBalances[0];
          let targetProductId: string | undefined = targetPb?.productId;

          if (targetPb) {
            await tx.productBalance.update({
              where: { id: targetPb.id },
              data: { balance: { increment: diff } },
            });
          } else {
            const settings = await tx.businessSettings.findUnique({ where: { id: 1 } });
            targetProductId = settings?.defaultProductId ?? undefined;
            if (targetProductId) {
              await tx.productBalance.upsert({
                where: { productId_stockLocationId: { productId: targetProductId, stockLocationId: location.id } },
                update: { balance: { increment: diff } },
                create: { productId: targetProductId, stockLocationId: location.id, balance: diff },
              });
            }
          }

          // Positive adjustment: recorded as RECEIPT into this location
          movement = await tx.stockMovement.create({
            data: {
              type: "RECEIPT",
              quantity: diff,
              destinationId: location.id,
              actorId,
              productId: targetProductId ?? null,
            },
          });
        }

        return { location: updatedLocation, movement, diff, oldBalance, newBalance };
      });
    },

    listTransactions: async (query: ListTransactionsInput) => {
      const where: Prisma.StockMovementWhereInput = {};
      if (query.type) where.type = query.type;
      if (query.locationId) {
        where.OR = [{ sourceId: query.locationId }, { destinationId: query.locationId }];
      }

      const total = await database.stockMovement.count({ where });
      const totalPages = Math.ceil(total / query.pageSize);
      const items = await database.stockMovement.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          source: { select: { id: true, name: true, type: true } },
          destination: { select: { id: true, name: true, type: true } },
          actor: { select: { id: true, name: true, role: true } },
          product: { select: { id: true, name: true, sku: true } },
          sale: {
            select: {
              id: true,
              paymentMode: true,
              totalPaise: true,
              customer: {
                select: {
                  shopName: true,
                  contactName: true,
                },
              },
            },
          },
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
  };
}

export type AdminInventoryService = ReturnType<typeof createAdminInventoryService>;

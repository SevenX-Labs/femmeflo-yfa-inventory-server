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

        if (newBalance === 0) {
          await tx.productBalance.updateMany({
            where: { stockLocationId: location.id },
            data: { balance: 0 },
          });
        }

        let movement = null;
        if (diff > 0) {
          // Positive adjustment: recorded as RECEIPT into this location
          movement = await tx.stockMovement.create({
            data: {
              type: "RECEIPT",
              quantity: diff,
              destinationId: location.id,
              actorId,
            },
          });
        }
        // Note: For negative adjustments (diff < 0), StockMovement TRANSFER constraint
        // strictly requires both sourceId and destinationId (sourceId <> destinationId).
        // Since direct adjustment does not have a destination location, we directly update
        // the location balance and product balances without creating an invalid transfer.

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

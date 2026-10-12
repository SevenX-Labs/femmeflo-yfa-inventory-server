import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { CreateWarehouseInput, CreateReceiptInput, CreateTransferInput, ListTransactionsInput } from "../../controller/inventory.validation.js";
import { HttpError } from "../../middleware/validation.js";

export function createAdminInventoryService(database: PrismaClient) {
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

      return {
        totalStock: totalHqBalance + totalWarehouseBalance + totalSellerBalance,
        hqStock: totalHqBalance,
        warehouseStock: totalWarehouseBalance,
        sellerStock: totalSellerBalance,
        locations,
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
      return database.$transaction(async (tx) => {
        const hq = await getOrCreateHQ(tx);
        const updatedHQ = await tx.stockLocation.update({
          where: { id: hq.id },
          data: { balance: { increment: input.quantity } },
        });

        const movement = await tx.stockMovement.create({
          data: {
            type: "RECEIPT",
            quantity: input.quantity,
            destinationId: hq.id,
            actorId,
          },
        });

        return { hq: updatedHQ, movement };
      });
    },

    transfer: async (actorId: string, input: CreateTransferInput) => {
      if (input.sourceId === input.destinationId) {
        throw new HttpError(400, "Source and destination cannot be the same location");
      }

      return database.$transaction(async (tx) => {
        const source = await tx.stockLocation.findUnique({ where: { id: input.sourceId } });
        const destination = await tx.stockLocation.findUnique({ where: { id: input.destinationId } });

        if (!source || !destination) {
          throw new HttpError(404, "Source or destination stock location not found");
        }

        if (source.balance < input.quantity) {
          throw new HttpError(409, `Insufficient stock at ${source.name}. Available: ${source.balance}, Requested: ${input.quantity}`);
        }

        // Deduct source, add destination
        const updatedSource = await tx.stockLocation.update({
          where: { id: source.id },
          data: { balance: { decrement: input.quantity } },
        });

        const updatedDestination = await tx.stockLocation.update({
          where: { id: destination.id },
          data: { balance: { increment: input.quantity } },
        });

        const movement = await tx.stockMovement.create({
          data: {
            type: "TRANSFER",
            quantity: input.quantity,
            sourceId: source.id,
            destinationId: destination.id,
            actorId,
          },
        });

        return { source: updatedSource, destination: updatedDestination, movement };
      }, { timeout: 30000, maxWait: 10000 });
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

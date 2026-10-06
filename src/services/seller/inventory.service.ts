import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { ListTransactionsInput } from "../../controller/inventory.validation.js";
import { HttpError } from "../../middleware/validation.js";

export function createSellerInventoryService(database: PrismaClient) {
  return {
    getInventory: async (sellerId: string) => {
      let location = await database.stockLocation.findUnique({
        where: { sellerId },
      });

      if (!location) {
        const seller = await database.user.findUnique({ where: { id: sellerId } });
        if (!seller) throw new HttpError(404, "Seller not found");
        location = await database.stockLocation.create({
          data: {
            type: "SELLER",
            name: `${seller.name} Stock`,
            sellerId,
            balance: 0,
          },
        });
      }

      // Calculate cumulative assigned transfers and confirmed sales
      const totalAssignedResult = await database.stockMovement.aggregate({
        _sum: { quantity: true },
        where: { destinationId: location.id, type: "TRANSFER" },
      });

      const totalSoldResult = await database.sale.aggregate({
        _sum: { quantity: true },
        where: { sellerId, status: "CONFIRMED" },
      });

      const totalAssigned = totalAssignedResult._sum.quantity ?? 0;
      const totalSold = totalSoldResult._sum.quantity ?? 0;

      return {
        locationId: location.id,
        name: location.name,
        assigned: totalAssigned,
        sold: totalSold,
        remaining: location.balance,
      };
    },

    listTransactions: async (sellerId: string, query: ListTransactionsInput) => {
      const location = await database.stockLocation.findUnique({ where: { sellerId } });
      if (!location) {
        throw new HttpError(404, "Stock location for seller not found");
      }

      const where: Prisma.StockMovementWhereInput = {
        OR: [{ sourceId: location.id }, { destinationId: location.id }],
      };
      if (query.type) where.type = query.type;

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

export type SellerInventoryService = ReturnType<typeof createSellerInventoryService>;

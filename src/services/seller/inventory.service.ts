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

      const [totalAssignedResult, totalSoldResult, productBalances, perProductAssigned, perProductSold] = await Promise.all([
        database.stockMovement.aggregate({
          _sum: { quantity: true },
          where: { destinationId: location.id, type: "TRANSFER" },
        }),
        database.sale.aggregate({
          _sum: { quantity: true },
          where: { sellerId, status: "CONFIRMED" },
        }),
        database.productBalance.findMany({
          where: { stockLocationId: location.id },
          include: { product: { select: { id: true, name: true, sku: true } } },
        }),
        database.stockMovement.groupBy({
          by: ["productId"],
          _sum: { quantity: true },
          where: { destinationId: location.id, type: "TRANSFER", productId: { not: null } },
        }),
        database.stockMovement.groupBy({
          by: ["productId"],
          _sum: { quantity: true },
          where: { sourceId: location.id, type: "SALE", productId: { not: null } },
        }),
      ]);

      const totalAssigned = totalAssignedResult._sum.quantity ?? 0;
      const totalSold = totalSoldResult._sum.quantity ?? 0;

      const assignedMap = new Map(perProductAssigned.map((r) => [r.productId!, r._sum.quantity ?? 0]));
      const soldMap = new Map(perProductSold.map((r) => [r.productId!, r._sum.quantity ?? 0]));

      const products = productBalances.map((pb) => ({
        productId: pb.product.id,
        productName: pb.product.name,
        productSku: pb.product.sku,
        balance: pb.balance,
        assigned: assignedMap.get(pb.productId) ?? 0,
        sold: soldMap.get(pb.productId) ?? 0,
      }));

      return {
        locationId: location.id,
        name: location.name,
        locationName: location.name,
        assigned: totalAssigned,
        assignedPackets: totalAssigned,
        sold: totalSold,
        soldPackets: totalSold,
        remaining: location.balance,
        balance: location.balance,
        products,
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

      const [total, items] = await Promise.all([
        database.stockMovement.count({ where }),
        database.stockMovement.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            source: { select: { id: true, name: true, type: true } },
            destination: { select: { id: true, name: true, type: true } },
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
  };
}

export type SellerInventoryService = ReturnType<typeof createSellerInventoryService>;

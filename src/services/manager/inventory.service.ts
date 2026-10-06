import type { PrismaClient } from "../../generated/prisma/client.js";
import type { PublicUser } from "../auth/auth.types.js";

export function createManagerInventoryService(database: PrismaClient) {
  return {
    getInventory: async (manager: PublicUser) => {
      const sellers = await database.user.findMany({
        where: {
          managerId: manager.id,
          role: "SELLER",
          ...(manager.state && { state: { equals: manager.state, mode: "insensitive" } }),
          ...(manager.district && { district: { equals: manager.district, mode: "insensitive" } }),
        },
        include: {
          stockLocation: true,
        },
        orderBy: { name: "asc" },
      });

      let totalAssigned = 0;
      let totalSold = 0;
      let totalRemaining = 0;

      const sellerItems = await Promise.all(
        sellers.map(async (seller) => {
          const locId = seller.stockLocation?.id;
          const assignedResult = locId
            ? await database.stockMovement.aggregate({
                _sum: { quantity: true },
                where: { destinationId: locId, type: "TRANSFER" },
              })
            : { _sum: { quantity: null } };

          const soldResult = await database.sale.aggregate({
            _sum: { quantity: true },
            where: { sellerId: seller.id, status: "CONFIRMED" },
          });

          const assigned = assignedResult._sum.quantity ?? 0;
          const sold = soldResult._sum.quantity ?? 0;
          const remaining = seller.stockLocation?.balance ?? 0;

          totalAssigned += assigned;
          totalSold += sold;
          totalRemaining += remaining;

          return {
            seller: {
              id: seller.id,
              name: seller.name,
              phone: seller.phone,
              state: seller.state,
              district: seller.district,
              village: seller.village,
            },
            assigned,
            sold,
            remaining,
          };
        }),
      );

      return {
        summary: {
          totalSellers: sellers.length,
          totalAssigned,
          totalSold,
          totalRemaining,
        },
        sellers: sellerItems,
      };
    },
  };
}

export type ManagerInventoryService = ReturnType<typeof createManagerInventoryService>;

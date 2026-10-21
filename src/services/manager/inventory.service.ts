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

      const locationIds = sellers.map((s) => s.stockLocation?.id).filter((id): id is string => !!id);
      const sellerIds = sellers.map((s) => s.id);

      const [assignedByLoc, soldBySeller] = await Promise.all([
        locationIds.length > 0
          ? database.stockMovement.groupBy({
              by: ["destinationId"],
              _sum: { quantity: true },
              where: { destinationId: { in: locationIds }, type: "TRANSFER" },
            })
          : Promise.resolve([]),
        sellerIds.length > 0
          ? database.sale.groupBy({
              by: ["sellerId"],
              _sum: { quantity: true },
              where: { sellerId: { in: sellerIds }, status: "CONFIRMED" },
            })
          : Promise.resolve([]),
      ]);

      const assignedMap = new Map(assignedByLoc.map((g) => [g.destinationId, g._sum.quantity ?? 0]));
      const soldMap = new Map(soldBySeller.map((g) => [g.sellerId, g._sum.quantity ?? 0]));

      let totalAssigned = 0;
      let totalSold = 0;
      let totalRemaining = 0;

      const sellerItems = sellers.map((seller) => {
          const locId = seller.stockLocation?.id;
          const assigned = locId ? (assignedMap.get(locId) ?? 0) : 0;
          const sold = soldMap.get(seller.id) ?? 0;
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
        });

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

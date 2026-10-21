import type { PrismaClient } from "../../generated/prisma/client.js";

export function createSellerDashboardService(database: PrismaClient) {
  return {
    getDashboard: async (sellerId: string) => {
      let location = await database.stockLocation.findUnique({ where: { sellerId } });
      if (!location) {
        location = await database.stockLocation.create({
          data: { type: "SELLER", name: "Seller Stock", sellerId, balance: 0 },
        });
      }

      const [assignedResult, soldResult, recentSales] = await Promise.all([
        database.stockMovement.aggregate({
          _sum: { quantity: true },
          where: { destinationId: location.id, type: "TRANSFER" },
        }),
        database.sale.aggregate({
          _sum: { quantity: true, incentiveAmountPaise: true },
          where: { sellerId, status: "CONFIRMED" },
        }),
        database.sale.findMany({
          where: { sellerId },
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true } },
            invoice: { select: { id: true, number: true } },
          },
        }),
      ]);

      const assignedPackets = assignedResult._sum.quantity ?? 0;
      const soldPackets = soldResult._sum.quantity ?? 0;
      const totalIncentivePaise = soldResult._sum.incentiveAmountPaise ?? 0;

      return {
        metrics: {
          assignedPackets,
          soldPackets,
          remainingPackets: location.balance,
          totalIncentivePaise,
          totalIncentiveRupees: totalIncentivePaise / 100,
        },
        recentSales,
      };
    },
  };
}

export type SellerDashboardService = ReturnType<typeof createSellerDashboardService>;

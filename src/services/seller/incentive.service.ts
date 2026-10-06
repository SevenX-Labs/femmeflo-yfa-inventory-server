import type { PrismaClient } from "../../generated/prisma/client.js";

export function createSellerIncentiveService(database: PrismaClient) {
  return {
    getIncentives: async (sellerId: string) => {
      const sales = await database.sale.findMany({
        where: { sellerId, status: "CONFIRMED" },
        orderBy: { confirmedAt: "desc" },
        include: {
          customer: { select: { id: true, shopName: true, contactName: true } },
        },
      });

      let totalIncentivePaise = 0;
      let totalPacketsSold = 0;

      const items = sales.map((sale) => {
        totalPacketsSold += sale.quantity;
        const amount = sale.incentiveAmountPaise ?? 0;
        totalIncentivePaise += amount;

        return {
          saleId: sale.id,
          date: sale.confirmedAt ?? sale.createdAt,
          customer: sale.customer,
          quantity: sale.quantity,
          incentiveRatePaise: sale.incentiveRatePaise,
          incentiveAmountPaise: amount,
        };
      });

      return {
        summary: {
          totalPacketsSold,
          totalIncentivePaise,
          totalIncentiveRupees: totalIncentivePaise / 100,
        },
        items,
      };
    },
  };
}

export type SellerIncentiveService = ReturnType<typeof createSellerIncentiveService>;

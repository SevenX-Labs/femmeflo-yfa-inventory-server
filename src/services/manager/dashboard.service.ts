import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type { PublicUser } from "../auth/auth.types.js";

export function createManagerDashboardService(database: PrismaClient) {
  return {
    getDashboard: async (manager: PublicUser) => {
      const sellerScope: Prisma.UserWhereInput = {
        managerId: manager.id,
        role: "SELLER",
        ...(manager.state && { state: { equals: manager.state, mode: "insensitive" } }),
        ...(manager.district && { district: { equals: manager.district, mode: "insensitive" } }),
      };

      const customerScope: Prisma.CustomerWhereInput = {
        seller: sellerScope,
      };
      const salesScope: Prisma.SaleWhereInput = {
        seller: sellerScope,
        status: "CONFIRMED",
      };

      const [totalSellers, totalCustomers, salesAggregate, sellers] = await Promise.all([
        database.user.count({ where: sellerScope }),
        database.customer.count({ where: customerScope }),
        database.sale.aggregate({
          _sum: { quantity: true, totalPaise: true },
          where: salesScope,
        }),
        database.user.findMany({
          where: sellerScope,
          include: { stockLocation: true },
        }),
      ]);

      const totalPacketsSold = salesAggregate._sum.quantity ?? 0;
      const totalEarningsPaise = salesAggregate._sum.totalPaise ?? 0;

      let totalRemainingStock = 0;
      for (const s of sellers) {
        totalRemainingStock += s.stockLocation?.balance ?? 0;
      }

      return {
        metrics: {
          totalSellers,
          totalCustomers,
          totalPacketsSold,
          totalEarningsPaise,
          totalEarningsRupees: totalEarningsPaise / 100,
          totalRemainingStock,
        },
      };
    },
  };
}

export type ManagerDashboardService = ReturnType<typeof createManagerDashboardService>;

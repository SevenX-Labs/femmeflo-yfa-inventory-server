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

      const totalSellers = await database.user.count({ where: sellerScope });

      const customerScope: Prisma.CustomerWhereInput = {
        seller: sellerScope,
      };
      const totalCustomers = await database.customer.count({ where: customerScope });

      const salesScope: Prisma.SaleWhereInput = {
        seller: sellerScope,
        status: "CONFIRMED",
      };

      const salesAggregate = await database.sale.aggregate({
        _sum: { quantity: true, totalPaise: true },
        where: salesScope,
      });

      const totalPacketsSold = salesAggregate._sum.quantity ?? 0;
      const totalEarningsPaise = salesAggregate._sum.totalPaise ?? 0;

      const sellers = await database.user.findMany({
        where: sellerScope,
        include: { stockLocation: true },
      });

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

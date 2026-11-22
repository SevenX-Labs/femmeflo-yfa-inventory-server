import type { PrismaClient } from "../../generated/prisma/client.js";
import { getISTPeriodDateRange } from "../../utils/timezone.utils.js";

export function createSellerDashboardService(database: PrismaClient) {
  return {
    getDashboard: async (sellerId: string) => {
      const todayRange = getISTPeriodDateRange("today");
      const thisMonthRange = getISTPeriodDateRange("this_month");

      const [
        existingLocation,
        allTimeConfirmedSales,
        todaySalesAggregate,
        monthSalesAggregate,
        todayOrdersCount,
        recentSales,
      ] = await Promise.all([
        database.stockLocation.findUnique({ where: { sellerId } }),
        database.sale.aggregate({
          _sum: { quantity: true, totalPaise: true, incentiveAmountPaise: true },
          where: { sellerId, status: "CONFIRMED" },
        }),
        database.sale.aggregate({
          _sum: { quantity: true, totalPaise: true },
          where: {
            sellerId,
            status: "CONFIRMED",
            ...(todayRange ? { createdAt: todayRange } : {}),
          },
        }),
        database.sale.aggregate({
          _sum: { quantity: true, totalPaise: true },
          where: {
            sellerId,
            status: "CONFIRMED",
            ...(thisMonthRange ? { createdAt: thisMonthRange } : {}),
          },
        }),
        database.sale.count({
          where: {
            sellerId,
            status: "CONFIRMED",
            ...(todayRange ? { createdAt: todayRange } : {}),
          },
        }),
        database.sale.findMany({
          where: { sellerId },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true } },
            invoice: { select: { id: true, number: true } },
          },
        }),
      ]);

      const location = existingLocation ?? await database.stockLocation.create({
        data: { type: "SELLER", name: "Seller Stock", sellerId, balance: 0 },
      });

      const assignedResult = await database.stockMovement.aggregate({
        _sum: { quantity: true },
        where: { destinationId: location.id, type: "TRANSFER" },
      });

      const assignedPackets = assignedResult._sum?.quantity ?? 0;
      const soldPackets = allTimeConfirmedSales._sum?.quantity ?? 0;
      const totalIncentivePaise = allTimeConfirmedSales._sum?.incentiveAmountPaise ?? 0;

      const todaySalesPaise = todaySalesAggregate._sum?.totalPaise ?? 0;
      const todayPacketsSold = todaySalesAggregate._sum?.quantity ?? 0;
      const monthSalesPaise = monthSalesAggregate._sum?.totalPaise ?? 0;

      return {
        todaySalesPaise,
        todaySalesAmountPaise: todaySalesPaise,
        todayOrdersCount,
        todayPacketsSold,
        monthSalesPaise,
        stockBalance: location.balance,
        lowStockCount: location.balance < 20 ? 1 : 0,
        metrics: {
          assignedPackets,
          soldPackets,
          remainingPackets: location.balance,
          totalIncentivePaise,
          totalIncentiveRupees: totalIncentivePaise / 100,
          todaySalesPaise,
          todaySalesAmountPaise: todaySalesPaise,
          todayOrdersCount,
          todayPacketsSold,
          monthSalesPaise,
        },
        recentSales,
      };
    },
  };
}

export type SellerDashboardService = ReturnType<typeof createSellerDashboardService>;

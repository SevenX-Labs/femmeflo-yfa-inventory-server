import type { PrismaClient } from "../../generated/prisma/client.js";
import { getISTPeriodDateRange } from "../../utils/timezone.utils.js";
import { DEFAULT_INCENTIVE_RATE_PAISE, getCachedBusinessSettings } from "../settings.cache.js";

export function createSellerDashboardService(database: PrismaClient) {
  return {
    getDashboard: async (sellerId: string) => {
      const todayRange = getISTPeriodDateRange("today");
      const thisMonthRange = getISTPeriodDateRange("this_month");

      const [
        existingLocation,
        settings,
        sellerUser,
        allTimeConfirmedSales,
        nullIncentiveSales,
        todaySalesAggregate,
        monthSalesAggregate,
        todayOrdersCount,
        recentSales,
      ] = await Promise.all([
        database.stockLocation.findUnique({ where: { sellerId } }),
        getCachedBusinessSettings(database),
        database.user.findUnique({ where: { id: sellerId }, select: { incentiveRatePaise: true } }),
        database.sale.aggregate({
          _sum: { quantity: true, totalPaise: true, incentiveAmountPaise: true },
          where: { sellerId, status: { in: ["CONFIRMED", "COMPLETED"] } },
        }),
        database.sale.findMany({
          where: { sellerId, status: { in: ["CONFIRMED", "COMPLETED"] }, incentiveAmountPaise: null },
          select: { quantity: true, incentiveRatePaise: true },
        }),
        database.sale.aggregate({
          _sum: { quantity: true, totalPaise: true },
          where: {
            sellerId,
            status: { in: ["CONFIRMED", "COMPLETED"] },
            ...(todayRange ? { createdAt: todayRange } : {}),
          },
        }),
        database.sale.aggregate({
          _sum: { quantity: true, totalPaise: true },
          where: {
            sellerId,
            status: { in: ["CONFIRMED", "COMPLETED"] },
            ...(thisMonthRange ? { createdAt: thisMonthRange } : {}),
          },
        }),
        database.sale.count({
          where: {
            sellerId,
            status: { in: ["CONFIRMED", "COMPLETED"] },
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

      const defaultRatePaise =
        sellerUser?.incentiveRatePaise ?? settings.incentiveRatePaise ?? DEFAULT_INCENTIVE_RATE_PAISE;
      const fallbackIncentivePaise = nullIncentiveSales.reduce(
        (sum, s) => sum + s.quantity * (s.incentiveRatePaise ?? defaultRatePaise),
        0
      );
      const assignedPackets = assignedResult._sum?.quantity ?? 0;
      const soldPackets = allTimeConfirmedSales._sum?.quantity ?? 0;
      const totalIncentivePaise = (allTimeConfirmedSales._sum?.incentiveAmountPaise ?? 0) + fallbackIncentivePaise;

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

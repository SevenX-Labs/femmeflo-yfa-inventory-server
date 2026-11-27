import type { PrismaClient } from "../../generated/prisma/client.js";
import { calculateUserIncentiveSummary } from "../incentive/incentive.calculator.js";
import { DEFAULT_INCENTIVE_RATE_PAISE, getCachedBusinessSettings } from "../settings.cache.js";

export function createSellerIncentiveService(database: PrismaClient) {
  return {
    getIncentives: async (sellerId: string) => {
      const now = new Date();

      const [settings, sellerUser, sales, adjustments, payouts] = await Promise.all([
        getCachedBusinessSettings(database),
        database.user.findUnique({
          where: { id: sellerId },
          select: { incentiveRatePaise: true },
        }),
        database.sale.findMany({
          where: { sellerId, status: { in: ["CONFIRMED", "COMPLETED"] } },
          orderBy: { confirmedAt: "desc" },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true } },
          },
        }),
        database.incentiveAdjustment.findMany({
          where: { userId: sellerId },
          orderBy: { adjustmentDate: "desc" },
          select: {
            id: true,
            type: true,
            amountPaise: true,
            reason: true,
            adjustmentDate: true,
            createdAt: true,
          },
        }),
        database.incentivePayout.findMany({
          where: { userId: sellerId },
          orderBy: { paymentDate: "desc" },
          select: {
            id: true,
            amountPaise: true,
            paymentDate: true,
            paymentMethod: true,
            referenceId: true,
            remarks: true,
            createdAt: true,
            allocations: {
              select: {
                periodYear: true,
                periodMonth: true,
                amountPaise: true,
              },
            },
          },
        }),
      ]);

      const effectiveRatePaise =
        sellerUser?.incentiveRatePaise ?? settings.incentiveRatePaise ?? DEFAULT_INCENTIVE_RATE_PAISE;
      const summary = calculateUserIncentiveSummary(
        sellerId,
        sales,
        adjustments,
        payouts,
        now,
        effectiveRatePaise
      );

      const items = sales.map((sale) => {
        const resolvedRate = sale.incentiveRatePaise ?? effectiveRatePaise;
        const amount = sale.incentiveAmountPaise ?? sale.quantity * resolvedRate;
        return {
          saleId: sale.id,
          date: sale.confirmedAt ?? sale.createdAt,
          customer: sale.customer,
          quantity: sale.quantity,
          incentiveRatePaise: resolvedRate,
          incentiveAmountPaise: amount,
        };
      });

      return {
        effectiveRatePaise,
        ratePerPacketPaise: effectiveRatePaise,
        ratePerPacketRupees: effectiveRatePaise / 100,
        summary: {
          effectiveRatePaise,
          ratePerPacketPaise: effectiveRatePaise,
          ratePerPacketRupees: effectiveRatePaise / 100,
          totalPacketsSold: summary.totalConfirmedPackets,
          totalIncentivePaise: summary.salesIncentivePaise,
          totalIncentiveRupees: summary.salesIncentivePaise / 100,
          additionsPaise: summary.additionsPaise,
          additionsRupees: summary.additionsPaise / 100,
          deductionsPaise: summary.deductionsPaise,
          deductionsRupees: summary.deductionsPaise / 100,
          adjustedEntitlementPaise: summary.adjustedEntitlementPaise,
          adjustedEntitlementRupees: summary.adjustedEntitlementPaise / 100,
          totalPaidPaise: summary.totalPaidPaise,
          totalPaidRupees: summary.totalPaidPaise / 100,
          outstandingPaise: summary.outstandingPaise,
          outstandingRupees: summary.outstandingPaise / 100,
          status: summary.status,
          currentMonth: summary.currentMonth,
          previousMonth: summary.previousMonth,
          olderPendingPaise: summary.olderPendingPaise,
          olderPendingRupees: summary.olderPendingPaise / 100,
        },
        items,
        months: summary.periods,
        adjustments,
        payouts,
      };
    },
  };
}

export type SellerIncentiveService = ReturnType<typeof createSellerIncentiveService>;

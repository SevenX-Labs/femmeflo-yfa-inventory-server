import type { PrismaClient } from "../../generated/prisma/client.js";
import type { PublicUser } from "../auth/auth.types.js";
import {
  calculateUserIncentiveSummary,
  getCurrentAndPreviousPeriod,
} from "../incentive/incentive.calculator.js";

export function createManagerIncentiveService(database: PrismaClient) {
  return {
    getIncentives: async (manager: PublicUser) => {
      const now = new Date();
      const { currentYear, currentMonth, prevYear, prevMonth } = getCurrentAndPreviousPeriod(now);

      // 1. Fetch Manager's personal records (Personal Earnings)
      const [personalSales, personalAdjustments, personalPayouts] = await Promise.all([
        database.sale.findMany({
          where: { sellerId: manager.id, status: "CONFIRMED" },
          orderBy: { confirmedAt: "desc" },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true } },
          },
        }),
        database.incentiveAdjustment.findMany({
          where: { userId: manager.id },
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
          where: { userId: manager.id },
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

      const personalSummary = calculateUserIncentiveSummary(
        manager.id,
        personalSales,
        personalAdjustments,
        personalPayouts,
        now
      );

      const personal = {
        summary: {
          totalPacketsSold: personalSummary.totalConfirmedPackets,
          totalIncentivePaise: personalSummary.salesIncentivePaise,
          totalIncentiveRupees: personalSummary.salesIncentivePaise / 100,
          additionsPaise: personalSummary.additionsPaise,
          additionsRupees: personalSummary.additionsPaise / 100,
          deductionsPaise: personalSummary.deductionsPaise,
          deductionsRupees: personalSummary.deductionsPaise / 100,
          adjustedEntitlementPaise: personalSummary.adjustedEntitlementPaise,
          adjustedEntitlementRupees: personalSummary.adjustedEntitlementPaise / 100,
          totalPaidPaise: personalSummary.totalPaidPaise,
          totalPaidRupees: personalSummary.totalPaidPaise / 100,
          outstandingPaise: personalSummary.outstandingPaise,
          outstandingRupees: personalSummary.outstandingPaise / 100,
          status: personalSummary.status,
          currentMonth: personalSummary.currentMonth,
          previousMonth: personalSummary.previousMonth,
          olderPendingPaise: personalSummary.olderPendingPaise,
          olderPendingRupees: personalSummary.olderPendingPaise / 100,
        },
        items: personalSales.map((s) => ({
          saleId: s.id,
          date: s.confirmedAt ?? s.createdAt,
          customer: s.customer,
          quantity: s.quantity,
          incentiveRatePaise: s.incentiveRatePaise,
          incentiveAmountPaise: s.incentiveAmountPaise ?? (s.quantity * (s.incentiveRatePaise ?? 0)),
        })),
        months: personalSummary.periods,
        adjustments: personalAdjustments,
        payouts: personalPayouts,
      };

      // 2. Fetch Team Members (Assigned Sellers under this Manager, excluding manager self to prevent double counting)
      const teamSellers = await database.user.findMany({
        where: {
          managerId: manager.id,
          id: { not: manager.id },
          active: true,
        },
        orderBy: { name: "asc" },
      });

      const memberSummaries = await Promise.all(
        teamSellers.map(async (seller) => {
          const [sales, adjustments, payouts] = await Promise.all([
            database.sale.findMany({
              where: { sellerId: seller.id, status: "CONFIRMED" },
              select: {
                id: true,
                quantity: true,
                incentiveRatePaise: true,
                incentiveAmountPaise: true,
                confirmedAt: true,
                createdAt: true,
              },
            }),
            database.incentiveAdjustment.findMany({
              where: { userId: seller.id },
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
              where: { userId: seller.id },
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

          const summary = calculateUserIncentiveSummary(seller.id, sales, adjustments, payouts, now);
          const territory = [seller.village, seller.district, seller.state].filter(Boolean).join(", ") || "Unassigned";

          return {
            sellerId: seller.id,
            sellerName: seller.name,
            phone: seller.phone,
            territory,
            confirmedPackets: summary.totalConfirmedPackets,
            earnedPaise: summary.salesIncentivePaise,
            earnedRupees: summary.salesIncentivePaise / 100,
            additionsPaise: summary.additionsPaise,
            deductionsPaise: summary.deductionsPaise,
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
          };
        })
      );

      // Aggregate Team metrics
      let teamTotalPackets = 0;
      let teamEarnedPaise = 0;
      let teamAdditionsPaise = 0;
      let teamDeductionsPaise = 0;
      let teamAdjustedEntitlementPaise = 0;
      let teamPaidPaise = 0;
      let teamPendingPaise = 0;

      let teamCurrentEarnedPaise = 0;
      let teamCurrentPaidPaise = 0;
      let teamCurrentPendingPaise = 0;

      let teamPrevEarnedPaise = 0;
      let teamPrevPaidPaise = 0;
      let teamPrevPendingPaise = 0;

      let teamOlderPendingPaise = 0;

      for (const m of memberSummaries) {
        teamTotalPackets += m.confirmedPackets;
        teamEarnedPaise += m.earnedPaise;
        teamAdditionsPaise += m.additionsPaise;
        teamDeductionsPaise += m.deductionsPaise;
        teamAdjustedEntitlementPaise += m.adjustedEntitlementPaise;
        teamPaidPaise += m.totalPaidPaise;
        teamPendingPaise += m.outstandingPaise;

        teamCurrentEarnedPaise += m.currentMonth.salesIncentivePaise;
        teamCurrentPaidPaise += m.currentMonth.allocatedPaidPaise;
        teamCurrentPendingPaise += m.currentMonth.outstandingPaise;

        teamPrevEarnedPaise += m.previousMonth.salesIncentivePaise;
        teamPrevPaidPaise += m.previousMonth.allocatedPaidPaise;
        teamPrevPendingPaise += m.previousMonth.outstandingPaise;

        teamOlderPendingPaise += m.olderPendingPaise;
      }

      const team = {
        summary: {
          assignedSellersCount: teamSellers.length,
          totalPacketsSold: teamTotalPackets,
          totalIncentiveEarnedPaise: teamEarnedPaise,
          totalIncentiveEarnedRupees: teamEarnedPaise / 100,
          totalAdditionsPaise: teamAdditionsPaise,
          totalDeductionsPaise: teamDeductionsPaise,
          totalAdjustedEntitlementPaise: teamAdjustedEntitlementPaise,
          totalAdjustedEntitlementRupees: teamAdjustedEntitlementPaise / 100,
          totalPaidPaise: teamPaidPaise,
          totalPaidRupees: teamPaidPaise / 100,
          totalPendingPaise: teamPendingPaise,
          totalPendingRupees: teamPendingPaise / 100,
          currentMonth: {
            year: currentYear,
            month: currentMonth,
            earnedPaise: teamCurrentEarnedPaise,
            earnedRupees: teamCurrentEarnedPaise / 100,
            paidPaise: teamCurrentPaidPaise,
            paidRupees: teamCurrentPaidPaise / 100,
            pendingPaise: teamCurrentPendingPaise,
            pendingRupees: teamCurrentPendingPaise / 100,
          },
          previousMonth: {
            year: prevYear,
            month: prevMonth,
            earnedPaise: teamPrevEarnedPaise,
            earnedRupees: teamPrevEarnedPaise / 100,
            paidPaise: teamPrevPaidPaise,
            paidRupees: teamPrevPaidPaise / 100,
            pendingPaise: teamPrevPendingPaise,
            pendingRupees: teamPrevPendingPaise / 100,
          },
          olderPendingPaise: teamOlderPendingPaise,
          olderPendingRupees: teamOlderPendingPaise / 100,
        },
        members: memberSummaries,
      };

      return {
        personal,
        team,
      };
    },
  };
}

export type ManagerIncentiveService = ReturnType<typeof createManagerIncentiveService>;

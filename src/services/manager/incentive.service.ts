import type { PrismaClient } from "../../generated/prisma/client.js";
import type { PublicUser } from "../auth/auth.types.js";
import {
  calculateUserIncentiveSummary,
  getCurrentAndPreviousPeriod,
} from "../incentive/incentive.calculator.js";
import { syncUserTargetBonusAdjustment } from "../incentive/target-bonus.service.js";
import { DEFAULT_INCENTIVE_RATE_PAISE, getCachedBusinessSettings } from "../settings.cache.js";

export function createManagerIncentiveService(database: PrismaClient) {
  return {
    getIncentives: async (manager: PublicUser) => {
      const now = new Date();
      const { currentYear, currentMonth, prevYear, prevMonth } = getCurrentAndPreviousPeriod(now);

      // 1. Fetch BusinessSettings, Manager's rate & Manager's personal records (Personal Earnings)
      const [settings, managerRecord, personalSales, personalAdjustments, personalPayouts] = await Promise.all([
        getCachedBusinessSettings(database),
        database.user.findUnique({
          where: { id: manager.id },
          select: {
            incentiveRatePaise: true,
            salesTargetPackets: true,
            salesTargetPeriod: true,
            targetBonusPaise: true,
          },
        }),
        database.sale.findMany({
          where: { sellerId: manager.id, status: { in: ["CONFIRMED", "COMPLETED"] } },
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

      const defaultRatePaise = settings.incentiveRatePaise ?? DEFAULT_INCENTIVE_RATE_PAISE;
      const personalRatePaise = managerRecord?.incentiveRatePaise ?? defaultRatePaise;

      const { progress: personalTargetProgress, createdAdjustment: createdPersonalAdjustment } =
        await syncUserTargetBonusAdjustment(database, {
          userId: manager.id,
          salesTargetPackets: managerRecord?.salesTargetPackets ?? null,
          salesTargetPeriod: managerRecord?.salesTargetPeriod ?? "MONTHLY",
          targetBonusPaise: managerRecord?.targetBonusPaise ?? null,
          confirmedSales: personalSales,
          existingAdjustments: personalAdjustments,
          actorUserId: manager.id,
          referenceDate: now,
        });
      const resolvedPersonalAdjustments = createdPersonalAdjustment
        ? [
            {
              id: createdPersonalAdjustment.id,
              type: createdPersonalAdjustment.type,
              amountPaise: createdPersonalAdjustment.amountPaise,
              reason: createdPersonalAdjustment.reason,
              adjustmentDate: createdPersonalAdjustment.adjustmentDate,
              createdAt: createdPersonalAdjustment.createdAt,
            },
            ...personalAdjustments,
          ]
        : personalAdjustments;

      const personalSummary = calculateUserIncentiveSummary(
        manager.id,
        personalSales,
        resolvedPersonalAdjustments,
        personalPayouts,
        now,
        personalRatePaise
      );

      const personal = {
        summary: {
          effectiveRatePaise: personalRatePaise,
          ratePerPacketPaise: personalRatePaise,
          ratePerPacketRupees: personalRatePaise / 100,
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
          salesTargetPackets: personalTargetProgress.targetPackets,
          salesTargetPeriod: personalTargetProgress.period,
          targetBonusPaise: personalTargetProgress.bonusPaise,
          targetProgress: personalTargetProgress,
        },
        salesTargetPackets: personalTargetProgress.targetPackets,
        salesTargetPeriod: personalTargetProgress.period,
        targetBonusPaise: personalTargetProgress.bonusPaise,
        targetProgress: personalTargetProgress,
        items: personalSales.map((s) => {
          const itemRate = s.incentiveRatePaise ?? personalRatePaise;
          return {
            saleId: s.id,
            date: s.confirmedAt ?? s.createdAt,
            customer: s.customer,
            quantity: s.quantity,
            incentiveRatePaise: itemRate,
            incentiveAmountPaise: s.incentiveAmountPaise ?? s.quantity * itemRate,
          };
        }),
        months: personalSummary.periods,
        adjustments: resolvedPersonalAdjustments,
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

      const teamSellerIds = teamSellers.map((s) => s.id);

      const [teamSales, teamAdjustments, teamPayouts] = await Promise.all([
        database.sale.findMany({
          where: { sellerId: { in: teamSellerIds }, status: { in: ["CONFIRMED", "COMPLETED"] } },
          select: {
            id: true,
            sellerId: true,
            quantity: true,
            totalPaise: true,
            incentiveRatePaise: true,
            incentiveAmountPaise: true,
            confirmedAt: true,
            createdAt: true,
          },
        }),
        database.incentiveAdjustment.findMany({
          where: { userId: { in: teamSellerIds } },
          select: {
            id: true,
            userId: true,
            type: true,
            amountPaise: true,
            reason: true,
            adjustmentDate: true,
            createdAt: true,
          },
        }),
        database.incentivePayout.findMany({
          where: { userId: { in: teamSellerIds } },
          select: {
            id: true,
            userId: true,
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

      const teamSalesByUser = new Map<string, typeof teamSales>();
      for (const sale of teamSales) {
        let arr = teamSalesByUser.get(sale.sellerId);
        if (!arr) { arr = []; teamSalesByUser.set(sale.sellerId, arr); }
        arr.push(sale);
      }
      const teamAdjByUser = new Map<string, typeof teamAdjustments>();
      for (const adj of teamAdjustments) {
        let arr = teamAdjByUser.get(adj.userId);
        if (!arr) { arr = []; teamAdjByUser.set(adj.userId, arr); }
        arr.push(adj);
      }
      const teamPayoutsByUser = new Map<string, typeof teamPayouts>();
      for (const payout of teamPayouts) {
        let arr = teamPayoutsByUser.get(payout.userId);
        if (!arr) { arr = []; teamPayoutsByUser.set(payout.userId, arr); }
        arr.push(payout);
      }

      const memberSummaries = await Promise.all(
        teamSellers.map(async (seller) => {
          const sales = teamSalesByUser.get(seller.id) ?? [];
          const baseAdjustments = teamAdjByUser.get(seller.id) ?? [];
          const payouts = teamPayoutsByUser.get(seller.id) ?? [];
          const memberRatePaise = seller.incentiveRatePaise ?? defaultRatePaise;

          const { progress: targetProgress, createdAdjustment } =
            await syncUserTargetBonusAdjustment(database, {
              userId: seller.id,
              salesTargetPackets: seller.salesTargetPackets,
              salesTargetPeriod: seller.salesTargetPeriod,
              targetBonusPaise: seller.targetBonusPaise,
              confirmedSales: sales,
              existingAdjustments: baseAdjustments,
              actorUserId: seller.id,
              referenceDate: now,
            });
          const adjustments = createdAdjustment
            ? [
                ...baseAdjustments,
                {
                  id: createdAdjustment.id,
                  userId: seller.id,
                  type: createdAdjustment.type,
                  amountPaise: createdAdjustment.amountPaise,
                  reason: createdAdjustment.reason,
                  adjustmentDate: createdAdjustment.adjustmentDate,
                  createdAt: createdAdjustment.createdAt,
                },
              ]
            : baseAdjustments;

          const summary = calculateUserIncentiveSummary(
            seller.id,
            sales,
            adjustments,
            payouts,
            now,
            memberRatePaise
          );
          const territory = [seller.village, seller.district, seller.state].filter(Boolean).join(", ") || "Unassigned";

          return {
            sellerId: seller.id,
            sellerName: seller.name,
            phone: seller.phone,
            territory,
            ratePerPacketPaise: memberRatePaise,
            ratePerPacketRupees: memberRatePaise / 100,
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
            salesTargetPackets: targetProgress.targetPackets,
            salesTargetPeriod: targetProgress.period,
            targetBonusPaise: targetProgress.bonusPaise,
            targetProgress,
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
      let targetsAssignedCount = 0;
      let targetsAchievedCount = 0;

      for (const m of memberSummaries) {
        if (m.targetProgress.hasTarget) targetsAssignedCount++;
        if (m.targetProgress.isAchieved) targetsAchievedCount++;
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
          targetsAssignedCount,
          targetsAchievedCount,
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

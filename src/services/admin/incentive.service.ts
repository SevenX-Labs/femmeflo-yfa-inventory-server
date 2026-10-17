import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import type {
  UpdateIncentiveSettingsInput,
  UpdateUserRateInput,
  CreateAdjustmentInput,
  CreatePayoutInput,
  ListIncentivesQuery,
} from "../../controller/incentive.validation.js";
import { HttpError } from "../../middleware/validation.js";
import {
  calculateUserIncentiveSummary,
  calculatePayoutAllocations,
  getCurrentAndPreviousPeriod,
  type PeriodEarning,
} from "../incentive/incentive.calculator.js";

export function createAdminIncentiveService(database: PrismaClient) {
  async function getOrCreateSettings() {
    let settings = await database.businessSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await database.businessSettings.create({
        data: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: null },
      });
    }
    return settings;
  }

  return {
    getIncentives: async (query: ListIncentivesQuery = {}) => {
      const settings = await getOrCreateSettings();

      // Determine which roles to query
      let roles: ("SELLER" | "MANAGER")[] = ["SELLER", "MANAGER"];
      if (query.role === "SELLER") {
        roles = ["SELLER"];
      } else if (query.role === "MANAGER") {
        roles = ["MANAGER"];
      }

      const where: Prisma.UserWhereInput = {
        role: { in: roles },
        active: true,
      };

      if (query.managerId) {
        where.managerId = query.managerId;
      }

      if (query.search) {
        const s = query.search;
        where.OR = [
          { name: { contains: s, mode: "insensitive" } },
          { phone: { contains: s, mode: "insensitive" } },
          { email: { contains: s, mode: "insensitive" } },
          { employeeCode: { contains: s, mode: "insensitive" } },
        ];
      }

      const users = await database.user.findMany({
        where,
        orderBy: [{ role: "asc" }, { name: "asc" }],
        include: {
          manager: { select: { id: true, name: true, phone: true } },
        },
      });

      const now = new Date();
      const { currentYear, currentMonth, prevYear, prevMonth } = getCurrentAndPreviousPeriod(now);

      const items = await Promise.all(
        users.map(async (user) => {
          const [sales, adjustments, payouts] = await Promise.all([
            database.sale.findMany({
              where: { sellerId: user.id, status: "CONFIRMED" },
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
              where: { userId: user.id },
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
              where: { userId: user.id },
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

          const summary = calculateUserIncentiveSummary(user.id, sales, adjustments, payouts, now);
          const territory = [user.village, user.district, user.state].filter(Boolean).join(", ") || "Unassigned";
          const effectiveRatePaise = user.incentiveRatePaise ?? settings.incentiveRatePaise ?? 0;

          return {
            seller: {
              id: user.id,
              name: user.name,
              phone: user.phone,
              email: user.email,
              role: user.role,
              employeeCode: user.employeeCode,
              manager: user.manager,
            },
            sellerId: user.id,
            sellerName: user.name,
            role: user.role,
            manager: user.manager,
            territory,
            isCustomRate: user.incentiveRatePaise !== null && user.incentiveRatePaise !== undefined,
            ratePerPacketPaise: effectiveRatePaise,
            ratePerPacketRupees: effectiveRatePaise / 100,
            confirmedPackets: summary.totalConfirmedPackets,
            totalConfirmedPackets: summary.totalConfirmedPackets,
            totalIncentivePaise: summary.salesIncentivePaise,
            totalIncentiveRupees: summary.salesIncentivePaise / 100,
            earnedPaise: summary.salesIncentivePaise,
            additionsPaise: summary.additionsPaise,
            deductionsPaise: summary.deductionsPaise,
            adjustedEntitlementPaise: summary.adjustedEntitlementPaise,
            totalPaidPaise: summary.totalPaidPaise,
            outstandingPaise: summary.outstandingPaise,
            status: summary.status,
            currentMonth: summary.currentMonth,
            previousMonth: summary.previousMonth,
            olderPendingPaise: summary.olderPendingPaise,
            periods: summary.periods,
          };
        }),
      );

      // Filter by payment status if requested
      const filteredItems = query.status && query.status !== "ALL"
        ? items.filter((item) => item.status === query.status)
        : items;

      // Calculate aggregate totals
      let totalEarnedPaise = 0;
      let totalAdditionsPaise = 0;
      let totalDeductionsPaise = 0;
      let totalAdjustedEntitlementPaise = 0;
      let totalPaidPaise = 0;
      let totalPendingPaise = 0;
      let currentMonthEarnedPaise = 0;
      let currentMonthPaidPaise = 0;
      let currentMonthPendingPaise = 0;
      let prevMonthEarnedPaise = 0;
      let prevMonthPaidPaise = 0;
      let prevMonthPendingPaise = 0;
      let olderPendingPaise = 0;
      let pendingEmployeesCount = 0;

      for (const item of items) {
        totalEarnedPaise += item.earnedPaise;
        totalAdditionsPaise += item.additionsPaise;
        totalDeductionsPaise += item.deductionsPaise;
        totalAdjustedEntitlementPaise += item.adjustedEntitlementPaise;
        totalPaidPaise += item.totalPaidPaise;
        totalPendingPaise += item.outstandingPaise;

        if (item.outstandingPaise > 0) {
          pendingEmployeesCount++;
        }

        currentMonthEarnedPaise += item.currentMonth.salesIncentivePaise;
        currentMonthPaidPaise += item.currentMonth.allocatedPaidPaise;
        currentMonthPendingPaise += item.currentMonth.outstandingPaise;

        prevMonthEarnedPaise += item.previousMonth.salesIncentivePaise;
        prevMonthPaidPaise += item.previousMonth.allocatedPaidPaise;
        prevMonthPendingPaise += item.previousMonth.outstandingPaise;

        olderPendingPaise += item.olderPendingPaise;
      }

      const summary = {
        totalEarnedPaise,
        totalEarnedRupees: totalEarnedPaise / 100,
        totalAdditionsPaise,
        totalAdditionsRupees: totalAdditionsPaise / 100,
        totalDeductionsPaise,
        totalDeductionsRupees: totalDeductionsPaise / 100,
        totalAdjustedEntitlementPaise,
        totalAdjustedEntitlementRupees: totalAdjustedEntitlementPaise / 100,
        totalPaidPaise,
        totalPaidRupees: totalPaidPaise / 100,
        totalPendingPaise,
        totalPendingRupees: totalPendingPaise / 100,
        currentMonth: {
          year: currentYear,
          month: currentMonth,
          earnedPaise: currentMonthEarnedPaise,
          earnedRupees: currentMonthEarnedPaise / 100,
          paidPaise: currentMonthPaidPaise,
          paidRupees: currentMonthPaidPaise / 100,
          pendingPaise: currentMonthPendingPaise,
          pendingRupees: currentMonthPendingPaise / 100,
        },
        previousMonth: {
          year: prevYear,
          month: prevMonth,
          earnedPaise: prevMonthEarnedPaise,
          earnedRupees: prevMonthEarnedPaise / 100,
          paidPaise: prevMonthPaidPaise,
          paidRupees: prevMonthPaidPaise / 100,
          pendingPaise: prevMonthPendingPaise,
          pendingRupees: prevMonthPendingPaise / 100,
        },
        olderPendingPaise,
        olderPendingRupees: olderPendingPaise / 100,
        pendingEmployeesCount,
      };

      return {
        summary,
        currentRatePaise: settings.incentiveRatePaise,
        sellers: filteredItems, // Backward compatibility for existing frontend
        users: filteredItems,
      };
    },

    getUserIncentiveDetails: async (userId: string) => {
      const settings = await getOrCreateSettings();

      const user = await database.user.findUnique({
        where: { id: userId },
        include: {
          manager: { select: { id: true, name: true, phone: true } },
          incentiveRateHistory: {
            orderBy: { createdAt: "desc" },
            include: {
              changedBy: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!user) {
        throw new HttpError(404, "Employee not found");
      }

      const now = new Date();
      const [sales, adjustments, payouts] = await Promise.all([
        database.sale.findMany({
          where: { sellerId: user.id, status: "CONFIRMED" },
          orderBy: { confirmedAt: "desc" },
          include: {
            customer: { select: { id: true, shopName: true, contactName: true, phone: true } },
          },
        }),
        database.incentiveAdjustment.findMany({
          where: { userId: user.id },
          orderBy: { adjustmentDate: "desc" },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        }),
        database.incentivePayout.findMany({
          where: { userId: user.id },
          orderBy: { paymentDate: "desc" },
          include: {
            createdBy: { select: { id: true, name: true } },
            allocations: {
              orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            },
          },
        }),
      ]);

      const summary = calculateUserIncentiveSummary(user.id, sales, adjustments, payouts, now);
      const effectiveRatePaise = user.incentiveRatePaise ?? settings.incentiveRatePaise ?? 0;

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          employeeCode: user.employeeCode,
          designation: user.designation,
          state: user.state,
          district: user.district,
          village: user.village,
          manager: user.manager,
          incentiveRatePaise: user.incentiveRatePaise,
          effectiveRatePaise,
          effectiveRateRupees: effectiveRatePaise / 100,
          isCustomRate: user.incentiveRatePaise !== null && user.incentiveRatePaise !== undefined,
        },
        summary,
        rateHistory: user.incentiveRateHistory,
        adjustments,
        payouts,
        sales: sales.map((sale) => ({
          id: sale.id,
          confirmedAt: sale.confirmedAt ?? sale.createdAt,
          customer: sale.customer,
          quantity: sale.quantity,
          incentiveRatePaise: sale.incentiveRatePaise,
          incentiveAmountPaise: sale.incentiveAmountPaise,
        })),
      };
    },

    updateUserRate: async (adminId: string, userId: string, input: UpdateUserRateInput) => {
      const user = await database.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true, incentiveRatePaise: true },
      });

      if (!user) {
        throw new HttpError(404, "Employee not found");
      }

      if (user.role !== "SELLER" && user.role !== "MANAGER") {
        throw new HttpError(400, "Incentive rate can only be assigned to Sellers or Managers");
      }

      const previousRatePaise = user.incentiveRatePaise;
      const effectiveDate = input.effectiveDate ? new Date(input.effectiveDate) : new Date();

      return database.$transaction(async (tx) => {
        // Record in history audit table
        const history = await tx.incentiveRateHistory.create({
          data: {
            userId,
            previousRatePaise,
            newRatePaise: input.ratePaise,
            effectiveDate,
            reason: input.reason ?? null,
            changedById: adminId,
          },
        });

        // Update user
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { incentiveRatePaise: input.ratePaise },
          select: {
            id: true,
            name: true,
            role: true,
            incentiveRatePaise: true,
          },
        });

        return {
          user: updatedUser,
          history,
        };
      });
    },

    createAdjustment: async (adminId: string, userId: string, input: CreateAdjustmentInput) => {
      const user = await database.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true },
      });

      if (!user) {
        throw new HttpError(404, "Employee not found");
      }

      return database.$transaction(async (tx) => {
        // If deducting, check that the employee has sufficient outstanding entitlement
        if (input.type === "DEDUCT") {
          const [sales, adjustments, payouts] = await Promise.all([
            tx.sale.findMany({
              where: { sellerId: userId, status: "CONFIRMED" },
              select: { id: true, quantity: true, incentiveRatePaise: true, incentiveAmountPaise: true, confirmedAt: true, createdAt: true },
            }),
            tx.incentiveAdjustment.findMany({
              where: { userId },
              select: { id: true, type: true, amountPaise: true, reason: true, adjustmentDate: true, createdAt: true },
            }),
            tx.incentivePayout.findMany({
              where: { userId },
              select: { id: true, amountPaise: true, paymentDate: true, paymentMethod: true, referenceId: true, remarks: true, createdAt: true, allocations: true },
            }),
          ]);

          const summary = calculateUserIncentiveSummary(userId, sales, adjustments, payouts);
          if (summary.outstandingPaise < input.amountPaise) {
            throw new HttpError(
              400,
              `Deduction amount of ₹${(input.amountPaise / 100).toFixed(2)} exceeds the remaining payable balance of ₹${(summary.outstandingPaise / 100).toFixed(2)}`
            );
          }
        }

        const adjustment = await tx.incentiveAdjustment.create({
          data: {
            userId,
            type: input.type,
            amountPaise: input.amountPaise,
            reason: input.reason,
            adjustmentDate: input.adjustmentDate ? new Date(input.adjustmentDate) : new Date(),
            createdById: adminId,
          },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        });

        return adjustment;
      });
    },

    createPayout: async (adminId: string, userId: string, input: CreatePayoutInput) => {
      // Idempotency check: if requestKey is provided and payout exists, return existing
      if (input.requestKey) {
        const existing = await database.incentivePayout.findUnique({
          where: { requestKey: input.requestKey },
          include: {
            allocations: true,
            createdBy: { select: { id: true, name: true } },
          },
        });
        if (existing) {
          return existing;
        }
      }

      const user = await database.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true },
      });

      if (!user) {
        throw new HttpError(404, "Employee not found");
      }

      return database.$transaction(async (tx) => {
        // Concurrency protection: fetch active sales, adjustments, payouts to calculate exact balance
        const [sales, adjustments, payouts] = await Promise.all([
          tx.sale.findMany({
            where: { sellerId: userId, status: "CONFIRMED" },
            select: { id: true, quantity: true, incentiveRatePaise: true, incentiveAmountPaise: true, confirmedAt: true, createdAt: true },
          }),
          tx.incentiveAdjustment.findMany({
            where: { userId },
            select: { id: true, type: true, amountPaise: true, reason: true, adjustmentDate: true, createdAt: true },
          }),
          tx.incentivePayout.findMany({
            where: { userId },
            select: { id: true, amountPaise: true, paymentDate: true, paymentMethod: true, referenceId: true, remarks: true, createdAt: true, allocations: true },
          }),
        ]);

        const summary = calculateUserIncentiveSummary(userId, sales, adjustments, payouts);

        if (summary.outstandingPaise <= 0) {
          throw new HttpError(400, "Employee has no outstanding payable balance. Balance is already fully settled.");
        }

        if (input.amountPaise > summary.outstandingPaise) {
          throw new HttpError(
            400,
            `Payment amount of ₹${(input.amountPaise / 100).toFixed(2)} exceeds remaining payable balance of ₹${(summary.outstandingPaise / 100).toFixed(2)}`
          );
        }

        const now = new Date();
        const { currentYear, currentMonth } = getCurrentAndPreviousPeriod(now);

        // Determine period allocations
        let allocationsToCreate: { periodYear: number; periodMonth: number; amountPaise: number }[] = [];

        if (input.periodYear && input.periodMonth) {
          const targetPeriod = summary.periods.find((p) => p.year === input.periodYear && p.month === input.periodMonth);
          const maxAvailable = targetPeriod?.outstandingPaise ?? 0;
          if (input.amountPaise > maxAvailable) {
            throw new HttpError(
              400,
              `Payment amount of ₹${(input.amountPaise / 100).toFixed(2)} exceeds period ${input.periodMonth}/${input.periodYear} outstanding balance of ₹${(maxAvailable / 100).toFixed(2)}`
            );
          }
          allocationsToCreate = [{
            periodYear: input.periodYear,
            periodMonth: input.periodMonth,
            amountPaise: input.amountPaise,
          }];
        } else {
          // FIFO allocation across unpaid months
          allocationsToCreate = calculatePayoutAllocations(
            summary.periods,
            input.amountPaise,
            currentYear,
            currentMonth
          );
        }

        const payout = await tx.incentivePayout.create({
          data: {
            userId,
            amountPaise: input.amountPaise,
            paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
            paymentMethod: input.paymentMethod,
            referenceId: input.referenceId ?? null,
            remarks: input.remarks ?? null,
            requestKey: input.requestKey ?? null,
            createdById: adminId,
            allocations: {
              create: allocationsToCreate,
            },
          },
          include: {
            createdBy: { select: { id: true, name: true } },
            allocations: true,
          },
        });

        return payout;
      });
    },

    getSettings: async () => {
      return getOrCreateSettings();
    },

    updateSettings: async (input: UpdateIncentiveSettingsInput) => {
      await getOrCreateSettings();
      const data: Record<string, unknown> = {};
      if (input.incentiveRatePaise !== undefined) data["incentiveRatePaise"] = input.incentiveRatePaise;
      if (input.minimumPricePaise !== undefined) data["minimumPricePaise"] = input.minimumPricePaise;
      if (input.companyName !== undefined) data["companyName"] = input.companyName;
      if (input.companyGst !== undefined) data["companyGst"] = input.companyGst;
      if (input.companyAddress !== undefined) data["companyAddress"] = input.companyAddress;
      if (input.companyPhone !== undefined) data["companyPhone"] = input.companyPhone;
      if (input.companyEmail !== undefined) data["companyEmail"] = input.companyEmail;
      if (input.companyPan !== undefined) data["companyPan"] = input.companyPan;
      if (input.invoiceTerms !== undefined) data["invoiceTerms"] = input.invoiceTerms;

      return database.businessSettings.update({
        where: { id: 1 },
        data,
      });
    },
  };
}

export type AdminIncentiveService = ReturnType<typeof createAdminIncentiveService>;

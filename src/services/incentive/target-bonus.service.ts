import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  calculateUserIncentiveSummary,
  computeTargetProgress,
  type RawAdjustmentRecord,
  type RawPayoutRecord,
  type RawSaleRecord,
  type SalesTargetPeriod,
  type TargetProgressSummary,
  type TargetSaleRecord,
} from "./incentive.calculator.js";

export function buildTargetBonusReason(period: SalesTargetPeriod, periodLabel: string): string {
  return `Target Bonus • ${period === "DAILY" ? "Daily" : "Monthly"} (${periodLabel})`;
}

export interface TargetBonusAdjustmentRow {
  id: string;
  userId?: string;
  type: "ADD" | "DEDUCT";
  amountPaise: number;
  reason: string;
  adjustmentDate: Date;
  createdAt: Date;
  createdById?: string;
  createdBy?: { id: string; name: string } | null;
}

function normalizeAdjustmentRow(row: {
  id: string;
  userId?: string;
  type: string;
  amountPaise: number;
  reason: string;
  adjustmentDate: Date;
  createdAt: Date;
  createdById?: string;
  createdBy?: { id: string; name: string } | null;
}): TargetBonusAdjustmentRow {
  return {
    ...row,
    type: row.type === "DEDUCT" ? "DEDUCT" : "ADD",
  };
}

export async function syncUserTargetBonusAdjustment(
  database: PrismaClient,
  params: {
    userId: string;
    salesTargetPackets: number | null;
    salesTargetPeriod: SalesTargetPeriod;
    targetBonusPaise: number | null;
    confirmedSales: TargetSaleRecord[];
    existingAdjustments: TargetBonusAdjustmentRow[];
    actorUserId: string;
    referenceDate?: Date;
  }
): Promise<{
  progress: TargetProgressSummary;
  createdAdjustment: TargetBonusAdjustmentRow | null;
}> {
  const referenceDate = params.referenceDate ?? new Date();
  const progress = computeTargetProgress(
    {
      salesTargetPackets: params.salesTargetPackets,
      salesTargetPeriod: params.salesTargetPeriod,
      targetBonusPaise: params.targetBonusPaise,
    },
    params.confirmedSales,
    referenceDate
  );

  if (!progress.isAchieved || progress.bonusPaise <= 0) {
    return { progress, createdAdjustment: null };
  }

  const reason = buildTargetBonusReason(progress.period, progress.periodLabel);
  const alreadyPresent = params.existingAdjustments.some(
    (adj) => adj.type === "ADD" && adj.reason === reason
  );
  if (alreadyPresent) {
    return { progress, createdAdjustment: null };
  }

  const createdAdjustment = await database.$transaction(async (tx) => {
    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${params.userId}:${reason}`}))`;
    } catch {
      // Advisory locks are unavailable outside live PostgreSQL (e.g., mocked tests)
    }

    const existing = await tx.incentiveAdjustment.findFirst({
      where: {
        userId: params.userId,
        type: "ADD",
        reason,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (existing) {
      return null;
    }

    const created = await tx.incentiveAdjustment.create({
      data: {
        userId: params.userId,
        type: "ADD",
        amountPaise: progress.bonusPaise,
        reason,
        adjustmentDate: referenceDate,
        createdById: params.actorUserId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
    return normalizeAdjustmentRow(created);
  });

  return { progress, createdAdjustment };
}

export async function syncTargetBonusInTransaction(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  params: {
    userId: string;
    salesTargetPackets: number | null;
    salesTargetPeriod: SalesTargetPeriod;
    targetBonusPaise: number | null;
    confirmedSales: (RawSaleRecord & TargetSaleRecord)[];
    adjustments: TargetBonusAdjustmentRow[];
    payouts: RawPayoutRecord[];
    effectiveRatePaise: number;
    actorUserId: string;
    allowModifyExistingForActivePeriod?: boolean;
    referenceDate?: Date;
  }
): Promise<{
  progress: TargetProgressSummary;
  adjustments: TargetBonusAdjustmentRow[];
}> {
  const referenceDate = params.referenceDate ?? new Date();
  const progress = computeTargetProgress(
    {
      salesTargetPackets: params.salesTargetPackets,
      salesTargetPeriod: params.salesTargetPeriod,
      targetBonusPaise: params.targetBonusPaise,
    },
    params.confirmedSales,
    referenceDate
  );

  const reason = buildTargetBonusReason(progress.period, progress.periodLabel);
  const adjustmentsCopy = [...params.adjustments];
  const existingIdx = adjustmentsCopy.findIndex(
    (adj) => adj.type === "ADD" && adj.reason === reason
  );
  const existing = existingIdx >= 0 ? adjustmentsCopy[existingIdx]! : null;

  if (progress.isAchieved && progress.bonusPaise > 0) {
    if (!existing) {
      const created = await tx.incentiveAdjustment.create({
        data: {
          userId: params.userId,
          type: "ADD",
          amountPaise: progress.bonusPaise,
          reason,
          adjustmentDate: referenceDate,
          createdById: params.actorUserId,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });
      adjustmentsCopy.unshift(normalizeAdjustmentRow(created));
    } else if (
      params.allowModifyExistingForActivePeriod &&
      existing.amountPaise !== progress.bonusPaise
    ) {
      const currentSummary = calculateUserIncentiveSummary(
        params.userId,
        params.confirmedSales,
        adjustmentsCopy as RawAdjustmentRecord[],
        params.payouts,
        referenceDate,
        params.effectiveRatePaise
      );
      const nextAdjusted =
        currentSummary.adjustedEntitlementPaise - existing.amountPaise + progress.bonusPaise;
      if (nextAdjusted >= currentSummary.totalPaidPaise) {
        const updated = await tx.incentiveAdjustment.update({
          where: { id: existing.id },
          data: { amountPaise: progress.bonusPaise },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        });
        adjustmentsCopy[existingIdx] = normalizeAdjustmentRow(updated);
      }
    }
  } else if (params.allowModifyExistingForActivePeriod && existing) {
    const currentSummary = calculateUserIncentiveSummary(
      params.userId,
      params.confirmedSales,
      adjustmentsCopy as RawAdjustmentRecord[],
      params.payouts,
      referenceDate,
      params.effectiveRatePaise
    );
    const nextAdjusted = currentSummary.adjustedEntitlementPaise - existing.amountPaise;
    if (nextAdjusted >= currentSummary.totalPaidPaise) {
      await tx.incentiveAdjustment.delete({ where: { id: existing.id } });
      adjustmentsCopy.splice(existingIdx, 1);
    }
  }

  return { progress, adjustments: adjustmentsCopy };
}

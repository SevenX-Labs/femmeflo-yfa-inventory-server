export interface PeriodEarning {
  year: number;
  month: number;
  label: string; // e.g. "October 2026"
  confirmedPackets: number;
  salesIncentivePaise: number;
  additionsPaise: number;
  deductionsPaise: number;
  adjustedEntitlementPaise: number;
  allocatedPaidPaise: number;
  outstandingPaise: number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
}

export interface UserIncentiveSummary {
  userId: string;
  totalConfirmedPackets: number;
  salesIncentivePaise: number;
  additionsPaise: number;
  deductionsPaise: number;
  adjustedEntitlementPaise: number;
  totalPaidPaise: number;
  outstandingPaise: number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  currentMonth: PeriodEarning;
  previousMonth: PeriodEarning;
  olderPendingPaise: number;
  periods: PeriodEarning[];
}

export interface RawSaleRecord {
  id: string;
  quantity: number;
  incentiveRatePaise?: number | null;
  incentiveAmountPaise?: number | null;
  confirmedAt?: Date | string | null;
  createdAt: Date | string;
}

export interface RawAdjustmentRecord {
  id: string;
  type: "ADD" | "DEDUCT";
  amountPaise: number;
  reason: string;
  adjustmentDate?: Date | string | null;
  createdAt: Date | string;
}

export interface RawPayoutAllocationRecord {
  periodYear: number;
  periodMonth: number;
  amountPaise: number;
}

export interface RawPayoutRecord {
  id: string;
  amountPaise: number;
  paymentDate: Date | string;
  paymentMethod: string;
  referenceId?: string | null;
  remarks?: string | null;
  createdAt: Date | string;
  allocations: RawPayoutAllocationRecord[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function getMonthLabel(year: number, month: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? `Month ${month}`;
  return `${monthName} ${year}`;
}

export function getCurrentAndPreviousPeriod(referenceDate: Date = new Date()) {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1; // 1-indexed

  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;

  return {
    currentYear,
    currentMonth,
    prevYear,
    prevMonth,
  };
}

export function calculateUserIncentiveSummary(
  userId: string,
  sales: RawSaleRecord[],
  adjustments: RawAdjustmentRecord[],
  payouts: RawPayoutRecord[],
  referenceDate: Date = new Date()
): UserIncentiveSummary {
  const { currentYear, currentMonth, prevYear, prevMonth } = getCurrentAndPreviousPeriod(referenceDate);

  // Group items by period key: "YYYY-MM"
  type PeriodBucket = {
    year: number;
    month: number;
    confirmedPackets: number;
    salesIncentivePaise: number;
    additionsPaise: number;
    deductionsPaise: number;
    allocatedPaidPaise: number;
  };

  const periodMap = new Map<string, PeriodBucket>();

  function getBucket(year: number, month: number): PeriodBucket {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    let bucket = periodMap.get(key);
    if (!bucket) {
      bucket = {
        year,
        month,
        confirmedPackets: 0,
        salesIncentivePaise: 0,
        additionsPaise: 0,
        deductionsPaise: 0,
        allocatedPaidPaise: 0,
      };
      periodMap.set(key, bucket);
    }
    return bucket;
  }

  // Ensure current and previous month always exist
  getBucket(currentYear, currentMonth);
  getBucket(prevYear, prevMonth);

  // Process sales
  let totalConfirmedPackets = 0;
  let totalSalesIncentivePaise = 0;

  for (const sale of sales) {
    const d = new Date(sale.confirmedAt ?? sale.createdAt);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const bucket = getBucket(y, m);

    const amount = sale.incentiveAmountPaise ?? (sale.quantity * (sale.incentiveRatePaise ?? 0));
    bucket.confirmedPackets += sale.quantity;
    bucket.salesIncentivePaise += amount;

    totalConfirmedPackets += sale.quantity;
    totalSalesIncentivePaise += amount;
  }

  // Process adjustments
  let totalAdditionsPaise = 0;
  let totalDeductionsPaise = 0;

  for (const adj of adjustments) {
    const d = new Date(adj.adjustmentDate ?? adj.createdAt);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const bucket = getBucket(y, m);

    if (adj.type === "ADD") {
      bucket.additionsPaise += adj.amountPaise;
      totalAdditionsPaise += adj.amountPaise;
    } else {
      bucket.deductionsPaise += adj.amountPaise;
      totalDeductionsPaise += adj.amountPaise;
    }
  }

  // Process payouts & allocations
  let totalPaidPaise = 0;

  for (const payout of payouts) {
    totalPaidPaise += payout.amountPaise;

    for (const alloc of payout.allocations) {
      const bucket = getBucket(alloc.periodYear, alloc.periodMonth);
      bucket.allocatedPaidPaise += alloc.amountPaise;
    }
  }

  // Compute period summaries
  const sortedKeys = Array.from(periodMap.keys()).sort(); // Chronological: YYYY-MM
  const periods: PeriodEarning[] = [];

  let olderPendingPaise = 0;

  for (const key of sortedKeys) {
    const bucket = periodMap.get(key)!;
    const adjustedEntitlement = bucket.salesIncentivePaise + bucket.additionsPaise - bucket.deductionsPaise;
    const outstanding = Math.max(0, adjustedEntitlement - bucket.allocatedPaidPaise);

    let status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
    if (adjustedEntitlement <= 0) {
      status = "PAID";
    } else if (bucket.allocatedPaidPaise === 0) {
      status = "UNPAID";
    } else if (bucket.allocatedPaidPaise < adjustedEntitlement) {
      status = "PARTIALLY_PAID";
    } else {
      status = "PAID";
    }

    const periodEarning: PeriodEarning = {
      year: bucket.year,
      month: bucket.month,
      label: getMonthLabel(bucket.year, bucket.month),
      confirmedPackets: bucket.confirmedPackets,
      salesIncentivePaise: bucket.salesIncentivePaise,
      additionsPaise: bucket.additionsPaise,
      deductionsPaise: bucket.deductionsPaise,
      adjustedEntitlementPaise: adjustedEntitlement,
      allocatedPaidPaise: bucket.allocatedPaidPaise,
      outstandingPaise: outstanding,
      status,
    };

    periods.push(periodEarning);

    // If this period is strictly before previous month, add to olderPendingPaise
    const isCurrent = bucket.year === currentYear && bucket.month === currentMonth;
    const isPrevious = bucket.year === prevYear && bucket.month === prevMonth;
    if (!isCurrent && !isPrevious) {
      // Check if earlier than prevMonth
      if (
        bucket.year < prevYear ||
        (bucket.year === prevYear && bucket.month < prevMonth)
      ) {
        olderPendingPaise += outstanding;
      }
    }
  }

  const currentPeriod = periods.find((p) => p.year === currentYear && p.month === currentMonth)!;
  const previousPeriod = periods.find((p) => p.year === prevYear && p.month === prevMonth)!;

  const totalAdjustedEntitlementPaise = totalSalesIncentivePaise + totalAdditionsPaise - totalDeductionsPaise;
  const totalOutstandingPaise = Math.max(0, totalAdjustedEntitlementPaise - totalPaidPaise);

  let overallStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  if (totalAdjustedEntitlementPaise <= 0) {
    overallStatus = "PAID";
  } else if (totalPaidPaise === 0) {
    overallStatus = "UNPAID";
  } else if (totalPaidPaise < totalAdjustedEntitlementPaise) {
    overallStatus = "PARTIALLY_PAID";
  } else {
    overallStatus = "PAID";
  }

  return {
    userId,
    totalConfirmedPackets,
    salesIncentivePaise: totalSalesIncentivePaise,
    additionsPaise: totalAdditionsPaise,
    deductionsPaise: totalDeductionsPaise,
    adjustedEntitlementPaise: totalAdjustedEntitlementPaise,
    totalPaidPaise,
    outstandingPaise: totalOutstandingPaise,
    status: overallStatus,
    currentMonth: currentPeriod,
    previousMonth: previousPeriod,
    olderPendingPaise,
    periods,
  };
}

/**
 * Calculates FIFO allocations across periods with unpaid balances.
 */
export function calculatePayoutAllocations(
  periods: PeriodEarning[],
  payoutAmountPaise: number,
  fallbackYear: number,
  fallbackMonth: number
): { periodYear: number; periodMonth: number; amountPaise: number }[] {
  let remaining = payoutAmountPaise;
  const allocations: { periodYear: number; periodMonth: number; amountPaise: number }[] = [];

  // Sort periods ascending: oldest first
  const sortedPeriods = [...periods].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  for (const p of sortedPeriods) {
    if (remaining <= 0) break;
    if (p.outstandingPaise > 0) {
      const alloc = Math.min(remaining, p.outstandingPaise);
      allocations.push({
        periodYear: p.year,
        periodMonth: p.month,
        amountPaise: alloc,
      });
      remaining -= alloc;
    }
  }

  // If there is any remaining unallocated amount, allocate to current/fallback period
  if (remaining > 0) {
    const existing = allocations.find((a) => a.periodYear === fallbackYear && a.periodMonth === fallbackMonth);
    if (existing) {
      existing.amountPaise += remaining;
    } else {
      allocations.push({
        periodYear: fallbackYear,
        periodMonth: fallbackMonth,
        amountPaise: remaining,
      });
    }
  }

  return allocations;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

/**
 * Returns current date components in Asia/Kolkata (IST) timezone
 */
export function getISTDateComponents(date: Date = new Date()): { year: number; month: number; day: number } {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth(), // 0-indexed (0 = Jan, 11 = Dec)
    day: istDate.getUTCDate(),
  };
}

/**
 * Returns exact start and end UTC Date instances corresponding to Asia/Kolkata (IST) calendar month boundaries.
 * Prevents timezone drift where transactions between 00:00:00 and 05:29:59 IST on the 1st of any month
 * are misattributed to the prior month in UTC queries.
 */
export function getISTPeriodDateRange(period?: "all" | "this_month" | "last_month"): { gte?: Date; lte?: Date } | undefined {
  if (!period || period === "all") return undefined;

  const now = new Date();
  const { year, month } = getISTDateComponents(now);

  if (period === "this_month") {
    // 1st day of current month 00:00:00.000 IST -> converted to UTC by subtracting 5h 30m
    const startOfIstMonthUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
    return { gte: startOfIstMonthUtc };
  }

  if (period === "last_month") {
    // 1st day of previous month 00:00:00.000 IST
    const startOfLastMonthUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
    // Last millisecond of previous month 23:59:59.999 IST
    const endOfLastMonthUtc = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999) - IST_OFFSET_MS);

    return { gte: startOfLastMonthUtc, lte: endOfLastMonthUtc };
  }

  return undefined;
}

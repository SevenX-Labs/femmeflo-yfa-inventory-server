/**
 * Asia/Kolkata (IST) is UTC+05:30.
 * In milliseconds: (5 * 60 + 30) * 60 * 1000 = 19,800,000 ms.
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface ISTDateComponents {
  year: number;
  month: number; // 0-indexed: 0 = Jan, 11 = Dec
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

/**
 * Returns exact date components for an instant in the Asia/Kolkata (IST) timezone.
 */
export function getISTDateComponents(date: Date = new Date()): ISTDateComponents {
  const istTimeMs = date.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istTimeMs);
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth(),
    day: istDate.getUTCDate(),
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes(),
    seconds: istDate.getUTCSeconds(),
    milliseconds: istDate.getUTCMilliseconds(),
  };
}

/**
 * Creates a UTC Date corresponding to a given wall-clock year, month (0-indexed),
 * day, hour, minute, second in Asia/Kolkata (IST).
 */
export function istToUtcDate(
  year: number,
  month: number,
  day: number = 1,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0,
  ms: number = 0
): Date {
  // wall clock time in UTC minus 5h 30m offset
  const utcEpoch = Date.UTC(year, month, day, hours, minutes, seconds, ms) - IST_OFFSET_MS;
  return new Date(utcEpoch);
}

/**
 * Returns half-open UTC Date intervals [gte, lt) for standard IST business periods:
 * - "today": [00:00:00 IST today, 00:00:00 IST tomorrow)
 * - "this_month": [00:00:00 IST 1st of this month, 00:00:00 IST 1st of next month)
 * - "last_month": [00:00:00 IST 1st of last month, 00:00:00 IST 1st of this month)
 */
export function getISTPeriodDateRange(
  period?: "all" | "today" | "this_month" | "last_month",
  referenceDate: Date = new Date()
): { gte?: Date; lt?: Date } | undefined {
  if (!period || period === "all") return undefined;

  const { year, month, day } = getISTDateComponents(referenceDate);

  if (period === "today") {
    const startOfTodayUtc = istToUtcDate(year, month, day, 0, 0, 0, 0);
    const startOfTomorrowUtc = istToUtcDate(year, month, day + 1, 0, 0, 0, 0);
    return { gte: startOfTodayUtc, lt: startOfTomorrowUtc };
  }

  if (period === "this_month") {
    const startOfThisMonthUtc = istToUtcDate(year, month, 1, 0, 0, 0, 0);
    const startOfNextMonthUtc = istToUtcDate(year, month + 1, 1, 0, 0, 0, 0);
    return { gte: startOfThisMonthUtc, lt: startOfNextMonthUtc };
  }

  if (period === "last_month") {
    const startOfLastMonthUtc = istToUtcDate(year, month - 1, 1, 0, 0, 0, 0);
    const startOfThisMonthUtc = istToUtcDate(year, month, 1, 0, 0, 0, 0);
    return { gte: startOfLastMonthUtc, lt: startOfThisMonthUtc };
  }

  return undefined;
}

/**
 * Parses user input `from` and `to` (YYYY-MM-DD or ISO strings) into half-open [gte, lt)
 * UTC Date boundaries based on Asia/Kolkata calendar days.
 * E.g., `from: "2026-10-01", to: "2026-10-15"` ->
 *   gte: 2026-10-01 00:00:00 IST in UTC
 *   lt:  2026-10-16 00:00:00 IST in UTC (covers all of Oct 15th)
 */
export function parseISTDateRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;

  const result: { gte?: Date; lt?: Date } = {};

  if (from) {
    if (from.includes("T")) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) result.gte = d;
    } else {
      // YYYY-MM-DD
      const parts = from.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        result.gte = istToUtcDate(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      }
    }
  }

  if (to) {
    if (to.includes("T")) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) result.lt = d;
    } else {
      // YYYY-MM-DD: next day 00:00:00 IST for half-open interval
      const parts = to.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        result.lt = istToUtcDate(parts[0], parts[1] - 1, parts[2] + 1, 0, 0, 0, 0);
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Formats a Date into Asia/Kolkata readable string: YYYY-MM-DD HH:mm:ss
 */
export function formatISTDate(date: Date): string {
  const { year, month, day, hours, minutes, seconds } = getISTDateComponents(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

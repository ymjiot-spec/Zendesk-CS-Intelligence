/**
 * Daily Summary Aggregation
 * Computes daily ticket summary including day-over-day comparison,
 * 7-day and 30-day averages, and trend classification.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import type { DailySummary } from '@/types/aggregation';
import type { FilteredTicket } from '@/types/ticket';

/**
 * Classify trend based on diff value.
 * Positive → 'increase', negative → 'decrease', zero → 'flat'
 */
export function classifyTrend(diff: number): 'increase' | 'decrease' | 'flat' {
  if (diff > 0) return 'increase';
  if (diff < 0) return 'decrease';
  return 'flat';
}

/**
 * Count tickets for a specific date (by createdAt, comparing date portion only).
 */
function countTicketsForDate(tickets: FilteredTicket[], date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  return tickets.filter((t) => {
    const d = new Date(t.createdAt);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  }).length;
}

/**
 * Compute the average ticket count over the last N days ending on `date` (inclusive).
 */
function computeNDayAverage(tickets: FilteredTicket[], date: Date, n: number): number {
  if (n <= 0) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() - i);
    total += countTicketsForDate(tickets, d);
  }
  return total / n;
}

/**
 * Compute the day-over-day rate (%).
 * If yesterday count is 0, returns 0 to avoid division by zero.
 */
function computeDayOverDayRate(todayCount: number, yesterdayCount: number): number {
  if (yesterdayCount === 0) return 0;
  return ((todayCount - yesterdayCount) / yesterdayCount) * 100;
}

/**
 * Compute a daily summary for the given date from filtered ticket data.
 *
 * @param tickets - Population-filtered tickets (isExcluded === false expected)
 * @param date - The target date to summarize
 * @returns DailySummary
 */
export function computeDailySummary(
  tickets: FilteredTicket[],
  date: Date,
): DailySummary {
  const included = tickets.filter((t) => !t.isExcluded);

  const totalCount = countTicketsForDate(included, date);

  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const previousDayCount = countTicketsForDate(included, yesterday);

  const dayOverDayDiff = totalCount - previousDayCount;
  const dayOverDayRate = computeDayOverDayRate(totalCount, previousDayCount);

  const avg7Days = computeNDayAverage(included, date, 7);
  const avg30Days = computeNDayAverage(included, date, 30);

  const trend = classifyTrend(dayOverDayDiff);

  return {
    date,
    totalCount,
    previousDayCount,
    dayOverDayDiff,
    dayOverDayRate,
    avg7Days,
    avg30Days,
    trend,
  };
}

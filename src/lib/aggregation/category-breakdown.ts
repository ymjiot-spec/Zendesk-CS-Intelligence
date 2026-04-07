/**
 * Category Breakdown Aggregation
 * Computes per-category ticket counts, percentages, diffs, and rankings.
 * When more than 6 categories exist, top 5 are shown individually
 * and the rest are aggregated as "その他".
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import type { CategoryBreakdown } from '@/types/aggregation';
import type { FilteredTicket } from '@/types/ticket';
import { classifyTrend } from './daily-summary';

/**
 * Count tickets per category for a specific date.
 */
function countByCategory(tickets: FilteredTicket[], date: Date): Map<string, number> {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const map = new Map<string, number>();

  for (const t of tickets) {
    const d = new Date(t.createdAt);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      map.set(t.inquiryCategory, (map.get(t.inquiryCategory) ?? 0) + 1);
    }
  }
  return map;
}

/**
 * Get the date N days before the given date.
 */
function daysAgo(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Compute category breakdown for the given date.
 *
 * @param tickets - Population-filtered tickets (isExcluded === false expected)
 * @param date - The target date
 * @returns CategoryBreakdown[] sorted by count descending, with "その他" aggregation if > 6 categories
 */
export function computeCategoryBreakdown(
  tickets: FilteredTicket[],
  date: Date,
): CategoryBreakdown[] {
  const included = tickets.filter((t) => !t.isExcluded);

  const todayCounts = countByCategory(included, date);
  const yesterdayCounts = countByCategory(included, daysAgo(date, 1));
  const prevWeekSameDayCounts = countByCategory(included, daysAgo(date, 7));

  // Collect all categories from today
  const allCategories = Array.from(todayCounts.keys());
  const totalCount = Array.from(todayCounts.values()).reduce((a, b) => a + b, 0);

  // Build breakdown entries sorted by count descending
  let entries: CategoryBreakdown[] = allCategories
    .map((category) => {
      const count = todayCounts.get(category) ?? 0;
      const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
      const prevDayCount = yesterdayCounts.get(category) ?? 0;
      const prevWeekCount = prevWeekSameDayCounts.get(category) ?? 0;
      const previousDayDiff = count - prevDayCount;
      const previousWeekSameDayDiff = count - prevWeekCount;

      return {
        category,
        count,
        percentage,
        previousDayDiff,
        previousWeekSameDayDiff,
        trend: classifyTrend(previousDayDiff),
        rank: 0, // will be assigned after sorting
      };
    })
    .sort((a, b) => b.count - a.count);

  // Apply top 5 + "その他" aggregation when > 6 categories
  if (entries.length > 6) {
    const top5 = entries.slice(0, 5);
    const rest = entries.slice(5);

    const othersCount = rest.reduce((sum, e) => sum + e.count, 0);
    const othersPercentage = totalCount > 0 ? (othersCount / totalCount) * 100 : 0;
    const othersPrevDayDiff = rest.reduce((sum, e) => sum + e.previousDayDiff, 0);
    const othersPrevWeekDiff = rest.reduce((sum, e) => sum + e.previousWeekSameDayDiff, 0);

    const othersEntry: CategoryBreakdown = {
      category: 'その他',
      count: othersCount,
      percentage: othersPercentage,
      previousDayDiff: othersPrevDayDiff,
      previousWeekSameDayDiff: othersPrevWeekDiff,
      trend: classifyTrend(othersPrevDayDiff),
      rank: 6,
    };

    entries = [...top5, othersEntry];
  }

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

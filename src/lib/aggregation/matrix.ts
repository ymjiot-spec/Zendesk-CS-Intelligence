/**
 * Daily × Category Matrix Aggregation
 * For each date in a range, computes total count and per-category
 * count, percentage, and day-over-day diff.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type { MatrixRow } from '@/types/aggregation';
import type { FilteredTicket } from '@/types/ticket';

/**
 * Get a date string key (YYYY-MM-DD) for grouping.
 */
function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Count tickets by date and category.
 * Returns a map of dateKey → (category → count).
 */
function buildDateCategoryMap(
  tickets: FilteredTicket[],
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();

  for (const t of tickets) {
    const dk = dateKey(new Date(t.createdAt));
    if (!map.has(dk)) {
      map.set(dk, new Map());
    }
    const catMap = map.get(dk)!;
    catMap.set(t.inquiryCategory, (catMap.get(t.inquiryCategory) ?? 0) + 1);
  }

  return map;
}

/**
 * Enumerate all dates from startDate to endDate (inclusive).
 */
function enumerateDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Collect all unique categories from the date-category map.
 */
function collectAllCategories(
  dateCatMap: Map<string, Map<string, number>>,
): string[] {
  const cats = new Set<string>();
  Array.from(dateCatMap.values()).forEach((catMap) => {
    Array.from(catMap.keys()).forEach((cat) => {
      cats.add(cat);
    });
  });
  return Array.from(cats).sort();
}

/**
 * Compute the daily × category matrix for a date range.
 *
 * @param tickets - Population-filtered tickets (isExcluded === false expected)
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns MatrixRow[] ordered by date descending (newest first, per req 4.6)
 */
export function computeMatrix(
  tickets: FilteredTicket[],
  startDate: Date,
  endDate: Date,
): MatrixRow[] {
  const included = tickets.filter((t) => !t.isExcluded);
  const dateCatMap = buildDateCategoryMap(included);
  const allCategories = collectAllCategories(dateCatMap);
  const dates = enumerateDates(startDate, endDate);

  const rows: MatrixRow[] = [];

  for (const date of dates) {
    const dk = dateKey(date);
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDk = dateKey(prevDate);

    const catMap = dateCatMap.get(dk) ?? new Map<string, number>();
    const prevCatMap = dateCatMap.get(prevDk) ?? new Map<string, number>();

    const totalCount = Array.from(catMap.values()).reduce((a, b) => a + b, 0);

    const categories: MatrixRow['categories'] = {};
    for (const cat of allCategories) {
      const count = catMap.get(cat) ?? 0;
      const prevCount = prevCatMap.get(cat) ?? 0;
      const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
      const diff = count - prevCount;

      categories[cat] = { count, percentage, diff };
    }

    rows.push({ date, totalCount, categories });
  }

  // Sort by date descending (newest first) per requirement 4.6
  rows.sort((a, b) => b.date.getTime() - a.date.getTime());

  return rows;
}

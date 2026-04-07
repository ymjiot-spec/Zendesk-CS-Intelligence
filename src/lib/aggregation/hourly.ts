/**
 * Hourly Distribution and Heatmap Aggregation
 * Computes hourly (0-23) ticket counts and a 7 (day of week) × 24 (hour)
 * heatmap matrix with min/max counts.
 *
 * Requirements: 5.1, 5.2, 5.3
 */

import type { HourlyData, HeatmapData } from '@/types/aggregation';
import type { FilteredTicket } from '@/types/ticket';

/**
 * Filter tickets within a date range [startDate, endDate] inclusive (by date portion).
 */
function filterByDateRange(
  tickets: FilteredTicket[],
  startDate: Date,
  endDate: Date,
): FilteredTicket[] {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return tickets.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= start && d <= end;
  });
}

/**
 * Compute hourly distribution (0-23) for tickets in the given date range.
 *
 * @param tickets - Population-filtered tickets
 * @param startDate - Start of range (inclusive)
 * @param endDate - End of range (inclusive)
 * @returns HourlyData[] with 24 entries (hours 0-23)
 */
export function computeHourlyDistribution(
  tickets: FilteredTicket[],
  startDate: Date,
  endDate: Date,
): HourlyData[] {
  const included = tickets.filter((t) => !t.isExcluded);
  const rangeTickets = filterByDateRange(included, startDate, endDate);

  // Initialize all 24 hours
  const hourCounts = new Array(24).fill(0) as number[];

  for (const t of rangeTickets) {
    const hour = new Date(t.createdAt).getHours();
    hourCounts[hour]++;
  }

  return hourCounts.map((count, hour) => ({ hour, count }));
}

/**
 * Compute a 7 (day of week) × 24 (hour) heatmap matrix.
 * dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 *
 * @param tickets - Population-filtered tickets
 * @param startDate - Start of range (inclusive)
 * @param endDate - End of range (inclusive)
 * @returns HeatmapData with cells array and min/max counts
 */
export function computeHeatmap(
  tickets: FilteredTicket[],
  startDate: Date,
  endDate: Date,
): HeatmapData {
  const included = tickets.filter((t) => !t.isExcluded);
  const rangeTickets = filterByDateRange(included, startDate, endDate);

  // Initialize 7×24 grid
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[]);

  for (const t of rangeTickets) {
    const d = new Date(t.createdAt);
    const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
    const hour = d.getHours();
    grid[dayOfWeek][hour]++;
  }

  // Build cells array and find min/max
  const cells: HeatmapData['cells'] = [];
  let minCount = Infinity;
  let maxCount = -Infinity;

  for (let dow = 0; dow < 7; dow++) {
    for (let h = 0; h < 24; h++) {
      const count = grid[dow][h];
      cells.push({ dayOfWeek: dow, hour: h, count });
      if (count < minCount) minCount = count;
      if (count > maxCount) maxCount = count;
    }
  }

  // Handle edge case: no tickets at all
  if (minCount === Infinity) minCount = 0;
  if (maxCount === -Infinity) maxCount = 0;

  return { cells, minCount, maxCount };
}

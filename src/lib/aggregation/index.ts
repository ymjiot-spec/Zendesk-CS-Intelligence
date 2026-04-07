/**
 * Aggregation Engine - barrel export
 */

export { computeDailySummary, classifyTrend } from './daily-summary';
export { computeCategoryBreakdown } from './category-breakdown';
export { computeMatrix } from './matrix';
export { computeHourlyDistribution, computeHeatmap } from './hourly';
export {
  resolveDateRange,
  DEFAULT_QUICK_SELECT,
  type QuickSelect,
  type DateRange,
} from './date-range-resolver';

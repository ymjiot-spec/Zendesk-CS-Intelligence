/**
 * Aggregation-related type definitions
 * Used by the AggregationEngine for daily summaries, category breakdowns,
 * matrix views, and time-based analysis
 */

export interface DailySummary {
  date: Date;
  totalCount: number;
  previousDayCount: number;
  dayOverDayDiff: number;
  dayOverDayRate: number; // 増減率 (%)
  avg7Days: number;
  avg30Days: number;
  trend: 'increase' | 'decrease' | 'flat';
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
  previousDayDiff: number;
  previousWeekSameDayDiff: number;
  trend: 'increase' | 'decrease' | 'flat';
  rank: number;
}

export interface MatrixRow {
  date: Date;
  totalCount: number;
  categories: {
    [category: string]: {
      count: number;
      percentage: number;
      diff: number;
    };
  };
}

export interface HeatmapData {
  cells: { dayOfWeek: number; hour: number; count: number }[];
  minCount: number;
  maxCount: number;
}

export interface HourlyData {
  hour: number;
  count: number;
}

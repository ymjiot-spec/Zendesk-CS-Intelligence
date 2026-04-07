/**
 * Trend-based anomaly detection (Requirements 8.1–8.6)
 *
 * Pure functions for moving average, day-of-week average,
 * standard deviation, and sigma-based anomaly checking.
 */

import type { AnomalyEvent, AnomalyDetectorConfig, TrendConfig } from '@/types/anomaly';

/** A daily value with its day-of-week (0=Sun … 6=Sat). */
export interface DailyValue {
  value: number;
  dayOfWeek: number;
}

export const DEFAULT_TREND_CONFIG: TrendConfig = {
  movingAverageDays: 14,
  sigmaMultiplier: 2.0,
  enableDayOfWeekSeasonality: true,
};

/**
 * Compute the simple moving average of the last `windowSize` values.
 * Property 14: result === sum(last N values) / N
 *
 * If values.length < windowSize, uses all available values.
 * Returns 0 for empty arrays.
 */
export function computeMovingAverage(values: number[], windowSize: number): number {
  if (values.length === 0 || windowSize <= 0) return 0;
  const window = values.slice(-windowSize);
  const sum = window.reduce((a, b) => a + b, 0);
  return sum / window.length;
}

/**
 * Compute the average of values that fall on the same day-of-week,
 * looking back `windowWeeks` weeks.
 *
 * `values` should be ordered chronologically (oldest first).
 * Only the last `windowWeeks` matching entries are used.
 * Returns 0 if no matching day-of-week entries exist.
 */
export function computeDayOfWeekAverage(
  values: DailyValue[],
  targetDayOfWeek: number,
  windowWeeks: number,
): number {
  if (values.length === 0 || windowWeeks <= 0) return 0;

  const matching = values.filter((v) => v.dayOfWeek === targetDayOfWeek);
  const window = matching.slice(-windowWeeks);

  if (window.length === 0) return 0;

  const sum = window.reduce((a, b) => a + b.value, 0);
  return sum / window.length;
}

/**
 * Compute the population standard deviation given a set of values and their mean.
 * Returns 0 for empty arrays.
 */
export function computeStandardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Returns true when the current value deviates from the mean
 * by at least sigmaMultiplier × stdDev.
 *
 * Property 15: returns true iff |current - mean| >= sigmaMultiplier * stdDev
 */
export function checkTrendAnomaly(
  current: number,
  mean: number,
  stdDev: number,
  sigmaMultiplier: number,
): boolean {
  return Math.abs(current - mean) >= sigmaMultiplier * stdDev;
}

// ─── Integrated trend detection ────────────────────────────

export interface TrendInput {
  /** Total ticket count for the current period */
  totalCount: number;
  /** Per-category ticket counts for the current period */
  byCategory: Record<string, number>;
  /** Historical daily totals (oldest first) */
  historicalTotals: DailyValue[];
  /** Historical daily per-category values (oldest first) */
  historicalByCategory: Record<string, DailyValue[]>;
  /** Day-of-week of the current period (0=Sun … 6=Sat) */
  currentDayOfWeek: number;
}

/**
 * Run trend-based detection on total and per-category counts.
 * Uses moving average (and optionally day-of-week seasonality)
 * to determine baseline, then checks sigma deviation.
 */
export function detectTrendAnomalies(
  input: TrendInput,
  config: AnomalyDetectorConfig,
  detectedAt: Date,
  idGenerator: () => string,
): AnomalyEvent[] {
  const tc = config.trendConfig;
  const events: AnomalyEvent[] = [];

  // --- Total ---
  const totalEvent = checkMetricTrend(
    'total',
    input.totalCount,
    input.historicalTotals,
    input.currentDayOfWeek,
    tc,
    detectedAt,
    idGenerator,
  );
  if (totalEvent) events.push(totalEvent);

  // --- Per category ---
  for (const [category, count] of Object.entries(input.byCategory)) {
    const history = input.historicalByCategory[category] ?? [];
    const catEvent = checkMetricTrend(
      category,
      count,
      history,
      input.currentDayOfWeek,
      tc,
      detectedAt,
      idGenerator,
    );
    if (catEvent) events.push(catEvent);
  }

  return events;
}

function checkMetricTrend(
  metric: string,
  currentValue: number,
  history: DailyValue[],
  currentDayOfWeek: number,
  tc: TrendConfig,
  detectedAt: Date,
  idGenerator: () => string,
): AnomalyEvent | null {
  const rawValues = history.map((h) => h.value);

  // Compute baseline: day-of-week average if seasonality enabled, else simple MA
  let mean: number;
  let valuesForStdDev: number[];

  if (tc.enableDayOfWeekSeasonality) {
    mean = computeDayOfWeekAverage(history, currentDayOfWeek, tc.movingAverageDays);
    // Use same-day-of-week values for stddev
    const sameDayValues = history
      .filter((h) => h.dayOfWeek === currentDayOfWeek)
      .slice(-tc.movingAverageDays)
      .map((h) => h.value);
    valuesForStdDev = sameDayValues;
  } else {
    mean = computeMovingAverage(rawValues, tc.movingAverageDays);
    valuesForStdDev = rawValues.slice(-tc.movingAverageDays);
  }

  if (valuesForStdDev.length === 0) return null;

  const stdDev = computeStandardDeviation(valuesForStdDev, mean);
  const isAnomaly = checkTrendAnomaly(currentValue, mean, stdDev, tc.sigmaMultiplier);

  if (!isAnomaly) return null;

  const deviation = currentValue - mean;
  const sigmaDistance = stdDev > 0 ? Math.abs(deviation) / stdDev : Infinity;
  const severity: AnomalyEvent['severity'] =
    sigmaDistance >= tc.sigmaMultiplier * 1.5 ? 'critical' : 'warning';

  return {
    id: idGenerator(),
    detectedAt,
    type: 'trend',
    metric,
    currentValue,
    thresholdOrBaseline: mean,
    deviation,
    severity,
  };
}

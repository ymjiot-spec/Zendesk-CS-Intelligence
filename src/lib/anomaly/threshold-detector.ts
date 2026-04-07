/**
 * Threshold-based anomaly detection (Requirements 7.1, 7.2, 7.3, 7.4)
 *
 * Pure functions that compare ticket counts against fixed thresholds
 * and generate AnomalyEvent objects when exceeded.
 */

import type { AnomalyEvent, AnomalyDetectorConfig } from '@/types/anomaly';

/**
 * Returns true when value strictly exceeds the threshold.
 *
 * Property 13: checkThreshold returns true if and only if value > threshold.
 */
export function checkThreshold(value: number, threshold: number): boolean {
  return value > threshold;
}

export interface ThresholdInput {
  /** Total ticket count for the period */
  totalCount: number;
  /** Per-category ticket counts */
  byCategory: Record<string, number>;
}

/**
 * Run threshold detection on total and per-category counts.
 * Returns AnomalyEvent[] for every metric that exceeds its threshold.
 *
 * Severity rules:
 *  - critical: value >= 2× threshold
 *  - warning:  value >  threshold (but < 2×)
 */
export function detectThresholdAnomalies(
  input: ThresholdInput,
  config: AnomalyDetectorConfig,
  detectedAt: Date,
  idGenerator: () => string,
): AnomalyEvent[] {
  const events: AnomalyEvent[] = [];

  // Check total
  if (checkThreshold(input.totalCount, config.thresholds.total)) {
    events.push(
      buildThresholdEvent(
        'total',
        input.totalCount,
        config.thresholds.total,
        detectedAt,
        idGenerator(),
      ),
    );
  }

  // Check each category
  for (const [category, count] of Object.entries(input.byCategory)) {
    const categoryThreshold = config.thresholds.byCategory[category];
    if (categoryThreshold !== undefined && checkThreshold(count, categoryThreshold)) {
      events.push(
        buildThresholdEvent(
          category,
          count,
          categoryThreshold,
          detectedAt,
          idGenerator(),
        ),
      );
    }
  }

  return events;
}

function buildThresholdEvent(
  metric: string,
  currentValue: number,
  threshold: number,
  detectedAt: Date,
  id: string,
): AnomalyEvent {
  const deviation = currentValue - threshold;
  const severity: AnomalyEvent['severity'] =
    currentValue >= threshold * 2 ? 'critical' : 'warning';

  return {
    id,
    detectedAt,
    type: 'threshold',
    metric,
    currentValue,
    thresholdOrBaseline: threshold,
    deviation,
    severity,
  };
}

/**
 * Unified anomaly detection (Requirements 7.3, 7.5, 8.5, 8.7)
 *
 * Combines threshold and trend detection into a single `detect` function.
 * Pure: takes data as input, does not perform DB queries.
 */

import type { AnomalyEvent, AnomalyDetectorConfig } from '@/types/anomaly';
import { detectThresholdAnomalies, type ThresholdInput } from './threshold-detector';
import { detectTrendAnomalies, type TrendInput } from './trend-detector';

export interface DetectInput {
  /** Threshold detection input */
  threshold: ThresholdInput;
  /** Trend detection input */
  trend: TrendInput;
}

/**
 * Default configuration when none is provided.
 */
export const DEFAULT_ANOMALY_CONFIG: AnomalyDetectorConfig = {
  thresholds: {
    total: 100,
    byCategory: {},
  },
  trendConfig: {
    movingAverageDays: 14,
    sigmaMultiplier: 2.0,
    enableDayOfWeekSeasonality: true,
  },
};

/**
 * Run both threshold and trend anomaly detection, returning
 * a combined list of AnomalyEvent objects.
 *
 * @param input - Data for both detection methods
 * @param config - Detection configuration (thresholds + trend params)
 * @param detectedAt - Timestamp for generated events
 * @param idGenerator - Function to produce unique IDs
 */
export function detect(
  input: DetectInput,
  config: AnomalyDetectorConfig = DEFAULT_ANOMALY_CONFIG,
  detectedAt: Date = new Date(),
  idGenerator: () => string = () => crypto.randomUUID(),
): AnomalyEvent[] {
  const thresholdEvents = detectThresholdAnomalies(
    input.threshold,
    config,
    detectedAt,
    idGenerator,
  );

  const trendEvents = detectTrendAnomalies(
    input.trend,
    config,
    detectedAt,
    idGenerator,
  );

  return [...thresholdEvents, ...trendEvents];
}

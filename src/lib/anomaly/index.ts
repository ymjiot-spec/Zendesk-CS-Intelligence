// Anomaly detection module

// Threshold-based detection (Requirements 7.1–7.4)
export { checkThreshold, detectThresholdAnomalies } from './threshold-detector';
export type { ThresholdInput } from './threshold-detector';

// Trend-based detection (Requirements 8.1–8.6)
export {
  computeMovingAverage,
  computeDayOfWeekAverage,
  computeStandardDeviation,
  checkTrendAnomaly,
  detectTrendAnomalies,
  DEFAULT_TREND_CONFIG,
} from './trend-detector';
export type { DailyValue, TrendInput } from './trend-detector';

// Unified detection (Requirements 7.3, 7.5, 8.5, 8.7)
export { detect, DEFAULT_ANOMALY_CONFIG } from './anomaly-detector';
export type { DetectInput } from './anomaly-detector';

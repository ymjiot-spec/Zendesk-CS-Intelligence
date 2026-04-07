/**
 * Anomaly detection type definitions
 * Used by the AnomalyDetector for threshold and trend-based detection
 */

export interface AnomalyEvent {
  id: string;
  detectedAt: Date;
  type: 'threshold' | 'trend';
  metric: string; // "total" or category name
  currentValue: number;
  thresholdOrBaseline: number;
  deviation: number;
  severity: 'warning' | 'critical';
}

export interface AnomalyDetectorConfig {
  // 閾値方式 (要件7)
  thresholds: {
    total: number;
    byCategory: { [category: string]: number };
  };
  // トレンドベース方式 (要件8)
  trendConfig: TrendConfig;
}

export interface TrendConfig {
  movingAverageDays: number; // デフォルト: 14
  sigmaMultiplier: number; // デフォルト: 2.0
  enableDayOfWeekSeasonality: boolean; // デフォルト: true
}

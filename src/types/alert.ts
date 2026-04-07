/**
 * Alert rule type definitions
 * Used by the AlertRuleEngine for custom alert management
 */

export interface AlertRule {
  id: string;
  name: string;
  triggerType: 'total_surge' | 'category_surge' | 'hourly_surge';
  conditions: AlertCondition[];
  targetCategory?: string; // category_surgeの場合に指定
  notificationChannels: AlertNotificationChannel[];
  cooldownMinutes: number; // 再通知抑制（デフォルト: 60分）
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  method: 'day_over_day_rate' | 'sigma_deviation' | 'fixed_count';
  // day_over_day_rate: 前日比率（例: 150 = 150%以上で発火）
  // sigma_deviation: 移動平均からのσ偏差（例: 2.0）
  // fixed_count: 固定件数超過（例: 100）
  value: number;
}

export interface AlertNotificationChannel {
  channel: 'slack' | 'email' | 'chatwork';
  destination: string;
}

export type AlertPresetType =
  | 'total_surge'
  | 'category_surge'
  | 'anomaly_detection';

export interface AlertFiringRecord {
  id: string;
  alertRuleId: string;
  firedAt: Date;
  detectedValue: number;
  baselineValue: number;
  deviation: number;
  representativeTicketIds: string[];
  status: 'unresolved' | 'in_progress' | 'resolved';
  resolvedAt?: Date;
}

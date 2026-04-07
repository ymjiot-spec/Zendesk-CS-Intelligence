/**
 * Notification type definitions
 * Used by the NotificationDispatcher for multi-channel notifications
 */

export interface TriggerCondition {
  type: 'anomaly' | 'threshold' | 'trend' | 'alert';
  severity?: 'warning' | 'critical';
  metric?: string;
}

export interface NotificationRule {
  id: string;
  channel: 'slack' | 'email' | 'chatwork';
  destination: string; // チャンネルID, メールアドレス, ルームID
  triggerConditions: TriggerCondition[];
  enabled: boolean;
}

export interface NotificationMessage {
  anomalyMetric: string;
  detectedValue: number;
  averageValue: number;
  deviationFromAverage: number;
  topCategories: { category: string; percentage: number }[]; // 上位3項目
  representativeTicketIds: string[]; // 最大5件
  ticketUrls: string[];
  aiAnalysisSummary: string;
}

export interface DispatchResult {
  ruleId: string;
  channel: string;
  success: boolean;
  error?: string;
  retryCount: number;
}

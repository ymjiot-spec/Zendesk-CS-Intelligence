/**
 * Alert Notification Formatter - Requirements 20.6, 20.7
 *
 * Formats alert firing notifications with:
 * - Rule name and conditions
 * - Detected value and baseline diff
 * - Representative tickets (max 5) with Zendesk links
 */

import type { AlertRule, AlertFiringRecord } from '@/types/alert';
import { generateTicketUrl } from '@/lib/notification/message-formatter';

export interface AlertNotificationMessage {
  ruleName: string;
  conditions: string;
  detectedValue: number;
  baselineValue: number;
  deviation: number;
  representativeTicketIds: string[];
  ticketUrls: string[];
}

/**
 * Format condition descriptions for display
 */
function formatConditions(rule: AlertRule): string {
  return rule.conditions
    .map((c) => {
      switch (c.method) {
        case 'day_over_day_rate':
          return `前日比 ${c.value}% 以上`;
        case 'sigma_deviation':
          return `移動平均から ${c.value}σ 以上乖離`;
        case 'fixed_count':
          return `${c.value} 件以上`;
      }
    })
    .join(' かつ ');
}

/**
 * Format an alert firing into a notification message (Req 20.6, 20.7)
 */
export function formatAlertNotification(
  rule: AlertRule,
  firing: AlertFiringRecord,
  zendeskSubdomain: string,
): AlertNotificationMessage {
  const ticketIds = firing.representativeTicketIds.slice(0, 5);
  const ticketUrls = ticketIds.map((id) =>
    generateTicketUrl(zendeskSubdomain, id),
  );

  return {
    ruleName: rule.name,
    conditions: formatConditions(rule),
    detectedValue: firing.detectedValue,
    baselineValue: firing.baselineValue,
    deviation: firing.deviation,
    representativeTicketIds: ticketIds,
    ticketUrls,
  };
}

/**
 * Format alert notification as plain text
 */
export function formatAlertPlainText(
  message: AlertNotificationMessage,
): string {
  const diff = message.detectedValue - message.baselineValue;
  const lines: string[] = [
    `🚨 アラート発火: ${message.ruleName}`,
    `条件: ${message.conditions}`,
    `検知値: ${message.detectedValue} / 基準値: ${message.baselineValue} (差分: ${diff > 0 ? '+' : ''}${diff})`,
    '',
    '代表チケット:',
    ...message.representativeTicketIds.map(
      (id, i) => `  - ${id}: ${message.ticketUrls[i] ?? ''}`,
    ),
  ];

  return lines.join('\n');
}

/**
 * Notification Message Formatter - Requirements 9.4-9.9, 21.8
 *
 * Formats notification messages with:
 * - Anomaly metric, detected value, average, deviation
 * - Top 3 categories with percentages
 * - Representative ticket IDs (max 5) with Zendesk URLs
 * - AI analysis summary
 * - Top 3 action suggestions
 */

import type { NotificationMessage } from '@/types/notification';
import type { AnomalyEvent } from '@/types/anomaly';
import type { AIAnalysisResult, ActionSuggestion } from '@/types/ai';

export interface FormatNotificationInput {
  anomalyEvent: AnomalyEvent;
  analysis: AIAnalysisResult;
  actionSuggestions?: ActionSuggestion[];
  zendeskSubdomain: string;
}

/**
 * Generate a Zendesk ticket URL (Req 9.8)
 */
export function generateTicketUrl(
  subdomain: string,
  ticketId: string,
): string {
  return `https://${subdomain}.zendesk.com/agent/tickets/${ticketId}`;
}

/**
 * Format a notification message from anomaly event + AI analysis (Req 9.4-9.9, 21.8)
 */
export function formatNotificationMessage(
  input: FormatNotificationInput,
): NotificationMessage {
  const { anomalyEvent, analysis, actionSuggestions, zendeskSubdomain } = input;

  // Top 3 categories with percentages (Req 9.6)
  const topCategories = analysis.categoryBreakdown
    .slice(0, 3)
    .map((c) => ({ category: c.category, percentage: c.percentage }));

  // Representative ticket IDs - max 5 (Req 9.7)
  const representativeTicketIds = analysis.representativeTicketIds.slice(0, 5);

  // Zendesk ticket URLs (Req 9.8)
  const ticketUrls = representativeTicketIds.map((id) =>
    generateTicketUrl(zendeskSubdomain, id),
  );

  // AI analysis summary (Req 9.9)
  const aiAnalysisSummary = buildAiSummary(analysis, actionSuggestions);

  return {
    anomalyMetric: anomalyEvent.metric,
    detectedValue: anomalyEvent.currentValue,
    averageValue: anomalyEvent.thresholdOrBaseline,
    deviationFromAverage: anomalyEvent.deviation,
    topCategories,
    representativeTicketIds,
    ticketUrls,
    aiAnalysisSummary,
  };
}

/**
 * Build AI summary text including hypotheses and top 3 action suggestions (Req 9.9, 21.8)
 */
function buildAiSummary(
  analysis: AIAnalysisResult,
  actionSuggestions?: ActionSuggestion[],
): string {
  const parts: string[] = [];

  // Common patterns
  if (analysis.commonPatterns) {
    parts.push(analysis.commonPatterns);
  }

  // Hypotheses
  if (analysis.hypotheses.length > 0) {
    const hypothesesText = analysis.hypotheses
      .map(
        (h) =>
          `${h.rank}. ${h.description} (信頼度: ${h.confidence})`,
      )
      .join('\n');
    parts.push(`推定原因:\n${hypothesesText}`);
  }

  // Top 3 action suggestions (Req 21.8)
  if (actionSuggestions && actionSuggestions.length > 0) {
    const top3 = actionSuggestions.slice(0, 3);
    const actionsText = top3
      .map(
        (a) =>
          `- [${a.priority}] ${a.title}: ${a.description}`,
      )
      .join('\n');
    parts.push(`推奨アクション:\n${actionsText}`);
  }

  return parts.join('\n\n');
}

/**
 * Format a plain-text notification body for Slack/Email/Chatwork
 */
export function formatPlainTextMessage(
  message: NotificationMessage,
): string {
  const lines: string[] = [
    `⚠️ 異常検知: ${message.anomalyMetric}`,
    `検知値: ${message.detectedValue} / 平均値: ${message.averageValue} (差分: ${message.deviationFromAverage > 0 ? '+' : ''}${message.deviationFromAverage})`,
    '',
    '上位カテゴリ:',
    ...message.topCategories.map(
      (c) => `  - ${c.category}: ${c.percentage}%`,
    ),
    '',
    '代表チケット:',
    ...message.representativeTicketIds.map(
      (id, i) => `  - ${id}: ${message.ticketUrls[i] ?? ''}`,
    ),
    '',
    message.aiAnalysisSummary,
  ];

  return lines.join('\n');
}

/**
 * Event Suggestion - Requirement 14
 * Suggests event registration when anomalies are detected
 * but no events are registered in the anomaly period.
 */
import type { AnomalyEvent } from '@/types/anomaly';
import type { EventSuggestion } from '@/types/ai';
import type { EventLog, EventType } from '@/types/event';
import type { FilteredTicket } from '@/types/ticket';
import type { LLMClient } from './llm-client';

export interface EventSuggestionDeps {
  llmClient: LLMClient;
  getEventsInPeriod: (start: Date, end: Date) => Promise<EventLog[]>;
  getTicketsForPeriod: (start: Date, end: Date) => Promise<FilteredTicket[]>;
  getIgnoredSuggestions: () => Promise<Set<string>>;
}

/** Map keywords to EventType candidates */
export function inferEventType(
  tickets: FilteredTicket[],
): EventType {
  const texts = tickets
    .slice(0, 30)
    .map((t) => `${t.subject} ${t.description}`)
    .join(' ')
    .toLowerCase();

  if (texts.includes('障害') || texts.includes('エラー') || texts.includes('停止'))
    return 'incident';
  if (texts.includes('キャンペーン') || texts.includes('割引') || texts.includes('セール'))
    return 'campaign_start';
  if (texts.includes('リリース') || texts.includes('アップデート') || texts.includes('更新'))
    return 'system_release';
  if (texts.includes('メール') || texts.includes('配信'))
    return 'email_delivery';
  if (texts.includes('料金') || texts.includes('価格') || texts.includes('値上'))
    return 'pricing_change';
  if (texts.includes('規約') || texts.includes('利用条件'))
    return 'terms_change';
  return 'other';
}

/**
 * Suggest event registration (Req 14.1-14.5)
 * - Only suggest when no registered events exist in the anomaly period
 * - Suggest Event_Type candidate
 * - Suppress re-suggestion when "ignored"
 */
export async function suggestEventRegistration(
  anomalyEvent: AnomalyEvent,
  deps: EventSuggestionDeps,
): Promise<EventSuggestion | null> {
  const detectedDate = new Date(anomalyEvent.detectedAt);

  // Check for ignored suggestions (Req 14.5)
  const ignoredSet = await deps.getIgnoredSuggestions();
  if (ignoredSet.has(anomalyEvent.id)) {
    return null;
  }

  // Check if events exist in the anomaly period (Req 14.1)
  const periodStart = new Date(detectedDate);
  periodStart.setDate(periodStart.getDate() - 1);
  const periodEnd = new Date(detectedDate);
  periodEnd.setDate(periodEnd.getDate() + 1);
  periodEnd.setHours(23, 59, 59, 999);

  const existingEvents = await deps.getEventsInPeriod(periodStart, periodEnd);
  if (existingEvents.length > 0) {
    return null; // Events already registered, no suggestion needed
  }

  // Get tickets to infer event type (Req 14.2)
  const dayStart = new Date(detectedDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(detectedDate);
  dayEnd.setHours(23, 59, 59, 999);

  const tickets = await deps.getTicketsForPeriod(dayStart, dayEnd);
  const suggestedEventType = inferEventType(tickets);

  // Use LLM for reason generation
  let reason: string;
  try {
    const prompt = `異常検知: ${anomalyEvent.metric}が${anomalyEvent.currentValue}件（基準値${anomalyEvent.thresholdOrBaseline}）。
該当期間にイベント登録がありません。推定イベント種別: ${suggestedEventType}。
この異常の原因として考えられるイベントを1-2文で簡潔に説明してください。`;
    reason = await deps.llmClient.analyze(prompt, 15_000);
  } catch {
    reason = `${anomalyEvent.metric}で異常が検知されました（${anomalyEvent.currentValue}件、基準値${anomalyEvent.thresholdOrBaseline}）。イベント登録を推奨します。`;
  }

  return {
    suggestedEventType,
    suggestedDate: detectedDate,
    reason,
    analysisSnippet: `${anomalyEvent.metric}: ${anomalyEvent.currentValue}件 (基準値: ${anomalyEvent.thresholdOrBaseline}, 乖離: ${anomalyEvent.deviation})`,
  };
}

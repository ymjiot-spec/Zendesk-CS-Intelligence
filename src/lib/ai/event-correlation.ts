/**
 * Event Correlation Analyzer - Requirement 15
 * Identifies which Inquiry_Categories increased after an event
 * and computes increase count/rate.
 */
import type { EventLog } from '@/types/event';
import type { FilteredTicket } from '@/types/ticket';

export interface EventCategoryCorrelation {
  eventId: string;
  eventName: string;
  correlations: CategoryCorrelation[];
  summary: string;
}

export interface CategoryCorrelation {
  category: string;
  preEventCount: number;
  postEventCount: number;
  increaseCount: number;
  increaseRate: number;
}

export interface EventCorrelationDeps {
  getEventById: (eventId: string) => Promise<EventLog | null>;
  getTicketsForPeriod: (start: Date, end: Date) => Promise<FilteredTicket[]>;
}

/** Compute category counts from tickets */
function countByCategory(tickets: FilteredTicket[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    counts[t.inquiryCategory] = (counts[t.inquiryCategory] ?? 0) + 1;
  }
  return counts;
}

/** Compute correlations between pre and post event ticket categories */
export function computeCorrelations(
  preTickets: FilteredTicket[],
  postTickets: FilteredTicket[],
): CategoryCorrelation[] {
  const preCounts = countByCategory(preTickets);
  const postCounts = countByCategory(postTickets);

  const allCategories = new Set([
    ...Object.keys(preCounts),
    ...Object.keys(postCounts),
  ]);

  const correlations: CategoryCorrelation[] = [];

  for (const category of allCategories) {
    const preCount = preCounts[category] ?? 0;
    const postCount = postCounts[category] ?? 0;
    const increaseCount = postCount - preCount;
    const increaseRate =
      preCount > 0
        ? ((postCount - preCount) / preCount) * 100
        : postCount > 0
          ? 100
          : 0;

    correlations.push({
      category,
      preEventCount: preCount,
      postEventCount: postCount,
      increaseCount,
      increaseRate: Math.round(increaseRate * 100) / 100,
    });
  }

  // Sort by increase rate descending
  return correlations.sort((a, b) => b.increaseRate - a.increaseRate);
}

/** Format correlation as "Event X → Category Y increased Z%" (Req 15.2) */
export function formatCorrelationSummary(
  eventName: string,
  correlations: CategoryCorrelation[],
): string {
  const increased = correlations.filter((c) => c.increaseCount > 0);
  if (increased.length === 0) {
    return `イベント「${eventName}」後に顕著な増加カテゴリはありませんでした`;
  }

  return increased
    .map(
      (c) =>
        `イベント「${eventName}」→ ${c.category} が ${c.increaseRate}% 増加（+${c.increaseCount}件）`,
    )
    .join('\n');
}

/**
 * Analyze event correlation (Req 15.1, 15.2, 15.6)
 * - Identify increased Inquiry_Categories after event
 * - Compute increase count/rate
 * - Output: "Event X → Category Y increased Z%"
 * - When no events: "該当期間に登録済みイベントなし"
 */
export async function analyzeEventCorrelation(
  eventId: string,
  deps: EventCorrelationDeps,
): Promise<EventCategoryCorrelation> {
  const event = await deps.getEventById(eventId);

  // No event found (Req 15.6)
  if (!event) {
    return {
      eventId,
      eventName: '',
      correlations: [],
      summary: '該当期間に登録済みイベントなし',
    };
  }

  const eventDate = new Date(event.occurredAt);

  // Pre-event: 3 days before
  const preStart = new Date(eventDate);
  preStart.setDate(preStart.getDate() - 3);
  const preEnd = new Date(eventDate);
  preEnd.setMilliseconds(-1);

  // Post-event: 3 days after
  const postStart = new Date(eventDate);
  postStart.setDate(postStart.getDate() + 1);
  const postEnd = new Date(eventDate);
  postEnd.setDate(postEnd.getDate() + 3);
  postEnd.setHours(23, 59, 59, 999);

  const [preTickets, postTickets] = await Promise.all([
    deps.getTicketsForPeriod(preStart, preEnd),
    deps.getTicketsForPeriod(postStart, postEnd),
  ]);

  const correlations = computeCorrelations(preTickets, postTickets);
  const summary = formatCorrelationSummary(event.name, correlations);

  return {
    eventId: event.id,
    eventName: event.name,
    correlations,
    summary,
  };
}

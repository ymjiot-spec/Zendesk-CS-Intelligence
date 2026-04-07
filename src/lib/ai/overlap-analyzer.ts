/**
 * Overlap Analyzer - Requirement 13
 * Detects events with overlapping 3-day windows and computes
 * individual impact scores and relative contributions.
 */
import type { OverlapAnalysisResult } from '@/types/ai';
import type { EventLog } from '@/types/event';
import type { ImpactScoreDeps } from './impact-score';
import { computeImpactScore } from './impact-score';

export interface OverlapAnalyzerDeps extends ImpactScoreDeps {
  getEventsByIds: (ids: string[]) => Promise<EventLog[]>;
}

/** Check if two events have overlapping 3-day windows (Req 13.1) */
export function hasOverlapping3DayWindow(
  dateA: Date,
  dateB: Date,
): boolean {
  const windowDays = 3;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.abs(dateA.getTime() - dateB.getTime());
  // Two events overlap if their dates are within 6 days (3+3)
  return diff <= windowDays * 2 * msPerDay;
}

/** Find groups of overlapping events from a list */
export function findOverlappingGroups(
  events: EventLog[],
): EventLog[][] {
  if (events.length <= 1) return events.length === 1 ? [events] : [];

  const sorted = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  const groups: EventLog[][] = [];
  let currentGroup: EventLog[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const lastInGroup = currentGroup[currentGroup.length - 1];
    if (hasOverlapping3DayWindow(lastInGroup.occurredAt, sorted[i].occurredAt)) {
      currentGroup.push(sorted[i]);
    } else {
      if (currentGroup.length > 1) groups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }
  if (currentGroup.length > 1) groups.push(currentGroup);

  return groups;
}

/** Compute relative contributions that sum to ~100% */
export function computeRelativeContributions(
  scores: { eventId: string; score: number }[],
): { eventId: string; relativeContribution: number }[] {
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  if (totalScore === 0) {
    const equal = scores.length > 0 ? 100 / scores.length : 0;
    return scores.map((s) => ({
      eventId: s.eventId,
      relativeContribution: Math.round(equal * 100) / 100,
    }));
  }

  return scores.map((s) => ({
    eventId: s.eventId,
    relativeContribution:
      Math.round((s.score / totalScore) * 100 * 100) / 100,
  }));
}

/**
 * Analyze overlapping events (Req 13.1-13.3, 13.5)
 * - Detect events with overlapping 3-day windows
 * - Compute individual impact scores
 * - Compute relative contributions (sum ≈ 100%)
 * - Rank by contribution
 */
export async function analyzeOverlappingEvents(
  eventIds: string[],
  deps: OverlapAnalyzerDeps,
): Promise<OverlapAnalysisResult> {
  const events = await deps.getEventsByIds(eventIds);

  if (events.length === 0) {
    return {
      period: { start: new Date(), end: new Date() },
      events: [],
      ranking: [],
      summary: '分析対象のイベントが見つかりませんでした',
    };
  }

  // Compute individual impact scores
  const impactResults = await Promise.all(
    events.map((e) => computeImpactScore(e.id, e.occurredAt, deps)),
  );

  const scores = impactResults.map((r) => ({
    eventId: r.eventId,
    score: r.impactScore,
  }));

  const contributions = computeRelativeContributions(scores);

  // Build result sorted by contribution (descending)
  const eventResults = events
    .map((e) => {
      const impact = impactResults.find((r) => r.eventId === e.id);
      const contrib = contributions.find((c) => c.eventId === e.id);
      return {
        eventId: e.id,
        eventName: e.name,
        individualImpactScore: impact?.impactScore ?? 0,
        relativeContribution: contrib?.relativeContribution ?? 0,
      };
    })
    .sort((a, b) => b.relativeContribution - a.relativeContribution);

  const dates = events.map((e) => e.occurredAt.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const periodStart = new Date(minDate);
  periodStart.setDate(periodStart.getDate() - 3);
  const periodEnd = new Date(maxDate);
  periodEnd.setDate(periodEnd.getDate() + 3);

  const ranking = eventResults.map((e) => e.eventId);

  const summaryParts = eventResults.map(
    (e) => `${e.eventName}: 寄与度${e.relativeContribution}%`,
  );

  return {
    period: { start: periodStart, end: periodEnd },
    events: eventResults,
    ranking,
    summary: summaryParts.join('、'),
  };
}

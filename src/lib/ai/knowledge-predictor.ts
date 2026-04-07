/**
 * Knowledge Predictor - Requirement 18
 * Searches past events by same Event_Type or similar tags
 * to predict ticket increase and affected categories.
 */
import type { ImpactPrediction } from '@/types/ai';
import type { EventLog, EventType } from '@/types/event';

export interface KnowledgePredictorDeps {
  getEventsByType: (eventType: EventType) => Promise<EventLog[]>;
  getEventsByTags: (tags: string[]) => Promise<EventLog[]>;
  getImpactScore: (eventId: string) => Promise<number>;
  getCategoryImpact: (
    eventId: string,
  ) => Promise<{ category: string; increaseRate: number }[]>;
}

/** Find similar past events by type and tags (Req 18.2) */
export async function findSimilarEvents(
  eventType: EventType,
  tags: string[],
  deps: KnowledgePredictorDeps,
): Promise<EventLog[]> {
  const [byType, byTags] = await Promise.all([
    deps.getEventsByType(eventType),
    tags.length > 0 ? deps.getEventsByTags(tags) : Promise.resolve([]),
  ]);

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged: EventLog[] = [];
  for (const event of [...byType, ...byTags]) {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      merged.push(event);
    }
  }

  // Sort by date descending (most recent first)
  return merged.sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  );
}

/** Determine confidence level based on similar event count (Req 18.7) */
export function determineConfidence(
  similarEventCount: number,
): { level: ImpactPrediction['confidenceLevel']; reason: string } {
  if (similarEventCount < 2) {
    return {
      level: 'low',
      reason: `同種イベントが${similarEventCount}件のみのため、予測の信頼度が低い状態です。参考情報としてご利用ください。`,
    };
  }
  if (similarEventCount < 5) {
    return {
      level: 'medium',
      reason: `同種イベント${similarEventCount}件のデータに基づく予測です。`,
    };
  }
  return {
    level: 'high',
    reason: `同種イベント${similarEventCount}件の豊富なデータに基づく予測です。`,
  };
}

/**
 * Predict impact of an event based on past similar events (Req 18.1-18.4, 18.7)
 * - Search past events by same Event_Type or similar tags
 * - Predict ticket increase and affected categories
 * - Confidence 'low' when < 2 similar events
 */
export async function predictImpact(
  eventType: EventType,
  eventTags: string[],
  deps: KnowledgePredictorDeps,
): Promise<ImpactPrediction> {
  const similarEvents = await findSimilarEvents(eventType, eventTags, deps);

  if (similarEvents.length === 0) {
    const { level, reason } = determineConfidence(0);
    return {
      predictedIncreasePercent: 0,
      affectedCategories: [],
      pastSimilarEvents: [],
      confidenceLevel: level,
      confidenceReason: reason,
    };
  }

  // Gather impact scores and category impacts for similar events
  const eventData = await Promise.all(
    similarEvents.map(async (e) => {
      const [impactScore, categoryImpact] = await Promise.all([
        deps.getImpactScore(e.id),
        deps.getCategoryImpact(e.id),
      ]);
      return { event: e, impactScore, categoryImpact };
    }),
  );

  // Compute average predicted increase (Req 18.3)
  const avgImpactScore =
    eventData.reduce((sum, d) => sum + d.impactScore, 0) / eventData.length;

  // Aggregate category impacts across similar events
  const categoryAgg: Record<string, { totalIncrease: number; count: number }> =
    {};
  for (const d of eventData) {
    for (const ci of d.categoryImpact) {
      if (!categoryAgg[ci.category]) {
        categoryAgg[ci.category] = { totalIncrease: 0, count: 0 };
      }
      categoryAgg[ci.category].totalIncrease += ci.increaseRate;
      categoryAgg[ci.category].count += 1;
    }
  }

  const affectedCategories = Object.entries(categoryAgg)
    .map(([category, data]) => ({
      category,
      predictedIncrease: Math.round((data.totalIncrease / data.count) * 100) / 100,
    }))
    .sort((a, b) => b.predictedIncrease - a.predictedIncrease);

  // Build past similar events list (Req 18.4)
  const pastSimilarEvents = eventData.map((d) => ({
    eventId: d.event.id,
    eventName: d.event.name,
    impactScore: d.impactScore,
    memo: d.event.memo ?? '',
  }));

  const { level, reason } = determineConfidence(similarEvents.length);

  return {
    predictedIncreasePercent: Math.round(avgImpactScore * 100) / 100,
    affectedCategories,
    pastSimilarEvents,
    confidenceLevel: level,
    confidenceReason: reason,
  };
}

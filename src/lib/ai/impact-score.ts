/**
 * Impact Score Calculator - Requirement 12
 * Computes Impact_Score (0-100) for events based on
 * pre-event vs post-event ticket count changes.
 */
import type { ImpactScoreResult } from '@/types/ai';

export interface DailyTicketData {
  date: Date;
  totalCount: number;
  byCategory: Record<string, number>;
}

export interface ImpactScoreDeps {
  getDailyTicketData: (start: Date, end: Date) => Promise<DailyTicketData[]>;
}

/** Compute average of daily counts */
export function computeAverage(data: DailyTicketData[]): number {
  if (data.length === 0) return 0;
  const sum = data.reduce((acc, d) => acc + d.totalCount, 0);
  return sum / data.length;
}

/** Compute change rate between pre and post averages */
export function computeChangeRate(preAvg: number, postAvg: number): number {
  if (preAvg === 0) return postAvg > 0 ? 100 : 0;
  return ((postAvg - preAvg) / preAvg) * 100;
}

/** Compute category-level contributions to the overall change */
export function computeCategoryContributions(
  preData: DailyTicketData[],
  postData: DailyTicketData[],
): { category: string; contribution: number }[] {
  const preAvgByCategory: Record<string, number> = {};
  const postAvgByCategory: Record<string, number> = {};
  const allCategories = new Set<string>();

  for (const d of preData) {
    for (const [cat, count] of Object.entries(d.byCategory)) {
      allCategories.add(cat);
      preAvgByCategory[cat] = (preAvgByCategory[cat] ?? 0) + count;
    }
  }
  for (const d of postData) {
    for (const [cat, count] of Object.entries(d.byCategory)) {
      allCategories.add(cat);
      postAvgByCategory[cat] = (postAvgByCategory[cat] ?? 0) + count;
    }
  }

  const preDays = preData.length || 1;
  const postDays = postData.length || 1;

  const contributions: { category: string; rawChange: number }[] = [];
  let totalAbsChange = 0;

  for (const cat of allCategories) {
    const preAvg = (preAvgByCategory[cat] ?? 0) / preDays;
    const postAvg = (postAvgByCategory[cat] ?? 0) / postDays;
    const rawChange = postAvg - preAvg;
    contributions.push({ category: cat, rawChange });
    totalAbsChange += Math.abs(rawChange);
  }

  return contributions.map(({ category, rawChange }) => ({
    category,
    contribution:
      totalAbsChange > 0
        ? Math.round((Math.abs(rawChange) / totalAbsChange) * 100 * 100) / 100
        : 0,
  }));
}

/** Clamp a value to [0, 100] */
export function clamp0to100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Compute Impact Score for an event (Req 12.1-12.3)
 * - Pre-event 3-day avg vs post-event 3-day avg change rate
 * - Factor in category contributions
 * - Clamp to 0-100
 */
export async function computeImpactScore(
  eventId: string,
  eventDate: Date,
  deps: ImpactScoreDeps,
): Promise<ImpactScoreResult> {
  const preStart = new Date(eventDate);
  preStart.setDate(preStart.getDate() - 3);
  const preEnd = new Date(eventDate);
  preEnd.setMilliseconds(-1);

  const postStart = new Date(eventDate);
  postStart.setDate(postStart.getDate() + 1);
  const postEnd = new Date(eventDate);
  postEnd.setDate(postEnd.getDate() + 3);
  postEnd.setHours(23, 59, 59, 999);

  const [preData, postData] = await Promise.all([
    deps.getDailyTicketData(preStart, preEnd),
    deps.getDailyTicketData(postStart, postEnd),
  ]);

  const preEventAvg = computeAverage(preData);
  const postEventAvg = computeAverage(postData);
  const changeRate = computeChangeRate(preEventAvg, postEventAvg);
  const categoryContributions = computeCategoryContributions(preData, postData);

  // Impact score: absolute change rate, clamped to 0-100
  const impactScore = clamp0to100(Math.round(Math.abs(changeRate)));

  return {
    eventId,
    impactScore,
    preEventAvg: Math.round(preEventAvg * 100) / 100,
    postEventAvg: Math.round(postEventAvg * 100) / 100,
    changeRate: Math.round(changeRate * 100) / 100,
    categoryContributions,
  };
}

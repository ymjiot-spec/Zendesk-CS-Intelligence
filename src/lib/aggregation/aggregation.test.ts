import { describe, it, expect } from 'vitest';
import { computeDailySummary, classifyTrend } from './daily-summary';
import { computeCategoryBreakdown } from './category-breakdown';
import { computeMatrix } from './matrix';
import { computeHourlyDistribution, computeHeatmap } from './hourly';
import {
  resolveDateRange,
  DEFAULT_QUICK_SELECT,
  type QuickSelect,
} from './date-range-resolver';
import type { FilteredTicket } from '@/types/ticket';

// ─── Helpers ───────────────────────────────────────────────

function makeTicket(
  overrides: Partial<FilteredTicket> & { createdAt: Date },
): FilteredTicket {
  return {
    id: Math.random().toString(36).slice(2),
    zendeskTicketId: Math.random().toString(36).slice(2),
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    inquiryCategory: overrides.inquiryCategory ?? 'general',
    ticketStatus: overrides.ticketStatus ?? 'open',
    subject: overrides.subject ?? 'test',
    description: overrides.description ?? '',
    isExcluded: overrides.isExcluded ?? false,
  };
}

function makeDate(y: number, m: number, d: number, h = 0): Date {
  return new Date(y, m - 1, d, h, 0, 0, 0);
}

// ─── Task 4.1: Daily Summary ──────────────────────────────

describe('computeDailySummary', () => {
  it('computes total count for the target date', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
      makeTicket({ createdAt: makeDate(2024, 1, 14) }),
    ];
    const result = computeDailySummary(tickets, makeDate(2024, 1, 15));
    expect(result.totalCount).toBe(2);
    expect(result.previousDayCount).toBe(1);
  });

  it('computes day-over-day diff and rate', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
      makeTicket({ createdAt: makeDate(2024, 1, 14) }),
      makeTicket({ createdAt: makeDate(2024, 1, 14) }),
    ];
    const result = computeDailySummary(tickets, makeDate(2024, 1, 15));
    expect(result.dayOverDayDiff).toBe(1); // 3 - 2
    expect(result.dayOverDayRate).toBe(50); // (3-2)/2 * 100
    expect(result.trend).toBe('increase');
  });

  it('handles zero previous day count (no division by zero)', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
    ];
    const result = computeDailySummary(tickets, makeDate(2024, 1, 15));
    expect(result.dayOverDayDiff).toBe(1);
    expect(result.dayOverDayRate).toBe(0);
  });

  it('computes 7-day and 30-day averages', () => {
    // 7 tickets, one per day for 7 days
    const tickets: FilteredTicket[] = [];
    for (let i = 0; i < 7; i++) {
      tickets.push(makeTicket({ createdAt: makeDate(2024, 1, 15 - i) }));
    }
    const result = computeDailySummary(tickets, makeDate(2024, 1, 15));
    expect(result.avg7Days).toBe(1); // 7 tickets / 7 days
  });

  it('classifies trend as decrease when diff is negative', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 14) }),
      makeTicket({ createdAt: makeDate(2024, 1, 14) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
    ];
    const result = computeDailySummary(tickets, makeDate(2024, 1, 15));
    expect(result.trend).toBe('decrease');
  });

  it('classifies trend as flat when diff is zero', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 14) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
    ];
    const result = computeDailySummary(tickets, makeDate(2024, 1, 15));
    expect(result.trend).toBe('flat');
  });

  it('excludes tickets with isExcluded=true', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15), isExcluded: true }),
      makeTicket({ createdAt: makeDate(2024, 1, 15) }),
    ];
    const result = computeDailySummary(tickets, makeDate(2024, 1, 15));
    expect(result.totalCount).toBe(1);
  });
});

describe('classifyTrend', () => {
  it('returns increase for positive values', () => {
    expect(classifyTrend(5)).toBe('increase');
    expect(classifyTrend(0.1)).toBe('increase');
  });
  it('returns decrease for negative values', () => {
    expect(classifyTrend(-3)).toBe('decrease');
    expect(classifyTrend(-0.01)).toBe('decrease');
  });
  it('returns flat for zero', () => {
    expect(classifyTrend(0)).toBe('flat');
  });
});


// ─── Task 4.3: Category Breakdown ─────────────────────────

describe('computeCategoryBreakdown', () => {
  it('computes per-category counts and percentages', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'tech' }),
    ];
    const result = computeCategoryBreakdown(tickets, makeDate(2024, 1, 15));
    expect(result).toHaveLength(2);
    const billing = result.find((r) => r.category === 'billing')!;
    expect(billing.count).toBe(2);
    expect(billing.percentage).toBeCloseTo(66.67, 1);
    const tech = result.find((r) => r.category === 'tech')!;
    expect(tech.count).toBe(1);
    expect(tech.percentage).toBeCloseTo(33.33, 1);
  });

  it('sorts by count descending and assigns ranks', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'a' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'b' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'b' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'c' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'c' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'c' }),
    ];
    const result = computeCategoryBreakdown(tickets, makeDate(2024, 1, 15));
    expect(result[0].category).toBe('c');
    expect(result[0].rank).toBe(1);
    expect(result[1].category).toBe('b');
    expect(result[1].rank).toBe(2);
    expect(result[2].category).toBe('a');
    expect(result[2].rank).toBe(3);
  });

  it('aggregates to top 5 + "その他" when > 6 categories', () => {
    const cats = ['cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat6', 'cat7'];
    const tickets: FilteredTicket[] = [];
    // Give each category a different count so ranking is deterministic
    cats.forEach((cat, i) => {
      for (let j = 0; j < (cats.length - i) * 2; j++) {
        tickets.push(makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: cat }));
      }
    });
    const result = computeCategoryBreakdown(tickets, makeDate(2024, 1, 15));
    expect(result).toHaveLength(6);
    expect(result[5].category).toBe('その他');
    // "その他" should contain cat6 + cat7 counts
    const cat6Count = 4; // (7-5)*2
    const cat7Count = 2; // (7-6)*2
    expect(result[5].count).toBe(cat6Count + cat7Count);
  });

  it('does not aggregate when <= 6 categories', () => {
    const cats = ['a', 'b', 'c', 'd', 'e', 'f'];
    const tickets = cats.map((cat) =>
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: cat }),
    );
    const result = computeCategoryBreakdown(tickets, makeDate(2024, 1, 15));
    expect(result).toHaveLength(6);
    expect(result.find((r) => r.category === 'その他')).toBeUndefined();
  });

  it('computes previous day diff', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 14), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 14), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'billing' }),
    ];
    const result = computeCategoryBreakdown(tickets, makeDate(2024, 1, 15));
    const billing = result.find((r) => r.category === 'billing')!;
    expect(billing.previousDayDiff).toBe(-1); // 1 - 2
    expect(billing.trend).toBe('decrease');
  });

  it('computes previous week same day diff', () => {
    const tickets = [
      // Monday Jan 8 (7 days before Jan 15)
      makeTicket({ createdAt: makeDate(2024, 1, 8), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 8), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 8), inquiryCategory: 'billing' }),
      // Monday Jan 15
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'billing' }),
    ];
    const result = computeCategoryBreakdown(tickets, makeDate(2024, 1, 15));
    const billing = result.find((r) => r.category === 'billing')!;
    expect(billing.previousWeekSameDayDiff).toBe(-1); // 2 - 3
  });
});

// ─── Task 4.5: Matrix ─────────────────────────────────────

describe('computeMatrix', () => {
  it('returns one row per date in range', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'a' }),
      makeTicket({ createdAt: makeDate(2024, 1, 16), inquiryCategory: 'a' }),
      makeTicket({ createdAt: makeDate(2024, 1, 17), inquiryCategory: 'a' }),
    ];
    const result = computeMatrix(tickets, makeDate(2024, 1, 15), makeDate(2024, 1, 17));
    expect(result).toHaveLength(3);
  });

  it('sorts rows by date descending (newest first)', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'a' }),
      makeTicket({ createdAt: makeDate(2024, 1, 16), inquiryCategory: 'a' }),
    ];
    const result = computeMatrix(tickets, makeDate(2024, 1, 15), makeDate(2024, 1, 16));
    expect(result[0].date.getDate()).toBe(16);
    expect(result[1].date.getDate()).toBe(15);
  });

  it('computes per-category count, percentage, and diff', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 14), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'billing' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'tech' }),
    ];
    const result = computeMatrix(tickets, makeDate(2024, 1, 15), makeDate(2024, 1, 15));
    const row = result[0];
    expect(row.totalCount).toBe(3);
    expect(row.categories['billing'].count).toBe(2);
    expect(row.categories['billing'].percentage).toBeCloseTo(66.67, 1);
    expect(row.categories['billing'].diff).toBe(1); // 2 - 1 (prev day)
    expect(row.categories['tech'].count).toBe(1);
    expect(row.categories['tech'].diff).toBe(1); // 1 - 0
  });

  it('category counts sum to totalCount for each row', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'a' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'b' }),
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'a' }),
    ];
    const result = computeMatrix(tickets, makeDate(2024, 1, 15), makeDate(2024, 1, 15));
    const row = result[0];
    const catSum = Object.values(row.categories).reduce((s, c) => s + c.count, 0);
    expect(catSum).toBe(row.totalCount);
  });

  it('handles empty date range', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15), inquiryCategory: 'a' }),
    ];
    const result = computeMatrix(tickets, makeDate(2024, 1, 20), makeDate(2024, 1, 22));
    expect(result).toHaveLength(3);
    result.forEach((row) => expect(row.totalCount).toBe(0));
  });
});

// ─── Task 4.7: Hourly & Heatmap ──────────────────────────

describe('computeHourlyDistribution', () => {
  it('returns 24 entries for hours 0-23', () => {
    const result = computeHourlyDistribution([], makeDate(2024, 1, 15), makeDate(2024, 1, 15));
    expect(result).toHaveLength(24);
    result.forEach((entry, i) => {
      expect(entry.hour).toBe(i);
      expect(entry.count).toBe(0);
    });
  });

  it('counts tickets by hour', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15, 9) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15, 9) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15, 14) }),
    ];
    const result = computeHourlyDistribution(tickets, makeDate(2024, 1, 15), makeDate(2024, 1, 15));
    expect(result[9].count).toBe(2);
    expect(result[14].count).toBe(1);
    expect(result[0].count).toBe(0);
  });

  it('hourly counts sum to total tickets in range', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15, 3) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15, 10) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15, 22) }),
    ];
    const result = computeHourlyDistribution(tickets, makeDate(2024, 1, 15), makeDate(2024, 1, 15));
    const total = result.reduce((s, e) => s + e.count, 0);
    expect(total).toBe(3);
  });
});

describe('computeHeatmap', () => {
  it('returns 168 cells (7 days × 24 hours)', () => {
    const result = computeHeatmap([], makeDate(2024, 1, 15), makeDate(2024, 1, 15));
    expect(result.cells).toHaveLength(168);
  });

  it('computes min and max counts', () => {
    // Jan 15, 2024 is a Monday (dayOfWeek=1)
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15, 10) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15, 10) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15, 10) }),
      makeTicket({ createdAt: makeDate(2024, 1, 15, 14) }),
    ];
    const result = computeHeatmap(tickets, makeDate(2024, 1, 15), makeDate(2024, 1, 15));
    expect(result.maxCount).toBe(3);
    expect(result.minCount).toBe(0);
  });

  it('handles empty tickets with min=0 and max=0', () => {
    const result = computeHeatmap([], makeDate(2024, 1, 15), makeDate(2024, 1, 15));
    expect(result.minCount).toBe(0);
    expect(result.maxCount).toBe(0);
  });

  it('cell counts sum to total tickets in range', () => {
    const tickets = [
      makeTicket({ createdAt: makeDate(2024, 1, 15, 5) }),
      makeTicket({ createdAt: makeDate(2024, 1, 16, 12) }),
    ];
    const result = computeHeatmap(tickets, makeDate(2024, 1, 15), makeDate(2024, 1, 16));
    const total = result.cells.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(2);
  });
});

// ─── Task 4.9: Date Range Resolver ────────────────────────

describe('resolveDateRange', () => {
  const ref = makeDate(2024, 1, 17); // Wednesday, Jan 17, 2024

  it('default preset is today', () => {
    expect(DEFAULT_QUICK_SELECT).toBe('today');
  });

  it('today: same day start and end', () => {
    const { startDate, endDate } = resolveDateRange('today', ref);
    expect(startDate.getDate()).toBe(17);
    expect(endDate.getDate()).toBe(17);
    expect(startDate.getHours()).toBe(0);
    expect(endDate.getHours()).toBe(23);
  });

  it('yesterday: day before reference', () => {
    const { startDate, endDate } = resolveDateRange('yesterday', ref);
    expect(startDate.getDate()).toBe(16);
    expect(endDate.getDate()).toBe(16);
  });

  it('this_week: Monday to Sunday of current week', () => {
    const { startDate, endDate } = resolveDateRange('this_week', ref);
    expect(startDate.getDay()).toBe(1); // Monday
    expect(startDate.getDate()).toBe(15);
    expect(endDate.getDay()).toBe(0); // Sunday
    expect(endDate.getDate()).toBe(21);
  });

  it('last_week: Monday to Sunday of previous week', () => {
    const { startDate, endDate } = resolveDateRange('last_week', ref);
    expect(startDate.getDay()).toBe(1); // Monday
    expect(startDate.getDate()).toBe(8);
    expect(endDate.getDay()).toBe(0); // Sunday
    expect(endDate.getDate()).toBe(14);
  });

  it('this_month: 1st to last day of current month', () => {
    const { startDate, endDate } = resolveDateRange('this_month', ref);
    expect(startDate.getDate()).toBe(1);
    expect(startDate.getMonth()).toBe(0); // January
    expect(endDate.getDate()).toBe(31);
    expect(endDate.getMonth()).toBe(0);
  });

  it('last_month: 1st to last day of previous month', () => {
    const { startDate, endDate } = resolveDateRange('last_month', ref);
    expect(startDate.getDate()).toBe(1);
    expect(startDate.getMonth()).toBe(11); // December 2023
    expect(endDate.getDate()).toBe(31);
    expect(endDate.getMonth()).toBe(11);
  });

  it('startDate <= endDate for all presets', () => {
    const presets: QuickSelect[] = [
      'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month',
    ];
    for (const preset of presets) {
      const { startDate, endDate } = resolveDateRange(preset, ref);
      expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
    }
  });

  it('this_week when reference is Sunday', () => {
    const sunday = makeDate(2024, 1, 21); // Sunday
    const { startDate, endDate } = resolveDateRange('this_week', sunday);
    expect(startDate.getDay()).toBe(1); // Monday
    expect(startDate.getDate()).toBe(15);
    expect(endDate.getDay()).toBe(0); // Sunday
    expect(endDate.getDate()).toBe(21);
  });
});

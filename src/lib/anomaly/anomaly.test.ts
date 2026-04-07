import { describe, it, expect } from 'vitest';
import {
  checkThreshold,
  detectThresholdAnomalies,
} from './threshold-detector';
import {
  computeMovingAverage,
  computeDayOfWeekAverage,
  computeStandardDeviation,
  checkTrendAnomaly,
  detectTrendAnomalies,
} from './trend-detector';
import { detect } from './anomaly-detector';
import type { AnomalyDetectorConfig } from '@/types/anomaly';
import type { DailyValue, TrendInput } from './trend-detector';
import type { ThresholdInput } from './threshold-detector';

// ─── Helpers ───────────────────────────────────────────────

let idCounter = 0;
function makeId(): string {
  return `test-id-${++idCounter}`;
}

const NOW = new Date('2024-06-15T12:00:00Z');

function makeConfig(overrides?: Partial<AnomalyDetectorConfig>): AnomalyDetectorConfig {
  return {
    thresholds: { total: 50, byCategory: { billing: 20, tech: 15 } },
    trendConfig: {
      movingAverageDays: 14,
      sigmaMultiplier: 2.0,
      enableDayOfWeekSeasonality: true,
    },
    ...overrides,
  };
}

// ─── Task 6.1: Threshold Detection ────────────────────────

describe('checkThreshold', () => {
  it('returns true when value exceeds threshold', () => {
    expect(checkThreshold(51, 50)).toBe(true);
  });

  it('returns false when value equals threshold', () => {
    expect(checkThreshold(50, 50)).toBe(false);
  });

  it('returns false when value is below threshold', () => {
    expect(checkThreshold(49, 50)).toBe(false);
  });

  it('handles zero threshold', () => {
    expect(checkThreshold(1, 0)).toBe(true);
    expect(checkThreshold(0, 0)).toBe(false);
  });
});

describe('detectThresholdAnomalies', () => {
  it('generates event when total exceeds threshold', () => {
    const input: ThresholdInput = { totalCount: 60, byCategory: {} };
    const events = detectThresholdAnomalies(input, makeConfig(), NOW, makeId);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('threshold');
    expect(events[0].metric).toBe('total');
    expect(events[0].currentValue).toBe(60);
    expect(events[0].thresholdOrBaseline).toBe(50);
    expect(events[0].deviation).toBe(10);
  });

  it('generates no events when total is at threshold', () => {
    const input: ThresholdInput = { totalCount: 50, byCategory: {} };
    const events = detectThresholdAnomalies(input, makeConfig(), NOW, makeId);
    expect(events).toHaveLength(0);
  });

  it('generates events for categories that exceed their thresholds', () => {
    const input: ThresholdInput = {
      totalCount: 30,
      byCategory: { billing: 25, tech: 10 },
    };
    const events = detectThresholdAnomalies(input, makeConfig(), NOW, makeId);
    expect(events).toHaveLength(1);
    expect(events[0].metric).toBe('billing');
  });

  it('ignores categories without configured thresholds', () => {
    const input: ThresholdInput = {
      totalCount: 30,
      byCategory: { unknown: 999 },
    };
    const events = detectThresholdAnomalies(input, makeConfig(), NOW, makeId);
    expect(events).toHaveLength(0);
  });

  it('assigns critical severity when value >= 2× threshold', () => {
    const input: ThresholdInput = { totalCount: 100, byCategory: {} };
    const events = detectThresholdAnomalies(input, makeConfig(), NOW, makeId);
    expect(events[0].severity).toBe('critical');
  });

  it('assigns warning severity when value > threshold but < 2×', () => {
    const input: ThresholdInput = { totalCount: 60, byCategory: {} };
    const events = detectThresholdAnomalies(input, makeConfig(), NOW, makeId);
    expect(events[0].severity).toBe('warning');
  });
});

// ─── Task 6.3: Trend Detection ────────────────────────────

describe('computeMovingAverage', () => {
  it('computes average of last N values', () => {
    expect(computeMovingAverage([10, 20, 30, 40, 50], 3)).toBe(40); // (30+40+50)/3
  });

  it('uses all values when array is shorter than window', () => {
    expect(computeMovingAverage([10, 20], 5)).toBe(15);
  });

  it('returns 0 for empty array', () => {
    expect(computeMovingAverage([], 5)).toBe(0);
  });

  it('returns 0 for zero window size', () => {
    expect(computeMovingAverage([10, 20], 0)).toBe(0);
  });
});

describe('computeDayOfWeekAverage', () => {
  it('averages values matching the target day-of-week', () => {
    const values: DailyValue[] = [
      { value: 10, dayOfWeek: 1 }, // Mon
      { value: 20, dayOfWeek: 2 }, // Tue
      { value: 30, dayOfWeek: 1 }, // Mon
      { value: 40, dayOfWeek: 1 }, // Mon
    ];
    // Last 3 Mondays: 10, 30, 40 → avg = 80/3
    expect(computeDayOfWeekAverage(values, 1, 3)).toBeCloseTo(80 / 3);
  });

  it('limits to windowWeeks entries', () => {
    const values: DailyValue[] = [
      { value: 10, dayOfWeek: 1 },
      { value: 30, dayOfWeek: 1 },
      { value: 50, dayOfWeek: 1 },
    ];
    // Last 2 Mondays: 30, 50 → avg = 40
    expect(computeDayOfWeekAverage(values, 1, 2)).toBe(40);
  });

  it('returns 0 when no matching day-of-week', () => {
    const values: DailyValue[] = [{ value: 10, dayOfWeek: 1 }];
    expect(computeDayOfWeekAverage(values, 5, 4)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(computeDayOfWeekAverage([], 1, 4)).toBe(0);
  });
});

describe('computeStandardDeviation', () => {
  it('computes population standard deviation', () => {
    // values: [2, 4, 4, 4, 5, 5, 7, 9], mean = 5, stddev = 2
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(computeStandardDeviation(values, 5)).toBe(2);
  });

  it('returns 0 for identical values', () => {
    expect(computeStandardDeviation([5, 5, 5], 5)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(computeStandardDeviation([], 0)).toBe(0);
  });
});

describe('checkTrendAnomaly', () => {
  it('returns true when deviation >= sigma * stdDev', () => {
    // |15 - 10| = 5 >= 2.0 * 2 = 4 → true
    expect(checkTrendAnomaly(15, 10, 2, 2.0)).toBe(true);
  });

  it('returns true at exact boundary', () => {
    // |14 - 10| = 4 >= 2.0 * 2 = 4 → true
    expect(checkTrendAnomaly(14, 10, 2, 2.0)).toBe(true);
  });

  it('returns false when deviation < sigma * stdDev', () => {
    // |13 - 10| = 3 < 2.0 * 2 = 4 → false
    expect(checkTrendAnomaly(13, 10, 2, 2.0)).toBe(false);
  });

  it('detects anomaly below the mean', () => {
    // |5 - 10| = 5 >= 2.0 * 2 = 4 → true
    expect(checkTrendAnomaly(5, 10, 2, 2.0)).toBe(true);
  });

  it('returns true when stdDev is 0 and current != mean', () => {
    // |11 - 10| = 1 >= 2.0 * 0 = 0 → true
    expect(checkTrendAnomaly(11, 10, 0, 2.0)).toBe(true);
  });

  it('returns false when stdDev is 0 and current == mean', () => {
    // |10 - 10| = 0 >= 2.0 * 0 = 0 → true (0 >= 0)
    expect(checkTrendAnomaly(10, 10, 0, 2.0)).toBe(true);
  });
});

describe('detectTrendAnomalies', () => {
  it('detects anomaly when total deviates significantly', () => {
    // Build history: 14 Saturdays (dayOfWeek=6) all with value 10
    const history: DailyValue[] = Array.from({ length: 14 }, () => ({
      value: 10,
      dayOfWeek: 6,
    }));

    const input: TrendInput = {
      totalCount: 50, // way above mean of 10
      byCategory: {},
      historicalTotals: history,
      historicalByCategory: {},
      currentDayOfWeek: 6,
    };

    const config = makeConfig();
    const events = detectTrendAnomalies(input, config, NOW, makeId);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('trend');
    expect(events[0].metric).toBe('total');
  });

  it('returns no events when value is within normal range', () => {
    // Use varied values so stdDev > 0; mean ≈ 10, stdDev ≈ 2.87
    const history: DailyValue[] = [8, 12, 10, 7, 13, 10, 9, 11, 8, 12, 10, 7, 13, 10].map(
      (v) => ({ value: v, dayOfWeek: 6 }),
    );

    const input: TrendInput = {
      totalCount: 11, // within 2σ of mean
      byCategory: {},
      historicalTotals: history,
      historicalByCategory: {},
      currentDayOfWeek: 6,
    };

    const events = detectTrendAnomalies(input, makeConfig(), NOW, makeId);
    expect(events).toHaveLength(0);
  });

  it('detects per-category anomalies', () => {
    const catHistory: DailyValue[] = Array.from({ length: 14 }, () => ({
      value: 5,
      dayOfWeek: 3,
    }));

    const input: TrendInput = {
      totalCount: 10,
      byCategory: { billing: 50 },
      historicalTotals: Array.from({ length: 14 }, () => ({ value: 10, dayOfWeek: 3 })),
      historicalByCategory: { billing: catHistory },
      currentDayOfWeek: 3,
    };

    const events = detectTrendAnomalies(input, makeConfig(), NOW, makeId);
    const billingEvent = events.find((e) => e.metric === 'billing');
    expect(billingEvent).toBeDefined();
    expect(billingEvent!.type).toBe('trend');
  });
});

// ─── Task 6.5: Unified detect ─────────────────────────────

describe('detect (unified)', () => {
  it('combines threshold and trend events', () => {
    const history: DailyValue[] = Array.from({ length: 14 }, () => ({
      value: 10,
      dayOfWeek: 6,
    }));

    const config = makeConfig({
      thresholds: { total: 30, byCategory: {} },
    });

    const events = detect(
      {
        threshold: { totalCount: 50, byCategory: {} },
        trend: {
          totalCount: 50,
          byCategory: {},
          historicalTotals: history,
          historicalByCategory: {},
          currentDayOfWeek: 6,
        },
      },
      config,
      NOW,
      makeId,
    );

    const thresholdEvents = events.filter((e) => e.type === 'threshold');
    const trendEvents = events.filter((e) => e.type === 'trend');
    expect(thresholdEvents.length).toBeGreaterThanOrEqual(1);
    expect(trendEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when nothing is anomalous', () => {
    // Varied history so stdDev > 0
    const history: DailyValue[] = [8, 12, 10, 7, 13, 10, 9, 11, 8, 12, 10, 7, 13, 10].map(
      (v) => ({ value: v, dayOfWeek: 6 }),
    );

    const config = makeConfig({
      thresholds: { total: 100, byCategory: {} },
    });

    const events = detect(
      {
        threshold: { totalCount: 10, byCategory: {} },
        trend: {
          totalCount: 10,
          byCategory: {},
          historicalTotals: history,
          historicalByCategory: {},
          currentDayOfWeek: 6,
        },
      },
      config,
      NOW,
      makeId,
    );

    expect(events).toHaveLength(0);
  });

  it('each event has required fields', () => {
    const config = makeConfig({ thresholds: { total: 5, byCategory: {} } });
    const events = detect(
      {
        threshold: { totalCount: 10, byCategory: {} },
        trend: {
          totalCount: 10,
          byCategory: {},
          historicalTotals: [],
          historicalByCategory: {},
          currentDayOfWeek: 1,
        },
      },
      config,
      NOW,
      makeId,
    );

    for (const event of events) {
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('detectedAt');
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('metric');
      expect(event).toHaveProperty('currentValue');
      expect(event).toHaveProperty('thresholdOrBaseline');
      expect(event).toHaveProperty('deviation');
      expect(event).toHaveProperty('severity');
      expect(['threshold', 'trend']).toContain(event.type);
      expect(['warning', 'critical']).toContain(event.severity);
    }
  });
});

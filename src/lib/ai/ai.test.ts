import { describe, it, expect, vi } from 'vitest';
import type { AnomalyEvent } from '@/types/anomaly';
import type { FilteredTicket } from '@/types/ticket';
import type { AIAnalysisResult, ActionSuggestion } from '@/types/ai';
import type { EventLog } from '@/types/event';
import type { LLMClient } from './llm-client';
import { analyzeCause, computeCategoryBreakdown } from './cause-analyzer';
import {
  computeImpactScore,
  computeAverage,
  computeChangeRate,
  clamp0to100,
  computeCategoryContributions,
  type DailyTicketData,
} from './impact-score';
import {
  analyzeOverlappingEvents,
  hasOverlapping3DayWindow,
  computeRelativeContributions,
} from './overlap-analyzer';
import { suggestEventRegistration, inferEventType } from './event-suggestion';
import {
  analyzeEventCorrelation,
  computeCorrelations,
  formatCorrelationSummary,
} from './event-correlation';
import { predictImpact, determineConfidence } from './knowledge-predictor';
import { ActionSuggestionEngine } from './action-suggestion-engine';

// --- Helpers ---
function makeTicket(overrides: Partial<FilteredTicket> = {}): FilteredTicket {
  return {
    id: 'ticket-1',
    zendeskTicketId: 'ZD-1',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    inquiryCategory: 'billing',
    ticketStatus: 'open',
    subject: 'テスト件名',
    description: 'テスト説明',
    isExcluded: false,
    ...overrides,
  };
}

function makeAnomaly(overrides: Partial<AnomalyEvent> = {}): AnomalyEvent {
  return {
    id: 'anomaly-1',
    detectedAt: new Date('2024-01-15T10:00:00Z'),
    type: 'threshold',
    metric: 'total',
    currentValue: 150,
    thresholdOrBaseline: 100,
    deviation: 50,
    severity: 'critical',
    ...overrides,
  };
}

const mockLLM: LLMClient = {
  analyze: vi.fn().mockResolvedValue(
    JSON.stringify({
      commonPatterns: '請求関連の問い合わせが急増',
      hypotheses: [
        {
          rank: 1,
          description: '料金改定の影響',
          evidence: [{ metric: 'billing', value: 45, unit: '%' }],
          confidence: 'high',
        },
      ],
      representativeTicketIds: ['ZD-1', 'ZD-2'],
    }),
  ),
};

// === 7.1 Cause Analyzer Tests ===
describe('cause-analyzer', () => {
  describe('computeCategoryBreakdown', () => {
    it('computes breakdown with counts, percentages, and increase rates', () => {
      const current = [
        makeTicket({ inquiryCategory: 'billing' }),
        makeTicket({ inquiryCategory: 'billing' }),
        makeTicket({ inquiryCategory: 'technical' }),
      ];
      const baseline = [
        makeTicket({ inquiryCategory: 'billing' }),
        makeTicket({ inquiryCategory: 'technical' }),
      ];

      const result = computeCategoryBreakdown(current, baseline);
      expect(result).toHaveLength(2);

      const billing = result.find((r) => r.category === 'billing')!;
      expect(billing.count).toBe(2);
      expect(billing.percentage).toBeCloseTo(66.67, 1);
      expect(billing.increaseRate).toBe(100); // 1 -> 2 = 100%

      const tech = result.find((r) => r.category === 'technical')!;
      expect(tech.count).toBe(1);
      expect(tech.increaseRate).toBe(0); // 1 -> 1 = 0%
    });

    it('handles empty baseline', () => {
      const current = [makeTicket({ inquiryCategory: 'billing' })];
      const result = computeCategoryBreakdown(current, []);
      expect(result[0].increaseRate).toBe(100);
    });
  });

  describe('analyzeCause', () => {
    it('returns structured analysis with LLM results', async () => {
      const anomaly = makeAnomaly();
      const tickets = [
        makeTicket({ inquiryCategory: 'billing' }),
        makeTicket({ inquiryCategory: 'billing' }),
      ];

      const result = await analyzeCause(anomaly, {
        llmClient: mockLLM,
        getTicketsForPeriod: vi.fn().mockResolvedValue(tickets),
        getBaselineTickets: vi.fn().mockResolvedValue([makeTicket()]),
      });

      expect(result.anomalyEventId).toBe('anomaly-1');
      expect(result.categoryBreakdown.length).toBeGreaterThan(0);
      expect(result.hypotheses.length).toBeLessThanOrEqual(3);
      expect(result.representativeTicketIds.length).toBeLessThanOrEqual(5);
      expect(result.commonPatterns).toBeTruthy();
    });

    it('handles LLM timeout gracefully', async () => {
      const timeoutLLM: LLMClient = {
        analyze: vi.fn().mockRejectedValue(new Error('timeout')),
      };

      const result = await analyzeCause(makeAnomaly(), {
        llmClient: timeoutLLM,
        getTicketsForPeriod: vi.fn().mockResolvedValue([makeTicket()]),
        getBaselineTickets: vi.fn().mockResolvedValue([]),
      });

      expect(result.commonPatterns).toContain('タイムアウト');
    });
  });
});

// === 7.3 Impact Score Tests ===
describe('impact-score', () => {
  it('computeAverage returns correct average', () => {
    const data: DailyTicketData[] = [
      { date: new Date(), totalCount: 10, byCategory: {} },
      { date: new Date(), totalCount: 20, byCategory: {} },
      { date: new Date(), totalCount: 30, byCategory: {} },
    ];
    expect(computeAverage(data)).toBe(20);
  });

  it('computeAverage returns 0 for empty data', () => {
    expect(computeAverage([])).toBe(0);
  });

  it('computeChangeRate calculates correctly', () => {
    expect(computeChangeRate(100, 150)).toBe(50);
    expect(computeChangeRate(100, 50)).toBe(-50);
    expect(computeChangeRate(0, 10)).toBe(100);
    expect(computeChangeRate(0, 0)).toBe(0);
  });

  it('clamp0to100 clamps values', () => {
    expect(clamp0to100(-10)).toBe(0);
    expect(clamp0to100(50)).toBe(50);
    expect(clamp0to100(150)).toBe(100);
  });

  it('computeCategoryContributions sums to ~100%', () => {
    const pre: DailyTicketData[] = [
      { date: new Date(), totalCount: 10, byCategory: { billing: 5, tech: 5 } },
    ];
    const post: DailyTicketData[] = [
      { date: new Date(), totalCount: 20, byCategory: { billing: 15, tech: 5 } },
    ];
    const result = computeCategoryContributions(pre, post);
    const total = result.reduce((s, r) => s + r.contribution, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('computeImpactScore returns score in 0-100 range', async () => {
    const deps = {
      getDailyTicketData: vi.fn().mockImplementation((start: Date) => {
        const day = start.getDate();
        if (day <= 14) {
          return Promise.resolve([
            { date: new Date(), totalCount: 100, byCategory: { billing: 50, tech: 50 } },
          ]);
        }
        return Promise.resolve([
          { date: new Date(), totalCount: 150, byCategory: { billing: 100, tech: 50 } },
        ]);
      }),
    };

    const result = await computeImpactScore('event-1', new Date('2024-01-15'), deps);
    expect(result.impactScore).toBeGreaterThanOrEqual(0);
    expect(result.impactScore).toBeLessThanOrEqual(100);
    expect(result.eventId).toBe('event-1');
  });
});

// === 7.5 Overlap Analyzer Tests ===
describe('overlap-analyzer', () => {
  it('hasOverlapping3DayWindow detects overlap', () => {
    const d1 = new Date('2024-01-15');
    const d2 = new Date('2024-01-18'); // 3 days apart
    expect(hasOverlapping3DayWindow(d1, d2)).toBe(true);
  });

  it('hasOverlapping3DayWindow rejects non-overlapping', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-10'); // 9 days apart
    expect(hasOverlapping3DayWindow(d1, d2)).toBe(false);
  });

  it('computeRelativeContributions sums to ~100%', () => {
    const scores = [
      { eventId: 'e1', score: 60 },
      { eventId: 'e2', score: 40 },
    ];
    const result = computeRelativeContributions(scores);
    const total = result.reduce((s, r) => s + r.relativeContribution, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('computeRelativeContributions handles all-zero scores', () => {
    const scores = [
      { eventId: 'e1', score: 0 },
      { eventId: 'e2', score: 0 },
    ];
    const result = computeRelativeContributions(scores);
    expect(result[0].relativeContribution).toBe(50);
    expect(result[1].relativeContribution).toBe(50);
  });

  it('analyzeOverlappingEvents ranks by contribution', async () => {
    const events: EventLog[] = [
      {
        id: 'e1', name: 'Campaign', eventType: 'campaign_start',
        occurredAt: new Date('2024-01-15'), description: '', tags: [],
        urls: [], createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'e2', name: 'Release', eventType: 'system_release',
        occurredAt: new Date('2024-01-16'), description: '', tags: [],
        urls: [], createdAt: new Date(), updatedAt: new Date(),
      },
    ];

    const deps = {
      getEventsByIds: vi.fn().mockResolvedValue(events),
      getDailyTicketData: vi.fn().mockResolvedValue([
        { date: new Date(), totalCount: 100, byCategory: { billing: 100 } },
      ]),
    };

    const result = await analyzeOverlappingEvents(['e1', 'e2'], deps);
    expect(result.events).toHaveLength(2);
    expect(result.ranking).toHaveLength(2);
    const totalContrib = result.events.reduce((s, e) => s + e.relativeContribution, 0);
    expect(totalContrib).toBeCloseTo(100, 0);
  });
});

// === 7.7 Event Suggestion Tests ===
describe('event-suggestion', () => {
  describe('inferEventType', () => {
    it('infers incident from error keywords', () => {
      const tickets = [makeTicket({ subject: 'システム障害が発生' })];
      expect(inferEventType(tickets)).toBe('incident');
    });

    it('infers campaign from campaign keywords', () => {
      const tickets = [makeTicket({ subject: 'キャンペーン割引について' })];
      expect(inferEventType(tickets)).toBe('campaign_start');
    });

    it('returns other for unknown content', () => {
      const tickets = [makeTicket({ subject: '一般的な質問' })];
      expect(inferEventType(tickets)).toBe('other');
    });
  });

  it('returns null when events exist in period', async () => {
    const result = await suggestEventRegistration(makeAnomaly(), {
      llmClient: mockLLM,
      getEventsInPeriod: vi.fn().mockResolvedValue([{ id: 'existing' }]),
      getTicketsForPeriod: vi.fn().mockResolvedValue([]),
      getIgnoredSuggestions: vi.fn().mockResolvedValue(new Set()),
    });
    expect(result).toBeNull();
  });

  it('returns null when anomaly is ignored', async () => {
    const result = await suggestEventRegistration(makeAnomaly(), {
      llmClient: mockLLM,
      getEventsInPeriod: vi.fn().mockResolvedValue([]),
      getTicketsForPeriod: vi.fn().mockResolvedValue([]),
      getIgnoredSuggestions: vi.fn().mockResolvedValue(new Set(['anomaly-1'])),
    });
    expect(result).toBeNull();
  });

  it('returns suggestion when no events and not ignored', async () => {
    const result = await suggestEventRegistration(makeAnomaly(), {
      llmClient: mockLLM,
      getEventsInPeriod: vi.fn().mockResolvedValue([]),
      getTicketsForPeriod: vi.fn().mockResolvedValue([
        makeTicket({ subject: 'システム障害' }),
      ]),
      getIgnoredSuggestions: vi.fn().mockResolvedValue(new Set()),
    });
    expect(result).not.toBeNull();
    expect(result!.suggestedEventType).toBe('incident');
    expect(result!.suggestedDate).toEqual(new Date('2024-01-15T10:00:00Z'));
  });
});

// === 7.9 Event Correlation Tests ===
describe('event-correlation', () => {
  describe('computeCorrelations', () => {
    it('computes increase count and rate', () => {
      const pre = [
        makeTicket({ inquiryCategory: 'billing' }),
        makeTicket({ inquiryCategory: 'billing' }),
      ];
      const post = [
        makeTicket({ inquiryCategory: 'billing' }),
        makeTicket({ inquiryCategory: 'billing' }),
        makeTicket({ inquiryCategory: 'billing' }),
        makeTicket({ inquiryCategory: 'technical' }),
      ];
      const result = computeCorrelations(pre, post);
      const billing = result.find((r) => r.category === 'billing')!;
      expect(billing.increaseCount).toBe(1);
      expect(billing.increaseRate).toBe(50);

      const tech = result.find((r) => r.category === 'technical')!;
      expect(tech.increaseCount).toBe(1);
      expect(tech.increaseRate).toBe(100);
    });
  });

  describe('formatCorrelationSummary', () => {
    it('formats increased categories', () => {
      const correlations = [
        { category: 'billing', preEventCount: 10, postEventCount: 15, increaseCount: 5, increaseRate: 50 },
      ];
      const summary = formatCorrelationSummary('Campaign', correlations);
      expect(summary).toContain('Campaign');
      expect(summary).toContain('billing');
      expect(summary).toContain('50%');
    });

    it('handles no increases', () => {
      const correlations = [
        { category: 'billing', preEventCount: 10, postEventCount: 8, increaseCount: -2, increaseRate: -20 },
      ];
      const summary = formatCorrelationSummary('Campaign', correlations);
      expect(summary).toContain('顕著な増加カテゴリはありませんでした');
    });
  });

  it('returns no-event message when event not found', async () => {
    const result = await analyzeEventCorrelation('missing-id', {
      getEventById: vi.fn().mockResolvedValue(null),
      getTicketsForPeriod: vi.fn().mockResolvedValue([]),
    });
    expect(result.summary).toBe('該当期間に登録済みイベントなし');
  });

  it('returns correlations when event exists', async () => {
    const event: EventLog = {
      id: 'e1', name: 'Campaign', eventType: 'campaign_start',
      occurredAt: new Date('2024-01-15'), description: '', tags: [],
      urls: [], createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await analyzeEventCorrelation('e1', {
      getEventById: vi.fn().mockResolvedValue(event),
      getTicketsForPeriod: vi.fn()
        .mockResolvedValueOnce([makeTicket({ inquiryCategory: 'billing' })])
        .mockResolvedValueOnce([
          makeTicket({ inquiryCategory: 'billing' }),
          makeTicket({ inquiryCategory: 'billing' }),
        ]),
    });
    expect(result.eventName).toBe('Campaign');
    expect(result.correlations.length).toBeGreaterThan(0);
  });
});

// === 7.10 Knowledge Predictor Tests ===
describe('knowledge-predictor', () => {
  describe('determineConfidence', () => {
    it('returns low for < 2 events', () => {
      expect(determineConfidence(0).level).toBe('low');
      expect(determineConfidence(1).level).toBe('low');
    });

    it('returns medium for 2-4 events', () => {
      expect(determineConfidence(2).level).toBe('medium');
      expect(determineConfidence(4).level).toBe('medium');
    });

    it('returns high for >= 5 events', () => {
      expect(determineConfidence(5).level).toBe('high');
    });
  });

  it('returns low confidence when no similar events', async () => {
    const result = await predictImpact('campaign_start', ['promo'], {
      getEventsByType: vi.fn().mockResolvedValue([]),
      getEventsByTags: vi.fn().mockResolvedValue([]),
      getImpactScore: vi.fn().mockResolvedValue(0),
      getCategoryImpact: vi.fn().mockResolvedValue([]),
    });
    expect(result.confidenceLevel).toBe('low');
    expect(result.pastSimilarEvents).toHaveLength(0);
  });

  it('predicts impact from past similar events', async () => {
    const pastEvents: EventLog[] = [
      {
        id: 'past-1', name: 'Past Campaign', eventType: 'campaign_start',
        occurredAt: new Date('2023-06-01'), description: '', tags: ['promo'],
        urls: [], memo: '前回のキャンペーン', createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'past-2', name: 'Past Campaign 2', eventType: 'campaign_start',
        occurredAt: new Date('2023-09-01'), description: '', tags: ['promo'],
        urls: [], memo: '2回目', createdAt: new Date(), updatedAt: new Date(),
      },
    ];

    const result = await predictImpact('campaign_start', ['promo'], {
      getEventsByType: vi.fn().mockResolvedValue(pastEvents),
      getEventsByTags: vi.fn().mockResolvedValue([]),
      getImpactScore: vi.fn().mockResolvedValue(40),
      getCategoryImpact: vi.fn().mockResolvedValue([
        { category: 'billing', increaseRate: 30 },
      ]),
    });

    expect(result.confidenceLevel).toBe('medium');
    expect(result.pastSimilarEvents).toHaveLength(2);
    expect(result.affectedCategories.length).toBeGreaterThan(0);
    expect(result.predictedIncreasePercent).toBe(40);
  });
});

// === 7.12 & 7.13 Action Suggestion Engine Tests ===
describe('ActionSuggestionEngine', () => {
  function makeEngineDeps() {
    const store = new Map<string, ActionSuggestion>();
    return {
      llmClient: {
        analyze: vi.fn().mockResolvedValue(
          JSON.stringify([
            {
              actionType: 'faq_create_update',
              title: 'FAQ更新: 請求関連',
              description: '請求関連FAQを更新してください',
              priority: 'high',
              reasoning: '請求カテゴリが前日比+45%',
              relatedCategory: 'billing',
            },
            {
              actionType: 'internal_escalation',
              title: 'エスカレーション',
              description: '開発チームに報告',
              priority: 'medium',
              reasoning: 'システムエラー関連が増加',
            },
          ]),
        ),
      } as LLMClient,
      getPastEffectiveActions: vi.fn().mockResolvedValue([]),
      saveAction: vi.fn().mockImplementation(async (a: ActionSuggestion) => {
        store.set(a.id, { ...a });
      }),
      getAction: vi.fn().mockImplementation(async (id: string) => {
        return store.get(id) ?? null;
      }),
      updateAction: vi.fn().mockImplementation(async (a: ActionSuggestion) => {
        store.set(a.id, { ...a });
      }),
      getActionHistory: vi.fn().mockResolvedValue([]),
      getTicketCountForPeriod: vi.fn().mockResolvedValue(100),
    };
  }

  const mockAnalysis: AIAnalysisResult = {
    anomalyEventId: 'anomaly-1',
    categoryBreakdown: [
      { category: 'billing', count: 50, percentage: 60, increaseRate: 45 },
    ],
    commonPatterns: '請求関連の問い合わせ急増',
    hypotheses: [
      { rank: 1, description: '料金改定', evidence: [], confidence: 'high' },
    ],
    representativeTicketIds: ['ZD-1'],
    generatedAt: new Date(),
  };

  it('suggests max 5 actions with valid types and priorities', async () => {
    const deps = makeEngineDeps();
    const engine = new ActionSuggestionEngine(deps);
    const suggestions = await engine.suggest(makeAnomaly(), mockAnalysis);

    expect(suggestions.length).toBeLessThanOrEqual(5);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.responseStatus).toBe('pending');
      expect(['high', 'medium', 'low']).toContain(s.priority);
      expect(s.id).toBeTruthy();
    }
  });

  it('respond updates status correctly', async () => {
    const deps = makeEngineDeps();
    const engine = new ActionSuggestionEngine(deps);
    const suggestions = await engine.suggest(makeAnomaly(), mockAnalysis);
    const id = suggestions[0].id;

    await engine.respond(id, 'accepted');
    const updated = await deps.getAction(id);
    expect(updated!.responseStatus).toBe('accepted');
    expect(updated!.executionStatus).toBe('not_started');
  });

  it('respond with rejected does not set executionStatus', async () => {
    const deps = makeEngineDeps();
    const engine = new ActionSuggestionEngine(deps);
    const suggestions = await engine.suggest(makeAnomaly(), mockAnalysis);
    const id = suggestions[0].id;

    await engine.respond(id, 'rejected');
    const updated = await deps.getAction(id);
    expect(updated!.responseStatus).toBe('rejected');
    expect(updated!.executionStatus).toBeUndefined();
  });

  it('updateExecutionStatus only works on accepted actions', async () => {
    const deps = makeEngineDeps();
    const engine = new ActionSuggestionEngine(deps);
    const suggestions = await engine.suggest(makeAnomaly(), mockAnalysis);
    const id = suggestions[0].id;

    // Should fail on pending action
    await expect(
      engine.updateExecutionStatus(id, 'in_progress'),
    ).rejects.toThrow('Only accepted actions');

    // Accept first, then update
    await engine.respond(id, 'accepted');
    await engine.updateExecutionStatus(id, 'in_progress');
    const updated = await deps.getAction(id);
    expect(updated!.executionStatus).toBe('in_progress');

    await engine.updateExecutionStatus(id, 'completed');
    const completed = await deps.getAction(id);
    expect(completed!.executionStatus).toBe('completed');
  });

  it('trackEffect computes ticket count change', async () => {
    const deps = makeEngineDeps();
    deps.getTicketCountForPeriod = vi.fn()
      .mockResolvedValueOnce(100) // pre
      .mockResolvedValueOnce(80); // post

    const engine = new ActionSuggestionEngine(deps);
    const suggestions = await engine.suggest(makeAnomaly(), mockAnalysis);
    const id = suggestions[0].id;

    const effect = await engine.trackEffect(id);
    expect(effect).toBeDefined();
    expect(effect!.preActionCount).toBe(100);
    expect(effect!.postActionCount).toBe(80);
    expect(effect!.changeRate).toBe(-20);
  });

  it('throws when action not found', async () => {
    const deps = makeEngineDeps();
    const engine = new ActionSuggestionEngine(deps);
    await expect(engine.respond('nonexistent', 'accepted')).rejects.toThrow();
  });
});

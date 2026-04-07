import { describe, it, expect } from 'vitest';
import {
  ReportGenerator,
  createInMemoryReportStore,
  isWeeklyReportDay,
  isMonthlyReportDay,
  calculateReportRange,
} from './report-generator';
import type { ReportDataProvider, ReportDistributor } from './report-generator';

function createMockDataProvider(): ReportDataProvider {
  return {
    getTicketCount: async () => 100,
    getCategoryHighlights: async () => [
      { category: '料金', count: 40, trend: 'up', changeRate: 20 },
    ],
    getAnomalyEvents: async () => [
      { date: new Date('2024-01-10'), metric: 'total', summary: '急増検知' },
    ],
    getEventLogs: async () => [
      { name: 'キャンペーン', impactScore: 65 },
    ],
    getForecast: async () => ({ predictedCount: 110, basis: 'トレンド分析' }),
    generateNarrative: async () => '今週は料金関連の問い合わせが20%増加しました。',
  };
}

describe('Report Schedule Logic', () => {
  it('identifies Monday as weekly report day', () => {
    expect(isWeeklyReportDay(new Date('2024-01-15'))).toBe(true); // Monday
    expect(isWeeklyReportDay(new Date('2024-01-16'))).toBe(false); // Tuesday
  });

  it('identifies 1st as monthly report day', () => {
    expect(isMonthlyReportDay(new Date('2024-02-01'))).toBe(true);
    expect(isMonthlyReportDay(new Date('2024-02-02'))).toBe(false);
  });
});

describe('calculateReportRange', () => {
  it('calculates weekly range (previous 7 days)', () => {
    const ref = new Date('2024-01-15'); // Monday
    const range = calculateReportRange('weekly', ref);
    expect(range.start.getDate()).toBe(8);
    expect(range.end.getDate()).toBe(14);
  });

  it('calculates monthly range (previous month)', () => {
    const ref = new Date('2024-02-01');
    const range = calculateReportRange('monthly', ref);
    expect(range.start.getMonth()).toBe(0); // January
    expect(range.start.getDate()).toBe(1);
    expect(range.end.getDate()).toBe(31); // Jan 31
  });

  it('uses custom range when provided', () => {
    const custom = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    };
    const range = calculateReportRange('custom', new Date(), custom);
    expect(range.start).toBe(custom.start);
    expect(range.end).toBe(custom.end);
  });
});

describe('ReportGenerator', () => {
  it('generates a report with all content fields', async () => {
    const generator = new ReportGenerator(
      createMockDataProvider(),
      createInMemoryReportStore(),
    );

    const report = await generator.generate('weekly', undefined, new Date('2024-01-15'));

    expect(report.id).toBeTruthy();
    expect(report.period).toBe('weekly');
    expect(report.content.totalTickets).toBe(100);
    expect(report.content.previousPeriodComparison).toBeDefined();
    expect(report.content.categoryHighlights).toHaveLength(1);
    expect(report.content.anomalyEvents).toHaveLength(1);
    expect(report.content.eventLogs).toHaveLength(1);
    expect(report.content.forecast.predictedCount).toBe(110);
    expect(report.content.narrativeSummary).toContain('料金');
  });

  it('lists report history', async () => {
    const store = createInMemoryReportStore();
    const generator = new ReportGenerator(createMockDataProvider(), store);

    await generator.generate('weekly');
    await generator.generate('monthly');

    const history = await generator.listHistory();
    expect(history.items).toHaveLength(2);
    expect(history.total).toBe(2);
  });

  it('distributes and resends a report', async () => {
    const store = createInMemoryReportStore();
    const distributor: ReportDistributor = {
      distribute: async () => [
        { ruleId: 'r1', channel: 'slack', success: true, retryCount: 0 },
      ],
    };
    const generator = new ReportGenerator(
      createMockDataProvider(),
      store,
      distributor,
    );

    const report = await generator.generate('weekly');
    const results = await generator.distribute(report.id);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);

    // Resend
    const resendResults = await generator.resend(report.id);
    expect(resendResults).toHaveLength(1);
  });

  it('throws when distributing without distributor', async () => {
    const generator = new ReportGenerator(
      createMockDataProvider(),
      createInMemoryReportStore(),
    );
    const report = await generator.generate('weekly');
    await expect(generator.distribute(report.id)).rejects.toThrow('No distributor');
  });
});

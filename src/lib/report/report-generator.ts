/**
 * Report Generator - Requirements 19.1-19.7
 *
 * Automated report generation with:
 * - Weekly (Monday) and monthly (1st) schedule logic
 * - Report content: ticket total, period comparison, category highlights,
 *   anomaly events, event logs, forecast, AI narrative
 * - Distribution via NotificationDispatcher
 * - History management and resend
 */

import type {
  AutoReport,
  ReportContent,
  ReportPeriod,
} from '@/types/report';
import type { PaginatedResult } from '@/types/api';
import type { DispatchResult } from '@/types/notification';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ReportDataProvider {
  /** Get total ticket count for a period */
  getTicketCount: (start: Date, end: Date) => Promise<number>;
  /** Get category breakdown for a period */
  getCategoryHighlights: (
    start: Date,
    end: Date,
  ) => Promise<ReportContent['categoryHighlights']>;
  /** Get anomaly events for a period */
  getAnomalyEvents: (
    start: Date,
    end: Date,
  ) => Promise<ReportContent['anomalyEvents']>;
  /** Get event logs for a period */
  getEventLogs: (
    start: Date,
    end: Date,
  ) => Promise<ReportContent['eventLogs']>;
  /** Generate forecast */
  getForecast: () => Promise<ReportContent['forecast']>;
  /** Generate AI narrative summary (Req 19.7) */
  generateNarrative: (content: Omit<ReportContent, 'narrativeSummary'>) => Promise<string>;
}

export interface ReportStore {
  getAll: () => Promise<AutoReport[]>;
  getById: (id: string) => Promise<AutoReport | null>;
  save: (report: AutoReport) => Promise<void>;
}

export interface ReportDistributor {
  distribute: (report: AutoReport) => Promise<DispatchResult[]>;
}

function generateId(): string {
  return `report_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** In-memory report store */
export function createInMemoryReportStore(): ReportStore {
  const reports = new Map<string, AutoReport>();
  return {
    getAll: async () => Array.from(reports.values()),
    getById: async (id) => reports.get(id) ?? null,
    save: async (report) => { reports.set(report.id, report); },
  };
}

/**
 * Determine if today should trigger a weekly report (Monday) (Req 19.1)
 */
export function isWeeklyReportDay(date: Date): boolean {
  return date.getDay() === 1; // Monday
}

/**
 * Determine if today should trigger a monthly report (1st) (Req 19.1)
 */
export function isMonthlyReportDay(date: Date): boolean {
  return date.getDate() === 1;
}

/**
 * Calculate the date range for a report period
 */
export function calculateReportRange(
  period: ReportPeriod,
  referenceDate: Date,
  customRange?: DateRange,
): DateRange {
  if (period === 'custom' && customRange) {
    return customRange;
  }

  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  if (period === 'weekly') {
    // Previous 7 days
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    // Previous month
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    end.setDate(0); // Last day of previous month
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export class ReportGenerator {
  constructor(
    private dataProvider: ReportDataProvider,
    private store: ReportStore,
    private distributor?: ReportDistributor,
  ) {}

  /**
   * Generate a report for the given period (Req 19.1-19.7)
   */
  async generate(
    period: ReportPeriod,
    customRange?: DateRange,
    referenceDate: Date = new Date(),
  ): Promise<AutoReport> {
    const range = calculateReportRange(period, referenceDate, customRange);

    // Previous period for comparison
    const durationMs = range.end.getTime() - range.start.getTime();
    const prevEnd = new Date(range.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    const [
      totalTickets,
      prevTotalTickets,
      categoryHighlights,
      anomalyEvents,
      eventLogs,
      forecast,
    ] = await Promise.all([
      this.dataProvider.getTicketCount(range.start, range.end),
      this.dataProvider.getTicketCount(prevStart, prevEnd),
      this.dataProvider.getCategoryHighlights(range.start, range.end),
      this.dataProvider.getAnomalyEvents(range.start, range.end),
      this.dataProvider.getEventLogs(range.start, range.end),
      this.dataProvider.getForecast(),
    ]);

    // Period comparison (Req 19.2)
    const diff = totalTickets - prevTotalTickets;
    const rate = prevTotalTickets > 0
      ? Math.round(((diff) / prevTotalTickets) * 100 * 100) / 100
      : 0;

    const contentWithoutNarrative: Omit<ReportContent, 'narrativeSummary'> = {
      totalTickets,
      previousPeriodComparison: { diff, rate },
      categoryHighlights,
      anomalyEvents,
      eventLogs,
      forecast,
    };

    // AI narrative (Req 19.7)
    const narrativeSummary = await this.dataProvider.generateNarrative(
      contentWithoutNarrative,
    );

    const content: ReportContent = {
      ...contentWithoutNarrative,
      narrativeSummary,
    };

    const report: AutoReport = {
      id: generateId(),
      period,
      startDate: range.start,
      endDate: range.end,
      content,
      generatedAt: new Date(),
    };

    await this.store.save(report);
    return report;
  }

  /**
   * Distribute a report via notification channels (Req 19.8)
   */
  async distribute(reportId: string): Promise<DispatchResult[]> {
    const report = await this.store.getById(reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);
    if (!this.distributor) throw new Error('No distributor configured');

    const results = await this.distributor.distribute(report);
    report.distributedAt = new Date();
    await this.store.save(report);
    return results;
  }

  /**
   * List report history with pagination (Req 19.10)
   */
  async listHistory(
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResult<AutoReport>> {
    const all = await this.store.getAll();
    // Sort by generatedAt descending
    const sorted = all.sort(
      (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime(),
    );

    const total = sorted.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return { items, total, page, pageSize, totalPages };
  }

  /**
   * Resend a previously generated report (Req 19.11)
   */
  async resend(reportId: string): Promise<DispatchResult[]> {
    return this.distribute(reportId);
  }
}

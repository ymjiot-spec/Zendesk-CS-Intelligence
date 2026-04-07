/**
 * Report generation type definitions
 * Used by the ReportGenerator for automated report creation and distribution
 */

export type ReportPeriod = 'weekly' | 'monthly' | 'custom';

export interface AutoReport {
  id: string;
  period: ReportPeriod;
  startDate: Date;
  endDate: Date;
  content: ReportContent;
  generatedAt: Date;
  distributedAt?: Date;
}

export interface ReportContent {
  totalTickets: number;
  previousPeriodComparison: { diff: number; rate: number };
  categoryHighlights: {
    category: string;
    count: number;
    trend: string;
    changeRate: number;
  }[];
  anomalyEvents: { date: Date; metric: string; summary: string }[];
  eventLogs: { name: string; impactScore: number }[];
  forecast: { predictedCount: number; basis: string };
  narrativeSummary: string; // AI生成テキスト
}

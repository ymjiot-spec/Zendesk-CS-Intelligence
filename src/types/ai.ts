/**
 * AI analysis type definitions
 * Used by the AIAnalyzer for cause analysis, impact scoring,
 * event correlation, predictions, and action suggestions
 */

export interface AIAnalysisResult {
  anomalyEventId: string;
  categoryBreakdown: {
    category: string;
    count: number;
    percentage: number;
    increaseRate: number;
  }[];
  commonPatterns: string;
  hypotheses: CauseHypothesis[];
  representativeTicketIds: string[]; // 最大5件
  eventCorrelation?: EventCorrelationResult;
  generatedAt: Date;
}

export interface CauseHypothesis {
  rank: number;
  description: string;
  evidence: { metric: string; value: number; unit: string }[];
  confidence: 'high' | 'medium' | 'low';
}

export interface EventCorrelationResult {
  correlatedEvents: {
    eventId: string;
    eventName: string;
    impactScore: number;
  }[];
  summary: string;
}

export interface ImpactScoreResult {
  eventId: string;
  impactScore: number; // 0-100
  preEventAvg: number;
  postEventAvg: number;
  changeRate: number;
  categoryContributions: { category: string; contribution: number }[];
}

export interface OverlapAnalysisResult {
  period: { start: Date; end: Date };
  events: {
    eventId: string;
    eventName: string;
    individualImpactScore: number;
    relativeContribution: number;
  }[];
  ranking: string[];
  summary: string;
}

export interface EventSuggestion {
  suggestedEventType: string;
  suggestedDate: Date;
  reason: string;
  analysisSnippet: string;
}

export interface ImpactPrediction {
  predictedIncreasePercent: number;
  affectedCategories: { category: string; predictedIncrease: number }[];
  pastSimilarEvents: {
    eventId: string;
    eventName: string;
    impactScore: number;
    memo: string;
  }[];
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceReason: string;
}

export type ActionType =
  | 'faq_create_update'
  | 'announcement_post'
  | 'partner_notification'
  | 'internal_escalation'
  | 'template_reply_create'
  | 'system_investigation';

export interface ActionSuggestion {
  id: string;
  anomalyEventId: string;
  actionType: ActionType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  relatedCategory?: string;
  responseStatus: 'pending' | 'accepted' | 'deferred' | 'rejected';
  executionStatus?: 'not_started' | 'in_progress' | 'completed';
  effectMetrics?: {
    preActionCount: number;
    postActionCount: number;
    changeRate: number;
  };
  createdAt: Date;
}

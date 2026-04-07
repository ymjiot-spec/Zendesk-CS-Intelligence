/**
 * AI Analysis Engine - barrel export
 * Provides cause analysis, impact scoring, overlap analysis,
 * event suggestions, event correlation, knowledge prediction,
 * and action suggestion capabilities.
 */

export type { LLMClient } from './llm-client';

export {
  analyzeCause,
  computeCategoryBreakdown,
  type CauseAnalyzerDeps,
} from './cause-analyzer';

export {
  computeImpactScore,
  computeAverage,
  computeChangeRate,
  computeCategoryContributions,
  clamp0to100,
  type DailyTicketData,
  type ImpactScoreDeps,
} from './impact-score';

export {
  analyzeOverlappingEvents,
  hasOverlapping3DayWindow,
  findOverlappingGroups,
  computeRelativeContributions,
  type OverlapAnalyzerDeps,
} from './overlap-analyzer';

export {
  suggestEventRegistration,
  inferEventType,
  type EventSuggestionDeps,
} from './event-suggestion';

export {
  analyzeEventCorrelation,
  computeCorrelations,
  formatCorrelationSummary,
  type EventCategoryCorrelation,
  type CategoryCorrelation,
  type EventCorrelationDeps,
} from './event-correlation';

export {
  predictImpact,
  findSimilarEvents,
  determineConfidence,
  type KnowledgePredictorDeps,
} from './knowledge-predictor';

export {
  ActionSuggestionEngine,
  type ActionSuggestionEngineDeps,
} from './action-suggestion-engine';

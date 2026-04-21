/**
 * Timeline & Correlation Analysis type definitions
 * Used by the Event Timeline Dashboard feature
 */
import type { EventType } from './event';

export interface TimelineEvent {
  id: string;
  name: string;
  eventType: EventType;
  occurredAt: string;
  endDate: string | null;
  sourceKey: string | null;
  impactScore: number | null;
}

export interface CorrelationDataPoint {
  date: string;
  ticketCount: number;
  callCount: number;
  eventMarkers: { id: string; name: string; eventType: EventType }[];
  metrics?: { key: string; value: number; label: string }[];
}

export interface ImpactAnalysisData {
  eventId: string;
  eventName: string;
  eventType: EventType;
  occurredAt: string;
  sourceKey: string | null;
  companyName: string;
  preEventTicketAvg: number;
  postEventTicketAvg: number;
  ticketChangeRate: number;
  preEventCallAvg: number;
  postEventCallAvg: number;
  callChangeRate: number;
  topCategories: {
    category: string;
    preCount: number;
    postCount: number;
    increaseRate: number;
  }[];
  representativeTickets: { ticketId: string; subject: string }[];
  aiSummary: string;
  impactScore: number;
  additionalMetrics?: Record<string, unknown>;
}

export interface TimelineGroup {
  sourceKey: string;
  companyName: string;
  events: TimelineEvent[];
}

export interface TimelineResponse {
  success: boolean;
  data: {
    groups: TimelineGroup[];
    allCompanyEvents: TimelineEvent[];
    metadata: Record<string, unknown>;
  };
}

export interface CorrelationResponse {
  success: boolean;
  data: {
    daily: CorrelationDataPoint[];
    metadata: Record<string, unknown>;
  };
}

export interface AnalysisResponse {
  success: boolean;
  data: ImpactAnalysisData;
}

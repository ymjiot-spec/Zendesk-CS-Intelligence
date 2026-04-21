/**
 * Event log type definitions
 * Used by the EventLogEngine for business event management
 */

export type EventType =
  | 'campaign_start'
  | 'system_release'
  | 'incident'
  | 'email_delivery'
  | 'pricing_change'
  | 'terms_change'
  | 'other';

export interface EventLog {
  id: string;
  name: string;
  eventType: EventType;
  occurredAt: Date;
  description: string;
  tags: string[];
  memo?: string;
  urls: string[];
  impactScore?: number;
  sourceKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventListFilters {
  eventTypes?: EventType[];
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'occurredAt' | 'impactScore';
  sortOrder?: 'asc' | 'desc';
}

export interface EventTag {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}

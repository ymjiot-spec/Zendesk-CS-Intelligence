/**
 * Event Log Engine - Requirements 11.1-11.3, 11.8-11.12
 *
 * CRUD operations for business event logs with:
 * - 7 EventTypes
 * - Default Event_Tags
 * - Tag validation (at least 1 required)
 * - Memo/URL multiple entries
 * - Overlapping events query
 * - Type and tag filtering
 */

import type { EventLog, EventType, EventListFilters, EventTag } from '@/types/event';
import type { PaginatedResult } from '@/types/api';

/** Default Event_Tags (Req 11.9) */
export const DEFAULT_EVENT_TAGS: EventTag[] = [
  { id: 1, name: 'キャンペーン', isDefault: true, createdAt: new Date() },
  { id: 2, name: '障害', isDefault: true, createdAt: new Date() },
  { id: 3, name: 'システム変更', isDefault: true, createdAt: new Date() },
  { id: 4, name: '料金変更', isDefault: true, createdAt: new Date() },
  { id: 5, name: '代理店施策', isDefault: true, createdAt: new Date() },
  { id: 6, name: 'マーケ施策', isDefault: true, createdAt: new Date() },
];

/** All valid EventTypes (Req 11.2) */
export const ALL_EVENT_TYPES: EventType[] = [
  'campaign_start',
  'system_release',
  'incident',
  'email_delivery',
  'pricing_change',
  'terms_change',
  'other',
];

export interface EventLogStore {
  getAll: () => Promise<EventLog[]>;
  getById: (id: string) => Promise<EventLog | null>;
  save: (event: EventLog) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export interface CreateEventInput {
  name: string;
  eventType: EventType;
  occurredAt: Date;
  description: string;
  tags: string[];
  memo?: string;
  urls?: string[];
}

export interface UpdateEventInput {
  name?: string;
  eventType?: EventType;
  occurredAt?: Date;
  description?: string;
  tags?: string[];
  memo?: string;
  urls?: string[];
  impactScore?: number;
}

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** In-memory implementation of EventLogStore */
export function createInMemoryEventStore(): EventLogStore {
  const events = new Map<string, EventLog>();

  return {
    getAll: async () => Array.from(events.values()),
    getById: async (id) => events.get(id) ?? null,
    save: async (event) => { events.set(event.id, event); },
    remove: async (id) => { events.delete(id); },
  };
}

/** Validate tags - at least 1 required (Req 11.8) */
function validateTags(tags: string[]): void {
  if (!tags || tags.length === 0) {
    throw new Error('At least one tag is required');
  }
}

/** Validate EventType */
function validateEventType(eventType: EventType): void {
  if (!ALL_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Invalid event type: ${eventType}`);
  }
}

export class EventLogEngine {
  constructor(private store: EventLogStore) {}

  /** Create a new event log (Req 11.1) */
  async create(input: CreateEventInput): Promise<EventLog> {
    validateEventType(input.eventType);
    validateTags(input.tags);

    const now = new Date();
    const event: EventLog = {
      id: generateId(),
      name: input.name,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      description: input.description,
      tags: input.tags,
      memo: input.memo,
      urls: input.urls ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await this.store.save(event);
    return event;
  }

  /** Update an existing event log (Req 11.3) */
  async update(id: string, input: UpdateEventInput): Promise<EventLog> {
    const existing = await this.store.getById(id);
    if (!existing) throw new Error(`Event ${id} not found`);

    if (input.eventType !== undefined) validateEventType(input.eventType);
    if (input.tags !== undefined) validateTags(input.tags);

    const updated: EventLog = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.eventType !== undefined && { eventType: input.eventType }),
      ...(input.occurredAt !== undefined && { occurredAt: input.occurredAt }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.memo !== undefined && { memo: input.memo }),
      ...(input.urls !== undefined && { urls: input.urls }),
      ...(input.impactScore !== undefined && { impactScore: input.impactScore }),
      updatedAt: new Date(),
    };

    await this.store.save(updated);
    return updated;
  }

  /** Delete an event log (Req 11.3) */
  async delete(id: string): Promise<void> {
    const existing = await this.store.getById(id);
    if (!existing) throw new Error(`Event ${id} not found`);
    await this.store.remove(id);
  }

  /** List events with pagination (Req 11.10, 11.13) */
  async list(
    filters: EventListFilters = {},
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResult<EventLog>> {
    const all = await this.store.getAll();
    const filtered = applyFilters(all, filters);
    const sorted = applySort(filtered, filters.sortBy, filters.sortOrder);

    const total = sorted.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return { items, total, page, pageSize, totalPages };
  }

  /** Get event by ID */
  async getById(id: string): Promise<EventLog> {
    const event = await this.store.getById(id);
    if (!event) throw new Error(`Event ${id} not found`);
    return event;
  }

  /** Get overlapping events within a window around a date (Req 13) */
  async getOverlappingEvents(
    date: Date,
    windowDays: number,
  ): Promise<EventLog[]> {
    const all = await this.store.getAll();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const dateMs = date.getTime();

    return all.filter((e) => {
      const eventMs = e.occurredAt.getTime();
      return Math.abs(eventMs - dateMs) <= windowMs;
    });
  }

  /** Get events by type and/or tags */
  async getByTypeAndTags(
    eventType?: EventType,
    tags?: string[],
  ): Promise<EventLog[]> {
    const all = await this.store.getAll();
    return all.filter((e) => {
      if (eventType && e.eventType !== eventType) return false;
      if (tags && tags.length > 0) {
        return tags.some((tag) => e.tags.includes(tag));
      }
      return true;
    });
  }
}

/** Apply filters to event list (Req 11.10) */
function applyFilters(
  events: EventLog[],
  filters: EventListFilters,
): EventLog[] {
  let result = events;

  // Filter by EventType
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    result = result.filter((e) => filters.eventTypes!.includes(e.eventType));
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    result = result.filter((e) =>
      filters.tags!.some((tag) => e.tags.includes(tag)),
    );
  }

  // Filter by date range
  if (filters.startDate) {
    const start = filters.startDate.getTime();
    result = result.filter((e) => e.occurredAt.getTime() >= start);
  }
  if (filters.endDate) {
    const end = filters.endDate.getTime();
    result = result.filter((e) => e.occurredAt.getTime() <= end);
  }

  return result;
}

/** Apply sort to event list (Req 11.13) */
function applySort(
  events: EventLog[],
  sortBy: EventListFilters['sortBy'] = 'occurredAt',
  sortOrder: EventListFilters['sortOrder'] = 'desc',
): EventLog[] {
  const sorted = [...events];
  const multiplier = sortOrder === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    if (sortBy === 'impactScore') {
      return ((a.impactScore ?? 0) - (b.impactScore ?? 0)) * multiplier;
    }
    return (a.occurredAt.getTime() - b.occurredAt.getTime()) * multiplier;
  });

  return sorted;
}

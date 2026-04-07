import { describe, it, expect } from 'vitest';
import {
  EventLogEngine,
  createInMemoryEventStore,
  DEFAULT_EVENT_TAGS,
  ALL_EVENT_TYPES,
} from './event-log-engine';

describe('EventLogEngine', () => {
  function createEngine() {
    return new EventLogEngine(createInMemoryEventStore());
  }

  it('has 7 event types', () => {
    expect(ALL_EVENT_TYPES).toHaveLength(7);
  });

  it('has 6 default tags', () => {
    expect(DEFAULT_EVENT_TAGS).toHaveLength(6);
  });

  it('creates an event with required fields', async () => {
    const engine = createEngine();
    const event = await engine.create({
      name: 'キャンペーン開始',
      eventType: 'campaign_start',
      occurredAt: new Date('2024-01-15'),
      description: 'テストキャンペーン',
      tags: ['キャンペーン'],
    });

    expect(event.id).toBeTruthy();
    expect(event.name).toBe('キャンペーン開始');
    expect(event.tags).toEqual(['キャンペーン']);
    expect(event.urls).toEqual([]);
  });

  it('rejects creation with empty tags', async () => {
    const engine = createEngine();
    await expect(
      engine.create({
        name: 'Test',
        eventType: 'incident',
        occurredAt: new Date(),
        description: 'desc',
        tags: [],
      }),
    ).rejects.toThrow('At least one tag is required');
  });

  it('rejects invalid event type', async () => {
    const engine = createEngine();
    await expect(
      engine.create({
        name: 'Test',
        eventType: 'invalid' as any,
        occurredAt: new Date(),
        description: 'desc',
        tags: ['障害'],
      }),
    ).rejects.toThrow('Invalid event type');
  });

  it('supports memo and multiple URLs', async () => {
    const engine = createEngine();
    const event = await engine.create({
      name: 'リリース',
      eventType: 'system_release',
      occurredAt: new Date(),
      description: 'v2.0',
      tags: ['システム変更'],
      memo: '重要なリリース',
      urls: ['https://example.com/1', 'https://example.com/2'],
    });

    expect(event.memo).toBe('重要なリリース');
    expect(event.urls).toHaveLength(2);
  });

  it('updates an event', async () => {
    const engine = createEngine();
    const event = await engine.create({
      name: 'Original',
      eventType: 'incident',
      occurredAt: new Date(),
      description: 'desc',
      tags: ['障害'],
    });

    const updated = await engine.update(event.id, {
      name: 'Updated',
      impactScore: 75,
    });

    expect(updated.name).toBe('Updated');
    expect(updated.impactScore).toBe(75);
  });

  it('deletes an event', async () => {
    const engine = createEngine();
    const event = await engine.create({
      name: 'ToDelete',
      eventType: 'other',
      occurredAt: new Date(),
      description: 'desc',
      tags: ['マーケ施策'],
    });

    await engine.delete(event.id);
    await expect(engine.getById(event.id)).rejects.toThrow('not found');
  });

  it('lists with EventType filter', async () => {
    const engine = createEngine();
    await engine.create({ name: 'A', eventType: 'incident', occurredAt: new Date(), description: 'd', tags: ['障害'] });
    await engine.create({ name: 'B', eventType: 'campaign_start', occurredAt: new Date(), description: 'd', tags: ['キャンペーン'] });

    const result = await engine.list({ eventTypes: ['incident'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('A');
  });

  it('lists with tag filter', async () => {
    const engine = createEngine();
    await engine.create({ name: 'A', eventType: 'incident', occurredAt: new Date(), description: 'd', tags: ['障害', 'システム変更'] });
    await engine.create({ name: 'B', eventType: 'other', occurredAt: new Date(), description: 'd', tags: ['キャンペーン'] });

    const result = await engine.list({ tags: ['システム変更'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('A');
  });

  it('sorts by occurredAt descending by default', async () => {
    const engine = createEngine();
    await engine.create({ name: 'Old', eventType: 'other', occurredAt: new Date('2024-01-01'), description: 'd', tags: ['障害'] });
    await engine.create({ name: 'New', eventType: 'other', occurredAt: new Date('2024-06-01'), description: 'd', tags: ['障害'] });

    const result = await engine.list();
    expect(result.items[0].name).toBe('New');
    expect(result.items[1].name).toBe('Old');
  });

  it('sorts by impactScore', async () => {
    const engine = createEngine();
    const e1 = await engine.create({ name: 'Low', eventType: 'other', occurredAt: new Date(), description: 'd', tags: ['障害'] });
    const e2 = await engine.create({ name: 'High', eventType: 'other', occurredAt: new Date(), description: 'd', tags: ['障害'] });
    await engine.update(e1.id, { impactScore: 20 });
    await engine.update(e2.id, { impactScore: 80 });

    const result = await engine.list({ sortBy: 'impactScore', sortOrder: 'desc' });
    expect(result.items[0].name).toBe('High');
  });

  it('filters by date range', async () => {
    const engine = createEngine();
    await engine.create({ name: 'Jan', eventType: 'other', occurredAt: new Date('2024-01-15'), description: 'd', tags: ['障害'] });
    await engine.create({ name: 'Jun', eventType: 'other', occurredAt: new Date('2024-06-15'), description: 'd', tags: ['障害'] });

    const result = await engine.list({
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-30'),
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Jun');
  });

  it('gets overlapping events', async () => {
    const engine = createEngine();
    await engine.create({ name: 'Near', eventType: 'other', occurredAt: new Date('2024-01-14'), description: 'd', tags: ['障害'] });
    await engine.create({ name: 'Far', eventType: 'other', occurredAt: new Date('2024-06-01'), description: 'd', tags: ['障害'] });

    const overlapping = await engine.getOverlappingEvents(new Date('2024-01-15'), 3);
    expect(overlapping).toHaveLength(1);
    expect(overlapping[0].name).toBe('Near');
  });

  it('gets events by type and tags', async () => {
    const engine = createEngine();
    await engine.create({ name: 'A', eventType: 'incident', occurredAt: new Date(), description: 'd', tags: ['障害'] });
    await engine.create({ name: 'B', eventType: 'incident', occurredAt: new Date(), description: 'd', tags: ['システム変更'] });
    await engine.create({ name: 'C', eventType: 'campaign_start', occurredAt: new Date(), description: 'd', tags: ['障害'] });

    const result = await engine.getByTypeAndTags('incident', ['障害']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
});

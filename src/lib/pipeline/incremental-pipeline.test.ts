import { describe, it, expect, vi } from 'vitest';
import { IncrementalPipeline, type IncrementalPipelineStore } from './incremental-pipeline';
import { RateLimitManager } from './rate-limit-manager';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createMockStore(cursor = 0): IncrementalPipelineStore {
  return {
    getLastCursor: vi.fn().mockResolvedValue(cursor),
    saveCursor: vi.fn().mockResolvedValue(undefined),
    mergeTickets: vi.fn().mockResolvedValue({
      insertedCount: 0,
      updatedCount: 0,
      totalProcessed: 0,
    }),
    updatePipelineState: vi.fn().mockResolvedValue(undefined),
  };
}

function createIncrementalResponse(
  tickets: Array<Record<string, unknown>>,
  endOfStream = true,
  afterCursor = '1704067200',
) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'x-rate-limit': '200',
      'x-rate-limit-remaining': '180',
    }),
    json: () => Promise.resolve({
      tickets,
      end_of_stream: endOfStream,
      after_cursor: afterCursor,
      after_url: endOfStream ? null : 'https://test.zendesk.com/api/v2/incremental/tickets/cursor.json?cursor=abc',
      count: tickets.length,
    }),
  };
}

function makeApiTicket(id: number, status = 'open', category = 'billing') {
  return {
    id,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T12:00:00Z',
    subject: `Ticket ${id}`,
    description: `Description for ticket ${id}`,
    custom_fields: [
      { id: 360000000001, value: category },
      { id: 360000000002, value: status },
    ],
    fields: [],
    status: 'open',
  };
}

describe('IncrementalPipeline', () => {
  it('should fetch incremental tickets and merge into store', async () => {
    const store = createMockStore(1704000000);
    const rateLimitManager = new RateLimitManager();

    mockFetch.mockResolvedValueOnce(
      createIncrementalResponse([
        makeApiTicket(10, 'open'),
        makeApiTicket(11, 'Z完了'),
      ]),
    );

    const pipeline = new IncrementalPipeline(
      {
        zendeskConfig: { subdomain: 'test', apiToken: 'token', userEmail: 'test@example.com' },
        intervalMinutes: 15,
        cursorStorageKey: 'default',
      },
      store,
      rateLimitManager,
    );

    const result = await pipeline.execute();

    expect(result.ticketsFetched).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(store.getLastCursor).toHaveBeenCalledWith('default');
    expect(store.mergeTickets).toHaveBeenCalledOnce();
    expect(store.saveCursor).toHaveBeenCalledOnce();
    expect(store.updatePipelineState).toHaveBeenCalledOnce();
  });

  it('should handle cursor read errors', async () => {
    const store = createMockStore();
    (store.getLastCursor as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

    const pipeline = new IncrementalPipeline(
      {
        zendeskConfig: { subdomain: 'test', apiToken: 'token', userEmail: 'test@example.com' },
        intervalMinutes: 15,
        cursorStorageKey: 'default',
      },
      store,
    );

    const result = await pipeline.execute();

    expect(result.ticketsFetched).toBe(0);
    expect(result.errors.some((e) => e.phase === 'cursor_read')).toBe(true);
  });

  it('should handle fetch errors gracefully', async () => {
    const store = createMockStore(1704000000);
    const rateLimitManager = new RateLimitManager({ maxRetries: 1 });

    mockFetch.mockRejectedValue(new Error('Network error'));

    const pipeline = new IncrementalPipeline(
      {
        zendeskConfig: { subdomain: 'test', apiToken: 'token', userEmail: 'test@example.com' },
        intervalMinutes: 15,
        cursorStorageKey: 'default',
      },
      store,
      rateLimitManager,
    );

    const result = await pipeline.execute();

    expect(result.ticketsFetched).toBe(0);
    expect(result.errors.some((e) => e.phase === 'fetch')).toBe(true);
  });
});

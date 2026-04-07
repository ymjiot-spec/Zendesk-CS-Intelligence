import { describe, it, expect, vi } from 'vitest';
import { BatchPipeline, type BatchPipelineStore } from './batch-pipeline';
import { RateLimitManager } from './rate-limit-manager';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createMockStore(): BatchPipelineStore {
  return {
    upsertTickets: vi.fn().mockResolvedValue(undefined),
    updatePipelineState: vi.fn().mockResolvedValue(undefined),
  };
}

function createZendeskResponse(tickets: Array<Record<string, unknown>>, nextPage: string | null = null) {
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
      next_page: nextPage,
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

describe('BatchPipeline', () => {
  it('should fetch, filter, and save tickets', async () => {
    const store = createMockStore();
    const rateLimitManager = new RateLimitManager();

    mockFetch.mockResolvedValueOnce(
      createZendeskResponse([
        makeApiTicket(1, 'open'),
        makeApiTicket(2, 'Z完了'),
        makeApiTicket(3, 'pending'),
      ]),
    );

    const pipeline = new BatchPipeline(
      {
        zendeskConfig: { subdomain: 'test', apiToken: 'token', userEmail: 'test@example.com' },
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      store,
      rateLimitManager,
    );

    const result = await pipeline.execute();

    expect(result.totalTicketsFetched).toBe(3);
    expect(result.populationCount).toBe(2);
    expect(result.excludedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(store.upsertTickets).toHaveBeenCalledOnce();
    expect(store.updatePipelineState).toHaveBeenCalledOnce();
  });

  it('should handle fetch errors gracefully', async () => {
    const store = createMockStore();
    const rateLimitManager = new RateLimitManager({ maxRetries: 1 });

    mockFetch.mockRejectedValue(new Error('Network error'));

    const pipeline = new BatchPipeline(
      {
        zendeskConfig: { subdomain: 'test', apiToken: 'token', userEmail: 'test@example.com' },
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      store,
      rateLimitManager,
    );

    const result = await pipeline.execute();

    expect(result.totalTicketsFetched).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].phase).toBe('fetch');
  });

  it('should handle store save errors', async () => {
    const store = createMockStore();
    (store.upsertTickets as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));
    const rateLimitManager = new RateLimitManager();

    mockFetch.mockResolvedValueOnce(
      createZendeskResponse([makeApiTicket(1)]),
    );

    const pipeline = new BatchPipeline(
      {
        zendeskConfig: { subdomain: 'test', apiToken: 'token', userEmail: 'test@example.com' },
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      store,
      rateLimitManager,
    );

    const result = await pipeline.execute();

    expect(result.totalTicketsFetched).toBe(1);
    expect(result.errors.some((e) => e.phase === 'save')).toBe(true);
  });
});

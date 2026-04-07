/**
 * IncrementalPipeline - 増分取得パイプライン
 *
 * Zendesk Incremental Exports APIを使用し、前回カーソル以降の
 * 更新チケットのみを取得する。カーソル管理（pipeline_stateテーブル）、
 * マージ処理を実装する。
 *
 * Requirements: 16.2, 16.3, 17.1
 */

import type { RawTicket } from '@/types';
import { filterPopulation } from './population-filter';
import { RateLimitManager } from './rate-limit-manager';
import { ZendeskClient, type ZendeskClientConfig, type ZendeskFieldMapping } from './zendesk-client';

export interface IncrementalPipelineConfig {
  zendeskConfig: ZendeskClientConfig;
  fieldMapping?: Partial<ZendeskFieldMapping>;
  /** Interval in minutes between incremental fetches (default: 15) */
  intervalMinutes: number;
  /** Key used to store/retrieve cursor in pipeline_state table */
  cursorStorageKey: string;
}

export interface MergeResult {
  insertedCount: number;
  updatedCount: number;
  totalProcessed: number;
}

export interface IncrementalFetchResult {
  ticketsFetched: number;
  mergeResult: MergeResult;
  newCursor: string;
  errors: Array<{ phase: string; message: string; timestamp: Date }>;
}

export interface IncrementalPipelineStore {
  /** Get the last cursor from pipeline_state */
  getLastCursor(key: string): Promise<number>;

  /** Save the cursor to pipeline_state */
  saveCursor(key: string, cursor: number): Promise<void>;

  /** Merge tickets into the store (upsert by zendeskTicketId) */
  mergeTickets(tickets: Array<{
    zendeskTicketId: string;
    createdAt: Date;
    updatedAt: Date;
    inquiryCategory: string;
    ticketStatus: string;
    subject: string;
    description: string;
    isExcluded: boolean;
    fetchedAt: Date;
  }>): Promise<MergeResult>;

  /** Update the pipeline state after an incremental run */
  updatePipelineState(state: {
    lastIncrementalRunAt: Date;
    lastIncrementalCursor: number;
    dataSourceStatus: Record<string, unknown>;
  }): Promise<void>;
}

const DEFAULT_CONFIG: Partial<IncrementalPipelineConfig> = {
  intervalMinutes: 15,
  cursorStorageKey: 'default',
};

export class IncrementalPipeline {
  private client: ZendeskClient;
  private rateLimitManager: RateLimitManager;
  private store: IncrementalPipelineStore;
  private config: IncrementalPipelineConfig;

  constructor(
    config: IncrementalPipelineConfig,
    store: IncrementalPipelineStore,
    rateLimitManager?: RateLimitManager,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as IncrementalPipelineConfig;
    this.rateLimitManager = rateLimitManager ?? new RateLimitManager();
    this.client = new ZendeskClient(
      config.zendeskConfig,
      this.rateLimitManager,
      config.fieldMapping,
    );
    this.store = store;
  }

  /**
   * Execute the incremental pipeline:
   * 1. Get last cursor from pipeline_state
   * 2. Fetch incremental tickets from Zendesk
   * 3. Apply population filter
   * 4. Merge into store
   * 5. Save new cursor
   */
  async execute(): Promise<IncrementalFetchResult> {
    const errors: Array<{ phase: string; message: string; timestamp: Date }> = [];
    let allTickets: RawTicket[] = [];
    let finalCursor = '';

    // Step 1: Get last cursor
    let cursor: number;
    try {
      cursor = await this.getLastCursor();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ phase: 'cursor_read', message, timestamp: new Date() });
      return {
        ticketsFetched: 0,
        mergeResult: { insertedCount: 0, updatedCount: 0, totalProcessed: 0 },
        newCursor: '',
        errors,
      };
    }

    // Step 2: Fetch incremental tickets (loop until end of stream)
    try {
      let endOfStream = false;
      let currentCursor = cursor;

      while (!endOfStream) {
        const result = await this.fetchIncremental(currentCursor);
        allTickets.push(...result.tickets);
        finalCursor = result.afterCursor;
        endOfStream = result.endOfStream;

        if (!endOfStream) {
          currentCursor = parseInt(result.afterCursor, 10);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ phase: 'fetch', message, timestamp: new Date() });
      if (allTickets.length === 0) {
        return {
          ticketsFetched: 0,
          mergeResult: { insertedCount: 0, updatedCount: 0, totalProcessed: 0 },
          newCursor: finalCursor,
          errors,
        };
      }
      // Continue with partial data if we have some tickets
    }

    // Step 3: Apply population filter
    const filterResult = filterPopulation(allTickets);

    // Step 4: Merge into store
    let mergeResult: MergeResult = { insertedCount: 0, updatedCount: 0, totalProcessed: 0 };
    try {
      mergeResult = await this.mergeIntoStore(filterResult.filtered.map((ticket) => ({
        zendeskTicketId: ticket.zendeskTicketId,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        inquiryCategory: ticket.inquiryCategory,
        ticketStatus: ticket.ticketStatus,
        subject: ticket.subject,
        description: ticket.description,
        isExcluded: ticket.isExcluded,
        fetchedAt: new Date(),
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ phase: 'merge', message, timestamp: new Date() });
    }

    // Step 5: Save new cursor
    if (finalCursor) {
      try {
        await this.saveCursor(parseInt(finalCursor, 10));
        await this.store.updatePipelineState({
          lastIncrementalRunAt: new Date(),
          lastIncrementalCursor: parseInt(finalCursor, 10),
          dataSourceStatus: {
            incrementalApi: 'success',
            lastFetchCount: allTickets.length,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ phase: 'cursor_save', message, timestamp: new Date() });
      }
    }

    return {
      ticketsFetched: allTickets.length,
      mergeResult,
      newCursor: finalCursor,
      errors,
    };
  }

  /**
   * Fetch tickets incrementally from Zendesk since the given timestamp.
   */
  async fetchIncremental(sinceTimestamp: number): Promise<{
    tickets: RawTicket[];
    endOfStream: boolean;
    afterCursor: string;
  }> {
    return this.client.fetchIncremental(sinceTimestamp);
  }

  /**
   * Merge tickets into the store (upsert).
   */
  async mergeIntoStore(tickets: Array<{
    zendeskTicketId: string;
    createdAt: Date;
    updatedAt: Date;
    inquiryCategory: string;
    ticketStatus: string;
    subject: string;
    description: string;
    isExcluded: boolean;
    fetchedAt: Date;
  }>): Promise<MergeResult> {
    return this.store.mergeTickets(tickets);
  }

  /**
   * Get the last cursor from the pipeline_state table.
   */
  async getLastCursor(): Promise<number> {
    return this.store.getLastCursor(this.config.cursorStorageKey);
  }

  /**
   * Save the cursor to the pipeline_state table.
   */
  async saveCursor(cursor: number): Promise<void> {
    return this.store.saveCursor(this.config.cursorStorageKey, cursor);
  }
}

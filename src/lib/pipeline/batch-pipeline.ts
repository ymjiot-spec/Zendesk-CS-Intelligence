/**
 * BatchPipeline - バッチパイプライン
 *
 * 日次で全チケットデータをZendesk REST APIから取得し、
 * filterPopulationを適用してDBに保存する。最終更新日時を記録する。
 *
 * Requirements: 16.1, 16.6, 17.1, 17.2
 */

import type { RawTicket } from '@/types';
import { filterPopulation } from './population-filter';
import { RateLimitManager } from './rate-limit-manager';
import { ZendeskClient, type ZendeskClientConfig, type ZendeskFieldMapping } from './zendesk-client';

export interface BatchPipelineConfig {
  zendeskConfig: ZendeskClientConfig;
  fieldMapping?: Partial<ZendeskFieldMapping>;
  /** Date range start for fetching tickets */
  startDate: Date;
  /** Date range end for fetching tickets */
  endDate: Date;
}

export interface PipelineError {
  phase: string;
  message: string;
  timestamp: Date;
}

export interface BatchPipelineResult {
  totalTicketsFetched: number;
  populationCount: number;
  excludedCount: number;
  lastUpdatedAt: Date;
  errors: PipelineError[];
}

export interface BatchPipelineStore {
  /** Upsert tickets into the store (insert or update by zendeskTicketId) */
  upsertTickets(tickets: Array<{
    zendeskTicketId: string;
    createdAt: Date;
    updatedAt: Date;
    inquiryCategory: string;
    ticketStatus: string;
    subject: string;
    description: string;
    isExcluded: boolean;
    fetchedAt: Date;
  }>): Promise<void>;

  /** Update the pipeline state after a batch run */
  updatePipelineState(state: {
    lastBatchRunAt: Date;
    dataSourceStatus: Record<string, unknown>;
  }): Promise<void>;
}

export class BatchPipeline {
  private client: ZendeskClient;
  private rateLimitManager: RateLimitManager;
  private store: BatchPipelineStore;
  private config: BatchPipelineConfig;

  constructor(config: BatchPipelineConfig, store: BatchPipelineStore, rateLimitManager?: RateLimitManager) {
    this.config = config;
    this.rateLimitManager = rateLimitManager ?? new RateLimitManager();
    this.client = new ZendeskClient(
      config.zendeskConfig,
      this.rateLimitManager,
      config.fieldMapping,
    );
    this.store = store;
  }

  /**
   * Execute the full batch pipeline:
   * 1. Fetch all tickets from Zendesk
   * 2. Apply population filter
   * 3. Save to DB
   * 4. Record lastUpdatedAt
   */
  async execute(): Promise<BatchPipelineResult> {
    const errors: PipelineError[] = [];
    let rawTickets: RawTicket[] = [];

    // Step 1: Fetch all tickets
    try {
      rawTickets = await this.fetchAllTickets(this.config.startDate, this.config.endDate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        phase: 'fetch',
        message: `Failed to fetch tickets: ${message}`,
        timestamp: new Date(),
      });
      return {
        totalTicketsFetched: 0,
        populationCount: 0,
        excludedCount: 0,
        lastUpdatedAt: new Date(),
        errors,
      };
    }

    // Step 2: Apply population filter
    const filterResult = filterPopulation(rawTickets);

    // Step 3: Save to DB
    try {
      await this.store.upsertTickets(
        filterResult.filtered.map((ticket) => ({
          zendeskTicketId: ticket.zendeskTicketId,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          inquiryCategory: ticket.inquiryCategory,
          ticketStatus: ticket.ticketStatus,
          subject: ticket.subject,
          description: ticket.description,
          isExcluded: ticket.isExcluded,
          fetchedAt: new Date(),
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        phase: 'save',
        message: `Failed to save tickets: ${message}`,
        timestamp: new Date(),
      });
    }

    // Step 4: Record pipeline state
    const lastUpdatedAt = new Date();
    try {
      await this.store.updatePipelineState({
        lastBatchRunAt: lastUpdatedAt,
        dataSourceStatus: {
          ticketsApi: 'success',
          lastFetchCount: rawTickets.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        phase: 'state_update',
        message: `Failed to update pipeline state: ${message}`,
        timestamp: new Date(),
      });
    }

    return {
      totalTicketsFetched: rawTickets.length,
      populationCount: filterResult.populationCount,
      excludedCount: filterResult.excludedCount,
      lastUpdatedAt,
      errors,
    };
  }

  /**
   * Fetch all tickets from Zendesk within the date range.
   * Fields: createdAt, updatedAt, inquiryCategory, ticketStatus, ticketId, subject, description
   */
  async fetchAllTickets(startDate: Date, endDate: Date): Promise<RawTicket[]> {
    return this.client.fetchAllTickets(startDate, endDate);
  }
}

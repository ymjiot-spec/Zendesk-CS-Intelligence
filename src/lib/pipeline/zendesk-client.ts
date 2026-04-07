/**
 * ZendeskClient - Zendesk API クライアント抽象化
 *
 * Zendesk REST API (Tickets API / Search API / Incremental Exports API) への
 * アクセスを抽象化する。サブドメイン・トークンで設定可能。
 * RateLimitManagerと連携してレート制限を管理する。
 */

import type { RawTicket } from '@/types';
import { RateLimitManager, type ZendeskResponseHeaders } from './rate-limit-manager';

export interface ZendeskClientConfig {
  subdomain: string;
  apiToken: string;
  userEmail: string;
}

export interface ZendeskTicketResponse {
  tickets: ZendeskApiTicket[];
  next_page: string | null;
  count: number;
}

export interface ZendeskIncrementalResponse {
  tickets: ZendeskApiTicket[];
  end_of_stream: boolean;
  after_cursor: string;
  after_url: string | null;
  count: number;
}

export interface ZendeskApiTicket {
  id: number;
  created_at: string;
  updated_at: string;
  subject: string;
  description: string;
  custom_fields: Array<{
    id: number;
    value: string | null;
  }>;
  fields: Array<{
    id: number;
    value: string | null;
  }>;
  status: string;
}

/** Custom field IDs for Zendesk (configurable) */
export interface ZendeskFieldMapping {
  inquiryCategoryFieldId: number;
  ticketStatusFieldId: number;
}

const DEFAULT_FIELD_MAPPING: ZendeskFieldMapping = {
  inquiryCategoryFieldId: 360000000001,
  ticketStatusFieldId: 360000000002,
};

export class ZendeskClient {
  private config: ZendeskClientConfig;
  private rateLimitManager: RateLimitManager;
  private fieldMapping: ZendeskFieldMapping;
  private baseUrl: string;

  constructor(
    config: ZendeskClientConfig,
    rateLimitManager: RateLimitManager,
    fieldMapping: Partial<ZendeskFieldMapping> = {},
  ) {
    this.config = config;
    this.rateLimitManager = rateLimitManager;
    this.fieldMapping = { ...DEFAULT_FIELD_MAPPING, ...fieldMapping };
    this.baseUrl = `https://${config.subdomain}.zendesk.com/api/v2`;
  }

  /**
   * Fetch all tickets within a date range using the Search API.
   * Handles pagination automatically.
   */
  async fetchAllTickets(startDate: Date, endDate: Date): Promise<RawTicket[]> {
    const allTickets: RawTicket[] = [];
    const query = `type:ticket created>=${this.formatDate(startDate)} created<=${this.formatDate(endDate)}`;
    let url: string | null = `${this.baseUrl}/search.json?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=asc`;

    while (url) {
      await this.rateLimitManager.checkAndWait();

      const response: { data: ZendeskTicketResponse; headers: ZendeskResponseHeaders } = await this.makeRequest<ZendeskTicketResponse>(url);
      const mapped = response.data.tickets.map((t: ZendeskApiTicket) => this.mapToRawTicket(t));
      allTickets.push(...mapped);

      url = response.data.next_page;
    }

    return allTickets;
  }

  /**
   * Fetch tickets incrementally using the Incremental Exports API.
   * Returns tickets updated since the given cursor (Unix timestamp).
   */
  async fetchIncremental(cursor: number): Promise<{
    tickets: RawTicket[];
    endOfStream: boolean;
    afterCursor: string;
  }> {
    await this.rateLimitManager.checkAndWait();

    const url = `${this.baseUrl}/incremental/tickets/cursor.json?start_time=${cursor}`;
    const response = await this.makeRequest<ZendeskIncrementalResponse>(url);

    const tickets = response.data.tickets.map((t) => this.mapToRawTicket(t));

    return {
      tickets,
      endOfStream: response.data.end_of_stream,
      afterCursor: response.data.after_cursor,
    };
  }

  /**
   * Make an authenticated request to the Zendesk API with retry logic.
   */
  private async makeRequest<T>(url: string): Promise<{ data: T; headers: ZendeskResponseHeaders }> {
    let lastError: Error | null = null;

    for (let retryCount = 0; ; retryCount++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${this.encodeCredentials()}`,
            'Content-Type': 'application/json',
          },
        });

        const rateLimitHeaders = this.extractRateLimitHeaders(response.headers);
        this.rateLimitManager.updateFromHeaders(rateLimitHeaders);

        if (response.status === 429) {
          // Rate limited - use backoff
          const delay = this.rateLimitManager.getBackoffDelay(retryCount);
          if (delay === -1) {
            throw new Error(`Rate limited: max retries (${retryCount}) exceeded`);
          }
          await this.sleep(delay);
          continue;
        }

        if (!response.ok) {
          throw new Error(`Zendesk API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as T;
        return { data, headers: rateLimitHeaders };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = this.rateLimitManager.getBackoffDelay(retryCount);
        if (delay === -1) {
          break;
        }
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('Request failed after max retries');
  }

  /**
   * Map a Zendesk API ticket to our RawTicket type.
   */
  private mapToRawTicket(apiTicket: ZendeskApiTicket): RawTicket {
    const inquiryCategory = this.getCustomFieldValue(
      apiTicket,
      this.fieldMapping.inquiryCategoryFieldId,
    ) ?? '';

    const ticketStatus = this.getCustomFieldValue(
      apiTicket,
      this.fieldMapping.ticketStatusFieldId,
    ) ?? apiTicket.status;

    return {
      id: String(apiTicket.id),
      zendeskTicketId: String(apiTicket.id),
      createdAt: new Date(apiTicket.created_at),
      updatedAt: new Date(apiTicket.updated_at),
      inquiryCategory,
      ticketStatus,
      subject: apiTicket.subject ?? '',
      description: apiTicket.description ?? '',
      fetchedAt: new Date(),
    };
  }

  private getCustomFieldValue(
    ticket: ZendeskApiTicket,
    fieldId: number,
  ): string | null {
    const fields = ticket.custom_fields ?? ticket.fields ?? [];
    const field = fields.find((f) => f.id === fieldId);
    return field?.value ?? null;
  }

  private encodeCredentials(): string {
    const credentials = `${this.config.userEmail}/token:${this.config.apiToken}`;
    // In Node.js, use Buffer; in browser, use btoa
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(credentials).toString('base64');
    }
    return btoa(credentials);
  }

  private extractRateLimitHeaders(headers: Headers): ZendeskResponseHeaders {
    return {
      'x-rate-limit': headers.get('x-rate-limit') ?? '200',
      'x-rate-limit-remaining': headers.get('x-rate-limit-remaining') ?? '200',
      'retry-after': headers.get('retry-after') ?? undefined,
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import type { ZendeskSourceConfig } from './config';

export interface ZendeskTicket {
  id: number;
  created_at: string;
  updated_at: string;
  status: string;
  subject: string;
  description: string;
  tags: string[];
  via?: { channel: string };
  custom_fields?: { id: number; value: string | null }[];
}

export interface ZendeskTicketsResponse {
  tickets: ZendeskTicket[];
  next_page: string | null;
  count: number;
  after_cursor?: string | null;
}

export class ZendeskClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: ZendeskSourceConfig) {
    this.baseUrl = `https://${config.subdomain}.zendesk.com/api/v2`;
    const credentials = Buffer.from(`${config.email}/token:${config.token}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  private async fetch<T>(path: string, maxRetries = 3): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
        console.log(`[Rate Limited] Waiting ${retryAfter}s before retry (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Zendesk API error ${res.status}: ${text}`);
      }
      return res.json() as Promise<T>;
    }
    throw new Error(`Zendesk API: max retries exceeded after 429 rate limiting`);
  }

  /** 更新日時でフィルタしてチケットを取得 */
  async fetchTicketsUpdatedAfter(
    cursor?: string,
    startTime?: string
  ): Promise<{ tickets: ZendeskTicket[]; afterCursor: string | null }> {
    let path: string;
    if (cursor) {
      path = `/incremental/tickets/cursor.json?cursor=${cursor}`;
    } else {
      const since = startTime ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      path = `/incremental/tickets/cursor.json?start_time=${Math.floor(new Date(since).getTime() / 1000)}`;
    }

    const data = await this.fetch<{
      tickets: ZendeskTicket[];
      after_cursor?: string | null;
      end_of_stream?: boolean;
    }>(path);

    return {
      tickets: data.tickets ?? [],
      afterCursor: data.after_cursor ?? null,
    };
  }

  /** カテゴリフィールドのIDを取得（最初のドロップダウンカスタムフィールド） */
  async getCategoryFieldId(): Promise<number | null> {
    try {
      const data = await this.fetch<{ ticket_fields: { id: number; type: string; title: string }[] }>(
        '/ticket_fields.json'
      );
      const field = data.ticket_fields.find(
        (f) => f.type === 'tagger' || f.title.includes('カテゴリ') || f.title.toLowerCase().includes('category')
      );
      return field?.id ?? null;
    } catch {
      return null;
    }
  }
}

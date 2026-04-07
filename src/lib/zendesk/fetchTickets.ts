import 'dotenv/config';
import prisma from '@/lib/prisma';
import { ZendeskClient } from '@/lib/zendesk/client';
import type { ZendeskSourceConfig } from '@/lib/zendesk/config';

/** 1社分のチケットを取得してDBにupsert */
export async function fetchAndSaveTickets(source: ZendeskSourceConfig): Promise<number> {
  const client = new ZendeskClient(source);

  // PipelineStateから前回カーソルを取得
  const state = await prisma.pipelineState.findUnique({
    where: { id: source.key },
  });

  const cursor = (state?.dataSourceStatus as Record<string, string | undefined>)?.[source.key + '_cursor'];

  let savedCount = 0;
  let afterCursor: string | null = cursor ?? null;
  let hasMore = true;
  let batchCount = 0;
  const MAX_BATCHES = 50; // 無限ループ防止

  while (hasMore && batchCount < MAX_BATCHES) {
    const result = await client.fetchTicketsUpdatedAfter(afterCursor ?? undefined);
    const tickets = result.tickets;

    if (tickets.length === 0) {
      hasMore = false;
      break;
    }

    // バッチupsert
    for (const t of tickets) {
      const category = t.tags?.[0] ?? 'その他';
      await prisma.ticket.upsert({
        where: {
          uq_tickets_source_zendesk_id: {
            sourceKey: source.key,
            zendeskTicketId: String(t.id),
          },
        },
        update: {
          updatedAt: new Date(t.updated_at),
          ticketStatus: t.status,
          inquiryCategory: category,
          fetchedAt: new Date(),
        },
        create: {
          sourceKey: source.key,
          zendeskTicketId: String(t.id),
          createdAt: new Date(t.created_at),
          updatedAt: new Date(t.updated_at),
          inquiryCategory: category,
          ticketStatus: t.status,
          subject: t.subject ?? '',
          description: t.description ?? '',
          fetchedAt: new Date(),
        },
      });
      savedCount++;
    }

    afterCursor = result.afterCursor;
    hasMore = !!afterCursor;
    batchCount++;
  }

  // カーソルを保存
  await prisma.pipelineState.upsert({
    where: { id: source.key },
    update: {
      dataSourceStatus: { [source.key + '_cursor']: afterCursor ?? '' },
      lastIncrementalRunAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      id: source.key,
      dataSourceStatus: { [source.key + '_cursor']: afterCursor ?? '' },
      lastIncrementalRunAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return savedCount;
}

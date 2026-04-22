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
      // カスタムフィールドから「お問い合わせ項目」を取得
      let category = 'その他';
      if (source.inquiryFieldId) {
        const fields = t.custom_fields ?? [];
        const field = fields.find((f: any) => f.id === source.inquiryFieldId);
        if (field?.value) {
          category = String(field.value);
        }
      } else {
        category = t.tags?.[0] ?? 'その他';
      }

      // カスタムフィールドから「チケットステータス」を取得
      let ticketStatus = t.status ?? 'open';
      if (source.statusFieldId) {
        const fields = t.custom_fields ?? (t as any).fields ?? [];
        const field = fields.find((f: any) => f.id === source.statusFieldId);
        if (field?.value) {
          ticketStatus = String(field.value);
        }
        // デバッグ: 最初の1件だけログ
        if (savedCount === 0) {
          console.log(`[DEBUG] statusFieldId=${source.statusFieldId}, found=${!!field}, value=${field?.value}, fields_count=${fields.length}`);
        }
      }
      // Z始まりのチケットステータスは除外
      const isExcluded = ticketStatus.toLowerCase().startsWith('z');

      // コールセンター判定（通話コードフィールドに値があればCC）
      let channelType = 'ticket';
      let firstCommentAt: Date | null = null;
      if (source.ccFieldId) {
        const fields = t.custom_fields ?? (t as any).fields ?? [];
        const ccField = fields.find((f: any) => f.id === source.ccFieldId);
        if (ccField?.value && String(ccField.value).trim() !== '') {
          channelType = 'call_center';
          // first_comment_atは別バッチで取得（同期時はスキップ）
        }
      }

      await prisma.ticket.upsert({
        where: {
          uq_tickets_source_zendesk_id: {
            sourceKey: source.key,
            zendeskTicketId: String(t.id),
          },
        },
        update: {
          updatedAt: new Date(t.updated_at),
          ticketStatus: ticketStatus,
          inquiryCategory: category,
          isExcluded: isExcluded,
          channelType: channelType,
          firstCommentAt: firstCommentAt,
          fetchedAt: new Date(),
        },
        create: {
          sourceKey: source.key,
          zendeskTicketId: String(t.id),
          createdAt: new Date(t.created_at),
          updatedAt: new Date(t.updated_at),
          inquiryCategory: category,
          ticketStatus: ticketStatus,
          subject: t.subject ?? '',
          description: t.description ?? '',
          isExcluded: isExcluded,
          channelType: channelType,
          firstCommentAt: firstCommentAt,
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

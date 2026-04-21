/**
 * コールセンターチケットの最初のコメント日時を取得してDBを更新する
 * first_comment_at が未設定のコールセンターチケットのみ対象
 */

import prisma from '@/lib/prisma';
import { ZendeskClient } from './client';
import type { ZendeskSourceConfig } from './config';

const MAX_PER_RUN = 20; // 1回の実行で処理する最大チケット数（レート制限対策）

export async function updateFirstCommentDates(source: ZendeskSourceConfig): Promise<number> {
  const client = new ZendeskClient(source);

  // first_comment_at が未設定のコールセンターチケットを取得
  const tickets = await prisma.ticket.findMany({
    where: {
      sourceKey: source.key,
      channelType: 'call_center',
      firstCommentAt: null,
    },
    select: { id: true, zendeskTicketId: true },
    take: MAX_PER_RUN,
    orderBy: { createdAt: 'desc' },
  });

  let updated = 0;
  for (const ticket of tickets) {
    try {
      const firstCommentDate = await client.getFirstCommentDate(ticket.zendeskTicketId);
      if (firstCommentDate) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { firstCommentAt: firstCommentDate },
        });
        updated++;
      }
    } catch (err) {
      console.error(`Failed to get first comment for ticket ${ticket.zendeskTicketId}:`, err);
      break; // レート制限の可能性があるので中断
    }
  }

  console.log(`[FirstComment] ${source.name}: updated ${updated}/${tickets.length} tickets`);
  return updated;
}

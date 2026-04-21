import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getZendeskSources } from '@/lib/zendesk/config';
import { ZendeskClient } from '@/lib/zendesk/client';

/**
 * POST /api/pipeline/fetch-comments
 * コールセンターチケットの最初のコメント日時を取得して保存する
 * first_comment_atが未設定のCCチケットのみ対象
 */
export async function POST() {
  try {
    const sources = getZendeskSources();
    let totalUpdated = 0;

    for (const source of sources) {
      const client = new ZendeskClient(source);

      // first_comment_atが未設定のCCチケットを取得（最大50件ずつ）
      const tickets = await prisma.ticket.findMany({
        where: {
          sourceKey: source.key,
          channelType: 'call_center',
          firstCommentAt: null,
        },
        select: { id: true, zendeskTicketId: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      for (const ticket of tickets) {
        try {
          const commentDate = await client.fetchFirstCommentDate(ticket.zendeskTicketId);
          if (commentDate) {
            await prisma.ticket.update({
              where: { id: ticket.id },
              data: { firstCommentAt: commentDate },
            });
            totalUpdated++;
          }
        } catch (err) {
          console.error(`Failed to fetch comments for ticket ${ticket.zendeskTicketId}:`, err);
        }
      }
    }

    return NextResponse.json({ success: true, updated: totalUpdated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

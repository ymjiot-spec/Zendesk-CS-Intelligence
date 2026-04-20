import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jstDateRange } from '@/lib/date-jst';
import { buildBaseWhere } from '@/lib/dashboard-query';

const SOURCE_NAME_MAP: Record<string, string> = {
  starservicesupport: 'STAR',
  dmobilehelp: 'JTBC',
  jcnhelp: 'JCN',
  mpcahelp: 'MPCA',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';
    const channel = searchParams.get('channel') ?? 'all';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate required' },
        { status: 400 },
      );
    }

    const range = jstDateRange(startDate, endDate);
    const baseWhere = await buildBaseWhere(source, channel, range);

    // クレーム = チケットステータスが a： or b： で始まるもの
    // buildBaseWhereのis_excluded条件を外す（クレームはZ始まりではないので除外されてないが、念のため）
    const sourceWhere = source !== 'ALL' ? { sourceKey: source } : {};
    const channelWhere = channel === 'call_center' ? { channelType: 'call_center' } : channel === 'ticket' ? { channelType: 'ticket' } : {};

    const tickets = await prisma.ticket.findMany({
      where: {
        ...sourceWhere,
        ...channelWhere,
        createdAt: range,
        OR: [
          { ticketStatus: { startsWith: 'a：' } },
          { ticketStatus: { startsWith: 'b：' } },
          { ticketStatus: { startsWith: 'a:' } },
          { ticketStatus: { startsWith: 'b:' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        zendeskTicketId: true,
        sourceKey: true,
        subject: true,
        inquiryCategory: true,
        ticketStatus: true,
        createdAt: true,
      },
    });

    const data = tickets.map((t) => ({
      ticketId: t.zendeskTicketId,
      company: SOURCE_NAME_MAP[t.sourceKey] ?? t.sourceKey,
      subject: t.subject,
      category: t.inquiryCategory,
      status: t.ticketStatus,
      createdAt: t.createdAt,
      zendeskUrl: `https://${t.sourceKey}.zendesk.com/agent/tickets/${t.zendeskTicketId}`,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, data: [], error: error instanceof Error ? error.message : 'error' },
      { status: 500 },
    );
  }
}

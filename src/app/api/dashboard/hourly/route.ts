import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jstDateRange } from '@/lib/date-jst';
import { buildBaseWhere } from '@/lib/dashboard-query';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';
    const channel = searchParams.get('channel') ?? 'all';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, data: [], error: 'startDate and endDate required' }, { status: 400 });
    }

    const range = jstDateRange(startDate, endDate);

    // 事前集計テーブルから取得
    const sourceWhere = source !== 'ALL' ? { sourceKey: source } : {};
    const rows = await prisma.hourlyAggregation.findMany({
      where: {
        ...sourceWhere,
        aggregationDate: { gte: range.gte, lt: range.lt },
      },
      orderBy: { hour: 'asc' },
    });

    // 事前集計にデータがない場合、直接Ticketテーブルから動的集計
    if (rows.length === 0) {
      const baseWhere = await buildBaseWhere(source, channel, range);
      const tickets = await prisma.ticket.findMany({
        where: baseWhere as any,
        select: { createdAt: true },
      });

      // createdAt を JST 時刻に変換して時間帯集計
      const JST_OFFSET = 9 * 60 * 60 * 1000;
      const hourMap = new Map<number, number>();
      for (const t of tickets) {
        const jstDate = new Date(t.createdAt.getTime() + JST_OFFSET);
        const hour = jstDate.getUTCHours();
        hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
      }

      const data = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: hourMap.get(h) ?? 0,
        label: `${h}時`,
      }));

      return NextResponse.json({ success: true, data });
    }

    // hour別に集計
    const hourMap = new Map<number, number>();
    for (const r of rows) {
      hourMap.set(r.hour, (hourMap.get(r.hour) ?? 0) + r.count);
    }

    const data = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: hourMap.get(h) ?? 0,
      label: `${h}時`,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jstDateRange, prevDay, weekAgo } from '@/lib/date-jst';
import { buildBaseWhere } from '@/lib/dashboard-query';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';
    const channel = searchParams.get('channel') ?? 'all';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate required' }, { status: 400 });
    }

    // --- 選択期間の項目別件数 ---
    const range = jstDateRange(startDate, endDate);
    const baseWhere = await buildBaseWhere(source, channel, range);

    const rows = await prisma.ticket.groupBy({
      by: ['inquiryCategory'],
      where: baseWhere as any,
      _count: true,
      orderBy: { _count: { inquiryCategory: 'desc' } },
    });

    // 分母は除外後の総件数
    const total = rows.reduce((s, r) => s + r._count, 0);

    // --- 前日の項目別件数 ---
    const prevDateStr = prevDay(endDate);
    const prevRange = jstDateRange(prevDateStr, prevDateStr);
    const prevWhere = await buildBaseWhere(source, channel, prevRange);
    const prevRows = await prisma.ticket.groupBy({
      by: ['inquiryCategory'],
      where: prevWhere as any,
      _count: true,
    });
    const prevMap = new Map(prevRows.map(r => [r.inquiryCategory, r._count]));

    // --- 前週同曜日の項目別件数 ---
    const weekAgoStr = weekAgo(endDate);
    const weekRange = jstDateRange(weekAgoStr, weekAgoStr);
    const weekWhere = await buildBaseWhere(source, channel, weekRange);
    const weekRows = await prisma.ticket.groupBy({
      by: ['inquiryCategory'],
      where: weekWhere as any,
      _count: true,
    });
    const weekMap = new Map(weekRows.map(r => [r.inquiryCategory, r._count]));

    const data = rows.map((r, i) => {
      const count = r._count;
      const prevDayDiff = count - (prevMap.get(r.inquiryCategory) ?? 0);
      const prevWeekDiff = count - (weekMap.get(r.inquiryCategory) ?? 0);
      return {
        category: r.inquiryCategory || '(未設定)',
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        previousDayDiff: prevDayDiff,
        previousWeekSameDayDiff: prevWeekDiff,
        trend: prevDayDiff > 0 ? 'increase' : prevDayDiff < 0 ? 'decrease' : 'flat',
        rank: i + 1,
      };
    });

    return NextResponse.json({ success: true, data, meta: { total } });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

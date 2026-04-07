import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function jstDateRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(dateStr + 'T00:00:00+09:00');
  const end = new Date(dateStr + 'T00:00:00+09:00');
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function prevDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function weekAgoDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate required' }, { status: 400 });
    }

    const sourceWhere = source !== 'ALL' ? { sourceKey: source } : {};
    const range = jstDateRange(endDate);

    const rows = await prisma.ticket.groupBy({
      by: ['inquiryCategory'],
      where: { isExcluded: false, ...sourceWhere, createdAt: { gte: range.start, lt: range.end } },
      _count: true,
      orderBy: { _count: { inquiryCategory: 'desc' } },
    });

    const total = rows.reduce((s, r) => s + r._count, 0);

    const prevRange = jstDateRange(prevDateStr(endDate));
    const prevRows = await prisma.ticket.groupBy({
      by: ['inquiryCategory'],
      where: { isExcluded: false, ...sourceWhere, createdAt: { gte: prevRange.start, lt: prevRange.end } },
      _count: true,
    });
    const prevMap = new Map(prevRows.map(r => [r.inquiryCategory, r._count]));

    const weekRange = jstDateRange(weekAgoDateStr(endDate));
    const weekRows = await prisma.ticket.groupBy({
      by: ['inquiryCategory'],
      where: { isExcluded: false, ...sourceWhere, createdAt: { gte: weekRange.start, lt: weekRange.end } },
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

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    const rows = await prisma.categoryAggregation.findMany({
      where: { sourceKey: source, aggregationDate: { gte: start, lt: end } },
      orderBy: { count: 'desc' },
    });

    const total = rows.reduce((s, r) => s + r.count, 0);
    const data = rows.map((r, i) => ({
      category: r.inquiryCategory,
      count: r.count,
      percentage: r.percentage,
      previousDayDiff: r.prevDayDiff,
      previousWeekSameDayDiff: r.prevWeekSameDayDiff,
      trend: r.prevDayDiff > 0 ? 'up' : r.prevDayDiff < 0 ? 'down' : 'flat',
      rank: i + 1,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

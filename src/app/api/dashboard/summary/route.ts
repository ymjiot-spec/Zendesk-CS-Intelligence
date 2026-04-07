import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { DailySummary } from '@/types/aggregation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    // 当日集計
    const agg = await prisma.dailyAggregation.findFirst({
      where: { sourceKey: source, aggregationDate: { gte: new Date(startDate), lt: end } },
      orderBy: { aggregationDate: 'desc' },
    });

    // 前日集計
    const prevDay = new Date(start);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevAgg = await prisma.dailyAggregation.findFirst({
      where: { sourceKey: source, aggregationDate: { gte: prevDay, lt: start } },
    });

    const totalCount = agg?.totalCount ?? 0;
    const prevCount = prevAgg?.totalCount ?? 0;
    const diff = totalCount - prevCount;
    const rate = prevCount > 0 ? (diff / prevCount) * 100 : 0;

    const data: DailySummary = {
      date: new Date(startDate),
      totalCount,
      previousDayCount: prevCount,
      dayOverDayDiff: diff,
      dayOverDayRate: Math.round(rate * 10) / 10,
      avg7Days: agg?.avg7days ?? 0,
      avg30Days: agg?.avg30days ?? 0,
      trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    };

    return NextResponse.json({
      success: true,
      data,
      meta: { lastUpdatedAt: agg?.computedAt?.toISOString() ?? new Date().toISOString(), populationInfo: { totalCount, excludedCount: agg?.excludedCount ?? 0 } },
    });
  } catch (error) {
    return NextResponse.json({ success: false, data: null, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

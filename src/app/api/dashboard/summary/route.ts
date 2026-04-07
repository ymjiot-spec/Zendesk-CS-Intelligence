import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { DailySummary } from '@/types/aggregation';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 });
    }

    const sourceWhere = source !== 'ALL' ? { sourceKey: source } : {};
    const range = jstDateRange(endDate);

    // category_filter_settingsから除外カテゴリを取得
    const excludedCats: { inquiry_category: string }[] = await (prisma as any).$queryRaw`
      SELECT inquiry_category FROM category_filter_settings 
      WHERE is_included = false ${source !== 'ALL' ? (prisma as any).sql`AND source_key = ${source}` : (prisma as any).sql``}
    `.catch(() => []);
    const excludedCatNames = excludedCats.map((c: any) => c.inquiry_category);
    const catWhere = excludedCatNames.length > 0 ? { inquiryCategory: { notIn: excludedCatNames } } : {};

    const totalCount = await prisma.ticket.count({
      where: { isExcluded: false, ...sourceWhere, ...catWhere, createdAt: { gte: range.start, lt: range.end } },
    });

    const prevRange = jstDateRange(prevDateStr(endDate));
    const prevCount = await prisma.ticket.count({
      where: { isExcluded: false, ...sourceWhere, createdAt: { gte: prevRange.start, lt: prevRange.end } },
    });

    const sevenDaysAgo = new Date(range.start.getTime() - 7 * 86400000);
    const last7 = await prisma.ticket.count({
      where: { isExcluded: false, ...sourceWhere, createdAt: { gte: sevenDaysAgo, lt: range.end } },
    });
    const avg7 = Math.round((last7 / 7) * 10) / 10;

    const thirtyDaysAgo = new Date(range.start.getTime() - 30 * 86400000);
    const last30 = await prisma.ticket.count({
      where: { isExcluded: false, ...sourceWhere, createdAt: { gte: thirtyDaysAgo, lt: range.end } },
    });
    const avg30 = Math.round((last30 / 30) * 10) / 10;

    const diff = totalCount - prevCount;
    const rate = prevCount > 0 ? Math.round((diff / prevCount) * 1000) / 10 : 0;

    const data: DailySummary = {
      date: new Date(endDate),
      totalCount,
      previousDayCount: prevCount,
      dayOverDayDiff: diff,
      dayOverDayRate: rate,
      avg7Days: avg7,
      avg30Days: avg30,
      trend: diff > 0 ? 'increase' : diff < 0 ? 'decrease' : 'flat',
    };

    return NextResponse.json({
      success: true,
      data,
      meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount, excludedCount: 0 } },
    });
  } catch (error) {
    return NextResponse.json({ success: false, data: null, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

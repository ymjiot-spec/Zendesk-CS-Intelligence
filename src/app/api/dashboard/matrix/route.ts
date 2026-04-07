import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, data: [], error: 'startDate and endDate required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    // 日別×カテゴリ別集計
    const rows = await prisma.categoryAggregation.findMany({
      where: { sourceKey: source, aggregationDate: { gte: start, lt: end } },
      orderBy: { aggregationDate: 'asc' },
    });

    // 日付でグループ化
    const byDate = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.aggregationDate.toISOString().split('T')[0];
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(r);
    }

    const data = [...byDate.entries()].map(([dateStr, cats]) => {
      const totalCount = cats.reduce((s, c) => s + c.count, 0);
      const categories: Record<string, { count: number; percentage: number; diff: number }> = {};
      for (const c of cats) {
        categories[c.inquiryCategory] = {
          count: c.count,
          percentage: c.percentage,
          diff: c.prevDayDiff,
        };
      }
      return { date: new Date(dateStr), totalCount, categories };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

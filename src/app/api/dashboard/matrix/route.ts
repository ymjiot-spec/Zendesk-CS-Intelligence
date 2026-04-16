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

    // 事前集計テーブルから取得（sourceKeyのみフィルタ、チャネルは未対応）
    // ただし動的集計のフォールバックも用意
    const range = jstDateRange(startDate, endDate);

    // CategoryAggregation テーブルから取得
    const sourceWhere = source !== 'ALL' ? { sourceKey: source } : {};
    const rows = await prisma.categoryAggregation.findMany({
      where: {
        ...sourceWhere,
        aggregationDate: { gte: range.gte, lt: range.lt },
      },
      orderBy: { aggregationDate: 'asc' },
    });

    // 事前集計テーブルにデータがない場合、直接Ticketテーブルから動的集計
    if (rows.length === 0) {
      const baseWhere = await buildBaseWhere(source, channel, range);
      const tickets = await prisma.ticket.findMany({
        where: baseWhere as any,
        select: { createdAt: true, inquiryCategory: true },
        orderBy: { createdAt: 'asc' },
      });

      // 日付ごと・カテゴリごとに集計
      const JST_OFFSET = 9 * 60 * 60 * 1000;
      const byDate = new Map<string, Map<string, number>>();
      for (const t of tickets) {
        const jstDate = new Date(t.createdAt.getTime() + JST_OFFSET);
        const key = jstDate.toISOString().split('T')[0];
        if (!byDate.has(key)) byDate.set(key, new Map());
        const catMap = byDate.get(key)!;
        catMap.set(t.inquiryCategory, (catMap.get(t.inquiryCategory) ?? 0) + 1);
      }

      const data = [...byDate.entries()].map(([dateStr, catMap]) => {
        const totalCount = Array.from(catMap.values()).reduce((s, c) => s + c, 0);
        const categories: Record<string, { count: number; percentage: number; diff: number }> = {};
        for (const [cat, count] of catMap.entries()) {
          categories[cat] = {
            count,
            percentage: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
            diff: 0,
          };
        }
        return { date: new Date(dateStr), totalCount, categories };
      });

      return NextResponse.json({ success: true, data });
    }

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

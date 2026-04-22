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

    // CategoryAggregation テーブルは使わず、常にTicketテーブルから動的集計
    if (true) {
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

      // 選択期間内の全日分の行を生成（データがない日も0件で表示）
      const allDates: string[] = [];
      const cur = new Date(startDate + 'T00:00:00+09:00');
      const endD = new Date(endDate + 'T00:00:00+09:00');
      while (cur <= endD) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        allDates.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }

      const data = allDates.map((dateStr, idx) => {
        const catMap = byDate.get(dateStr) ?? new Map<string, number>();
        const prevCatMap = idx > 0 ? (byDate.get(allDates[idx - 1]) ?? new Map<string, number>()) : new Map<string, number>();
        const totalCount = Array.from(catMap.values()).reduce((s, c) => s + c, 0);
        const categories: Record<string, { count: number; percentage: number; diff: number }> = {};
        // 全カテゴリを収集
        const allCats = new Set([...catMap.keys(), ...prevCatMap.keys()]);
        for (const cat of allCats) {
          const count = catMap.get(cat) ?? 0;
          const prevCount = prevCatMap.get(cat) ?? 0;
          categories[cat] = {
            count,
            percentage: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
            diff: count - prevCount,
          };
        }
        return { date: new Date(dateStr), totalCount, categories };
      }).reverse(); // 新しい日が上

      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

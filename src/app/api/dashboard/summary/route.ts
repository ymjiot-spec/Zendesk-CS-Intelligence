import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  jstDateRange, prevDay, shiftDays,
  dayCount, lastMonthRange, thisWeekMonday, thisMonthFirst, todayJST,
} from '@/lib/date-jst';
import { getIncludedCategories } from '@/lib/dashboard-query';

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

    // Pre-compute all date ranges
    const range = jstDateRange(startDate, endDate);
    const today = todayJST();
    const prevDateStr = prevDay(endDate);
    const sevenAgo = shiftDays(endDate, -6);
    const thirtyAgo = shiftDays(endDate, -29);
    const thisMonday = thisWeekMonday(today);
    const lastMonday = shiftDays(thisMonday, -7);
    const daysIntoWeek = dayCount(thisMonday, today);
    const lastWeekSameDay = shiftDays(lastMonday, daysIntoWeek - 1);
    const lastSunday = shiftDays(lastMonday, 6);
    const thisFirst = thisMonthFirst(today);
    const daysIntoMonth = dayCount(thisFirst, today);
    const lastMon = lastMonthRange(today);
    const lastMonthSameDay = shiftDays(lastMon.startDate, daysIntoMonth - 1);
    const lastMonthEnd = lastMonthSameDay > lastMon.endDate ? lastMon.endDate : lastMonthSameDay;
    const periodDays = dayCount(startDate, endDate);
    const prevPeriodEnd = shiftDays(startDate, -1);
    const prevPeriodStart = shiftDays(prevPeriodEnd, -(periodDays - 1));

    // Build WHERE clause fragments
    const includedCats = await getIncludedCategories(source);
    const sourceFilter = source !== 'ALL' ? `AND source_key = '${source}'` : '';
    const channelFilter = channel === 'ticket' ? `AND channel_type = 'ticket'` : channel === 'call_center' ? `AND channel_type = 'call_center'` : '';
    const catFilter = includedCats.length > 0 ? `AND inquiry_category IN (${includedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(',')})` : '';
    const baseFilter = `is_excluded = false ${sourceFilter} ${channelFilter} ${catFilter}`;

    // Helper to make JST date range
    const jstGte = (d: string) => `'${d}T00:00:00+09:00'::timestamptz`;
    const jstLt = (d: string) => `('${d}T00:00:00+09:00'::timestamptz + interval '1 day')`;

    // Single SQL query with all counts
    const sql = `
      SELECT
        count(*) FILTER (WHERE created_at >= ${jstGte(startDate)} AND created_at < ${jstLt(endDate)}) as total_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(startDate)} AND created_at < ${jstLt(endDate)} AND channel_type = 'ticket') as ticket_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(startDate)} AND created_at < ${jstLt(endDate)} AND channel_type = 'call_center') as call_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(endDate)} AND created_at < ${jstLt(endDate)}) as today_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(prevDateStr)} AND created_at < ${jstLt(prevDateStr)}) as prev_day_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(sevenAgo)} AND created_at < ${jstLt(endDate)}) as last7_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(thirtyAgo)} AND created_at < ${jstLt(endDate)}) as last30_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(thisMonday)} AND created_at < ${jstLt(today)}) as this_week_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(lastMonday)} AND created_at < ${jstLt(lastWeekSameDay)}) as last_week_same_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(lastMonday)} AND created_at < ${jstLt(lastSunday)}) as last_week_full_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(thisFirst)} AND created_at < ${jstLt(today)}) as this_month_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(lastMon.startDate)} AND created_at < ${jstLt(lastMonthEnd)}) as last_month_comp_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(lastMon.startDate)} AND created_at < ${jstLt(lastMon.endDate)}) as last_month_full_count,
        count(*) FILTER (WHERE created_at >= ${jstGte(prevPeriodStart)} AND created_at < ${jstLt(prevPeriodEnd)}) as prev_period_count
      FROM tickets
      WHERE ${baseFilter}
    `;

    const rows: any[] = await (prisma as any).$queryRawUnsafe(sql);
    const r = rows[0] ?? {};
    const int = (v: any) => parseInt(String(v ?? '0'), 10);

    const totalCount = int(r.total_count);
    const ticketCount = int(r.ticket_count);
    const callCount = int(r.call_count);
    const todayCount = int(r.today_count);
    const previousDayCount = int(r.prev_day_count);
    const last7Count = int(r.last7_count);
    const last30Count = int(r.last30_count);
    const thisWeekCount = int(r.this_week_count);
    const lastWeekSameCount = int(r.last_week_same_count);
    const lastWeekFullCount = int(r.last_week_full_count);
    const thisMonthCount = int(r.this_month_count);
    const lastMonthCompCount = int(r.last_month_comp_count);
    const lastMonthFullCount = int(r.last_month_full_count);
    const prevPeriodCount = int(r.prev_period_count);

    // Peak day query (separate, lightweight)
    let peakDate = '';
    let peakCount = 0;
    try {
      const peakSql = `
        SELECT to_char(created_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD') as d, count(*)::int as c
        FROM tickets WHERE ${baseFilter}
        AND created_at >= ${jstGte(startDate)} AND created_at < ${jstLt(endDate)}
        GROUP BY d ORDER BY c DESC LIMIT 1
      `;
      const peakRows: any[] = await (prisma as any).$queryRawUnsafe(peakSql);
      if (peakRows.length > 0) { peakDate = peakRows[0].d; peakCount = int(peakRows[0].c); }
    } catch { /* */ }

    // Compute derived values
    const dayOverDayDiff = todayCount - previousDayCount;
    const dayOverDayRate = previousDayCount > 0 ? Math.round((dayOverDayDiff / previousDayCount) * 1000) / 10 : 0;
    const avg7Days = Math.round((last7Count / 7) * 10) / 10;
    const avg30Days = Math.round((last30Count / 30) * 10) / 10;
    const weekOverWeekDiff = thisWeekCount - lastWeekSameCount;
    const weekOverWeekRate = lastWeekSameCount > 0 ? Math.round((weekOverWeekDiff / lastWeekSameCount) * 1000) / 10 : 0;
    const monthOverMonthDiff = thisMonthCount - lastMonthCompCount;
    const monthOverMonthRate = lastMonthCompCount > 0 ? Math.round((monthOverMonthDiff / lastMonthCompCount) * 1000) / 10 : 0;
    const periodDailyAvg = periodDays > 0 ? Math.round((totalCount / periodDays) * 10) / 10 : 0;
    const periodOverPeriodDiff = totalCount - prevPeriodCount;
    const periodOverPeriodRate = prevPeriodCount > 0 ? Math.round((periodOverPeriodDiff / prevPeriodCount) * 1000) / 10 : 0;

    return NextResponse.json({
      success: true,
      data: {
        date: endDate, totalCount, ticketCount, callCount, periodDailyAvg,
        peakDate, peakCount, prevPeriodCount, periodOverPeriodDiff, periodOverPeriodRate,
        todayCount, previousDayCount, dayOverDayDiff, dayOverDayRate,
        trend: dayOverDayDiff > 0 ? 'increase' : dayOverDayDiff < 0 ? 'decrease' : 'flat',
        avg7Days, avg30Days, last7DaysCount: last7Count,
        thisWeekCount, lastWeekCount: lastWeekFullCount, weekOverWeekDiff, weekOverWeekRate,
        thisMonthCount, lastMonthCount: lastMonthFullCount, monthOverMonthDiff, monthOverMonthRate,
      },
      meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount, excludedCount: 0 } },
    });
  } catch (error) {
    console.error('Summary API error:', error);
    return NextResponse.json({ success: false, data: null, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  jstDateRange, prevDay, weekAgo, shiftDays,
  dayCount, lastMonthRange, thisWeekMonday, thisMonthFirst, todayJST,
} from '@/lib/date-jst';
import { buildBaseWhere } from '@/lib/dashboard-query';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source') ?? 'ALL';
    const channel = searchParams.get('channel') ?? 'all';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 });
    }

    // --- 選択期間の合計件数 ---
    const range = jstDateRange(startDate, endDate);
    const baseWhere = await buildBaseWhere(source, channel, range);
    const totalCount = await prisma.ticket.count({ where: baseWhere as any });

    // --- endDate当日の件数 ---
    const todayRange = jstDateRange(endDate, endDate);
    const todayWhere = await buildBaseWhere(source, channel, todayRange);
    const todayCount = await prisma.ticket.count({ where: todayWhere as any });

    // --- 昨日の件数（endDate の前日1日分）---
    const prevDateStr = prevDay(endDate);
    const prevRange = jstDateRange(prevDateStr, prevDateStr);
    const prevWhere = await buildBaseWhere(source, channel, prevRange);
    const previousDayCount = await prisma.ticket.count({ where: prevWhere as any });

    // --- 前日比（endDate当日 vs 前日）---
    const dayOverDayDiff = todayCount - previousDayCount;
    const dayOverDayRate = previousDayCount > 0
      ? Math.round((dayOverDayDiff / previousDayCount) * 1000) / 10
      : 0;

    // --- 直近7日合計（endDateを含む過去7日間）---
    const sevenDaysAgoStr = shiftDays(endDate, -6); // 当日含め7日
    const last7Range = jstDateRange(sevenDaysAgoStr, endDate);
    const last7Where = await buildBaseWhere(source, channel, last7Range);
    const last7Count = await prisma.ticket.count({ where: last7Where as any });
    const avg7Days = Math.round((last7Count / 7) * 10) / 10;

    // --- 直近30日平均（endDateを含む過去30日間）---
    const thirtyDaysAgoStr = shiftDays(endDate, -29); // 当日含め30日
    const last30Range = jstDateRange(thirtyDaysAgoStr, endDate);
    const last30Where = await buildBaseWhere(source, channel, last30Range);
    const last30Count = await prisma.ticket.count({ where: last30Where as any });
    const avg30Days = Math.round((last30Count / 30) * 10) / 10;

    // --- 週比較（今週合計 vs 先週同期間）---
    const today = todayJST();
    const thisMonday = thisWeekMonday(today);
    const lastMonday = shiftDays(thisMonday, -7);
    const daysIntoWeek = dayCount(thisMonday, today);
    const lastWeekSameDay = shiftDays(lastMonday, daysIntoWeek - 1);

    const thisWeekRange = jstDateRange(thisMonday, today);
    const thisWeekWhere = await buildBaseWhere(source, channel, thisWeekRange);
    const thisWeekCount = await prisma.ticket.count({ where: thisWeekWhere as any });

    const lastWeekSameRange = jstDateRange(lastMonday, lastWeekSameDay);
    const lastWeekSameWhere = await buildBaseWhere(source, channel, lastWeekSameRange);
    const lastWeekSameCount = await prisma.ticket.count({ where: lastWeekSameWhere as any });

    const weekOverWeekDiff = thisWeekCount - lastWeekSameCount;
    const weekOverWeekRate = lastWeekSameCount > 0
      ? Math.round((weekOverWeekDiff / lastWeekSameCount) * 1000) / 10
      : 0;

    // --- 先週合計 ---
    const lastSunday = shiftDays(lastMonday, 6);
    const lastWeekFullRange = jstDateRange(lastMonday, lastSunday);
    const lastWeekFullWhere = await buildBaseWhere(source, channel, lastWeekFullRange);
    const lastWeekFullCount = await prisma.ticket.count({ where: lastWeekFullWhere as any });

    // --- 月比較（今月合計 vs 先月同日まで）---
    const thisFirst = thisMonthFirst(today);
    const daysIntoMonth = dayCount(thisFirst, today);
    const lastMon = lastMonthRange(today);
    const lastMonthSameDay = shiftDays(lastMon.startDate, daysIntoMonth - 1);
    const lastMonthEnd = lastMonthSameDay > lastMon.endDate ? lastMon.endDate : lastMonthSameDay;

    const thisMonthDateRange = jstDateRange(thisFirst, today);
    const thisMonthWhere = await buildBaseWhere(source, channel, thisMonthDateRange);
    const thisMonthCount = await prisma.ticket.count({ where: thisMonthWhere as any });

    const lastMonthCompRange = jstDateRange(lastMon.startDate, lastMonthEnd);
    const lastMonthCompWhere = await buildBaseWhere(source, channel, lastMonthCompRange);
    const lastMonthCompCount = await prisma.ticket.count({ where: lastMonthCompWhere as any });

    const monthOverMonthDiff = thisMonthCount - lastMonthCompCount;
    const monthOverMonthRate = lastMonthCompCount > 0
      ? Math.round((monthOverMonthDiff / lastMonthCompCount) * 1000) / 10
      : 0;

    // --- 先月合計 ---
    const lastMonthFullRange = jstDateRange(lastMon.startDate, lastMon.endDate);
    const lastMonthFullWhere = await buildBaseWhere(source, channel, lastMonthFullRange);
    const lastMonthFullCount = await prisma.ticket.count({ where: lastMonthFullWhere as any });

    // --- チケット/コール内訳（選択期間）---
    const ticketOnlyWhere = await buildBaseWhere(source, 'ticket', range);
    const callOnlyWhere = await buildBaseWhere(source, 'call_center', range);
    const ticketCount = await prisma.ticket.count({ where: ticketOnlyWhere as any });
    const callCount = await prisma.ticket.count({ where: callOnlyWhere as any });

    // --- 選択期間の日平均 ---
    const periodDays = dayCount(startDate, endDate);
    const periodDailyAvg = periodDays > 0 ? Math.round((totalCount / periodDays) * 10) / 10 : 0;

    // --- ピーク日（選択期間内で最も件数が多い日）---
    let peakDate = '';
    let peakCount = 0;
    try {
      const peakRows: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD') as d, count(*)::int as c
         FROM tickets WHERE is_excluded = false
         AND created_at >= $1 AND created_at < $2
         ${source !== 'ALL' ? 'AND source_key = $3' : ''}
         GROUP BY d ORDER BY c DESC LIMIT 1`,
        ...(source !== 'ALL' ? [range.gte, range.lt, source] : [range.gte, range.lt])
      );
      if (peakRows.length > 0) {
        peakDate = peakRows[0].d;
        peakCount = peakRows[0].c;
      }
    } catch { /* */ }

    // --- 前同期間比較（選択期間と同じ日数分の直前期間）---
    const prevPeriodEnd = shiftDays(startDate, -1);
    const prevPeriodStart = shiftDays(prevPeriodEnd, -(periodDays - 1));
    const prevPeriodRange = jstDateRange(prevPeriodStart, prevPeriodEnd);
    const prevPeriodWhere = await buildBaseWhere(source, channel, prevPeriodRange);
    const prevPeriodCount = await prisma.ticket.count({ where: prevPeriodWhere as any });
    const periodOverPeriodDiff = totalCount - prevPeriodCount;
    const periodOverPeriodRate = prevPeriodCount > 0
      ? Math.round((periodOverPeriodDiff / prevPeriodCount) * 1000) / 10
      : 0;

    const data = {
      date: endDate,
      // 選択期間の合計
      totalCount,
      // チケット/コール内訳
      ticketCount,
      callCount,
      // 選択期間の日平均
      periodDailyAvg,
      // ピーク日
      peakDate,
      peakCount,
      // 前同期間比較
      prevPeriodCount,
      periodOverPeriodDiff,
      periodOverPeriodRate,
      // 個別日次
      todayCount,
      previousDayCount,
      // 前日比
      dayOverDayDiff,
      dayOverDayRate,
      trend: dayOverDayDiff > 0 ? 'increase' as const : dayOverDayDiff < 0 ? 'decrease' as const : 'flat' as const,
      // 平均
      avg7Days,
      avg30Days,
      // 直近7日合計
      last7DaysCount: last7Count,
      // 週
      thisWeekCount,
      lastWeekCount: lastWeekFullCount,
      weekOverWeekDiff,
      weekOverWeekRate,
      // 月
      thisMonthCount,
      lastMonthCount: lastMonthFullCount,
      monthOverMonthDiff,
      monthOverMonthRate,
    };

    return NextResponse.json({
      success: true,
      data,
      meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount, excludedCount: 0 } },
    });
  } catch (error) {
    console.error('Summary API error:', error);
    return NextResponse.json({ success: false, data: null, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

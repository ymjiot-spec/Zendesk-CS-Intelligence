import prisma from '@/lib/prisma';

/**
 * source_key別またはALLで集計を計算してDBにupsert
 */
export async function runAggregation(sourceKey: string, targetDate?: Date): Promise<void> {
  const date = targetDate ?? new Date();
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const isAll = sourceKey === 'ALL';

  // 当日のチケット
  const dayStart = new Date(dateOnly);
  const dayEnd = new Date(dateOnly);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const whereBase = isAll ? {} : { sourceKey };
  const whereToday = { ...whereBase, createdAt: { gte: dayStart, lt: dayEnd }, isExcluded: false };

  const todayTickets = await prisma.ticket.findMany({ where: whereToday });
  const totalCount = todayTickets.length;

  // 7日/30日平均
  const avg7 = await getAvgDays(whereBase, dateOnly, 7);
  const avg30 = await getAvgDays(whereBase, dateOnly, 30);

  // Daily aggregation upsert
  await prisma.dailyAggregation.upsert({
    where: { uq_daily_aggregations_source_date: { sourceKey, aggregationDate: dateOnly } },
    update: { totalCount, excludedCount: 0, avg7days: avg7, avg30days: avg30, computedAt: new Date() },
    create: {
      sourceKey,
      aggregationDate: dateOnly,
      totalCount,
      excludedCount: 0,
      avg7days: avg7,
      avg30days: avg30,
      computedAt: new Date(),
    },
  });

  // カテゴリ集計
  const catMap = new Map<string, number>();
  for (const t of todayTickets) {
    catMap.set(t.inquiryCategory, (catMap.get(t.inquiryCategory) ?? 0) + 1);
  }

  let rank = 1;
  const sortedCats = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const perc = totalCount > 0 ? (count / totalCount) * 100 : 0;

    // 前日比
    const prevDay = new Date(dateOnly);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayEnd = new Date(dateOnly);
    const prevWhere = { ...whereBase, createdAt: { gte: prevDay, lt: prevDayEnd }, inquiryCategory: cat, isExcluded: false };
    const prevDayCount = await prisma.ticket.count({ where: prevWhere });

    // 前週同曜日比
    const prevWeek = new Date(dateOnly);
    prevWeek.setDate(prevWeek.getDate() - 7);
    const prevWeekEnd = new Date(prevWeek);
    prevWeekEnd.setDate(prevWeekEnd.getDate() + 1);
    const prevWeekWhere = { ...whereBase, createdAt: { gte: prevWeek, lt: prevWeekEnd }, inquiryCategory: cat, isExcluded: false };
    const prevWeekCount = await prisma.ticket.count({ where: prevWeekWhere });

    await prisma.categoryAggregation.upsert({
      where: {
        uq_category_aggregations_source_date_category: {
          sourceKey,
          aggregationDate: dateOnly,
          inquiryCategory: cat,
        },
      },
      update: { count, percentage: perc, prevDayDiff: count - prevDayCount, prevWeekSameDayDiff: count - prevWeekCount, computedAt: new Date() },
      create: {
        sourceKey,
        aggregationDate: dateOnly,
        inquiryCategory: cat,
        count,
        percentage: perc,
        prevDayDiff: count - prevDayCount,
        prevWeekSameDayDiff: count - prevWeekCount,
        computedAt: new Date(),
      },
    });
    rank++;
  }

  // 時間帯集計
  const hourMap = new Map<number, number>();
  for (const t of todayTickets) {
    const h = new Date(t.createdAt).getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  const dayOfWeek = dateOnly.getDay();
  for (const [hour, count] of hourMap) {
    await prisma.hourlyAggregation.upsert({
      where: {
        uq_hourly_aggregations_source_date_hour: {
          sourceKey,
          aggregationDate: dateOnly,
          hour,
        },
      },
      update: { count, computedAt: new Date() },
      create: {
        sourceKey,
        aggregationDate: dateOnly,
        hour,
        dayOfWeek,
        count,
        computedAt: new Date(),
      },
    });
  }
}

async function getAvgDays(whereBase: object, dateOnly: Date, days: number): Promise<number> {
  const from = new Date(dateOnly);
  from.setDate(from.getDate() - days);
  const aggs = await prisma.dailyAggregation.findMany({
    where: {
      ...whereBase,
      aggregationDate: { gte: from, lt: dateOnly },
    },
  });
  if (aggs.length === 0) return 0;
  return aggs.reduce((s, a) => s + a.totalCount, 0) / aggs.length;
}

/**
 * 異常検知実行サービス
 * DBからチケットデータを集計し、異常検知エンジンに渡して結果をDBに保存する
 */

import prisma from '@/lib/prisma';
import { detect, DEFAULT_ANOMALY_CONFIG } from './anomaly-detector';
import type { DailyValue } from './trend-detector';
import { buildBaseWhere, getIncludedCategories } from '@/lib/dashboard-query';
import { jstDateRange, shiftDays, todayJST } from '@/lib/date-jst';

const JST_OFFSET = 9 * 60 * 60 * 1000;

/** 指定日のJST日付文字列を返す */
function toJstDateStr(d: Date): string {
  const jst = new Date(d.getTime() + JST_OFFSET);
  return jst.toISOString().split('T')[0];
}

/** 日別チケット件数を取得（直近N日分） */
async function getDailyCountsHistory(
  source: string,
  channel: string,
  days: number,
): Promise<{ date: string; count: number; dayOfWeek: number }[]> {
  const today = todayJST();
  const results: { date: string; count: number; dayOfWeek: number }[] = [];

  for (let i = 0; i < days; i++) {
    const dateStr = shiftDays(today, -i);
    const range = jstDateRange(dateStr, dateStr);
    const where = await buildBaseWhere(source, channel, range);
    const count = await prisma.ticket.count({ where: where as any });
    const d = new Date(dateStr + 'T00:00:00+09:00');
    results.push({ date: dateStr, count, dayOfWeek: d.getDay() });
  }

  return results.reverse(); // oldest first
}

/** カテゴリ別の日別件数を取得 */
async function getCategoryDailyCounts(
  source: string,
  channel: string,
  dateStr: string,
): Promise<Record<string, number>> {
  const range = jstDateRange(dateStr, dateStr);
  const where = await buildBaseWhere(source, channel, range);
  const rows = await prisma.ticket.groupBy({
    by: ['inquiryCategory'],
    where: where as any,
    _count: true,
  });
  const result: Record<string, number> = {};
  for (const r of rows) {
    result[r.inquiryCategory] = r._count;
  }
  return result;
}

/** 代表チケットを取得（当日の最新5件） */
async function getRepresentativeTickets(
  source: string,
  channel: string,
  dateStr: string,
): Promise<{ ticketId: string; subject: string; sourceKey: string }[]> {
  const range = jstDateRange(dateStr, dateStr);
  const where = await buildBaseWhere(source, channel, range);
  const tickets = await prisma.ticket.findMany({
    where: where as any,
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { zendeskTicketId: true, subject: true, sourceKey: true },
  });
  return tickets.map(t => ({
    ticketId: t.zendeskTicketId,
    subject: t.subject,
    sourceKey: t.sourceKey,
  }));
}

/** 異常検知を実行してDBに保存 */
export async function runAnomalyDetection(
  source: string = 'ALL',
  channel: string = 'all',
): Promise<number> {
  const today = todayJST();
  const history = await getDailyCountsHistory(source, channel, 30);
  const todayCounts = await getCategoryDailyCounts(source, channel, today);

  const totalToday = Object.values(todayCounts).reduce((s, c) => s + c, 0);

  // 履歴データをDailyValue形式に変換
  const historicalTotals: DailyValue[] = history.map(h => ({
    value: h.count,
    dayOfWeek: h.dayOfWeek,
  }));

  // カテゴリ別の履歴（簡易版：今日のカテゴリのみ）
  const historicalByCategory: Record<string, DailyValue[]> = {};
  const includedCats = await getIncludedCategories(source);
  for (const cat of includedCats) {
    // 各カテゴリの履歴は全体の比率で推定（簡易版）
    historicalByCategory[cat] = historicalTotals.map(h => ({
      value: Math.round(h.value * ((todayCounts[cat] ?? 0) / Math.max(totalToday, 1))),
      dayOfWeek: h.dayOfWeek,
    }));
  }

  const todayDate = new Date(today + 'T00:00:00+09:00');
  const currentDayOfWeek = todayDate.getDay();

  const events = detect(
    {
      threshold: {
        totalCount: totalToday,
        byCategory: todayCounts,
      },
      trend: {
        totalCount: totalToday,
        byCategory: todayCounts,
        historicalTotals,
        historicalByCategory,
        currentDayOfWeek,
      },
    },
    DEFAULT_ANOMALY_CONFIG,
    new Date(),
  );

  // 代表チケットとカテゴリ内訳を取得
  const repTickets = await getRepresentativeTickets(source, channel, today);
  const categoryBreakdown = Object.entries(todayCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({ category, count }));

  // DBに保存
  for (const event of events) {
    await prisma.anomalyEvent.create({
      data: {
        detectedAt: event.detectedAt,
        detectionType: event.type,
        metric: event.metric,
        currentValue: event.currentValue,
        baselineValue: event.thresholdOrBaseline,
        deviation: event.deviation,
        severity: event.severity,
        sourceKey: source,
        representativeTickets: repTickets,
        categoryBreakdown: categoryBreakdown,
      },
    });
  }

  console.log(`[Anomaly Detection] source=${source}: ${events.length} anomalies detected (total=${totalToday})`);
  return events.length;
}

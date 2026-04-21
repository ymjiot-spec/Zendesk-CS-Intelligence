import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCompanyName } from '@/lib/company-colors';
import { getIncludedCategories } from '@/lib/dashboard-query';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await prisma.eventLog.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const eventDate = new Date(event.occurredAt);
    const sourceKey = event.sourceKey;

    // Pre-event: 3 days before
    const preStart = new Date(eventDate);
    preStart.setDate(preStart.getDate() - 3);
    const preEnd = new Date(eventDate);

    // Post-event: 3 days after (day after event through 3 days)
    const postStart = new Date(eventDate);
    postStart.setDate(postStart.getDate() + 1);
    const postEnd = new Date(eventDate);
    postEnd.setDate(postEnd.getDate() + 4);

    // Build where clause
    const baseWhere: any = { isExcluded: false };
    if (sourceKey && sourceKey !== 'ALL') {
      baseWhere.sourceKey = sourceKey;
    }

    const includedCats = await getIncludedCategories(sourceKey || 'ALL');
    if (includedCats.length > 0) {
      baseWhere.inquiryCategory = { in: includedCats };
    }

    // Pre-event tickets
    const preTickets = await prisma.ticket.findMany({
      where: { ...baseWhere, createdAt: { gte: preStart, lt: preEnd } },
      select: { channelType: true, inquiryCategory: true },
    });

    // Post-event tickets
    const postTickets = await prisma.ticket.findMany({
      where: { ...baseWhere, createdAt: { gte: postStart, lt: postEnd } },
      select: { channelType: true, inquiryCategory: true, zendeskTicketId: true, subject: true },
    });

    // Compute averages (3 days)
    const preTicketCount = preTickets.filter(t => t.channelType !== 'call_center').length;
    const preCallCount = preTickets.filter(t => t.channelType === 'call_center').length;
    const postTicketCount = postTickets.filter(t => t.channelType !== 'call_center').length;
    const postCallCount = postTickets.filter(t => t.channelType === 'call_center').length;

    const preEventTicketAvg = Math.round((preTicketCount / 3) * 100) / 100;
    const postEventTicketAvg = Math.round((postTicketCount / 3) * 100) / 100;
    const preEventCallAvg = Math.round((preCallCount / 3) * 100) / 100;
    const postEventCallAvg = Math.round((postCallCount / 3) * 100) / 100;

    const ticketChangeRate = preEventTicketAvg > 0
      ? Math.round(((postEventTicketAvg - preEventTicketAvg) / preEventTicketAvg) * 10000) / 100
      : postEventTicketAvg > 0 ? 100 : 0;

    const callChangeRate = preEventCallAvg > 0
      ? Math.round(((postEventCallAvg - preEventCallAvg) / preEventCallAvg) * 10000) / 100
      : postEventCallAvg > 0 ? 100 : 0;

    // Category analysis
    const preCatMap: Record<string, number> = {};
    const postCatMap: Record<string, number> = {};
    for (const t of preTickets) {
      preCatMap[t.inquiryCategory] = (preCatMap[t.inquiryCategory] || 0) + 1;
    }
    for (const t of postTickets) {
      postCatMap[t.inquiryCategory] = (postCatMap[t.inquiryCategory] || 0) + 1;
    }

    const allCats = new Set([...Object.keys(preCatMap), ...Object.keys(postCatMap)]);
    const topCategories = Array.from(allCats)
      .map(cat => {
        const pre = preCatMap[cat] || 0;
        const post = postCatMap[cat] || 0;
        const rate = pre > 0 ? Math.round(((post - pre) / pre) * 10000) / 100 : post > 0 ? 100 : 0;
        return { category: cat, preCount: pre, postCount: post, increaseRate: rate };
      })
      .filter(c => c.increaseRate > 0)
      .sort((a, b) => b.increaseRate - a.increaseRate)
      .slice(0, 10);

    // Representative tickets (up to 5 from most increased categories)
    const topCatNames = topCategories.slice(0, 3).map(c => c.category);
    const repTickets = postTickets
      .filter(t => topCatNames.includes(t.inquiryCategory))
      .slice(0, 5)
      .map(t => ({ ticketId: t.zendeskTicketId, subject: t.subject }));

    // Impact Score (4-factor)
    const increasedCatCount = topCategories.length;
    const hasAnomaly = await checkAnomalyFlag(eventDate, sourceKey);
    const impactScore = computeEnhancedScore(ticketChangeRate, callChangeRate, increasedCatCount, hasAnomaly);

    // AI Summary (simple fallback - no LLM call for now)
    const aiSummary = generateFallbackSummary(
      event.name, ticketChangeRate, callChangeRate, topCategories, impactScore
    );

    return NextResponse.json({
      success: true,
      data: {
        eventId: event.id,
        eventName: event.name,
        eventType: event.eventType,
        occurredAt: event.occurredAt.toISOString(),
        sourceKey: event.sourceKey,
        companyName: getCompanyName(event.sourceKey),
        preEventTicketAvg,
        postEventTicketAvg,
        ticketChangeRate,
        preEventCallAvg,
        postEventCallAvg,
        callChangeRate,
        topCategories,
        representativeTickets: repTickets,
        aiSummary,
        impactScore,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'error' },
      { status: 500 }
    );
  }
}


async function checkAnomalyFlag(eventDate: Date, sourceKey: string | null): Promise<boolean> {
  try {
    const start = new Date(eventDate);
    start.setDate(start.getDate() - 1);
    const end = new Date(eventDate);
    end.setDate(end.getDate() + 2);

    const where: any = {
      detectedAt: { gte: start, lt: end },
    };
    if (sourceKey && sourceKey !== 'ALL') {
      where.sourceKey = sourceKey;
    }

    const count = await prisma.anomalyEvent.count({ where });
    return count > 0;
  } catch {
    return false;
  }
}

function computeEnhancedScore(
  ticketRate: number,
  callRate: number,
  categoryCount: number,
  hasAnomaly: boolean
): number {
  // Weights: ticket 35%, call 35%, categories 20%, anomaly 10%
  const ticketScore = Math.min(Math.abs(ticketRate), 200) / 200 * 100 * 0.35;
  const callScore = Math.min(Math.abs(callRate), 200) / 200 * 100 * 0.35;
  const catScore = Math.min(categoryCount, 10) / 10 * 100 * 0.20;
  const anomalyBonus = hasAnomaly ? 10 : 0;

  return Math.round(Math.max(0, Math.min(100, ticketScore + callScore + catScore + anomalyBonus)));
}

function generateFallbackSummary(
  eventName: string,
  ticketRate: number,
  callRate: number,
  topCategories: { category: string; increaseRate: number }[],
  impactScore: number
): string {
  const parts: string[] = [];
  parts.push(`イベント「${eventName}」の影響分析:`);

  if (ticketRate > 0) {
    parts.push(`チケット数が${ticketRate}%増加`);
  } else if (ticketRate < 0) {
    parts.push(`チケット数が${Math.abs(ticketRate)}%減少`);
  }

  if (callRate > 0) {
    parts.push(`コール数が${callRate}%増加`);
  } else if (callRate < 0) {
    parts.push(`コール数が${Math.abs(callRate)}%減少`);
  }

  if (topCategories.length > 0) {
    const top = topCategories.slice(0, 3).map(c => `${c.category}(+${c.increaseRate}%)`).join('、');
    parts.push(`増加カテゴリ: ${top}`);
  }

  parts.push(`Impact Score: ${impactScore}/100`);

  return parts.join('。');
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { COMPANY_LIST } from '@/lib/company-colors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sourceKey = searchParams.get('sourceKey');

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'startDate and endDate required' }, { status: 400 });
    }

    const gte = new Date(startDate + 'T00:00:00+09:00');
    const lt = new Date(endDate + 'T00:00:00+09:00');
    lt.setDate(lt.getDate() + 1);

    // Single query: get ALL tickets with source_key, then split client-side
    const ticketWhere: any = { isExcluded: false, createdAt: { gte, lt } };
    if (sourceKey && sourceKey !== 'ALL') {
      ticketWhere.sourceKey = sourceKey;
    }

    const tickets = await prisma.ticket.findMany({
      where: ticketWhere,
      select: { createdAt: true, channelType: true, firstCommentAt: true, sourceKey: true },
    });

    // Get events for markers
    const events = await prisma.eventLog.findMany({
      where: { occurredAt: { gte, lt } },
      select: { id: true, name: true, eventType: true, occurredAt: true },
    });

    // Build date range
    const dates: string[] = [];
    const cursor = new Date(gte);
    while (cursor < lt) {
      dates.push(cursor.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Event markers by date
    const eventsByDate = new Map<string, any[]>();
    for (const e of events) {
      const d = e.occurredAt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
      if (!eventsByDate.has(d)) eventsByDate.set(d, []);
      eventsByDate.get(d)!.push({ id: e.id, name: e.name, eventType: e.eventType });
    }

    // If single company requested, return simple format
    if (sourceKey && sourceKey !== 'ALL') {
      const dailyMap = new Map<string, { ticketCount: number; callCount: number }>();
      for (const d of dates) dailyMap.set(d, { ticketCount: 0, callCount: 0 });

      for (const t of tickets) {
        const isCC = t.channelType === 'call_center';
        const effectiveDate = isCC && t.firstCommentAt ? t.firstCommentAt : t.createdAt;
        const d = effectiveDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
        const entry = dailyMap.get(d);
        if (!entry) continue;
        if (isCC) entry.callCount++; else entry.ticketCount++;
      }

      const daily = dates.map((d) => ({
        date: d,
        ...(dailyMap.get(d) ?? { ticketCount: 0, callCount: 0 }),
        eventMarkers: eventsByDate.get(d) ?? [],
      }));

      return NextResponse.json({ success: true, data: { daily, metadata: {} } });
    }

    // ALL companies: return per-company breakdown in one response
    const companyDailyMap = new Map<string, Map<string, { ticketCount: number; callCount: number }>>();
    for (const c of COMPANY_LIST) {
      const m = new Map<string, { ticketCount: number; callCount: number }>();
      for (const d of dates) m.set(d, { ticketCount: 0, callCount: 0 });
      companyDailyMap.set(c.key, m);
    }

    for (const t of tickets) {
      const sk = t.sourceKey;
      const companyMap = sk ? companyDailyMap.get(sk) : null;
      if (!companyMap) continue;
      const isCC = t.channelType === 'call_center';
      const effectiveDate = isCC && t.firstCommentAt ? t.firstCommentAt : t.createdAt;
      const d = effectiveDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
      const entry = companyMap.get(d);
      if (!entry) continue;
      if (isCC) entry.callCount++; else entry.ticketCount++;
    }

    const companies = COMPANY_LIST.map((c) => {
      const m = companyDailyMap.get(c.key)!;
      return {
        sourceKey: c.key,
        companyName: c.name,
        daily: dates.map((d) => ({
          date: d,
          ...(m.get(d) ?? { ticketCount: 0, callCount: 0 }),
          eventMarkers: eventsByDate.get(d) ?? [],
        })),
      };
    });

    return NextResponse.json({ success: true, data: { companies, metadata: {} } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

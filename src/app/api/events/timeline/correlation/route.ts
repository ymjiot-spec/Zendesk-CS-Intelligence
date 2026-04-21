import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sourceKey = searchParams.get('sourceKey');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const gte = new Date(startDate + 'T00:00:00+09:00');
    const lt = new Date(endDate + 'T00:00:00+09:00');
    lt.setDate(lt.getDate() + 1);

    // Build ticket where clause
    const ticketWhere: any = {
      isExcluded: false,
      createdAt: { gte, lt },
    };
    if (sourceKey && sourceKey !== 'ALL') {
      ticketWhere.sourceKey = sourceKey;
    }

    // Get all tickets in range
    const tickets = await prisma.ticket.findMany({
      where: ticketWhere,
      select: {
        createdAt: true,
        channelType: true,
        firstCommentAt: true,
      },
    });

    // Get events in range for markers
    const eventWhere: any = { occurredAt: { gte, lt } };
    if (sourceKey && sourceKey !== 'ALL') {
      eventWhere.OR = [
        { sourceKey },
        { sourceKey: null },
        { sourceKey: 'ALL' },
      ];
    }
    const events = await prisma.eventLog.findMany({
      where: eventWhere,
      select: { id: true, name: true, eventType: true, occurredAt: true },
    });

    // Build daily aggregation
    const dailyMap = new Map<string, { ticketCount: number; callCount: number; eventMarkers: any[] }>();

    // Initialize all dates in range
    const cursor = new Date(gte);
    while (cursor < lt) {
      const dateStr = cursor.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
      dailyMap.set(dateStr, { ticketCount: 0, callCount: 0, eventMarkers: [] });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Aggregate tickets
    for (const t of tickets) {
      const isCC = t.channelType === 'call_center';
      const effectiveDate = isCC && t.firstCommentAt ? t.firstCommentAt : t.createdAt;
      const dateStr = effectiveDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
      const entry = dailyMap.get(dateStr);
      if (!entry) continue;
      if (isCC) {
        entry.callCount++;
      } else {
        entry.ticketCount++;
      }
    }

    // Add event markers
    for (const e of events) {
      const dateStr = e.occurredAt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
      const entry = dailyMap.get(dateStr);
      if (entry) {
        entry.eventMarkers.push({ id: e.id, name: e.name, eventType: e.eventType });
      }
    }

    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    return NextResponse.json({
      success: true,
      data: { daily, metadata: {} },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'error' },
      { status: 500 }
    );
  }
}

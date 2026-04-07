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

    const rows = await prisma.hourlyAggregation.findMany({
      where: { sourceKey: source, aggregationDate: { gte: start, lt: end } },
      orderBy: { hour: 'asc' },
    });

    // hour別に集計
    const hourMap = new Map<number, number>();
    for (const r of rows) {
      hourMap.set(r.hour, (hourMap.get(r.hour) ?? 0) + r.count);
    }

    const data = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: hourMap.get(h) ?? 0,
      label: `${h}時`,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

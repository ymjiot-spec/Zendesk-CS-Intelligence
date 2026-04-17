import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jstDateRange } from '@/lib/date-jst';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (startDate && endDate) {
      const range = jstDateRange(startDate, endDate);
      where.detectedAt = { gte: range.gte, lt: range.lt };
    }

    const rows = await prisma.anomalyEvent.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });

    const data = rows.map(r => ({
      id: r.id,
      detectedAt: r.detectedAt,
      type: r.detectionType as 'threshold' | 'trend',
      metric: r.metric,
      currentValue: r.currentValue,
      thresholdOrBaseline: r.baselineValue,
      deviation: r.deviation,
      severity: r.severity as 'warning' | 'critical',
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

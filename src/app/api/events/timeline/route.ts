import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { COMPANY_LIST, getCompanyName } from '@/lib/company-colors';

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

    const where: any = { occurredAt: { gte, lt } };

    const events = await prisma.eventLog.findMany({
      where,
      orderBy: { occurredAt: 'asc' },
      select: {
        id: true,
        name: true,
        eventType: true,
        occurredAt: true,
        sourceKey: true,
        impactScore: true,
      },
    });

    // Group by sourceKey
    const allCompanyEvents = events.filter(
      (e) => e.sourceKey === null || e.sourceKey === 'ALL'
    );

    const groups = COMPANY_LIST.map((company) => ({
      sourceKey: company.key,
      companyName: company.name,
      events: events.filter((e) => e.sourceKey === company.key),
    }));

    return NextResponse.json({
      success: true,
      data: { groups, allCompanyEvents, metadata: {} },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'error' },
      { status: 500 }
    );
  }
}

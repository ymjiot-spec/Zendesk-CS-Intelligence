import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { COMPANY_LIST } from '@/lib/company-colors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const gte = new Date(startDate + 'T00:00:00+09:00');
    const lt = new Date(endDate + 'T00:00:00+09:00');
    lt.setDate(lt.getDate() + 1);

    // Use raw SQL to get sourceKey (Prisma client cache issue)
    const events: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT id, name, event_type as "eventType", occurred_at as "occurredAt", source_key as "sourceKey", impact_score as "impactScore"
       FROM event_logs
       WHERE occurred_at >= $1 AND occurred_at < $2
       ORDER BY occurred_at ASC`,
      gte,
      lt,
    );

    // Normalize dates to ISO strings
    const normalized = events.map((e: any) => ({
      ...e,
      occurredAt: e.occurredAt instanceof Date ? e.occurredAt.toISOString() : e.occurredAt,
    }));

    // Events with sourceKey containing a company key (could be comma-separated)
    const allCompanyEvents = normalized.filter(
      (e: any) => !e.sourceKey || e.sourceKey === 'ALL'
    );

    const groups = COMPANY_LIST.map((company) => ({
      sourceKey: company.key,
      companyName: company.name,
      events: normalized.filter((e: any) => {
        if (!e.sourceKey) return false;
        // Support comma-separated sourceKeys
        return e.sourceKey.split(',').includes(company.key);
      }),
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

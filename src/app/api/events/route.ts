import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (startDate && endDate) {
      where.occurredAt = {
        gte: new Date(startDate + 'T00:00:00+09:00'),
        lt: new Date(endDate + 'T00:00:00+09:00'),
      };
      where.occurredAt.lt.setDate(where.occurredAt.lt.getDate() + 1);
    }

    const events = await prisma.eventLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.eventType || !body.occurredAt) {
      return NextResponse.json({ success: false, error: 'name, eventType, occurredAt are required' }, { status: 400 });
    }

    const sourceKey = body.sourceKey || null;

    // Use raw SQL to insert because Prisma client cache may not recognize sourceKey yet
    const id = crypto.randomUUID();
    const now = new Date();
    await (prisma as any).$queryRawUnsafe(
      `INSERT INTO event_logs (id, name, event_type, occurred_at, description, memo, urls, tags, source_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      id,
      body.name,
      body.eventType,
      new Date(body.occurredAt),
      body.description || '',
      body.memo || null,
      JSON.stringify(body.urls || []),
      JSON.stringify(body.tags || []),
      sourceKey,
      now,
      now,
    );

    const event = { id, name: body.name, eventType: body.eventType, occurredAt: body.occurredAt, sourceKey, description: body.description || '', tags: body.tags || [], memo: body.memo || null, urls: body.urls || [], createdAt: now, updatedAt: now };

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('Event create error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

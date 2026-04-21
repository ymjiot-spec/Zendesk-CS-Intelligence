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

    const event = await prisma.eventLog.create({
      data: {
        name: body.name,
        eventType: body.eventType,
        occurredAt: new Date(body.occurredAt),
        description: body.description || '',
        tags: body.tags || [],
        memo: body.memo || null,
        urls: body.urls || [],
      },
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('Event create error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { ApiResponse } from '@/types/api';
import type { EventLog } from '@/types/event';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await prisma.eventLog.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, data: null, meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } }, error: { code: 'NOT_FOUND', message: 'Event not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<typeof event>>({
      success: true,
      data: event,
      meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } }, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const event = await prisma.eventLog.update({
      where: { id },
      data: {
        name: body.name,
        eventType: body.eventType,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
        description: body.description ?? '',
        tags: body.tags ?? [],
        memo: body.memo ?? null,
        urls: body.urls ?? [],
      },
    });

    return NextResponse.json<ApiResponse<typeof event>>({
      success: true,
      data: event,
      meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } }, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.eventLog.delete({ where: { id } });

    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
      success: true,
      data: { deleted: true },
      meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } }, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

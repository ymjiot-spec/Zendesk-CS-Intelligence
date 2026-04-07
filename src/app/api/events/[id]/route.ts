import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { EventLog } from '@/types/event';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'Event ID is required' },
        },
        { status: 400 }
      );
    }

    // Placeholder: would fetch from DB
    const data: EventLog = {
      id,
      name: '',
      eventType: 'other',
      occurredAt: new Date(),
      description: '',
      tags: [],
      urls: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json<ApiResponse<EventLog>>({
      success: true,
      data,
      meta: {
        lastUpdatedAt: new Date().toISOString(),
        populationInfo: { totalCount: 0, excludedCount: 0 },
      },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        data: null,
        meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
        error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      },
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

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'Event ID is required' },
        },
        { status: 400 }
      );
    }

    const data: EventLog = {
      id,
      name: body.name || '',
      eventType: body.eventType || 'other',
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
      description: body.description || '',
      tags: body.tags || [],
      memo: body.memo,
      urls: body.urls || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json<ApiResponse<EventLog>>({
      success: true,
      data,
      meta: {
        lastUpdatedAt: new Date().toISOString(),
        populationInfo: { totalCount: 0, excludedCount: 0 },
      },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        data: null,
        meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
        error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      },
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

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'Event ID is required' },
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
      success: true,
      data: { deleted: true },
      meta: {
        lastUpdatedAt: new Date().toISOString(),
        populationInfo: { totalCount: 0, excludedCount: 0 },
      },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        data: null,
        meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
        error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}

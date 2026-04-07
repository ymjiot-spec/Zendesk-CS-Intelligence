import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PaginatedResult } from '@/types/api';
import type { EventLog } from '@/types/event';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const eventTypes = searchParams.get('eventTypes');
    const tags = searchParams.get('tags');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'occurredAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    void eventTypes;
    void tags;
    void startDate;
    void endDate;
    void sortBy;
    void sortOrder;

    const data: PaginatedResult<EventLog> = {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };

    return NextResponse.json<ApiResponse<PaginatedResult<EventLog>>>({
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.eventType || !body.occurredAt) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'name, eventType, and occurredAt are required' },
        },
        { status: 400 }
      );
    }

    const data: EventLog = {
      id: crypto.randomUUID(),
      name: body.name,
      eventType: body.eventType,
      occurredAt: new Date(body.occurredAt),
      description: body.description || '',
      tags: body.tags || [],
      memo: body.memo,
      urls: body.urls || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json<ApiResponse<EventLog>>(
      {
        success: true,
        data,
        meta: {
          lastUpdatedAt: new Date().toISOString(),
          populationInfo: { totalCount: 0, excludedCount: 0 },
        },
      },
      { status: 201 }
    );
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

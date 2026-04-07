import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { NotificationRule } from '@/types/notification';

export async function GET() {
  try {
    const data: NotificationRule[] = [];

    return NextResponse.json<ApiResponse<NotificationRule[]>>({
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

    if (!body.channel || !body.destination) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'channel and destination are required' },
        },
        { status: 400 }
      );
    }

    const data: NotificationRule = {
      id: crypto.randomUUID(),
      channel: body.channel,
      destination: body.destination,
      triggerConditions: body.triggerConditions || [],
      enabled: body.enabled ?? true,
    };

    return NextResponse.json<ApiResponse<NotificationRule>>(
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

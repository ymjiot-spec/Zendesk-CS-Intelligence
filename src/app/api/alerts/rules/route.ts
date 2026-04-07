import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { AlertRule } from '@/types/alert';

export async function GET() {
  try {
    const data: AlertRule[] = [];

    return NextResponse.json<ApiResponse<AlertRule[]>>({
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

    if (!body.name || !body.triggerType || !body.conditions) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'name, triggerType, and conditions are required' },
        },
        { status: 400 }
      );
    }

    const data: AlertRule = {
      id: crypto.randomUUID(),
      name: body.name,
      triggerType: body.triggerType,
      conditions: body.conditions,
      targetCategory: body.targetCategory,
      notificationChannels: body.notificationChannels || [],
      cooldownMinutes: body.cooldownMinutes ?? 60,
      enabled: body.enabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json<ApiResponse<AlertRule>>(
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

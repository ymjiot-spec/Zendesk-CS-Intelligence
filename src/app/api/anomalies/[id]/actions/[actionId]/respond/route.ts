import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface ActionResponse {
  response: 'accepted' | 'deferred' | 'rejected';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { id, actionId } = await params;

    if (!id || !actionId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'Anomaly ID and Action ID are required' },
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as ActionResponse;

    if (!body.response || !['accepted', 'deferred', 'rejected'].includes(body.response)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'response must be one of: accepted, deferred, rejected' },
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<{ acknowledged: boolean }>>({
      success: true,
      data: { acknowledged: true },
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

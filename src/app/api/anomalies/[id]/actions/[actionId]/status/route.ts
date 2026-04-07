import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface StatusUpdate {
  executionStatus: 'not_started' | 'in_progress' | 'completed';
}

export async function PUT(
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

    const body = (await request.json()) as StatusUpdate;

    if (!body.executionStatus || !['not_started', 'in_progress', 'completed'].includes(body.executionStatus)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'executionStatus must be one of: not_started, in_progress, completed' },
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<{ updated: boolean }>>({
      success: true,
      data: { updated: true },
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

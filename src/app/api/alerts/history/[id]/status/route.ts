import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface StatusUpdate {
  status: 'unresolved' | 'in_progress' | 'resolved';
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as StatusUpdate;

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'Alert firing record ID is required' },
        },
        { status: 400 }
      );
    }

    if (!body.status || !['unresolved', 'in_progress', 'resolved'].includes(body.status)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'status must be one of: unresolved, in_progress, resolved' },
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

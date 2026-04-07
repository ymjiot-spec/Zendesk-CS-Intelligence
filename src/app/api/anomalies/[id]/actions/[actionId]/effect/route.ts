import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface EffectMetrics {
  preActionCount: number;
  postActionCount: number;
  changeRate: number;
}

export async function GET(
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

    const data: EffectMetrics = {
      preActionCount: 0,
      postActionCount: 0,
      changeRate: 0,
    };

    return NextResponse.json<ApiResponse<EffectMetrics>>({
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

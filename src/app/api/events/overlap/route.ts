import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { OverlapAnalysisResult } from '@/types/ai';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date');
    const windowDays = parseInt(searchParams.get('windowDays') || '3', 10);

    if (!date) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'date is required' },
        },
        { status: 400 }
      );
    }

    void windowDays;

    const data: OverlapAnalysisResult = {
      period: { start: new Date(date), end: new Date(date) },
      events: [],
      ranking: [],
      summary: '',
    };

    return NextResponse.json<ApiResponse<OverlapAnalysisResult>>({
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

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface SuggestionResponse {
  action: 'register' | 'later' | 'ignore';
}

export async function POST(
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
          error: { code: 'INVALID_PARAMS', message: 'Anomaly ID is required' },
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as SuggestionResponse;

    if (!body.action || !['register', 'later', 'ignore'].includes(body.action)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'action must be one of: register, later, ignore' },
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

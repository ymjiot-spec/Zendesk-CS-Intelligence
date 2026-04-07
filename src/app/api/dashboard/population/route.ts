import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface PopulationInfo {
  totalCount: number;
  excludedCount: number;
  includedCount: number;
  excludeCondition: string;
  lastUpdatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const preset = searchParams.get('preset');

    if (!startDate && !endDate && !preset) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'startDate/endDate or preset is required' },
        },
        { status: 400 }
      );
    }

    const data: PopulationInfo = {
      totalCount: 0,
      excludedCount: 0,
      includedCount: 0,
      excludeCondition: 'Ticket_Status starts with "Z" or "Z :"',
      lastUpdatedAt: new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse<PopulationInfo>>({
      success: true,
      data,
      meta: {
        lastUpdatedAt: new Date().toISOString(),
        populationInfo: { totalCount: data.totalCount, excludedCount: data.excludedCount },
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

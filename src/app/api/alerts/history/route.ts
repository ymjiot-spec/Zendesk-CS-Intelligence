import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PaginatedResult } from '@/types/api';
import type { AlertFiringRecord } from '@/types/alert';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const status = searchParams.get('status');
    const alertRuleId = searchParams.get('alertRuleId');

    void status;
    void alertRuleId;

    const data: PaginatedResult<AlertFiringRecord> = {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };

    return NextResponse.json<ApiResponse<PaginatedResult<AlertFiringRecord>>>({
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

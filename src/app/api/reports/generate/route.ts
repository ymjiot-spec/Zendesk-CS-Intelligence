import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { AutoReport } from '@/types/report';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const period = body.period || 'weekly';

    if (!['weekly', 'monthly', 'custom'].includes(period)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'period must be one of: weekly, monthly, custom' },
        },
        { status: 400 }
      );
    }

    if (period === 'custom' && (!body.startDate || !body.endDate)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'startDate and endDate are required for custom period' },
        },
        { status: 400 }
      );
    }

    const data: AutoReport = {
      id: crypto.randomUUID(),
      period,
      startDate: new Date(body.startDate || new Date()),
      endDate: new Date(body.endDate || new Date()),
      content: {
        totalTickets: 0,
        previousPeriodComparison: { diff: 0, rate: 0 },
        categoryHighlights: [],
        anomalyEvents: [],
        eventLogs: [],
        forecast: { predictedCount: 0, basis: '' },
        narrativeSummary: '',
      },
      generatedAt: new Date(),
    };

    return NextResponse.json<ApiResponse<AutoReport>>(
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

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface ReportSettings {
  schedule: 'weekly' | 'monthly' | 'custom';
  distributionChannels: { channel: string; destination: string }[];
  enabled: boolean;
}

export async function GET() {
  try {
    const data: ReportSettings = {
      schedule: 'weekly',
      distributionChannels: [],
      enabled: false,
    };

    return NextResponse.json<ApiResponse<ReportSettings>>({
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

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as ReportSettings;

    if (!body.schedule || !['weekly', 'monthly', 'custom'].includes(body.schedule)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'schedule must be one of: weekly, monthly, custom' },
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<ReportSettings>>({
      success: true,
      data: body,
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

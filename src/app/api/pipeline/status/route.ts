import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface PipelineStatus {
  batchPipeline: {
    lastRunAt: string | null;
    status: 'idle' | 'running' | 'error';
    nextScheduledAt: string;
  };
  incrementalPipeline: {
    lastFetchAt: string | null;
    status: 'idle' | 'running' | 'error';
    intervalMinutes: number;
  };
  dataSources: {
    name: string;
    type: string;
    status: 'connected' | 'disconnected' | 'error';
    lastSyncAt: string | null;
  }[];
}

export async function GET() {
  try {
    const data: PipelineStatus = {
      batchPipeline: {
        lastRunAt: null,
        status: 'idle',
        nextScheduledAt: new Date().toISOString(),
      },
      incrementalPipeline: {
        lastFetchAt: null,
        status: 'idle',
        intervalMinutes: 15,
      },
      dataSources: [
        {
          name: 'Zendesk Tickets API',
          type: 'rest_api',
          status: 'disconnected',
          lastSyncAt: null,
        },
      ],
    };

    return NextResponse.json<ApiResponse<PipelineStatus>>({
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

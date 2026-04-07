import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { AlertRule, AlertPresetType } from '@/types/alert';

const PRESETS: Record<AlertPresetType, Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>> = {
  total_surge: {
    name: '問い合わせ急増アラート',
    triggerType: 'total_surge',
    conditions: [{ method: 'day_over_day_rate', value: 150 }],
    notificationChannels: [],
    cooldownMinutes: 60,
    enabled: true,
  },
  category_surge: {
    name: '特定カテゴリ急増アラート',
    triggerType: 'category_surge',
    conditions: [{ method: 'sigma_deviation', value: 2.0 }],
    notificationChannels: [],
    cooldownMinutes: 60,
    enabled: true,
  },
  anomaly_detection: {
    name: '異常検知アラート',
    triggerType: 'total_surge',
    conditions: [{ method: 'sigma_deviation', value: 2.0 }],
    notificationChannels: [],
    cooldownMinutes: 60,
    enabled: true,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const presetType = body.presetType as AlertPresetType;

    if (!presetType || !PRESETS[presetType]) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          data: null,
          meta: { lastUpdatedAt: new Date().toISOString(), populationInfo: { totalCount: 0, excludedCount: 0 } },
          error: { code: 'INVALID_PARAMS', message: 'presetType must be one of: total_surge, category_surge, anomaly_detection' },
        },
        { status: 400 }
      );
    }

    const preset = PRESETS[presetType];
    const data: AlertRule = {
      ...preset,
      id: crypto.randomUUID(),
      targetCategory: body.targetCategory,
      notificationChannels: body.notificationChannels || preset.notificationChannels,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json<ApiResponse<AlertRule>>(
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

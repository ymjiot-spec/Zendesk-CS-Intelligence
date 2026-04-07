'use client';

import React from 'react';
import type { DailySummary } from '@/types/aggregation';

function TrendIndicator({ trend, diff, rate }: { trend: DailySummary['trend']; diff: number; rate: number }) {
  const configs = {
    increase: { arrow: '↑', color: 'text-red-600', bg: 'bg-red-50' },
    decrease: { arrow: '↓', color: 'text-green-600', bg: 'bg-green-50' },
    flat: { arrow: '→', color: 'text-gray-500', bg: 'bg-gray-50' },
  };
  const config = configs[trend] ?? configs.flat;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color} ${config.bg}`}>
      <span>{config.arrow}</span>
      <span>{diff >= 0 ? '+' : ''}{diff}件</span>
      <span>({rate >= 0 ? '+' : ''}{rate.toFixed(1)}%)</span>
    </span>
  );
}

interface DailySummaryCardProps {
  data: DailySummary | null;
  loading?: boolean;
}

export default function DailySummaryCard({ data, loading }: DailySummaryCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-32" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 text-sm text-gray-400">
        データなし
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-xs font-medium text-gray-500 mb-1">当日チケット合計</h3>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-3xl font-bold text-gray-900">{data.totalCount}</span>
        <span className="text-xs text-gray-400">件</span>
        <TrendIndicator trend={data.trend} diff={data.dayOverDayDiff} rate={data.dayOverDayRate} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-xs text-gray-500">7日平均</span>
          <p className="font-semibold text-gray-800">{data.avg7Days.toFixed(1)} 件/日</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">30日平均</span>
          <p className="font-semibold text-gray-800">{data.avg30Days.toFixed(1)} 件/日</p>
        </div>
      </div>
    </div>
  );
}

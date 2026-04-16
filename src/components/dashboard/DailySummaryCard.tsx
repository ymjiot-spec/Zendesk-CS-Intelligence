'use client';

import React from 'react';

interface SummaryData {
  date: string;
  totalCount: number;
  todayCount: number;
  previousDayCount: number;
  dayOverDayDiff: number;
  dayOverDayRate: number;
  trend: 'increase' | 'decrease' | 'flat';
  avg7Days: number;
  avg30Days: number;
  last7DaysCount: number;
  thisWeekCount: number;
  lastWeekCount: number;
  weekOverWeekDiff: number;
  weekOverWeekRate: number;
  thisMonthCount: number;
  lastMonthCount: number;
  monthOverMonthDiff: number;
  monthOverMonthRate: number;
}

function TrendBadge({ diff, rate, label }: { diff: number; rate: number; label: string }) {
  if (diff === 0) return <span className="text-xs text-gray-400">{label}: ±0</span>;
  const isUp = diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
      {isUp ? '↑' : '↓'} {label}: {isUp ? '+' : ''}{diff}件 ({isUp ? '+' : ''}{rate.toFixed(1)}%)
    </span>
  );
}

interface DailySummaryCardProps {
  data: SummaryData | null;
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
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      {/* 選択期間の合計 */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 mb-1">選択期間 合計</h3>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-gray-900">{data.totalCount}</span>
          <span className="text-xs text-gray-400">件</span>
        </div>
      </div>

      {/* 今日 / 昨日 / 前日比 */}
      <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-3">
        <div>
          <span className="text-xs text-gray-500">今日</span>
          <p className="font-semibold text-gray-800">{data.todayCount} 件</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">昨日</span>
          <p className="font-semibold text-gray-800">{data.previousDayCount} 件</p>
        </div>
      </div>
      <div>
        <TrendBadge diff={data.dayOverDayDiff} rate={data.dayOverDayRate} label="前日比" />
      </div>

      {/* 直近7日 / 平均 */}
      <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-3">
        <div>
          <span className="text-xs text-gray-500">直近7日合計</span>
          <p className="font-semibold text-gray-800">{data.last7DaysCount} 件</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">7日平均</span>
          <p className="font-semibold text-gray-800">{data.avg7Days.toFixed(1)} 件/日</p>
        </div>
      </div>

      {/* 週比較 */}
      <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-3">
        <div>
          <span className="text-xs text-gray-500">今週合計</span>
          <p className="font-semibold text-gray-800">{data.thisWeekCount} 件</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">先週合計</span>
          <p className="font-semibold text-gray-800">{data.lastWeekCount} 件</p>
        </div>
      </div>
      <div>
        <TrendBadge diff={data.weekOverWeekDiff} rate={data.weekOverWeekRate} label="週比較" />
      </div>

      {/* 月比較 */}
      <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-3">
        <div>
          <span className="text-xs text-gray-500">今月合計</span>
          <p className="font-semibold text-gray-800">{data.thisMonthCount} 件</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">先月合計</span>
          <p className="font-semibold text-gray-800">{data.lastMonthCount} 件</p>
        </div>
      </div>
      <div>
        <TrendBadge diff={data.monthOverMonthDiff} rate={data.monthOverMonthRate} label="月比較" />
      </div>

      {/* 30日平均 */}
      <div className="text-sm border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">30日平均</span>
        <p className="font-semibold text-gray-800">{data.avg30Days.toFixed(1)} 件/日</p>
      </div>
    </div>
  );
}

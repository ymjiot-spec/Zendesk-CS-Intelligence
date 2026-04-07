'use client';

import React from 'react';
import type { CategoryBreakdown as CategoryBreakdownType } from '@/types/aggregation';

function DiffBadge({ value, label }: { value: number; label: string }) {
  if (value === 0) return <span className="text-xs text-gray-400">{label}: ±0</span>;
  const isIncrease = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isIncrease ? 'text-red-600' : 'text-green-600'
      }`}
    >
      {isIncrease ? '↑' : '↓'}
      {label}: {isIncrease ? '+' : ''}{value}
    </span>
  );
}

interface CategoryBreakdownProps {
  data: CategoryBreakdownType[];
  loading?: boolean;
}

export default function CategoryBreakdown({ data, loading }: CategoryBreakdownProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 bg-gray-200 rounded mb-2" />
        ))}
      </div>
    );
  }

  // Top 5 + "その他" aggregation
  const safeData = Array.isArray(data) ? data : [];
  const sorted = [...safeData].sort((a, b) => a.rank - b.rank);
  let displayItems: CategoryBreakdownType[];

  if (sorted.length > 6) {
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const otherItem: CategoryBreakdownType = {
      category: 'その他',
      count: rest.reduce((s, r) => s + r.count, 0),
      percentage: rest.reduce((s, r) => s + r.percentage, 0),
      previousDayDiff: rest.reduce((s, r) => s + r.previousDayDiff, 0),
      previousWeekSameDayDiff: rest.reduce((s, r) => s + r.previousWeekSameDayDiff, 0),
      trend: 'flat',
      rank: 6,
    };
    displayItems = [...top5, otherItem];
  } else {
    displayItems = sorted;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        カテゴリ別分析（当日）
      </h3>

      {displayItems.length === 0 ? (
        <p className="text-sm text-gray-400">データなし</p>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => (
            <div key={item.category} className="flex items-center gap-3">
              {/* Rank */}
              <span className="w-6 text-center text-xs font-bold text-gray-400">
                {item.rank}
              </span>

              {/* Bar + info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {item.category}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 ml-2">
                    {item.count}件 ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
                {/* Diff badges */}
                <div className="flex gap-3 mt-1">
                  <DiffBadge value={item.previousDayDiff} label="前日比" />
                  <DiffBadge value={item.previousWeekSameDayDiff} label="前週同曜日比" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

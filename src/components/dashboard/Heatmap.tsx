'use client';

import React, { useState } from 'react';
import type { HeatmapData } from '@/types/aggregation';

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getColor(count: number, min: number, max: number): string {
  if (max === min) return 'bg-blue-100';
  const ratio = (count - min) / (max - min);
  if (ratio < 0.2) return 'bg-blue-50';
  if (ratio < 0.4) return 'bg-blue-100';
  if (ratio < 0.6) return 'bg-blue-200';
  if (ratio < 0.8) return 'bg-blue-400';
  return 'bg-blue-600';
}

function getTextColor(count: number, min: number, max: number): string {
  if (max === min) return 'text-blue-800';
  const ratio = (count - min) / (max - min);
  return ratio >= 0.6 ? 'text-white' : 'text-blue-900';
}

interface HeatmapProps {
  data: HeatmapData | null;
  loading?: boolean;
}

export default function Heatmap({ data, loading }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{ day: string; hour: number; count: number } | null>(null);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data || data.cells.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          曜日×時間帯ヒートマップ
        </h3>
        <p className="text-sm text-gray-400">データなし</p>
      </div>
    );
  }

  const { cells, minCount, maxCount } = data;

  // Build lookup: dayOfWeek (0=Mon) -> hour -> count
  const lookup = new Map<string, number>();
  cells.forEach((c) => lookup.set(`${c.dayOfWeek}-${c.hour}`, c.count));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        曜日×時間帯ヒートマップ
      </h3>

      <div className="overflow-x-auto">
        <table className="text-[10px]">
          <thead>
            <tr>
              <th className="w-8" />
              {HOURS.map((h) => (
                <th key={h} className="px-0.5 py-1 text-center text-gray-500 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((dayLabel, dayIdx) => (
              <tr key={dayIdx}>
                <td className="pr-2 text-right text-gray-600 font-medium">{dayLabel}</td>
                {HOURS.map((h) => {
                  const count = lookup.get(`${dayIdx}-${h}`) ?? 0;
                  const bg = getColor(count, minCount, maxCount);
                  const textColor = getTextColor(count, minCount, maxCount);
                  return (
                    <td
                      key={h}
                      className={`w-7 h-7 text-center cursor-default ${bg} ${textColor} border border-white rounded-sm relative`}
                      onMouseEnter={() => setTooltip({ day: dayLabel, hour: h, count })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {count > 0 ? count : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-2 text-xs text-gray-600 bg-gray-50 inline-block px-2 py-1 rounded">
          {tooltip.day}曜 {tooltip.hour}時: <span className="font-semibold">{tooltip.count}件</span>
        </div>
      )}

      {/* Color scale legend */}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500">
        <span>少</span>
        <div className="flex gap-0.5">
          {['bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600'].map((c) => (
            <div key={c} className={`w-5 h-3 rounded-sm ${c}`} />
          ))}
        </div>
        <span>多</span>
        <span className="ml-2 text-gray-400">({minCount}〜{maxCount}件)</span>
      </div>
    </div>
  );
}

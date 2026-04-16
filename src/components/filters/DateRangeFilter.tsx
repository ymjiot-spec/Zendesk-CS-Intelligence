'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { QuickSelect } from '@/types/api';

const QUICK_SELECT_OPTIONS: { label: string; value: QuickSelect }[] = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
  { label: '今週', value: 'this_week' },
  { label: '先週', value: 'last_week' },
  { label: '今月', value: 'this_month' },
  { label: '先月', value: 'last_month' },
];

/**
 * JST基準で現在の日付文字列を返す。
 * ブラウザのタイムゾーンに関係なくJST日付を返す。
 */
function todayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

/**
 * JST基準でN日前の日付文字列を返す。
 */
function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00+09:00');
  d.setDate(d.getDate() + days);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

function resolveQuickSelect(preset: QuickSelect): { startDate: string; endDate: string } {
  const today = todayJST();

  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const y = shiftDays(today, -1);
      return { startDate: y, endDate: y };
    }
    case 'this_week': {
      // 月曜始まり
      const d = new Date(today + 'T12:00:00+09:00');
      const dayOfWeek = d.getDay(); // 0=Sun
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = shiftDays(today, -diff);
      return { startDate: monday, endDate: today };
    }
    case 'last_week': {
      const d = new Date(today + 'T12:00:00+09:00');
      const dayOfWeek = d.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = shiftDays(today, -diff);
      const lastMonday = shiftDays(thisMonday, -7);
      const lastSunday = shiftDays(thisMonday, -1);
      return { startDate: lastMonday, endDate: lastSunday };
    }
    case 'this_month': {
      const first = today.slice(0, 8) + '01';
      return { startDate: first, endDate: today };
    }
    case 'last_month': {
      const year = parseInt(today.slice(0, 4), 10);
      const month = parseInt(today.slice(5, 7), 10);
      let prevYear = year;
      let prevMonth = month - 1;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      const first = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month - 1, 0).getDate();
      const last = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { startDate: first, endDate: last };
    }
  }
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangeFilterProps {
  onChange: (range: DateRange) => void;
}

export default function DateRangeFilter({ onChange }: DateRangeFilterProps) {
  const defaultRange = resolveQuickSelect('today');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [activePreset, setActivePreset] = useState<QuickSelect | null>('today');

  // Trigger onChange on mount with default "today"
  useEffect(() => {
    onChange({ startDate: defaultRange.startDate, endDate: defaultRange.endDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuickSelect = useCallback(
    (preset: QuickSelect) => {
      const range = resolveQuickSelect(preset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      setActivePreset(preset);
      onChange(range);
    },
    [onChange],
  );

  const handleManualChange = useCallback(
    (field: 'startDate' | 'endDate', value: string) => {
      const next = { startDate, endDate };
      next[field] = value;
      if (field === 'startDate') setStartDate(value);
      else setEndDate(value);
      setActivePreset(null);
      onChange(next);
    },
    [startDate, endDate, onChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
      {/* Quick select buttons */}
      <div className="flex gap-1">
        {QUICK_SELECT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleQuickSelect(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              activePreset === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Date pickers */}
      <div className="flex items-center gap-2 text-sm">
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleManualChange('startDate', e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
          aria-label="開始日"
        />
        <span className="text-gray-400">〜</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => handleManualChange('endDate', e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
          aria-label="終了日"
        />
      </div>
    </div>
  );
}

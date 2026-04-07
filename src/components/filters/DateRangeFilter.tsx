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

function resolveQuickSelect(preset: QuickSelect): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { startDate: fmt(today), endDate: fmt(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case 'this_week': {
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((day + 6) % 7));
      return { startDate: fmt(monday), endDate: fmt(today) };
    }
    case 'last_week': {
      const day = today.getDay();
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - ((day + 6) % 7));
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      return { startDate: fmt(lastMonday), endDate: fmt(lastSunday) };
    }
    case 'this_month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmt(first), endDate: fmt(today) };
    }
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: fmt(first), endDate: fmt(last) };
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

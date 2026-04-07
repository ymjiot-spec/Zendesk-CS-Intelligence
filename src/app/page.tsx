'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter';
import { DailySummaryCard, CategoryBreakdown, MatrixTable, HourlyChart, Heatmap } from '@/components/dashboard';
import { AlertBanner } from '@/components/alert';
import type { DailySummary, CategoryBreakdown as CategoryBreakdownType, MatrixRow, HourlyData, HeatmapData } from '@/types/aggregation';
import type { AlertFiringRecord } from '@/types/alert';

interface SourceConfig {
  key: string;
  name: string;
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [categories, setCategories] = useState<CategoryBreakdownType[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [alerts, setAlerts] = useState<AlertFiringRecord[]>([]);
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [activeSource, setActiveSource] = useState<string>('ALL');
  const [syncing, setSyncing] = useState(false);

  // 会社一覧取得
  useEffect(() => {
    fetch('/api/pipeline')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setSources(Array.isArray(j.data?.sources) ? j.data.sources : []);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (range: DateRange, source: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate, source });
      const [sumRes, catRes, matRes, hourRes, alertRes] = await Promise.allSettled([
        fetch(`/api/dashboard/summary?${params}`),
        fetch(`/api/dashboard/categories?${params}`),
        fetch(`/api/dashboard/matrix?${params}`),
        fetch(`/api/dashboard/hourly?${params}`),
        fetch(`/api/alerts/history?status=unresolved`),
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value.ok) {
        const json = await sumRes.value.json();
        setSummary(json.data ?? json);
      }
      if (catRes.status === 'fulfilled' && catRes.value.ok) {
        const json = await catRes.value.json();
        setCategories(Array.isArray(json.data) ? json.data : []);
      }
      if (matRes.status === 'fulfilled' && matRes.value.ok) {
        const json = await matRes.value.json();
        setMatrix(Array.isArray(json.data) ? json.data : []);
      }
      if (hourRes.status === 'fulfilled' && hourRes.value.ok) {
        const json = await hourRes.value.json();
        setHourly(Array.isArray(json.data) ? json.data : []);
      }
      if (alertRes.status === 'fulfilled' && alertRes.value.ok) {
        const json = await alertRes.value.json();
        setAlerts(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateChange = useCallback((range: DateRange) => {
    setDateRange(range);
    fetchData(range, activeSource);
  }, [fetchData, activeSource]);

  const handleSourceChange = (source: string) => {
    setActiveSource(source);
    if (dateRange) fetchData(dateRange, source);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/pipeline', { method: 'POST' });
      const json = await res.json();
      if (json.success && dateRange) {
        fetchData(dateRange, activeSource);
      }
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  const allButtons = [
    { key: 'ALL', name: '全社比較' },
    ...sources,
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <AlertBanner alerts={alerts} />

        {/* 会社切り替えボタン + 同期ボタン */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {allButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => handleSourceChange(btn.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                  activeSource === btn.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                }`}
              >
                {btn.name}
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-all"
          >
            {syncing ? '同期中...' : '🔄 Zendesk同期'}
          </button>
        </div>

        <DateRangeFilter onChange={handleDateChange} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DailySummaryCard data={summary} loading={loading} />
          <div className="lg:col-span-2">
            <CategoryBreakdown data={categories} loading={loading} />
          </div>
        </div>

        <MatrixTable data={matrix} loading={loading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HourlyChart data={hourly} loading={loading} />
          <Heatmap data={heatmap} loading={loading} />
        </div>
      </div>
    </DashboardLayout>
  );
}

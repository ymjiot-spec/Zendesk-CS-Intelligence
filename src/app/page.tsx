'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter';
import { CategoryBreakdown, MatrixTable, HourlyChart, Heatmap } from '@/components/dashboard';
import { AlertBanner } from '@/components/alert';
import { getCompanyColor } from '@/lib/company-colors';
import type { CategoryBreakdown as CategoryBreakdownType, MatrixRow, HourlyData, HeatmapData } from '@/types/aggregation';
import type { AlertFiringRecord } from '@/types/alert';

interface SourceConfig { key: string; name: string; }

// --- KPIカード ---
function KpiCard({ label, value, sub, diff, rate, color }: {
  label: string; value: number | string; sub?: string;
  diff?: number; rate?: number; color?: string;
}) {
  const diffColor = (diff ?? 0) > 0 ? 'text-red-600' : (diff ?? 0) < 0 ? 'text-green-600' : 'text-gray-400';
  const arrow = (diff ?? 0) > 0 ? '↑' : (diff ?? 0) < 0 ? '↓' : '→';
  return (
    <div className={`bg-white rounded-xl border p-4 ${color === 'red' ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}<span className="text-sm font-normal text-gray-400 ml-1">件</span></div>
      {diff !== undefined && (
        <div className={`text-xs mt-1 ${diffColor}`}>
          {arrow} {diff >= 0 ? '+' : ''}{diff}件
          {rate !== undefined && ` (${rate >= 0 ? '+' : ''}${rate}%)`}
        </div>
      )}
      {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<CategoryBreakdownType[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [alerts, setAlerts] = useState<AlertFiringRecord[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [activeSource, setActiveSource] = useState<string>('ALL');
  const [activeChannel, setActiveChannel] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch('/api/pipeline').then(r => r.json()).then(j => {
      if (j.success) setSources(Array.isArray(j.data?.sources) ? j.data.sources : []);
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async (range: DateRange, source: string, channel: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate, source, channel });
      // マトリクスは常に直近7日分を取得
      const matEnd = range.endDate;
      const matStartDate = new Date(matEnd + 'T00:00:00+09:00');
      matStartDate.setDate(matStartDate.getDate() - 6);
      const matStart = `${matStartDate.getFullYear()}-${String(matStartDate.getMonth()+1).padStart(2,'0')}-${String(matStartDate.getDate()).padStart(2,'0')}`;
      const matParams = new URLSearchParams({ startDate: matStart, endDate: matEnd, source, channel });

      const [sumRes, catRes, matRes, hourRes, alertRes, compRes] = await Promise.allSettled([
        fetch(`/api/dashboard/summary?${params}`),
        fetch(`/api/dashboard/categories?${params}`),
        fetch(`/api/dashboard/matrix?${matParams}`),
        fetch(`/api/dashboard/hourly?${params}`),
        fetch(`/api/alerts/history?status=unresolved`),
        fetch(`/api/dashboard/complaints?${params}`),
      ]);
      if (sumRes.status === 'fulfilled' && sumRes.value.ok) { const j = await sumRes.value.json(); setSummary(j.data ?? j); }
      if (catRes.status === 'fulfilled' && catRes.value.ok) { const j = await catRes.value.json(); setCategories(Array.isArray(j.data) ? j.data : []); }
      if (matRes.status === 'fulfilled' && matRes.value.ok) { const j = await matRes.value.json(); setMatrix(Array.isArray(j.data) ? j.data : []); }
      if (hourRes.status === 'fulfilled' && hourRes.value.ok) { const j = await hourRes.value.json(); setHourly(Array.isArray(j.data) ? j.data : []); }
      if (alertRes.status === 'fulfilled' && alertRes.value.ok) { const j = await alertRes.value.json(); setAlerts(Array.isArray(j.data) ? j.data : []); }
      if (compRes.status === 'fulfilled' && compRes.value.ok) { const j = await compRes.value.json(); setComplaints(Array.isArray(j.data) ? j.data : []); }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  const handleDateChange = useCallback((range: DateRange) => {
    setDateRange(range);
    fetchData(range, activeSource, activeChannel);
  }, [fetchData, activeSource, activeChannel]);

  const handleSourceChange = (s: string) => { setActiveSource(s); if (dateRange) fetchData(dateRange, s, activeChannel); };
  const handleChannelChange = (c: string) => { setActiveChannel(c); if (dateRange) fetchData(dateRange, activeSource, c); };
  const handleSync = async () => {
    setSyncing(true);
    try { const r = await fetch('/api/pipeline', { method: 'POST' }); const j = await r.json(); if (j.success && dateRange) fetchData(dateRange, activeSource, activeChannel); }
    catch {} finally { setSyncing(false); }
  };

  const s = summary ?? {};

  const COMPANY_NAME_TO_KEY: Record<string, string> = {
    STAR: 'starservicesupport',
    JTBC: 'dmobilehelp',
    JCN: 'jcnhelp',
    MPCA: 'mpcahelp',
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <AlertBanner alerts={alerts} />

        {/* ヘッダー: 会社 + チャネル + 同期 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {[{ key: 'ALL', name: '全社比較' }, ...sources].map(btn => {
              const color = getCompanyColor(btn.key === 'ALL' ? null : btn.key);
              const isActive = activeSource === btn.key;
              return (
              <button key={btn.key} onClick={() => handleSourceChange(btn.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                  isActive
                    ? `${color.tailwind.bg} ${color.tailwind.text} ${color.tailwind.border}`
                    : `${color.tailwind.bgLight} ${color.tailwind.border} border`
                }`}
                style={!isActive ? { color: color.hex } : undefined}
              >
                {btn.name}
              </button>
              );
            })}
          </div>
          <div className="flex gap-1">
            {[{ key: 'all', label: '全て' }, { key: 'ticket', label: '📧 チケット' }, { key: 'call_center', label: '📞 CC' }].map(ch => (
              <button key={ch.key} onClick={() => handleChannelChange(ch.key)}
                className={`px-2 py-1 text-[11px] font-medium rounded-md border ${activeChannel === ch.key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                {ch.label}
              </button>
            ))}
            <button onClick={handleSync} disabled={syncing}
              className="px-3 py-1 text-[11px] font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              {syncing ? '同期中...' : '🔄 同期'}
            </button>
          </div>
        </div>

        <DateRangeFilter onChange={handleDateChange} />

        {/* ===== KPIカード 4枚 ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="今日"
            value={s.todayCount ?? 0}
            diff={s.dayOverDayDiff}
            rate={s.dayOverDayRate}
            sub={`昨日: ${s.previousDayCount ?? 0}件`}
          />
          <KpiCard
            label="直近7日合計"
            value={s.last7DaysCount ?? 0}
            sub={`7日平均: ${s.avg7Days ?? 0}件/日`}
          />
          <KpiCard
            label="今週"
            value={s.thisWeekCount ?? 0}
            diff={s.weekOverWeekDiff}
            rate={s.weekOverWeekRate}
            sub={`先週同期間: ${s.lastWeekCount ?? 0}件`}
          />
          <KpiCard
            label="今月"
            value={s.thisMonthCount ?? 0}
            diff={s.monthOverMonthDiff}
            rate={s.monthOverMonthRate}
            sub={`先月同期間: ${s.lastMonthCount ?? 0}件`}
          />
        </div>

        {/* ===== クレーム速報 ===== */}
        {complaints.length > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <h3 className="text-xs font-semibold text-red-600 uppercase mb-3">🚨 クレーム速報 ({complaints.length}件)</h3>
            <div className="space-y-2">
              {complaints.map((c: any) => (
                <div key={c.ticketId} className="flex items-center justify-between bg-white rounded-lg border border-red-100 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] font-bold text-white rounded ${getCompanyColor(COMPANY_NAME_TO_KEY[c.company] ?? null).tailwind.badge}`}>{c.company}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded">{c.status}</span>
                      <span className="text-[10px] text-gray-400">#{c.ticketId}</span>
                    </div>
                    <div className="text-sm text-gray-800 truncate">{c.subject || '(件名なし)'}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {c.category && <span className="mr-2">{c.category}</span>}
                      {new Date(c.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                    </div>
                  </div>
                  <a href={c.zendeskUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-3 px-3 py-1.5 text-[11px] font-medium bg-red-600 text-white rounded-md hover:bg-red-700 whitespace-nowrap">
                    Zendeskで開く
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 比較サマリーテーブル ===== */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">比較サマリー</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-2">指標</th>
                <th className="py-2 text-right">件数</th>
                <th className="py-2 text-right">比較対象</th>
                <th className="py-2 text-right">差分</th>
                <th className="py-2 text-right">増減率</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              <tr className="border-b border-gray-100">
                <td className="py-2 font-medium">今日 vs 昨日</td>
                <td className="py-2 text-right">{s.todayCount ?? 0}</td>
                <td className="py-2 text-right text-gray-500">{s.previousDayCount ?? 0}</td>
                <td className={`py-2 text-right font-medium ${(s.dayOverDayDiff ?? 0) > 0 ? 'text-red-600' : (s.dayOverDayDiff ?? 0) < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {(s.dayOverDayDiff ?? 0) >= 0 ? '+' : ''}{s.dayOverDayDiff ?? 0}
                </td>
                <td className={`py-2 text-right ${(s.dayOverDayRate ?? 0) > 0 ? 'text-red-600' : (s.dayOverDayRate ?? 0) < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {(s.dayOverDayRate ?? 0) >= 0 ? '+' : ''}{s.dayOverDayRate ?? 0}%
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 font-medium">今週 vs 先週</td>
                <td className="py-2 text-right">{s.thisWeekCount ?? 0}</td>
                <td className="py-2 text-right text-gray-500">{s.lastWeekCount ?? 0}</td>
                <td className={`py-2 text-right font-medium ${(s.weekOverWeekDiff ?? 0) > 0 ? 'text-red-600' : (s.weekOverWeekDiff ?? 0) < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {(s.weekOverWeekDiff ?? 0) >= 0 ? '+' : ''}{s.weekOverWeekDiff ?? 0}
                </td>
                <td className={`py-2 text-right ${(s.weekOverWeekRate ?? 0) > 0 ? 'text-red-600' : (s.weekOverWeekRate ?? 0) < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {(s.weekOverWeekRate ?? 0) >= 0 ? '+' : ''}{s.weekOverWeekRate ?? 0}%
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 font-medium">今月 vs 先月</td>
                <td className="py-2 text-right">{s.thisMonthCount ?? 0}</td>
                <td className="py-2 text-right text-gray-500">{s.lastMonthCount ?? 0}</td>
                <td className={`py-2 text-right font-medium ${(s.monthOverMonthDiff ?? 0) > 0 ? 'text-red-600' : (s.monthOverMonthDiff ?? 0) < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {(s.monthOverMonthDiff ?? 0) >= 0 ? '+' : ''}{s.monthOverMonthDiff ?? 0}
                </td>
                <td className={`py-2 text-right ${(s.monthOverMonthRate ?? 0) > 0 ? 'text-red-600' : (s.monthOverMonthRate ?? 0) < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {(s.monthOverMonthRate ?? 0) >= 0 ? '+' : ''}{s.monthOverMonthRate ?? 0}%
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium">30日平均</td>
                <td className="py-2 text-right">{s.avg30Days ?? 0} 件/日</td>
                <td className="py-2 text-right text-gray-500">7日平均: {s.avg7Days ?? 0}</td>
                <td className="py-2" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== カテゴリ別ランキング ===== */}
        <CategoryBreakdown data={categories} loading={loading} />

        {/* ===== 日別マトリクス + 時間帯 ===== */}
        <MatrixTable data={matrix} loading={loading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HourlyChart data={hourly} loading={loading} />
          <Heatmap data={heatmap} loading={loading} />
        </div>
      </div>
    </DashboardLayout>
  );
}

'use client';

import React, { useState } from 'react';
import type { AutoReport, ReportPeriod } from '@/types/report';

interface ReportSchedule {
  period: ReportPeriod;
  dayOfWeek?: number;
  dayOfMonth?: number;
  channels: { type: 'slack' | 'email'; destination: string }[];
}

interface ReportSettingsProps {
  schedule: ReportSchedule | null;
  reports: AutoReport[];
  loading?: boolean;
  onSaveSchedule?: (schedule: ReportSchedule) => void;
  onResend?: (reportId: string) => void;
  onGenerate?: () => void;
}

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'weekly', label: '週次' },
  { value: 'monthly', label: '月次' },
  { value: 'custom', label: 'カスタム' },
];

export default function ReportSettings({ schedule, reports, loading, onSaveSchedule, onResend, onGenerate }: ReportSettingsProps) {
  const [period, setPeriod] = useState<ReportPeriod>(schedule?.period ?? 'weekly');
  const [dayOfWeek, setDayOfWeek] = useState(schedule?.dayOfWeek ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(schedule?.dayOfMonth ?? 1);
  const [channels, setChannels] = useState(schedule?.channels ?? []);
  const [generating, setGenerating] = useState(false);

  const addChannel = () => setChannels((prev) => [...prev, { type: 'email' as const, destination: '' }]);
  const removeChannel = (i: number) => setChannels((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    onSaveSchedule?.({ period, dayOfWeek, dayOfMonth, channels: channels.filter((c) => c.destination.trim()) });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      onGenerate?.();
    } finally {
      setTimeout(() => setGenerating(false), 1000);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse space-y-4">
        <div className="h-5 bg-gray-200 rounded w-40" />
        <div className="h-24 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <h3 className="text-sm font-semibold text-gray-800">レポート設定</h3>

      {/* Schedule */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-3">生成スケジュール</h4>
        <div className="space-y-3">
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setPeriod(o.value)}
                className={`px-3 py-1 text-xs rounded border ${
                  period === o.value ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {period === 'weekly' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">曜日</label>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="px-2 py-1 text-xs border border-gray-300 rounded">
                {['月', '火', '水', '木', '金', '土', '日'].map((d, i) => (
                  <option key={i} value={i + 1}>{d}曜日</option>
                ))}
              </select>
            </div>
          )}
          {period === 'monthly' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">日</label>
              <input type="number" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} min={1} max={28} className="w-20 px-2 py-1 text-xs border border-gray-300 rounded" />
            </div>
          )}
        </div>
      </section>

      {/* Distribution Channels */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-2">配信先</h4>
        <div className="space-y-2">
          {channels.map((ch, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={ch.type}
                onChange={(e) => setChannels((prev) => prev.map((c, idx) => idx === i ? { ...c, type: e.target.value as 'slack' | 'email' } : c))}
                className="px-2 py-1 text-xs border border-gray-300 rounded"
              >
                <option value="email">メール</option>
                <option value="slack">Slack</option>
              </select>
              <input
                type="text"
                value={ch.destination}
                onChange={(e) => setChannels((prev) => prev.map((c, idx) => idx === i ? { ...c, destination: e.target.value } : c))}
                placeholder="送信先"
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
              />
              <button onClick={() => removeChannel(i)} className="text-xs text-red-500">削除</button>
            </div>
          ))}
          <button onClick={addChannel} className="text-xs text-blue-600 hover:underline">+ 配信先追加</button>
        </div>
      </section>

      <div className="flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
          スケジュール保存
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {generating ? '生成中...' : '手動レポート生成'}
        </button>
      </div>

      {/* Report History */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-2">レポート履歴</h4>
        {(() => { const safeReports = Array.isArray(reports) ? reports : []; return safeReports.length === 0 ? (
          <p className="text-sm text-gray-400">履歴なし</p>
        ) : (
          <div className="space-y-1">
            {safeReports.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded text-xs">
                <span className="text-gray-700 font-medium">{r.period}</span>
                <span className="text-gray-500">
                  {new Date(r.startDate).toLocaleDateString('ja-JP')} 〜 {new Date(r.endDate).toLocaleDateString('ja-JP')}
                </span>
                <span className="text-gray-400">{new Date(r.generatedAt).toLocaleString('ja-JP')}</span>
                <span className="flex-1" />
                <button onClick={() => onResend?.(r.id)} className="text-blue-600 hover:underline">再送信</button>
              </div>
            ))}
          </div>
        ); })()}
      </section>
    </div>
  );
}

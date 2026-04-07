'use client';

import React, { useState } from 'react';
import type { AnomalyDetectorConfig } from '@/types/anomaly';

interface AnomalySettingsProps {
  config: AnomalyDetectorConfig | null;
  loading?: boolean;
  onSave?: (config: AnomalyDetectorConfig) => void;
}

export default function AnomalySettings({ config, loading, onSave }: AnomalySettingsProps) {
  const [totalThreshold, setTotalThreshold] = useState(config?.thresholds.total ?? 100);
  const [categoryThresholds, setCategoryThresholds] = useState<Record<string, number>>(
    config?.thresholds.byCategory ?? {}
  );
  const [movingAvgDays, setMovingAvgDays] = useState(config?.trendConfig.movingAverageDays ?? 14);
  const [sigmaMultiplier, setSigmaMultiplier] = useState(config?.trendConfig.sigmaMultiplier ?? 2.0);
  const [enableSeasonality, setEnableSeasonality] = useState(config?.trendConfig.enableDayOfWeekSeasonality ?? true);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !(trimmed in categoryThresholds)) {
      setCategoryThresholds((prev) => ({ ...prev, [trimmed]: 50 }));
      setNewCategory('');
    }
  };

  const removeCategory = (cat: string) => {
    setCategoryThresholds((prev) => {
      const next = { ...prev };
      delete next[cat];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      onSave?.({
        thresholds: { total: totalThreshold, byCategory: categoryThresholds },
        trendConfig: {
          movingAverageDays: movingAvgDays,
          sigmaMultiplier,
          enableDayOfWeekSeasonality: enableSeasonality,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse space-y-4">
        <div className="h-5 bg-gray-200 rounded w-40" />
        <div className="h-8 bg-gray-100 rounded" />
        <div className="h-8 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <h3 className="text-sm font-semibold text-gray-800">異常検知設定</h3>

      {/* Threshold Settings */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-3">閾値設定</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">合計チケット数閾値</label>
            <input
              type="number"
              value={totalThreshold}
              onChange={(e) => setTotalThreshold(Number(e.target.value))}
              min={1}
              className="w-32 px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">カテゴリ別閾値</label>
            <div className="space-y-1">
              {Object.entries(categoryThresholds).map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs text-gray-700 w-32 truncate">{cat}</span>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => setCategoryThresholds((prev) => ({ ...prev, [cat]: Number(e.target.value) }))}
                    min={1}
                    className="w-24 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                  <button onClick={() => removeCategory(cat)} className="text-xs text-red-500 hover:text-red-700">削除</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="カテゴリ名"
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
              />
              <button onClick={addCategory} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">追加</button>
            </div>
          </div>
        </div>
      </section>

      {/* Trend Settings */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-3">トレンド検知設定</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">移動平均期間（日数）</label>
            <input
              type="number"
              value={movingAvgDays}
              onChange={(e) => setMovingAvgDays(Number(e.target.value))}
              min={3}
              max={90}
              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">σ倍数</label>
            <input
              type="number"
              value={sigmaMultiplier}
              onChange={(e) => setSigmaMultiplier(Number(e.target.value))}
              min={0.5}
              max={5}
              step={0.1}
              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="seasonality"
              checked={enableSeasonality}
              onChange={(e) => setEnableSeasonality(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="seasonality" className="text-xs text-gray-600">曜日別季節性を有効にする</label>
          </div>
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? '保存中...' : '設定を保存'}
      </button>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import type { AlertRule, AlertCondition, AlertNotificationChannel, AlertPresetType } from '@/types/alert';

const TRIGGER_TYPES: { value: AlertRule['triggerType']; label: string }[] = [
  { value: 'total_surge', label: '合計急増' },
  { value: 'category_surge', label: '特定カテゴリ急増' },
  { value: 'hourly_surge', label: '特定時間帯急増' },
];

const CONDITION_METHODS: { value: AlertCondition['method']; label: string; placeholder: string }[] = [
  { value: 'day_over_day_rate', label: '前日比率(%)', placeholder: '150' },
  { value: 'sigma_deviation', label: 'σ偏差', placeholder: '2.0' },
  { value: 'fixed_count', label: '固定件数', placeholder: '100' },
];

const PRESETS: { type: AlertPresetType; label: string; description: string }[] = [
  { type: 'total_surge', label: '問い合わせ急増', description: '合計チケット数が前日比150%以上で通知' },
  { type: 'category_surge', label: '特定カテゴリ急増', description: '特定カテゴリが2σ以上で通知' },
  { type: 'anomaly_detection', label: '異常検知', description: '異常検知時に即座に通知' },
];

interface AlertRuleFormProps {
  initialData?: Partial<AlertRule>;
  loading?: boolean;
  onSubmit?: (data: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel?: () => void;
  onPresetSelect?: (preset: AlertPresetType) => void;
}

export default function AlertRuleForm({ initialData, loading, onSubmit, onCancel, onPresetSelect }: AlertRuleFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [triggerType, setTriggerType] = useState<AlertRule['triggerType']>(initialData?.triggerType ?? 'total_surge');
  const [targetCategory, setTargetCategory] = useState(initialData?.targetCategory ?? '');
  const [conditions, setConditions] = useState<AlertCondition[]>(
    initialData?.conditions ?? [{ method: 'day_over_day_rate', value: 150 }]
  );
  const [channels, setChannels] = useState<AlertNotificationChannel[]>(
    initialData?.notificationChannels ?? []
  );
  const [cooldown, setCooldown] = useState(initialData?.cooldownMinutes ?? 60);
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);

  const addCondition = () => setConditions((prev) => [...prev, { method: 'day_over_day_rate', value: 150 }]);
  const removeCondition = (i: number) => setConditions((prev) => prev.filter((_, idx) => idx !== i));

  const addChannel = () => setChannels((prev) => [...prev, { channel: 'slack', destination: '' }]);
  const removeChannel = (i: number) => setChannels((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({
      name,
      triggerType,
      conditions,
      targetCategory: triggerType === 'category_surge' ? targetCategory : undefined,
      notificationChannels: channels.filter((c) => c.destination.trim()),
      cooldownMinutes: cooldown,
      enabled,
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* Presets */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-2">プリセットから作成</h4>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.type}
              onClick={() => onPresetSelect?.(p.type)}
              className="flex-1 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <span className="text-xs font-medium text-gray-700 block">{p.label}</span>
              <span className="text-[10px] text-gray-500">{p.description}</span>
            </button>
          ))}
        </div>
      </section>

      <hr className="border-gray-100" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">
          {initialData?.id ? 'ルール編集' : '新規ルール作成'}
        </h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ルール名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">トリガータイプ</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as AlertRule['triggerType'])}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            >
              {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {triggerType === 'category_surge' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">対象カテゴリ</label>
              <input
                type="text"
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                placeholder="カテゴリ名"
              />
            </div>
          )}
        </div>

        {/* Conditions */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">トリガー条件</label>
          <div className="space-y-2">
            {conditions.map((cond, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={cond.method}
                  onChange={(e) => setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, method: e.target.value as AlertCondition['method'] } : c))}
                  className="px-2 py-1 text-xs border border-gray-300 rounded"
                >
                  {CONDITION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input
                  type="number"
                  value={cond.value}
                  onChange={(e) => setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, value: Number(e.target.value) } : c))}
                  step={cond.method === 'sigma_deviation' ? 0.1 : 1}
                  className="w-24 px-2 py-1 text-xs border border-gray-300 rounded"
                />
                {conditions.length > 1 && (
                  <button type="button" onClick={() => removeCondition(i)} className="text-xs text-red-500">削除</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addCondition} className="text-xs text-blue-600 hover:underline">+ 条件追加</button>
          </div>
        </div>

        {/* Notification Channels */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">通知先</label>
          <div className="space-y-2">
            {channels.map((ch, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={ch.channel}
                  onChange={(e) => setChannels((prev) => prev.map((c, idx) => idx === i ? { ...c, channel: e.target.value as AlertNotificationChannel['channel'] } : c))}
                  className="px-2 py-1 text-xs border border-gray-300 rounded"
                >
                  <option value="slack">Slack</option>
                  <option value="email">メール</option>
                  <option value="chatwork">Chatwork</option>
                </select>
                <input
                  type="text"
                  value={ch.destination}
                  onChange={(e) => setChannels((prev) => prev.map((c, idx) => idx === i ? { ...c, destination: e.target.value } : c))}
                  placeholder="送信先"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                />
                <button type="button" onClick={() => removeChannel(i)} className="text-xs text-red-500">削除</button>
              </div>
            ))}
            <button type="button" onClick={addChannel} className="text-xs text-blue-600 hover:underline">+ 通知先追加</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">通知頻度制限（分）</label>
            <input
              type="number"
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
              min={0}
              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded" />
              <span className="text-xs text-gray-600">有効</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : initialData?.id ? '更新' : '作成'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              キャンセル
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

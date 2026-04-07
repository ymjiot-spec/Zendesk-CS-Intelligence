'use client';

import React, { useState } from 'react';
import type { NotificationRule, TriggerCondition } from '@/types/notification';

interface NotificationSettingsProps {
  rules: NotificationRule[];
  loading?: boolean;
  onSave?: (rule: Omit<NotificationRule, 'id'> & { id?: string }) => void;
  onDelete?: (ruleId: string) => void;
  onToggle?: (ruleId: string, enabled: boolean) => void;
}

const CHANNEL_OPTIONS: { value: NotificationRule['channel']; label: string }[] = [
  { value: 'slack', label: 'Slack' },
  { value: 'email', label: 'メール' },
  { value: 'chatwork', label: 'Chatwork' },
];

const TRIGGER_TYPES: { value: TriggerCondition['type']; label: string }[] = [
  { value: 'anomaly', label: '異常検知' },
  { value: 'threshold', label: '閾値超過' },
  { value: 'trend', label: 'トレンド異常' },
  { value: 'alert', label: 'アラート' },
];

export default function NotificationSettings({ rules, loading, onSave, onDelete, onToggle }: NotificationSettingsProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [formChannel, setFormChannel] = useState<NotificationRule['channel']>('slack');
  const [formDest, setFormDest] = useState('');
  const [formTriggers, setFormTriggers] = useState<TriggerCondition[]>([]);
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setFormChannel('slack');
    setFormDest('');
    setFormTriggers([]);
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (rule: NotificationRule) => {
    setEditing(rule.id);
    setFormChannel(rule.channel);
    setFormDest(rule.destination);
    setFormTriggers([...rule.triggerConditions]);
    setShowForm(true);
  };

  const startNew = () => {
    resetForm();
    setShowForm(true);
  };

  const toggleTrigger = (type: TriggerCondition['type']) => {
    setFormTriggers((prev) =>
      prev.some((t) => t.type === type)
        ? prev.filter((t) => t.type !== type)
        : [...prev, { type }]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.({
      ...(editing ? { id: editing } : {}),
      channel: formChannel,
      destination: formDest,
      triggerConditions: formTriggers,
      enabled: true,
    });
    resetForm();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse space-y-3">
        <div className="h-5 bg-gray-200 rounded w-40" />
        {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">通知ルール設定</h3>
        <button onClick={startNew} className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">
          + 新規ルール
        </button>
      </div>

      {/* Rule list */}
      {rules.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">通知ルールなし</p>
      )}
      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => onToggle?.(rule.id, e.target.checked)}
              className="rounded"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">{rule.channel.toUpperCase()}</span>
                <span className="text-xs text-gray-500 truncate">{rule.destination}</span>
              </div>
              <div className="flex gap-1 mt-1">
                {rule.triggerConditions.map((t) => (
                  <span key={t.type} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{t.type}</span>
                ))}
              </div>
            </div>
            <button onClick={() => startEdit(rule)} className="text-xs text-blue-600 hover:underline">編集</button>
            <button onClick={() => onDelete?.(rule.id)} className="text-xs text-red-500 hover:underline">削除</button>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
          <h4 className="text-xs font-medium text-gray-700">{editing ? 'ルール編集' : '新規ルール'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">チャネル</label>
              <select
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value as NotificationRule['channel'])}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              >
                {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">送信先</label>
              <input
                type="text"
                value={formDest}
                onChange={(e) => setFormDest(e.target.value)}
                required
                placeholder="チャンネルID / メールアドレス"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">トリガー条件</label>
            <div className="flex gap-2">
              {TRIGGER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleTrigger(t.value)}
                  className={`px-2 py-1 text-xs rounded border ${
                    formTriggers.some((ft) => ft.type === t.value)
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">
              {editing ? '更新' : '作成'}
            </button>
            <button type="button" onClick={resetForm} className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800">
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

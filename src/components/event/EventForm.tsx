'use client';

import React, { useState } from 'react';
import type { EventType, EventLog } from '@/types/event';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'campaign_start', label: 'キャンペーン開始' },
  { value: 'system_release', label: 'システムリリース' },
  { value: 'incident', label: 'インシデント' },
  { value: 'email_delivery', label: 'メール配信' },
  { value: 'pricing_change', label: '料金変更' },
  { value: 'terms_change', label: '規約変更' },
  { value: 'other', label: 'その他' },
];

const DEFAULT_TAGS = ['重要', 'マーケティング', '技術', '運用', '外部要因', 'セール', 'メンテナンス'];

interface EventFormProps {
  initialData?: Partial<EventLog>;
  onSubmit: (data: EventFormData) => void;
  onCancel?: () => void;
  loading?: boolean;
}

export interface EventFormData {
  name: string;
  eventType: EventType;
  occurredAt: string;
  description: string;
  tags: string[];
  memo: string;
  urls: string[];
}

export default function EventForm({ initialData, onSubmit, onCancel, loading }: EventFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [eventType, setEventType] = useState<EventType>(initialData?.eventType ?? 'other');
  const [occurredAt, setOccurredAt] = useState(
    initialData?.occurredAt
      ? new Date(initialData.occurredAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [memo, setMemo] = useState(initialData?.memo ?? '');
  const [urls, setUrls] = useState<string[]>(initialData?.urls?.length ? initialData.urls : ['']);

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setCustomTag('');
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const addUrl = () => setUrls((prev) => [...prev, '']);
  const removeUrl = (index: number) => setUrls((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      eventType,
      occurredAt,
      description,
      tags,
      memo,
      urls: urls.filter((u) => u.trim()),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">
        {initialData?.id ? 'イベント編集' : 'イベント登録'}
      </h3>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">イベント名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
          placeholder="イベント名を入力"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">イベントタイプ</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">発生日時</label>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">説明</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
          placeholder="イベントの詳細説明"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">タグ</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {DEFAULT_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-2 py-1 text-xs rounded-full border ${
                tags.includes(tag)
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {tag}
            </button>
          ))}
          {tags.filter((t) => !DEFAULT_TAGS.includes(t)).map((tag) => (
            <span key={tag} className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 border border-purple-300 flex items-center gap-1">
              {tag}
              <button type="button" onClick={() => toggleTag(tag)} className="text-purple-500 hover:text-purple-700">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
            placeholder="カスタムタグを追加"
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
          />
          <button type="button" onClick={addCustomTag} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">追加</button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
          placeholder="メモ（任意）"
        />
      </div>

      {/* URLs */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">関連URL</label>
        {urls.map((url, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(i, e.target.value)}
              placeholder="https://..."
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
            />
            {urls.length > 1 && (
              <button type="button" onClick={() => removeUrl(i)} className="text-xs text-red-500 hover:text-red-700">削除</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addUrl} className="text-xs text-blue-600 hover:underline mt-1">+ URL追加</button>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '保存中...' : initialData?.id ? '更新' : '登録'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}

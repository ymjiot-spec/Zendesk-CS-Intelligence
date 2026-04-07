'use client';

import React, { useState, useMemo } from 'react';
import type { EventLog, EventType } from '@/types/event';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  campaign_start: 'キャンペーン',
  system_release: 'リリース',
  incident: 'インシデント',
  email_delivery: 'メール配信',
  pricing_change: '料金変更',
  terms_change: '規約変更',
  other: 'その他',
};

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  campaign_start: 'bg-green-100 text-green-700',
  system_release: 'bg-blue-100 text-blue-700',
  incident: 'bg-red-100 text-red-700',
  email_delivery: 'bg-purple-100 text-purple-700',
  pricing_change: 'bg-orange-100 text-orange-700',
  terms_change: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-700',
};

interface EventListProps {
  events: EventLog[];
  loading?: boolean;
  onEdit?: (event: EventLog) => void;
  onDelete?: (eventId: string) => void;
}

export default function EventList({ events, loading, onEdit, onDelete }: EventListProps) {
  const [filterType, setFilterType] = useState<EventType | ''>('');
  const [filterTag, setFilterTag] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    const list = Array.isArray(events) ? events : [];
    list.forEach((e) => e.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let result = Array.isArray(events) ? [...events] : [];
    if (filterType) result = result.filter((e) => e.eventType === filterType);
    if (filterTag) result = result.filter((e) => e.tags.includes(filterTag));
    if (filterStart) result = result.filter((e) => new Date(e.occurredAt) >= new Date(filterStart));
    if (filterEnd) result = result.filter((e) => new Date(e.occurredAt) <= new Date(filterEnd + 'T23:59:59'));
    return result.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [events, filterType, filterTag, filterStart, filterEnd]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded mb-2" />)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">イベント一覧</h3>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as EventType | '')}
          className="px-2 py-1 text-xs border border-gray-300 rounded"
        >
          <option value="">全タイプ</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded"
        >
          <option value="">全タグ</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="date"
          value={filterStart}
          onChange={(e) => setFilterStart(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded"
          aria-label="開始日"
        />
        <span className="text-xs text-gray-400 self-center">〜</span>
        <input
          type="date"
          value={filterEnd}
          onChange={(e) => setFilterEnd(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded"
          aria-label="終了日"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">イベントなし</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => (
            <div key={event.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${EVENT_TYPE_COLORS[event.eventType]}`}>
                    {EVENT_TYPE_LABELS[event.eventType]}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">{event.name}</span>
                  {event.memo && <span className="text-[10px] text-gray-400">📝</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{new Date(event.occurredAt).toLocaleDateString('ja-JP')}</span>
                  {event.impactScore != null && (
                    <span className="text-orange-600">Impact: {event.impactScore}</span>
                  )}
                  {event.tags.map((t) => (
                    <span key={t} className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                {onEdit && (
                  <button onClick={() => onEdit(event)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">
                    編集
                  </button>
                )}
                {onDelete && (
                  <button onClick={() => onDelete(event.id)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

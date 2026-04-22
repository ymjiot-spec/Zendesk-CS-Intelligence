'use client';

import React, { useState, useMemo } from 'react';
import type { EventLog, EventType } from '@/types/event';
import { getCompanyColor, COMPANY_LIST } from '@/lib/company-colors';

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

function getCompanyBadges(sourceKey: string | null | undefined) {
  if (!sourceKey) return [{ name: '全社', color: getCompanyColor(null) }];
  const keys = sourceKey.split(',').filter(Boolean);
  if (keys.length === COMPANY_LIST.length) return [{ name: '全社', color: getCompanyColor(null) }];
  return keys.map((k) => ({ name: getCompanyColor(k).name, color: getCompanyColor(k) }));
}

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
    list.forEach((e) => e.tags?.forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let result = Array.isArray(events) ? [...events] : [];
    if (filterType) result = result.filter((e) => e.eventType === filterType);
    if (filterTag) result = result.filter((e) => e.tags?.includes(filterTag));
    if (filterStart) result = result.filter((e) => new Date(e.occurredAt) >= new Date(filterStart));
    if (filterEnd) result = result.filter((e) => new Date(e.occurredAt) <= new Date(filterEnd + 'T23:59:59'));
    return result.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [events, filterType, filterTag, filterStart, filterEnd]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded mb-2" />)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">イベント一覧</h3>
        <div className="flex flex-wrap gap-2">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as EventType | '')}
            className="px-2 py-1 text-xs border border-gray-300 rounded">
            <option value="">全タイプ</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded">
            <option value="">全タグ</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded" aria-label="開始日" />
          <span className="text-xs text-gray-400 self-center">〜</span>
          <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded" aria-label="終了日" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 p-4">イベントなし</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-[10px] text-gray-500 uppercase">
                <th className="px-3 py-2 whitespace-nowrap">日付</th>
                <th className="px-3 py-2 whitespace-nowrap">対象会社</th>
                <th className="px-3 py-2 whitespace-nowrap">種別</th>
                <th className="px-3 py-2">イベント名</th>
                <th className="px-3 py-2">説明</th>
                <th className="px-3 py-2 whitespace-nowrap">タグ</th>
                <th className="px-3 py-2 whitespace-nowrap">メモ</th>
                <th className="px-3 py-2 whitespace-nowrap text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => {
                const badges = getCompanyBadges((event as any).sourceKey);
                return (
                  <tr key={event.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {new Date(event.occurredAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {badges.map((b, i) => (
                          <span key={i} className={`px-1.5 py-0.5 text-[9px] font-bold text-white rounded ${b.color.tailwind.badge}`}>
                            {b.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${EVENT_TYPE_COLORS[event.eventType]}`}>
                        {EVENT_TYPE_LABELS[event.eventType]}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[200px] truncate">
                      {event.name}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[250px] truncate">
                      {event.description || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {event.tags?.map((t: string) => (
                          <span key={t} className="bg-gray-100 px-1 py-0.5 rounded text-[9px] text-gray-600">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-400 max-w-[150px] truncate">
                      {event.memo ? '📝 ' + event.memo.slice(0, 30) : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {onEdit && (
                        <button onClick={() => onEdit(event)} className="px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 rounded mr-1">
                          編集
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => {
                          if (window.confirm(`「${event.name}」を削除しますか？`)) onDelete(event.id);
                        }} className="px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-50 rounded">
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import type { AlertFiringRecord } from '@/types/alert';

interface AlertHistoryProps {
  records: AlertFiringRecord[];
  loading?: boolean;
  onStatusChange?: (recordId: string, status: AlertFiringRecord['status']) => void;
}

const STATUS_STYLES: Record<AlertFiringRecord['status'], { label: string; bg: string; text: string }> = {
  unresolved: { label: '未対応', bg: 'bg-red-100', text: 'text-red-700' },
  in_progress: { label: '対応中', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  resolved: { label: '対応済み', bg: 'bg-green-100', text: 'text-green-700' },
};

export default function AlertHistory({ records, loading, onStatusChange }: AlertHistoryProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded mb-2" />)}
      </div>
    );
  }

  const recordList = Array.isArray(records) ? records : [];
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">アラート発火履歴</h3>

      {recordList.length === 0 ? (
        <p className="text-sm text-gray-400">履歴なし</p>
      ) : (
        <div className="space-y-2">
          {recordList.map((record) => {
            const style = STATUS_STYLES[record.status];
            return (
              <div key={record.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">
                      {new Date(record.firedAt).toLocaleString('ja-JP')}
                    </span>
                    <span className="text-xs text-gray-700 font-medium">
                      検知値: {record.detectedValue}
                    </span>
                    <span className="text-xs text-gray-400">
                      (基準: {record.baselineValue}, 偏差: {record.deviation.toFixed(2)})
                    </span>
                  </div>
                  {record.representativeTicketIds.length > 0 && (
                    <div className="flex gap-1">
                      {record.representativeTicketIds.slice(0, 3).map((id) => (
                        <span key={id} className="text-[10px] bg-gray-100 px-1 rounded">#{id}</span>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={record.status}
                  onChange={(e) => onStatusChange?.(record.id, e.target.value as AlertFiringRecord['status'])}
                  className={`text-xs px-2 py-1 rounded border border-gray-200 ${style.bg} ${style.text}`}
                >
                  <option value="unresolved">未対応</option>
                  <option value="in_progress">対応中</option>
                  <option value="resolved">対応済み</option>
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

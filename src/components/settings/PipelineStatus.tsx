'use client';

import React from 'react';

interface DataSource {
  name: string;
  type: string;
  status: 'active' | 'error' | 'inactive';
  lastFetchedAt?: string;
  error?: string;
}

interface PipelineStatusProps {
  lastUpdatedAt: string | null;
  dataSources: DataSource[];
  loading?: boolean;
}

const STATUS_STYLES = {
  active: { dot: 'bg-green-500', text: 'text-green-700', label: '正常' },
  error: { dot: 'bg-red-500', text: 'text-red-700', label: 'エラー' },
  inactive: { dot: 'bg-gray-400', text: 'text-gray-500', label: '無効' },
};

export default function PipelineStatus({ lastUpdatedAt, dataSources, loading }: PipelineStatusProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse space-y-3">
        <div className="h-5 bg-gray-200 rounded w-40" />
        <div className="h-8 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">パイプラインステータス</h3>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">データ最終更新:</span>
        <span className="text-sm font-medium text-gray-800">
          {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString('ja-JP') : '未取得'}
        </span>
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-500 mb-2">データソース</h4>
        {(Array.isArray(dataSources) ? dataSources : []).length === 0 ? (
          <p className="text-sm text-gray-400">データソースなし</p>
        ) : (
          <div className="space-y-2">
            {(Array.isArray(dataSources) ? dataSources : []).map((ds) => {
              const style = STATUS_STYLES[ds.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.inactive;
              return (
                <div key={ds.name} className="flex items-center gap-3 p-2 border border-gray-100 rounded">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">{ds.name}</span>
                      <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{ds.type}</span>
                    </div>
                    {ds.lastFetchedAt && (
                      <span className="text-[10px] text-gray-400">
                        最終取得: {new Date(ds.lastFetchedAt).toLocaleString('ja-JP')}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
                  {ds.error && <span className="text-[10px] text-red-500">{ds.error}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

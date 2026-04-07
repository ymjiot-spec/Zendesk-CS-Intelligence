'use client';

import React, { useState } from 'react';
import type { ActionSuggestion } from '@/types/ai';

type UserResponse = 'accepted' | 'deferred' | 'rejected';
type ExecutionStatus = 'not_started' | 'in_progress' | 'completed';

interface ActionSuggestionCardsProps {
  actions: ActionSuggestion[];
  loading?: boolean;
  onRespond?: (actionId: string, response: UserResponse) => void;
  onStatusChange?: (actionId: string, status: ExecutionStatus) => void;
}

const PRIORITY_STYLES = {
  high: { bg: 'border-red-200 bg-red-50', badge: 'bg-red-100 text-red-700', label: '高' },
  medium: { bg: 'border-yellow-200 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', label: '中' },
  low: { bg: 'border-blue-200 bg-blue-50', badge: 'bg-blue-100 text-blue-700', label: '低' },
};

const EXEC_STATUS_LABELS: Record<ExecutionStatus, { label: string; color: string }> = {
  not_started: { label: '未着手', color: 'text-gray-500' },
  in_progress: { label: '対応中', color: 'text-blue-600' },
  completed: { label: '完了', color: 'text-green-600' },
};

export default function ActionSuggestionCards({ actions, loading, onRespond, onStatusChange }: ActionSuggestionCardsProps) {
  const [responses, setResponses] = useState<Record<string, UserResponse>>({});
  const [statuses, setStatuses] = useState<Record<string, ExecutionStatus>>({});

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (actions.length === 0) return null;

  const displayed = actions.slice(0, 5);

  const handleRespond = (id: string, response: UserResponse) => {
    setResponses((prev) => ({ ...prev, [id]: response }));
    onRespond?.(id, response);
  };

  const handleStatusChange = (id: string, status: ExecutionStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    onStatusChange?.(id, status);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-gray-500">アクション提案</h4>
      {displayed.map((action) => {
        const style = PRIORITY_STYLES[action.priority];
        const response: string = responses[action.id] ?? action.responseStatus;
        const execStatus = statuses[action.id] ?? action.executionStatus ?? 'not_started';
        const isAccepted = response === 'accepted';

        return (
          <div key={action.id} className={`border rounded-lg p-4 ${style.bg}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${style.badge}`}>
                    {style.label}
                  </span>
                  <span className="text-xs text-gray-500">{action.actionType}</span>
                </div>
                <h5 className="text-sm font-medium text-gray-800">{action.title}</h5>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-2">{action.description}</p>
            <p className="text-[10px] text-gray-500 mb-3">理由: {action.reasoning}</p>

            {/* Response buttons or status */}
            {response === 'pending' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleRespond(action.id, 'accepted')}
                  className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  実行する
                </button>
                <button
                  onClick={() => handleRespond(action.id, 'deferred')}
                  className="px-3 py-1 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  後で対応
                </button>
                <button
                  onClick={() => handleRespond(action.id, 'rejected')}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  不要
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {response === 'accepted' ? '✅ 実行予定' : response === 'deferred' ? '⏳ 後で対応' : '❌ 不要'}
                  </span>
                </div>

                {/* Execution status management for accepted actions */}
                {isAccepted && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">ステータス:</span>
                    <select
                      value={execStatus}
                      onChange={(e) => handleStatusChange(action.id, e.target.value as ExecutionStatus)}
                      className={`text-xs border border-gray-300 rounded px-2 py-1 ${EXEC_STATUS_LABELS[execStatus].color}`}
                    >
                      <option value="not_started">未着手</option>
                      <option value="in_progress">対応中</option>
                      <option value="completed">完了</option>
                    </select>
                  </div>
                )}

                {/* Effect display */}
                {action.effectMetrics && (
                  <div className="text-xs bg-white/60 rounded p-2">
                    <span className="text-gray-500">効果: </span>
                    <span className="text-gray-700">
                      {action.effectMetrics.preActionCount}件 → {action.effectMetrics.postActionCount}件
                    </span>
                    <span className={`ml-1 font-medium ${action.effectMetrics.changeRate < 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ({action.effectMetrics.changeRate >= 0 ? '+' : ''}{action.effectMetrics.changeRate.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

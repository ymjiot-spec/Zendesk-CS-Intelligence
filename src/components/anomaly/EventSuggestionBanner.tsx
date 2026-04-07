'use client';

import React, { useState } from 'react';
import type { EventSuggestion } from '@/types/ai';

type Response = 'register' | 'later' | 'ignore';

interface EventSuggestionBannerProps {
  suggestion: EventSuggestion | null;
  loading?: boolean;
  onRespond?: (response: Response, suggestion: EventSuggestion) => void;
}

export default function EventSuggestionBanner({ suggestion, loading, onRespond }: EventSuggestionBannerProps) {
  const [responded, setResponded] = useState<Response | null>(null);

  if (loading || !suggestion) return null;
  if (responded === 'ignore') return null;

  const handleRespond = (response: Response) => {
    setResponded(response);
    onRespond?.(response, suggestion);
  };

  if (responded === 'later') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
        後で確認します（提案を保存しました）
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-lg">💡</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 mb-1">
            この期間にイベントを登録しますか？
          </p>
          <p className="text-xs text-amber-700 mb-2">{suggestion.reason}</p>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              推定タイプ: {suggestion.suggestedEventType}
            </span>
            <span className="text-xs text-amber-600">
              {new Date(suggestion.suggestedDate).toLocaleDateString('ja-JP')}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleRespond('register')}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              登録する
            </button>
            <button
              onClick={() => handleRespond('later')}
              className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
            >
              後で確認
            </button>
            <button
              onClick={() => handleRespond('ignore')}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              無視する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

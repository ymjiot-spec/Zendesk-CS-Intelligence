'use client';

import React from 'react';
import type { AIAnalysisResult } from '@/types/ai';

interface AIAnalysisDetailProps {
  data: AIAnalysisResult | null;
  loading?: boolean;
  zendeskBaseUrl?: string;
}

function LoadingState() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-600">AI分析中...</span>
      </div>
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
  );
}

export default function AIAnalysisDetail({ data, loading, zendeskBaseUrl = '' }: AIAnalysisDetailProps) {
  if (loading) return <LoadingState />;
  if (!data) return <div className="text-sm text-gray-400 p-4">分析データなし</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <h3 className="text-sm font-semibold text-gray-800">AI分析結果</h3>

      {/* Category Breakdown */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-2">カテゴリ別寄与度</h4>
        <div className="space-y-2">
          {data.categoryBreakdown.map((cat) => (
            <div key={cat.category} className="flex items-center gap-2">
              <span className="text-xs text-gray-700 w-32 truncate">{cat.category}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-600 w-20 text-right">
                {cat.count}件 ({cat.percentage.toFixed(1)}%)
              </span>
              {cat.increaseRate > 0 && (
                <span className="text-xs text-red-500">+{cat.increaseRate.toFixed(1)}%</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Common Patterns */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-2">共通パターン</h4>
        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{data.commonPatterns}</p>
      </section>

      {/* Hypotheses (max 3) */}
      <section>
        <h4 className="text-xs font-medium text-gray-500 mb-2">推定原因仮説</h4>
        <div className="space-y-3">
          {data.hypotheses.slice(0, 3).map((h) => (
            <div key={h.rank} className="border border-gray-100 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-600">#{h.rank}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  h.confidence === 'high' ? 'bg-green-100 text-green-700' :
                  h.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {h.confidence === 'high' ? '高' : h.confidence === 'medium' ? '中' : '低'}確度
                </span>
              </div>
              <p className="text-sm text-gray-800">{h.description}</p>
              {h.evidence.length > 0 && (
                <div className="flex gap-3 mt-2">
                  {h.evidence.map((e, i) => (
                    <span key={i} className="text-xs text-gray-500">
                      {e.metric}: {e.value}{e.unit}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Representative Tickets */}
      {data.representativeTicketIds.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-gray-500 mb-2">代表チケット</h4>
          <div className="flex flex-wrap gap-2">
            {data.representativeTicketIds.map((id) => (
              <a
                key={id}
                href={zendeskBaseUrl ? `${zendeskBaseUrl}/tickets/${id}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
              >
                #{id}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Event Correlation Timeline */}
      {data.eventCorrelation && (
        <section>
          <h4 className="text-xs font-medium text-gray-500 mb-2">イベント相関</h4>
          <p className="text-sm text-gray-700 mb-2">{data.eventCorrelation.summary}</p>
          <div className="space-y-1">
            {data.eventCorrelation.correlatedEvents.map((ev) => (
              <div key={ev.eventId} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-gray-700">{ev.eventName}</span>
                <span className="text-gray-400">Impact: {ev.impactScore}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="text-[10px] text-gray-400 text-right">
        生成: {new Date(data.generatedAt).toLocaleString('ja-JP')}
      </div>
    </div>
  );
}

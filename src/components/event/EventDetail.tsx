'use client';

import React from 'react';
import type { EventLog } from '@/types/event';
import type { ImpactScoreResult, OverlapAnalysisResult } from '@/types/ai';

interface SimilarEvent {
  eventId: string;
  eventName: string;
  impactScore: number;
  memo: string;
  affectedCategories: string[];
}

interface DailyComparison {
  date: string;
  count: number;
  period: 'pre' | 'post';
}

interface CategoryImpact {
  category: string;
  preDayAvg: number;
  postDayAvg: number;
  changeRate: number;
}

interface EventDetailProps {
  event: EventLog | null;
  impact: ImpactScoreResult | null;
  overlap: OverlapAnalysisResult | null;
  dailyComparison?: DailyComparison[];
  categoryImpacts?: CategoryImpact[];
  similarEvents?: SimilarEvent[];
  loading?: boolean;
}

function ImpactGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = clampedScore >= 70 ? 'text-red-600' : clampedScore >= 40 ? 'text-yellow-600' : 'text-green-600';
  const bgColor = clampedScore >= 70 ? 'bg-red-500' : clampedScore >= 40 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className={`${bgColor} h-3 rounded-full transition-all`} style={{ width: `${clampedScore}%` }} />
        </div>
      </div>
      <span className={`text-lg font-bold ${color}`}>{clampedScore}</span>
      <span className="text-xs text-gray-400">/ 100</span>
    </div>
  );
}

export default function EventDetail({ event, impact, overlap, dailyComparison, categoryImpacts, similarEvents, loading }: EventDetailProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse space-y-4">
        <div className="h-5 bg-gray-200 rounded w-48" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!event) return <div className="text-sm text-gray-400 p-4">イベントデータなし</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <h3 className="text-sm font-semibold text-gray-800">{event.name}</h3>

      {/* Impact Score Gauge */}
      {impact && (
        <section>
          <h4 className="text-xs font-medium text-gray-500 mb-2">Impact Score</h4>
          <ImpactGauge score={impact.impactScore} />
          <div className="flex gap-4 mt-2 text-xs text-gray-600">
            <span>前平均: {impact.preEventAvg.toFixed(1)}件/日</span>
            <span>後平均: {impact.postEventAvg.toFixed(1)}件/日</span>
            <span className={impact.changeRate > 0 ? 'text-red-500' : 'text-green-500'}>
              変化率: {impact.changeRate >= 0 ? '+' : ''}{impact.changeRate.toFixed(1)}%
            </span>
          </div>
        </section>
      )}

      {/* Pre/Post 3-day comparison */}
      {dailyComparison && dailyComparison.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-gray-500 mb-2">前後3日間比較</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 mb-1">イベント前3日</p>
              {dailyComparison.filter((d) => d.period === 'pre').map((d) => (
                <div key={d.date} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-600">{d.date}</span>
                  <span className="font-medium">{d.count}件</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-1">イベント後3日</p>
              {dailyComparison.filter((d) => d.period === 'post').map((d) => (
                <div key={d.date} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-600">{d.date}</span>
                  <span className="font-medium">{d.count}件</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Category Impact Ranking */}
      {categoryImpacts && categoryImpacts.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-gray-500 mb-2">カテゴリ別影響ランキング</h4>
          <div className="space-y-1">
            {categoryImpacts
              .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
              .map((cat, i) => (
                <div key={cat.category} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-center font-bold text-gray-400">{i + 1}</span>
                  <span className="flex-1 text-gray-700">{cat.category}</span>
                  <span className="text-gray-500">{cat.preDayAvg.toFixed(1)} → {cat.postDayAvg.toFixed(1)}</span>
                  <span className={cat.changeRate > 0 ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>
                    {cat.changeRate >= 0 ? '+' : ''}{cat.changeRate.toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Overlap Analysis */}
      {overlap && overlap.events.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-gray-500 mb-2">重複イベント分析</h4>
          <p className="text-xs text-gray-600 mb-2">{overlap.summary}</p>
          <div className="space-y-1">
            {overlap.events.map((ev) => (
              <div key={ev.eventId} className="flex items-center gap-2 text-xs">
                <span className="text-gray-700">{ev.eventName}</span>
                <span className="text-gray-400">寄与度: {(ev.relativeContribution * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Similar Events */}
      {similarEvents && similarEvents.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-gray-500 mb-2">過去の類似イベント</h4>
          <div className="space-y-2">
            {similarEvents.map((se) => (
              <div key={se.eventId} className="border border-gray-100 rounded p-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-800">{se.eventName}</span>
                  <span className="text-[10px] text-orange-600">Impact: {se.impactScore}</span>
                </div>
                {se.memo && <p className="text-[10px] text-gray-500">{se.memo}</p>}
                <div className="flex gap-1 mt-1">
                  {se.affectedCategories.map((c) => (
                    <span key={c} className="text-[10px] bg-gray-100 px-1 rounded">{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

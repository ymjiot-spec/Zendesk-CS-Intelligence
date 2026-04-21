'use client';

import React from 'react';
import { getCompanyColor } from '@/lib/company-colors';
import type { ImpactAnalysisData } from '@/types/timeline';
import type { EventType } from '@/types/event';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  campaign_start: 'キャンペーン',
  system_release: 'リリース',
  incident: '障害',
  email_delivery: 'メール配信',
  pricing_change: '料金変更',
  terms_change: '法改正',
  other: 'その他',
};

interface ImpactAnalysisPanelProps {
  data: ImpactAnalysisData | null;
  loading: boolean;
  onClose: () => void;
}

function ChangeIndicator({ rate }: { rate: number }) {
  const color = rate > 0 ? 'text-red-600' : rate < 0 ? 'text-green-600' : 'text-gray-400';
  const arrow = rate > 0 ? '↑' : rate < 0 ? '↓' : '→';
  return <span className={`font-medium ${color}`}>{arrow} {rate >= 0 ? '+' : ''}{rate}%</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const bg = score >= 70 ? 'bg-red-100 text-red-700' : score >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold ${bg}`}>
      {score}
    </span>
  );
}

export default function ImpactAnalysisPanel({ data, loading, onClose }: ImpactAnalysisPanelProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 bg-gray-100 rounded mb-2" />)}
      </div>
    );
  }

  if (!data) return null;

  const color = getCompanyColor(data.sourceKey);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-3 h-3 rounded-full ${color.tailwind.bg}`} />
            <span className="text-xs font-medium text-gray-500">{data.companyName}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
              {EVENT_TYPE_LABELS[data.eventType] ?? data.eventType}
            </span>
          </div>
          <h3 className="text-sm font-bold text-gray-800">{data.eventName}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {new Date(data.occurredAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-[10px] text-gray-400">Impact</div>
            <ScoreBadge score={data.impactScore} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
      </div>

      {/* Ticket / Call comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-[10px] text-blue-500 font-medium mb-1">📧 チケット</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-gray-500">前3日: {data.preEventTicketAvg}</span>
            <span className="text-xs text-gray-400">→</span>
            <span className="text-xs text-gray-800 font-medium">後3日: {data.postEventTicketAvg}</span>
          </div>
          <div className="mt-1 text-xs"><ChangeIndicator rate={data.ticketChangeRate} /></div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="text-[10px] text-orange-500 font-medium mb-1">📞 コール</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-gray-500">前3日: {data.preEventCallAvg}</span>
            <span className="text-xs text-gray-400">→</span>
            <span className="text-xs text-gray-800 font-medium">後3日: {data.postEventCallAvg}</span>
          </div>
          <div className="mt-1 text-xs"><ChangeIndicator rate={data.callChangeRate} /></div>
        </div>
      </div>

      {/* Top categories */}
      {data.topCategories.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-2">増加カテゴリ</h4>
          <div className="space-y-1">
            {data.topCategories.slice(0, 5).map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate flex-1">{cat.category}</span>
                <span className="text-gray-400 mx-2">{cat.preCount} → {cat.postCount}</span>
                <ChangeIndicator rate={cat.increaseRate} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Representative tickets */}
      {data.representativeTickets.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-2">代表チケット</h4>
          <div className="space-y-1">
            {data.representativeTickets.map((t) => (
              <div key={t.ticketId} className="text-xs text-gray-600">
                <span className="text-blue-600 font-mono">#{t.ticketId}</span>
                <span className="ml-2 text-gray-500 truncate">{t.subject}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      {data.aiSummary && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">🤖 AI分析</h4>
          <p className="text-xs text-gray-700 leading-relaxed">{data.aiSummary}</p>
        </div>
      )}
    </div>
  );
}

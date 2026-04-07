'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter';
import { AnomalyBadge, AIAnalysisDetail, EventSuggestionBanner, ActionSuggestionCards } from '@/components/anomaly';
import type { AnomalyEvent } from '@/types/anomaly';
import type { AIAnalysisResult, EventSuggestion, ActionSuggestion } from '@/types/ai';

export default function AnomaliesPage() {
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [suggestion, setSuggestion] = useState<EventSuggestion | null>(null);
  const [actions, setActions] = useState<ActionSuggestion[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const fetchAnomalies = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      const res = await fetch(`/api/anomalies?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAnomalies(json.data ?? json);
      }
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setAnalysisLoading(true);
    try {
      const [analysisRes, suggestionRes, actionsRes] = await Promise.allSettled([
        fetch(`/api/anomalies/${id}/analysis`),
        fetch(`/api/anomalies/${id}/suggestion`),
        fetch(`/api/anomalies/${id}/actions`),
      ]);
      if (analysisRes.status === 'fulfilled' && analysisRes.value.ok) {
        const json = await analysisRes.value.json();
        setAnalysis(json.data ?? json);
      }
      if (suggestionRes.status === 'fulfilled' && suggestionRes.value.ok) {
        const json = await suggestionRes.value.json();
        setSuggestion(json.data ?? json);
      }
      if (actionsRes.status === 'fulfilled' && actionsRes.value.ok) {
        const json = await actionsRes.value.json();
        setActions(json.data ?? json);
      }
    } catch {
      // handle error silently
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const handleSuggestionRespond = async (response: string, sug: EventSuggestion) => {
    if (selectedId) {
      await fetch(`/api/anomalies/${selectedId}/suggestion/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
    }
  };

  const handleActionRespond = async (actionId: string, response: string) => {
    if (selectedId) {
      await fetch(`/api/anomalies/${selectedId}/actions/${actionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <DateRangeFilter onChange={fetchAnomalies} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Anomaly list */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">検知一覧</h3>
            {loading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded" />)}
              </div>
            ) : anomalies.length === 0 ? (
              <p className="text-sm text-gray-400">異常検知なし</p>
            ) : (
              anomalies.map((a) => (
                <button
                  key={a.id}
                  onClick={() => fetchDetail(a.id)}
                  className={`w-full text-left p-3 border rounded-lg hover:bg-gray-50 ${
                    selectedId === a.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AnomalyBadge anomaly={a} />
                    <span className="text-xs text-gray-500">{a.metric}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    値: {a.currentValue} (基準: {a.thresholdOrBaseline})
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {new Date(a.detectedAt).toLocaleString('ja-JP')}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2 space-y-4">
            {selectedId ? (
              <>
                <EventSuggestionBanner
                  suggestion={suggestion}
                  loading={analysisLoading}
                  onRespond={handleSuggestionRespond}
                />
                <AIAnalysisDetail data={analysis} loading={analysisLoading} />
                <ActionSuggestionCards
                  actions={actions}
                  loading={analysisLoading}
                  onRespond={handleActionRespond}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-sm text-gray-400">
                左の一覧から異常を選択してください
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

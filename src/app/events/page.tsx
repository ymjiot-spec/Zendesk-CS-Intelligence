'use client';

import React, { useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter';
import {
  EventForm, EventList, EventDetail, PredictionBanner,
  TabNavigation, CompanyTimeline, CorrelationChart, ImpactAnalysisPanel,
} from '@/components/event';
import { COMPANY_LIST, getCompanyColor } from '@/lib/company-colors';
import type { CompanyCorrelationData } from '@/components/event/CorrelationChart';
import type { TabId } from '@/components/event/TabNavigation';
import type { EventFormData } from '@/components/event/EventForm';
import type { EventLog } from '@/types/event';
import type { TimelineEvent, CorrelationDataPoint, ImpactAnalysisData } from '@/types/timeline';
import type { ImpactScoreResult, OverlapAnalysisResult, ImpactPrediction } from '@/types/ai';

const ALL_KEYS = COMPANY_LIST.map((c) => c.key);

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [currentRange, setCurrentRange] = useState<DateRange | null>(null);
  // Multi-select: Set of selected sourceKeys. Empty = all selected.
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(ALL_KEYS));

  // List tab state
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventLog | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);
  const [impact, setImpact] = useState<ImpactScoreResult | null>(null);
  const [overlap, setOverlap] = useState<OverlapAnalysisResult | null>(null);
  const [prediction, setPrediction] = useState<ImpactPrediction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [allCompanyEvents, setAllCompanyEvents] = useState<TimelineEvent[]>([]);
  const [multiCorrelation, setMultiCorrelation] = useState<CompanyCorrelationData[]>([]);
  const [analysisData, setAnalysisData] = useState<ImpactAnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const isAllSelected = selectedSources.size === ALL_KEYS.length;

  // Toggle company selection
  const toggleSource = (key: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (next.size === 0) return new Set(ALL_KEYS); // at least one must be selected
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedSources(new Set(ALL_KEYS));

  // Fetch events list
  const fetchEvents = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data ?? json);
      }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  // Fetch timeline data
  const fetchTimeline = useCallback(async (range: DateRange) => {
    try {
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      const res = await fetch(`/api/events/timeline?${params}`);
      if (res.ok) {
        const json = await res.json();
        const groups = json.data?.groups ?? [];
        const allEvents = groups.flatMap((g: any) => g.events);
        setTimelineEvents(allEvents);
        setAllCompanyEvents(json.data?.allCompanyEvents ?? []);
      }
    } catch { /* */ }
  }, []);

  // Fetch correlation data for selected companies (parallel)
  const fetchCorrelation = useCallback(async (range: DateRange, sources: Set<string>) => {
    try {
      const keys = Array.from(sources);
      const results = await Promise.all(
        keys.map(async (key) => {
          const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate, sourceKey: key });
          const res = await fetch(`/api/events/timeline/correlation?${params}`);
          if (res.ok) {
            const json = await res.json();
            const company = COMPANY_LIST.find((c) => c.key === key);
            return {
              sourceKey: key,
              companyName: company?.name ?? key,
              daily: json.data?.daily ?? [],
            } as CompanyCorrelationData;
          }
          return null;
        })
      );
      setMultiCorrelation(results.filter(Boolean) as CompanyCorrelationData[]);
    } catch { /* */ }
  }, []);

  // Fetch all data
  const fetchAll = useCallback((range: DateRange, sources: Set<string>) => {
    fetchEvents(range);
    fetchTimeline(range);
    fetchCorrelation(range, sources);
  }, [fetchEvents, fetchTimeline, fetchCorrelation]);

  // Handle date range change
  const handleDateChange = useCallback((range: DateRange) => {
    setCurrentRange(range);
    fetchAll(range, selectedSources);
  }, [fetchAll, selectedSources]);

  // Re-fetch correlation when sources change
  const handleSourceToggle = (key: string) => {
    let nextSources: Set<string>;
    if (key === 'ALL') {
      nextSources = new Set(ALL_KEYS);
    } else {
      nextSources = new Set(selectedSources);
      if (nextSources.has(key)) {
        nextSources.delete(key);
        if (nextSources.size === 0) nextSources = new Set(ALL_KEYS);
      } else {
        nextSources.add(key);
      }
    }
    setSelectedSources(nextSources);
    if (currentRange) fetchCorrelation(currentRange, nextSources);
  };

  // Handle event click on timeline
  const handleTimelineEventClick = useCallback(async (event: TimelineEvent) => {
    setAnalysisLoading(true);
    setAnalysisData(null);
    try {
      const res = await fetch(`/api/events/${event.id}/analysis`);
      if (res.ok) {
        const json = await res.json();
        setAnalysisData(json.data ?? null);
      }
    } catch { /* */ } finally { setAnalysisLoading(false); }
  }, []);

  // List tab handlers
  const handleSubmit = async (data: EventFormData) => {
    setFormLoading(true);
    try {
      const method = editingEvent ? 'PUT' : 'POST';
      const url = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowForm(false);
        setEditingEvent(null);
        if (currentRange) fetchAll(currentRange, selectedSources);
      }
    } catch { /* */ } finally { setFormLoading(false); }
  };

  const handleEdit = (event: EventLog) => {
    setEditingEvent(event);
    setShowForm(true);
    setActiveTab('list');
  };

  const handleDelete = async (eventId: string) => {
    await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    if (currentRange) {
      fetchTimeline(currentRange);
      fetchCorrelation(currentRange, selectedSources);
    }
  };

  const handleSelectEvent = async (event: EventLog) => {
    setSelectedEvent(event);
    setDetailLoading(true);
    try {
      const [impactRes, overlapRes, predRes] = await Promise.allSettled([
        fetch(`/api/events/${event.id}/impact`),
        fetch(`/api/events/overlap?eventId=${event.id}`),
        fetch(`/api/events/${event.id}/prediction`),
      ]);
      if (impactRes.status === 'fulfilled' && impactRes.value.ok) { setImpact((await impactRes.value.json()).data ?? null); }
      if (overlapRes.status === 'fulfilled' && overlapRes.value.ok) { setOverlap((await overlapRes.value.json()).data ?? null); }
      if (predRes.status === 'fulfilled' && predRes.value.ok) { setPrediction((await predRes.value.json()).data ?? null); }
    } catch { /* */ } finally { setDetailLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <DateRangeFilter onChange={handleDateChange} />
          <button
            onClick={() => { setShowForm(true); setEditingEvent(null); setActiveTab('list'); }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + イベント登録
          </button>
        </div>

        {/* Company multi-select buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => handleSourceToggle('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              isAllSelected
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            全社
          </button>
          {COMPANY_LIST.map((c) => {
            const color = getCompanyColor(c.key);
            const isActive = selectedSources.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => handleSourceToggle(c.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                  isActive
                    ? `${color.tailwind.bg} ${color.tailwind.text} ${color.tailwind.border}`
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {c.name}
              </button>
            );
          })}
          <span className="text-[10px] text-gray-400 ml-2">
            {isAllSelected ? '全社表示' : `${selectedSources.size}社選択中`}
          </span>
        </div>

        {/* Tabs */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab content */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <CompanyTimeline
              events={timelineEvents}
              allCompanyEvents={allCompanyEvents}
              startDate={currentRange?.startDate ?? ''}
              endDate={currentRange?.endDate ?? ''}
              onEventClick={handleTimelineEventClick}
            />
            <CorrelationChart multiData={multiCorrelation} mini />
            {analysisData && (
              <ImpactAnalysisPanel data={analysisData} loading={analysisLoading} onClose={() => setAnalysisData(null)} />
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <div>
            {showForm && (
              <>
                <PredictionBanner prediction={prediction} />
                <EventForm
                  initialData={editingEvent ?? undefined}
                  onSubmit={handleSubmit}
                  onCancel={() => { setShowForm(false); setEditingEvent(null); }}
                  loading={formLoading}
                />
              </>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <EventList events={events} loading={loading} onEdit={handleEdit} onDelete={handleDelete} />
              {selectedEvent && (
                <EventDetail event={selectedEvent} impact={impact} overlap={overlap} loading={detailLoading} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'correlation' && (
          <div className="space-y-4">
            <CompanyTimeline
              events={timelineEvents}
              allCompanyEvents={allCompanyEvents}
              startDate={currentRange?.startDate ?? ''}
              endDate={currentRange?.endDate ?? ''}
              onEventClick={handleTimelineEventClick}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <CorrelationChart multiData={multiCorrelation} />
              </div>
              <div>
                {analysisLoading || analysisData ? (
                  <ImpactAnalysisPanel data={analysisData} loading={analysisLoading} onClose={() => setAnalysisData(null)} />
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                    <p className="text-sm text-gray-400">タイムラインのイベントをクリックすると影響分析を表示します</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

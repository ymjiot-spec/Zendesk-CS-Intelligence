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

  // Cache for correlation data to avoid re-fetching
  const correlationCache = React.useRef(new Map<string, CompanyCorrelationData[]>());

  // Fetch events list — get recent 50 events regardless of date range
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?startDate=2020-01-01&endDate=2099-12-31`);
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

  // All correlation data (fetched once, filtered client-side)
  const allCorrelationRef = React.useRef<CompanyCorrelationData[]>([]);

  // Fetch ALL correlation data in one API call, then filter client-side
  const fetchCorrelation = useCallback(async (range: DateRange, sources: Set<string>) => {
    const cacheKey = `${range.startDate}_${range.endDate}`;
    const cached = correlationCache.current.get(cacheKey);

    if (cached) {
      allCorrelationRef.current = cached;
      setMultiCorrelation(cached.filter((c) => sources.has(c.sourceKey)));
      return;
    }

    try {
      // Single API call for all companies
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      const res = await fetch(`/api/events/timeline/correlation?${params}`);
      if (res.ok) {
        const json = await res.json();
        const companies = json.data?.companies ?? [];
        const allData: CompanyCorrelationData[] = companies.map((c: any) => ({
          sourceKey: c.sourceKey,
          companyName: c.companyName,
          daily: c.daily,
        }));
        allCorrelationRef.current = allData;
        correlationCache.current.set(cacheKey, allData);
        setMultiCorrelation(allData.filter((c) => sources.has(c.sourceKey)));
      }
    } catch { /* */ }
  }, []);

  // Fetch all data
  const fetchAll = useCallback((range: DateRange, sources: Set<string>) => {
    fetchEvents();
    fetchTimeline(range);
    fetchCorrelation(range, sources);
  }, [fetchEvents, fetchTimeline, fetchCorrelation]);

  // Handle date range change
  const handleDateChange = useCallback((range: DateRange) => {
    setCurrentRange(range);
    correlationCache.current.clear(); // Clear cache on date change
    fetchAll(range, selectedSources);
  }, [fetchAll, selectedSources]);

  // Re-fetch correlation when sources change — instant client-side filter
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

    // Instant: filter from already-loaded data (no API call)
    const filtered = allCorrelationRef.current.filter((c) => nextSources.has(c.sourceKey));
    setMultiCorrelation(filtered);

    // If no data loaded yet, fetch
    if (allCorrelationRef.current.length === 0 && currentRange) {
      fetchCorrelation(currentRange, nextSources);
    }
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
        // Auto-switch to a range that includes the event date
        const eventDate = data.occurredAt.slice(0, 10);
        const rangeToUse = currentRange && currentRange.startDate <= eventDate && currentRange.endDate >= eventDate
          ? currentRange
          : { startDate: eventDate, endDate: eventDate };
        setCurrentRange(rangeToUse);
        fetchAll(rangeToUse, selectedSources);
        setActiveTab('timeline');
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
            <div className="mt-4">
              <EventList events={events} loading={loading} onEdit={handleEdit} onDelete={handleDelete} />
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

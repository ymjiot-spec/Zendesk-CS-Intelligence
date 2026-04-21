'use client';

import React, { useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter';
import {
  EventForm, EventList, EventDetail, PredictionBanner,
  TabNavigation, CompanyTimeline, CorrelationChart, ImpactAnalysisPanel,
} from '@/components/event';
import type { TabId } from '@/components/event/TabNavigation';
import type { EventFormData } from '@/components/event/EventForm';
import type { EventLog } from '@/types/event';
import type { TimelineEvent, CorrelationDataPoint, ImpactAnalysisData } from '@/types/timeline';
import type { ImpactScoreResult, OverlapAnalysisResult, ImpactPrediction } from '@/types/ai';

export default function EventsPage() {
  // Shared state
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [currentRange, setCurrentRange] = useState<DateRange | null>(null);

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
  const [correlationData, setCorrelationData] = useState<CorrelationDataPoint[]>([]);
  const [analysisData, setAnalysisData] = useState<ImpactAnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Fetch events list (for 一覧 tab)
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

  // Fetch correlation data
  const fetchCorrelation = useCallback(async (range: DateRange) => {
    try {
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      const res = await fetch(`/api/events/timeline/correlation?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCorrelationData(json.data?.daily ?? []);
      }
    } catch { /* */ }
  }, []);

  // Handle date range change — fetch all data
  const handleDateChange = useCallback((range: DateRange) => {
    setCurrentRange(range);
    fetchEvents(range);
    fetchTimeline(range);
    fetchCorrelation(range);
  }, [fetchEvents, fetchTimeline, fetchCorrelation]);

  // Handle event click on timeline → load analysis
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
        if (currentRange) {
          fetchEvents(currentRange);
          fetchTimeline(currentRange);
          fetchCorrelation(currentRange);
        }
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
      fetchCorrelation(currentRange);
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
      if (impactRes.status === 'fulfilled' && impactRes.value.ok) {
        const json = await impactRes.value.json();
        setImpact(json.data ?? json);
      }
      if (overlapRes.status === 'fulfilled' && overlapRes.value.ok) {
        const json = await overlapRes.value.json();
        setOverlap(json.data ?? json);
      }
      if (predRes.status === 'fulfilled' && predRes.value.ok) {
        const json = await predRes.value.json();
        setPrediction(json.data ?? json);
      }
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
            <CorrelationChart data={correlationData} mini />
            {analysisData && (
              <ImpactAnalysisPanel
                data={analysisData}
                loading={analysisLoading}
                onClose={() => setAnalysisData(null)}
              />
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
              <EventList
                events={events}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {selectedEvent && (
                <EventDetail
                  event={selectedEvent}
                  impact={impact}
                  overlap={overlap}
                  loading={detailLoading}
                />
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
                <CorrelationChart data={correlationData} />
              </div>
              <div>
                {analysisLoading || analysisData ? (
                  <ImpactAnalysisPanel
                    data={analysisData}
                    loading={analysisLoading}
                    onClose={() => setAnalysisData(null)}
                  />
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

'use client';

import React, { useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter';
import { EventForm, EventList, EventDetail, PredictionBanner } from '@/components/event';
import type { EventFormData } from '@/components/event/EventForm';
import type { EventLog } from '@/types/event';
import type { ImpactScoreResult, OverlapAnalysisResult, ImpactPrediction } from '@/types/ai';

export default function EventsPage() {
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

  const fetchEvents = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data ?? json);
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (data: EventFormData) => {
    setFormLoading(true);
    try {
      const method = editingEvent ? 'PUT' : 'POST';
      const url = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      setShowForm(false);
      setEditingEvent(null);
    } catch {
      // handle silently
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (event: EventLog) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleDelete = async (eventId: string) => {
    await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
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
    } catch {
      // handle silently
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <DateRangeFilter onChange={fetchEvents} />
          <button
            onClick={() => { setShowForm(true); setEditingEvent(null); }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + イベント登録
          </button>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
    </DashboardLayout>
  );
}

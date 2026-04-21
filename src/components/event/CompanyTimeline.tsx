'use client';

import React, { useMemo } from 'react';
import { COMPANY_LIST, getCompanyColor } from '@/lib/company-colors';
import type { TimelineEvent } from '@/types/timeline';
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

const EVENT_TYPE_BORDER: Record<string, string> = {
  campaign_start: '#22c55e',
  system_release: '#3b82f6',
  incident: '#ef4444',
  email_delivery: '#a855f7',
  pricing_change: '#f97316',
  terms_change: '#eab308',
  other: '#9ca3af',
};

interface CompanyTimelineProps {
  events: TimelineEvent[];
  allCompanyEvents: TimelineEvent[];
  startDate: string;
  endDate: string;
  onEventClick: (event: TimelineEvent) => void;
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  while (cur <= endD) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function toJSTDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

function dateIndex(dates: string[], dateStr: string): number {
  return dates.indexOf(dateStr);
}

interface PlacedEvent {
  event: TimelineEvent;
  startIdx: number;
  endIdx: number; // inclusive
  spanDays: number;
}

export default function CompanyTimeline({
  events, allCompanyEvents, startDate, endDate, onEventClick,
}: CompanyTimelineProps) {
  const dates = useMemo(() => getDatesInRange(startDate, endDate), [startDate, endDate]);
  const COL_W = Math.max(32, Math.min(60, 800 / Math.max(dates.length, 1)));
  const companies = COMPANY_LIST;

  // Build placed events per company
  const companyEvents = useMemo(() => {
    const result = new Map<string, PlacedEvent[]>();
    const allEvents = [...events, ...allCompanyEvents];

    for (const company of companies) {
      const placed: PlacedEvent[] = [];
      const seen = new Set<string>();

      for (const e of allEvents) {
        if (seen.has(e.id)) continue;
        // Check if event belongs to this company
        const keys = e.sourceKey ? e.sourceKey.split(',') : [];
        const isAll = !e.sourceKey || e.sourceKey === 'ALL';
        if (!isAll && !keys.includes(company.key)) continue;
        seen.add(e.id);

        const sDate = toJSTDate(e.occurredAt);
        const eDate = e.endDate ? toJSTDate(e.endDate) : sDate;
        const sIdx = dateIndex(dates, sDate);
        const eIdx = dateIndex(dates, eDate);
        if (sIdx < 0 && eIdx < 0) continue;

        const clampedStart = Math.max(0, sIdx);
        const clampedEnd = Math.min(dates.length - 1, eIdx < 0 ? clampedStart : eIdx);

        placed.push({
          event: e,
          startIdx: clampedStart,
          endIdx: clampedEnd,
          spanDays: clampedEnd - clampedStart + 1,
        });
      }
      result.set(company.key, placed);
    }
    return result;
  }, [events, allCompanyEvents, companies, dates]);

  if (dates.length === 0) {
    return <div className="p-4 text-sm text-gray-400">期間を選択してください</div>;
  }

  const totalWidth = dates.length * COL_W;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${120 + totalWidth}px` }}>
          {/* Date header row */}
          <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
            <div className="w-[120px] min-w-[120px] flex-shrink-0 border-r border-gray-200" />
            {dates.map((d) => {
              const day = new Date(d + 'T12:00:00');
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={d}
                  style={{ width: COL_W, minWidth: COL_W }}
                  className={`text-center text-[9px] py-1.5 border-r border-gray-100 flex-shrink-0 ${isWeekend ? 'bg-red-50' : ''}`}
                >
                  <div className="text-gray-500 font-medium">{day.getMonth() + 1}/{day.getDate()}</div>
                  <div className={`${isWeekend ? 'text-red-400' : 'text-gray-300'}`}>
                    {['日','月','火','水','木','金','土'][day.getDay()]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Company rows */}
          {companies.map((company) => {
            const color = getCompanyColor(company.key);
            const placed = companyEvents.get(company.key) ?? [];
            const rowHeight = Math.max(40, placed.length * 22 + 8);

            return (
              <div key={company.key} className="flex border-b border-gray-100" style={{ minHeight: rowHeight }}>
                {/* Company label - LEFT side */}
                <div className="w-[120px] min-w-[120px] px-3 py-2 flex items-center gap-1.5 border-r border-gray-200 flex-shrink-0 bg-white sticky left-0 z-[5]">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color.tailwind.bg}`} />
                  <span className="text-xs font-medium text-gray-700">{company.name}</span>
                </div>

                {/* Timeline grid + event bars */}
                <div className="relative flex-1" style={{ width: totalWidth }}>
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex">
                    {dates.map((d) => {
                      const day = new Date(d + 'T12:00:00');
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <div
                          key={d}
                          style={{ width: COL_W, minWidth: COL_W }}
                          className={`border-r border-gray-50 h-full ${isWeekend ? 'bg-red-50/30' : ''}`}
                        />
                      );
                    })}
                  </div>

                  {/* Event bars */}
                  {placed.map((p, idx) => {
                    const evColor = getCompanyColor(p.event.sourceKey?.split(',')[0] ?? null);
                    const isAllCompany = !p.event.sourceKey || p.event.sourceKey === 'ALL';
                    const borderColor = EVENT_TYPE_BORDER[p.event.eventType] ?? EVENT_TYPE_BORDER.other;

                    return (
                      <button
                        key={p.event.id}
                        onClick={() => onEventClick(p.event)}
                        title={`${p.event.name} (${EVENT_TYPE_LABELS[p.event.eventType] ?? p.event.eventType})${p.spanDays > 1 ? ` ${p.spanDays}日間` : ''}`}
                        className="absolute flex items-center rounded-sm text-[9px] leading-tight truncate px-1 hover:opacity-80 transition-opacity cursor-pointer"
                        style={{
                          left: p.startIdx * COL_W + 2,
                          width: p.spanDays * COL_W - 4,
                          top: 4 + idx * 22,
                          height: 18,
                          backgroundColor: isAllCompany ? '#dbeafe' : `${evColor.hex}18`,
                          borderLeft: `3px solid ${borderColor}`,
                          color: '#374151',
                        }}
                      >
                        {p.event.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useMemo } from 'react';
import { COMPANY_LIST, ALL_COLOR, getCompanyColor } from '@/lib/company-colors';
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

const EVENT_TYPE_BORDER: Record<EventType, string> = {
  campaign_start: 'border-l-green-500',
  system_release: 'border-l-blue-500',
  incident: 'border-l-red-500',
  email_delivery: 'border-l-purple-500',
  pricing_change: 'border-l-orange-500',
  terms_change: 'border-l-yellow-500',
  other: 'border-l-gray-400',
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

export default function CompanyTimeline({
  events, allCompanyEvents, startDate, endDate, onEventClick,
}: CompanyTimelineProps) {
  const dates = useMemo(() => getDatesInRange(startDate, endDate), [startDate, endDate]);
  const colWidth = Math.max(36, Math.min(80, 900 / dates.length));

  const companies = COMPANY_LIST;

  // Convert UTC ISO string to JST date string (YYYY-MM-DD)
  const toJSTDate = (isoStr: string): string => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  };

  // Group events by sourceKey+date
  const eventMap = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of events) {
      const dateStr = toJSTDate(e.occurredAt);
      const key = `${e.sourceKey ?? 'ALL'}|${dateStr}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const e of allCompanyEvents) {
      const dateStr = toJSTDate(e.occurredAt);
      for (const c of companies) {
        const key = `${c.key}|${dateStr}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
    }
    return map;
  }, [events, allCompanyEvents, companies]);

  if (dates.length === 0) {
    return <div className="p-4 text-sm text-gray-400">期間を選択してください</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${100 + dates.length * colWidth}px` }}>
          {/* Header row - dates */}
          <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
            <div className="w-24 min-w-[96px] px-3 py-2 text-[10px] font-semibold text-gray-500 border-r border-gray-200 flex-shrink-0">
              会社
            </div>
            {dates.map((d) => {
              const day = new Date(d + 'T12:00:00');
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={d}
                  style={{ width: colWidth, minWidth: colWidth }}
                  className={`px-0.5 py-2 text-center text-[9px] border-r border-gray-100 flex-shrink-0 ${isWeekend ? 'bg-gray-100' : ''}`}
                >
                  <div className="text-gray-400">{day.getMonth() + 1}/{day.getDate()}</div>
                  <div className="text-gray-300">{['日','月','火','水','木','金','土'][day.getDay()]}</div>
                </div>
              );
            })}
          </div>

          {/* Company rows */}
          {companies.map((company) => {
            const color = getCompanyColor(company.key);
            return (
              <div key={company.key} className="flex border-b border-gray-100 hover:bg-gray-50/50">
                <div className="w-24 min-w-[96px] px-3 py-2 flex items-center gap-1.5 border-r border-gray-200 flex-shrink-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${color.tailwind.bg}`} />
                  <span className="text-xs font-medium text-gray-700">{company.name}</span>
                </div>
                {dates.map((d) => {
                  const cellEvents = eventMap.get(`${company.key}|${d}`) ?? [];
                  return (
                    <div
                      key={d}
                      style={{ width: colWidth, minWidth: colWidth }}
                      className="relative px-0.5 py-1 border-r border-gray-50 flex-shrink-0"
                    >
                      {cellEvents.map((ev) => {
                        const isAllCompany = ev.sourceKey === null || ev.sourceKey === 'ALL';
                        const evColor = getCompanyColor(ev.sourceKey);
                        return (
                          <button
                            key={ev.id}
                            onClick={() => onEventClick(ev)}
                            title={`${ev.name} (${EVENT_TYPE_LABELS[ev.eventType]})`}
                            className={`block w-full mb-0.5 px-1 py-0.5 text-[8px] leading-tight rounded border-l-2 truncate text-left transition-opacity hover:opacity-80 ${EVENT_TYPE_BORDER[ev.eventType]} ${isAllCompany ? 'bg-blue-50 text-blue-700 opacity-70' : `${evColor.tailwind.bgLight} text-gray-700`}`}
                          >
                            {ev.name.slice(0, 6)}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

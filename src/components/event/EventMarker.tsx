'use client';

import React, { useState } from 'react';
import type { EventLog, EventType } from '@/types/event';

const EVENT_TYPE_CONFIG: Record<EventType, { color: string; icon: string }> = {
  campaign_start: { color: '#22c55e', icon: '📢' },
  system_release: { color: '#3b82f6', icon: '🚀' },
  incident: { color: '#ef4444', icon: '⚠️' },
  email_delivery: { color: '#a855f7', icon: '📧' },
  pricing_change: { color: '#f97316', icon: '💰' },
  terms_change: { color: '#eab308', icon: '📋' },
  other: { color: '#6b7280', icon: '📌' },
};

interface EventMarkerProps {
  events: EventLog[];
  chartWidth: number;
  chartHeight: number;
  dateRange: { start: Date; end: Date };
  ticketChanges?: Record<string, { preAvg: number; postAvg: number }>;
  loading?: boolean;
}

export default function EventMarker({ events, chartWidth, chartHeight, dateRange, ticketChanges, loading }: EventMarkerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const safeEvents = Array.isArray(events) ? events : [];
  if (loading || safeEvents.length === 0) return null;

  const rangeMs = dateRange.end.getTime() - dateRange.start.getTime();
  if (rangeMs <= 0) return null;

  // Detect overlapping events (within 1 day)
  const overlapPairs = new Set<string>();
  for (let i = 0; i < safeEvents.length; i++) {
    for (let j = i + 1; j < safeEvents.length; j++) {
      const diff = Math.abs(new Date(safeEvents[i].occurredAt).getTime() - new Date(safeEvents[j].occurredAt).getTime());
      if (diff < 86400000) {
        overlapPairs.add(`${safeEvents[i].id}-${safeEvents[j].id}`);
      }
    }
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={chartWidth}
      height={chartHeight}
      style={{ overflow: 'visible' }}
    >
      {safeEvents.map((event) => {
        const eventTime = new Date(event.occurredAt).getTime();
        const x = ((eventTime - dateRange.start.getTime()) / rangeMs) * chartWidth;
        if (x < 0 || x > chartWidth) return null;

        const config = EVENT_TYPE_CONFIG[event.eventType];
        const isHovered = hoveredId === event.id;
        const change = ticketChanges?.[event.id];
        const hasOverlap = safeEvents.some(
          (other) => other.id !== event.id && overlapPairs.has(`${event.id}-${other.id}`) || overlapPairs.has(`${other.id}-${event.id}`)
        );

        return (
          <g key={event.id}>
            {/* Vertical line */}
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={chartHeight}
              stroke={config.color}
              strokeWidth={hasOverlap ? 2 : 1}
              strokeDasharray={hasOverlap ? '4 2' : 'none'}
              opacity={0.7}
            />
            {/* Overlap highlight region */}
            {hasOverlap && (
              <rect x={x - 10} y={0} width={20} height={chartHeight} fill={config.color} opacity={0.05} />
            )}
            {/* Icon marker */}
            <foreignObject
              x={x - 10}
              y={-4}
              width={20}
              height={20}
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredId(event.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="text-center text-sm" title={event.name}>
                {config.icon}
              </div>
            </foreignObject>
            {/* Tooltip */}
            {isHovered && (
              <foreignObject x={x + 12} y={10} width={220} height={120} className="pointer-events-none">
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs">
                  <p className="font-medium text-gray-800">{event.name}</p>
                  <p className="text-gray-500">{EVENT_TYPE_CONFIG[event.eventType].icon} {event.eventType}</p>
                  <p className="text-gray-500">{new Date(event.occurredAt).toLocaleString('ja-JP')}</p>
                  {event.description && <p className="text-gray-600 mt-1 line-clamp-2">{event.description}</p>}
                  {change && (
                    <p className="mt-1 text-gray-600">
                      前: {change.preAvg.toFixed(1)}件/日 → 後: {change.postAvg.toFixed(1)}件/日
                      <span className={change.postAvg > change.preAvg ? 'text-red-500 ml-1' : 'text-green-500 ml-1'}>
                        ({change.postAvg > change.preAvg ? '+' : ''}{(change.postAvg - change.preAvg).toFixed(1)})
                      </span>
                    </p>
                  )}
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
}

'use client';

import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ALL_COLOR } from '@/lib/company-colors';
import type { CorrelationDataPoint } from '@/types/timeline';

interface CorrelationChartProps {
  data: CorrelationDataPoint[];
  mini?: boolean;
  onEventMarkerClick?: (eventId: string) => void;
}

export default function CorrelationChart({ data, mini, onEventMarkerClick }: CorrelationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-400 text-center">データなし</p>
      </div>
    );
  }

  const eventDates = data
    .filter((d) => d.eventMarkers && d.eventMarkers.length > 0)
    .map((d) => d.date);

  const height = mini ? 200 : 320;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {!mini && (
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          チケット数・コール数 相関グラフ
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: mini ? 9 : 11 }}
            tickFormatter={(v: string) => {
              const d = new Date(v + 'T12:00:00');
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis yAxisId="left" tick={{ fontSize: mini ? 9 : 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: mini ? 9 : 11 }} />
          <Tooltip
            labelFormatter={(v: string) => {
              const d = new Date(v + 'T12:00:00');
              return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          {!mini && <Legend wrapperStyle={{ fontSize: 11 }} />}

          <Bar
            yAxisId="left"
            dataKey="ticketCount"
            name="チケット数"
            fill={ALL_COLOR.hex}
            opacity={0.7}
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="callCount"
            name="コール数"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 2 }}
          />

          {eventDates.map((date) => (
            <ReferenceLine
              key={date}
              x={date}
              yAxisId="left"
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: '📌', position: 'top', fontSize: 10 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

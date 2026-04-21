'use client';

import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ALL_COLOR, getCompanyColor } from '@/lib/company-colors';

export interface CompanyCorrelationData {
  sourceKey: string;
  companyName: string;
  daily: { date: string; ticketCount: number; callCount: number; eventMarkers: any[] }[];
}

interface CorrelationChartProps {
  /** Single company or combined data (legacy) */
  data?: { date: string; ticketCount: number; callCount: number; eventMarkers: any[] }[];
  /** Multi-company data */
  multiData?: CompanyCorrelationData[];
  mini?: boolean;
  onEventMarkerClick?: (eventId: string) => void;
}

export default function CorrelationChart({ data, multiData, mini }: CorrelationChartProps) {
  // Multi-company mode
  if (multiData && multiData.length > 0) {
    return <MultiCompanyChart multiData={multiData} mini={mini} />;
  }

  // Single data mode (legacy / combined)
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-400 text-center">データなし</p>
      </div>
    );
  }

  const eventDates = data.filter((d) => d.eventMarkers?.length > 0).map((d) => d.date);
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
          <XAxis dataKey="date" tick={{ fontSize: mini ? 9 : 11 }}
            tickFormatter={(v: string) => { const d = new Date(v + 'T12:00:00'); return `${d.getMonth()+1}/${d.getDate()}`; }} />
          <YAxis yAxisId="left" tick={{ fontSize: mini ? 9 : 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: mini ? 9 : 11 }} />
          <Tooltip labelFormatter={(v: string) => { const d = new Date(v + 'T12:00:00'); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`; }} />
          {!mini && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Bar yAxisId="left" dataKey="ticketCount" name="チケット数" fill={ALL_COLOR.hex} opacity={0.7} radius={[2,2,0,0]} />
          <Line yAxisId="right" type="monotone" dataKey="callCount" name="コール数" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
          {eventDates.map((date) => (
            <ReferenceLine key={date} x={date} yAxisId="left" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: '📌', position: 'top', fontSize: 10 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}


function MultiCompanyChart({ multiData, mini }: { multiData: CompanyCorrelationData[]; mini?: boolean }) {
  // Merge all company data into unified date rows
  const dateSet = new Set<string>();
  const eventDateSet = new Set<string>();
  for (const cd of multiData) {
    for (const d of cd.daily) {
      dateSet.add(d.date);
      if (d.eventMarkers?.length > 0) eventDateSet.add(d.date);
    }
  }
  const dates = Array.from(dateSet).sort();

  // Build merged data: each row has date + per-company ticket/call fields
  const merged = dates.map((date) => {
    const row: any = { date };
    for (const cd of multiData) {
      const dayData = cd.daily.find((d) => d.date === date);
      row[`ticket_${cd.sourceKey}`] = dayData?.ticketCount ?? 0;
      row[`call_${cd.sourceKey}`] = dayData?.callCount ?? 0;
    }
    return row;
  });

  const height = mini ? 200 : 360;

  if (merged.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-400 text-center">データなし</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {!mini && (
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          チケット数・コール数 会社別比較
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={merged} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: mini ? 9 : 11 }}
            tickFormatter={(v: string) => { const d = new Date(v + 'T12:00:00'); return `${d.getMonth()+1}/${d.getDate()}`; }} />
          <YAxis yAxisId="left" tick={{ fontSize: mini ? 9 : 11 }} label={!mini ? { value: 'チケット', angle: -90, position: 'insideLeft', fontSize: 10 } : undefined} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: mini ? 9 : 11 }} label={!mini ? { value: 'コール', angle: 90, position: 'insideRight', fontSize: 10 } : undefined} />
          <Tooltip labelFormatter={(v: string) => { const d = new Date(v + 'T12:00:00'); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`; }} />
          {!mini && <Legend wrapperStyle={{ fontSize: 11 }} />}

          {/* Per-company bars (tickets) stacked */}
          {multiData.map((cd) => {
            const color = getCompanyColor(cd.sourceKey);
            return (
              <Bar
                key={`ticket_${cd.sourceKey}`}
                yAxisId="left"
                dataKey={`ticket_${cd.sourceKey}`}
                name={`${cd.companyName} チケット`}
                fill={color.hex}
                opacity={0.75}
                stackId="tickets"
                radius={[0,0,0,0]}
              />
            );
          })}

          {/* Per-company lines (calls) */}
          {multiData.map((cd) => {
            const color = getCompanyColor(cd.sourceKey);
            return (
              <Line
                key={`call_${cd.sourceKey}`}
                yAxisId="right"
                type="monotone"
                dataKey={`call_${cd.sourceKey}`}
                name={`${cd.companyName} コール`}
                stroke={color.hex}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 2 }}
              />
            );
          })}

          {/* Event markers */}
          {Array.from(eventDateSet).map((date) => (
            <ReferenceLine key={date} x={date} yAxisId="left" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: '📌', position: 'top', fontSize: 10 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

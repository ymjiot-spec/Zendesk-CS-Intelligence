'use client';

import React, { useState } from 'react';
import type { AlertFiringRecord } from '@/types/alert';

interface AlertBannerProps {
  alerts: AlertFiringRecord[];
  loading?: boolean;
  onDismiss?: (alertId: string) => void;
}

export default function AlertBanner({ alerts, loading, onDismiss }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (loading) return null;

  const alertList = Array.isArray(alerts) ? alerts : [];
  const active = alertList.filter((a) => a.status === 'unresolved' && !dismissed.has(a.id));
  if (active.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    onDismiss?.(id);
  };

  return (
    <div className="space-y-1 mb-4">
      {active.slice(0, 3).map((alert) => (
        <div key={alert.id} className="flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-800 flex-1">
            🚨 アラート発火: 検知値 {alert.detectedValue} (基準 {alert.baselineValue})
          </span>
          <span className="text-[10px] text-red-600">
            {new Date(alert.firedAt).toLocaleString('ja-JP')}
          </span>
          <button
            onClick={() => handleDismiss(alert.id)}
            className="text-xs text-red-500 hover:text-red-700"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

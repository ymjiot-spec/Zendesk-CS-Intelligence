'use client';

import React from 'react';
import type { AnomalyEvent } from '@/types/anomaly';

interface AnomalyBadgeProps {
  anomaly: AnomalyEvent | null;
  loading?: boolean;
}

export default function AnomalyBadge({ anomaly, loading }: AnomalyBadgeProps) {
  if (loading || !anomaly) return null;

  const isCritical = anomaly.severity === 'critical';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        isCritical
          ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
          : 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`} />
      {isCritical ? '異常' : '注意'}
      <span className="font-normal">
        ({anomaly.type === 'threshold' ? '閾値超過' : 'トレンド異常'})
      </span>
    </span>
  );
}

'use client';

import React from 'react';
import type { ImpactPrediction } from '@/types/ai';

interface PredictionBannerProps {
  prediction: ImpactPrediction | null;
  loading?: boolean;
  onViewDetail?: (eventId: string) => void;
}

export default function PredictionBanner({ prediction, loading, onViewDetail }: PredictionBannerProps) {
  if (loading || !prediction) return null;

  const severity = prediction.predictedIncreasePercent >= 50 ? 'high' : prediction.predictedIncreasePercent >= 20 ? 'medium' : 'low';
  const styles = {
    high: 'bg-red-50 border-red-200 text-red-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    low: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className={`border rounded-lg p-4 ${styles[severity]}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg">🔮</span>
        <div className="flex-1">
          <p className="text-sm font-medium mb-1">
            予測: チケット数が約{prediction.predictedIncreasePercent}%増加する可能性があります
          </p>
          <p className="text-xs opacity-80 mb-2">{prediction.confidenceReason}</p>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              prediction.confidenceLevel === 'high' ? 'bg-green-100 text-green-700' :
              prediction.confidenceLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              確度: {prediction.confidenceLevel === 'high' ? '高' : prediction.confidenceLevel === 'medium' ? '中' : '低'}
            </span>
            {prediction.affectedCategories.slice(0, 3).map((c) => (
              <span key={c.category} className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded">
                {c.category} +{c.predictedIncrease}%
              </span>
            ))}
          </div>
          {prediction.pastSimilarEvents.length > 0 && (
            <div className="text-xs opacity-80">
              <span>過去の類似イベント: </span>
              {prediction.pastSimilarEvents.map((ev, i) => (
                <span key={ev.eventId}>
                  {i > 0 && '、'}
                  <button
                    onClick={() => onViewDetail?.(ev.eventId)}
                    className="underline hover:no-underline"
                  >
                    {ev.eventName} (Impact: {ev.impactScore})
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

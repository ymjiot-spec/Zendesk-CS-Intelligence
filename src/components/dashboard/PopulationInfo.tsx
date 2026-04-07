'use client';

import React from 'react';

export interface PopulationData {
  targetConditions: string[];
  exclusionConditions: string[];
  usedFields: string[];
  excludedCount: number;
  totalCount: number;
}

const DEFAULT_POPULATION: PopulationData = {
  targetConditions: ['全チケット（除外条件に該当しないもの）'],
  exclusionConditions: [
    'Ticket_Status が "Z" で始まるチケット',
    'Ticket_Status が "Z :" で始まるチケット',
  ],
  usedFields: ['作成日時', 'お問い合わせ項目 (Inquiry_Category)', 'チケットステータス (Ticket_Status)', 'チケット番号'],
  excludedCount: 0,
  totalCount: 0,
};

interface PopulationInfoProps {
  data?: PopulationData;
}

export default function PopulationInfo({ data = DEFAULT_POPULATION }: PopulationInfoProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        集計母集団定義
      </h3>

      <div className="space-y-3">
        {/* Target conditions */}
        <div>
          <span className="text-xs font-medium text-gray-600">対象条件</span>
          <ul className="mt-1 space-y-0.5">
            {data.targetConditions.map((c, i) => (
              <li key={i} className="text-gray-700 flex items-start gap-1">
                <span className="text-green-500 mt-0.5">●</span> {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Exclusion conditions */}
        <div>
          <span className="text-xs font-medium text-gray-600">除外条件</span>
          <ul className="mt-1 space-y-0.5">
            {data.exclusionConditions.map((c, i) => (
              <li key={i} className="text-gray-700 flex items-start gap-1">
                <span className="text-red-400 mt-0.5">●</span> {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Used fields */}
        <div>
          <span className="text-xs font-medium text-gray-600">使用フィールド</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {data.usedFields.map((f, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Excluded count */}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
          <span className="text-xs text-gray-500">除外件数:</span>
          <span className="font-semibold text-gray-800">{data.excludedCount.toLocaleString()} 件</span>
          <span className="text-xs text-gray-400">/ 全 {data.totalCount.toLocaleString()} 件</span>
        </div>
      </div>
    </div>
  );
}

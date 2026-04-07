'use client';

import React, { useState, useMemo } from 'react';
import type { MatrixRow } from '@/types/aggregation';

type SortKey = 'date' | string; // 'date' or category name
type SortDir = 'asc' | 'desc';

function CellDiff({ diff }: { diff: number }) {
  if (diff === 0) return null;
  const isUp = diff > 0;
  return (
    <span
      className={`text-[10px] font-medium ${isUp ? 'text-red-500' : 'text-green-500'}`}
    >
      {isUp ? '↑' : '↓'}{isUp ? '+' : ''}{diff}
    </span>
  );
}

interface MatrixTableProps {
  data: MatrixRow[];
  loading?: boolean;
}

export default function MatrixTable({ data, loading }: MatrixTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Collect all category names
  const categories = useMemo(() => {
    const set = new Set<string>();
    const safeData = Array.isArray(data) ? data : [];
    safeData.forEach((row) => Object.keys(row.categories).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [data]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const rows = Array.isArray(data) ? [...data] : [];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        const aVal = a.categories[sortKey]?.count ?? 0;
        const bVal = b.categories[sortKey]?.count ?? 0;
        cmp = aVal - bVal;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'desc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const fmtDate = (d: Date) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        日別×項目別マトリクス
      </h3>

      {(Array.isArray(data) ? data : []).length === 0 ? (
        <p className="text-sm text-gray-400">データなし</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th
                  className="text-left py-2 px-2 cursor-pointer hover:bg-gray-50 whitespace-nowrap"
                  onClick={() => handleSort('date')}
                >
                  日付{sortIndicator('date')}
                </th>
                <th className="text-right py-2 px-2 whitespace-nowrap">合計</th>
                {categories.map((cat) => (
                  <th
                    key={cat}
                    className="text-right py-2 px-2 cursor-pointer hover:bg-gray-50 whitespace-nowrap"
                    onClick={() => handleSort(cat)}
                  >
                    {cat}{sortIndicator(cat)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={String(row.date)} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-700 whitespace-nowrap">
                    {fmtDate(row.date)}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-gray-900">
                    {row.totalCount}
                  </td>
                  {categories.map((cat) => {
                    const cell = row.categories[cat];
                    if (!cell) {
                      return <td key={cat} className="py-2 px-2 text-right text-gray-300">-</td>;
                    }
                    return (
                      <td key={cat} className="py-2 px-2 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-gray-800">
                            {cell.count} <span className="text-gray-400">({cell.percentage.toFixed(1)}%)</span>
                          </span>
                          <CellDiff diff={cell.diff} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

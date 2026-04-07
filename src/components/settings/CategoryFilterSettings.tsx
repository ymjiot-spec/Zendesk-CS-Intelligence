'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface CategorySetting {
  source_key: string;
  inquiry_category: string;
  is_included: boolean;
  ticket_count: number;
}

interface Props {
  sources: { key: string; name: string }[];
}

export default function CategoryFilterSettings({ sources }: Props) {
  const [activeSource, setActiveSource] = useState(sources[0]?.key ?? '');
  const [categories, setCategories] = useState<CategorySetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchCategories = useCallback(async (source: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/categories?source=${source}`);
      const json = await res.json();
      if (json.success) setCategories(json.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeSource) fetchCategories(activeSource);
  }, [activeSource, fetchCategories]);

  const handleToggle = async (cat: CategorySetting) => {
    setSaving(cat.inquiry_category);
    try {
      await fetch('/api/settings/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_key: cat.source_key,
          inquiry_category: cat.inquiry_category,
          is_included: !cat.is_included,
        }),
      });
      setCategories(prev =>
        prev.map(c =>
          c.inquiry_category === cat.inquiry_category
            ? { ...c, is_included: !c.is_included }
            : c
        )
      );
    } catch { /* ignore */ }
    setSaving(null);
  };

  const includedCount = categories.filter(c => c.is_included).length;
  const excludedCount = categories.filter(c => !c.is_included).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        問い合わせ項目フィルタ設定
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        各社ごとに集計対象にするカテゴリを選択できます。OFFにしたカテゴリはダッシュボードの集計から除外されます。
      </p>

      {/* 会社タブ */}
      <div className="flex gap-1 mb-4">
        {sources.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSource(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              activeSource === s.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* 集計 */}
      <div className="flex gap-4 mb-3 text-xs text-gray-500">
        <span>集計対象: <span className="font-semibold text-green-600">{includedCount}</span></span>
        <span>除外: <span className="font-semibold text-red-500">{excludedCount}</span></span>
        <span>合計: {categories.length}</span>
      </div>

      {/* カテゴリ一覧 */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {categories.map(cat => (
            <div
              key={cat.inquiry_category}
              className={`flex items-center justify-between p-2 rounded-lg border ${
                cat.is_included ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => handleToggle(cat)}
                  disabled={saving === cat.inquiry_category}
                  className={`w-10 h-5 rounded-full relative transition-colors ${
                    cat.is_included ? 'bg-green-500' : 'bg-gray-300'
                  } ${saving === cat.inquiry_category ? 'opacity-50' : ''}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    cat.is_included ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
                <span className={`text-sm truncate ${cat.is_included ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                  {cat.inquiry_category || '(未設定)'}
                </span>
              </div>
              <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                {cat.ticket_count}件
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

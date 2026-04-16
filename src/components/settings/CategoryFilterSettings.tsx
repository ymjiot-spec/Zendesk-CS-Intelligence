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
  const [toast, setToast] = useState<string | null>(null);

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleToggle = async (cat: CategorySetting) => {
    setSaving(cat.inquiry_category);
    const newValue = !cat.is_included;
    try {
      const res = await fetch('/api/settings/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_key: cat.source_key,
          inquiry_category: cat.inquiry_category,
          is_included: newValue,
        }),
      });
      if (res.ok) {
        setCategories(prev =>
          prev.map(c =>
            c.inquiry_category === cat.inquiry_category
              ? { ...c, is_included: newValue }
              : c
          )
        );
        showToast(`${cat.inquiry_category} を${newValue ? '集計対象に追加' : '除外'}しました`);
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  // 一括操作
  const handleBulkToggle = async (include: boolean) => {
    setSaving('__bulk__');
    for (const cat of categories) {
      if (cat.is_included !== include) {
        await fetch('/api/settings/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_key: cat.source_key,
            inquiry_category: cat.inquiry_category,
            is_included: include,
          }),
        });
      }
    }
    setCategories(prev => prev.map(c => ({ ...c, is_included: include })));
    setSaving(null);
    showToast(include ? '全項目を集計対象にしました' : '全項目を除外しました');
  };

  const includedCount = categories.filter(c => c.is_included).length;
  const excludedCount = categories.filter(c => !c.is_included).length;

  // カテゴリをグループ分け: CS問い合わせ系 vs システム系
  const isSystemCategory = (name: string) => {
    const lower = name.toLowerCase();
    return /^(ar_|ab_|ai_|call_code|created_ticket|closed_by_merge|system_|reply$|^x$)/.test(lower);
  };

  const csCategories = categories.filter(c => !isSystemCategory(c.inquiry_category));
  const systemCategories = categories.filter(c => isSystemCategory(c.inquiry_category));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 relative">
      {/* トースト通知 */}
      {toast && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-3 py-1.5 rounded-md shadow-lg z-10 animate-pulse">
          ✓ {toast}
        </div>
      )}

      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        問い合わせ項目フィルタ設定
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        各社ごとに集計対象にするカテゴリを選択できます。トグルを切り替えると即時保存されます。
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

      {/* 集計 + 一括操作 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-4 text-xs text-gray-500">
          <span>集計対象: <span className="font-semibold text-green-600">{includedCount}</span></span>
          <span>除外: <span className="font-semibold text-red-500">{excludedCount}</span></span>
          <span>合計: {categories.length}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleBulkToggle(true)}
            disabled={saving !== null}
            className="px-2 py-1 text-[10px] bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
          >
            全てON
          </button>
          <button
            onClick={() => handleBulkToggle(false)}
            disabled={saving !== null}
            className="px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
          >
            全てOFF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {/* CS問い合わせ系 */}
          {csCategories.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-blue-600 uppercase mb-2">📋 問い合わせカテゴリ</h4>
              <div className="space-y-1">
                {csCategories.map(cat => (
                  <CategoryRow key={cat.inquiry_category} cat={cat} saving={saving} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}

          {/* システム系 */}
          {systemCategories.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase mb-2">⚙️ システム・自動処理カテゴリ</h4>
              <div className="space-y-1">
                {systemCategories.map(cat => (
                  <CategoryRow key={cat.inquiry_category} cat={cat} saving={saving} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ cat, saving, onToggle }: { cat: any; saving: string | null; onToggle: (cat: any) => void }) {
  const isSaving = saving === cat.inquiry_category || saving === '__bulk__';
  return (
    <div
      className={`flex items-center justify-between p-2 rounded-lg border ${
        cat.is_included ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onToggle(cat)}
          disabled={isSaving}
          className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
            cat.is_included ? 'bg-green-500' : 'bg-gray-300'
          } ${isSaving ? 'opacity-50' : ''}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            cat.is_included ? 'left-5' : 'left-0.5'
          }`} />
        </button>
        <span className={`text-sm truncate ${cat.is_included ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
          {cat.inquiry_category || '(未設定)'}
        </span>
      </div>
      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
        {isSaving && <span className="text-[10px] text-blue-500">保存中...</span>}
      </div>
    </div>
  );
}

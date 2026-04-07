'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { AlertRuleForm, AlertHistory, AlertBanner } from '@/components/alert';
import type { AlertRule, AlertFiringRecord, AlertPresetType } from '@/types/alert';

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertFiringRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, historyRes] = await Promise.allSettled([
        fetch('/api/alerts/rules'),
        fetch('/api/alerts/history'),
      ]);
      if (rulesRes.status === 'fulfilled' && rulesRes.value.ok) {
        const json = await rulesRes.value.json();
        setRules(json.data ?? json);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const json = await historyRes.value.json();
        setHistory(json.data ?? json);
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (data: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const method = editingRule ? 'PUT' : 'POST';
    const url = editingRule ? `/api/alerts/rules/${editingRule.id}` : '/api/alerts/rules';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    setEditingRule(null);
    fetchData();
  };

  const handlePreset = async (preset: AlertPresetType) => {
    await fetch('/api/alerts/rules/preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
    });
    fetchData();
  };

  const handleDeleteRule = async (ruleId: string) => {
    await fetch(`/api/alerts/rules/${ruleId}`, { method: 'DELETE' });
    fetchData();
  };

  const handleStatusChange = async (recordId: string, status: AlertFiringRecord['status']) => {
    await fetch(`/api/alerts/history/${recordId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setHistory((prev) => prev.map((r) => r.id === recordId ? { ...r, status } : r));
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <AlertBanner alerts={history} />

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">アラートルール管理</h2>
          <button
            onClick={() => { setShowForm(!showForm); setEditingRule(null); }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showForm ? '閉じる' : '+ 新規ルール'}
          </button>
        </div>

        {showForm && (
          <AlertRuleForm
            initialData={editingRule ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingRule(null); }}
            onPresetSelect={handlePreset}
          />
        )}

        {/* Existing rules */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">登録済みルール</h3>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
            </div>
          ) : rules.length === 0 ? (
            <p className="text-sm text-gray-400">ルールなし</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                  <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{rule.name}</span>
                    <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5">
                      <span>{rule.triggerType}</span>
                      <span>CD: {rule.cooldownMinutes}分</span>
                      <span>{rule.conditions.length}条件</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingRule(rule); setShowForm(true); }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <AlertHistory records={history} loading={loading} onStatusChange={handleStatusChange} />
      </div>
    </DashboardLayout>
  );
}

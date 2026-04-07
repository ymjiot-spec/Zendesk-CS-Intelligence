'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { AnomalySettings, NotificationSettings, PipelineStatus } from '@/components/settings';
import type { AnomalyDetectorConfig } from '@/types/anomaly';
import type { NotificationRule } from '@/types/notification';

interface DataSource {
  name: string;
  type: string;
  status: 'active' | 'error' | 'inactive';
  lastFetchedAt?: string;
  error?: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [anomalyConfig, setAnomalyConfig] = useState<AnomalyDetectorConfig | null>(null);
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [threshRes, trendRes, notifRes, pipeRes] = await Promise.allSettled([
        fetch('/api/settings/thresholds'),
        fetch('/api/settings/trend'),
        fetch('/api/notifications/rules'),
        fetch('/api/pipeline/status'),
      ]);

      if (threshRes.status === 'fulfilled' && threshRes.value.ok && trendRes.status === 'fulfilled' && trendRes.value.ok) {
        const thresholds = await threshRes.value.json();
        const trend = await trendRes.value.json();
        setAnomalyConfig({
          thresholds: thresholds.data ?? thresholds,
          trendConfig: trend.data ?? trend,
        });
      }
      if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
        const json = await notifRes.value.json();
        setNotificationRules(json.data ?? json);
      }
      if (pipeRes.status === 'fulfilled' && pipeRes.value.ok) {
        const json = await pipeRes.value.json();
        const pipeData = json.data ?? json;
        setLastUpdatedAt(pipeData.lastUpdatedAt ?? null);
        setDataSources(pipeData.dataSources ?? []);
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveAnomalyConfig = async (config: AnomalyDetectorConfig) => {
    await Promise.allSettled([
      fetch('/api/settings/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.thresholds),
      }),
      fetch('/api/settings/trend', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.trendConfig),
      }),
    ]);
  };

  const handleSaveNotification = async (rule: Omit<NotificationRule, 'id'> & { id?: string }) => {
    const method = rule.id ? 'PUT' : 'POST';
    const url = rule.id ? `/api/notifications/rules/${rule.id}` : '/api/notifications/rules';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    fetchSettings();
  };

  const handleDeleteNotification = async (ruleId: string) => {
    await fetch(`/api/notifications/rules/${ruleId}`, { method: 'DELETE' });
    fetchSettings();
  };

  const handleToggleNotification = async (ruleId: string, enabled: boolean) => {
    await fetch(`/api/notifications/rules/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    setNotificationRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled } : r));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="text-sm font-semibold text-gray-800">設定</h2>
        <AnomalySettings config={anomalyConfig} loading={loading} onSave={handleSaveAnomalyConfig} />
        <NotificationSettings
          rules={notificationRules}
          loading={loading}
          onSave={handleSaveNotification}
          onDelete={handleDeleteNotification}
          onToggle={handleToggleNotification}
        />
        <PipelineStatus lastUpdatedAt={lastUpdatedAt} dataSources={dataSources} loading={loading} />
      </div>
    </DashboardLayout>
  );
}

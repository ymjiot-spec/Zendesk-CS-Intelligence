'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ReportSettings } from '@/components/settings';
import type { AutoReport, ReportPeriod } from '@/types/report';

interface ReportSchedule {
  period: ReportPeriod;
  dayOfWeek?: number;
  dayOfMonth?: number;
  channels: { type: 'slack' | 'email'; destination: string }[];
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [reports, setReports] = useState<AutoReport[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, reportsRes] = await Promise.allSettled([
        fetch('/api/settings/reports'),
        fetch('/api/reports'),
      ]);
      if (schedRes.status === 'fulfilled' && schedRes.value.ok) {
        const json = await schedRes.value.json();
        setSchedule(json.data ?? json);
      }
      if (reportsRes.status === 'fulfilled' && reportsRes.value.ok) {
        const json = await reportsRes.value.json();
        setReports(json.data ?? json);
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

  const handleSaveSchedule = async (sched: ReportSchedule) => {
    await fetch('/api/settings/reports', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sched),
    });
  };

  const handleResend = async (reportId: string) => {
    await fetch(`/api/reports/${reportId}/resend`, { method: 'POST' });
  };

  const handleGenerate = async () => {
    await fetch('/api/reports/generate', { method: 'POST' });
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">レポート</h2>
        <ReportSettings
          schedule={schedule}
          reports={reports}
          loading={loading}
          onSaveSchedule={handleSaveSchedule}
          onResend={handleResend}
          onGenerate={handleGenerate}
        />
      </div>
    </DashboardLayout>
  );
}

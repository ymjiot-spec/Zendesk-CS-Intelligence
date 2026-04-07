'use client';

import React, { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { label: 'ダッシュボード', href: '/', icon: '📊' },
  { label: '異常検知', href: '/anomalies', icon: '🔔' },
  { label: 'イベントログ', href: '/events', icon: '📅' },
  { label: 'アラート', href: '/alerts', icon: '🚨' },
  { label: 'レポート', href: '/reports', icon: '📄' },
  { label: '設定', href: '/settings', icon: '⚙️' },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date().toLocaleString('ja-JP'));
    const timer = setInterval(() => setNow(new Date().toLocaleString('ja-JP')), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-56' : 'w-16'
        } flex flex-col bg-white border-r border-gray-200 transition-all duration-200`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
          {sidebarOpen && (
            <span className="text-sm font-bold text-gray-800">CS Dashboard</span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-800">
            Zendesk CS ダッシュボード
          </h1>
          <div className="text-xs text-gray-500">
            {now ? `最終更新: ${now}` : ''}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

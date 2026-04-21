'use client';

import React from 'react';

export type TabId = 'timeline' | 'list' | 'correlation';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'timeline', label: 'タイムライン', icon: '📅' },
  { id: 'list', label: '一覧', icon: '📋' },
  { id: 'correlation', label: '相関分析', icon: '📈' },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex border-b border-gray-200 bg-white rounded-t-lg">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-5 py-3 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="mr-1.5">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

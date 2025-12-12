import React from 'react';
import { Search, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { InboxTab } from '../../../types/inbox.types';

interface InboxTabsProps {
    activeTab: InboxTab;
    onTabChange: (tab: InboxTab) => void;
    counts: {
        all: number;
        unreplied: number;
        done: number;
        main: number;
        general: number;
        requests: number;
        spam: number;
    };
    onSearch: (query: string) => void;
    onToggleFilters: () => void;
    onShowStats?: () => void;
}

const InboxTabs: React.FC<InboxTabsProps> = ({ activeTab, onTabChange, counts, onSearch, onToggleFilters, onShowStats }) => {
    const tabs = [
        { id: 'all' as InboxTab, label: 'الكل', icon: '💬', count: counts.all },
        { id: 'unreplied' as InboxTab, label: 'غير مردود عليها', icon: '⚠️', count: counts.unreplied },
        { id: 'done' as InboxTab, label: 'منتهي', icon: '✅', count: counts.done },
        { id: 'main' as InboxTab, label: 'رئيسي', icon: '⭐', count: counts.main },
        { id: 'general' as InboxTab, label: 'عام', icon: '📋', count: counts.general },
        { id: 'requests' as InboxTab, label: 'طلبات', icon: '🔔', count: counts.requests },
        { id: 'spam' as InboxTab, label: 'سبام', icon: '🚫', count: counts.spam },
    ];

    return (
        <div className="border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4">
                <div className="flex space-x-1 space-x-reverse">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                                ? 'text-blue-600 border-blue-600'
                                : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                            }
            `}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.count > 0 && tab.id !== 'all' && (
                            <span className={`
                px-2 py-0.5 text-xs rounded-full
                ${activeTab === tab.id
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                                }
              `}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
                </div>

                {/* Search, Filter, and Stats buttons */}
                <div className="flex items-center gap-3">
                    {/* Stats Button */}
                    {onShowStats && (
                        <button
                            onClick={onShowStats}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                            title="الإحصائيات"
                        >
                            <BarChart3 className="w-5 h-5" />
                        </button>
                    )}

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="بحث في المحادثات..."
                            onChange={(e) => onSearch(e.target.value)}
                            className="pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                        />
                    </div>

                    {/* Filters Toggle */}
                    <button
                        onClick={onToggleFilters}
                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                        title="فلاتر متقدمة"
                    >
                        <SlidersHorizontal className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InboxTabs;

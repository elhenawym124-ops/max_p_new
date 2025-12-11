import React from 'react';
import { InboxTab } from '../../../types/inbox.types';

interface InboxTabsProps {
    activeTab: InboxTab;
    onTabChange: (tab: InboxTab) => void;
    counts: {
        all: number;
        done: number;
        main: number;
        general: number;
        requests: number;
        spam: number;
    };
}

const InboxTabs: React.FC<InboxTabsProps> = ({ activeTab, onTabChange, counts }) => {
    const tabs = [
        { id: 'all' as InboxTab, label: 'الكل', icon: '💬', count: counts.all },
        { id: 'done' as InboxTab, label: 'منتهي', icon: '✅', count: counts.done },
        { id: 'main' as InboxTab, label: 'رئيسي', icon: '⭐', count: counts.main },
        { id: 'general' as InboxTab, label: 'عام', icon: '📋', count: counts.general },
        { id: 'requests' as InboxTab, label: 'طلبات', icon: '🔔', count: counts.requests },
        { id: 'spam' as InboxTab, label: 'سبام', icon: '🚫', count: counts.spam },
    ];

    return (
        <div className="border-b border-gray-200 bg-white">
            <div className="flex space-x-1 space-x-reverse px-4">
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
                        {tab.count > 0 && (
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
        </div>
    );
};

export default InboxTabs;

import React from 'react';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

interface InboxHeaderProps {
    pageName?: string;
    onSearch: (query: string) => void;
    onToggleFilters: () => void;
}

const InboxHeader: React.FC<InboxHeaderProps> = ({ pageName, onSearch, onToggleFilters }) => {
    return (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">صندوق الوارد</h1>
                    {pageName && (
                        <p className="text-sm text-gray-600 mt-1">
                            {pageName}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="بحث في المحادثات..."
                            onChange={(e) => onSearch(e.target.value)}
                            className="pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
                        />
                    </div>

                    {/* Filters Toggle */}
                    <button
                        onClick={onToggleFilters}
                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                        title="فلاتر متقدمة"
                    >
                        <AdjustmentsHorizontalIcon className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InboxHeader;

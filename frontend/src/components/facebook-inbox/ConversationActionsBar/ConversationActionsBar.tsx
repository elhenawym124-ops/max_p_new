import React from 'react';
import {
    CheckCircleIcon,
    StarIcon,
    ArchiveBoxIcon,
    BellSlashIcon,
    ClockIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface ConversationActionsBarProps {
    isPriority: boolean;
    onTogglePriority: () => void;
    onMarkDone: () => void;
    onSnooze?: () => void;
    onArchive?: () => void;
    onMute?: () => void;
    disabled?: boolean;
}

const ConversationActionsBar: React.FC<ConversationActionsBarProps> = ({
    isPriority,
    onTogglePriority,
    onMarkDone,
    onSnooze,
    onArchive,
    onMute,
    disabled = false
}) => {
    return (
        <div className="flex items-center gap-2">
            {/* Mark as Done */}
            <button
                onClick={onMarkDone}
                disabled={disabled}
                className="p-2 hover:bg-green-50 text-gray-600 hover:text-green-600 rounded-lg transition-colors disabled:opacity-50"
                title="تحديد كمنتهي"
            >
                <CheckCircleIcon className="w-5 h-5" />
            </button>

            {/* Toggle Priority/Star */}
            <button
                onClick={onTogglePriority}
                disabled={disabled}
                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isPriority
                    ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                    : 'hover:bg-gray-100 text-gray-600'
                    }`}
                title={isPriority ? 'إلغاء الأولوية' : 'تحديد كأولوية'}
            >
                {isPriority ? (
                    <StarIconSolid className="w-5 h-5" />
                ) : (
                    <StarIcon className="w-5 h-5" />
                )}
            </button>

            {/* Snooze */}
            {onSnooze && (
                <button
                    onClick={onSnooze}
                    disabled={disabled}
                    className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    title="غفوة المحادثة"
                >
                    <ClockIcon className="w-5 h-5" />
                </button>
            )}

            {/* Archive (future) */}
            {onArchive && (
                <button
                    onClick={onArchive}
                    disabled={disabled}
                    className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    title="أرشفة"
                >
                    <ArchiveBoxIcon className="w-5 h-5" />
                </button>
            )}

            {/* Mute (future) */}
            {onMute && (
                <button
                    onClick={onMute}
                    disabled={disabled}
                    className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    title="كتم"
                >
                    <BellSlashIcon className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};

export default ConversationActionsBar;

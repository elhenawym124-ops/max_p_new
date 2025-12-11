import React, { useState } from 'react';
import { Trash2, MoreVertical, Reply, Forward, Star, Smile } from 'lucide-react';
import ReactionSelector from '../Generic/ReactionSelector';

interface Message {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    type: 'text' | 'image' | 'file' | 'IMAGE' | 'FILE';
    isFromCustomer: boolean;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
    conversationId: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    isAiGenerated?: boolean;
    metadata?: any;
    isStarred?: boolean; // We will map this from metadata in parent or handle it here
}

interface MessageBubbleProps {
    message: Message;
    onDelete?: (messageId: string) => void;
    onForward?: (message: Message) => void;
    onStar?: (messageId: string, isStarred: boolean) => void;
    onReaction?: (messageId: string, reaction: string) => void;
    onReply?: (message: Message) => void;
    currentUserId?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onDelete, onForward, onStar, onReaction, onReply, currentUserId }) => {
    const isCustomer = message.isFromCustomer;
    const isAI = message.isAiGenerated;
    const [showActions, setShowActions] = useState(false);
    const [showReactionSelector, setShowReactionSelector] = useState(false);

    // Parse metadata safely
    let metadata = {};
    try {
        if (typeof message.metadata === 'string') {
            metadata = JSON.parse(message.metadata);
        } else if (typeof message.metadata === 'object') {
            metadata = message.metadata;
        }
    } catch (e) {
        // ignore
    }

    const isStarred = (metadata as any)?.isStarred || message.isStarred;

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div
            className={`flex ${isCustomer ? 'justify-start' : 'justify-end'} mb-4 group relative`}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {/* Action Buttons (Left for user, Right for customer) */}
            {showActions && (
                <div
                    className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-full shadow-sm p-1 z-20 ${isCustomer ? '-right-36' : '-left-36'
                        }`}
                >
                    {onReaction && (
                        <div className="relative">
                            <button
                                onClick={() => setShowReactionSelector(!showReactionSelector)}
                                className={`p-1.5 rounded-full transition-colors ${myReaction
                                    ? 'text-yellow-500 bg-yellow-50'
                                    : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'
                                    }`}
                                title="إضافة تفاعل"
                            >
                                <Smile size={14} />
                            </button>
                            {showReactionSelector && (
                                <ReactionSelector
                                    onSelect={(r) => {
                                        if (onReaction) onReaction(message.id, r);
                                        setShowReactionSelector(false);
                                    }}
                                    currentReaction={myReaction}
                                />
                            )}
                        </div>
                    )}
                    {onReply && (
                        <button
                            onClick={() => onReply(message)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full transition-colors"
                            title="رد"
                        >
                            <Reply size={14} />
                        </button>
                    )}
                    {onStar && (
                        <button
                            onClick={() => onStar(message.id, !!isStarred)}
                            className={`p-1.5 rounded-full transition-colors ${isStarred
                                ? 'text-yellow-500 hover:bg-yellow-50'
                                : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'
                                }`}
                            title={isStarred ? "إلغاء التمييز" : "تمييز الرسالة"}
                        >
                            <Star size={14} fill={isStarred ? "currentColor" : "none"} />
                        </button>
                    )}
                    {onForward && (
                        <button
                            onClick={() => onForward(message)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full transition-colors"
                            title="إعادة توجيه"
                        >
                            <Forward size={14} />
                        </button>
                    )}
                    {!isCustomer && onDelete && (
                        <button
                            onClick={() => onDelete(message.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
                            title="حذف الرسالة"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            )}

            <div className="max-w-xs lg:max-w-md">
                {/* Sender name (for employee/AI messages) */}
                {!isCustomer && (
                    <div className="text-xs text-gray-500 mb-1 text-left">
                        {message.senderName}
                        {isAI && ' 🤖'}
                    </div>
                )}

                <div
                    className={`px-4 py-2 rounded-2xl ${isCustomer
                        ? 'bg-gray-200 text-gray-900 rounded-br-sm'
                        : isAI
                            ? 'bg-green-500 text-white rounded-bl-sm'
                            : 'bg-blue-600 text-white rounded-bl-sm'
                        }`}
                >
                    {/* Reply Context */}
                    {replyTo && (
                        <div className={`mb-2 text-xs border-l-2 pl-2 ${isCustomer ? 'border-gray-500 text-gray-600' : 'border-white/50 text-white/80'}`}>
                            <div className="font-semibold">{replyTo.senderName}</div>
                            <div className="truncate opacity-80">
                                {replyTo.type === 'text' ? replyTo.content : 'مرفق/صورة'}
                            </div>
                        </div>
                    )}

                    {/* Image message */}
                    {(message.type === 'image' || message.type === 'IMAGE') && message.fileUrl && (
                        <div className="mb-2">
                            <img
                                src={message.fileUrl}
                                alt={message.content}
                                loading="lazy"
                                className="rounded-lg max-w-full h-auto"
                                style={{ maxHeight: '300px' }}
                            />
                        </div>
                    )}

                    {/* File message */}
                    {(message.type === 'file' || message.type === 'FILE') && message.fileUrl && (
                        <a
                            href={message.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${isCustomer ? 'bg-gray-300' : 'bg-white/20'
                                }`}
                        >
                            <div className="flex-shrink-0 w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                                📎
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isCustomer ? 'text-gray-900' : 'text-white'
                                    }`}>
                                    {message.fileName || message.content}
                                </p>
                                <p className={`text-xs ${isCustomer ? 'text-gray-600' : 'text-white/70'
                                    }`}>
                                    {formatFileSize(message.fileSize)}
                                </p>
                            </div>
                            <div className="text-xs">⬇️</div>
                        </a>
                    )}

                    {/* Text content */}
                    <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                    </p>

                    {/* Reactions Display */}
                    {Object.keys(reactionCounts).length > 0 && (
                        <div className={`absolute -bottom-3 ${isCustomer ? 'right-2' : 'left-2'} bg-white rounded-full shadow-md border border-gray-100 flex items-center px-1.5 py-0.5 gap-1`}>
                            {Object.entries(reactionCounts).map(([reaction, count]) => (
                                <span key={reaction} className="text-xs leading-none flex items-center">
                                    <span className="text-sm">{reaction}</span>
                                    {count > 1 && <span className="text-[10px] text-gray-500 ml-0.5 font-medium">{count}</span>}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Timestamp and status */}
                    <div className="flex items-center justify-end mt-1 gap-2">
                        {isStarred && <Star size={10} className="text-yellow-500 fill-current" />}
                        <span className="text-xs opacity-75">
                            {formatTime(message.timestamp)}
                        </span>
                        {!isCustomer && (
                            <span className="text-xs">
                                {message.status === 'sending' && '⏳'}
                                {message.status === 'sent' && '✓'}
                                {message.status === 'delivered' && '✓✓'}
                                {message.status === 'read' && '✓✓'}
                                {message.status === 'error' && '❌'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;

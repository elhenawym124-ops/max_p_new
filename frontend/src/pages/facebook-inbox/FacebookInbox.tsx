import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import InboxHeader from '../../components/facebook-inbox/InboxHeader/InboxHeader';
import InboxTabs from '../../components/facebook-inbox/InboxTabs/InboxTabs';
import ConversationItem from '../../components/facebook-inbox/ConversationList/ConversationItem';
import MessageBubble from '../../components/facebook-inbox/MessageBubble/MessageBubble';
import MessageInput from '../../components/facebook-inbox/MessageInput/MessageInput';
import StatusDropdown from '../../components/facebook-inbox/StatusDropdown/StatusDropdown';
import AssignmentDropdown from '../../components/facebook-inbox/AssignmentDropdown/AssignmentDropdown';
import ConversationActionsBar from '../../components/facebook-inbox/ConversationActionsBar/ConversationActionsBar';
import TagInput from '../../components/facebook-inbox/TagInput/TagInput';
import { NotesPanel } from '../../components/facebook-inbox/NotesPanel/NotesPanel';
import FilterPanel, { FilterState } from '../../components/facebook-inbox/FilterPanel/FilterPanel';
import StatsDashboard from '../../components/facebook-inbox/StatsDashboard/StatsDashboard';
import CustomerProfile from '../../components/facebook-inbox/CustomerProfile/CustomerProfile';
import BulkActionsBar from '../../components/facebook-inbox/BulkActionsBar/BulkActionsBar';
import ForwardModal from '../../components/facebook-inbox/Modals/ForwardModal';
import SnoozeModal from '../../components/facebook-inbox/Modals/SnoozeModal';
import AIToggle from '../../components/facebook-inbox/AIToggle/AIToggle';
import { InboxTab, ConversationStatus, InboxMessage } from '../../types/inbox.types';
import { useInboxConversations } from '../../hooks/inbox/useInboxConversations';
import { useSendMessage } from '../../hooks/inbox/useSendMessage';
import { useConversationActions } from '../../hooks/inbox/useConversationActions';
import { useTagManagement } from '../../hooks/inbox/useTagManagement';
import useSocket from '../../hooks/useSocket';
import TypingIndicator from '../../components/facebook-inbox/TypingIndicator/TypingIndicator';
import AISuggestions from '../../components/facebook-inbox/AISuggestions/AISuggestions';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../hooks/useAuthSimple';
import { StickyNote, BarChart3 } from 'lucide-react';

const FacebookInbox: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { companyId } = useCompany();
    const { socket, isConnected } = useSocket();

    // Conversations management
    const {
        conversations,
        selectedConversation,
        messages,
        loading,
        loadingMessages,
        error,
        selectConversation,
        loadMessages,
        loadConversations,
        loadMoreMessages,
        addMessage,
        hasMore,
        // Selection
        selectedIds,
        toggleSelection,
        clearSelection
    } = useInboxConversations();

    // Send message
    const { sendTextMessage, sendFileMessage, sending, uploadingFile } = useSendMessage();

    // Conversation actions
    const {
        updateStatus,
        assignConversation,
        markAsDone,
        togglePriority,
        bulkUpdate,
        deleteMessage,
        forwardMessage,
        toggleMessageStar,
        toggleMessageReaction,
        snoozeConversation,
        toggleAI,
        updating
    } = useConversationActions();

    // Tag management
    const { addTags, updating: updatingTags } = useTagManagement();

    // Local state
    const [activeTab, setActiveTab] = useState<InboxTab>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        unreadOnly: false,
        assignedTo: 'all',
        startDate: null,
        endDate: null
    });

    // Forwarding State
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [messageToForward, setMessageToForward] = useState<InboxMessage | null>(null);
    const [replyToMessage, setReplyToMessage] = useState<any>(null);
    const [snoozeModalOpen, setSnoozeModalOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Tab counts
    const tabCounts = useMemo(() => ({
        all: conversations.length,
        done: conversations.filter(c => c.tab === 'done').length,
        main: conversations.filter(c => c.tab === 'main').length,
        general: conversations.filter(c => c.tab === 'general').length,
        requests: conversations.filter(c => c.tab === 'requests').length,
        spam: conversations.filter(c => c.tab === 'spam').length,
    }), [conversations]);

    // Filtered conversations
    const filteredConversations = useMemo(() => {
        return conversations.filter(conv => {
            // 1. Tab filter
            if (activeTab !== 'all' && conv.tab !== activeTab) return false;

            // 2. Search query
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = conv.customerName.toLowerCase().includes(query);
                const matchesMessage = conv.lastMessage.toLowerCase().includes(query);
                if (!matchesName && !matchesMessage) return false;
            }

            // 3. Unread filter
            if (filters.unreadOnly && conv.unreadCount === 0) return false;

            // 4. Assignment filter
            if (filters.assignedTo === 'me' && conv.assignedTo !== user?.id) return false;
            if (filters.assignedTo === 'unassigned' && conv.assignedTo !== null) return false;

            // 5. Date Range
            if (filters.startDate || filters.endDate) {
                const convDate = new Date(conv.lastMessageTime);
                if (filters.startDate && convDate < filters.startDate) return false;
                if (filters.endDate) {
                    const endOfDay = new Date(filters.endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    if (convDate > endOfDay) return false;
                }
            }

            return true;
        });
    }, [conversations, activeTab, searchQuery, filters, user?.id]);

    // Auto-scroll
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // Scroll to bottom on NEW messages only if at bottom
    // We need a smarter scroll logic for infinite scroll
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const prevMessagesLength = useRef(0);
    const oldScrollHeightRef = useRef(0);

    // Initial scroll to bottom
    useEffect(() => {
        if (messages.length > 0 && prevMessagesLength.current === 0) {
            setTimeout(scrollToBottom, 50);
        }
    }, [messages, scrollToBottom]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight } = e.currentTarget;

        // Load more if near top
        if (scrollTop < 50 && hasMore && !loadingMessages) {
            oldScrollHeightRef.current = scrollHeight; // Capture scroll height
            loadMoreMessages();
        }
    }, [hasMore, loadingMessages, loadMoreMessages]);


    useLayoutEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        // If messages increased (probably prepended)
        if (messages.length > prevMessagesLength.current && prevMessagesLength.current > 0) {
            // Restore scroll position
            if (oldScrollHeightRef.current > 0) {
                const newScrollHeight = container.scrollHeight;
                const diff = newScrollHeight - oldScrollHeightRef.current;
                container.scrollTop = diff; // Jump to previous visual position
                oldScrollHeightRef.current = 0;
            }
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    // Original auto-scroll
    useEffect(() => {
        if (messages.length > 0) {
            // Only scroll to bottom if it's a new message or initial load
            // This conflicts with infinite scroll prepend.
            // We'll rely on explicit scroll to bottom for sending.
        }
    }, [messages, scrollToBottom]);

    // Send message handlers
    // Send message handlers
    const handleSendMessage = useCallback(async (content: string) => {
        if (!selectedConversation || !companyId) return;
        try {
            await sendTextMessage(selectedConversation.id, content, companyId, replyToMessage);
            setReplyToMessage(null); // Clear reply after sending
            loadMessages(selectedConversation.id);
        } catch (error) {
            alert('فشل في إرسال الرسالة');
        }
    }, [selectedConversation, companyId, sendTextMessage, loadMessages, replyToMessage]);

    const handleSendFile = useCallback(async (file: File) => {
        if (!selectedConversation || !companyId) return;
        try {
            await sendFileMessage(selectedConversation.id, file, companyId);
            loadMessages(selectedConversation.id);
        } catch (error) {
            alert('فشل في إرسال الملف');
        }
    }, [selectedConversation, companyId, sendFileMessage, loadMessages]);

    // Bulk Action Handlers
    const handleBulkMarkDone = useCallback(async () => {
        if (!companyId || selectedIds.size === 0) return;
        if (!window.confirm(`هل أنت متأكد من إنهاء ${selectedIds.size} محادثة؟`)) return;

        try {
            await bulkUpdate(Array.from(selectedIds), 'mark_done', null, companyId);
            loadConversations();
            clearSelection();
            alert('✅ تم إنهاء المحادثات بنجاح');
        } catch (error) {
            alert('فشل في تنفيذ العملية');
        }
    }, [selectedIds, companyId, bulkUpdate, loadConversations, clearSelection]);

    const handleBulkAssign = useCallback(() => {
        // TODO: Show assignment modal
        alert('سيتم إضافة نافذة اختيار الموظف قريباً');
    }, [selectedIds]);

    const handleBulkTags = useCallback(() => {
        // TODO: Show tags modal
        alert('سيتم إضافة نافذة اختيار التصنيفات قريباً');
    }, [selectedIds]);

    // Action handlers
    const handleStatusChange = useCallback(async (status: ConversationStatus) => {
        if (!selectedConversation || !companyId) return;
        try {
            await updateStatus(selectedConversation.id, status, companyId);
            loadConversations();
        } catch (error) {
            alert('فشل في تحديث الحالة');
        }
    }, [selectedConversation, companyId, updateStatus, loadConversations]);

    const handleAssignment = useCallback(async (userId: string | null) => {
        if (!selectedConversation || !companyId) return;
        try {
            await assignConversation(selectedConversation.id, userId, companyId);
            loadConversations();
        } catch (error) {
            alert('فشل في تعيين المحادثة');
        }
    }, [selectedConversation, companyId, assignConversation, loadConversations]);

    const handleMarkDone = useCallback(async () => {
        if (!selectedConversation || !companyId) return;
        try {
            await markAsDone(selectedConversation.id, companyId);
            loadConversations();
            alert('✅ تم تحديد المحادثة كمنتهية');
        } catch (error) {
            alert('فشل في تحديث المحادثة');
        }
    }, [selectedConversation, companyId, markAsDone, loadConversations]);

    const handleTogglePriority = useCallback(async () => {
        if (!selectedConversation || !companyId) return;
        try {
            await togglePriority(
                selectedConversation.id,
                !selectedConversation.priority,
                companyId
            );
            loadConversations();
        } catch (error) {
            alert('فشل في تحديث الأولوية');
        }
    }, [selectedConversation, companyId, togglePriority, loadConversations]);

    // Tags handler
    const handleTagsChange = useCallback(async (tags: string[]) => {
        if (!selectedConversation || !companyId) return;
        try {
            await addTags(selectedConversation.id, tags, companyId);
            loadConversations();
        } catch (error) {
            alert('فشل في تحديث التصنيفات');
        }
    }, [selectedConversation, companyId, addTags, loadConversations]);

    // Delete message handler
    const handleDeleteMessage = useCallback(async (messageId: string) => {
        if (!selectedConversation) return;
        if (!window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;

        try {
            await deleteMessage(selectedConversation.id, messageId);
            loadMessages(selectedConversation.id); // Reload to reflect deletion
        } catch (error) {
            alert('فشل في حذف الرسالة');
        }
    }, [selectedConversation, deleteMessage, loadMessages]);

    // Forward message request handler
    const handleForwardRequest = useCallback((message: any) => {
        setMessageToForward(message);
        setForwardModalOpen(true);
    }, []);

    // Execute forward handler
    const handleForward = useCallback(async (targetConversationId: string) => {
        if (!messageToForward || !companyId) return;

        try {
            await forwardMessage(targetConversationId, messageToForward, companyId);
            alert('✅ تم إعادة توجيه الرسالة بنجاح');
            // Optional: Move to the target conversation
            // selectConversation(conversations.find(c => c.id === targetConversationId));
        } catch (error) {
            alert('فشل في إعادة توجيه الرسالة');
        }
    }, [messageToForward, companyId, forwardMessage]);

    // Star message handler
    const handleStarMessage = useCallback(async (messageId: string) => {
        if (!selectedConversation) return;
        try {
            await toggleMessageStar(selectedConversation.id, messageId);
            // Optimistic update or reload
            loadMessages(selectedConversation.id);
        } catch (error) {
            console.error('Failed to star message', error);
        }
    }, [selectedConversation, toggleMessageStar, loadMessages]);

    // Reaction handler
    const handleMessageReaction = useCallback(async (messageId: string, reaction: string) => {
        if (!selectedConversation) return;
        try {
            await toggleMessageReaction(selectedConversation.id, messageId, reaction);
            loadMessages(selectedConversation.id);
        } catch (error) {
            console.error('Failed to update reaction', error);
        }
    }, [selectedConversation, toggleMessageReaction, loadMessages]);

    // Reply handler
    const handleReplyToMessage = useCallback((message: any) => {
        setReplyToMessage(message);
        // Focus input? 
    }, []);

    const handleCancelReply = useCallback(() => {
        setReplyToMessage(null);
    }, []);

    // Snooze handler
    const handleSnoozeConfirm = useCallback(async (until: Date) => {
        if (!selectedConversation || !companyId) return;
        try {
            await snoozeConversation(selectedConversation.id, until, companyId);
            setSnoozeModalOpen(false);
            loadConversations();
            alert('✅ تم تأجيل المحادثة بنجاح');
        } catch (error) {
            alert('فشل في تأجيل المحادثة');
        }
    }, [selectedConversation, companyId, snoozeConversation, loadConversations]);

    // AI Toggle Handler
    const handleToggleAI = useCallback(async (enabled: boolean) => {
        if (!selectedConversation || !companyId) return;
        try {
            await toggleAI(selectedConversation.id, enabled);
            // Optimistic update or reload
            loadConversations(); // Reload to get fresh state including metadata
        } catch (error) {
            alert('فشل في تحديث حالة الذكاء الاصطناعي');
        }
    }, [selectedConversation, companyId, toggleAI, loadConversations]);

    // AI Typing State
    const [isAITyping, setIsAITyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [suggestedText, setSuggestedText] = useState('');

    // Socket.IO
    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleNewMessage = (data: any) => {
            if (selectedConversation && data.conversationId === selectedConversation.id) {
                addMessage(data);
                // Stop typing indicator when message arrives
                setIsAITyping(false);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            }
            loadConversations();
        };

        const handleAITyping = (data: { conversationId: string, isTyping: boolean }) => {
            if (selectedConversation && data.conversationId === selectedConversation.id) {
                setIsAITyping(data.isTyping);

                // Auto-hide after 15 seconds if no "stop" event received (safety net)
                if (data.isTyping) {
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                        setIsAITyping(false);
                    }, 15000);
                }
            }
        };

        socket.on('new_message', handleNewMessage);
        socket.on('ai_typing', handleAITyping);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('ai_typing', handleAITyping);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [socket, isConnected, selectedConversation, addMessage, loadConversations]);

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <div className="relative">
                <InboxHeader
                    pageName="صفحة الفيسبوك"
                    onSearch={setSearchQuery}
                    onToggleFilters={() => setShowFilters(!showFilters)}
                />
                <button
                    onClick={() => setShowStats(true)}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                    title="الإحصائيات"
                >
                    <BarChart3 className="w-5 h-5" />
                </button>
            </div>

            <InboxTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                counts={tabCounts}
            />

            <StatsDashboard
                isOpen={showStats}
                onClose={() => setShowStats(false)}
                conversations={conversations}
            />

            <ForwardModal
                isOpen={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                onForward={handleForward}
                conversations={conversations}
            />

            <SnoozeModal
                isOpen={snoozeModalOpen}
                onClose={() => setSnoozeModalOpen(false)}
                onSnooze={handleSnoozeConfirm}
            />

            <div className="flex flex-1 overflow-hidden relative">
                {/* Notes Panel Overlay */}
                {selectedConversation && (
                    <NotesPanel
                        customerId={selectedConversation.customerId}
                        isOpen={showNotes}
                        onClose={() => setShowNotes(false)}
                    />
                )}

                {/* Left: Conversations */}
                <div className="w-80 border-r border-gray-200 bg-white flex flex-col relative">
                    {/* Bulk Actions Bar Overlay */}
                    <BulkActionsBar
                        selectedCount={selectedIds.size}
                        onClearSelection={clearSelection}
                        onMarkAsDone={handleBulkMarkDone}
                        onAssign={handleBulkAssign}
                        onAddTags={handleBulkTags}
                    />

                    <FilterPanel
                        isOpen={showFilters}
                        filters={filters}
                        onFilterChange={setFilters}
                        onClose={() => setShowFilters(false)}
                        onReset={() => setFilters({
                            unreadOnly: false,
                            assignedTo: 'all',
                            startDate: null,
                            endDate: null
                        })}
                    />

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : error ? (
                            <div className="text-center p-8 text-red-500">{error}</div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="text-center p-8">
                                <div className="text-6xl mb-4">💬</div>
                                <p className="text-gray-600">لا توجد محادثات</p>
                            </div>
                        ) : (
                            <div>
                                {filteredConversations.map((conv) => (
                                    <ConversationItem
                                        key={conv.id}
                                        conversation={conv}
                                        isSelected={selectedConversation?.id === conv.id}
                                        isMultiSelected={selectedIds.has(conv.id)}
                                        onToggleSelection={(e) => {
                                            e.stopPropagation();
                                            toggleSelection(conv.id);
                                        }}
                                        onClick={() => selectConversation(conv)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center: Chat */}
                <div className="flex-1 flex flex-col bg-white">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="border-b border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        {selectedConversation.customerAvatar ? (
                                            <img
                                                src={selectedConversation.customerAvatar}
                                                alt={selectedConversation.customerName}
                                                className="w-10 h-10 rounded-full"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                                                {selectedConversation.customerName.charAt(0)}
                                            </div>
                                        )}

                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-900">
                                                {selectedConversation.customerName}
                                            </h2>
                                            {selectedConversation.pageName && (
                                                <p className="text-xs text-gray-500">{selectedConversation.pageName}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* AI Toggle */}
                                        <AIToggle
                                            enabled={selectedConversation.aiEnabled !== false} // Default to true if undefined
                                            onToggle={handleToggleAI}
                                            loading={updating}
                                        />

                                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                                        <button
                                            onClick={() => setShowNotes(!showNotes)}
                                            className={`p-2 rounded-full transition-colors ${showNotes ? 'bg-yellow-100 text-yellow-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                            title="الملاحظات"
                                        >
                                            <StickyNote size={20} />
                                        </button>
                                        <ConversationActionsBar
                                            isPriority={selectedConversation.priority}
                                            onTogglePriority={handleTogglePriority}
                                            onMarkDone={handleMarkDone}
                                            onSnooze={() => setSnoozeModalOpen(true)}
                                            disabled={updating}
                                        />
                                    </div>
                                </div>

                                {/* Status & Assignment */}
                                <div className="flex items-center gap-3">
                                    <StatusDropdown
                                        currentStatus={selectedConversation.status}
                                        onStatusChange={handleStatusChange}
                                        disabled={updating}
                                    />

                                    <AssignmentDropdown
                                        currentAssignee={selectedConversation.assignedTo}
                                        currentAssigneeName={selectedConversation.assignedToName}
                                        onAssign={handleAssignment}
                                        disabled={updating}
                                    />
                                </div>
                            </div>

                            {/* Messages */}
                            <div
                                className="flex-1 overflow-y-auto p-4 bg-gray-50"
                                ref={messagesContainerRef}
                                onScroll={handleScroll}
                            >
                                {loadingMessages && !hasMore ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : (
                                    <div>
                                        {/* Loading more indicator */}
                                        {loadingMessages && hasMore && (
                                            <div className="flex justify-center p-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                                            </div>
                                        )}

                                        {messages.length === 0 && !loadingMessages ? (
                                            <div className="flex items-center justify-center h-full py-10">
                                                <p className="text-gray-500">لا توجد رسائل</p>
                                            </div>
                                        ) : (
                                            messages.map((msg) => (
                                                <MessageBubble
                                                    key={msg.id}
                                                    message={msg}
                                                    onDelete={handleDeleteMessage}
                                                    onForward={handleForwardRequest}
                                                    onStar={handleStarMessage}
                                                    onReaction={handleMessageReaction}
                                                    onReply={handleReplyToMessage}
                                                    currentUserId={user?.id || ''}
                                                />
                                            ))
                                        )}

                                        {/* AI Typing Indicator */}
                                        {isAITyping && (
                                            <div className="mb-2">
                                                <TypingIndicator />
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            <AISuggestions
                                conversationId={selectedConversation.id}
                                onSelectSuggestion={(text) => {
                                    // Handle suggestion selection - maybe update input state?
                                    // Since MessageInput manages its own state, we might need a way to pass this down.
                                    // For now, let's assume we can pass a prop to MessageInput or use a ref.
                                    // Actually, let's just create a temporary state in FacebookInbox to pass to MessageInput?
                                    // Or better, let's modify MessageInput to accept an initialValue or value prop override.
                                    // BUT simplest is to let MessageInput handle it via a ref exposed or a context.
                                    // Let's pass a `suggestedText` state to MessageInput.
                                    setSuggestedText(text);
                                }}
                            />

                            <MessageInput
                                onSendMessage={handleSendMessage}
                                onSendFile={handleSendFile}
                                sending={sending}
                                uploadingFile={uploadingFile}
                                conversation={selectedConversation}
                                user={user}
                                replyTo={replyToMessage}
                                onCancelReply={handleCancelReply}
                                initialText={suggestedText}
                                onTextCleared={() => setSuggestedText('')}
                            />
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="text-6xl mb-4">💬</div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">اختر محادثة</h3>
                                <p className="text-sm text-gray-600">اختر محادثة من القائمة</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Customer Profile */}
                <div className="hidden xl:block">
                    {selectedConversation ? (
                        <CustomerProfile
                            conversation={selectedConversation}
                            onTagsChange={handleTagsChange}
                            updatingTags={updatingTags}
                        />
                    ) : (
                        <div className="w-80 h-full border-l border-gray-200 bg-white flex items-center justify-center text-gray-400">
                            <p className="text-sm">لا يوجد محادثة محددة</p>
                        </div>
                    )}
                </div>
            </div>

            {!isConnected && (
                <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-lg shadow-lg">
                    ⚠️ غير متصل
                </div>
            )}
        </div>
    );
};

export default FacebookInbox;

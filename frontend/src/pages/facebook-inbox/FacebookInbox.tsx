import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { StickyNote, Menu, ArrowRight } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

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
        // Conversations pagination
        hasMoreConversations,
        loadMoreConversations,
        // Update selected conversation
        updateSelectedConversation,
        // Selection
        selectedIds,
        toggleSelection,
        clearSelection,
        // 🆕 API counts for accurate tab counts
        apiCounts
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
    const [showSidebar, setShowSidebar] = useState(true); // للتحكم في إظهار/إخفاء Sidebar على الموبايل
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


    // 🆕 Reload conversations when tab changes (especially for unreplied)
    // Skip initial load since useInboxConversations already loads on mount
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            // First load is handled by the hook's initial state or we can force load here if needed.
            // But hook usually loads 'all'. If activeTab starts as 'all', we are good.
            // If activeTab can start as something else, we might need to load.
            // Current hook doesn't auto-load in useEffect, it waits for component.
            // Actually, the new hook has empty useEffect for initial load: useEffect(() => {}, []);
            // So we MUST load here even on initial mount if we want data.
            loadConversations(1, false, activeTab);
            return;
        }

        loadConversations(1, false, activeTab);
    }, [activeTab, loadConversations]);

    // Tab counts - use API counts for unreplied to get accurate total
    const tabCounts = useMemo(() => ({
        all: apiCounts.total || conversations.length,
        unreplied: apiCounts.unreplied || conversations.filter(c =>
            c.lastMessageIsFromCustomer === true &&
            c.status !== 'done' &&
            c.tab !== 'done'
        ).length,
        done: conversations.filter(c => c.tab === 'done').length,
        main: conversations.filter(c => c.tab === 'main').length,
        general: conversations.filter(c => c.tab === 'general').length,
        requests: conversations.filter(c => c.tab === 'requests').length,
        spam: conversations.filter(c => c.tab === 'spam').length,
    }), [conversations, apiCounts]);

    // Filtered conversations
    const filteredConversations = useMemo(() => {
        const filtered = conversations.filter(conv => {
            // 1. Tab filter - REMOVED (Server-side filtering now)
            // We assume 'conversations' contains only items for the current tab


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
        return filtered;
    }, [conversations, activeTab, searchQuery, filters, user?.id]);

    // Auto-scroll to bottom
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const prevMessagesLength = useRef(0);
    const oldScrollHeightRef = useRef(0);
    const wasAtBottomRef = useRef(true);

    // Scroll to bottom helper
    const scrollToBottom = useCallback((smooth = true) => {
        const container = messagesContainerRef.current;
        if (container) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }, []);

    // Check if user is at bottom of scroll
    const isAtBottom = useCallback((container: HTMLDivElement, threshold = 100) => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        return scrollHeight - scrollTop - clientHeight < threshold;
    }, []);

    // Scroll to bottom when conversation changes or initial load
    useEffect(() => {
        if (messages.length > 0 && selectedConversation) {
            // Always scroll to bottom when opening a conversation
            setTimeout(() => scrollToBottom(false), 100);
            wasAtBottomRef.current = true;
        }
    }, [selectedConversation?.id, scrollToBottom]);

    // Scroll to bottom on new messages if user was already at bottom
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container || messages.length === 0) return;

        // If new message was added (length increased) and user was at bottom
        if (messages.length > prevMessagesLength.current && wasAtBottomRef.current) {
            setTimeout(() => scrollToBottom(true), 50);
        }

        prevMessagesLength.current = messages.length;
    }, [messages.length, scrollToBottom]);

    // Handle scroll events - detect if user is at bottom and load more when scrolling up
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;

        // Check if at bottom
        wasAtBottomRef.current = isAtBottom(container);

        // Load more messages when scrolling to top
        if (container.scrollTop < 200 && hasMore && !loadingMessages) {
            const oldScrollHeight = container.scrollHeight;
            oldScrollHeightRef.current = oldScrollHeight;
            loadMoreMessages();
        }
    }, [hasMore, loadingMessages, loadMoreMessages, isAtBottom]);

    // Restore scroll position after loading older messages
    useLayoutEffect(() => {
        const container = messagesContainerRef.current;
        if (!container || !oldScrollHeightRef.current) return;

        // If messages increased and we were loading more (old scroll height exists)
        if (messages.length > prevMessagesLength.current && prevMessagesLength.current > 0) {
            const newScrollHeight = container.scrollHeight;
            const diff = newScrollHeight - oldScrollHeightRef.current;
            container.scrollTop = diff;
            oldScrollHeightRef.current = 0;
        }
    }, [messages.length]);


    // Send message handlers
    // Send message handlers
    const handleSendMessage = useCallback(async (content: string) => {
        if (!selectedConversation || !companyId) return;
        try {
            await sendTextMessage(selectedConversation.id, content, companyId, replyToMessage);
            setReplyToMessage(null); // Clear reply after sending

            // 🆕 Update conversation state - message is now from us (not customer)
            updateSelectedConversation({
                lastMessageIsFromCustomer: false,
                lastMessage: content.length > 100 ? content.substring(0, 100) + '...' : content,
                lastMessageTime: new Date()
            });

            loadMessages(selectedConversation.id);

            // 🆕 If in unreplied tab, reload conversations to get fresh data
            // This ensures we fetch new unreplied conversations to replace the one we just replied to
            if (activeTab === 'unreplied') {
                setTimeout(() => {
                    loadConversations(1, false, 'unreplied');
                }, 500); // Small delay to allow backend to update
            }
        } catch (error) {
            alert('فشل في إرسال الرسالة');
        }
    }, [selectedConversation, companyId, sendTextMessage, loadMessages, replyToMessage, updateSelectedConversation, activeTab, loadConversations]);

    const handleSendFile = useCallback(async (file: File) => {
        if (!selectedConversation || !companyId) return;
        try {
            await sendFileMessage(selectedConversation.id, file, companyId);

            // 🆕 Update conversation state - message is now from us (not customer)
            updateSelectedConversation({
                lastMessageIsFromCustomer: false,
                lastMessage: `📎 ${file.name}`,
                lastMessageTime: new Date()
            });

            loadMessages(selectedConversation.id);
            
            // 🆕 If in unreplied tab, reload conversations to get fresh data
            if (activeTab === 'unreplied') {
                setTimeout(() => {
                    loadConversations(1, false, 'unreplied');
                }, 500);
            }
        } catch (error) {
            alert('فشل في إرسال الملف');
        }
    }, [selectedConversation, companyId, sendFileMessage, loadMessages, updateSelectedConversation, activeTab, loadConversations]);

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
        if (!selectedConversation || !companyId) {
            return;
        }
        try {
            await toggleAI(selectedConversation.id, enabled);
            // Optimistic update or reload
            loadConversations(); // Reload to get fresh state including metadata
        } catch (error: any) {
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

    // Fetch post details when conversation is selected
    const fetchPostDetails = useCallback(async (conversationId: string) => {
        try {
            const response = await apiClient.get(`/conversations/${conversationId}/post-details`);

            if (response.data?.success && response.data?.data) {
                const postDetails = response.data.data;

                // Update selectedConversation with post details
                updateSelectedConversation({ postDetails });
            }
        } catch (error: any) {
            // Silently fail if 404 (post details not found) - it's optional
            if (error.response?.status !== 404) {
                console.error('Error fetching post details:', error);
            }
        }
    }, [updateSelectedConversation]);

    // Fetch post details when conversation with postId is selected
    useEffect(() => {
        if (selectedConversation?.postId && !selectedConversation?.postDetails) {
            fetchPostDetails(selectedConversation.id);
        }
    }, [selectedConversation?.id, selectedConversation?.postId, selectedConversation?.postDetails, fetchPostDetails]);

    // Calculate which customer messages have been replied to
    const repliedMessages = useMemo(() => {
        const repliedSet = new Set<string>();
        if (messages.length === 0) return repliedSet;

        // 🔧 FIX: Sort messages by timestamp (ascending - oldest first)
        const sortedMessages = [...messages].sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeA - timeB;
        });

        // 🔧 FIX: Track the last reply timestamp to handle multiple customer messages before a reply
        let lastReplyTime = 0;
        
        // For each customer message, check if there's a reply after it
        for (let i = 0; i < sortedMessages.length; i++) {
            const msg = sortedMessages[i];
            if (msg.isFromCustomer) {
                const msgTime = new Date(msg.timestamp).getTime();
                // Check if there's any non-customer message after this one
                for (let j = i + 1; j < sortedMessages.length; j++) {
                    const laterMsg = sortedMessages[j];
                    if (!laterMsg.isFromCustomer) {
                        // Found a reply after this customer message
                        repliedSet.add(msg.id);
                        lastReplyTime = Math.max(lastReplyTime, new Date(laterMsg.timestamp).getTime());
                        break;
                    }
                }
                // 🔧 FIX: Also mark as replied if this message is before the last reply we found
                if (lastReplyTime > 0 && msgTime < lastReplyTime) {
                    repliedSet.add(msg.id);
                }
            } else {
                // Update last reply time when we encounter a non-customer message
                lastReplyTime = Math.max(lastReplyTime, new Date(msg.timestamp).getTime());
            }
        }

        return repliedSet;
    }, [messages]);

    // إزالة padding و overflow من parent main element في Layout
    useEffect(() => {
        const mainElement = document.querySelector('main');
        if (mainElement) {
            // حفظ الـ classes الأصلية
            const originalClasses = mainElement.className;
            // إزالة padding و overflow وإضافة overflow-hidden و h-full
            mainElement.classList.remove('p-6', 'overflow-y-auto');
            mainElement.classList.add('p-0', 'overflow-hidden', 'flex-1', 'h-full');

            return () => {
                // استعادة الـ classes الأصلية عند إغلاق الصفحة
                mainElement.className = originalClasses;
            };
        }
    }, []);

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden w-full">
            <InboxTabs
                activeTab={activeTab}
                onTabChange={(newTab) => {
                    setActiveTab(newTab);
                }}
                counts={tabCounts}
                onSearch={setSearchQuery}
                onToggleFilters={() => setShowFilters(!showFilters)}
                onShowStats={() => setShowStats(true)}
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

                {/* Mobile Sidebar Overlay */}
                {showSidebar && (
                    <div
                        className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
                        onClick={() => setShowSidebar(false)}
                    />
                )}

                {/* Left: Conversations */}
                <div className={`
                    ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
                    md:translate-x-0
                    fixed md:relative
                    inset-y-0 left-0
                    w-full sm:w-80 md:w-72 lg:w-80
                    z-30
                    border-r border-gray-200 bg-white flex flex-col
                    transition-transform duration-300 ease-in-out
                `}>
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

                    <div
                        className="flex-1 overflow-y-auto"
                        onScroll={(e) => {
                            const target = e.currentTarget;
                            const { scrollTop, scrollHeight, clientHeight } = target;
                            // Load more when near bottom (within 200px)
                            if (scrollHeight - scrollTop - clientHeight < 200 && hasMoreConversations && !loading) {
                                loadMoreConversations();
                            }
                        }}
                    >
                        {loading && conversations.length === 0 ? (
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
                                {/* Deduplicate conversations by ID to prevent duplicate key warnings */}
                                {Array.from(
                                    new Map(filteredConversations.map(conv => [conv.id, conv])).values()
                                ).map((conv) => (
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
                                {/* Loading more conversations indicator */}
                                {loading && conversations.length > 0 && (
                                    <div className="flex justify-center p-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center: Chat */}
                <div className="flex-1 flex flex-col bg-white relative">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header - simplified, Status & Assignment moved to sidebar */}
                            <div className="border-b border-gray-200 p-2 sm:p-3">
                                <div className="flex items-center justify-between">
                                    {/* زر الرجوع للموبايل */}
                                    <button
                                        onClick={() => {
                                            setShowSidebar(true);
                                            selectConversation(null);
                                        }}
                                        className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="رجوع للمحادثات"
                                    >
                                        <ArrowRight size={20} className="text-gray-600" />
                                    </button>

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
                            </div>

                            {/* Messages Container - scrollable area, messages directly above input */}
                            <div
                                className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50 pb-4"
                                ref={messagesContainerRef}
                                onScroll={handleScroll}
                            >
                                {loadingMessages && !hasMore ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : messages.length === 0 && !loadingMessages ? (
                                    <div className="flex items-center justify-center h-full py-10">
                                        <p className="text-gray-500">لا توجد رسائل</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Loading more indicator at top when loading older messages */}
                                        {loadingMessages && hasMore && (
                                            <div className="flex justify-center p-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                                            </div>
                                        )}

                                        {/* Messages in normal order (oldest first, newest last) */}
                                        {Array.from(
                                            new Map(messages.map(msg => [msg.id, msg])).values()
                                        ).map((msg) => {
                                            const hasBeenReplied = msg.isFromCustomer ? repliedMessages.has(msg.id) : undefined;
                                            return (
                                                <MessageBubble
                                                    key={msg.id}
                                                    message={msg}
                                                    hasBeenReplied={hasBeenReplied}
                                                    onDelete={handleDeleteMessage}
                                                    onForward={handleForwardRequest}
                                                    onStar={handleStarMessage}
                                                    onReaction={handleMessageReaction}
                                                    onReply={handleReplyToMessage}
                                                    currentUserId={user?.id || ''}
                                                />
                                            );
                                        })}

                                        {/* AI Typing Indicator at bottom */}
                                        {isAITyping && (
                                            <div className="mt-2">
                                                <TypingIndicator />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Sticky bottom section - AI Suggestions + Message Input */}
                            <div className="sticky bottom-0 border-t border-gray-200 bg-white z-10 shadow-lg mt-auto">
                                <AISuggestions
                                    conversationId={selectedConversation.id}
                                    onSelectSuggestion={(text) => {
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
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                {/* زر فتح القائمة على الموبايل */}
                                <button
                                    onClick={() => setShowSidebar(true)}
                                    className="md:hidden mb-4 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                                    title="عرض المحادثات"
                                >
                                    <Menu size={24} />
                                </button>
                                <div className="text-6xl mb-4">💬</div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">اختر محادثة</h3>
                                <p className="text-sm text-gray-600">اختر محادثة من القائمة</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Customer Profile */}
                <div className="hidden xl:block h-full flex flex-col">
                    {selectedConversation ? (
                        <CustomerProfile
                            conversation={selectedConversation}
                            onTagsChange={handleTagsChange}
                            updatingTags={updatingTags}
                            currentStatus={selectedConversation.status}
                            onStatusChange={handleStatusChange}
                            currentAssignee={selectedConversation.assignedTo}
                            currentAssigneeName={selectedConversation.assignedToName}
                            onAssign={handleAssignment}
                            disabled={updating}
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

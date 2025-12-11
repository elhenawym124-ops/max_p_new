import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../useAuthSimple';
import { useCompany } from '../../contexts/CompanyContext';
import { apiClient } from '../../services/apiClient';
import { InboxConversation, InboxTab } from '../../types/inbox.types';

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
}

export const useInboxConversations = () => {
    const { user } = useAuth();
    const { companyId } = useCompany();

    const [conversations, setConversations] = useState<InboxConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<InboxConversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const currentConversationIdRef = useRef<string | null>(null);

    // Safe date parser
    const safeDate = (date: any): Date => {
        if (!date) return new Date();
        try {
            const parsed = new Date(date);
            if (isNaN(parsed.getTime())) {
                return new Date();
            }
            return parsed;
        } catch (e) {
            return new Date();
        }
    };

    // Load conversations
    const loadConversations = useCallback(async () => {
        if (!companyId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await apiClient.get(`/conversations`, {
                params: {
                    companyId,
                    limit: 200,
                    page: 1
                }
            });

            const data = response.data?.data || response.data || [];

            const formattedConversations: InboxConversation[] = data.map((conv: any) => ({
                id: conv.id,
                customerId: conv.customerId,
                customerName: conv.customer?.name || conv.customerName || 'عميل',
                customerAvatar: conv.customer?.avatar || conv.customerAvatar,
                lastMessage: conv.lastMessage || 'لا توجد رسائل',
                lastMessageTime: safeDate(conv.lastMessageTime || conv.updatedAt),
                unreadCount: conv.unreadCount || 0,
                platform: 'facebook' as const,

                // Inbox fields (defaults for now)
                tab: (conv.tab || 'all') as InboxTab,
                status: conv.status || 'open',
                assignedTo: conv.assignedTo || null,
                tags: conv.tags || [],
                priority: conv.priority || false,
                snoozedUntil: conv.snoozedUntil ? safeDate(conv.snoozedUntil) : null,
                archived: conv.archived || false,
                muted: conv.muted || false,
                lastStatusChange: safeDate(conv.lastStatusChange || conv.updatedAt),
                firstResponseTime: conv.firstResponseTime || null,
                avgResponseTime: conv.avgResponseTime || null,

                // Existing fields
                pageName: conv.pageName,
                pageId: conv.pageId,
                aiEnabled: conv.aiEnabled,
                lastMessageIsFromCustomer: conv.lastMessageIsFromCustomer,
                hasUnreadMessages: conv.hasUnreadMessages,
            }));

            setConversations(formattedConversations);

        } catch (err: any) {
            console.error('❌ Error loading conversations:', err);
            setError(err.message || 'فشل في تحميل المحادثات');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    // Load messages for a conversation
    const loadMessages = useCallback(async (conversationId: string, pageNum = 1) => {
        if (!conversationId || !companyId) return;

        // Prevent race conditions and duplicates
        if (pageNum === 1) {
            currentConversationIdRef.current = conversationId;
            setMessages([]); // Clear previous messages immediately if switching
        } else if (currentConversationIdRef.current !== conversationId) {
            return;
        }

        try {
            setLoadingMessages(true);

            const response = await apiClient.get(`/conversations/${conversationId}/messages`, {
                params: {
                    companyId,
                    page: pageNum,
                    limit: 50
                }
            });

            // Check if conversation changed during fetch
            if (currentConversationIdRef.current !== conversationId) {
                console.log('⚠️ Conversation changed, aborting type 2');
                return;
            }

            const result = response.data || {};
            const data = result.data || result || [];
            const pagination = result.pagination || {};

            setHasMore(pagination.hasMore || false);
            setPage(pageNum);

            const formattedMessages: Message[] = data.map((msg: any) => {
                let isAiGenerated = false;
                let md: any = null;

                if (msg.metadata) {
                    try {
                        md = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                        isAiGenerated = md.isAIGenerated || md.isAutoGenerated || md.source === 'ai_agent' || false;
                    } catch (e) {
                        console.warn('⚠️ Failed to parse metadata:', msg.id);
                    }
                }

                // Determine sender name
                let senderName = 'العميل';
                if (!msg.isFromCustomer) {
                    if (isAiGenerated) {
                        senderName = 'الذكاء الاصطناعي';
                    } else if (md?.employeeName) {
                        senderName = md.employeeName;
                    } else if (msg.sender?.name && msg.sender.name !== 'موظف') {
                        senderName = msg.sender.name;
                    } else {
                        senderName = 'موظف';
                    }
                }

                return {
                    id: msg.id,
                    content: msg.content,
                    senderId: msg.sender?.id || msg.senderId || 'unknown',
                    senderName,
                    timestamp: safeDate(msg.timestamp || msg.createdAt),
                    type: msg.type || 'text',
                    isFromCustomer: msg.isFromCustomer,
                    status: 'delivered',
                    conversationId: msg.conversationId,
                    fileUrl: msg.fileUrl,
                    fileName: msg.fileName,
                    fileSize: msg.fileSize,
                    isAiGenerated,
                };
            });

            if (pageNum === 1) {
                setMessages(formattedMessages);
            } else {
                setMessages(prev => [...formattedMessages, ...prev]);
            }

        } catch (err: any) {
            console.error('❌ Error loading messages:', err);
            setError(err.message || 'فشل في تحميل الرسائل');
        } finally {
            setLoadingMessages(false);
        }
    }, [companyId]);

    const loadMoreMessages = useCallback(() => {
        if (selectedConversation && hasMore && !loadingMessages) {
            loadMessages(selectedConversation.id, page + 1);
        }
    }, [selectedConversation, hasMore, loadingMessages, page, loadMessages]);

    // Select conversation and load its messages
    const selectConversation = useCallback((conversation: InboxConversation | null) => {
        setSelectedConversation(conversation);
        if (conversation) {
            loadMessages(conversation.id);
        } else {
            setMessages([]);
            currentConversationIdRef.current = null;
        }
    }, [loadMessages]);

    // Initial load
    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback((ids: string[]) => {
        setSelectedIds(new Set(ids));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    // Manually add a message (e.g. from socket)
    const addMessage = useCallback((newMessage: any) => {
        setMessages(prev => {
            // Check for duplicates
            if (prev.some(m => m.id === newMessage.id)) return prev;

            // Format if needed
            // Ideally we share the formatter OR we assume the socket data is already formatted or we do minimal
            // Since socket data usually matches API structure:
            const msg = newMessage;
            // We need to match the Message interface structure.
            // If we just append, let's hope it's compatible.
            // For safety, let's map it.

            let isAiGenerated = false;
            let md: any = null;
            if (msg.metadata) {
                try {
                    md = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                    isAiGenerated = md.isAIGenerated || md.isAutoGenerated || md.source === 'ai_agent' || false;
                } catch (e) {
                    // ignore
                }
            }

            let senderName = 'العميل';
            if (!msg.isFromCustomer) {
                if (isAiGenerated) {
                    senderName = 'الذكاء الاصطناعي';
                } else if (md?.employeeName) {
                    senderName = md.employeeName;
                } else if (msg.sender?.name && msg.sender.name !== 'موظف') {
                    senderName = msg.sender.name;
                } else {
                    senderName = 'موظف';
                }
            }

            const formatted: Message = {
                id: msg.id,
                content: msg.content,
                senderId: msg.sender?.id || msg.senderId || 'unknown',
                senderName,
                timestamp: new Date(msg.timestamp || msg.createdAt || Date.now()),
                type: msg.type || 'text',
                isFromCustomer: msg.isFromCustomer,
                status: 'delivered',
                conversationId: msg.conversationId,
                fileUrl: msg.fileUrl,
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                isAiGenerated,
            };

            return [...prev, formatted];
        });
    }, []);

    return {
        conversations,
        selectedConversation,
        messages,
        loading,
        loadingMessages,
        error,
        selectConversation,
        loadConversations,
        loadMessages,
        loadMoreMessages,
        addMessage,
        hasMore,
        // Selection exports
        selectedIds,
        toggleSelection,
        selectAll,
        clearSelection
    };
};

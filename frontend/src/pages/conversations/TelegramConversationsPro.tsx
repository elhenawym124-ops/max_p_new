import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuthSimple';
import useSocket from '../../hooks/useSocket';
import { companyAwareApi } from '../../services/companyAwareApi';
import {
    Send, Paperclip, Smile, MoreVertical,
    Search, Phone, Check, CheckCheck,
    MessageCircle, Bot, Settings,
    User, MapPin, File, Image as ImageIcon,
    Reply, Forward, Trash2, Mic, X
} from 'lucide-react';

// --- Types ---
interface Message {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location';
    isFromCustomer: boolean;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    conversationId: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    isAiGenerated?: boolean;
}

interface Conversation {
    id: string;
    customerId: string;
    customerName: string;
    customerAvatar?: string;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    platform: 'telegram';
    isOnline: boolean;
    messages: Message[];
    telegramBotId?: string;
}

const TelegramConversationsPro: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const { socket, isConnected } = useSocket();

    // State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isInfoOpen, setIsInfoOpen] = useState(true); // Right sidebar toggle

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filtered Conversations
    const filteredConversations = conversations.filter(c =>
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeConversation = conversations.find(c => c.id === selectedConversationId);

    // --- Effects ---

    // 1. Load Conversations
    useEffect(() => {
        if (!isAuthenticated || !user?.companyId) return;

        const fetchConversations = async () => {
            try {
                setLoading(true);
                const response = await companyAwareApi.getConversations({
                    page: 1,
                    limit: 50,
                    platform: 'telegram'
                });

                if (response.data && response.data.data) {
                    const formatted = response.data.data.map((c: any) => ({
                        id: c.id,
                        customerId: c.customerId,
                        customerName: c.customerName || 'Telegram User',
                        lastMessage: c.lastMessage || '',
                        lastMessageTime: new Date(c.lastMessageTime || Date.now()),
                        unreadCount: c.unreadCount || 0,
                        platform: 'telegram',
                        isOnline: false,
                        messages: []
                    }));
                    setConversations(formatted);
                }
            } catch (error) {
                console.error("Failed to load Telegram conversations:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [isAuthenticated, user?.companyId]);

    // 2. Load Messages
    useEffect(() => {
        if (!selectedConversationId) return;

        const fetchMessages = async () => {
            try {
                const response = await companyAwareApi.get(`/conversations/${selectedConversationId}/messages`);
                const data = response.data.data || [];

                const loadedMessages: Message[] = data.map((msg: any) => ({
                    id: msg.id,
                    content: msg.content,
                    senderId: msg.senderId || 'unknown',
                    senderName: msg.isFromCustomer ? 'Customer' : 'Agent',
                    timestamp: new Date(msg.createdAt || Date.now()),
                    type: (msg.type || 'text').toLowerCase(),
                    isFromCustomer: msg.isFromCustomer,
                    status: 'read',
                    conversationId: selectedConversationId,
                    fileUrl: msg.fileUrl,
                    fileName: msg.fileName
                }));

                setMessages(loadedMessages.reverse());
            } catch (error) {
                console.error("Failed to load messages:", error);
            }
        };

        fetchMessages();
    }, [selectedConversationId]);

    // 3. Socket
    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleNewMessage = (data: any) => {
            if (data.platform !== 'telegram' && data.channel !== 'TELEGRAM') return;
            if (data.companyId !== user?.companyId) return;

            setConversations(prev => {
                const exists = prev.find(c => c.id === data.conversationId);
                if (exists) {
                    return prev.map(c => c.id === data.conversationId ? {
                        ...c,
                        lastMessage: data.content,
                        lastMessageTime: new Date(),
                        unreadCount: data.conversationId === selectedConversationId ? 0 : (c.unreadCount + 1)
                    } : c);
                }
                return prev;
            });

            if (selectedConversationId === data.conversationId) {
                const newMsg: Message = {
                    id: data.id || Date.now().toString(),
                    content: data.content,
                    senderId: data.senderId,
                    senderName: data.senderName,
                    timestamp: new Date(),
                    type: data.type || 'text',
                    isFromCustomer: data.isFromCustomer,
                    status: 'delivered',
                    conversationId: data.conversationId,
                    fileUrl: data.fileUrl
                };
                setMessages(prev => [...prev, newMsg]);
                setTimeout(scrollToBottom, 100);
            }
        };

        socket.on('new_message', handleNewMessage);
        return () => socket.off('new_message', handleNewMessage);
    }, [socket, isConnected, selectedConversationId, user?.companyId]);

    // Handlers
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async () => {
        if (!selectedConversationId || !inputText.trim()) return;

        const tempId = Date.now().toString();
        const tempMsg: Message = {
            id: tempId,
            content: inputText,
            senderId: user?.id || 'me',
            senderName: 'Me',
            timestamp: new Date(),
            type: 'text',
            isFromCustomer: false,
            status: 'sent',
            conversationId: selectedConversationId
        };

        setMessages(prev => [...prev, tempMsg]);
        setInputText('');
        setTimeout(scrollToBottom, 100);

        try {
            await companyAwareApi.post(`/conversations/${selectedConversationId}/messages`, {
                message: tempMsg.content,
                type: 'text'
            });
        } catch (error) {
            console.error("Failed to send:", error);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            // Placeholder: In a real app, this would upload to S3/Server
            console.log("File selected:", e.target.files[0].name);
            alert("File upload feature coming soon!");
        }
    };

    // --- Render ---
    return (
        <div className="flex h-[calc(100vh-64px)] bg-[#f0f2f5] overflow-hidden direction-rtl">

            {/* LEFT SIDEBAR: Conversations List (350px) */}
            <div className="w-[350px] bg-white border-r border-gray-200 flex flex-col shrink-0 z-20">
                {/* Header */}
                <div className="p-4 bg-[#2AABEE] text-white flex justify-between items-center shadow-sm">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Bot size={20} />
                        Telegram Chats
                    </h2>
                    <div className="flex gap-2">
                        <Settings size={18} className="cursor-pointer opacity-80 hover:opacity-100" />
                    </div>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-gray-100">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search chats..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-[#2AABEE] transition-all"
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400 flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AABEE] mb-2"></div>
                            Loading...
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                            {searchQuery ? 'No results found' : 'No conversations found'}
                        </div>
                    ) : (
                        filteredConversations.map(conv => (
                            <div
                                key={conv.id}
                                onClick={() => setSelectedConversationId(conv.id)}
                                className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-blue-50 transition-colors
                                    ${selectedConversationId === conv.id ? 'bg-blue-100 border-l-4 border-l-[#2AABEE]' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-gray-800 text-sm truncate">{conv.customerName}</h3>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                        {conv.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{conv.lastMessage}</p>
                                    {conv.unreadCount > 0 && (
                                        <span className="bg-[#2AABEE] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                                            {conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* MIDDLE: Chat Area (Flexible) */}
            <div className="flex-1 flex flex-col bg-[#8EBFD4] bg-opacity-10 relative">
                {/* Chat Background Pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none"></div>

                {selectedConversationId && activeConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center z-10 shadow-sm px-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                                    {activeConversation.customerName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 pointer-events-none">
                                        {activeConversation.customerName}
                                    </h3>
                                    <p className="text-xs text-[#2AABEE] flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        bot subscriber
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500">
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Search in chat">
                                    <Search size={20} />
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Call (Coming Soon)">
                                    <Phone size={20} />
                                </button>
                                <button
                                    className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${isInfoOpen ? 'text-[#2AABEE] bg-blue-50' : ''}`}
                                    onClick={() => setIsInfoOpen(!isInfoOpen)}
                                    title="Toggle Info"
                                >
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 z-10 custom-scrollbar">
                            {messages.map((msg, idx) => {
                                const isMe = !msg.isFromCustomer;
                                return (
                                    <div
                                        key={idx}
                                        className={`group flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}
                                    >
                                        <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm relative group-hover:shadow-md transition-shadow
                                            ${isMe ? 'bg-[#E3F2FD] rounded-tr-none' : 'bg-white rounded-tl-none'}
                                        `}>
                                            {/* Header used for group chats, generally not needed for 1-on-1 but good for style */}
                                            {!isMe && <p className="text-[10px] text-blue-500 font-bold mb-1 opacity-80">{msg.senderName}</p>}

                                            {/* Media Rendering */}
                                            {msg.type === 'image' && (
                                                <div className="mb-2 relative rounded-lg overflow-hidden border border-gray-100">
                                                    <img src={msg.fileUrl} alt="attachment" className="max-w-xs max-h-64 object-cover" />
                                                </div>
                                            )}

                                            {/* Text Content */}
                                            {msg.content && (
                                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed min-w-[120px]">
                                                    {msg.content}
                                                </p>
                                            )}

                                            {/* Footer (Time + Status) */}
                                            <div className="flex justify-end items-center gap-1 mt-1 select-none">
                                                <span className="text-[10px] text-gray-400">
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isMe && (
                                                    msg.status === 'read' ? <CheckCheck size={14} className="text-[#2AABEE]" /> : <Check size={14} className="text-gray-400" />
                                                )}
                                            </div>

                                            {/* Message Actions (Hover) - Visual Placeholder */}
                                            <div className={`absolute top-0 ${isMe ? '-left-20' : '-right-20'} h-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1`}>
                                                <button className="p-1.5 bg-white rounded-full shadow text-gray-500 hover:text-[#2AABEE]" title="Reply">
                                                    <Reply size={14} />
                                                </button>
                                                <button className="p-1.5 bg-white rounded-full shadow text-gray-500 hover:text-[#2AABEE]" title="Forward">
                                                    <Forward size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-gray-200 z-10 px-4 py-4">
                            <div className="flex items-end gap-2 max-w-4xl mx-auto">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                <button
                                    className="p-3 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach File"
                                >
                                    <Paperclip size={24} />
                                </button>

                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex items-center px-4 py-2 focus-within:ring-2 focus-within:ring-[#2AABEE] focus-within:bg-white transition-all">
                                    <input
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Write a message..."
                                        className="w-full bg-transparent border-none focus:ring-0 text-gray-800 placeholder-gray-400 leading-relaxed"
                                    />
                                    <Smile size={20} className="text-gray-400 cursor-pointer hover:text-gray-600 ml-2" />
                                </div>

                                {inputText.trim() ? (
                                    <button
                                        onClick={handleSendMessage}
                                        className="p-3 bg-[#2AABEE] text-white rounded-full shadow-lg hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center transform"
                                    >
                                        <Send size={20} className="ml-0.5" />
                                    </button>
                                ) : (
                                    <button
                                        className="p-3 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
                                        title="Record Voice (Coming Soon)"
                                    >
                                        <Mic size={24} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 select-none">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <MessageCircle size={48} className="text-gray-200" />
                        </div>
                        <p className="text-lg font-medium text-gray-400">Select a chat to start messaging</p>
                        <p className="text-sm mt-2 max-w-xs text-center">Use the search bar on the left to find specific customers.</p>
                    </div>
                )}
            </div>

            {/* RIGHT SIDEBAR: Info/CRM (300px) */}
            {selectedConversationId && activeConversation && isInfoOpen && (
                <div className="w-[300px] bg-white border-l border-gray-200 flex flex-col z-20 shadow-lg animate-in slide-in-from-right duration-300">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">UserInfo</h3>
                        <button onClick={() => setIsInfoOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                        {/* Avatar */}
                        <div className="flex flex-col items-center">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2AABEE] to-blue-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg mb-3">
                                {activeConversation.customerName.charAt(0).toUpperCase()}
                            </div>
                            <h2 className="text-lg font-bold text-gray-800 text-center">{activeConversation.customerName}</h2>
                            <p className="text-sm text-gray-500">@{activeConversation.customerName.replace(/\s/g, '').toLowerCase()}</p>
                            <span className="mt-2 text-xs bg-blue-50 text-[#2AABEE] px-2 py-1 rounded-full font-medium">
                                Telegram User
                            </span>
                        </div>

                        {/* Info List */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-gray-600">
                                <Phone size={18} className="text-gray-400" />
                                <span className="text-sm">+20 10XXXX XXXX</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-600">
                                <Bot size={18} className="text-gray-400" />
                                <span className="text-sm text-wrap break-all">{activeConversation.customerId}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-600">
                                <MapPin size={18} className="text-gray-400" />
                                <span className="text-sm">Egypt (Approx.)</span>
                            </div>
                        </div>

                        {/* Shared Media Section */}
                        <div className="pt-4 border-t border-gray-100">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Shared Media</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                                    <ImageIcon className="text-gray-300" size={20} />
                                </div>
                                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                                    <ImageIcon className="text-gray-300" size={20} />
                                </div>
                                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                                    <File className="text-gray-300" size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t border-gray-100 space-y-2">
                            <button className="w-full py-2 flex items-center justify-center gap-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium">
                                <Trash2 size={16} />
                                Delete Conversation
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TelegramConversationsPro;

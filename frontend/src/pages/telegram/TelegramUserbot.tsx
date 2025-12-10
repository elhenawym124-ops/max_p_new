import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuthSimple';
import axios from 'axios';
import {
    PaperAirplaneIcon,
    ChatBubbleLeftRightIcon,
    ArrowPathIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline';

interface Chat {
    id: string;
    name: string;
    unreadCount: number;
    lastMessage: string;
    date: number;
    isGroup: boolean;
    isUser: boolean;
    isChannel: boolean;
}

interface Message {
    id: number | string;
    text: string;
    date: number;
    senderId: string | null;
    senderName?: string;
    isOut: boolean;
    media: boolean | null;
}

const TelegramUserbot: React.FC = () => {
    const { user } = useAuth();
    const [step, setStep] = useState<'SELECT' | 'LOGIN' | 'VERIFY' | 'CHATS'>('SELECT');
    
    // Userbot Selection
    const [userbots, setUserbots] = useState<any[]>([]);
    const [selectedUserbot, setSelectedUserbot] = useState<string | null>(null);

    // Login Form
    const [phoneNumber, setPhoneNumber] = useState('');
    const [phoneCode, setPhoneCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Chats & Messages
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');

    // Auto-scroll ref
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3007'}/api/userbot`;
    const TELEGRAM_API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3007'}/api/v1/telegram`;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load userbots on mount
    useEffect(() => {
        if (user?.companyId) {
            loadUserbots();
        }
    }, [user?.companyId]);

    // Auto-fetch chats when userbot is selected and step is CHATS (for auto-login)
    useEffect(() => {
        if (selectedUserbot && step === 'CHATS' && chats.length === 0) {
            console.log('🔄 Auto-fetching chats for logged in userbot:', selectedUserbot);
            fetchChats();
        }
    }, [selectedUserbot, step]);

    const loadUserbots = async () => {
        if (!user?.companyId) return;
        
        try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            if (!token) {
                setError('Authentication required');
                return;
            }
            
            const response = await axios.get(`${TELEGRAM_API_URL}/userbots`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const userbotsList = response.data?.data || response.data || [];
            setUserbots(Array.isArray(userbotsList) ? userbotsList : []);
            
            // Check if any userbot is already logged in (has active session)
            const loggedInUserbot = userbotsList.find((ub: any) => 
                ub.sessionString && ub.isActive && ub.clientPhone
            );
            
            if (loggedInUserbot) {
                // Userbot is already logged in, go directly to chats
                console.log('✅ Found logged in userbot:', loggedInUserbot.id);
                setSelectedUserbot(loggedInUserbot.id);
                setStep('CHATS');
                // Note: fetchChats will be called by useEffect when selectedUserbot and step are set
            } else if (userbotsList.length === 1 && userbotsList[0]?.id) {
                // Only one userbot, auto-select it
                const singleUserbot = userbotsList[0];
                setSelectedUserbot(singleUserbot.id);
                // Check if it's already connected
                if (singleUserbot.sessionString && singleUserbot.isActive && singleUserbot.clientPhone) {
                    setStep('CHATS');
                } else {
                    setStep('LOGIN');
                }
            } else if (userbotsList.length > 0) {
                // Multiple userbots, show selection screen
                setStep('SELECT');
            } else {
                // No userbots, show selection screen (which will show "add userbot" message)
                setStep('SELECT');
            }
        } catch (error: any) {
            console.error('Failed to load userbots:', error);
            if (error.response?.status === 404) {
                // No userbots configured yet - this is OK
                setUserbots([]);
                setStep('SELECT');
            } else {
                setError(error.response?.data?.error || 'Failed to load userbots. Please add a userbot in Settings first.');
            }
        }
    };

    // 1. Send Login Code
    const handleSendCode = async () => {
        if (!selectedUserbot) {
            setError('Please select a userbot first');
            return;
        }
        
        setIsLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            await axios.post(`${API_URL}/login`, {
                userbotConfigId: selectedUserbot,
                phoneNumber
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setStep('VERIFY');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send code');
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Verify Code
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [password, setPassword] = useState('');

    const handleVerify = async () => {
        if (!selectedUserbot) {
            setError('Please select a userbot first');
            return;
        }
        
        setIsLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            const response = await axios.post(`${API_URL}/verify`, {
                userbotConfigId: selectedUserbot,
                code: phoneCode,
                password: requiresPassword ? password : undefined
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.data.requiresPassword) {
                setRequiresPassword(true);
                setError('Two-factor authentication is enabled. Please enter your password.');
            } else {
                setStep('CHATS');
                fetchChats();
            }
        } catch (err: any) {
            if (err.response?.data?.requiresPassword) {
                setRequiresPassword(true);
                setError('Two-factor authentication is enabled. Please enter your password.');
            } else {
                setError(err.response?.data?.error || 'Verification failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Fetch Chats
    const fetchChats = async () => {
        if (!selectedUserbot) {
            console.warn('⚠️ Cannot fetch chats: no userbot selected');
            return;
        }
        
        try {
            console.log('📥 Fetching chats for userbot:', selectedUserbot);
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            if (!token) {
                setError('Authentication token missing');
                return;
            }
            
            const res = await axios.get(`${API_URL}/dialogs?userbotConfigId=${selectedUserbot}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.data.success) {
                console.log('✅ Chats fetched:', res.data.data?.length || 0);
                setChats(res.data.data || []);
                setStep('CHATS');
            } else {
                console.error('❌ Failed to fetch chats:', res.data.error);
                
                // Check if session expired
                if (res.data.error === 'AUTH_KEY_UNREGISTERED' || res.data.requiresReauth) {
                    setError('Session expired. Please login again.');
                    setStep('LOGIN');
                    // Clear any cached userbot selection
                    setSelectedUserbot(null);
                } else {
                    setError(res.data.error || res.data.message || 'Failed to fetch chats');
                }
            }
        } catch (err: any) {
            console.error('❌ Failed to fetch chats:', err);
            const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to fetch chats';
            
            // Check if it's an auth error
            if (errorMessage.includes('AUTH_KEY_UNREGISTERED') || err.response?.data?.requiresReauth) {
                setError('Session expired. Please login again.');
                setStep('LOGIN');
                setSelectedUserbot(null);
            } else {
                setError(errorMessage);
                if (step === 'CHATS') {
                    // If we're already on CHATS step, maybe session expired
                    console.warn('⚠️ Session might be expired, redirecting to login');
                    setStep('LOGIN');
                }
            }
        }
    };

    // 4. Fetch Messages
    useEffect(() => {
        if (!selectedChat || !user?.companyId) return;

        const fetchMessages = async () => {
            if (!selectedUserbot) return;
            
            try {
                const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/messages?userbotConfigId=${selectedUserbot}&chatId=${selectedChat.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                // Sort messages by date (oldest first) before setting
                const sortedMessages = (res.data.data || []).sort((a: Message, b: Message) => a.date - b.date);
                setMessages(sortedMessages);
            } catch (err) {
                console.error("Failed to fetch messages", err);
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 3000); // Polling every 3s
        return () => clearInterval(interval);
    }, [selectedChat, user?.companyId]);

    // Check session on mount
    useEffect(() => {
        if (user?.companyId) {
            fetchChats();
        }
    }, [user?.companyId]);

    // 5. Send Message
    const handleSendMessage = async () => {
        if (!selectedChat || !messageText.trim() || !selectedUserbot) return;

        try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            await axios.post(`${API_URL}/message`, {
                userbotConfigId: selectedUserbot,
                chatId: selectedChat.id,
                message: messageText
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Optimistic update
            const newMessage: Message = {
                id: Date.now(),
                text: messageText,
                date: Math.floor(Date.now() / 1000),
                senderId: "me",
                isOut: true,
                media: false
            };
            setMessages(prev => [...prev, newMessage]);
            setMessageText('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // 6. Logout
    const handleLogout = async () => {
        if (!selectedUserbot) return;
        if (!confirm('Are you sure you want to disconnect?')) return;
        try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            await axios.post(`${API_URL}/logout`, {
                userbotConfigId: selectedUserbot
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setStep('SELECT');
            setChats([]);
            setSelectedChat(null);
            setSelectedUserbot(null);
        } catch (err) {
            console.error(err);
        }
    };

    // 7. Send File
    const handleSendFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedChat || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        const formData = new FormData();
        formData.append('file', file);
        formData.append('userbotConfigId', selectedUserbot || '');
        formData.append('chatId', selectedChat.id);

        try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            await axios.post(`${API_URL}/message/file`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });
            // Optimistic Update (Text only placeholder)
            const newMessage: Message = {
                id: Date.now(),
                text: `[File: ${file.name}]`,
                date: Math.floor(Date.now() / 1000),
                senderId: "me",
                isOut: true,
                media: true
            };
            setMessages(prev => [...prev, newMessage]);
        } catch (err: any) {
            alert('Failed to upload: ' + err.message);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <PaperAirplaneIcon className="h-8 w-8 text-blue-500" />
                        Telegram Userbot
                    </h1>
                    <p className="text-gray-500">Connect your personal Telegram account</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 flex items-start">
                    <ExclamationCircleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <div className="font-semibold mb-1">{error}</div>
                        {error.includes('API credentials') && (
                            <div className="text-sm text-red-500 mt-2">
                                💡 <strong>الحل:</strong> أضف API ID و API Hash في <a href="/settings?tab=telegram" className="underline">Telegram Settings</a>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'SELECT' && (
                <div className="flex-1 flex justify-center items-center">
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">اختر حساب Telegram Userbot</h2>
                        {!userbots || userbots.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500 mb-4">لا توجد حسابات Userbot مضافة</p>
                                <a href="/settings/telegram" className="text-blue-600 hover:underline inline-block mt-4 px-4 py-2 bg-blue-50 rounded-lg">
                                    ➕ أضف حساب Userbot من الإعدادات
                                </a>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-500 mb-4">اختر الحساب الذي تريد الاتصال به:</p>
                                {Array.isArray(userbots) && userbots.map((userbot: any) => {
                                    if (!userbot || !userbot.id) return null;
                                    const isConnected = userbot.sessionString && userbot.isActive && userbot.clientPhone;
                                    return (
                                        <button
                                            key={userbot.id}
                                            onClick={() => {
                                                setSelectedUserbot(userbot.id);
                                                if (isConnected) {
                                                    setStep('CHATS');
                                                    // fetchChats will be called by useEffect
                                                } else {
                                                    setStep('LOGIN');
                                                }
                                            }}
                                            className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                                        >
                                            <div className="font-semibold flex items-center justify-between">
                                                <span>{userbot.label || 'Unnamed Userbot'}</span>
                                                {isConnected && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                        متصل
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {userbot.clientPhone || 'غير متصل'}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'LOGIN' && (
                <div className="flex-1 flex justify-center items-center">
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Log in with Phone</h2>
                        <input
                            type="text"
                            placeholder="+201xxxxxxxxx"
                            className="w-full p-3 border rounded-lg mb-4"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                        />
                        <button
                            onClick={handleSendCode}
                            disabled={isLoading}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isLoading ? 'Sending...' : 'Send Code'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'VERIFY' && (
                <div className="flex-1 flex justify-center items-center">
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {requiresPassword ? 'Enter Password (2FA)' : 'Enter Code'}
                        </h2>
                        {!requiresPassword ? (
                            <>
                                <input
                                    type="text"
                                    placeholder="12345"
                                    className="w-full p-3 border rounded-lg mb-4"
                                    value={phoneCode}
                                    onChange={e => setPhoneCode(e.target.value)}
                                />
                                <button
                                    onClick={handleVerify}
                                    disabled={isLoading}
                                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {isLoading ? 'Verifying...' : 'Verify & Login'}
                                </button>
                            </>
                        ) : (
                            <>
                                <input
                                    type="password"
                                    placeholder="Enter your 2FA password"
                                    className="w-full p-3 border rounded-lg mb-4"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <button
                                    onClick={handleVerify}
                                    disabled={isLoading || !password}
                                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {isLoading ? 'Verifying...' : 'Verify with Password'}
                                </button>
                            </>
                        )}
                        <button onClick={() => {
                            setStep('LOGIN');
                            setRequiresPassword(false);
                            setPassword('');
                        }} className="w-full mt-2 text-gray-500">Back</button>
                    </div>
                </div>
            )}

            {step === 'CHATS' && (
                <div className="flex-1 flex bg-white rounded-xl shadow-lg overflow-hidden border">
                    {/* Sidebar */}
                    <div className="w-80 border-r flex flex-col bg-gray-50">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold">Chats</h3>
                            <button onClick={fetchChats} className="p-1 hover:bg-gray-200 rounded">
                                <ArrowPathIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {/* Logout Button */}
                        <div className="px-4 pb-2">
                            <button
                                onClick={handleLogout}
                                className="text-xs text-red-500 hover:underline w-full text-left"
                            >
                                Logout / Disconnect
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {chats.map(chat => (
                                <div
                                    key={chat.id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`p-3 border-b cursor-pointer hover:bg-white transition-colors ${selectedChat?.id === chat.id ? 'bg-blue-50 border-blue-200' : ''}`}
                                >
                                    <div className="flex justify-between mb-1">
                                        <span className="font-semibold truncate">{chat.name}</span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(chat.date * 1000).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="text-sm text-gray-500 truncate w-4/5">
                                            {chat.lastMessage}
                                        </div>
                                        {chat.unreadCount > 0 && (
                                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                                                {chat.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col bg-slate-50">
                        {selectedChat ? (
                            <>
                                <div className="p-4 bg-white border-b shadow-sm flex-none">
                                    <h3 className="font-bold text-lg">{selectedChat.name}</h3>
                                </div>

                                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                                    {messages
                                        .sort((a, b) => a.date - b.date) // Sort by date (oldest first)
                                        .map((msg, index) => (
                                        <div key={`${msg.id}-${index}`} className={`flex ${msg.isOut ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-lg shadow-sm ${msg.isOut ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
                                                }`}>
                                                {/* Sender name for incoming messages */}
                                                {!msg.isOut && msg.senderName && (
                                                    <div className={`text-xs font-semibold mb-1 ${msg.isOut ? 'text-blue-200' : 'text-gray-600'}`}>
                                                        {msg.senderName}
                                                    </div>
                                                )}
                                                {msg.media && <div className="text-xs opacity-75 mb-1">[Media]</div>}
                                                <div className="break-words">{msg.text}</div>
                                                <div className={`text-[10px] mt-1 flex justify-between items-center ${msg.isOut ? 'text-blue-200' : 'text-gray-400'}`}>
                                                    <span>{new Date(msg.date * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {msg.isOut && <span className="ml-2">✓</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="p-4 bg-white border-t flex gap-2 flex-none items-center">
                                    <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-full text-gray-500">
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={handleSendFile}
                                        />
                                        <span className="text-xl">📎</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="flex-1 border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Type a message..."
                                        value={messageText}
                                        onChange={e => setMessageText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                                    >
                                        <PaperAirplaneIcon className="h-6 w-6" />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center items-center text-gray-400">
                                <ChatBubbleLeftRightIcon className="h-20 w-20 mb-4 opacity-20" />
                                <p>Select a chat to view conversation</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TelegramUserbot;

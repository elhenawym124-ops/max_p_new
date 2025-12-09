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
    id: number;
    text: string;
    date: number;
    senderId: string;
    isOut: boolean;
    media: boolean;
}

const TelegramUserbot: React.FC = () => {
    const { user } = useAuth();
    const [step, setStep] = useState<'LOGIN' | 'VERIFY' | 'CHATS'>('LOGIN');

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 1. Send Login Code
    const handleSendCode = async () => {
        setIsLoading(true);
        setError('');
        try {
            await axios.post(`${API_URL}/login`, {
                companyId: user?.companyId,
                phoneNumber
            });
            setStep('VERIFY');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send code');
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Verify Code
    const handleVerify = async () => {
        setIsLoading(true);
        setError('');
        try {
            await axios.post(`${API_URL}/verify`, {
                companyId: user?.companyId,
                code: phoneCode
            });
            setStep('CHATS');
            fetchChats();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Fetch Chats
    const fetchChats = async () => {
        try {
            const res = await axios.get(`${API_URL}/dialogs?companyId=${user?.companyId}`);
            setChats(res.data.data);
            setStep('CHATS');
        } catch (err) {
            console.error(err);
            if (step === 'CHATS') setError('Failed to fetch chats.');
        }
    };

    // 4. Fetch Messages
    useEffect(() => {
        if (!selectedChat || !user?.companyId) return;

        const fetchMessages = async () => {
            try {
                const res = await axios.get(`${API_URL}/messages?companyId=${user?.companyId}&chatId=${selectedChat.id}`);
                setMessages(res.data.data);
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
        if (!selectedChat || !messageText.trim()) return;

        try {
            await axios.post(`${API_URL}/message`, {
                companyId: user?.companyId,
                chatId: selectedChat.id,
                message: messageText
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
        if (!confirm('Are you sure you want to disconnect?')) return;
        try {
            await axios.post(`${API_URL}/logout`, { companyId: user?.companyId });
            setStep('LOGIN');
            setChats([]);
            setSelectedChat(null);
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
        formData.append('companyId', user?.companyId || '');
        formData.append('chatId', selectedChat.id);

        try {
            await axios.post(`${API_URL}/message/file`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
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
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 flex items-center">
                    <ExclamationCircleIcon className="h-5 w-5 mr-2" />
                    {error}
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
                        <h2 className="text-xl font-bold mb-4">Enter Code</h2>
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
                        <button onClick={() => setStep('LOGIN')} className="w-full mt-2 text-gray-500">Back</button>
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
                                    {messages.map((msg, index) => (
                                        <div key={`${msg.id}-${index}`} className={`flex ${msg.isOut ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-lg shadow-sm ${msg.isOut ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
                                                }`}>
                                                {msg.media && <div className="text-xs opacity-75 mb-1">[Media]</div>}
                                                <div className="break-words">{msg.text}</div>
                                                <div className={`text-[10px] mt-1 text-right ${msg.isOut ? 'text-blue-200' : 'text-gray-400'}`}>
                                                    {new Date(msg.date * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

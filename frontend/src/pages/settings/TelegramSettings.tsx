import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuthSimple';
import { telegramService } from '../../services/telegramService';
import { toast } from 'react-hot-toast';
import { PaperAirplaneIcon, CpuChipIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

const TelegramSettings = () => {
    const { user } = useAuth();
    const [bots, setBots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    // Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newBotToken, setNewBotToken] = useState('');
    const [newBotLabel, setNewBotLabel] = useState('');

    useEffect(() => {
        if (user?.companyId) {
            checkStatus();
        }
    }, [user?.companyId]);

    const checkStatus = async () => {
        if (!user?.companyId) return;
        try {
            setIsChecking(true);
            const data = await telegramService.getStatus(user.companyId);
            // API returns { bots: [] }
            setBots(data.bots || []);
        } catch (error) {
            console.error('Failed to fetch status:', error);
            toast.error('Failed to load bots');
        } finally {
            setIsChecking(false);
        }
    };

    const handleConnect = async () => {
        if (!newBotToken) {
            toast.error('Please enter a Bot Token');
            return;
        }

        if (!user?.companyId) return;

        try {
            setIsLoading(true);
            await telegramService.connectBot(user.companyId, newBotToken, newBotLabel);
            toast.success('Telegram Bot Connected Successfully!');
            setNewBotToken('');
            setNewBotLabel('');
            setShowAddForm(false);
            checkStatus();
        } catch (error: any) {
            toast.error('Connection Failed: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisconnect = async (configId: string) => {
        if (!window.confirm('Are you sure you want to disconnect this bot?')) return;
        if (!user?.companyId) return;

        try {
            setIsLoading(true);
            await telegramService.disconnectBot(user.companyId, configId);
            toast.success('Bot Disconnected');
            checkStatus();
        } catch (error: any) {
            toast.error('Disconnect Failed: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsLoading(false);
        }
    };

    if (isChecking) {
        return <div className="p-8 text-center">Loading Telegram Status...</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <PaperAirplaneIcon className="w-10 h-10 text-sky-500 transform -rotate-45" />
                    <h1 className="text-3xl font-bold text-gray-800">Telegram Integration</h1>
                </div>
                {!showAddForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
                    >
                        <span>+ Add New Bot</span>
                    </button>
                )}
            </div>

            {/* Helper Text */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                <p className="text-blue-800 text-sm">
                    Connect your Telegram Bots to manage support, sales, or other channels.
                    Create bots via <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="font-semibold underline">@BotFather</a>.
                </p>
            </div>

            {/* List of Bots */}
            <div className="space-y-4 mb-8">
                {bots.length === 0 && !showAddForm && (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                        <CpuChipIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No Bots Connected</h3>
                        <p className="text-gray-500 mb-4">Add your first bot to get started.</p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="text-blue-600 font-medium hover:underline"
                        >
                            Connect a Bot
                        </button>
                    </div>
                )}

                {bots.map((bot) => (
                    <div key={bot.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-sky-100 text-sky-600 rounded-full">
                                <CpuChipIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">{bot.label}</h3>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span>@{bot.username || 'unknown_bot'}</span>
                                    {bot.running ? (
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Running</span>
                                    ) : (
                                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">Stopped</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => handleDisconnect(bot.id)}
                            disabled={isLoading}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors border border-gray-200 hover:border-red-100 text-sm"
                        >
                            Disconnect
                        </button>
                    </div>
                ))}
            </div>

            {/* Add Bot Form */}
            {showAddForm && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Connect New Bot</h2>
                        <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Label (Optional)</label>
                            <input
                                type="text"
                                value={newBotLabel}
                                onChange={(e) => setNewBotLabel(e.target.value)}
                                placeholder="e.g. Sales Bot, Support Team"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bot API Token</label>
                            <input
                                type="text"
                                value={newBotToken}
                                onChange={(e) => setNewBotToken(e.target.value)}
                                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleConnect}
                                disabled={isLoading || !newBotToken}
                                className={`flex-1 py-3 rounded-lg font-medium text-white transition-all ${isLoading || !newBotToken
                                    ? 'bg-blue-300 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-md'
                                    }`}
                            >
                                {isLoading ? 'Connecting...' : 'Connect Bot'}
                            </button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                disabled={isLoading}
                                className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TelegramSettings;

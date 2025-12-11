import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { InboxConversation } from '../../types/inbox.types';
import { XMarkIcon } from '@heroicons/react/24/outline';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

interface StatsDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    conversations: InboxConversation[];
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({ isOpen, onClose, conversations }) => {
    if (!isOpen) return null;

    // 1. Status Distribution
    const statusData = useMemo(() => {
        const counts = {
            open: 0,
            pending: 0,
            resolved: 0,
            done: 0
        };
        conversations.forEach(c => {
            if (counts[c.status] !== undefined) {
                counts[c.status]++;
            }
        });

        return {
            labels: ['مفتوحة', 'معلقة', 'تم الحل', 'منتهية'],
            datasets: [
                {
                    label: 'توزيع الحالات',
                    data: [counts.open, counts.pending, counts.resolved, counts.done],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.6)', // Blue
                        'rgba(245, 158, 11, 0.6)', // Yellow
                        'rgba(16, 185, 129, 0.6)', // Green
                        'rgba(107, 114, 128, 0.6)', // Gray
                    ],
                    borderColor: [
                        'rgba(59, 130, 246, 1)',
                        'rgba(245, 158, 11, 1)',
                        'rgba(16, 185, 129, 1)',
                        'rgba(107, 114, 128, 1)',
                    ],
                    borderWidth: 1,
                },
            ],
        };
    }, [conversations]);

    // 2. Volume by Time (Mock logic based on lastMessageTime)
    const volumeData = useMemo(() => {
        const today = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(today.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const counts = last7Days.map(date => {
            return conversations.filter(c =>
                new Date(c.lastMessageTime).toISOString().split('T')[0] === date
            ).length;
        });

        return {
            labels: last7Days.map(d => d.slice(5)), // MM-DD
            datasets: [
                {
                    label: 'نشاط المحادثات (آخر 7 أيام)',
                    data: counts,
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                },
            ],
        };
    }, [conversations]);

    // 3. Team Performance (Assigned conversations)
    const teamData = useMemo(() => {
        const assigneeCounts: Record<string, number> = {};
        conversations.forEach(c => {
            const name = c.assignedToName || 'غير معين';
            assigneeCounts[name] = (assigneeCounts[name] || 0) + 1;
        });

        return {
            labels: Object.keys(assigneeCounts),
            datasets: [
                {
                    label: 'المحادثات المعينة',
                    data: Object.values(assigneeCounts),
                    backgroundColor: 'rgba(236, 72, 153, 0.5)',
                },
            ],
        };
    }, [conversations]);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-gray-800">📊 إحصائيات المحادثات</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <XMarkIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                    {/* Status Chart */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-lg font-medium mb-4 text-center">حالة المحادثات</h3>
                        <div className="h-64 flex justify-center">
                            <Doughnut data={statusData} options={{ maintainAspectRatio: false }} />
                        </div>
                    </div>

                    {/* Volume Chart */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-lg font-medium mb-4 text-center">النشاط اليومي</h3>
                        <div className="h-64">
                            <Bar
                                data={volumeData}
                                options={{
                                    maintainAspectRatio: false,
                                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                                }}
                            />
                        </div>
                    </div>

                    {/* Team Performance */}
                    <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                        <h3 className="text-lg font-medium mb-4 text-center">أداء الفريق (التعيينات)</h3>
                        <div className="h-64">
                            <Bar
                                data={teamData}
                                options={{
                                    maintainAspectRatio: false,
                                    indexAxis: 'y',
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsDashboard;

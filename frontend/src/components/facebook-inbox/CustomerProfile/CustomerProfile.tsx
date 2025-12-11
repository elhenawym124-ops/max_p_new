import React, { useEffect, useState } from 'react';
import { User, Phone, Mail, Clock, ShoppingBag, Activity, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { useCustomerProfile } from '../../../hooks/inbox/useCustomerProfile';
import { useCompany } from '../../../contexts/CompanyContext';
import { InboxConversation } from '../../types/inbox.types';
import TagInput from '../TagInput/TagInput';

interface CustomerProfileProps {
    conversation: InboxConversation;
    onTagsChange: (tags: string[]) => void;
    updatingTags: boolean;
}

type Tab = 'info' | 'orders' | 'timeline';

const CustomerProfile: React.FC<CustomerProfileProps> = ({
    conversation,
    onTagsChange,
    updatingTags
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('info');
    const {
        orders,
        activities,
        loading,
        loadCustomerData,
        calculateLTV,

        customer // Add customer to destructured object
    } = useCustomerProfile();
    const { company } = useCompany(); // Get company context for currency

    useEffect(() => {
        if (conversation?.customerId) {
            loadCustomerData(conversation.customerId);
        }
    }, [conversation?.customerId, loadCustomerData]);

    const ltv = calculateLTV();

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-80">
            {/* Header / Avatar */}
            <div className="p-6 text-center border-b border-gray-100">
                {conversation.customerAvatar ? (
                    <img
                        src={conversation.customerAvatar}
                        alt={conversation.customerName}
                        className="w-20 h-20 rounded-full mx-auto mb-3 object-cover border-2 border-gray-100 shadow-sm"
                    />
                ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3 shadow-md">
                        {conversation.customerName.charAt(0)}
                    </div>
                )}
                <h3 className="text-lg font-bold text-gray-900">{conversation.customerName}</h3>
                <p className="text-xs text-gray-500 mt-1">عميل منذ {format(new Date(), 'yyyy')}</p>

                {/* Quick Stats */}
                <div className="flex justify-center gap-4 mt-4 text-sm">
                    <div className="text-center">
                        <p className="text-gray-400 text-xs">الطلبات</p>
                        <p className="font-semibold text-gray-800">{orders.length}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-xs">القيمة</p>
                        <p className="font-semibold text-green-600">{ltv.toLocaleString()} {company?.currency || 'ر.س'}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <span className="flex items-center justify-center gap-1">
                        <User size={16} /> معلومات
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'orders' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <span className="flex items-center justify-center gap-1">
                        <ShoppingBag size={16} /> طلبات
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('timeline')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'timeline' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <span className="flex items-center justify-center gap-1">
                        <Activity size={16} /> نشاط
                    </span>
                </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <>
                        {/* INFO TAB */}
                        {activeTab === 'info' && (
                            <div className="space-y-6">
                                {/* Contact Info */}
                                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">التواصل</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm">
                                            <Phone size={16} className="text-gray-400" />
                                            <span className="text-gray-700 font-medium font-mono" dir="ltr">
                                                {customer?.phone || 'غير متوفر'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Mail size={16} className="text-gray-400" />
                                            <span className="text-gray-700 truncate">{customer?.email || 'غير متوفر'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Tags */}
                                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">التصنيفات</h4>
                                    <TagInput
                                        conversationId={conversation.id}
                                        currentTags={conversation.tags}
                                        onTagsChange={onTagsChange}
                                        disabled={updatingTags}
                                    />
                                </div>

                                {/* Metadata / Custom Fields */}
                                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">بيانات أخرى</h4>
                                    <div className="text-sm space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">المنصة:</span>
                                            <span className="font-medium capitalize">{conversation.platform}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">آخر ظهور:</span>
                                            <span className="font-medium">
                                                {format(new Date(conversation.lastMessageTime), 'MMM d, HH:mm', { locale: arSA })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ORDERS TAB */}
                        {activeTab === 'orders' && (
                            <div className="space-y-4">
                                {orders.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <ShoppingBag size={48} className="mx-auto mb-2 opacity-20" />
                                        <p>لا توجد طلبات سابقة</p>
                                    </div>
                                ) : (
                                    orders.map((order) => (
                                        <div key={order.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-bold text-gray-800">#{order.orderNumber}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {format(new Date(order.createdAt), 'dd MMM yyyy', { locale: arSA })}
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-1 text-xs rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-end border-t border-gray-50 pt-2 mt-2">
                                                <span className="text-xs text-gray-500">{order.items.length} منتجات</span>
                                                <span className="font-bold text-blue-600">{order.total} {company?.currency || 'ر.س'}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TIMELINE TAB */}
                        {activeTab === 'timeline' && (
                            <div className="relative pl-4 border-r-2 border-gray-200 space-y-6 mr-2">
                                {/* Using marginRight and borderRight for RTL timeline effect */}
                                {activities.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 pr-4">
                                        <Clock size={48} className="mx-auto mb-2 opacity-20" />
                                        <p>لا يوجد نشاط مسجل</p>
                                    </div>
                                ) : (
                                    activities.map((activity) => (
                                        <div key={activity.id} className="relative pr-6">
                                            <div className="absolute -right-[29px] top-1 w-3 h-3 rounded-full bg-blue-400 border-2 border-white ring-2 ring-gray-100"></div>
                                            <p className="text-sm font-medium text-gray-800">{activity.description}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {format(new Date(activity.createdAt), 'dd MMM, HH:mm', { locale: arSA })}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Action Button */}
            <div className="p-4 border-t border-gray-200 bg-white">
                <button className="w-full py-2 bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors text-sm">
                    عرض الملف الكامل
                </button>
            </div>
        </div>
    );
};

export default CustomerProfile;

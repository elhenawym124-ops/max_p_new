import React, { useEffect, useState } from 'react';
import { User, Phone, Mail, Clock, ShoppingBag, Activity, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { useCustomerProfile } from '../../../hooks/inbox/useCustomerProfile';
import { useCompany } from '../../../contexts/CompanyContext';
import { InboxConversation } from '../../types/inbox.types';
import TagInput from '../TagInput/TagInput';
import { apiClient } from '../../../services/apiClient';

import StatusDropdown from '../StatusDropdown/StatusDropdown';
import AssignmentDropdown from '../AssignmentDropdown/AssignmentDropdown';

interface CustomerProfileProps {
    conversation: InboxConversation;
    onTagsChange: (tags: string[]) => void;
    updatingTags: boolean;
    currentStatus?: string;
    onStatusChange?: (status: string) => void;
    currentAssignee?: string | null;
    currentAssigneeName?: string | null;
    onAssign?: (userId: string | null) => void;
    disabled?: boolean;
}

type Tab = 'info' | 'orders' | 'timeline';

const CustomerProfile: React.FC<CustomerProfileProps> = ({
    conversation,
    onTagsChange,
    updatingTags,
    currentStatus,
    onStatusChange,
    currentAssignee,
    currentAssigneeName,
    onAssign,
    disabled = false
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('timeline');
    const [syncingMessages, setSyncingMessages] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
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

    const handleSyncMessages = async () => {
        if (!conversation?.id || conversation.platform !== 'facebook') {
            return;
        }

        setSyncingMessages(true);
        setSyncMessage(null);

        try {
            // Increase timeout for sync operation (can take longer due to Facebook API calls)
            const response = await apiClient.post(`/conversations/${conversation.id}/sync-messages`, {}, {
                timeout: 90000 // 90 seconds timeout for sync operation
            });
            
            if (response.data.success) {
                setSyncMessage(`✅ ${response.data.message || 'تم جلب الرسائل بنجاح'}`);
                // Reload customer data to refresh activities
                if (conversation.customerId) {
                    loadCustomerData(conversation.customerId);
                }
            } else {
                setSyncMessage(`❌ ${response.data.message || 'فشل في جلب الرسائل'}`);
            }
        } catch (error: any) {
            console.error('Error syncing messages:', error);
            const errorMessage = error.response?.data?.message || 
                                error.response?.data?.error || 
                                error.message || 
                                'حدث خطأ أثناء جلب الرسائل';
            const errorInfo = error.response?.data?.info ? ` (${error.response.data.info})` : '';
            setSyncMessage(`❌ ${errorMessage}${errorInfo}`);
        } finally {
            setSyncingMessages(false);
            // Clear message after 5 seconds
            setTimeout(() => {
                setSyncMessage(null);
            }, 5000);
        }
    };

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
                
                {/* Page Name - Always show for Facebook conversations */}
                {conversation.platform === 'facebook' && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                        {conversation.pageName || 'Facebook'}
                    </p>
                )}

                {/* Quick Stats */}
                <div className="flex justify-center gap-4 mt-4 text-sm">
                    <div className="text-center">
                        <p className="text-gray-400 text-xs">الطلبات</p>
                        <p className="font-semibold text-gray-800">{orders.length}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400 text-xs">القيمة</p>
                        <p className="font-semibold text-green-600">{ltv.toLocaleString()} ج.م</p>
                    </div>
                </div>

                {/* Status & Assignment - moved from header */}
                {(onStatusChange || onAssign) && (
                    <div className="px-4 pt-4 border-t border-gray-100 space-y-2">
                        {onStatusChange && (
                            <StatusDropdown
                                currentStatus={currentStatus || conversation.status}
                                onStatusChange={onStatusChange}
                                disabled={disabled}
                            />
                        )}
                        {onAssign && (
                            <AssignmentDropdown
                                currentAssignee={currentAssignee ?? conversation.assignedTo}
                                currentAssigneeName={currentAssigneeName ?? conversation.assignedToName}
                                onAssign={onAssign}
                                disabled={disabled}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('timeline')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'timeline' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <span className="flex items-center justify-center gap-1">
                        <Activity size={16} /> نشاط
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
                    onClick={() => setActiveTab('info')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <span className="flex items-center justify-center gap-1">
                        <User size={16} /> معلومات
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
                                        {(customer?.email && !customer.email.endsWith('@example.com')) && (
                                            <div className="flex items-center gap-3 text-sm">
                                                <Mail size={16} className="text-gray-400" />
                                                <span className="text-gray-700 truncate">{customer.email}</span>
                                            </div>
                                        )}
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
                                                <span className="font-bold text-blue-600">{order.total} ج.م</span>
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
                                
                                {/* Sync Facebook Messages Button - Only for Facebook conversations */}
                                {conversation.platform === 'facebook' && (
                                    <div className="relative pr-6 mb-4">
                                        <div className="absolute -right-[29px] top-1 w-3 h-3 rounded-full bg-green-400 border-2 border-white ring-2 ring-gray-100"></div>
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-green-800 mb-1">
                                                        جلب الرسائل من Facebook
                                                    </p>
                                                    <p className="text-xs text-green-600">
                                                        احضر جميع الرسائل القديمة للمحادثة من Facebook
                                                    </p>
                                                    {syncMessage && (
                                                        <p className={`text-xs mt-2 ${syncMessage.includes('✅') ? 'text-green-700' : 'text-red-700'}`}>
                                                            {syncMessage}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={handleSyncMessages}
                                                    disabled={syncingMessages}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                                        syncingMessages
                                                            ? 'bg-green-200 text-green-600 cursor-not-allowed'
                                                            : 'bg-green-600 text-white hover:bg-green-700'
                                                    }`}
                                                >
                                                    <RefreshCw 
                                                        size={16} 
                                                        className={syncingMessages ? 'animate-spin' : ''} 
                                                    />
                                                    {syncingMessages ? 'جاري الجلب...' : 'جلب الرسائل'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Post Details Section - Show if postId exists */}
                                {conversation.postId && (
                                    <div className="relative pr-6 mb-4">
                                        <div className="absolute -right-[29px] top-1 w-3 h-3 rounded-full bg-purple-400 border-2 border-white ring-2 ring-gray-100"></div>
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                            <div className="flex items-start space-x-2 space-x-reverse mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-2 text-sm mb-1">
                                                        <span className="text-purple-700 font-semibold">📌 جاء من منشور</span>
                                                        {!conversation.postDetails && (
                                                            <span className="text-xs text-purple-500">جاري تحميل التفاصيل...</span>
                                                        )}
                                                        {conversation.postDetails?.permalinkUrl && (
                                                            <a
                                                                href={conversation.postDetails.permalinkUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-purple-600 hover:text-purple-800 text-xs underline flex items-center space-x-1"
                                                            >
                                                                <span>عرض المنشور</span>
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                </svg>
                                                            </a>
                                                        )}
                                                    </div>
                                                    {conversation.postDetails?.message && (
                                                        <p className="text-xs text-purple-800 mb-2 line-clamp-3">
                                                            {conversation.postDetails.message}
                                                        </p>
                                                    )}
                                                    {conversation.postDetails?.hasImages && conversation.postDetails?.imageUrls && conversation.postDetails.imageUrls.length > 0 && (
                                                        <div className="flex space-x-1 space-x-reverse mb-2">
                                                            {conversation.postDetails.imageUrls.slice(0, 3).map((imageUrl, idx) => (
                                                                <img
                                                                    key={idx}
                                                                    src={imageUrl}
                                                                    alt={`Post image ${idx + 1}`}
                                                                    className="w-12 h-12 object-cover rounded border border-purple-200"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            ))}
                                                            {conversation.postDetails.imageUrls.length > 3 && (
                                                                <div className="w-12 h-12 bg-purple-100 border border-purple-200 rounded flex items-center justify-center text-xs text-purple-700 font-medium">
                                                                    +{conversation.postDetails.imageUrls.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-purple-600 mt-1">
                                                        Post ID: {conversation.postId.substring(0, 20)}...
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activities.length === 0 && !conversation.postId ? (
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
        </div>
    );
};

export default CustomerProfile;

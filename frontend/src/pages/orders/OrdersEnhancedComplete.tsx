import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCurrency } from '../../hooks/useCurrency';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useAuth } from '../../hooks/useAuthSimple';
import EnhancedOrderModal from '../../components/orders/EnhancedOrderModal';
import {
  ShoppingBagIcon,
  EyeIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  StarIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface EnhancedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  city?: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  paymentMethod: string;
  items: Array<{
    id: string;
    productId?: string;
    productName: string;
    productColor?: string;
    productSize?: string;
    price: number;
    quantity: number;
    total: number;
    confidence?: number;
    extractionSource?: string;
  }>;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  
  // Enhanced fields
  confidence?: number;
  extractionMethod?: string;
  validationStatus?: string;
  sourceType?: string;
  dataQuality?: any;
  
  // Relations
  conversationId?: string;
  customerId: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    facebookId?: string;
  };
  conversation?: {
    id: string;
    status: string;
    channel: string;
  };
  
  createdAt: string;
  updatedAt: string;
  extractionTimestamp?: string;
  notes?: string;
}

const OrdersEnhancedComplete: React.FC = () => {
  console.log('🚀🚀🚀 OrdersEnhanced Component LOADED - NEW VERSION WITH BUTTONS! 🚀🚀🚀');

  const [orders, setOrders] = useState<EnhancedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<EnhancedOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: '',
    extractionMethod: '',
    minConfidence: '',
    search: '',
    page: 1,
    limit: 20,
    dateFrom: '',
    dateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const { formatPrice } = useCurrency();
  const { formatDate } = useDateFormat();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    console.log('🔄 OrdersEnhanced: Component loaded with updated buttons');

    // انتظار انتهاء تحميل المصادقة
    if (authLoading) {
      console.log('⏳ Waiting for auth to load...');
      return;
    }

    // التحقق من المصادقة
    if (!isAuthenticated) {
      console.log('❌ User not authenticated, redirecting to login...');
      window.location.href = '/auth/login';
      return;
    }

    console.log('✅ User authenticated, fetching orders...');
    fetchOrders();
    fetchStats();
  }, [filters, authLoading, isAuthenticated]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3007/api/v1';

      const queryParams = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus }),
        ...(filters.search && { search: filters.search }),
      });

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${apiUrl}/orders-enhanced?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (data.success) {
        console.log('📊 Orders data received:', data.data);
        // تسجيل عينة من البيانات للتحقق من بنية العميل
        if (data.data.length > 0) {
          console.log('📋 Sample order structure:', {
            id: data.data[0].id,
            customerName: data.data[0].customerName,
            customer: data.data[0].customer,
            conversationId: data.data[0].conversationId
          });
        }
        setOrders(data.data);
      } else {
        console.error('فشل في جلب الطلبات:', data.message);
      }
    } catch (error) {
      console.error('خطأ في جلب الطلبات:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3007/api/v1';
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${apiUrl}/orders-enhanced/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('خطأ في جلب الإحصائيات:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string, notes?: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3007/api/v1';
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${apiUrl}/orders-enhanced/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, notes }),
      });

      const data = await response.json();

      if (data.success) {
        fetchOrders(); // إعادة تحميل الطلبات
      } else {
        alert('فشل في تحديث حالة الطلب');
      }
    } catch (error) {
      console.error('خطأ في تحديث حالة الطلب:', error);
      alert('حدث خطأ أثناء تحديث حالة الطلب');
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'في الانتظار',
      'CONFIRMED': 'مؤكد',
      'PROCESSING': 'قيد المعالجة',
      'SHIPPED': 'تم الشحن',
      'DELIVERED': 'تم التسليم',
      'CANCELLED': 'ملغي'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'PROCESSING':
        return 'bg-indigo-100 text-indigo-800';
      case 'SHIPPED':
        return 'bg-purple-100 text-purple-800';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <ClockIcon className="h-3 w-3" />;
      case 'CONFIRMED':
        return <CheckCircleIcon className="h-3 w-3" />;
      case 'PROCESSING':
        return <TruckIcon className="h-3 w-3" />;
      case 'SHIPPED':
        return <TruckIcon className="h-3 w-3" />;
      case 'DELIVERED':
        return <CheckCircleIcon className="h-3 w-3" />;
      case 'CANCELLED':
        return <XCircleIcon className="h-3 w-3" />;
      default:
        return <ClockIcon className="h-3 w-3" />;
    }
  };

  const getCustomerDisplayName = (order: EnhancedOrder) => {
    // أولاً: إذا كان لدينا معلومات العميل من قاعدة البيانات
    if (order.customer) {
      const fullName = `${order.customer.firstName} ${order.customer.lastName}`.trim();
      // إذا كان الاسم ليس افتراضي، استخدمه
      if (fullName !== 'عميل جديد' && fullName !== 'عميل غير محدد' && fullName !== 'عميل') {
        return fullName;
      }
    }

    // ثانياً: إذا كان لدينا اسم من الـ AI المستخرج من المحادثة
    if (order.customerName &&
        !order.customerName.match(/^\d+/) &&
        order.customerName !== 'عميل جديد' &&
        order.customerName !== 'عميل غير محدد' &&
        order.customerName !== 'عميل' &&
        order.customerName.length > 2) {
      return order.customerName;
    }

    // ثالثاً: إذا كان Facebook ID، اجعله أكثر وضوحاً
    if (order.customerName && order.customerName.match(/^\d+/)) {
      return `عميل فيسبوك (${order.customerName.substring(0, 8)}...)`;
    }

    // رابعاً: إذا كان لدينا رقم هاتف، استخدمه
    if (order.customerPhone) {
      return `عميل (${order.customerPhone})`;
    }

    // خامساً: إذا كان لدينا معرف المحادثة، أظهره
    if (order.conversationId) {
      return `عميل من محادثة (${order.conversationId.substring(0, 8)}...)`;
    }

    return 'عميل غير محدد';
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'bg-gray-100 text-gray-800';
    
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <ShoppingBagIcon className="h-8 w-8 text-indigo-600 mr-3" />
              🚀 الطلبات المحسنة - محدثة
            </h1>
            <p className="mt-2 text-gray-600">
              ✨ طلبات محسنة بالذكاء الاصطناعي مع تقييم جودة البيانات
            </p>
          </div>
          <div className="flex space-x-3 space-x-reverse">
            <Link
              to="/orders"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              النظام القديم
            </Link>
            <Link
              to="/orders/stats"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <ChartBarIcon className="h-5 w-5 mr-2" />
              الإحصائيات
            </Link>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            قائمة الطلبات ({orders.length})
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            طلبات محسنة مع تقييم جودة البيانات ومعلومات الاستخراج
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBagIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">لا توجد طلبات</h3>
            <p className="mt-1 text-sm text-gray-500">
              لم يتم العثور على طلبات تطابق المعايير المحددة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    رقم الطلب
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    العميل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المبلغ الإجمالي
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    حالة الطلب
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    تاريخ الطلب
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.orderNumber} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </div>
                      {order.extractionMethod && (
                        <div className="text-xs text-gray-500">
                          {order.extractionMethod === 'ai_enhanced' ? '🤖 ذكاء محسن' :
                           order.extractionMethod === 'ai_basic' ? '🤖 ذكاء أساسي' :
                           order.extractionMethod === 'manual' ? '✋ يدوي' : order.extractionMethod}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {getCustomerDisplayName(order)}
                      </div>
                      {order.customerPhone && (
                        <div className="text-sm text-gray-500">
                          {order.customerPhone}
                        </div>
                      )}
                      {order.city && (
                        <div className="text-xs text-gray-400">
                          {order.city}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPrice(order.total)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.items?.length || 0} منتج
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="mr-1">{getStatusText(order.status)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 space-x-reverse">
                        <Link
                          to={`/orders/details/${order.orderNumber}`}
                          className="text-indigo-600 hover:text-indigo-900 flex items-center"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          <span className="text-xs">تفاصيل</span>
                        </Link>

                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-900 flex items-center"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          <span className="text-xs">سريع</span>
                        </button>

                        {order.conversationId && (
                          <button
                            onClick={() => {
                              const url = `/conversations-improved?conversationId=${order.conversationId}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            className="text-blue-600 hover:text-blue-900 flex items-center cursor-pointer"
                          >
                            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                            <span className="text-xs">محادثة</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <EnhancedOrderModal
          order={selectedOrder}
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
};

export default OrdersEnhancedComplete;

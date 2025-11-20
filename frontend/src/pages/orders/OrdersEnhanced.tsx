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

const OrdersEnhanced: React.FC = () => {
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

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedOrders.length === 0) {
      alert('يرجى اختيار طلبات أولاً');
      return;
    }

    try {
      const promises = selectedOrders.map(orderId =>
        updateOrderStatus(orderId, status, `تحديث جماعي إلى ${status}`)
      );

      await Promise.all(promises);
      setSelectedOrders([]);
      setShowBulkActions(false);
      alert(`تم تحديث ${selectedOrders.length} طلب بنجاح`);
    } catch (error) {
      console.error('خطأ في التحديث الجماعي:', error);
      alert('حدث خطأ أثناء التحديث الجماعي');
    }
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(order => order.id));
    }
  };

  const exportOrders = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });
      queryParams.append('export', 'true');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3007/api/v1';
      const response = await fetch(`${apiUrl}/orders-enhanced/export?${queryParams}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-enhanced-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('خطأ في تصدير الطلبات:', error);
      alert('حدث خطأ أثناء تصدير الطلبات');
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

  const getConfidenceIcon = (confidence?: number) => {
    if (!confidence) return <InformationCircleIcon className="h-3 w-3" />;
    
    if (confidence >= 0.8) return <StarIcon className="h-3 w-3" />;
    if (confidence >= 0.6) return <ExclamationTriangleIcon className="h-3 w-3" />;
    return <ExclamationTriangleIcon className="h-3 w-3" />;
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
      <style>{`
        .compact-table {
          font-size: 13px;
        }
        .compact-table td {
          padding: 8px 12px !important;
          vertical-align: top;
        }
        .compact-table th {
          padding: 8px 12px !important;
        }
        .compact-table .truncate {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .compact-table tr {
          height: auto !important;
          min-height: 50px;
        }
      `}</style>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <ShoppingBagIcon className="h-8 w-8 text-indigo-600 mr-3" />
              🚀 الطلبات المحسنة - محدثة
            </h1>
            <p className="mt-2 text-gray-600">
              ✨ طلبات محسنة بالذكاء الاصطناعي مع تقييم جودة البيانات - تم التحديث!
            </p>
          </div>
          <div className="flex space-x-3 space-x-reverse">
            <button
              onClick={exportOrders}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              📊 تصدير Excel
            </button>
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ShoppingBagIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      إجمالي الطلبات
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.totalOrders}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <StarIcon className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      متوسط الثقة
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {(stats.avgConfidence * 100).toFixed(1)}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      إجمالي الإيرادات
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatPrice(stats.totalRevenue)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      طلبات من المحادثات
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {orders.filter(order => order.conversationId).length}
                    </dd>
                    <dd className="text-xs text-gray-500">
                      من إجمالي {orders.length} طلب
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              البحث
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="رقم الطلب أو اسم العميل..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              حالة الطلب
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">جميع الحالات</option>
              <option value="PENDING">في الانتظار</option>
              <option value="CONFIRMED">مؤكد</option>
              <option value="PROCESSING">قيد المعالجة</option>
              <option value="SHIPPED">تم الشحن</option>
              <option value="DELIVERED">تم التسليم</option>
              <option value="CANCELLED">ملغي</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              طريقة الاستخراج
            </label>
            <select
              value={filters.extractionMethod}
              onChange={(e) => setFilters({...filters, extractionMethod: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">جميع الطرق</option>
              <option value="ai_enhanced">ذكاء اصطناعي محسن</option>
              <option value="ai_basic">ذكاء اصطناعي أساسي</option>
              <option value="ai_data_collection">جمع بيانات ذكي</option>
              <option value="manual">يدوي</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              مستوى الثقة الأدنى
            </label>
            <select
              value={filters.minConfidence}
              onChange={(e) => setFilters({...filters, minConfidence: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">جميع المستويات</option>
              <option value="0.8">عالي (80%+)</option>
              <option value="0.6">متوسط (60%+)</option>
              <option value="0.4">منخفض (40%+)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                status: '',
                extractionMethod: '',
                minConfidence: '',
                search: '',
                dateFrom: '',
                dateTo: '',
                sortBy: 'createdAt',
                sortOrder: 'desc',
                page: 1,
                limit: 20
              })}
              className="w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              إعادة تعيين
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm font-medium text-blue-900">
                تم اختيار {selectedOrders.length} طلب
              </span>
            </div>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => handleBulkStatusUpdate('CONFIRMED')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                تأكيد الكل
              </button>
              <button
                onClick={() => handleBulkStatusUpdate('PROCESSING')}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                معالجة الكل
              </button>
              <button
                onClick={() => handleBulkStatusUpdate('SHIPPED')}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                شحن الكل
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              قائمة الطلبات ({orders.length})
            </h3>
            <div className="flex items-center space-x-2 space-x-reverse">
              <input
                type="checkbox"
                checked={selectedOrders.length === orders.length && orders.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-500">تحديد الكل</span>
            </div>
          </div>
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
            <table className="min-w-full divide-y divide-gray-200 compact-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                    <input
                      type="checkbox"
                      checked={selectedOrders.length === orders.length && orders.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    رقم الطلب
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    العميل
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المنتجات
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    المبلغ
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    الحالة
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    الجودة
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    التاريخ
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    الإجراءات 🚀
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className={`hover:bg-gray-50 ${order.conversationId ? 'border-l-4 border-l-blue-200' : ''}`}>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrders([...selectedOrders, order.id]);
                          } else {
                            setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {order.orderNumber}
                      </div>
                      {order.extractionMethod && (
                        <div className="text-xs text-gray-500 flex items-center">
                          <span className="truncate">
                            {order.extractionMethod === 'ai_enhanced' ? 'ذكاء محسن' :
                             order.extractionMethod === 'ai_basic' ? 'ذكاء أساسي' :
                             order.extractionMethod === 'manual' ? 'يدوي' : 'ذكاء'}
                          </span>
                          {order.extractionMethod.includes('ai') && (
                            <span className="ml-1 text-blue-500" title="تم إنشاؤه بالذكاء الاصطناعي">
                              🤖
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {getCustomerDisplayName(order)}
                      </div>
                      {order.customerPhone && (
                        <div className="text-xs text-gray-500 truncate">
                          {order.customerPhone}
                        </div>
                      )}
                      {order.city && (
                        <div className="text-xs text-gray-400 truncate">
                          {order.city}
                        </div>
                      )}
                      {order.conversationId && (
                        <button
                          onClick={() => {
                            const url = `/conversations-improved?conversationId=${order.conversationId}`;
                            console.log('🔗 Opening conversation URL:', url);
                            console.log('📋 Conversation ID:', order.conversationId);
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-xs text-blue-500 hover:text-blue-700 flex items-center mt-1 transition-colors cursor-pointer"
                          title="انتقال للمحادثة الأصلية (نافذة جديدة)"
                        >
                          <ChatBubbleLeftRightIcon className="h-3 w-3 mr-1" />
                          <span>محادثة</span>
                        </button>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <div className="max-h-16 overflow-y-auto">
                        {order.items.slice(0, 2).map((item, index) => (
                          <div key={index} className="text-xs mb-1 last:mb-0">
                            <div className="font-medium text-gray-900 flex items-center truncate">
                              <span className="truncate">{item.productName}</span>
                              {item.productId && item.productId !== 'ai-generated' && (
                                <span className="ml-1 text-green-500" title="منتج مطابق في المخزون">
                                  ✓
                                </span>
                              )}
                              {(!item.productId || item.productId === 'ai-generated') && (
                                <span className="ml-1 text-orange-500" title="منتج مستخرج من المحادثة">
                                  ⚠
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 flex items-center justify-between">
                              <span>{item.quantity} × {formatPrice(item.price)}</span>
                              {item.confidence && (
                                <span className={`px-1 py-0.5 rounded text-xs ${getConfidenceColor(item.confidence)}`}>
                                  {(item.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {order.items.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{order.items.length - 2} منتج آخر
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPrice(order.total)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.items?.length || 0} منتج
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="mr-1 truncate">{getStatusText(order.status)}</span>
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      {order.confidence && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(order.confidence)}`}>
                          {getConfidenceIcon(order.confidence)}
                          <span className="mr-1">{(order.confidence * 100).toFixed(0)}%</span>
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-xs text-gray-900">
                      <div>{formatDate(order.createdAt)}</div>
                    </td>

                    <td className="px-3 py-2 text-center">
                      {/* أزرار الإجراءات المحدثة مضغوطة */}
                      <div className="flex space-x-1 space-x-reverse justify-center">
                        <Link
                          to={`/orders/enhanced/${order.id}`}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                          title="عرض تفاصيل الطلب"
                          onClick={() => console.log('🔗 Navigating to order details:', order.id)}
                        >
                          <span className="text-xs">📋</span>
                        </Link>

                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50"
                          title="عرض سريع"
                        >
                          <span className="text-xs">⚡</span>
                        </button>

                        {order.conversationId && (
                          <button
                            onClick={() => {
                              const url = `/conversations-improved?conversationId=${order.conversationId}`;
                              console.log('🔗 Opening conversation URL:', url);
                              console.log('📋 Conversation ID:', order.conversationId);
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 cursor-pointer"
                            title="عرض المحادثة الأصلية (نافذة جديدة)"
                          >
                            <span className="text-xs">💬</span>
                          </button>
                        )}

                        {order.status === 'PENDING' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'CONFIRMED', 'تم تأكيد الطلب')}
                            className="text-green-600 hover:text-green-900 text-xs px-1 py-1 border border-green-600 rounded hover:bg-green-50"
                            title="تأكيد الطلب"
                          >
                            ✓
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

      {/* Enhanced Order Modal */}
      <EnhancedOrderModal
        order={selectedOrder}
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
};

export default OrdersEnhanced;

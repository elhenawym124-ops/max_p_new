import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCurrency } from '../../hooks/useCurrency';
import { useDateFormat } from '../../hooks/useDateFormat';
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
} from '@heroicons/react/24/outline';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: Array<{
    id: string;
    productId: string;
    name: string;
    price: number | null;
    quantity: number;
    total: number | null;
    metadata?: {
      color?: string;
      size?: string;
      conversationId?: string;
      source?: string;
    };
  }>;
  subtotal: number | null;
  tax: number;
  shipping: number;
  total: number | null;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  shippingAddress: {
    city: string;
    country: string;
  };
  trackingNumber?: string;
  notes: string;
  createdAt: string;
  conversationId?: string;
  updatedAt: string;
  metadata?: {
    source?: string;
    isGuestOrder?: boolean;
    [key: string]: any;
  };
}

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    search: '',
  });
  const { formatPrice } = useCurrency();
  const { formatDate } = useDateFormat();

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env.VITE_API_URL || 'https://mokhtarelhenawy.online/api/v1';

      // استخدام API الطلبات البسيطة
      const response = await fetch(`${apiUrl}/orders-new/simple`, {
        headers : {
          Authorization : `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        let filteredOrders = data.data;

        // تطبيق الفلاتر محلياً
        if (filters.status) {
          filteredOrders = filteredOrders.filter((order: Order) => order.status === filters.status);
        }

        if (filters.paymentStatus) {
          filteredOrders = filteredOrders.filter((order: Order) => order.paymentStatus === filters.paymentStatus);
        }

        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          filteredOrders = filteredOrders.filter((order: Order) =>
            order.orderNumber.toLowerCase().includes(searchTerm) ||
            order.customerName.toLowerCase().includes(searchTerm) ||
            order.customerPhone.includes(searchTerm)
          );
        }

        setOrders(filteredOrders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderNumber: string, status: string, notes?: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env.VITE_API_URL || 'https://mokhtarelhenawy.online/api/v1';
      
      let response;
      let success = false;
      
      // Try admin API first
      try {
        console.log('👤 Trying admin API for order:', orderNumber);
        response = await fetch(`${apiUrl}/orders-new/simple/${orderNumber}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status, notes }),
        });
        
        if (response.ok) {
          success = true;
          console.log('✅ Admin API succeeded');
        }
      } catch (adminError) {
        console.log('❌ Admin API failed:', adminError);
      }
      
      // If admin API failed, try public API for guest orders
      if (!success || response?.status === 404) {
        console.log('🛒 Trying public API for guest order:', orderNumber);
        
        // Get company info for public API
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // In development, we might need to use companyId instead of subdomain
        if (window.location.hostname === 'localhost' || window.location.hostname.includes('localhost')) {
          // For development, try to get companyId from user data
          try {
            const userResponse = await fetch(`${apiUrl}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            const userData = await userResponse.json();
            if (userData.data?.companyId) {
              headers['X-Company-Id'] = userData.data.companyId;
            }
          } catch (e) {
            console.log('Could not get company ID for development');
          }
        } else {
          // For production, use subdomain
          const subdomain = window.location.hostname.split('.')[0];
          if (subdomain) {
            headers['X-Company-Subdomain'] = subdomain;
          }
        }
        
        response = await fetch(`${apiUrl}/public/orders/${orderNumber}/status`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status, notes }),
        });
        
        if (response.ok) {
          success = true;
          console.log('✅ Public API succeeded');
        }
      }

      const data = await response?.json();
      if (data?.success) {
        fetchOrders();
        if (selectedOrder && selectedOrder.orderNumber === orderNumber) {
          setSelectedOrder(data.data);
        }
        alert('تم تحديث حالة الطلب بنجاح');
      } else {
        alert('فشل في تحديث حالة الطلب: ' + data.message);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('فشل في تحديث حالة الطلب');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'confirmed':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
      case 'processing':
        return <ClockIcon className="h-5 w-5 text-indigo-500" />;
      case 'shipped':
        return <TruckIcon className="h-5 w-5 text-purple-500" />;
      case 'delivered':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-indigo-100 text-indigo-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'في الانتظار';
      case 'confirmed':
        return 'مؤكد';
      case 'processing':
        return 'قيد المعالجة';
      case 'shipped':
        return 'تم الشحن';
      case 'delivered':
        return 'تم التسليم';
      case 'cancelled':
        return 'ملغي';
      default:
        return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'مدفوع';
      case 'pending':
        return 'في الانتظار';
      case 'failed':
        return 'فشل';
      default:
        return status;
    }
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
              إدارة الطلبات
            </h1>
            <p className="mt-2 text-gray-600">متابعة ومعالجة طلبات العملاء</p>
          </div>
          <Link
            to="/orders/stats"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ChartBarIcon className="h-5 w-5 mr-2" />
            الإحصائيات
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <option value="pending">في الانتظار</option>
              <option value="confirmed">مؤكد</option>
              <option value="processing">قيد المعالجة</option>
              <option value="shipped">تم الشحن</option>
              <option value="delivered">تم التسليم</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              حالة الدفع
            </label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => setFilters({...filters, paymentStatus: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">جميع حالات الدفع</option>
              <option value="paid">مدفوع</option>
              <option value="pending">في الانتظار</option>
              <option value="failed">فشل</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', paymentStatus: '', search: '' })}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              إعادة تعيين
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
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
                  حالة الدفع
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
                    {order.trackingNumber && (
                      <div className="text-xs text-gray-500">
                        تتبع: {order.trackingNumber}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {order.customerName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {order.customerPhone}
                    </div>
                    {order.shippingAddress && (
                      <div className="text-xs text-gray-400">
                        {order.shippingAddress.city}
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                      {getPaymentStatusText(order.paymentStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2 space-x-reverse justify-center">
                      <Link
                        to={`/orders/details/${order.orderNumber}`}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center"
                        title="عرض تفاصيل الطلب"
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
                        title="عرض سريع"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        <span className="text-xs">سريع</span>
                      </button>

                      {order.conversationId && (
                        <button
                          onClick={() => {
                            const url = `/conversations-improved?conversationId=${order.conversationId}`;
                            console.log('🔗 Opening conversation from orders page:', url);
                            console.log('📋 Conversation ID:', order.conversationId);
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-blue-600 hover:text-blue-900 flex items-center cursor-pointer"
                          title="عرض المحادثة الأصلية (نافذة جديدة)"
                        >
                          <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                          <span className="text-xs">محادثة</span>
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => updateOrderStatus(order.orderNumber, 'confirmed', 'تم تأكيد الطلب')}
                          className="text-green-600 hover:text-green-900 flex items-center"
                          title="تأكيد الطلب"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          <span className="text-xs">تأكيد</span>
                        </button>
                      )}
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => updateOrderStatus(order.orderNumber, 'processing', 'بدء معالجة الطلب')}
                          className="text-indigo-600 hover:text-indigo-900 text-xs px-2 py-1 border border-indigo-600 rounded"
                        >
                          معالجة
                        </button>
                      )}
                      {order.status === 'processing' && (
                        <button
                          onClick={() => {
                            const trackingNumber = prompt('رقم التتبع:');
                            const notes = trackingNumber ? `تم الشحن - رقم التتبع: ${trackingNumber}` : 'تم الشحن';
                            updateOrderStatus(order.orderNumber, 'shipped', notes);
                          }}
                          className="text-purple-600 hover:text-purple-900 text-xs px-2 py-1 border border-purple-600 rounded"
                        >
                          شحن
                        </button>
                      )}
                      {order.status === 'shipped' && (
                        <button
                          onClick={() => updateOrderStatus(order.orderNumber, 'delivered', 'تم تسليم الطلب بنجاح')}
                          className="text-green-600 hover:text-green-900 text-xs px-2 py-1 border border-green-600 rounded"
                        >
                          تسليم
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBagIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">لا توجد طلبات</h3>
            <p className="mt-1 text-sm text-gray-500">لم يتم العثور على طلبات تطابق المعايير المحددة.</p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  تفاصيل الطلب {selectedOrder.orderNumber}
                </h3>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Customer Info */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">معلومات العميل</h4>
                  <div className="bg-gray-50 p-3 rounded">
                    <p><strong>الاسم:</strong> {selectedOrder.customerName}</p>
                    <p><strong>الهاتف:</strong> {selectedOrder.customerPhone}</p>
                    {selectedOrder.shippingAddress && (
                      <p><strong>المدينة:</strong> {selectedOrder.shippingAddress.city}</p>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">المنتجات</h4>
                  <div className="bg-gray-50 p-3 rounded">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-600">الكمية: {item.quantity}</p>
                          {item.metadata && (
                            <div className="text-xs text-gray-500 mt-1">
                              {item.metadata.color && <span>اللون: {item.metadata.color} </span>}
                              {item.metadata.size && <span>المقاس: {item.metadata.size}</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{formatPrice(item.total)}</p>
                          <p className="text-sm text-gray-600">{formatPrice(item.price)}/قطعة</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Summary */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">ملخص الطلب</h4>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex justify-between py-1">
                      <span>المجموع الفرعي:</span>
                      <span>{formatPrice(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>الضريبة:</span>
                      <span>{formatPrice(selectedOrder.tax || 0)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>الشحن:</span>
                      <span>{formatPrice(selectedOrder.shipping)}</span>
                    </div>
                    <div className="flex justify-between py-1 font-bold border-t border-gray-300 mt-2 pt-2">
                      <span>المجموع الإجمالي:</span>
                      <span>{formatPrice(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Order Status */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">حالة الطلب</h4>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex justify-between items-center">
                      <span>الحالة الحالية:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                        {getStatusIcon(selectedOrder.status)}
                        <span className="mr-1">{getStatusText(selectedOrder.status)}</span>
                      </span>
                    </div>
                    {selectedOrder.trackingNumber && (
                      <div className="flex justify-between items-center mt-2">
                        <span>رقم التتبع:</span>
                        <span className="font-mono">{selectedOrder.trackingNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">ملاحظات</h4>
                    <div className="bg-gray-50 p-3 rounded">
                      <p>{selectedOrder.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;

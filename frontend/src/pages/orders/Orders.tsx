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
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
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
  const [deleting, setDeleting] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // Bulk Actions State
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    search: '',
    startDate: '',
    endDate: '',
  });

  const { formatPrice } = useCurrency();
  const { formatDate } = useDateFormat();

  useEffect(() => {
    fetchOrders();
  }, [page, limit, filters]); // Fetch when page, limit, or filters change

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env['VITE_API_URL'] || 'http://localhost:3007/api/v1';

      // Build Query String
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`${apiUrl}/orders-new/simple?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
        if (data.pagination) {
          setTotalPages(data.pagination.pages);
          setTotalOrders(data.pagination.total);
        } else {
          setTotalPages(1);
          setTotalOrders(data.data.length);
        }
        // Clear selection on page change or filter change
        setSelectedOrders([]);
      } else {
        console.error('Failed to fetch orders:', data.message);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to page 1 on filter change
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Bulk Selection Logic
  const toggleOrderSelection = (orderNumber: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderNumber)
        ? prev.filter(id => id !== orderNumber)
        : [...prev, orderNumber]
    );
  };

  const toggleAllSelection = () => {
    if (orders.every(o => selectedOrders.includes(o.orderNumber))) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.orderNumber));
    }
  };

  // Bulk Actions Implementation
  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (!newStatus) return;
    if (!window.confirm(`هل أنت متأكد من تحديث حالة ${selectedOrders.length} طلب إلى "${getStatusText(newStatus)}"?`)) return;

    try {
      setBulkProcessing(true);
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env['VITE_API_URL'] || 'http://localhost:3007/api/v1';

      const response = await fetch(`${apiUrl}/orders-new/bulk/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds: selectedOrders, status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        alert('تم تحديث الطلبات بنجاح');
        fetchOrders(); // Refresh data
        setSelectedOrders([]);
      } else {
        alert(data.message || 'فشل تحديث الطلبات');
      }
    } catch (error) {
      console.error('Error bulk updating:', error);
      alert('حدث خطأ أثناء التحديث الجماعي');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`تحذير: هل أنت متأكد من حذف ${selectedOrders.length} طلب؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

    try {
      setBulkProcessing(true);
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env['VITE_API_URL'] || 'http://localhost:3007/api/v1';

      const response = await fetch(`${apiUrl}/orders-new/bulk/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds: selectedOrders })
      });

      const data = await response.json();

      if (data.success) {
        alert('تم حذف الطلبات بنجاح');
        fetchOrders();
        setSelectedOrders([]);
      } else {
        alert(data.message || 'فشل حذف الطلبات');
      }
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert('حدث خطأ أثناء الحذف الجماعي');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env['VITE_API_URL'] || 'http://localhost:3007/api/v1';

      // Build Query String from current filters
      const queryParams = new URLSearchParams({
        ...(filters.status && { status: filters.status }),
        ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`${apiUrl}/orders-new/export?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Error exporting:', error);
      alert('فشل تصدير البيانات');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-indigo-100 text-indigo-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'confirmed': return 'تم التأكيد';
      case 'processing': return 'قيد التجهيز';
      case 'shipped': return 'تم الشحن';
      case 'delivered': return 'تم التوصيل';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'تم الدفع';
      case 'pending': return 'انتظار الدفع';
      case 'failed': return 'فشل الدفع';
      default: return status;
    }
  };

  // Legacy single actions (kept for modal usage)
  const handleDeleteAllOrders = async () => { /* Not commonly used now, kept just in case or remove? Keeping for now */
    if (!window.confirm('هل أنت متأكد من حذف جميع الطلبات؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    try {
      setDeleting(true);
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env['VITE_API_URL'] || 'http://localhost:3007/api/v1';
      const response = await fetch(`${apiUrl}/orders/delete-all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) { fetchOrders(); alert('تم حذف جميع الطلبات بنجاح'); }
      else { alert(data.message || 'فشل حذف الطلبات'); }
    } catch (error) { console.error('Error:', error); alert('خطأ أثناء الحذف'); }
    finally { setDeleting(false); }
  };

  const handleUpdateStatus = async (orderNumber: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env['VITE_API_URL'] || 'http://localhost:3007/api/v1';
      const response = await fetch(`${apiUrl}/orders-new/simple/${orderNumber}/status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (data.success) {
        setOrders(orders.map(order =>
          order.orderNumber === orderNumber ? { ...order, status: newStatus as any } : order
        ));
        if (selectedOrder && selectedOrder.orderNumber === orderNumber) {
          setSelectedOrder({ ...selectedOrder, status: newStatus as any });
        }
      } else { alert(data.message || 'فشل تحديث الحالة'); }
    } catch (error) { console.error('Error:', error); alert('خطأ أثناء التحديث'); }
  };

  const handleUpdatePaymentStatus = async (orderNumber: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env['VITE_API_URL'] || 'http://localhost:3007/api/v1';
      const response = await fetch(`${apiUrl}/orders-new/simple/${orderNumber}/payment-status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newStatus })
      });
      const data = await response.json();
      if (data.success) {
        setOrders(orders.map(order =>
          order.orderNumber === orderNumber ? { ...order, paymentStatus: newStatus as any } : order
        ));
        if (selectedOrder && selectedOrder.orderNumber === orderNumber) {
          setSelectedOrder({ ...selectedOrder, paymentStatus: newStatus as any });
        }
      } else { alert(data.message || 'فشل تحديث حالة الدفع'); }
    } catch (error) { console.error('Error:', error); alert('خطأ أثناء تحديث الدفع'); }
  };

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">الطلبات</h1>
          <p className="text-gray-600">إدارة ومتابعة طلبات العملاء</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            <span>تصدير Excel</span>
          </button>
          <Link
            to="/orders/stats"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ChartBarIcon className="w-5 h-5" />
            <span>الإحصائيات</span>
          </Link>
          <button
            onClick={handleDeleteAllOrders}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <TrashIcon className="w-5 h-5" />
            <span>{deleting ? 'جاري الحذف...' : 'حذف الكل'}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث برقم الطلب أو اسم العميل..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="relative">
            <FunnelIcon className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">كل الحالات</option>
              <option value="pending">قيد الانتظار</option>
              <option value="confirmed">تم التأكيد</option>
              <option value="processing">قيد التجهيز</option>
              <option value="shipped">تم الشحن</option>
              <option value="delivered">تم التوصيل</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          <div className="relative">
            <select
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">كل حالات الدفع</option>
              <option value="paid">تم الدفع</option>
              <option value="pending">انتظار الدفع</option>
              <option value="failed">فشل الدفع</option>
            </select>
          </div>

          {/* Date Range Filters */}
          <div>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="من تاريخ"
            />
          </div>
          <div>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="إلى تاريخ"
            />
          </div>
        </div>
      </div>

      {/* Bulk Toolbar */}
      {selectedOrders.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-6 h-6 text-blue-600" />
            <span className="font-medium text-blue-900">تم تحديد {selectedOrders.length} طلب</span>
          </div>
          <div className="flex gap-3">
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  handleBulkStatusUpdate(val);
                  e.target.value = ''; // Reset
                }
              }}
              className="px-4 py-2 border border-blue-200 rounded-lg text-sm focus:ring-blue-500 bg-white"
              disabled={bulkProcessing}
            >
              <option value="">تحديث الحالة...</option>
              <option value="pending">قيد الانتظار</option>
              <option value="confirmed">تم التأكيد</option>
              <option value="processing">قيد التجهيز</option>
              <option value="shipped">تم الشحن</option>
              <option value="delivered">تم التوصيل</option>
              <option value="cancelled">ملغي</option>
            </select>
            <button
              onClick={handleBulkDelete}
              disabled={bulkProcessing}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors border border-red-200"
            >
              {bulkProcessing ? 'جال المعالجة...' : 'حذف المحدد'}
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    onChange={toggleAllSelection}
                    checked={orders.length > 0 && orders.every(o => selectedOrders.includes(o.orderNumber))}
                  />
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">رقم الطلب</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">العميل</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">المبلغ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">الحالة</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">الدفع</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">التاريخ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                      <p>جاري تحميل الطلبات...</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <ShoppingBagIcon className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-lg font-medium text-gray-900">لا توجد طلبات</p>
                      <p className="text-sm text-gray-500 mt-1">لم يتم العثور على طلبات تطابق معايير البحث</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${selectedOrders.includes(order.orderNumber) ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        checked={selectedOrders.includes(order.orderNumber)}
                        onChange={() => toggleOrderSelection(order.orderNumber)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">#{order.orderNumber}</span>
                      {order.metadata?.isGuestOrder && (
                        <span className="mr-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">زائر</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-900 font-medium">{order.customerName || 'غير محدد'}</span>
                        <span className="text-gray-500 text-sm" dir="ltr">{order.customerPhone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {formatPrice(order.total || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {getPaymentStatusText(order.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="عرض التفاصيل"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        <Link
                          to={`/orders/details/${order.orderNumber}`}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="صفحة الطلب"
                        >
                          <ShoppingBagIcon className="w-5 h-5" />
                        </Link>
                        {order.conversationId && (
                          <Link
                            to={`/whatsapp?conversationId=${order.conversationId}`}
                            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                            title="المحادثة"
                          >
                            <ChatBubbleLeftRightIcon className="w-5 h-5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && orders.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              عرض {((page - 1) * limit) + 1} إلى {Math.min(page * limit, totalOrders)} من أصل {totalOrders} طلب
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5 && page > 3) {
                    p = page - 2 + i;
                  }
                  if (p > totalPages) return null;

                  return (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${page === p
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowOrderModal(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-right overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:mr-4 sm:text-right w-full">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        تفاصيل الطلب #{selectedOrder.orderNumber}
                      </h3>
                      <button
                        onClick={() => setShowOrderModal(false)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <span className="sr-only">إغلاق</span>
                        <XCircleIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">معلومات العميل</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 block">الاسم</span>
                          <span className="text-gray-900 font-medium">{selectedOrder.customerName}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">رقم الهاتف</span>
                          <span className="text-gray-900 font-medium" dir="ltr">{selectedOrder.customerPhone}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500 block">العنوان</span>
                          <span className="text-gray-900 font-medium">
                            {typeof selectedOrder.shippingAddress === 'string'
                              ? selectedOrder.shippingAddress
                              : `${selectedOrder.shippingAddress?.city || ''} - ${selectedOrder.shippingAddress?.country || ''}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">المنتجات</h4>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">المنتج</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">الكمية</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">السعر</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {selectedOrder.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{formatPrice(item.price || 0)}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{formatPrice(item.total || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">المجموع الفرعي</span>
                        <span className="font-medium">{formatPrice(selectedOrder.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">الشحن</span>
                        <span className="font-medium">{formatPrice(selectedOrder.shipping || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-lg font-bold text-gray-900">الإجمالي</span>
                        <span className="text-lg font-bold text-blue-600">{formatPrice(selectedOrder.total || 0)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex gap-3 border-t border-gray-200 pt-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">تحديث الحالة</label>
                        <select
                          value={selectedOrder.status}
                          onChange={(e) => handleUpdateStatus(selectedOrder.orderNumber, e.target.value)}
                          className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="pending">قيد الانتظار</option>
                          <option value="confirmed">تم التأكيد</option>
                          <option value="processing">قيد التجهيز</option>
                          <option value="shipped">تم الشحن</option>
                          <option value="delivered">تم التوصيل</option>
                          <option value="cancelled">ملغي</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">حالة الدفع</label>
                        <select
                          value={selectedOrder.paymentStatus}
                          onChange={(e) => handleUpdatePaymentStatus(selectedOrder.orderNumber, e.target.value)}
                          className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="pending">انتظار الدفع</option>
                          <option value="paid">تم الدفع</option>
                          <option value="failed">فشل الدفع</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <Link
                  to={`/orders/details/${selectedOrder.orderNumber}`}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  عرض التفاصيل الكاملة
                </Link>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowOrderModal(false)}
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

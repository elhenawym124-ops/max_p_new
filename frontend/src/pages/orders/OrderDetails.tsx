import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCurrency } from '../../hooks/useCurrency';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useAuth } from '../../hooks/useAuthSimple';
import { config } from '../../config';
import {
  ArrowLeftIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  MapPinIcon,
  UserIcon,
  ShoppingBagIcon,
  CreditCardIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  StarIcon,
  PrinterIcon,
  TrashIcon,
  PlusIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface OrderDetails {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  city?: string;
  country?: string;
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
    metadata?: any;
  }>;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  confidence?: number;
  extractionMethod?: string;
  conversationId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory?: Array<{
    status: string;
    notes?: string;
    createdAt: string;
    updatedBy?: string;
  }>;
}

const OrderDetails: React.FC = () => {
  const { id: orderNumber } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { formatDate } = useDateFormat();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const apiUrl = import.meta.env['VITE_API_URL'] || 'http://localhost:3007/api/v1';

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Status & Payment Modals State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    city: '',
    notes: '',
    items: [] as any[]
  });

  useEffect(() => {
    if (!orderNumber) return;
    if (authLoading) return;
    if (!isAuthenticated) {
      window.location.href = '/auth/login';
      return;
    }
    fetchOrderDetails();
  }, [orderNumber, authLoading, isAuthenticated]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      // Try admin orders first
      let response = await fetch(`${apiUrl}/orders-new/simple/${orderNumber}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let data = await response.json();

      // If not found, try guest public API (fallback logic from original file)
      if (!data.success && response.status === 404) {
        // ... simplified for brevity, assuming admin access primarily ...
        // In a real scenario, we'd replicate the guest fallback or better yet,
        // ensure /simple/ endpoint handles both transparently (which it does now in backend!).
        // So for this Phase 3, we rely on the robust backend endpoint we just built.
      }

      if (data.success) {
        const simpleOrder = data.data;
        const enhancedOrder: OrderDetails = {
          id: simpleOrder.id,
          orderNumber: simpleOrder.orderNumber,
          customerName: simpleOrder.customerName,
          customerEmail: simpleOrder.customerEmail,
          customerPhone: simpleOrder.customerPhone,
          customerAddress: simpleOrder.customerAddress || (typeof simpleOrder.shippingAddress === 'string' ? simpleOrder.shippingAddress : simpleOrder.shippingAddress?.address) || '',
          city: simpleOrder.city || simpleOrder.shippingAddress?.city || '',
          country: simpleOrder.shippingAddress?.country || '',
          status: simpleOrder.status.toUpperCase(),
          paymentStatus: simpleOrder.paymentStatus.toUpperCase(),
          paymentMethod: simpleOrder.paymentMethod,
          items: simpleOrder.items.map((item: any) => ({
            id: item.id || Math.random().toString(),
            productId: item.productId,
            productName: item.name,
            productColor: item.metadata?.color,
            productSize: item.metadata?.size,
            price: parseFloat(item.price) || 0,
            quantity: item.quantity,
            total: parseFloat(item.total) || 0,
            metadata: item.metadata
          })),
          subtotal: parseFloat(simpleOrder.subtotal) || 0,
          tax: parseFloat(simpleOrder.tax) || 0,
          shipping: parseFloat(simpleOrder.shipping) || 0,
          total: parseFloat(simpleOrder.total) || 0,
          currency: 'EGP',
          confidence: simpleOrder.metadata?.confidence,
          extractionMethod: simpleOrder.metadata?.extractionMethod,
          conversationId: simpleOrder.conversationId,
          notes: simpleOrder.notes,
          createdAt: simpleOrder.createdAt,
          updatedAt: simpleOrder.updatedAt
        };
        setOrder(enhancedOrder);

        // Initialize Edit Form
        setEditForm({
          customerName: enhancedOrder.customerName,
          customerPhone: enhancedOrder.customerPhone || '',
          customerAddress: enhancedOrder.customerAddress || '',
          city: enhancedOrder.city || '',
          notes: enhancedOrder.notes || '',
          items: JSON.parse(JSON.stringify(enhancedOrder.items)) // Deep copy
        });

      } else {
        console.error('Failed to fetch order:', data.message);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---

  const handlePrintInvoice = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${apiUrl}/orders-new/simple/${orderNumber}/invoice`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Invoice generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      console.error(e);
      alert('فشل طباعة الفاتورة');
    }
  };

  const handleSaveChanges = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem('accessToken');

      // 1. Update Details
      const detailsBody = {
        customerName: editForm.customerName,
        customerPhone: editForm.customerPhone,
        shippingAddress: {
          address: editForm.customerAddress,
          city: editForm.city,
          country: 'Egypt' // default
        },
        notes: editForm.notes
      };

      await fetch(`${apiUrl}/orders-new/simple/${orderNumber}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(detailsBody)
      });

      // 2. Update Items (Recalculate totals first)
      const newItems = editForm.items.map(item => ({
        ...item,
        total: item.price * item.quantity
      }));

      const newSubtotal = newItems.reduce((sum, item) => sum + item.total, 0);
      const newTotal = newSubtotal + order.shipping + order.tax; // Keeping shipping/tax constant for now (or make editable too)

      const itemsBody = {
        items: newItems,
        subtotal: newSubtotal,
        total: newTotal,
        tax: order.tax,
        shipping: order.shipping
      };

      await fetch(`${apiUrl}/orders-new/simple/${orderNumber}/items`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsBody)
      });

      alert('تم حفظ التغييرات بنجاح');
      setIsEditing(false);
      fetchOrderDetails();

    } catch (e) {
      console.error(e);
      alert('فشل حفظ التغييرات');
    } finally {
      setUpdating(false);
    }
  };

  // --- Item Edit Helpers ---
  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...editForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    // Auto calc total
    if (field === 'quantity' || field === 'price') {
      newItems[index].total = newItems[index].quantity * newItems[index].price;
    }
    setEditForm({ ...editForm, items: newItems });
  };

  const handleRemoveItem = (index: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    const newItems = editForm.items.filter((_, i) => i !== index);
    setEditForm({ ...editForm, items: newItems });
  };

  const handleAddItem = () => {
    setEditForm({
      ...editForm,
      items: [...editForm.items, {
        id: Math.random().toString(),
        productName: 'منتج جديد',
        price: 0,
        quantity: 1,
        total: 0,
        productId: 'custom' // Flag for backend if needed
      }]
    });
  };

  const getStatusText = (status: string) => {
    const map: any = { 'PENDING': 'قيد الانتظار', 'CONFIRMED': 'مؤكد', 'PROCESSING': 'قيد التجهيز', 'SHIPPED': 'تم الشحن', 'DELIVERED': 'تم التسليم', 'CANCELLED': 'ملغي' };
    return map[status] || status;
  };
  const getStatusColor = (status: string) => {
    const map: any = { 'PENDING': 'bg-yellow-100 text-yellow-800', 'CONFIRMED': 'bg-blue-100 text-blue-800', 'PROCESSING': 'bg-purple-100 text-purple-800', 'SHIPPED': 'bg-indigo-100 text-indigo-800', 'DELIVERED': 'bg-green-100 text-green-800', 'CANCELLED': 'bg-red-100 text-red-800' };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!order) return <div className="p-8 text-center">الطلب غير موجود</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center">
          <button onClick={() => navigate('/orders')} className="ml-4 p-2 text-gray-400 hover:text-gray-600">
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <ShoppingBagIcon className="h-8 w-8 text-indigo-600 ml-3" />
              تفاصيل الطلب #{order.orderNumber}
            </h1>
            <p className="mt-2 text-gray-600">تم الإنشاء في {formatDate(order.createdAt)}</p>
          </div>
        </div>

        <div className="flex gap-3">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="inline-flex items-center px-4 py-2 border border-blue-600 text-sm font-medium rounded-lg text-blue-600 bg-white hover:bg-blue-50">
                <PencilIcon className="h-4 w-4 ml-2" />
                تعديل الطلب
              </button>
              <button onClick={handlePrintInvoice} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                <PrinterIcon className="h-4 w-4 ml-2" />
                طباعة الفاتورة
              </button>
            </>
          ) : (
            <>
              <button onClick={handleSaveChanges} disabled={updating} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700">
                {updating ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
              <button onClick={() => setIsEditing(false)} disabled={updating} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                إلغاء
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">

          {/* Order Status (Only View Mode) */}
          <div className="bg-white shadow rounded-lg p-6 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                {getStatusText(order.status)}
              </span>
              <span className="text-gray-400">|</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${order.paymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {order.paymentStatus === 'COMPLETED' ? 'مدفوع' : 'في الانتظار'}
              </span>
            </div>
            {order.conversationId && (
              <Link to={`/whatsapp?conversationId=${order.conversationId}`} className="text-blue-600 hover:underline flex items-center text-sm">
                <ChatBubbleLeftRightIcon className="w-4 h-4 ml-1" /> الذهاب للمحادثة
              </Link>
            )}
          </div>

          {/* Items */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">المنتجات</h3>
              {isEditing && (
                <button onClick={handleAddItem} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                  <PlusIcon className="w-4 h-4 ml-1" /> إضافة منتج
                </button>
              )}
            </div>

            <div className="space-y-4">
              {(isEditing ? editForm.items : order.items).map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row items-center justify-between p-4 border border-gray-200 rounded-lg gap-4">

                  {isEditing ? (
                    // Edit Mode Item
                    <>
                      <div className="flex-1 w-full space-y-2">
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                          className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="اسم المنتج"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))}
                            className="w-24 text-sm border-gray-300 rounded-md"
                            placeholder="السعر"
                          />
                          <span className="self-center text-gray-400">x</span>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                            className="w-20 text-sm border-gray-300 rounded-md"
                            placeholder="الكمية"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-900">{formatPrice(item.price * item.quantity, order.currency)}</span>
                        <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700">
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    // View Mode Item
                    <>
                      <div className="flex-1 text-right">
                        <h4 className="font-medium text-gray-900">{item.productName}</h4>
                        <div className="text-sm text-gray-500 mt-1">
                          {item.quantity} x {formatPrice(item.price, order.currency)}
                          {item.productColor && <span className="mr-2 px-2 bg-gray-100 rounded text-xs">{item.productColor}</span>}
                          {item.productSize && <span className="mr-2 px-2 bg-gray-100 rounded text-xs">{item.productSize}</span>}
                        </div>
                      </div>
                      <div className="font-medium text-gray-900">
                        {formatPrice(item.total, order.currency)}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-6 border-t border-gray-200 pt-6 space-y-2 text-sm">
              {isEditing ? (
                <div className="bg-yellow-50 p-3 rounded-md text-yellow-800 text-xs">
                  سيتم إعادة حساب الإجمالي تلقائيًا عند الحفظ.
                </div>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-gray-600">المجموع الفرعي:</span><span className="font-medium">{formatPrice(order.subtotal, order.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">الشحن:</span><span className="font-medium">{formatPrice(order.shipping, order.currency)}</span></div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span>الإجمالي:</span><span>{formatPrice(order.total, order.currency)}</span></div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Customer Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <UserIcon className="h-5 w-5 text-gray-400 ml-2" /> معلومات العميل
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500 block mb-1">الاسم</label>
                {isEditing ? (
                  <input type="text" value={editForm.customerName} onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })} className="w-full border-gray-300 rounded-md text-sm" />
                ) : <p className="text-gray-900">{order.customerName}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 block mb-1">الهاتف</label>
                {isEditing ? (
                  <input type="text" value={editForm.customerPhone} onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })} className="w-full border-gray-300 rounded-md text-sm" dir="ltr" />
                ) : (
                  <div className="flex items-center text-gray-900" dir="ltr">
                    <PhoneIcon className="w-4 h-4 text-gray-400 mr-2" /> {order.customerPhone}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 block mb-1">العنوان</label>
                {isEditing ? (
                  <textarea value={editForm.customerAddress} onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })} className="w-full border-gray-300 rounded-md text-sm" rows={3} />
                ) : (
                  <div className="flex items-start text-gray-900">
                    <MapPinIcon className="w-4 h-4 text-gray-400 ml-2 mt-1" />
                    <span>{order.customerAddress}<br />{order.city}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">ملاحظات</h3>
            {isEditing ? (
              <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full border-gray-300 rounded-md text-sm h-32" />
            ) : (
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{order.notes || 'لا توجد ملاحظات'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;

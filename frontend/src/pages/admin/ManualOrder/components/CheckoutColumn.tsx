import React, { useState, useEffect } from 'react';
import { UserIcon, MapPinIcon, BanknotesIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { customerService } from '../../../../services/customerService';
import { apiClient } from '../../../../services/apiClient';
import { toast } from 'react-hot-toast';
import { CartItem } from '../types';
import { useNavigate } from 'react-router-dom';

interface CheckoutColumnProps {
    cartItems: CartItem[];
}

const CheckoutColumn: React.FC<CheckoutColumnProps> = ({ cartItems }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // Customer Form State
    const [phone, setPhone] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [notes, setNotes] = useState('');

    // Order Settings
    const [status, setStatus] = useState('PENDING'); // PENDING, CONFIRMED
    const [paymentMethod, setPaymentMethod] = useState('cod');

    // Debounced Phone Search
    useEffect(() => {
        const searchCustomer = async () => {
            if (phone.length < 10) return; // Wait for full number

            try {
                setSearching(true);
                // Using existing search API which likely searches name/phone
                const results = await customerService.searchCustomers(phone);

                // Find exact phone match
                const customer = results.find((c: any) => c.phone === phone || c.phone?.includes(phone));

                if (customer) {
                    setFirstName(customer.firstName || '');
                    setLastName(customer.lastName || '');
                    setAddress(customer.address || '');
                    setCity(customer.city || '');
                    toast.success('تم العثور على العميل!');
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setSearching(false);
            }
        };

        const timeoutId = setTimeout(() => {
            if (phone) searchCustomer();
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [phone]);

    const handleCreateOrder = async () => {
        if (cartItems.length === 0) {
            toast.error('السلة فارغة');
            return;
        }
        if (!phone || !firstName) {
            toast.error('بيانات العميل ناقصة');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                products: cartItems.map(item => ({
                    productId: item.productId,
                    productName: item.name,
                    price: item.price, // Changed from productPrice to price matches backend createOrderItems
                    quantity: item.quantity,
                    // Add extra fields if needed by backend (e.g. sku)
                })),
                customerPhone: phone,
                customerName: `${firstName} ${lastName}`.trim(),
                customerAddress: address,
                city: city, // Important for shipping calculation in calculateOrderCosts
                notes: notes,
                status: status,
                paymentMethod: paymentMethod,
                extractionMethod: 'manual_admin',
                conversationId: 'manual', // Fallback for backend logic that might require it or treat it as manual
                platform: 'manual',
                source: 'manual_entry'
            };

            const response = await apiClient.post('/orders-enhanced', payload);

            if (response.data.success) {
                toast.success('تم إنشاء الطلب بنجاح');
                // Reset or Navigate
                if (confirm('تم إنشاء الطلب! هل تريد عرض التفاصيل؟')) {
                    navigate(`/orders/enhanced/${response.data.order.id || ''}`);
                } else {
                    // Reset form
                    setPhone('');
                    setFirstName('');
                    setLastName('');
                    setAddress('');
                    setCity('');
                    setNotes('');
                    // TODO: Ideally we should clear the cart here. 
                    // Since cartItems is prop, we rely on parent. 
                    // For now, we accept that cart remains populated or user manually clears.
                    // Better approach: Redirect to orders list or just stay here.
                    toast.success('جاهز لطلب جديد');
                }
            } else {
                toast.error('فشل إنشاء الطلب: ' + (response.data.error || 'خطأ غير معروف'));
            }

        } catch (error: any) {
            console.error('Create order error:', error);
            toast.error(error.response?.data?.message || 'حدث خطأ أثناء إنشاء الطلب');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-semibold text-gray-800">بيانات العميل والدفع</h2>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-6">

                {/* Customer Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-gray-500" />
                        بيانات العميل
                    </h3>

                    <div className="relative">
                        <label className="block text-xs text-gray-500 mb-1">رقم الهاتف <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input
                                type="text"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-right"
                                placeholder="01xxxxxxxxx"
                                dir="ltr"
                            />
                            {searching && <MagnifyingGlassIcon className="w-4 h-4 text-blue-500 absolute left-3 top-3 animate-bounce" />}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">الاسم الأول <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">الاسم الأخير</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">الميدنة / المحافظة</label>
                        <input
                            type="text"
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="القاهرة، الإسكندرية..."
                        />
                    </div>

                    <div className="relative">
                        <label className="block text-xs text-gray-500 mb-1">العنوان بالتفصيل</label>
                        <textarea
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-20 resize-none"
                            placeholder="اسم الشارع، رقم العمارة، علامة مميزة..."
                        />
                        <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-8" />
                    </div>
                </div>

                <hr className="border-gray-100" />

                {/* Order Settings */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <BanknotesIcon className="w-5 h-5 text-gray-500" />
                        تفاصيل الطلب
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">طريقة الدفع</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="cod">الدفع عند الاستلام (COD)</option>
                                <option value="wallet">محفظة إلكترونية</option>
                                <option value="insta">Instapay</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">حالة الطلب</label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="PENDING">جديد (PENDING)</option>
                                <option value="CONFIRMED">مؤكد (CONFIRMED)</option>
                                <option value="PROCESSING">جاري التجهيز</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">ملاحظات داخلية</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-20 resize-none"
                            placeholder="أي ملاحظات إضافية للتيم..."
                        />
                    </div>
                </div>

            </div>

            {/* Action Button */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
                <button
                    onClick={handleCreateOrder}
                    disabled={loading || cartItems.length === 0}
                    className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-white font-bold transition-all ${loading || cartItems.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
                        }`}
                >
                    {loading ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <CheckCircleIcon className="w-6 h-6" />
                            <span>إنشاء الطلب الآن</span>
                        </>
                    )}
                </button>
            </div>

        </div>
    );
};

export default CheckoutColumn;

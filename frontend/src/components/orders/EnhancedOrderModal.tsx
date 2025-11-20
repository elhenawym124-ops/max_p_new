import React from 'react';
import { XMarkIcon, ChatBubbleLeftRightIcon, StarIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useCurrency } from '../../hooks/useCurrency';
import { useDateFormat } from '../../hooks/useDateFormat';

interface EnhancedOrderModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

const EnhancedOrderModal: React.FC<EnhancedOrderModalProps> = ({ order, isOpen, onClose }) => {
  const { formatPrice } = useCurrency();
  const { formatDate } = useDateFormat();

  if (!isOpen || !order) return null;

  const getCustomerDisplayName = () => {
    if (order.customer) {
      return `${order.customer.firstName} ${order.customer.lastName}`.trim();
    }
    
    if (order.customerName && !order.customerName.match(/^\d+/)) {
      return order.customerName;
    }
    
    if (order.customerName && order.customerName.match(/^\d+/)) {
      return `عميل فيسبوك (${order.customerName.substring(0, 8)}...)`;
    }
    
    return 'عميل غير محدد';
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence?: number) => {
    if (!confidence) return <InformationCircleIcon className="h-4 w-4" />;
    
    if (confidence >= 0.8) return <StarIcon className="h-4 w-4" />;
    return <ExclamationTriangleIcon className="h-4 w-4" />;
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

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              تفاصيل الطلب {order.orderNumber}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Customer Info */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">معلومات العميل</h4>
              <div className="bg-gray-50 p-3 rounded">
                <p><strong>الاسم:</strong> {getCustomerDisplayName()}</p>
                {order.customerPhone && (
                  <p><strong>الهاتف:</strong> {order.customerPhone}</p>
                )}
                {order.customerEmail && (
                  <p><strong>البريد الإلكتروني:</strong> {order.customerEmail}</p>
                )}
                {order.city && (
                  <p><strong>المدينة:</strong> {order.city}</p>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">المنتجات</h4>
              <div className="bg-gray-50 p-3 rounded">
                {order.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-600">الكمية: {item.quantity}</p>
                      {(item.productColor || item.productSize) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {item.productColor && <span>اللون: {item.productColor} </span>}
                          {item.productSize && <span>المقاس: {item.productSize}</span>}
                        </div>
                      )}
                      {item.confidence && (
                        <div className={`flex items-center mt-1 ${getConfidenceColor(item.confidence)}`}>
                          {getConfidenceIcon(item.confidence)}
                          <span className="text-xs ml-1">
                            ثقة: {(item.confidence * 100).toFixed(1)}%
                          </span>
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
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between py-1">
                    <span>الضريبة:</span>
                    <span>{formatPrice(order.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span>الشحن:</span>
                  <span>{formatPrice(order.shipping)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold border-t border-gray-300 mt-2 pt-2">
                  <span>المجموع الإجمالي:</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            {/* AI Extraction Info */}
            {(order.confidence || order.extractionMethod) && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">معلومات الاستخراج</h4>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded border border-blue-200">
                  {order.confidence && (
                    <div className={`flex items-center ${getConfidenceColor(order.confidence)}`}>
                      {getConfidenceIcon(order.confidence)}
                      <span className="text-sm ml-1 font-medium">
                        مستوى الثقة: {(order.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {order.extractionMethod && (
                    <p className="text-sm text-gray-600 mt-1">
                      طريقة الاستخراج: {order.extractionMethod === 'ai_enhanced' ? '🤖 ذكاء اصطناعي محسن' :
                                        order.extractionMethod === 'ai_basic' ? '🤖 ذكاء اصطناعي أساسي' :
                                        order.extractionMethod === 'manual' ? '✋ يدوي' : order.extractionMethod}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Order Status */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">حالة الطلب</h4>
              <div className="bg-gray-50 p-3 rounded">
                <div className="flex justify-between items-center">
                  <span>الحالة الحالية:</span>
                  <span className="font-medium text-blue-600">{getStatusText(order.status)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span>حالة الدفع:</span>
                  <span className={`font-medium ${
                    order.paymentStatus === 'COMPLETED' ? 'text-green-600' :
                    order.paymentStatus === 'FAILED' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {order.paymentStatus === 'COMPLETED' ? 'مدفوع' :
                     order.paymentStatus === 'FAILED' ? 'فشل' : 'في الانتظار'}
                  </span>
                </div>
              </div>
            </div>

            {/* Conversation Link */}
            {order.conversationId && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">المحادثة</h4>
                <div className="bg-gray-50 p-3 rounded">
                  <button
                    onClick={() => {
                      const url = `/conversations-improved?conversationId=${order.conversationId}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <ChatBubbleLeftRightIcon className="h-4 w-4 ml-1" />
                    عرض المحادثة الأصلية
                  </button>
                </div>
              </div>
            )}

            {order.notes && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">ملاحظات</h4>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedOrderModal;

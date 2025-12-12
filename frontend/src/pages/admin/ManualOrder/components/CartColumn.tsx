import React from 'react';
import { TrashIcon, CalculatorIcon } from '@heroicons/react/24/outline';
import { CartItem } from '../types';

interface CartColumnProps {
    items: CartItem[];
    onUpdateItem: (productId: string, updates: Partial<CartItem>, variantId?: string) => void;
    onRemoveItem: (productId: string, variantId?: string) => void;
}

const CartColumn: React.FC<CartColumnProps> = ({ items, onUpdateItem, onRemoveItem }) => {
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="font-semibold text-gray-800">سلة الطلب ({items.length})</h2>
                <div className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    الإجمالي: {totalAmount.toLocaleString()} جنيه
                </div>
            </div>

            <div className="p-2 flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <CalculatorIcon className="w-12 h-12 mb-2 opacity-50" />
                        <p>السلة فارغة</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div key={item.productId} className="flex gap-3 p-3 bg-white border border-gray-100 rounded-lg group hover:border-blue-200 transition-colors">
                                {/* Image */}
                                <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200" />
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</h3>
                                        {item.variantName && (
                                            <div className="text-xs text-blue-600 font-medium mt-0.5 max-w-[150px] truncate">
                                                {item.variantName}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => onRemoveItem(item.productId, item.variantId)}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4 mt-2">
                                        {/* Quantity Control */}
                                        <div className="flex items-center border border-gray-200 rounded-md bg-gray-50">
                                            <button
                                                className="px-2 py-1 hover:bg-gray-200 text-gray-600 font-bold"
                                                onClick={() => {
                                                    if (item.quantity > 1) onUpdateItem(item.productId, { quantity: item.quantity - 1 }, item.variantId);
                                                    else onRemoveItem(item.productId, item.variantId);
                                                }}
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    if (val >= 0) onUpdateItem(item.productId, { quantity: val }, item.variantId);
                                                }}
                                                className="w-12 text-center text-sm bg-transparent border-none focus:ring-0 p-1"
                                            />
                                            <button
                                                className="px-2 py-1 hover:bg-gray-200 text-gray-600 font-bold"
                                                onClick={() => onUpdateItem(item.productId, { quantity: item.quantity + 1 }, item.variantId)}
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Price Control */}
                                        <div className="flex-1">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        onUpdateItem(item.productId, { price: val }, item.variantId);
                                                    }}
                                                    className={`w-full text-sm border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-2 pl-8 font-bold ${item.price !== item.originalPrice ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-gray-700'}`}
                                                />
                                                <span className="absolute left-2 top-1.5 text-xs text-gray-400">ج.م</span>
                                            </div>
                                            {item.price !== item.originalPrice && (
                                                <div className="text-[10px] text-gray-400 mt-0.5 text-right flex justify-end gap-1">
                                                    <span>الأصلي: {item.originalPrice}</span>
                                                    <button
                                                        className="text-blue-500 hover:underline"
                                                        onClick={() => onUpdateItem(item.productId, { price: item.originalPrice }, item.variantId)}
                                                    >
                                                        (استعادة)
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Total for Item */}
                                        <div className="text-sm font-bold text-gray-700 min-w-[60px] text-left">
                                            {(item.price * item.quantity).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer / Summary */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-600">عدد القطع:</span>
                    <span className="font-medium">{items.reduce((acc, item) => acc + item.quantity, 0)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                    <span className="text-gray-800">الإجمالي النهائي:</span>
                    <span className="text-blue-600">{totalAmount.toLocaleString()} ج.م</span>
                </div>
            </div>
        </div>
    );
};

export default CartColumn;

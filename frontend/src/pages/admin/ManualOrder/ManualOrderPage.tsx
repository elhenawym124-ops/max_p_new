import React, { useState } from 'react';
import ProductSearchColumn from './components/ProductSearchColumn';
import CartColumn from './components/CartColumn';
import CheckoutColumn from './components/CheckoutColumn';
import { toast } from 'react-hot-toast';
import { CartItem } from './types';

const ManualOrderPage = () => {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    const handleAddToCart = (product: any, variant?: any) => {
        // Create unique ID based on product AND variant
        const itemId = variant ? `${product.id}-${variant.id}` : product.id;

        const existing = cartItems.find(item => {
            if (variant) {
                return item.productId === product.id && item.variantId === variant.id;
            }
            return item.productId === product.id && !item.variantId;
        });

        if (existing) {
            toast.success('تم زيادة الكمية');
            setCartItems(prev => prev.map(item => {
                const currentItemId = item.variantId ? `${item.productId}-${item.variantId}` : item.productId;
                return currentItemId === itemId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item;
            }));
        } else {
            toast.success('تمت الإضافة للسلة');

            // Determine price and image
            const price = variant ? parseFloat(variant.price) : product.price;
            const image = (variant && variant.image) ? variant.image : product.image;
            const stock = variant ? variant.stock : product.stock;
            const sku = variant ? variant.sku : product.sku;

            // Construct variant name
            let variantName = '';
            if (variant) {
                const parts = [];
                if (variant.color) parts.push(variant.color);
                if (variant.size) parts.push(variant.size);
                variantName = parts.join(' / ');
            }

            setCartItems(prev => [...prev, {
                productId: product.id,
                variantId: variant?.id,
                name: product.name,
                variantName: variantName,
                price: price,
                originalPrice: price,
                quantity: 1,
                image: image,
                stock: stock,
                color: variant?.color,
                size: variant?.size,
                sku: sku
            }]);
        }
    };

    const handleUpdateItem = (productId: string, updates: Partial<CartItem>, variantId?: string) => {
        setCartItems(prev => prev.map(item => {
            const isMatch = variantId
                ? (item.productId === productId && item.variantId === variantId)
                : (item.productId === productId && !item.variantId);

            return isMatch ? { ...item, ...updates } : item;
        }));
    };

    const handleRemoveItem = (productId: string, variantId?: string) => {
        setCartItems(prev => prev.filter(item => {
            const isMatch = variantId
                ? (item.productId === productId && item.variantId === variantId)
                : (item.productId === productId && !item.variantId);
            return !isMatch;
        }));
        toast.success('تم حذف المنتج');
    };

    return (
        <div className="h-[calc(100vh-64px)] p-4 bg-gray-50/50">
            <div className="h-full grid grid-cols-12 gap-4">
                {/* Product Search - 5 Cols (Wider) */}
                <div className="col-span-12 lg:col-span-5 h-full">
                    <ProductSearchColumn onAddToCart={handleAddToCart} />
                </div>

                {/* Cart Items - 4 Cols (Smaller) */}
                <div className="col-span-12 lg:col-span-4 h-full">
                    <CartColumn
                        items={cartItems}
                        onUpdateItem={handleUpdateItem}
                        onRemoveItem={handleRemoveItem}
                    />
                </div>

                {/* Checkout & Customer - 3 Cols */}
                <div className="col-span-12 lg:col-span-3 h-full">
                    <CheckoutColumn cartItems={cartItems} />
                </div>
            </div>
        </div>
    );
};

export default ManualOrderPage;

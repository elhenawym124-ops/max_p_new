import React, { useState, useEffect } from 'react';
import { ShoppingCartIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { storefrontApi } from '../../utils/storefrontApi';

interface StickyAddToCartProps {
  enabled: boolean;
  showOnMobile: boolean;
  showOnDesktop: boolean;
  product: {
    id: string;
    name: string;
    price: number;
    stock: number;
    images: string | string[];
  };
  selectedVariant?: string | null;
  onQuantityChange?: (quantity: number) => void;
}

const StickyAddToCart: React.FC<StickyAddToCartProps> = ({
  enabled,
  showOnMobile,
  showOnDesktop,
  product,
  selectedVariant,
  onQuantityChange
}) => {
  const [quantity, setQuantity] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Show sticky bar when scrolled past 300px and not at bottom
      setIsVisible(scrollPosition > 300 && scrollPosition < documentHeight - windowHeight - 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enabled]);

  useEffect(() => {
    if (onQuantityChange) {
      onQuantityChange(quantity);
    }
  }, [quantity, onQuantityChange]);

  const handleAddToCart = async () => {
    try {
      setAdding(true);
      await storefrontApi.addToCart({
        productId: product.id,
        quantity,
        ...(selectedVariant && { variantId: selectedVariant })
      });
      toast.success('تمت إضافة المنتج للسلة');
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('حدث خطأ في إضافة المنتج');
    } finally {
      setAdding(false);
    }
  };

  if (!enabled || !isVisible) return null;

  // Check visibility based on screen size
  const shouldShow = (showOnMobile && window.innerWidth < 768) || 
                     (showOnDesktop && window.innerWidth >= 768);

  if (!shouldShow) return null;

  // Parse images
  let productImage = '';
  try {
    if (typeof product.images === 'string') {
      const parsed = JSON.parse(product.images);
      productImage = Array.isArray(parsed) ? parsed[0] : parsed;
    } else if (Array.isArray(product.images)) {
      productImage = product.images[0];
    }
  } catch (e) {
    // Ignore
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg md:block">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Product Image & Name */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {productImage && (
              <img
                src={productImage}
                alt={product.name}
                className="w-12 h-12 object-cover rounded"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate text-sm">{product.name}</h3>
              <p className="text-sm font-bold text-indigo-600">{product.price} جنيه</p>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-2 hover:bg-gray-100"
            >
              <MinusIcon className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
              disabled={quantity >= product.stock}
              className="p-2 hover:bg-gray-100 disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0 || adding}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
              product.stock === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <ShoppingCartIcon className="h-5 w-5" />
            <span>{product.stock === 0 ? 'غير متوفر' : adding ? 'جاري الإضافة...' : 'أضف للسلة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StickyAddToCart;


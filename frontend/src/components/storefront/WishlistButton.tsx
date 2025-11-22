import React, { useState, useEffect } from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { wishlistApi } from '../../utils/wishlistApi';

interface WishlistButtonProps {
  productId: string;
  variantId?: string;
  enabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const WishlistButton: React.FC<WishlistButtonProps> = ({
  productId,
  variantId,
  enabled = true,
  className = '',
  size = 'md'
}) => {
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (enabled) {
      checkWishlistStatus();
    }
  }, [productId, variantId, enabled]);

  const checkWishlistStatus = async () => {
    try {
      setChecking(true);
      const data = await wishlistApi.getWishlist();
      if (data.success && data.data.items) {
        const exists = data.data.items.some(
          (item: any) => item.productId === productId && (!variantId || item.variantId === variantId)
        );
        setIsInWishlist(exists);
      }
    } catch (error) {
      console.error('Error checking wishlist status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!enabled || loading) return;

    try {
      setLoading(true);

      if (isInWishlist) {
        await wishlistApi.removeFromWishlist(productId, variantId);
        setIsInWishlist(false);
        toast.success('تم حذف المنتج من المفضلة');
      } else {
        await wishlistApi.addToWishlist(productId, variantId);
        setIsInWishlist(true);
        toast.success('تمت إضافة المنتج للمفضلة');
      }

      // Dispatch event to update wishlist count in header
      window.dispatchEvent(new Event('wishlistUpdated'));
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      toast.error('حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading || checking}
      className={`${className} ${loading || checking ? 'opacity-50 cursor-wait' : ''} transition-colors`}
      title={isInWishlist ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
    >
      {isInWishlist ? (
        <HeartIconSolid className={`${sizeClasses[size]} text-red-500`} />
      ) : (
        <HeartIcon className={`${sizeClasses[size]} text-gray-600 hover:text-red-500`} />
      )}
    </button>
  );
};

export default WishlistButton;


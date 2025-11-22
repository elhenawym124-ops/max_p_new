import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCartIcon, MinusIcon, PlusIcon, TruckIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { storefrontApi, getCompanyId } from '../../utils/storefrontApi';
import axios from 'axios';
import { getApiUrl } from '../../config/environment';
import StorefrontNav from '../../components/StorefrontNav';
import VolumeDiscountBadge from '../../components/VolumeDiscountBadge';
import RelatedProducts from '../../components/RelatedProducts';
import FrequentlyBoughtTogether from '../../components/FrequentlyBoughtTogether';
import ProductImageZoom from '../../components/storefront/ProductImageZoom';
import { storefrontSettingsService } from '../../services/storefrontSettingsService';
import { recentlyViewedApi } from '../../utils/storefrontApi';
import WishlistButton from '../../components/storefront/WishlistButton';
import RecentlyViewed from '../../components/storefront/RecentlyViewed';
import ProductReviews from '../../components/storefront/ProductReviews';
import CountdownTimer from '../../components/storefront/CountdownTimer';
import BackInStockNotification from '../../components/storefront/BackInStockNotification';
import SocialSharing from '../../components/storefront/SocialSharing';
import ProductBadges from '../../components/storefront/ProductBadges';
import ProductTabs from '../../components/storefront/ProductTabs';
import StickyAddToCart from '../../components/storefront/StickyAddToCart';
import { addToComparison } from '../../components/storefront/ProductComparison';
import { updateSEO, generateProductStructuredData, addStructuredData } from '../../utils/seo';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  stock: number;
  sku?: string;
  enableCheckoutForm?: boolean;
  showAddToCartButton?: boolean;
  saleStartDate?: string; // 📅 تاريخ بداية العرض
  saleEndDate?: string; // 📅 تاريخ انتهاء العرض
  createdAt?: string;
  isFeatured?: boolean;
  specifications?: string;
  category?: {
    id: string;
    name: string;
  };
  variants?: Array<{
    id: string;
    name: string;
    type: string;
    price?: number;
    stock: number;
    images: string[];
  }>;
}

interface FreeShippingSettings {
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  freeShippingMessage: string;
}

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [showCheckoutForm] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [freeShippingSettings, setFreeShippingSettings] = useState<FreeShippingSettings | null>(null);
  const [cartTotal, setCartTotal] = useState(0);
  const [storefrontSettings, setStorefrontSettings] = useState<any>(null);
  const [formData, setFormData] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    city: '',
    shippingAddress: '',
    paymentMethod: 'CASH',
    notes: ''
  });

  // التحقق من وجود companyId عند التحميل
  useEffect(() => {
    const companyId = getCompanyId();
    if (!companyId) {
      toast.error('⚠️ يجب زيارة المتجر من رابط صحيح يحتوي على معرف الشركة');
      console.error('❌ [ProductDetails] No companyId found. Redirecting to shop...');
      navigate('/shop');
      return;
    }
    
    if (id) {
      fetchProduct();
      fetchFreeShippingSettings();
      fetchCartTotal();
      fetchStorefrontSettings();
    }
  }, [id, navigate]);

  const fetchStorefrontSettings = async () => {
    try {
      const companyId = getCompanyId();
      if (companyId) {
        const data = await storefrontSettingsService.getPublicSettings(companyId);
        if (data.success && data.data) {
          console.log('✅ [ProductDetails] Storefront settings loaded:', {
            quickViewEnabled: data.data.quickViewEnabled,
            comparisonEnabled: data.data.comparisonEnabled,
            wishlistEnabled: data.data.wishlistEnabled,
            reviewsEnabled: data.data.reviewsEnabled,
            countdownEnabled: data.data.countdownEnabled,
            countdownShowOnProduct: data.data.countdownShowOnProduct,
            countdownShowOnListing: data.data.countdownShowOnListing,
            recentlyViewedEnabled: data.data.recentlyViewedEnabled,
            recentlyViewedCount: data.data.recentlyViewedCount
          });
          setStorefrontSettings(data.data);
        } else {
          console.warn('⚠️ [ProductDetails] Failed to load storefront settings, using disabled defaults');
          // Set to null to ensure features are hidden
          setStorefrontSettings(null);
        }
      }
    } catch (error) {
      console.error('❌ [ProductDetails] Error fetching storefront settings:', error);
      // Set to null to ensure features are hidden on error
      setStorefrontSettings(null);
    }
  };

  const fetchFreeShippingSettings = async () => {
    try {
      const companyId = getCompanyId();
      const apiUrl = getApiUrl();
      const response = await axios.get(`${apiUrl}/public/promotion-settings/${companyId}`);
      
      if (response.data.success) {
        setFreeShippingSettings(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching free shipping settings:', error);
    }
  };

  const fetchCartTotal = async () => {
    try {
      const data = await storefrontApi.getCart();
      if (data.success && data.data.items) {
        const total = data.data.items.reduce((sum: number, item: any) => 
          sum + (item.price * item.quantity), 0
        );
        setCartTotal(total);
      }
    } catch (error) {
      console.error('Error fetching cart total:', error);
    }
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const data = await storefrontApi.getProduct(id!);
      
      if (data.success) {
        console.log('🔍 [ProductDetails] Product data received:', {
          id: data.data.id,
          name: data.data.name,
          comparePrice: data.data.comparePrice,
          price: data.data.price,
          saleStartDate: data.data.saleStartDate,
          saleEndDate: data.data.saleEndDate,
          hasSaleEndDate: !!data.data.saleEndDate,
          saleEndDateValid: data.data.saleEndDate ? new Date(data.data.saleEndDate) > new Date() : false,
          fullProductData: data.data // Log full product data to see all fields
        });
        setProduct(data.data);
        
        // Parse images from JSON string
        let productImages: string[] = [];
        try {
          if (data.data.images && typeof data.data.images === 'string') {
            productImages = JSON.parse(data.data.images);
          } else if (Array.isArray(data.data.images)) {
            productImages = data.data.images;
          }
        } catch (e) {
          console.error('Error parsing product images:', e);
        }
        
        if (productImages.length > 0) {
          setSelectedImage(0);
        }

        // Record product view for recently viewed
        // Check if recentlyViewedEnabled exists and is true
        const isRecentlyViewedEnabled = storefrontSettings?.recentlyViewedEnabled === true;
        if (isRecentlyViewedEnabled && id) {
          try {
            const result = await recentlyViewedApi.recordView(id);
            console.log('✅ [ProductDetails] Product view recorded:', {
              productId: id,
              success: result.success
            });
          } catch (error) {
            console.error('❌ [ProductDetails] Error recording product view:', error);
          }
        } else {
          console.log('ℹ️ [ProductDetails] Recently viewed disabled or no product ID:', {
            recentlyViewedEnabled: storefrontSettings?.recentlyViewedEnabled,
            isEnabled: isRecentlyViewedEnabled,
            productId: id
          });
        }

        // Update SEO
        if (storefrontSettings?.seoEnabled) {
          const productImages = Array.isArray(data.data.images) 
            ? data.data.images 
            : typeof data.data.images === 'string' 
              ? JSON.parse(data.data.images || '[]') 
              : [];
          
          if (storefrontSettings.seoMetaDescription) {
            updateSEO({
              title: `${data.data.name} - متجرنا`,
              description: data.data.description || data.data.name,
              image: productImages[0],
              url: window.location.href,
              type: 'product'
            });
          }

          if (storefrontSettings.seoStructuredData) {
            const structuredData = generateProductStructuredData(data.data);
            addStructuredData(structuredData);
          }
        }
      } else {
        toast.error('المنتج غير موجود');
        navigate('/shop');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('حدث خطأ في جلب المنتج');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    if (!product) return;
    
    try {
      const data = await storefrontApi.addToCart({
        productId: product.id,
        quantity,
        ...(selectedVariant && { variantId: selectedVariant })
      });
      
      if (data.success) {
        // Backend returns cart object with cartId
        if (data.data?.cartId) {
          localStorage.setItem('cart_session_id', data.data.cartId);
        }
        toast.success('تمت إضافة المنتج للسلة');
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        toast.error(data.message || 'حدث خطأ');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('حدث خطأ في إضافة المنتج');
    }
  };

  const handleFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleDirectCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product) return;
    
    // Validation
    if (!formData.guestName.trim()) {
      toast.error('الاسم الكامل مطلوب');
      return;
    }
    if (!formData.guestPhone.trim()) {
      toast.error('رقم الهاتف مطلوب');
      return;
    }
    if (!formData.city.trim()) {
      toast.error('المدينة مطلوبة');
      return;
    }
    if (!formData.shippingAddress.trim()) {
      toast.error('العنوان التفصيلي مطلوب');
      return;
    }

    try {
      setSubmitting(true);
      
      // Create order directly with single product
      const orderData = {
        items: [{
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity,
          variantId: selectedVariant || null
        }],
        guestName: formData.guestName,
        guestPhone: formData.guestPhone,
        guestEmail: formData.guestEmail || formData.guestPhone, // Use phone as fallback
        shippingAddress: {
          governorate: formData.city,
          city: formData.city,
          street: formData.shippingAddress,
          building: '',
          floor: '',
          apartment: ''
        },
        paymentMethod: formData.paymentMethod,
        notes: formData.notes || ''
      };

      const data = await storefrontApi.createOrder(orderData);

      if (data.success) {
        // Clear cart from database
        try {
          await storefrontApi.clearCart();
        } catch (error) {
          console.error('Error clearing cart:', error);
          // لا نوقف العملية إذا فشل حذف السلة
        }
        
        // Clear cart session from localStorage
        localStorage.removeItem('cart_session_id');
        
        // Notify cart update
        window.dispatchEvent(new Event('cartUpdated'));
        
        toast.success('تم إنشاء الطلب بنجاح! 🎉');
        const companyId = getCompanyId();
        // Navigate to order confirmation with order number and phone for tracking
        navigate(`/shop/order-confirmation/${data.data.orderNumber}?phone=${encodeURIComponent(formData.guestPhone)}&companyId=${companyId}`);
      } else {
        toast.error(data.message || 'حدث خطأ في إنشاء الطلب');
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'حدث خطأ في إنشاء الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-96 bg-gray-200 rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const currentPrice = selectedVariant 
    ? product.variants?.find(v => v.id === selectedVariant)?.price || product.price
    : product.price;

  const currentStock = selectedVariant
    ? product.variants?.find(v => v.id === selectedVariant)?.stock || 0
    : product.stock;

  return (
    <>
      <StorefrontNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center space-x-2 space-x-reverse">
          <li>
            <button onClick={() => navigate('/shop')} className="text-blue-600 hover:underline">
              المنتجات
            </button>
          </li>
          <li className="text-gray-500">/</li>
          {product.category && (
            <>
              <li className="text-gray-700">{product.category.name}</li>
              <li className="text-gray-500">/</li>
            </>
          )}
          <li className="text-gray-900 font-medium">{product.name}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          {/* Parse images for display */}
          {(() => {
            let productImages: string[] = [];
            try {
              if (product.images && typeof product.images === 'string') {
                productImages = JSON.parse(product.images);
              } else if (Array.isArray(product.images)) {
                productImages = product.images;
              }
            } catch (e) {
              console.error('Error parsing product images:', e);
            }
            
            return (
              <>
                {/* Main Image with Zoom */}
                {storefrontSettings?.imageZoomEnabled ? (
                  <ProductImageZoom
                    images={productImages}
                    alt={product.name}
                    enabled={storefrontSettings.imageZoomEnabled}
                    zoomType={storefrontSettings.imageZoomType as 'hover' | 'click' | 'both'}
                    className="h-96 bg-gray-100 rounded-lg overflow-hidden"
                  />
                ) : (
                  <div className="relative h-96 bg-gray-100 rounded-lg overflow-hidden">
                    {productImages.length > 0 && productImages[selectedImage] ? (
                      <img
                        src={productImages[selectedImage]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400"><span class="text-6xl">📦</span></div>';
                        }}
                      />
                    ) : (
                      <div className="w-full h-96 flex items-center justify-center text-gray-400">
                        <span className="text-6xl">📦</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Thumbnails - Only show if zoom is disabled or for manual selection */}
                {productImages.length > 1 && !storefrontSettings?.imageZoomEnabled && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {productImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`bg-gray-100 rounded-lg overflow-hidden border-2 transition-colors ${
                          selectedImage === index ? 'border-blue-600' : 'border-transparent'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-20 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Product Info */}
        <div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              {product.category && (
                <p className="text-gray-600">{product.category.name}</p>
              )}
            </div>
            {/* Social Sharing */}
            {storefrontSettings?.socialSharingEnabled && (
              <SocialSharing
                enabled={storefrontSettings.socialSharingEnabled}
                product={product}
                settings={{
                  shareFacebook: storefrontSettings.shareFacebook,
                  shareTwitter: storefrontSettings.shareTwitter,
                  shareWhatsApp: storefrontSettings.shareWhatsApp,
                  shareTelegram: storefrontSettings.shareTelegram
                }}
              />
            )}
          </div>

          {/* Price */}
          <div className="mb-6">
            <div className="flex flex-col gap-2">
              {product.comparePrice && product.comparePrice > currentPrice ? (
                <>
                  {/* السعر القديم */}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl text-gray-400 line-through">
                      {product.comparePrice} جنيه
                    </span>
                    <span className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold">
                      خصم {Math.round(((product.comparePrice - currentPrice) / product.comparePrice) * 100)}%
                    </span>
                  </div>
                  {/* السعر الحالي */}
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-red-600">
                      {currentPrice} جنيه
                    </span>
                    <span className="text-sm text-gray-600">السعر الحالي</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {currentPrice} جنيه
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stock Status */}
          <div className="mb-6">
            {currentStock > 0 ? (
              <p className="text-green-600 font-medium">
                ✓ متوفر في المخزون ({currentStock} قطعة)
              </p>
            ) : (
              <p className="text-red-600 font-medium">
                ✗ غير متوفر حالياً
              </p>
            )}
          </div>

          {/* Countdown Timer */}
          {(() => {
            const countdownEnabled = storefrontSettings?.countdownEnabled;
            const showOnProduct = storefrontSettings?.countdownShowOnProduct;
            const hasComparePrice = product.comparePrice && product.comparePrice > currentPrice;
            const hasSaleEndDate = product.saleEndDate;
            const saleEndDateValid = hasSaleEndDate && new Date(product.saleEndDate) > new Date();
            
            console.log('🔍 [ProductDetails] Countdown Timer Debug:', {
              countdownEnabled,
              showOnProduct,
              hasComparePrice,
              comparePrice: product.comparePrice,
              currentPrice,
              hasSaleEndDate,
              saleEndDate: product.saleEndDate,
              saleEndDateValid,
              willShow: countdownEnabled && showOnProduct && hasComparePrice && saleEndDateValid
            });
            
            return countdownEnabled && showOnProduct && hasComparePrice && saleEndDateValid ? (
              <div className="mb-6">
                <CountdownTimer
                  endDate={product.saleEndDate}
                  enabled={storefrontSettings.countdownEnabled}
                />
              </div>
            ) : null;
          })()}

          {/* Back in Stock Notification */}
          {storefrontSettings?.backInStockEnabled && currentStock === 0 && (
            <div className="mb-6">
              <BackInStockNotification
                productId={product.id}
                enabled={storefrontSettings.backInStockEnabled}
                notifyEmail={storefrontSettings.backInStockNotifyEmail}
                notifySMS={storefrontSettings.backInStockNotifySMS}
                stock={currentStock}
              />
            </div>
          )}

          {/* Free Shipping Banner */}
          {freeShippingSettings && freeShippingSettings.freeShippingEnabled && (() => {
            const productTotal = currentPrice * quantity;
            const totalWithCart = cartTotal + productTotal;
            const threshold = freeShippingSettings.freeShippingThreshold;
            const remaining = threshold - totalWithCart;
            const progress = Math.min((totalWithCart / threshold) * 100, 100);

            if (remaining > 0) {
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <TruckIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-900 font-medium mb-2">
                        🚚 أضف منتجات بقيمة <span className="font-bold">{remaining.toFixed(2)} جنيه</span> أخرى للحصول على شحن مجاني!
                      </p>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-blue-700 mt-1">{progress.toFixed(0)}% من الحد الأدنى</p>
                    </div>
                  </div>
                </div>
              );
            } else {
              return (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <TruckIcon className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-green-900 font-bold">
                      🎉 تهانينا! ستحصل على شحن مجاني مع هذا الطلب!
                    </p>
                  </div>
                </div>
              );
            }
          })()}

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">الخيارات المتاحة:</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant.id)}
                    disabled={variant.stock === 0}
                    className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors ${
                      selectedVariant === variant.id
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : variant.stock === 0
                        ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border-gray-300 hover:border-blue-600'
                    }`}
                  >
                    {variant.name}
                    {variant.stock === 0 && ' (غير متوفر)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">الكمية:</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <MinusIcon className="h-5 w-5" />
              </button>
              <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                disabled={quantity >= currentStock}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Volume Discounts */}
          {product && <VolumeDiscountBadge productId={product.id} quantity={quantity} />}

          {/* Actions - Show "Add to Cart" button if enabled and checkout form is disabled */}
          {product.showAddToCartButton !== false && product.enableCheckoutForm === false && (
            <div className="flex gap-3 mb-6">
              <button
                onClick={addToCart}
                disabled={currentStock === 0}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <ShoppingCartIcon className="h-5 w-5" />
                <span>أضف للسلة</span>
              </button>
              {storefrontSettings?.comparisonEnabled && (
                <button
                  onClick={() => {
                    addToComparison({
                      id: product.id,
                      name: product.name,
                      price: currentPrice,
                      comparePrice: product.comparePrice,
                      images: product.images,
                      stock: currentStock,
                      description: product.description,
                      category: product.category
                    });
                  }}
                  className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="أضف للمقارنة"
                >
                  <ArrowsRightLeftIcon className="h-5 w-5" />
                </button>
              )}
              {storefrontSettings?.wishlistEnabled && (
                <WishlistButton
                  productId={product.id}
                  variantId={selectedVariant || undefined}
                  enabled={storefrontSettings.wishlistEnabled}
                  className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                  size="lg"
                />
              )}
            </div>
          )}

          {/* Product Tabs */}
          {storefrontSettings?.tabsEnabled && (
            <ProductTabs
              enabled={storefrontSettings.tabsEnabled}
              product={{
                description: product.description,
                specifications: product.specifications,
                shippingInfo: 'سيتم التوصيل خلال 3-5 أيام عمل'
              }}
              reviews={
                storefrontSettings.tabReviews && storefrontSettings.reviewsEnabled ? (
                  <ProductReviews
                    productId={product.id}
                    enabled={storefrontSettings.reviewsEnabled}
                    requirePurchase={storefrontSettings.reviewsRequirePurchase}
                    showRating={storefrontSettings.reviewsShowRating}
                    minRatingToDisplay={storefrontSettings.minRatingToDisplay}
                  />
                ) : undefined
              }
              settings={{
                tabDescription: storefrontSettings.tabDescription,
                tabSpecifications: storefrontSettings.tabSpecifications,
                tabReviews: storefrontSettings.tabReviews,
                tabShipping: storefrontSettings.tabShipping
              }}
            />
          )}

          {/* Fallback Description if tabs disabled */}
          {!storefrontSettings?.tabsEnabled && product.description && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-900 mb-3">الوصف:</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* SKU */}
          {product.sku && (
            <div className="mt-4 text-sm text-gray-500">
              رمز المنتج: {product.sku}
            </div>
          )}

          {/* Inline Checkout Form */}
          {showCheckoutForm && product.enableCheckoutForm && (
            <div id="checkout-form" className="mt-8 border-t-2 border-gray-200 pt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-right">يرجى إدخال معلوماتك لإكمال الطلب</h3>
              <p className="text-sm text-gray-600 mb-6 text-right">عدد القطع: {quantity}</p>
              
              <form onSubmit={handleDirectCheckout} className="space-y-4">
                {/* Form Fields - Simplified Design */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-right">
                    اسمك بالكامل
                  </label>
                  <input
                    type="text"
                    name="guestName"
                    value={formData.guestName}
                    onChange={handleFormInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-right">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    name="guestPhone"
                    value={formData.guestPhone}
                    onChange={handleFormInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-right">
                    المحافظة
                  </label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleFormInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right bg-white"
                  >
                    <option value="">اختر المحافظة</option>
                    <option value="القاهرة">القاهرة</option>
                    <option value="الجيزة">الجيزة</option>
                    <option value="الإسكندرية">الإسكندرية</option>
                    <option value="الدقهلية">الدقهلية</option>
                    <option value="الشرقية">الشرقية</option>
                    <option value="المنوفية">المنوفية</option>
                    <option value="القليوبية">القليوبية</option>
                    <option value="البحيرة">البحيرة</option>
                    <option value="الغربية">الغربية</option>
                    <option value="بورسعيد">بورسعيد</option>
                    <option value="دمياط">دمياط</option>
                    <option value="الإسماعيلية">الإسماعيلية</option>
                    <option value="السويس">السويس</option>
                    <option value="كفر الشيخ">كفر الشيخ</option>
                    <option value="الفيوم">الفيوم</option>
                    <option value="بني سويف">بني سويف</option>
                    <option value="المنيا">المنيا</option>
                    <option value="أسيوط">أسيوط</option>
                    <option value="سوهاج">سوهاج</option>
                    <option value="قنا">قنا</option>
                    <option value="أسوان">أسوان</option>
                    <option value="الأقصر">الأقصر</option>
                    <option value="البحر الأحمر">البحر الأحمر</option>
                    <option value="الوادي الجديد">الوادي الجديد</option>
                    <option value="مطروح">مطروح</option>
                    <option value="شمال سيناء">شمال سيناء</option>
                    <option value="جنوب سيناء">جنوب سيناء</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-right">
                    العنوان بالتفصيل
                  </label>
                  <textarea
                    name="shippingAddress"
                    value={formData.shippingAddress}
                    onChange={handleFormInputChange}
                    required
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right resize-none"
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-right">
                    رقم هاتف بديل
                  </label>
                  <input
                    type="tel"
                    name="guestEmail"
                    value={formData.guestEmail}
                    onChange={handleFormInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                    placeholder=""
                  />
                </div>

                {/* Order Summary */}
                <div className="border-t border-gray-200 pt-4 mt-6">
                  <div className="flex justify-between text-gray-700 mb-2 text-right">
                    <span className="font-medium">تكلفة الشحن</span>
                    <span className="font-semibold">60 ج.م</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 text-right">
                    <span>الإجمالي</span>
                    <span>{(product.price * quantity) + 60} ج.م</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || currentStock === 0}
                  className="w-full px-6 py-4 bg-black text-white rounded-md font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-lg"
                >
                  {submitting ? 'جاري إنشاء الطلب...' : 'اضغط هنا للشراء'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Frequently Bought Together */}
      {product && getCompanyId() && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <FrequentlyBoughtTogether
            productId={product.id}
            companyId={getCompanyId()!}
            currentProduct={{
              id: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              salePrice: product.comparePrice || undefined,
              images: product.images,
              stock: product.stock
            }}
            onAddToCart={async (productIds) => {
              // إضافة كل المنتجات المحددة للسلة
              try {
                for (const id of productIds) {
                  if (id === product.id) {
                    await addToCart();
                  } else {
                    // إضافة المنتجات الأخرى للسلة
                    await storefrontApi.addToCart({
                      productId: id,
                      variantId: null,
                      quantity: 1
                    });
                  }
                }
                toast.success('تم إضافة المنتجات للسلة');
              } catch (error) {
                console.error('Error adding products to cart:', error);
                toast.error('حدث خطأ أثناء إضافة المنتجات للسلة');
              }
            }}
          />
        </div>
      )}

      {/* Related Products */}
      {product && getCompanyId() && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <RelatedProducts
            productId={product.id}
            companyId={getCompanyId()!}
            limit={6}
          />
        </div>
      )}

      {/* Recently Viewed */}
      {storefrontSettings?.recentlyViewedEnabled && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <RecentlyViewed
            enabled={storefrontSettings.recentlyViewedEnabled}
            count={storefrontSettings.recentlyViewedCount}
          />
        </div>
      )}

      {/* Product Reviews (if not in tabs) */}
      {(() => {
        if (product) {
          console.log('🔍 [ProductDetails] Reviews Debug:', {
            hasProduct: !!product,
            hasSettings: !!storefrontSettings,
            reviewsEnabled: storefrontSettings?.reviewsEnabled,
            tabsEnabled: storefrontSettings?.tabsEnabled,
            tabReviews: storefrontSettings?.tabReviews,
            willShowInTabs: storefrontSettings?.tabsEnabled && storefrontSettings?.tabReviews && storefrontSettings?.reviewsEnabled,
            willShowOutside: storefrontSettings?.reviewsEnabled && !storefrontSettings?.tabsEnabled
          });
        }
        return null;
      })()}
      {product && storefrontSettings?.reviewsEnabled && !storefrontSettings?.tabsEnabled && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ProductReviews
            productId={product.id}
            enabled={storefrontSettings.reviewsEnabled}
            requirePurchase={storefrontSettings.reviewsRequirePurchase}
            showRating={storefrontSettings.reviewsShowRating}
            minRatingToDisplay={storefrontSettings.minRatingToDisplay}
          />
        </div>
      )}

      {/* Sticky Add to Cart */}
      {product && storefrontSettings?.stickyAddToCartEnabled && (
        <StickyAddToCart
          enabled={storefrontSettings.stickyAddToCartEnabled}
          showOnMobile={storefrontSettings.stickyShowOnMobile}
          showOnDesktop={storefrontSettings.stickyShowOnDesktop}
          product={{
            id: product.id,
            name: product.name,
            price: currentPrice,
            stock: currentStock,
            images: product.images
          }}
          selectedVariant={selectedVariant}
          onQuantityChange={setQuantity}
        />
      )}
      </div>
    </>
  );
};

export default ProductDetails;

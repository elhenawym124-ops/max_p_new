import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/apiClient';
import { useCurrency } from '../../hooks/useCurrency';
import { getCurrencyByCode } from '../../utils/currency';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ProductEditNew Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto">
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg shadow-sm">
              <h3 className="font-bold text-lg mb-2">حدث خطأ غير متوقع</h3>
              <p className="mb-4">عذراً، حدث خطأ في تحميل الصفحة</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                إعادة تحميل الصفحة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Image component with error handling
interface SafeImageProps {
  src: string;
  alt: string;
  className: string;
  onError?: () => void;
}

const SafeImage: React.FC<SafeImageProps> = React.memo(({
  src, alt, className, onError
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const handleImageError = useCallback(() => {
    console.log('❌ [IMAGE-ERROR] Image failed to load:', src, 'Type:', typeof src);

    // Try to retry with different URL formats
    if (retryCount < 2 && src.includes('files.easy-orders.net')) {
      setRetryCount(prev => prev + 1);
      setIsLoading(true);
      // Force reload by changing src slightly
      const img = new Image();
      img.onload = () => setIsLoading(false);
      img.onerror = () => {
        setImageError(true);
        setIsLoading(false);
      };
      img.src = src + '?retry=' + retryCount;
      return;
    }

    setImageError(true);
    setIsLoading(false);
    if (onError) onError();
  }, [src, retryCount]);

  const handleImageLoad = useCallback(() => {
    console.log('✅ Image loaded successfully:', src);
    setIsLoading(false);
    setImageError(false);
  }, [src]);

  if (imageError || !src) {
    return (
      <div className={`${className} bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-2 border-dashed border-gray-300`}>
        <div className="text-center">
          <svg className="h-8 w-8 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-gray-500">لا توجد صورة</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`${className} bg-gray-100 flex items-center justify-center absolute inset-0 z-10`}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </div>
  );
});

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number; // 💰 سعر المقارنة (سعر قبل الخصم)
  cost?: number; // 💰 سعر التكلفة
  sku: string;
  stock: number;
  isActive: boolean;
  hasPromotedAd?: boolean;
  categoryId: string;
  images: string;
  updatedAt?: string;
  saleStartDate?: string; // 📅 تاريخ بداية العرض
  saleEndDate?: string; // 📅 تاريخ انتهاء العرض
  category?: {
    id: string;
    name: string;
  };
  variants?: ProductVariant[];
}

interface ProductVariant {
  id: string;
  productId?: string;        // موجود في قاعدة البيانات
  name: string;
  type: string;
  sku?: string;              // اختياري في قاعدة البيانات
  price?: number;            // اختياري في قاعدة البيانات
  comparePrice?: number;     // اختياري في قاعدة البيانات
  cost?: number;             // موجود في قاعدة البيانات
  stock: number;
  images?: string;           // اختياري في قاعدة البيانات
  isActive: boolean;
  sortOrder?: number;        // له قيمة افتراضية في قاعدة البيانات
  metadata?: string;         // موجود في قاعدة البيانات
  createdAt?: string;        // موجود في قاعدة البيانات
  updatedAt?: string;        // موجود في قاعدة البيانات
}

interface Category {
  id: string;
  name: string;
}

const ProductEditNew: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currency, isLoading: currencyLoading, error: currencyError } = useCurrency();

  // Get currency symbol for display
  const currencyInfo = getCurrencyByCode(currency || 'EGP');
  const displayCurrency = currencyInfo?.symbol || 'ج.م';
  
  // States
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    comparePrice: '', // 💰 سعر المقارنة (سعر قبل الخصم)
    cost: '', // 💰 سعر التكلفة
    sku: '',
    stock: 0,
    trackInventory: true,
    categoryId: '',
    isActive: true,
    hasPromotedAd: false,
    enableCheckoutForm: true,
    showAddToCartButton: true, // 🛒 إظهار زر إضافة للسلة
    saleStartDate: '', // 📅 تاريخ بداية العرض
    saleEndDate: '' // 📅 تاريخ انتهاء العرض
  });

  // Images and Variants states
  const [productImages, setProductImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantImages, setVariantImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [variantImageUrlInput, setVariantImageUrlInput] = useState('');
  const [imageUrlLoading, setImageUrlLoading] = useState(false);
  const [variantImageUrlLoading, setVariantImageUrlLoading] = useState(false);
  const [variantFormData, setVariantFormData] = useState({
    type: '',
    name: '',
    sku: '',
    price: '',
    comparePrice: '',
    cost: '',
    stock: 0,
    trackInventory: true,
    isActive: true
  });

  // Load product data
  const loadProduct = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/products/${id}`);
      const data = response.data;

      console.log('🔍 Loading product data...');

      // Check if data has the product nested inside
      let productData = data;
      if (data && !data.id && typeof data === 'object') {
        // Look for nested product data
        const possibleProductKeys = Object.keys(data).filter(key =>
          data[key] && typeof data[key] === 'object' && data[key].id
        );
        if (possibleProductKeys.length > 0) {
          productData = data[possibleProductKeys[0]];
        }
      }

      if (productData && productData.id) {
        setProduct(productData);

        // Update form data with explicit values
        const newFormData = {
          name: String(productData.name || ''),
          description: String(productData.description || ''),
          price: Number(productData.price) || 0,
          comparePrice: productData.comparePrice ? String(productData.comparePrice) : '', // 💰 سعر المقارنة
          cost: productData.cost ? String(productData.cost) : '', // 💰 سعر التكلفة
          sku: String(productData.sku || ''),
          stock: Number(productData.stock) || 0,
          trackInventory: Boolean(productData.trackInventory !== false),
          categoryId: String(productData.categoryId || ''),
          isActive: Boolean(productData.isActive !== false),
          hasPromotedAd: Boolean(productData.hasPromotedAd === true),
          enableCheckoutForm: Boolean(productData.enableCheckoutForm !== false),
          showAddToCartButton: Boolean(productData.showAddToCartButton !== false), // 🛒 إظهار زر إضافة للسلة
          saleStartDate: productData.saleStartDate ? new Date(productData.saleStartDate).toISOString().slice(0, 16) : '', // 📅 تاريخ بداية العرض
          saleEndDate: productData.saleEndDate ? new Date(productData.saleEndDate).toISOString().slice(0, 16) : '' // 📅 تاريخ انتهاء العرض
        };

        setFormData(newFormData);

        // Load images and variants
        console.log('🖼️ [PRODUCT-LOAD] Processing images:', productData.images, typeof productData.images);

        if (productData.images && productData.images !== '[]') {
          let images = [];

          try {
            // Handle different image data formats
            if (typeof productData.images === 'string') {
              // First, fix HTML entities
              const cleanImageString = productData.images
                .replace(/&#x2F;/g, '/')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'");

              console.log('🧹 [PRODUCT-LOAD] Cleaned image string:', cleanImageString);

              if (cleanImageString.startsWith('[') && cleanImageString.endsWith(']')) {
                try {
                  // JSON array format
                  images = JSON.parse(cleanImageString);
                  console.log('📋 [PRODUCT-LOAD] Parsed JSON array images:', images);
                } catch (parseError) {
                  console.log('⚠️ [PRODUCT-LOAD] Failed to parse JSON, trying comma split');
                  images = cleanImageString.slice(1, -1).split(',').filter(img => img.trim());
                }
              } else {
                // Comma-separated string format
                images = cleanImageString.split(',').filter(img => img.trim());
                console.log('📋 [PRODUCT-LOAD] Split comma-separated images:', images);
              }
            } else if (Array.isArray(productData.images)) {
              // Already an array
              images = productData.images;
              console.log('📋 [PRODUCT-LOAD] Using array images:', images);
            } else {
              console.log('⚠️ [PRODUCT-LOAD] Unknown image format:', productData.images);
            }

            // Process and clean image URLs
            const processedImages = images
              .filter(img => {
                // Filter out invalid images
                if (!img || typeof img !== 'string') return false;
                const trimmed = img.trim();
                if (!trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null' || trimmed === 'undefined') return false;
                // Filter out broken JSON fragments
                if (trimmed.startsWith('"') && !trimmed.endsWith('"')) return false;
                if (trimmed.includes('["') || trimmed.includes('"]')) return false;
                return true;
              })
              .map(img => {
                // Clean up the image URL
                let cleanImg = img.trim();

                // Remove quotes if present
                if (cleanImg.startsWith('"') && cleanImg.endsWith('"')) {
                  cleanImg = cleanImg.slice(1, -1);
                }

                // Fix HTML entities (already done above, but just in case)
                cleanImg = cleanImg
                  .replace(/&#x2F;/g, '/')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#x27;/g, "'");

                // Fix image URLs if needed
                if (cleanImg.startsWith('//')) {
                  // For external CDN images, try https first
                  return `https:${cleanImg}`;
                } else if (cleanImg.startsWith('/')) {
                  return `https://www.mokhtarelhenawy.online${cleanImg}`;
                } else if (cleanImg.startsWith('http')) {
                  // Already a full URL
                  return cleanImg;
                } else {
                  // If it's a relative path, make it absolute
                  return `https://www.mokhtarelhenawy.online/uploads/${cleanImg}`;
                }
              })
              .filter(img => {
                // Final filter to remove any remaining invalid URLs
                try {
                  new URL(img);
                  return true;
                } catch {
                  console.log('⚠️ [PRODUCT-LOAD] Invalid URL filtered out:', img);
                  return false;
                }
              });

            console.log('✅ [PRODUCT-LOAD] Final processed images:', processedImages);
            setProductImages(processedImages);
          } catch (error) {
            console.error('❌ [PRODUCT-LOAD] Error processing images:', error);
            console.log('🔄 [PRODUCT-LOAD] Falling back to empty images array');
            setProductImages([]);
          }
        } else {
          console.log('ℹ️ [PRODUCT-LOAD] No images to load');
          setProductImages([]);
        }

        if (productData.variants && productData.variants.length > 0) {
          // Fix HTML entities in variant images
          const fixedVariants = productData.variants.map(variant => ({
            ...variant,
            images: variant.images ?
              variant.images
                .replace(/&#x2F;/g, '/')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'") :
              ''
          }));
          setVariants(fixedVariants);
        } else {
          // No variants found - show empty state
          console.log('ℹ️ No variants found for this product');
          setVariants([]);
        }

        console.log('✅ Product loaded successfully:', productData.name);
      } else {
        console.error('❌ No valid product data received');
        setError('بيانات المنتج غير صحيحة');
      }
      
    } catch (error) {
      console.error('❌ Error loading product:', error);
      setError(error instanceof Error ? error.message : 'خطأ في تحميل المنتج');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const response = await apiClient.get(`/products/categories`);
      const data = response.data;

      if (data && Array.isArray(data)) {
        setCategories(data);
        console.log('✅ Categories loaded:', data.length);
      } else {
        // Check if data has a nested array property
        if (data && typeof data === 'object') {
          const possibleArrays = Object.keys(data).filter(key => Array.isArray(data[key]));
          if (possibleArrays.length > 0) {
            const arrayData = data[possibleArrays[0]];
            setCategories(arrayData);
            console.log('✅ Categories loaded:', arrayData.length);
            return;
          }
        }
        setCategories([]);
      }
    } catch (error) {
      console.error('❌ Error loading categories:', error);
      setCategories([]);
    }
  }, []);

  // Handle form input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    // Validate input based on type
    let processedValue: any = value;

    if (type === 'number') {
      const numValue = parseFloat(value);
      processedValue = isNaN(numValue) ? 0 : numValue;
    } else if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  }, []);

  // Save product
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !product) return;
    
    try {
      setSaving(true);
      setError(null);
      
      // Find category by name or ID
      let categoryToUse = formData.categoryId;
      if (!categoryToUse) {
        const foundCategory = categories.find(cat => 
          cat.name === formData.categoryId || cat.id === formData.categoryId
        );
        categoryToUse = foundCategory?.id || '';
      }
      
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: formData.price,
        sku: formData.sku.trim(),
        stock: formData.trackInventory ? formData.stock : 0,
        trackInventory: formData.trackInventory,
        category: categoryToUse,
        isActive: formData.isActive,
        hasPromotedAd: formData.hasPromotedAd,
        enableCheckoutForm: formData.enableCheckoutForm,
        showAddToCartButton: formData.showAddToCartButton, // 🛒 إظهار زر إضافة للسلة
        comparePrice: formData.comparePrice ? parseFloat(formData.comparePrice) : null, // 💰 سعر المقارنة
        cost: formData.cost ? parseFloat(formData.cost) : null, // 💰 سعر التكلفة
        saleStartDate: formData.saleStartDate ? new Date(formData.saleStartDate).toISOString() : null, // 📅 تاريخ بداية العرض
        saleEndDate: formData.saleEndDate ? new Date(formData.saleEndDate).toISOString() : null, // 📅 تاريخ انتهاء العرض
        tags: '[]'
      };
      
      console.log('🚀 Saving product with data:', updateData);

      const response = await apiClient.patch(`/products/${id}`, updateData);
      const updatedProduct = response.data;
      console.log('✅ Product updated successfully:', updatedProduct.name);
      
      // Update local state
      setProduct(updatedProduct);
      
      // Show success message
      toast.success('تم حفظ التغييرات بنجاح! ✅');
      
      // Reload data to ensure consistency
      setTimeout(() => {
        loadProduct();
      }, 500);
      
    } catch (error) {
      console.error('❌ Error saving product:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ في حفظ المنتج';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Manual reload
  const handleReload = async () => {
    console.log('🔄 Manual reload triggered');
    await Promise.all([loadProduct(), loadCategories()]);
    toast.success('تم تحديث البيانات! 🔄');
  };

  // Image management functions
  const handleImageUpload = async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('images', file);
    });

    try {
      const response = await apiClient.post(`/products/${id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setProductImages(prev => [...prev, ...response.data.data.images]);
        toast.success('تم رفع الصور بنجاح!');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('فشل في رفع الصور');
    }
  };

  // Add image from URL
  const handleImageFromUrl = async (imageUrl: string) => {
    if (!imageUrl.trim()) {
      toast.error('يرجى إدخال رابط الصورة');
      return;
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch {
      toast.error('رابط الصورة غير صحيح');
      return;
    }

    // Check if image already exists
    if (productImages.includes(imageUrl)) {
      toast.error('هذه الصورة موجودة بالفعل');
      return;
    }

    setImageUrlLoading(true);

    try {
      // Test if image loads with timeout
      const img = new Image();
      let timeoutId: NodeJS.Timeout;

      const imagePromise = new Promise<void>((resolve, reject) => {
        img.onload = () => {
          clearTimeout(timeoutId);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error('Image failed to load'));
        };

        // 10 second timeout
        timeoutId = setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 10000);
      });

      img.src = imageUrl;

      await imagePromise;

      try {
        // Save to backend
        const response = await apiClient.post(`/products/${id}/images/url`, {
          imageUrl: imageUrl
        });

        if (response.data.success) {
          setProductImages(prev => [...prev, imageUrl]);
          toast.success('تم إضافة الصورة من الرابط بنجاح!');
        } else {
          toast.error('فشل في حفظ الصورة');
        }
      } catch (saveError) {
        console.error('Error saving image URL:', saveError);
        // Add to UI anyway for better UX
        setProductImages(prev => [...prev, imageUrl]);
        toast.success('تم إضافة الصورة مؤقتاً (احفظ المنتج لحفظها نهائياً)');
      }

    } catch (error) {
      console.error('Error adding image from URL:', error);
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          toast.error('انتهت مهلة تحميل الصورة - تحقق من الرابط');
        } else {
          toast.error('لا يمكن تحميل الصورة من هذا الرابط');
        }
      } else {
        toast.error('فشل في إضافة الصورة');
      }
    } finally {
      setImageUrlLoading(false);
    }
  };

  const handleImageDelete = async (imageUrl: string) => {
    try {
      await apiClient.delete(`/products/${id}/images`, {
        data: { imageUrl }
      });

      setProductImages(prev => prev.filter(img => img !== imageUrl));
      toast.success('تم حذف الصورة بنجاح!');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('فشل في حذف الصورة');
    }
  };

  // Variant management functions
  const handleAddVariant = () => {
    setEditingVariant(null);
    setVariantImages([]);
    setVariantFormData({
      type: '',
      name: '',
      sku: '',
      price: '',
      comparePrice: '',
      cost: '',
      stock: 0,
      trackInventory: formData.trackInventory,
      isActive: true
    });
    setShowVariantModal(true);
  };

  const handleEditVariant = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setVariantFormData({
      type: variant.type || 'color',
      name: variant.name || '',
      sku: variant.sku || '',
      price: variant.price?.toString() || '',
      comparePrice: variant.comparePrice?.toString() || '',
      cost: variant.cost?.toString() || '',
      stock: variant.stock || 0,
      trackInventory: variant.trackInventory !== undefined ? variant.trackInventory : true,
      isActive: variant.isActive !== undefined ? variant.isActive : true
    });

    // Load variant images
    if (variant.images && typeof variant.images === 'string') {
      try {
        // Try to parse as JSON first (new format)
        const parsedImages = JSON.parse(variant.images);
        if (Array.isArray(parsedImages)) {
          setVariantImages(parsedImages.filter(img => img && typeof img === 'string' && img.trim()));
        } else {
          setVariantImages([]);
        }
      } catch (error) {
        // Fallback to comma-separated format (old format)
        const images = variant.images.split(',')
          .filter(img => {
            if (!img || typeof img !== 'string') return false;
            const trimmed = img.trim();
            if (!trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null') return false;
            return true;
          });
        setVariantImages(images);
      }
    } else {
      setVariantImages([]);
    }

    setShowVariantModal(true);
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المتغير؟')) return;

    try {
      await apiClient.delete(`/products/${id}/variants/${variantId}`);
      setVariants(prev => prev.filter(v => v.id !== variantId));
      toast.success('تم حذف المتغير بنجاح!');
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('فشل في حذف المتغير');
    }
  };

  // Variant image management
  const handleVariantImageUpload = async (files: FileList) => {
    const uploadedUrls: string[] = [];

    try {
      // Upload each file and get its URL
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('image', file);

        const response = await apiClient.post('/upload/single', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.success && response.data.data.fullUrl) {
          uploadedUrls.push(response.data.data.fullUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        setVariantImages(prev => [...prev, ...uploadedUrls]);
        toast.success(`تم رفع ${uploadedUrls.length} صورة بنجاح!`);
      }
    } catch (error) {
      console.error('Error uploading variant images:', error);
      toast.error('فشل في رفع صور المتغير');
    }
  };

  const handleVariantImageDelete = (imageUrl: string) => {
    setVariantImages(prev => prev.filter(img => img !== imageUrl));
    toast.success('تم حذف الصورة!');
  };

  // Add variant image from URL
  const handleVariantImageFromUrl = async (imageUrl: string) => {
    if (!imageUrl.trim()) {
      toast.error('يرجى إدخال رابط الصورة');
      return;
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch {
      toast.error('رابط الصورة غير صحيح');
      return;
    }

    // Check if image already exists
    if (variantImages.includes(imageUrl)) {
      toast.error('هذه الصورة موجودة بالفعل');
      return;
    }

    setVariantImageUrlLoading(true);

    try {
      // Test if image loads with timeout
      const img = new Image();
      let timeoutId: NodeJS.Timeout;

      const imagePromise = new Promise<void>((resolve, reject) => {
        img.onload = () => {
          clearTimeout(timeoutId);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error('Image failed to load'));
        };

        // 10 second timeout
        timeoutId = setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 10000);
      });

      img.src = imageUrl;
      await imagePromise;

      setVariantImages(prev => [...prev, imageUrl]);
      toast.success('تم إضافة صورة المتغير من الرابط بنجاح!');

    } catch (error) {
      console.error('Error adding variant image from URL:', error);
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          toast.error('انتهت مهلة تحميل الصورة - تحقق من الرابط');
        } else {
          toast.error('لا يمكن تحميل الصورة من هذا الرابط');
        }
      } else {
        toast.error('فشل في إضافة الصورة');
      }
    } finally {
      setVariantImageUrlLoading(false);
    }
  };

  const handleVariantInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setVariantFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!variantFormData.name || !variantFormData.name.trim()) {
      toast.error('اسم المتغير مطلوب');
      return;
    }

    if (!variantFormData.type || !variantFormData.type.trim()) {
      toast.error('نوع المتغير مطلوب');
      return;
    }

    try {
      // Prepare variant data - remove productId as it's not needed (comes from URL)
      const variantData: any = {
        name: variantFormData.name.trim(),
        type: variantFormData.type,
        trackInventory: variantFormData.trackInventory,
        isActive: variantFormData.isActive
      };

      // Add optional fields only if they have values
      if (variantFormData.sku && variantFormData.sku.trim()) {
        variantData.sku = variantFormData.sku.trim();
      }

      // Handle price - check if it's a valid number
      const priceStr = variantFormData.price?.toString().trim();
      if (priceStr && priceStr !== '') {
        const priceValue = parseFloat(priceStr);
        if (!isNaN(priceValue) && isFinite(priceValue)) {
          variantData.price = priceValue;
        }
      }

      // Handle comparePrice
      const comparePriceStr = variantFormData.comparePrice?.toString().trim();
      if (comparePriceStr && comparePriceStr !== '') {
        const comparePriceValue = parseFloat(comparePriceStr);
        if (!isNaN(comparePriceValue) && isFinite(comparePriceValue)) {
          variantData.comparePrice = comparePriceValue;
        }
      }

      // Handle cost
      const costStr = variantFormData.cost?.toString().trim();
      if (costStr && costStr !== '') {
        const costValue = parseFloat(costStr);
        if (!isNaN(costValue) && isFinite(costValue)) {
          variantData.cost = costValue;
        }
      }

      // Add images only if there are any
      if (variantImages.length > 0) {
        variantData.images = variantImages; // Send as array, backend will convert to JSON string
      }

      // Add stock if tracking inventory
      if (variantFormData.trackInventory) {
        const stockValue = parseInt(variantFormData.stock.toString());
        variantData.stock = !isNaN(stockValue) && isFinite(stockValue) ? stockValue : 0;
      } else {
        variantData.stock = 0;
      }

      // Add sortOrder if editing (to maintain order) or set to 0 for new variants
      if (editingVariant && editingVariant.sortOrder !== undefined) {
        variantData.sortOrder = editingVariant.sortOrder;
      } else if (!editingVariant) {
        variantData.sortOrder = variants.length; // Set to next position
      }

      // Log the data being sent in development mode
      if (import.meta.env.DEV) {
        console.log('📤 [VARIANT-SAVE] Sending variant data:', variantData);
      }

      if (editingVariant) {
        // Update existing variant
        const response = await apiClient.put(`/products/${id}/variants/${editingVariant.id}`, variantData);
        if (response.data.success) {
          setVariants(prev => prev.map(v =>
            v.id === editingVariant.id ? response.data.data : v
          ));
          toast.success('تم تحديث المتغير بنجاح!');
          // Reset form and close modal
          setVariantFormData({
            type: '',
            name: '',
            sku: '',
            price: '',
            comparePrice: '',
            cost: '',
            stock: 0,
            trackInventory: true,
            isActive: true
          });
          setVariantImages([]);
          setEditingVariant(null);
          setShowVariantModal(false);
        }
      } else {
        // Create new variant
        const response = await apiClient.post(`/products/${id}/variants`, variantData);
        if (response.data.success) {
          setVariants(prev => [...prev, response.data.data]);
          toast.success('تم إضافة المتغير بنجاح!');
          // Reset form and close modal
          setVariantFormData({
            type: '',
            name: '',
            sku: '',
            price: '',
            comparePrice: '',
            cost: '',
            stock: 0,
            trackInventory: true,
            isActive: true
          });
          setVariantImages([]);
          setEditingVariant(null);
          setShowVariantModal(false);
        }
      }
    } catch (error: any) {
      console.error('Error saving variant:', error);
      // Extract error message from response
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error?.message || error?.message || 'فشل في حفظ المتغير';
      toast.error(errorMessage);
    }
  };

  // Load data on mount and when ID changes
  useEffect(() => {
    if (id) {
      loadProduct();
      loadCategories();
    }
  }, [id, loadProduct, loadCategories]);

  // Removed auto-reload on visibility change to prevent infinite loops

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري تحميل بيانات المنتج...</p>
          <p className="mt-2 text-sm text-gray-500">قد يستغرق هذا بضع ثوانٍ</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">المنتج غير موجود</p>
          <Link to="/products" className="mt-4 text-indigo-600 hover:text-indigo-800">
            العودة للمنتجات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">


        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">تعديل المنتج</h1>
              <p className="mt-2 text-gray-600">{product?.name || 'جاري التحميل...'}</p>
            </div>
            <div className="flex space-x-4 space-x-reverse">
              <button
                onClick={handleReload}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <svg className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                تحديث
              </button>
              <Link
                to={`/products/${id}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                عرض المنتج
              </Link>
            </div>
          </div>
        </div>

        {/* Last Update Info */}
        {product.updatedAt && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-blue-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-800">
                آخر تحديث: {new Date(product.updatedAt).toLocaleString('ar-EG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form key={product?.id || 'loading'} onSubmit={handleSave} className="bg-white shadow rounded-lg">
          <div className="px-6 py-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم المنتج *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="اسم المنتج"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رمز المنتج (SKU)
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="اختياري"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                وصف المنتج
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                maxLength={5000}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="وصف المنتج"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  السعر ({displayCurrency}) *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  السعر القديم ({displayCurrency})
                </label>
                <input
                  type="number"
                  name="comparePrice"
                  value={formData.comparePrice}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="السعر الأصلي قبل الخصم"
                />
                <p className="mt-1 text-xs text-gray-500">السعر الأصلي قبل الخصم (اختياري)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  سعر الشراء ({displayCurrency})
                </label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="تكلفة شراء المنتج من المورد"
                />
                <p className="mt-1 text-xs text-gray-500">تكلفة شراء المنتج من المورد (اختياري)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {/* Track Inventory Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="trackInventory" className="text-sm font-medium text-gray-700">
                    تتبع المخزون
                  </label>
                  <p className="text-sm text-gray-500">
                    فعل هذا الخيار إذا كنت تريد تتبع كمية المخزون لهذا المنتج
                  </p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="trackInventory"
                    name="trackInventory"
                    checked={formData.trackInventory}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Stock Field - Only show when tracking inventory */}
              {formData.trackInventory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    المخزون *
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Info message when not tracking inventory */}
              {!formData.trackInventory && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="mr-3">
                      <p className="text-sm text-blue-700">
                        لن يتم تتبع المخزون لهذا المنتج. سيظهر كمتوفر دائماً للعملاء.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الفئة
                </label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">اختر الفئة</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="mr-2 block text-sm text-gray-900">
                  المنتج نشط
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="hasPromotedAd"
                  checked={formData.hasPromotedAd}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="mr-2 block text-sm text-gray-900">
                  📢 المنتج له إعلان ممول على Facebook
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="enableCheckoutForm"
                  checked={formData.enableCheckoutForm}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="mr-2 block text-sm text-gray-900">
                  🛒 تفعيل فورم الشيك أوت
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="showAddToCartButton"
                  checked={formData.showAddToCartButton}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="mr-2 block text-sm text-gray-900">
                  🛒 إظهار زر إضافة للسلة
                </label>
                <span className="text-xs text-gray-500 mr-2">
                  (عند إلغاء التفعيل، لن يظهر زر "أضف للسلة" في صفحة المنتج)
                </span>
              </div>
            </div>
            
            {formData.hasPromotedAd && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-xs text-blue-700">
                  💡 عند تفعيل هذا الخيار، سيتم الرد مباشرة بالسعر للعملاء الجدد الذين يسألون عن السعر
                </p>
              </div>
            )}

            {formData.enableCheckoutForm && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-xs text-green-700">
                  ✅ العملاء يمكنهم إتمام الطلب مباشرة من صفحة المنتج في المتجر الإلكتروني
                </p>
              </div>
            )}

            {/* Sale Dates Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">📅 تواريخ العرض/الخصم</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="saleStartDate" className="block text-sm font-medium text-gray-700 mb-2">
                    تاريخ بداية العرض
                  </label>
                  <input
                    type="datetime-local"
                    id="saleStartDate"
                    name="saleStartDate"
                    value={formData.saleStartDate || ''}
                    onChange={handleInputChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">تاريخ ووقت بداية العرض (اختياري)</p>
                </div>
                <div>
                  <label htmlFor="saleEndDate" className="block text-sm font-medium text-gray-700 mb-2">
                    تاريخ انتهاء العرض
                  </label>
                  <input
                    type="datetime-local"
                    id="saleEndDate"
                    name="saleEndDate"
                    value={formData.saleEndDate || ''}
                    onChange={handleInputChange}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">تاريخ ووقت انتهاء العرض (اختياري)</p>
                </div>
              </div>
              {formData.saleStartDate && formData.saleEndDate && 
               new Date(formData.saleStartDate) >= new Date(formData.saleEndDate) && (
                <p className="mt-2 text-sm text-red-600">
                  ⚠️ تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية
                </p>
              )}
            </div>

            {/* Product Images Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">صور المنتج</h3>

              {/* Image Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رفع صور جديدة
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                        <span>رفع صور</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                        />
                      </label>
                      <p className="pr-1">أو اسحب الصور هنا</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF حتى 10MB</p>
                  </div>
                </div>
              </div>

              {/* Add Image from URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  إضافة صورة من رابط
                </label>
                <div className="flex space-x-2 space-x-reverse">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleImageFromUrl(imageUrlInput);
                        setImageUrlInput('');
                      }
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleImageFromUrl(imageUrlInput);
                      setImageUrlInput('');
                    }}
                    disabled={imageUrlLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {imageUrlLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block ml-2"></div>
                        جاري الإضافة...
                      </>
                    ) : (
                      'إضافة'
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  يمكنك إضافة صور من روابط خارجية (يجب أن يكون الرابط مباشر للصورة)
                </p>
              </div>

              {/* Current Images */}
              {productImages.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {productImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <SafeImage
                        src={image}
                        alt={`Product ${index + 1}`}
                        className="h-24 w-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleImageDelete(image)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`حذف الصورة ${index + 1}`}
                        title={`حذف الصورة ${index + 1}`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Product Variants Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">متغيرات المنتج</h3>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                >
                  <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  إضافة متغير
                </button>
              </div>

              {variants.length > 0 ? (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الصورة</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">النوع</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">السعر</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المخزون</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {variants.map((variant) => {
                        let variantImages = [];
                        if (variant.images && typeof variant.images === 'string') {
                          try {
                            // Try to parse as JSON first (new format)
                            const parsedImages = JSON.parse(variant.images);
                            if (Array.isArray(parsedImages)) {
                              variantImages = parsedImages.filter(img => img && typeof img === 'string' && img.trim());
                            }
                          } catch (error) {
                            // Fallback to comma-separated format (old format)
                            variantImages = variant.images.split(',').filter(img => {
                              if (!img || typeof img !== 'string') return false;
                              const trimmed = img.trim();
                              if (!trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null') return false;
                              return true;
                            });
                          }
                        }
                        return (
                          <tr key={variant.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {variantImages.length > 0 ? (
                                <div className="flex -space-x-2">
                                  {variantImages.slice(0, 3).map((image, index) => (
                                    <SafeImage
                                      key={`${variant.id}-image-${index}-${image.substring(image.lastIndexOf('/') + 1, image.lastIndexOf('/') + 10)}`}
                                      src={image}
                                      alt={`${variant.name} ${index + 1}`}
                                      className="h-8 w-8 rounded-full object-cover border-2 border-white"
                                    />
                                  ))}
                                  {variantImages.length > 3 && (
                                    <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                                      <span className="text-xs text-gray-600">+{variantImages.length - 3}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {variant.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{variant.name || 'غير محدد'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {variant.price ? `${variant.price} ${displayCurrency}` : 'غير محدد'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{variant.stock || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                variant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {variant.isActive ? 'نشط' : 'غير نشط'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                type="button"
                                onClick={() => handleEditVariant(variant)}
                                className="text-indigo-600 hover:text-indigo-900 ml-4"
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVariant(variant.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  لا توجد متغيرات للمنتج. اضغط "إضافة متغير" لإضافة متغير جديد.
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-4 space-x-reverse">
            <Link
              to={`/products/${id}`}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              إلغاء
            </Link>
            
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  حفظ التغييرات
                </>
              )}
            </button>
          </div>
        </form>

        {/* Variants Info */}
        {product.variants && product.variants.length > 0 && (
          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">أنواع المنتج ({product.variants.length})</h3>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {product.variants.map((variant, index) => (
                  <div key={variant.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{variant.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${variant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {variant.isActive ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">النوع:</span> {variant.type || 'غير محدد'}</p>
                      <p><span className="font-medium">SKU:</span> {variant.sku || 'غير محدد'}</p>
                      <p><span className="font-medium">السعر:</span> {variant.price ? `${variant.price} ${displayCurrency}` : 'غير محدد'}</p>
                      {variant.comparePrice && (
                        <p><span className="font-medium">السعر القديم:</span> {variant.comparePrice} {displayCurrency}</p>
                      )}
                      {variant.cost && (
                        <p><span className="font-medium">سعر الشراء:</span> {variant.cost} {displayCurrency}</p>
                      )}
                      <p><span className="font-medium">المخزون:</span> {variant.stock || 0}</p>
                      {variant.images && variant.images !== '[]' && (
                        <p><span className="font-medium">الصور:</span> متوفرة ✅</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Variant Modal */}
        {showVariantModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingVariant ? 'تعديل المتغير' : 'إضافة متغير جديد'}
                </h3>

                <form onSubmit={handleSaveVariant}>
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          نوع المتغير *
                        </label>
                        <select
                          name="type"
                          value={variantFormData.type}
                          onChange={handleVariantInputChange}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">اختر النوع</option>
                          <option value="color">لون</option>
                          <option value="size">مقاس</option>
                          <option value="material">مادة</option>
                          <option value="style">نمط</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          اسم المتغير *
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={variantFormData.name}
                          onChange={handleVariantInputChange}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="مثال: أحمر، كبير، قطن"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          رمز المتغير (SKU)
                        </label>
                        <input
                          type="text"
                          name="sku"
                          value={variantFormData.sku}
                          onChange={handleVariantInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="SKU-VARIANT-001"
                        />
                      </div>

                      {/* Track Inventory for Variant */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            تتبع المخزون
                          </label>
                          <p className="text-xs text-gray-500">
                            فعل لتتبع مخزون هذا المتغير
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          name="trackInventory"
                          checked={variantFormData.trackInventory}
                          onChange={handleVariantInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </div>

                      {/* Stock Field - Only show when tracking inventory */}
                      {variantFormData.trackInventory && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            المخزون *
                          </label>
                          <input
                            type="number"
                            name="stock"
                            value={variantFormData.stock}
                            onChange={handleVariantInputChange}
                            min="0"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      )}

                      {/* Info when not tracking inventory */}
                      {!variantFormData.trackInventory && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                          <p className="text-xs text-blue-700">
                            لن يتم تتبع المخزون لهذا المتغير
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          السعر ({displayCurrency}) *
                        </label>
                        <input
                          type="number"
                          name="price"
                          value={variantFormData.price}
                          onChange={handleVariantInputChange}
                          step="0.01"
                          min="0"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          السعر القديم ({displayCurrency})
                        </label>
                        <input
                          type="number"
                          name="comparePrice"
                          value={variantFormData.comparePrice}
                          onChange={handleVariantInputChange}
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          سعر الشراء ({displayCurrency})
                        </label>
                        <input
                          type="number"
                          name="cost"
                          value={variantFormData.cost}
                          onChange={handleVariantInputChange}
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Variant Images */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        صور المتغير
                      </label>

                      {/* Image Upload */}
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          <svg className="mx-auto h-8 w-8 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="flex text-sm text-gray-600">
                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                              <span>رفع صور</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => e.target.files && handleVariantImageUpload(e.target.files)}
                              />
                            </label>
                            <p className="pr-1">أو اسحب الصور هنا</p>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF حتى 5MB</p>
                        </div>
                      </div>

                      {/* Add Image from URL */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          إضافة صورة من رابط
                        </label>
                        <div className="flex space-x-2 space-x-reverse">
                          <input
                            type="url"
                            value={variantImageUrlInput}
                            onChange={(e) => setVariantImageUrlInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleVariantImageFromUrl(variantImageUrlInput);
                                setVariantImageUrlInput('');
                              }
                            }}
                            placeholder="https://example.com/image.jpg"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleVariantImageFromUrl(variantImageUrlInput);
                              setVariantImageUrlInput('');
                            }}
                            disabled={variantImageUrlLoading}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {variantImageUrlLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white inline-block ml-1"></div>
                                جاري...
                              </>
                            ) : (
                              'إضافة'
                            )}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          رابط مباشر للصورة
                        </p>
                      </div>

                      {/* Current Images */}
                      {variantImages.length > 0 && (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {variantImages.map((image, index) => (
                            <div key={index} className="relative group">
                              <SafeImage
                                src={image}
                                alt={`Variant ${index + 1}`}
                                className="h-16 w-full object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleVariantImageDelete(image)}
                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={variantFormData.isActive}
                        onChange={handleVariantInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label className="mr-2 block text-sm text-gray-900">
                        المتغير نشط
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-4 space-x-reverse mt-6 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowVariantModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      {editingVariant ? 'تحديث المتغير' : 'إضافة المتغير'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Wrapped component with Error Boundary
const ProductEditNewWithErrorBoundary: React.FC = () => {
  return (
    <ErrorBoundary>
      <ProductEditNew />
    </ErrorBoundary>
  );
};

export default ProductEditNewWithErrorBoundary;

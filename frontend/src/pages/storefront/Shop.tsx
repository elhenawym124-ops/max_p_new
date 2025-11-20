import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingCartIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { storefrontApi, getCompanyId } from '../../utils/storefrontApi';
import StorefrontNav from '../../components/StorefrontNav';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  stock: number;
  category?: {
    id: string;
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
  productsCount: number;
}

const Shop: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  });

  // Filters
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [showFilters, setShowFilters] = useState(false);

  // التحقق من وجود companyId عند التحميل
  useEffect(() => {
    const companyId = getCompanyId();
    if (!companyId) {
      // عرض رسالة خطأ واضحة
      toast.error('⚠️ يجب زيارة المتجر من رابط صحيح يحتوي على معرف الشركة');
      console.error('❌ [Shop] No companyId found. Please visit with ?companyId=xxx or use subdomain');
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [searchParams]);

  const fetchCategories = async () => {
    try {
      const data = await storefrontApi.getCategories();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const page = searchParams.get('page') || '1';
      const search = searchParams.get('search') || '';
      const category = searchParams.get('category') || '';
      const sort = searchParams.get('sortBy') || 'createdAt';
      
      const params: Record<string, string> = {
        page,
        limit: '12',
        sortBy: sort,
        sortOrder: 'desc'
      };
      
      if (search) params['search'] = search;
      if (category) params['category'] = category;
      
      const data = await storefrontApi.getProducts(params);
      
      if (data.success) {
        setProducts(data.data.products || []);
        setPagination(data.data.pagination || { page: 1, limit: 12, total: 0, pages: 0 });
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('حدث خطأ في جلب المنتجات');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const params = new URLSearchParams(searchParams);
    if (categoryId) {
      params.set('category', categoryId);
    } else {
      params.delete('category');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', sort);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = async (product: Product) => {
    try {
      let sessionId = localStorage.getItem('cart_session_id');
      
      const data = await storefrontApi.addToCart({
        ...(sessionId && { sessionId }),
        productId: product.id,
        quantity: 1
      });
      
      if (data.success) {
        // Backend returns cartId, save it as cart_session_id
        if (data.data?.cartId) {
          localStorage.setItem('cart_session_id', data.data.cartId);
        }
        toast.success('تمت إضافة المنتج للسلة');
        
        // تحديث عدد المنتجات في الـ header
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        toast.error(data.message || 'حدث خطأ');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('حدث خطأ في إضافة المنتج');
    }
  };

  return (
    <>
      <StorefrontNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">المنتجات</h1>
        
        <div className="flex items-center gap-4">
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="createdAt">الأحدث</option>
            <option value="price">السعر: من الأقل للأعلى</option>
            <option value="name">الاسم</option>
          </select>
          
          {/* Filter Button - Mobile */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <FunnelIcon className="h-5 w-5" />
            <span>فلترة</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar - Filters */}
        <aside className={`md:w-64 ${showFilters ? 'block' : 'hidden md:block'}`}>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">الفئات</h2>
            
            <div className="space-y-2">
              <button
                onClick={() => handleCategoryChange('')}
                className={`w-full text-right px-3 py-2 rounded-lg transition-colors ${
                  !selectedCategory
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                الكل
              </button>
              
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={`w-full text-right px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                    selectedCategory === category.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{category.name}</span>
                  <span className="text-sm text-gray-500">({category.productsCount})</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Products Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">لا توجد منتجات</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => {
                  const companyId = getCompanyId();
                  // Parse images from JSON string
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
                  <div key={product.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <Link to={`/shop/products/${product.id}?companyId=${companyId}`}>
                      <div className="relative h-48 bg-gray-100 rounded-t-lg overflow-hidden">
                        {productImages.length > 0 && productImages[0] ? (
                          <img
                            src={productImages[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback if image fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400"><span class="text-4xl">📦</span></div>';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="text-4xl">📦</span>
                          </div>
                        )}
                        
                        {product.comparePrice && product.comparePrice > product.price && (
                          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                            خصم {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%
                          </div>
                        )}
                      </div>
                    </Link>
                    
                    <div className="p-4">
                      <Link to={`/shop/products/${product.id}?companyId=${companyId}`}>
                        <h3 className="font-semibold text-gray-900 mb-2 hover:text-blue-600 transition-colors line-clamp-2">
                          {product.name}
                        </h3>
                      </Link>
                      
                      {product.category && (
                        <p className="text-sm text-gray-500 mb-2">{product.category.name}</p>
                      )}
                      
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-xl font-bold text-gray-900">
                            {product.price} جنيه
                          </span>
                          {product.comparePrice && product.comparePrice > product.price && (
                            <span className="text-sm text-gray-500 line-through mr-2">
                              {product.comparePrice} جنيه
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => addToCart(product)}
                        disabled={product.stock === 0}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                          product.stock === 0
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <ShoppingCartIcon className="h-5 w-5" />
                        <span>{product.stock === 0 ? 'غير متوفر' : 'أضف للسلة'}</span>
                      </button>
                    </div>
                  </div>
                )})}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    السابق
                  </button>
                  
                  <span className="px-4 py-2 text-gray-700">
                    صفحة {pagination.page} من {pagination.pages}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    التالي
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default Shop;

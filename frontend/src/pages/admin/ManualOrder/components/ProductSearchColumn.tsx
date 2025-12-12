import React, { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, PlusIcon, ArchiveBoxIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { authService } from '../../../../services/authService';
import { config } from '../../../../config';
import { toast } from 'react-hot-toast';

interface ProductVariant {
    id: string;
    sku: string;
    price: number | string;
    stock: number;
    color?: string;
    size?: string;
    image?: string;
}

interface Product {
    id: string;
    name: string;
    price: number;
    image: string;
    stock: number;
    sku: string;
    variants: ProductVariant[];
}

interface ProductSearchColumnProps {
    onAddToCart: (product: Product, variant?: ProductVariant) => void;
}

const ProductSearchColumn: React.FC<ProductSearchColumnProps> = ({ onAddToCart }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);

    // Variant Selection State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Debounce search could be better, but let's keep it simple for now
    const fetchProducts = useCallback(async (query: string = '') => {
        try {
            setLoading(true);
            const token = authService.getAccessToken();
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            };

            const params = new URLSearchParams({
                page: '1',
                limit: '50', // Increase limit for better search experience
                // search: query // If backend supports it
            });

            const response = await fetch(`${config.apiUrl}/products?${params.toString()}`, { headers });
            const data = await response.json();

            if (data.success && data.data) {
                const mappedProducts: Product[] = data.data.map((p: any) => {
                    let imageUrl = '';
                    try {
                        if (p.images) {
                            const parsed = JSON.parse(p.images);
                            if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0];
                        }
                    } catch (e) { /* ignore */ }

                    return {
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        stock: p.stock,
                        sku: p.sku,
                        image: imageUrl,
                        variants: p.variants || []
                    };
                });

                const filtered = query
                    ? mappedProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase()))
                    : mappedProducts;

                setProducts(filtered);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('فشل في جلب المنتجات');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        const timeoutId = setTimeout(() => {
            fetchProducts(query);
        }, 500);
        return () => clearTimeout(timeoutId);
    };

    const handleProductClick = (product: Product) => {
        if (product.variants && product.variants.length > 0) {
            setSelectedProduct(product);
            setIsModalOpen(true);
        } else {
            onAddToCart(product);
        }
    };

    const handleVariantSelect = (variant: ProductVariant) => {
        if (selectedProduct) {
            onAddToCart(selectedProduct, variant);
            setIsModalOpen(false);
            setSelectedProduct(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
            {/* Search Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-semibold text-gray-800 mb-3">المنتجات</h2>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="بحث باسم المنتج أو SKU..."
                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') fetchProducts(searchQuery);
                        }}
                    />
                    <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
                </div>
            </div>

            {/* Product List */}
            <div className="p-2 flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <ArchiveBoxIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>لا توجد منتجات</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 p-3">
                        {products.map((product) => (
                            <div
                                key={product.id}
                                className="flex flex-col bg-white border border-gray-100 rounded-lg hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer overflow-hidden relative"
                                onClick={() => handleProductClick(product)}
                            >
                                {/* Image - Now larger and on top */}
                                <div className="aspect-square bg-gray-100 relative">
                                    {product.image ? (
                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ArchiveBoxIcon className="w-12 h-12" />
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />

                                    {/* Stock Badge */}
                                    {product.stock <= 5 && (
                                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-red-100">
                                            متبقي {product.stock}
                                        </div>
                                    )}

                                    {/* Variant Badge */}
                                    {product.variants.length > 0 && (
                                        <div className="absolute bottom-2 right-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">
                                            خيارات متعددة
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 h-10 leading-snug mb-1" title={product.name}>
                                        {product.name}
                                    </h3>

                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-base font-bold text-blue-600">{product.price} ج.م</span>

                                        <button
                                            className="p-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleProductClick(product);
                                            }}
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="text-[10px] text-gray-400 mt-1 truncate">
                                        SKU: {product.sku || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Variant Selection Modal */}
            {isModalOpen && selectedProduct && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900 truncate pr-4">{selectedProduct.name}</h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-2">
                                {selectedProduct.variants.map((variant) => (
                                    <button
                                        key={variant.id}
                                        onClick={() => handleVariantSelect(variant)}
                                        disabled={variant.stock <= 0}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-right transition-all
                                            ${variant.stock > 0
                                                ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                                                : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                            }
                                        `}
                                    >
                                        <div className="flex flex-col items-start">
                                            <div className="font-medium text-gray-900 text-sm">
                                                {variant.color && <span className="ml-1">{variant.color}</span>}
                                                {variant.color && variant.size && <span>/</span>}
                                                {variant.size && <span className="mr-1">{variant.size}</span>}
                                                {!variant.color && !variant.size && <span>غير محدد</span>}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                SKU: {variant.sku}
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-blue-600 text-sm">{variant.price} ج.م</div>
                                            <div className={`text-xs mt-0.5 ${variant.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {variant.stock > 0 ? `${variant.stock} متاح` : 'نفذت الكمية'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductSearchColumn;

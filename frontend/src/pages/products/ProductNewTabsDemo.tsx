import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabPanel } from '../../components/common/Tabs';
import { useCurrency } from '../../hooks/useCurrency';
import { getCurrencyByCode } from '../../utils/currency';
import { authService } from '../../services/authService';
import { apiClient } from '../../services/apiClient';
import { productApi, uploadFiles, deleteFile } from '../../utils/apiHelpers';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CubeIcon,
  PhotoIcon,
  SwatchIcon,
  TruckIcon,
  Cog6ToothIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface ProductFormData {
  name: string;
  description: string;
  price: number;
  comparePrice?: number | undefined;
  cost?: number | undefined;
  sku: string;
  category: string;
  stock: number;
  trackInventory: boolean;
  lowStockThreshold: number;
  isActive: boolean;
  enableCheckoutForm: boolean;
  showAddToCartButton: boolean;
  saleStartDate: string;
  saleEndDate: string;
  tags: string[];
  weight?: number | undefined;
  dimensions?: { length?: number; width?: number; height?: number; } | undefined;
}

interface Category {
  id: string;
  name: string;
}

interface ProductVariant {
  id?: string;
  name: string;
  type: string;
  sku: string;
  price?: number;
  comparePrice?: number;
  cost?: number;
  images: string[];
  stock: number;
  trackInventory: boolean;
  isActive: boolean;
  sortOrder: number;
  metadata?: any;
}

const ProductNewTabsDemo: React.FC = () => {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  
  // Get currency symbol for display
  const currencyInfo = getCurrencyByCode(currency || 'EGP');
  const displayCurrency = currencyInfo?.symbol || 'ج.م';
  
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: 0,
    comparePrice: undefined,
    cost: undefined,
    sku: '',
    category: '',
    stock: 0,
    trackInventory: true,
    lowStockThreshold: 5,
    isActive: true,
    enableCheckoutForm: true,
    showAddToCartButton: true,
    saleStartDate: '',
    saleEndDate: '',
    tags: [],
    weight: undefined,
    dimensions: undefined,
  });
  
  const [newTag, setNewTag] = useState('');
  const [showDimensions, setShowDimensions] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const tabs = [
    { id: 'basic', label: 'المعلومات الأساسية', icon: <DocumentTextIcon className="w-5 h-5" /> },
    { id: 'pricing', label: 'التسعير', icon: <CurrencyDollarIcon className="w-5 h-5" /> },
    { id: 'inventory', label: 'المخزون', icon: <CubeIcon className="w-5 h-5" /> },
    { id: 'media', label: 'الصور', icon: <PhotoIcon className="w-5 h-5" /> },
    { id: 'variants', label: 'المتغيرات', icon: <SwatchIcon className="w-5 h-5" /> },
    { id: 'shipping', label: 'الشحن', icon: <TruckIcon className="w-5 h-5" /> },
    { id: 'advanced', label: 'متقدم', icon: <Cog6ToothIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/products')}
                className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  إضافة منتج جديد
                  <span className="ml-2 px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                    قائمة جانبية
                  </span>
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  نظام منظم بقائمة جانبية للتنقل السريع بين الأقسام
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs System - Sidebar Layout */}
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sticky top-4">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex-shrink-0">{tab.icon}</span>
                    <span className="text-right flex-1">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
          {/* Tab 1: Basic Info */}
          <TabPanel id="basic" activeTab={activeTab}>
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">📝 المعلومات الأساسية</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم المنتج *
                </label>
                <input 
                  type="text" 
                  placeholder="أدخل اسم المنتج"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف
                </label>
                <textarea 
                  rows={4}
                  placeholder="وصف تفصيلي للمنتج"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رمز المنتج (SKU)
                  </label>
                  <input 
                    type="text" 
                    placeholder="PROD-001"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الفئة *
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                    <option>اختر فئة</option>
                    <option>إلكترونيات</option>
                    <option>ملابس</option>
                    <option>أحذية</option>
                  </select>
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Tab 2: Pricing */}
          <TabPanel id="pricing" activeTab={activeTab}>
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">💰 التسعير</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    السعر (ج.م) *
                  </label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    السعر القديم (ج.م)
                  </label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    سعر الشراء (ج.م)
                  </label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-700">
                  💡 السعر القديم يُستخدم لعرض الخصم. سعر الشراء لحساب الربح.
                </p>
              </div>
            </div>
          </TabPanel>

          {/* Tab 3: Inventory */}
          <TabPanel id="inventory" activeTab={activeTab}>
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">📦 المخزون</h2>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    تتبع المخزون
                  </label>
                  <p className="text-sm text-gray-500">
                    فعل هذا الخيار لتتبع كمية المخزون
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  defaultChecked
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الكمية المتاحة
                  </label>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    حد التنبيه للمخزون المنخفض
                  </label>
                  <input 
                    type="number" 
                    placeholder="5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Tab 4: Media */}
          <TabPanel id="media" activeTab={activeTab}>
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">🖼️ الصور والوسائط</h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  اسحب الصور وأفلتها هنا أو انقر للاختيار
                </p>
                <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  اختر الصور
                </button>
              </div>
            </div>
          </TabPanel>

          {/* Tab 5: Variants */}
          <TabPanel id="variants" activeTab={activeTab}>
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">🎨 المتغيرات</h2>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <SwatchIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  أضف متغيرات للمنتج مثل الألوان والمقاسات
                </p>
                <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  إضافة متغير
                </button>
              </div>
            </div>
          </TabPanel>

          {/* Tab 6: Shipping */}
          <TabPanel id="shipping" activeTab={activeTab}>
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">🚚 الشحن</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الوزن (كجم)
                  </label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الأبعاد (سم)
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <input type="number" placeholder="الطول" className="px-4 py-2 border border-gray-300 rounded-md" />
                  <input type="number" placeholder="العرض" className="px-4 py-2 border border-gray-300 rounded-md" />
                  <input type="number" placeholder="الارتفاع" className="px-4 py-2 border border-gray-300 rounded-md" />
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Tab 7: Advanced */}
          <TabPanel id="advanced" activeTab={activeTab}>
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">⚙️ إعدادات متقدمة</h2>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="mr-2 text-sm text-gray-900">
                    تفعيل فورم الشيك أوت لهذا المنتج
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="mr-2 text-sm text-gray-900">
                    إظهار زر إضافة للسلة
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  العلامات (Tags)
                </label>
                <input 
                  type="text" 
                  placeholder="أضف علامات مفصولة بفواصل"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </TabPanel>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-3 space-x-reverse">
          <button
            onClick={() => navigate('/products')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            إلغاء
          </button>
          <button
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            حفظ المنتج
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductNewTabsDemo;

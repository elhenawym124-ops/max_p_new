import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurrency } from '../../hooks/useCurrency';
import { getCurrencyByCode } from '../../utils/currency';
import { authService } from '../../services/authService';
import { apiClient } from '../../services/apiClient';
import { productApi, uploadFiles, deleteFile } from '../../utils/apiHelpers';
import RichTextEditor from '../../components/RichTextEditor';
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
  EyeIcon,
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
  sizeGuide: string; // 📏 دليل المقاسات
  tags: string[];
  weight?: number | undefined;
  dimensions?: { length?: number; width?: number; height?: number; } | undefined;
  // New features
  isFeatured?: boolean;
  featuredPriority?: number;
  shippingClass?: string;
  excludeFromFreeShipping?: boolean;
}

interface Category {
  id: string;
  name: string;
}

// Product Attribute for generating variations
interface ProductAttribute {
  id: string;
  name: string;                      // مثل: اللون، الحجم
  slug: string;                      // مثل: color, size
  values: string[];                  // مثل: ["أحمر", "أزرق", "أخضر"]
  visible: boolean;                  // عرض في صفحة المنتج
  forVariations: boolean;            // استخدام في المتغيرات
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
  // New fields
  image?: string;                    // صورة المتغير الرئيسية
  description?: string;              // وصف المتغير
  weight?: number;                   // الوزن
  dimensions?: {                     // الأبعاد
    length?: number;
    width?: number;
    height?: number;
  };
  shippingClass?: string;            // فئة الشحن
  allowBackorders?: boolean;         // السماح بالطلبات المسبقة
  lowStockThreshold?: number;        // حد المخزون المنخفض
  // Attribute values for this variant
  attributeValues?: { [key: string]: string }; // مثل: { color: "أحمر", size: "كبير" }
}

const ProductNewFinal: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { currency } = useCurrency();

  const currencyInfo = getCurrencyByCode(currency || 'EGP');
  const displayCurrency = currencyInfo?.symbol || 'ج.م';

  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

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
    sizeGuide: '', // 📏 دليل المقاسات
    tags: [],
    weight: undefined,
    dimensions: undefined,
    // New features
    isFeatured: false,
    featuredPriority: 0,
    shippingClass: 'standard',
    excludeFromFreeShipping: false,
  });

  const [newTag, setNewTag] = useState('');
  const [showDimensions, setShowDimensions] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Recommended Products
  const [relatedProducts, setRelatedProducts] = useState<string[]>([]);
  const [upsellProducts, setUpsellProducts] = useState<string[]>([]);
  const [crossSellProducts, setCrossSellProducts] = useState<string[]>([]);
  const [relatedInput, setRelatedInput] = useState('');
  const [upsellInput, setUpsellInput] = useState('');
  const [crossSellInput, setCrossSellInput] = useState('');

  // Product Attributes System
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeValuesList, setNewAttributeValuesList] = useState<string[]>(['']);
  const [selectedVariants, setSelectedVariants] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState<string>('');
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [attributeMode, setAttributeMode] = useState<'templates' | 'custom'>('templates');

  // Custom Variant Display Settings
  const [variantSettings, setVariantSettings] = useState<{
    styles: { [key: string]: 'buttons' | 'circles' | 'dropdown' | 'thumbnails' | 'radio' };
    attributeImages: { [key: string]: { [value: string]: string } };
  }>({ styles: {}, attributeImages: {} });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apiClient.get('/products/categories');
        const data = response.data;
        if (data.success && data.data) {
          setCategories(data.data);
        } else if (Array.isArray(data)) {
          setCategories(data);
        }
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // تحميل بيانات المنتج عند التعديل
  useEffect(() => {
    if (!isEditMode || !id) return;

    const fetchProduct = async () => {
      setLoadingProduct(true);
      try {
        const response = await apiClient.get(`/products/${id}`);
        const data = response.data;

        if (data.success && data.data) {
          const product = data.data;

          // تحديث بيانات النموذج
          // Ensure description is a string
          const descriptionValue = product.description ? String(product.description) : '';
          
          setFormData({
            name: product.name || '',
            description: descriptionValue,
            price: parseFloat(product.price) || 0,
            comparePrice: product.comparePrice ? parseFloat(product.comparePrice) : undefined,
            cost: product.cost ? parseFloat(product.cost) : undefined,
            sku: product.sku || '',
            category: product.categoryId || '',
            stock: product.stock || 0,
            trackInventory: product.trackInventory !== false,
            lowStockThreshold: product.lowStockThreshold || 5,
            isActive: product.isActive !== false,
            enableCheckoutForm: product.enableCheckoutForm !== false,
            showAddToCartButton: product.showAddToCartButton !== false,
            saleStartDate: product.saleStartDate ? product.saleStartDate.split('T')[0] : '',
            saleEndDate: product.saleEndDate ? product.saleEndDate.split('T')[0] : '',
            sizeGuide: product.sizeGuide || '', // 📏 دليل المقاسات
            tags: product.tags ? (typeof product.tags === 'string' ? JSON.parse(product.tags) : product.tags) : [],
            weight: product.weight ? parseFloat(product.weight) : undefined,
            dimensions: product.dimensions ? (typeof product.dimensions === 'string' ? JSON.parse(product.dimensions) : product.dimensions) : undefined,
            isFeatured: product.isFeatured || false,
            featuredPriority: product.featuredPriority || 0,
            shippingClass: product.shippingClass || 'standard',
            excludeFromFreeShipping: product.excludeFromFreeShipping || false,
          });

          // تحميل الصور
          if (product.images) {
            const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
            setUploadedImages(imgs || []);
          }

          // تحميل المتغيرات
          if (product.variants && product.variants.length > 0) {
            const loadedVariants = product.variants.map((v: any) => ({
              id: v.id,
              name: v.name || '',
              type: v.type || 'color',
              sku: v.sku || '',
              price: v.price ? parseFloat(v.price) : undefined,
              comparePrice: v.comparePrice ? parseFloat(v.comparePrice) : undefined,
              cost: v.cost ? parseFloat(v.cost) : undefined,
              images: v.images ? (typeof v.images === 'string' ? JSON.parse(v.images) : v.images) : [],
              stock: v.stock || 0,
              trackInventory: v.trackInventory !== false,
              isActive: v.isActive !== false,
              sortOrder: v.sortOrder || 0,
              metadata: v.metadata,
              image: v.image,
              description: v.description || '',
              weight: v.weight ? parseFloat(v.weight) : undefined,
              dimensions: v.dimensions ? (typeof v.dimensions === 'string' ? JSON.parse(v.dimensions) : v.dimensions) : {},
              shippingClass: v.shippingClass || 'standard',
              allowBackorders: v.allowBackorders || false,
              lowStockThreshold: v.lowStockThreshold || 5,
              attributeValues: v.attributeValues ? (typeof v.attributeValues === 'string' ? JSON.parse(v.attributeValues) : v.attributeValues) : {},
            }));
            setVariants(loadedVariants);
            setShowVariants(true);

            // استخراج الـ attributes من المتغيرات إذا لم تكن موجودة
            if (loadedVariants.length > 0) {
              const extractedAttributes: { [key: string]: Set<string> } = {};
              
              loadedVariants.forEach((variant: any) => {
                // محاولة استخراج من attributeValues أولاً (إذا كان موجوداً في metadata)
                let attributeValues = null;
                if (variant.metadata) {
                  try {
                    const metadata = typeof variant.metadata === 'string' ? JSON.parse(variant.metadata) : variant.metadata;
                    attributeValues = metadata.attributeValues || null;
                  } catch (e) {
                    // ignore
                  }
                }
                
                if (attributeValues && typeof attributeValues === 'object') {
                  Object.keys(attributeValues).forEach(attrKey => {
                    if (!extractedAttributes[attrKey]) {
                      extractedAttributes[attrKey] = new Set();
                    }
                    extractedAttributes[attrKey].add(attributeValues[attrKey]);
                  });
                } else if (variant.name) {
                  // محاولة استخراج من الاسم (مثل: "أحمر - كبير" أو "أحمر/كبير")
                  const separators = [' - ', ' / ', ' | ', '-', '/', '|'];
                  let parts: string[] = [];
                  
                  for (const sep of separators) {
                    if (variant.name.includes(sep)) {
                      parts = variant.name.split(sep).map((p: string) => p.trim()).filter((p: string) => p);
                      break;
                    }
                  }
                  
                  if (parts.length === 0) {
                    parts = [variant.name.trim()];
                  }
                  
                  if (parts.length > 0) {
                    // إذا كان هناك جزء واحد فقط، نستخدم type كاسم الصفة
                    if (parts.length === 1) {
                      const attrName = variant.type === 'color' ? 'اللون' : 
                                      variant.type === 'size' ? 'الحجم' : 
                                      variant.type || 'النوع';
                      if (!extractedAttributes[attrName]) {
                        extractedAttributes[attrName] = new Set();
                      }
                      extractedAttributes[attrName].add(parts[0]);
                    } else {
                      // إذا كان هناك أجزاء متعددة، نستخدم أسماء افتراضية
                      const defaultNames = ['اللون', 'الحجم', 'النمط', 'المادة'];
                      parts.forEach((part: string, idx: number) => {
                        const attrKey = defaultNames[idx] || `صفة ${idx + 1}`;
                        if (!extractedAttributes[attrKey]) {
                          extractedAttributes[attrKey] = new Set();
                        }
                        extractedAttributes[attrKey].add(part);
                      });
                    }
                  }
                }
              });

              // تحويل إلى ProductAttribute format
              const newAttributes: ProductAttribute[] = Object.keys(extractedAttributes).map((attrKey, idx) => ({
                id: `extracted-${attrKey}-${idx}-${Date.now()}`,
                name: attrKey,
                slug: attrKey.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                values: Array.from(extractedAttributes[attrKey]),
                visible: true,
                forVariations: true,
              }));

              if (newAttributes.length > 0) {
                setAttributes(prev => {
                  // تجنب التكرار
                  const existingSlugs = new Set(prev.map(a => a.slug));
                  const uniqueNew = newAttributes.filter(a => !existingSlugs.has(a.slug));
                  if (uniqueNew.length > 0) {
                    return [...prev, ...uniqueNew];
                  }
                  return prev;
                });
              }
            }
          }

          // إظهار الأبعاد إذا كانت موجودة
          if (product.dimensions) {
            setShowDimensions(true);
          }

          // تحميل إعدادات العرض المخصصة من Metadata
          if (product.metadata) {
            try {
              const metadata = typeof product.metadata === 'string'
                ? JSON.parse(product.metadata)
                : product.metadata;

              if (metadata.variantSettings) {
                setVariantSettings(metadata.variantSettings);
              }
            } catch (e) {
              console.error('Error parsing product metadata:', e);
            }
          }
        } else {
          setError('فشل في تحميل بيانات المنتج');
        }
      } catch (err) {
        console.error('Error loading product:', err);
        setError('فشل في تحميل بيانات المنتج');
      } finally {
        setLoadingProduct(false);
      }
    };

    fetchProduct();
  }, [id, isEditMode]);

  // استخراج الـ attributes من المتغيرات بعد تحميلها
  useEffect(() => {
    if (isEditMode && variants.length > 0) {
      // التحقق من وجود attributes للمتغيرات
      const hasVariationAttributes = attributes.some(a => a.forVariations);
      
      if (!hasVariationAttributes) {
        const extractedAttributes: { [key: string]: Set<string> } = {};
        
        variants.forEach((variant: ProductVariant) => {
          // محاولة استخراج من attributeValues في metadata
          let attributeValues = null;
          if (variant.metadata) {
            try {
              const metadata = typeof variant.metadata === 'string' ? JSON.parse(variant.metadata) : variant.metadata;
              attributeValues = metadata.attributeValues || null;
            } catch (e) {
              // ignore
            }
          }
          
          if (variant.attributeValues && typeof variant.attributeValues === 'object') {
            Object.keys(variant.attributeValues).forEach(attrKey => {
              if (!extractedAttributes[attrKey]) {
                extractedAttributes[attrKey] = new Set();
              }
              extractedAttributes[attrKey].add(variant.attributeValues![attrKey]);
            });
          } else if (attributeValues && typeof attributeValues === 'object') {
            Object.keys(attributeValues).forEach(attrKey => {
              if (!extractedAttributes[attrKey]) {
                extractedAttributes[attrKey] = new Set();
              }
              extractedAttributes[attrKey].add(attributeValues[attrKey]);
            });
          } else if (variant.name) {
            // محاولة استخراج من الاسم
            const separators = [' - ', ' / ', ' | ', '-', '/', '|'];
            let parts: string[] = [];
            
            for (const sep of separators) {
              if (variant.name.includes(sep)) {
                parts = variant.name.split(sep).map(p => p.trim()).filter(p => p);
                break;
              }
            }
            
            if (parts.length === 0) {
              parts = [variant.name.trim()];
            }
            
            if (parts.length > 0) {
              if (parts.length === 1) {
                const attrName = variant.type === 'color' ? 'اللون' : 
                                variant.type === 'size' ? 'الحجم' : 
                                variant.type || 'النوع';
                if (!extractedAttributes[attrName]) {
                  extractedAttributes[attrName] = new Set();
                }
                extractedAttributes[attrName].add(parts[0]);
              } else {
                const defaultNames = ['اللون', 'الحجم', 'النمط', 'المادة'];
                parts.forEach((part: string, idx: number) => {
                  const attrKey = defaultNames[idx] || `صفة ${idx + 1}`;
                  if (!extractedAttributes[attrKey]) {
                    extractedAttributes[attrKey] = new Set();
                  }
                  extractedAttributes[attrKey].add(part);
                });
              }
            }
          }
        });

        // تحويل إلى ProductAttribute format
        const newAttributes: ProductAttribute[] = Object.keys(extractedAttributes).map((attrKey, idx) => ({
          id: `extracted-${attrKey}-${idx}-${Date.now()}`,
          name: attrKey,
          slug: attrKey.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          values: Array.from(extractedAttributes[attrKey]),
          visible: true,
          forVariations: true,
        }));

        if (newAttributes.length > 0) {
          setAttributes(prev => {
            const existingSlugs = new Set(prev.map(a => a.slug));
            const uniqueNew = newAttributes.filter(a => !existingSlugs.has(a.slug));
            return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
          });
        }
      }
    }
  }, [variants, isEditMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDimensionChange = (dimension: 'length' | 'width' | 'height', value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setFormData(prev => ({
      ...prev,
      dimensions: { ...prev.dimensions, [dimension]: numValue },
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }));
  };

  const addVariant = () => {
    const baseVariant: ProductVariant = {
      name: '',
      type: 'color',
      sku: '',
      images: [],
      stock: 0,
      trackInventory: formData.trackInventory,
      isActive: true,
      sortOrder: variants.length,
      // New fields with defaults
      image: undefined,
      description: '',
      weight: undefined,
      dimensions: {},
      shippingClass: 'standard',
      allowBackorders: false,
      lowStockThreshold: 5,
      attributeValues: {}
    };
    setVariants(prev => [...prev, baseVariant]);
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    setVariants(prev => prev.map((variant, i) => i === index ? { ...variant, [field]: value } : variant));
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
    setSelectedVariants(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  // ===== Attributes Management =====
  const addAttribute = () => {
    if (!newAttributeName.trim()) return;

    const values = newAttributeValuesList.map(v => v.trim()).filter(v => v);
    if (values.length === 0) return;

    const newAttr: ProductAttribute = {
      id: `attr_${Date.now()}`,
      name: newAttributeName.trim(),
      slug: newAttributeName.trim().toLowerCase().replace(/\s+/g, '_'),
      values: values,
      visible: true,
      forVariations: true
    };

    setAttributes(prev => [...prev, newAttr]);
    setNewAttributeName('');
    setNewAttributeValuesList(['']);
  };

  // Add new value field
  const addValueField = () => {
    setNewAttributeValuesList(prev => [...prev, '']);
  };

  // Update value at index
  const updateValueField = (index: number, value: string) => {
    setNewAttributeValuesList(prev => prev.map((v, i) => i === index ? value : v));
  };

  // Remove value field
  const removeValueField = (index: number) => {
    if (newAttributeValuesList.length > 1) {
      setNewAttributeValuesList(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Handle Enter key to add new field
  const handleValueKeyPress = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentValue = newAttributeValuesList[index];
      if (currentValue && currentValue.trim()) {
        addValueField();
        // Focus on new field after render
        setTimeout(() => {
          const inputs = document.querySelectorAll('.attribute-value-input');
          const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
          if (lastInput) lastInput.focus();
        }, 50);
      }
    }
  };

  const removeAttribute = (id: string) => {
    setAttributes(prev => prev.filter(attr => attr.id !== id));
  };

  const updateAttributeValues = (id: string, newValues: string) => {
    const values = newValues.split('|').map(v => v.trim()).filter(v => v);
    setAttributes(prev => prev.map(attr =>
      attr.id === id ? { ...attr, values } : attr
    ));
  };

  // Generate all possible variations from attributes
  const generateVariations = () => {
    const variationAttributes = attributes.filter(attr => attr.forVariations && attr.values.length > 0);
    if (variationAttributes.length === 0) return;

    // Generate all combinations
    const combinations: { [key: string]: string }[][] = variationAttributes.map(attr =>
      attr.values.map(value => ({ [attr.slug]: value }))
    );

    const allCombinations = combinations.reduce((acc, curr) => {
      if (acc.length === 0) return curr.map(item => [item]);
      return acc.flatMap(combo => curr.map(item => [...combo, item]));
    }, [] as { [key: string]: string }[][]);

    // Create variants from combinations
    const newVariants: ProductVariant[] = allCombinations.map((combo, idx) => {
      const attributeValues = combo.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      const name = Object.values(attributeValues).join(' - ');

      return {
        name,
        type: 'combination',
        sku: `${formData.sku}-${idx + 1}`,
        images: [],
        stock: 0,
        trackInventory: formData.trackInventory,
        isActive: true,
        sortOrder: idx,
        description: '',
        dimensions: {},
        shippingClass: 'standard',
        allowBackorders: false,
        lowStockThreshold: 5,
        attributeValues
      };
    });

    setVariants(newVariants);
    setShowVariants(true);
  };

  // ===== Bulk Actions =====
  const toggleVariantSelection = (index: number) => {
    setSelectedVariants(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const selectAllVariants = () => {
    if (selectedVariants.length === variants.length) {
      setSelectedVariants([]);
    } else {
      setSelectedVariants(variants.map((_, i) => i));
    }
  };

  // Check if bulk action needs input value
  const bulkActionsNeedingInput = [
    'set_price', 'increase_price', 'decrease_price', 'increase_price_percent', 'decrease_price_percent',
    'set_compare_price', 'set_cost', 'set_stock', 'set_low_stock',
    'set_weight', 'set_length', 'set_width', 'set_height', 'set_shipping_class'
  ];

  const handleBulkActionChange = (action: string) => {
    setBulkAction(action);
    setShowBulkInput(bulkActionsNeedingInput.includes(action));
    setBulkValue('');
  };

  const applyBulkAction = () => {
    if (!bulkAction || variants.length === 0) return;

    const numValue = parseFloat(bulkValue) || 0;

    switch (bulkAction) {
      // === Status ===
      case 'activate':
        setVariants(prev => prev.map(v => ({ ...v, isActive: true })));
        break;
      case 'deactivate':
        setVariants(prev => prev.map(v => ({ ...v, isActive: false })));
        break;
      case 'delete':
        if (confirm(`هل أنت متأكد من حذف كل المتغيرات (${variants.length})؟`)) {
          setVariants([]);
        }
        break;

      // === Pricing ===
      case 'set_price':
        setVariants(prev => prev.map(v => ({ ...v, price: numValue })));
        break;
      case 'increase_price':
        setVariants(prev => prev.map(v => ({ ...v, price: (v.price || 0) + numValue })));
        break;
      case 'decrease_price':
        setVariants(prev => prev.map(v => ({ ...v, price: Math.max(0, (v.price || 0) - numValue) })));
        break;
      case 'increase_price_percent':
        setVariants(prev => prev.map(v => ({ ...v, price: (v.price || 0) * (1 + numValue / 100) })));
        break;
      case 'decrease_price_percent':
        setVariants(prev => prev.map(v => ({ ...v, price: Math.max(0, (v.price || 0) * (1 - numValue / 100)) })));
        break;
      case 'set_compare_price':
        setVariants(prev => prev.map(v => ({ ...v, comparePrice: numValue })));
        break;
      case 'set_cost':
        setVariants(prev => prev.map(v => ({ ...v, cost: numValue })));
        break;

      // === Inventory ===
      case 'track_inventory':
        setVariants(prev => prev.map(v => ({ ...v, trackInventory: true })));
        break;
      case 'untrack_inventory':
        setVariants(prev => prev.map(v => ({ ...v, trackInventory: false })));
        break;
      case 'set_stock':
        setVariants(prev => prev.map(v => ({ ...v, stock: Math.floor(numValue), trackInventory: true })));
        break;
      case 'set_low_stock':
        setVariants(prev => prev.map(v => ({ ...v, lowStockThreshold: Math.floor(numValue) })));
        break;
      case 'in_stock':
        setVariants(prev => prev.map(v => ({ ...v, stock: v.stock || 10, trackInventory: true })));
        break;
      case 'out_of_stock':
        setVariants(prev => prev.map(v => ({ ...v, stock: 0, trackInventory: true })));
        break;
      case 'allow_backorders':
        setVariants(prev => prev.map(v => ({ ...v, allowBackorders: true })));
        break;
      case 'disallow_backorders':
        setVariants(prev => prev.map(v => ({ ...v, allowBackorders: false })));
        break;

      // === Shipping ===
      case 'set_weight':
        setVariants(prev => prev.map(v => ({ ...v, weight: numValue })));
        break;
      case 'set_length':
        setVariants(prev => prev.map(v => ({ ...v, dimensions: { ...v.dimensions, length: numValue } })));
        break;
      case 'set_width':
        setVariants(prev => prev.map(v => ({ ...v, dimensions: { ...v.dimensions, width: numValue } })));
        break;
      case 'set_height':
        setVariants(prev => prev.map(v => ({ ...v, dimensions: { ...v.dimensions, height: numValue } })));
        break;
      case 'set_shipping_class':
        setVariants(prev => prev.map(v => ({ ...v, shippingClass: bulkValue })));
        break;
    }

    setBulkAction('');
    setBulkValue('');
    setShowBulkInput(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setImages(selectedFiles);
      uploadImages(selectedFiles);
    }
  };

  const uploadImages = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;
    setUploading(true);
    try {
      const data = await uploadFiles(filesToUpload);
      if (data.success) {
        const imageUrls = data.data.map((file: any) => file.fullUrl);
        setUploadedImages(prev => [...prev, ...imageUrls]);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeUploadedImage = async (imageUrl: string, index: number) => {
    try {
      const filename = imageUrl.split('/').pop();
      if (filename) await deleteFile(filename);
      setUploadedImages(prev => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error removing image:', error);
    }
  };

  // Upload variant image
  const uploadVariantImage = async (variantIndex: number, file: File) => {
    try {
      const data = await uploadFiles([file]);
      if (data.success && data.data.length > 0) {
        const imageUrl = data.data[0].fullUrl;
        updateVariant(variantIndex, 'image', imageUrl);
      }
    } catch (error) {
      console.error('Variant image upload error:', error);
    }
  };

  const handleVariantImageChange = (variantIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadVariantImage(variantIndex, e.target.files[0]);
    }
  };

  // دالة التحقق من صحة البيانات
  const validateForm = (): string | null => {
    // التحقق من الحقول المطلوبة
    if (!formData.name || formData.name.trim() === '') {
      setActiveTab('basic');
      return '⚠️ من فضلك أدخل اسم المنتج';
    }

    if (!formData.price || formData.price <= 0) {
      setActiveTab('pricing');
      return '⚠️ من فضلك أدخل سعر المنتج (يجب أن يكون أكبر من صفر)';
    }

    if (!formData.category || formData.category.trim() === '') {
      setActiveTab('basic');
      return '⚠️ من فضلك اختر فئة المنتج';
    }

    // التحقق من السعر القديم
    if (formData.comparePrice && formData.comparePrice <= formData.price) {
      setActiveTab('pricing');
      return '⚠️ السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي';
    }

    // التحقق من المخزون
    if (formData.trackInventory && formData.stock < 0) {
      setActiveTab('inventory');
      return '⚠️ كمية المخزون لا يمكن أن تكون سالبة';
    }

    // التحقق من تواريخ العرض
    if (formData.saleStartDate && formData.saleEndDate) {
      const startDate = new Date(formData.saleStartDate);
      const endDate = new Date(formData.saleEndDate);
      if (endDate <= startDate) {
        setActiveTab('pricing');
        return '⚠️ تاريخ انتهاء العرض يجب أن يكون بعد تاريخ البداية';
      }
    }

    // التحقق من المتغيرات
    if (variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        if (!variant.name || variant.name.trim() === '') {
          setActiveTab('variants');
          return `⚠️ من فضلك أدخل اسم المتغير رقم ${i + 1}`;
        }
        if (variant.price !== undefined && variant.price < 0) {
          setActiveTab('variants');
          return `⚠️ سعر المتغير "${variant.name}" لا يمكن أن يكون سالباً`;
        }
        if (variant.trackInventory && variant.stock < 0) {
          setActiveTab('variants');
          return `⚠️ مخزون المتغير "${variant.name}" لا يمكن أن يكون سالباً`;
        }
      }
    }

    return null; // لا يوجد أخطاء
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // التحقق من صحة البيانات أولاً
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // تحويل الصور base64 إلى URLs قبل الحفظ
      let processedDescription = formData.description;
      
      // البحث عن جميع الصور base64 في الوصف
      const base64ImageRegex = /<img[^>]+src=["'](data:image\/[^"']+)["'][^>]*>/gi;
      const base64Matches = [...processedDescription.matchAll(base64ImageRegex)];
      
      if (base64Matches.length > 0) {
        for (const match of base64Matches) {
          const base64Data = match[1];
          try {
            // تحويل base64 إلى File
            const base64Response = await fetch(base64Data);
            const blob = await base64Response.blob();
            const file = new File([blob], `image-${Date.now()}.png`, { type: blob.type });
            
            // رفع الصورة
            const uploadResult = await uploadFiles([file]);
            if (uploadResult.success && uploadResult.data?.[0]) {
              const imageUrl = uploadResult.data[0].fullUrl || uploadResult.data[0].url;
              
              // استبدال base64 بـ URL
              processedDescription = processedDescription.replace(base64Data, imageUrl);
            }
          } catch (error) {
            console.error('❌ [ProductNewFinal] Error converting base64 image:', error);
            // نترك الصورة base64 كما هي إذا فشل التحويل
          }
        }
      }

      // إرسال الحقول الموجودة فقط في Prisma Schema
      const productData = {
        name: formData.name,
        description: processedDescription,
        price: formData.price,
        comparePrice: formData.comparePrice || null,
        cost: formData.cost || null,
        sku: formData.sku || null,
        category: formData.category, // سيتم تحويله لـ categoryId في الـ Backend
        stock: formData.trackInventory ? formData.stock : 0,
        trackInventory: formData.trackInventory,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured || false,
        enableCheckoutForm: formData.enableCheckoutForm,
        showAddToCartButton: formData.showAddToCartButton,
        saleStartDate: formData.saleStartDate ? new Date(formData.saleStartDate).toISOString() : null,
        saleEndDate: formData.saleEndDate ? new Date(formData.saleEndDate).toISOString() : null,
        sizeGuide: formData.sizeGuide?.trim() || null, // 📏 دليل المقاسات
        tags: formData.tags,
        weight: formData.weight || null,
        dimensions: formData.dimensions || null,
        weight: formData.weight || null,
        dimensions: formData.dimensions || null,
        images: uploadedImages,
        metadata: JSON.stringify({ variantSettings }),
      };

      let result;

      if (isEditMode && id) {
        // تحديث المنتج - استخدام PATCH بدلاً من PUT
        const response = await apiClient.patch(`/products/${id}`, productData);
        result = response.data;

        if (result.success) {
          // تحديث المتغيرات
          for (const variant of variants) {
            if (variant.id) {
              // تحديث متغير موجود - استخدام PUT للمتغيرات
              await apiClient.put(`/products/${id}/variants/${variant.id}`, variant);
            } else {
              // إنشاء متغير جديد
              await productApi.createVariant(id, variant);
            }
          }
          setSuccess(true);
          setTimeout(() => navigate('/products'), 2000);
        } else {
          setError(result.message || 'فشل في تحديث المنتج');
        }
      } else {
        // إنشاء منتج جديد
        const response = await productApi.create(productData);
        result = await response.json();

        if (result.success) {
          const productId = result.data?.id;
          if (variants.length > 0 && productId) {
            for (const variant of variants) {
              await productApi.createVariant(productId, variant);
            }
          }
          setSuccess(true);
          setTimeout(() => navigate('/products'), 2000);
        } else {
          setError(result.message || 'فشل في إنشاء المنتج');
        }
      }
    } catch (err: any) {
      console.error('Error saving product:', err);
      setError(err.response?.data?.message || (isEditMode ? 'فشل في تحديث المنتج' : 'فشل في إنشاء المنتج'));
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'المعلومات الأساسية', icon: <DocumentTextIcon className="w-5 h-5" /> },
    { id: 'pricing', label: 'التسعير', icon: <CurrencyDollarIcon className="w-5 h-5" /> },
    { id: 'inventory', label: 'المخزون', icon: <CubeIcon className="w-5 h-5" /> },
    { id: 'media', label: 'الصور', icon: <PhotoIcon className="w-5 h-5" />, badge: uploadedImages.length > 0 ? String(uploadedImages.length) : undefined },
    { id: 'attributes', label: 'الصفات', icon: <SwatchIcon className="w-5 h-5" />, badge: attributes.length > 0 ? String(attributes.length) : undefined },
    { id: 'variants', label: 'المتغيرات', icon: <CubeIcon className="w-5 h-5" />, badge: variants.length > 0 ? String(variants.length) : undefined },
    { id: 'display', label: 'تخصيص العرض', icon: <EyeIcon className="w-5 h-5" /> },
    { id: 'shipping', label: 'الشحن', icon: <TruckIcon className="w-5 h-5" /> },
    { id: 'advanced', label: 'متقدم', icon: <Cog6ToothIcon className="w-5 h-5" /> },
  ];

  // شاشة التحميل عند جلب بيانات المنتج
  if (loadingProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <h3 className="mt-4 text-sm font-medium text-gray-900">جاري تحميل بيانات المنتج...</h3>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <PlusIcon className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {isEditMode ? 'تم تحديث المنتج بنجاح!' : 'تم إنشاء المنتج بنجاح!'}
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/products')} className="ml-4 p-2 text-gray-400 hover:text-gray-600">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {isEditMode ? 'تعديل بيانات المنتج الحالي' : 'إنشاء منتج جديد'}
              </p>
            </div>
          </div>
          {/* أزرار الحفظ في الأعلى */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                const form = document.querySelector('form');
                if (form) form.requestSubmit();
              }}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'جاري الحفظ...' : (isEditMode ? 'تحديث المنتج' : 'حفظ المنتج')}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-6">
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sticky top-4">
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <span className="flex-shrink-0">{tab.icon}</span>
                      <span className="text-right flex-1">{tab.label}</span>
                      {tab.badge && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <div className="flex-1 space-y-6">
              {error && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="mr-3">
                      <h3 className="text-sm font-bold text-red-800">يرجى تصحيح الخطأ التالي:</h3>
                      <p className="mt-1 text-sm text-red-700">{error}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="mr-auto text-red-500 hover:text-red-700"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'basic' && (
                <div className="bg-white shadow rounded-lg p-6 space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">المعلومات الأساسية</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">اسم المنتج *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
                    <RichTextEditor
                      key={id || 'new'} // Force re-render when product ID changes
                      value={formData.description || ''}
                      onChange={(value) => {
                        const event = {
                          target: {
                            name: 'description',
                            value: value
                          }
                        } as React.ChangeEvent<HTMLTextAreaElement>;
                        handleInputChange(event);
                      }}
                      placeholder="اكتب وصف تفصيلي للمنتج مع إمكانية التنسيق..."
                      minHeight="250px"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      يمكنك استخدام أدوات التنسيق لتنسيق الوصف مثل WooCommerce
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">SKU</label>
                      <input type="text" name="sku" value={formData.sku} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">الفئة *</label>
                      <select name="category" value={formData.category} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                        <option value="">اختر فئة</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                    <label className="mr-2 block text-sm text-gray-900">المنتج نشط</label>
                  </div>
                </div>
              )}

              {activeTab === 'pricing' && (
                <div className="bg-white shadow rounded-lg p-6 space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">التسعير</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">السعر في الخصم ({displayCurrency}) *</label>
                      <input type="number" name="price" value={formData.price} onChange={handleInputChange} min="0" step="0.01" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">السعر الأساسي ({displayCurrency})</label>
                      <input type="number" name="comparePrice" value={formData.comparePrice || ''} onChange={handleInputChange} min="0" step="0.01" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" />
                      <p className="mt-1 text-xs text-gray-500">للمقارنة فقط (اختياري)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">سعر الشراء ({displayCurrency})</label>
                      <input type="number" name="cost" value={formData.cost || ''} onChange={handleInputChange} min="0" step="0.01" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" />
                      <p className="mt-1 text-xs text-gray-500">تكلفة شراء المنتج (اختياري)</p>
                    </div>
                  </div>
                  <div className="border-t pt-6 grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">تاريخ بداية العرض</label>
                      <input type="datetime-local" name="saleStartDate" value={formData.saleStartDate} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                      <p className="mt-1 text-xs text-gray-500">تاريخ ووقت بداية العرض (اختياري)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">تاريخ انتهاء العرض</label>
                      <input type="datetime-local" name="saleEndDate" value={formData.saleEndDate} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
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
              )}

              {activeTab === 'inventory' && (
                <div className="bg-white shadow rounded-lg p-6 space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">المخزون</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">تتبع المخزون</label>
                      <p className="text-sm text-gray-500">فعل هذا الخيار إذا كنت تريد تتبع كمية المخزون لهذا المنتج</p>
                    </div>
                    <input type="checkbox" name="trackInventory" checked={formData.trackInventory} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                  </div>
                  {formData.trackInventory && (
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">الكمية المتاحة *</label>
                        <input type="number" name="stock" value={formData.stock} onChange={handleInputChange} min="0" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">حد التنبيه</label>
                        <input type="number" name="lowStockThreshold" value={formData.lowStockThreshold} onChange={handleInputChange} min="0" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="5" />
                        <p className="mt-1 text-xs text-gray-500">سيتم تنبيهك عند انخفاض المخزون لهذا الحد</p>
                      </div>
                    </div>
                  )}
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
                </div>
              )}

              {activeTab === 'media' && (
                <div className="bg-white shadow rounded-lg p-6 space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">صور المنتج</h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input type="file" multiple onChange={handleImageChange} className="hidden" id="images" accept="image/png, image/jpeg, image/gif" />
                    <label htmlFor="images" className="cursor-pointer text-indigo-600 hover:text-indigo-500 block">
                      <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <span className="mt-2 block text-sm font-medium">اختر صور للرفع</span>
                      <span className="mt-1 block text-xs text-gray-500">PNG, JPG, GIF حتى 10MB</span>
                    </label>
                  </div>
                  {uploading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <p className="text-sm text-blue-700">جاري رفع الصور...</p>
                    </div>
                  )}
                  {uploadedImages.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-3">الصور المرفوعة ({uploadedImages.length})</p>
                      <div className="grid grid-cols-4 gap-4">
                        {uploadedImages.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img src={url} alt="" className="h-24 w-full object-cover rounded-lg border border-gray-200" />
                            <button type="button" onClick={() => removeUploadedImage(url, idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Attributes Tab */}
              {activeTab === 'attributes' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">📋 الصفات (Attributes)</h3>
                      <p className="text-sm text-gray-500">أضف صفات مثل اللون والحجم لإنشاء متغيرات المنتج</p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setAttributeMode('templates')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${attributeMode === 'templates'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="text-2xl mb-2">📦</div>
                      <h4 className="font-medium text-gray-900">قوالب جاهزة</h4>
                      <p className="text-xs text-gray-500 mt-1">اختر من صفات شائعة معدة مسبقاً</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttributeMode('custom')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${attributeMode === 'custom'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="text-2xl mb-2">✏️</div>
                      <h4 className="font-medium text-gray-900">صفات مخصصة</h4>
                      <p className="text-xs text-gray-500 mt-1">أنشئ صفات خاصة بمنتجك</p>
                    </button>
                  </div>

                  {/* Templates Mode */}
                  {attributeMode === 'templates' && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700">اختر من القوالب الجاهزة:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { icon: '🎨', name: 'اللون', slug: 'color', values: ['أسود', 'أبيض', 'أحمر', 'أزرق', 'أخضر'] },
                          { icon: '📏', name: 'الحجم', slug: 'size', values: ['S', 'M', 'L', 'XL', 'XXL'] },
                          { icon: '👟', name: 'مقاس الحذاء', slug: 'shoe_size', values: ['38', '39', '40', '41', '42', '43', '44'] },
                          { icon: '🧵', name: 'الخامة', slug: 'material', values: ['قطن', 'بوليستر', 'جلد', 'كتان'] },
                          { icon: '💍', name: 'لون المعدن', slug: 'metal_color', values: ['ذهبي', 'فضي', 'روز جولد', 'أسود'] },
                          { icon: '💾', name: 'السعة', slug: 'capacity', values: ['64GB', '128GB', '256GB', '512GB'] },
                          { icon: '⚖️', name: 'الوزن', slug: 'weight', values: ['250g', '500g', '1kg', '2kg'] },
                          { icon: '📦', name: 'العبوة', slug: 'pack', values: ['قطعة', '3 قطع', '6 قطع', '12 قطعة'] },
                        ].map((template) => {
                          const isAdded = attributes.some(a => a.slug === template.slug);
                          return (
                            <button
                              key={template.slug}
                              type="button"
                              onClick={() => {
                                if (!isAdded) {
                                  const newAttr: ProductAttribute = {
                                    id: `attr_${template.slug}_${Date.now()}`,
                                    name: template.name,
                                    slug: template.slug,
                                    values: template.values,
                                    visible: true,
                                    forVariations: true
                                  };
                                  setAttributes(prev => [...prev, newAttr]);
                                }
                              }}
                              disabled={isAdded}
                              className={`p-3 rounded-lg border-2 transition-all text-center ${isAdded
                                ? 'border-green-300 bg-green-50 cursor-default'
                                : 'border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                                }`}
                            >
                              <span className="text-2xl">{template.icon}</span>
                              <p className="text-sm font-medium text-gray-700 mt-1">{template.name}</p>
                              <p className="text-xs text-gray-500">{template.values.slice(0, 3).join('، ')}...</p>
                              {isAdded && <span className="text-xs text-green-600 mt-1 block">✓ مضاف</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom Mode */}
                  {attributeMode === 'custom' && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">اسم الصفة</label>
                          <input
                            type="text"
                            value={newAttributeName}
                            onChange={e => setNewAttributeName(e.target.value)}
                            placeholder="مثل: اللون، الحجم، النكهة"
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            القيم <span className="text-gray-400 font-normal">(اضغط Enter لإضافة)</span>
                          </label>
                          <div className="space-y-2">
                            {newAttributeValuesList.map((value, index) => (
                              <div key={index} className="flex gap-2">
                                <input
                                  type="text"
                                  value={value}
                                  onChange={e => updateValueField(index, e.target.value)}
                                  onKeyPress={e => handleValueKeyPress(e, index)}
                                  placeholder={index === 0 ? "القيمة الأولى" : "قيمة أخرى..."}
                                  className="attribute-value-input flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                                {newAttributeValuesList.length > 1 && (
                                  <button type="button" onClick={() => removeValueField(index)} className="px-2 text-red-500 hover:text-red-700">
                                    <XMarkIcon className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={addValueField} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                              <PlusIcon className="h-4 w-4" /> إضافة قيمة
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={addAttribute}
                          disabled={!newAttributeName.trim() || !newAttributeValuesList.some(v => v.trim())}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50"
                        >
                          <PlusIcon className="h-4 w-4 inline ml-1" /> إضافة صفة
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Added Attributes List */}
                  {attributes.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-700 mb-3">الصفات المضافة ({attributes.length}):</h4>
                      <div className="space-y-2">
                        {attributes.map(attr => (
                          <div key={attr.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex-1">
                              <span className="font-medium text-gray-800">{attr.name}</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {attr.values.map((val, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{val}</span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1 text-xs text-gray-500">
                                <input
                                  type="checkbox"
                                  checked={attr.forVariations}
                                  onChange={e => setAttributes(prev => prev.map(a => a.id === attr.id ? { ...a, forVariations: e.target.checked } : a))}
                                  className="h-4 w-4 text-indigo-600 rounded"
                                />
                                للمتغيرات
                              </label>
                              <button type="button" onClick={() => removeAttribute(attr.id)} className="text-red-500 hover:text-red-700 p-1">
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generate Variations Button */}
                  {attributes.filter(a => a.forVariations).length > 0 && (
                    <div className="mt-6 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                      <div>
                        <p className="text-green-800 font-medium">
                          🔄 توليد {attributes.filter(a => a.forVariations).reduce((acc, attr) => acc * attr.values.length, 1)} متغير
                        </p>
                        <p className="text-green-600 text-sm">
                          من {attributes.filter(a => a.forVariations).map(a => a.name).join(' × ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { generateVariations(); setActiveTab('variants'); }}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        توليد المتغيرات ←
                      </button>
                    </div>
                  )}

                  {attributes.length === 0 && (
                    <div className="mt-6 text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      <SwatchIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                      <p>لم تضف أي صفات بعد</p>
                      <p className="text-sm">اختر من القوالب الجاهزة أو أنشئ صفات مخصصة</p>
                    </div>
                  )}
                </div>
              )}

              {/* Variants Tab */}
              {activeTab === 'variants' && (
                <div className="space-y-6">
                  {/* Variants Section */}
                  <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">📦 المتغيرات ({variants.length})</h3>
                        <p className="text-sm text-gray-500">كل متغير له صور وسعر ومخزون منفصل.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowVariants(!showVariants)}
                        className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200"
                      >
                        {showVariants ? 'إخفاء' : 'إظهار'}
                      </button>
                    </div>

                    {/* Bulk Actions */}
                    {showVariants && variants.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium text-gray-700">إجراء جماعي على كل المتغيرات:</span>
                          <select
                            value={bulkAction}
                            onChange={e => handleBulkActionChange(e.target.value)}
                            className="border-gray-300 rounded-md text-sm min-w-[200px]"
                          >
                            <option value="">-- اختر إجراء --</option>
                            <optgroup label="📌 الحالة">
                              <option value="activate">✅ تفعيل الكل</option>
                              <option value="deactivate">⏸️ إيقاف الكل</option>
                              <option value="delete">🗑️ حذف الكل</option>
                            </optgroup>
                            <optgroup label="💰 التسعير">
                              <option value="set_price">💵 تعيين السعر</option>
                              <option value="increase_price">📈 زيادة السعر (مبلغ)</option>
                              <option value="decrease_price">📉 تخفيض السعر (مبلغ)</option>
                              <option value="increase_price_percent">📈 زيادة السعر (%)</option>
                              <option value="decrease_price_percent">📉 تخفيض السعر (%)</option>
                              <option value="set_compare_price">🏷️ تعيين السعر الأساسي</option>
                              <option value="set_cost">💳 تعيين سعر الشراء</option>
                            </optgroup>
                            <optgroup label="📦 المخزون">
                              <option value="track_inventory">📊 تفعيل تتبع المخزون</option>
                              <option value="untrack_inventory">📭 إيقاف تتبع المخزون</option>
                              <option value="set_stock">🔢 تعيين الكمية</option>
                              <option value="set_low_stock">⚠️ تعيين حد التنبيه</option>
                              <option value="in_stock">✅ متوفر</option>
                              <option value="out_of_stock">❌ نفد المخزون</option>
                              <option value="allow_backorders">🔄 السماح بالطلبات المسبقة</option>
                              <option value="disallow_backorders">🚫 منع الطلبات المسبقة</option>
                            </optgroup>
                            <optgroup label="🚚 الشحن">
                              <option value="set_weight">⚖️ تعيين الوزن (كجم)</option>
                              <option value="set_length">📏 تعيين الطول (سم)</option>
                              <option value="set_width">📐 تعيين العرض (سم)</option>
                              <option value="set_height">📐 تعيين الارتفاع (سم)</option>
                              <option value="set_shipping_class">📦 تعيين فئة الشحن</option>
                            </optgroup>
                          </select>

                          {/* Input for value-based actions */}
                          {showBulkInput && bulkAction !== 'set_shipping_class' && (
                            <input
                              type="number"
                              value={bulkValue}
                              onChange={e => setBulkValue(e.target.value)}
                              placeholder={
                                bulkAction.includes('percent') ? 'النسبة %' :
                                  bulkAction.includes('price') || bulkAction.includes('cost') ? 'المبلغ' :
                                    bulkAction.includes('stock') ? 'الكمية' :
                                      bulkAction.includes('weight') ? 'الوزن (كجم)' :
                                        'القيمة'
                              }
                              className="border-gray-300 rounded-md text-sm w-28"
                              min="0"
                              step={bulkAction.includes('weight') ? '0.01' : '1'}
                            />
                          )}

                          {/* Shipping class select */}
                          {showBulkInput && bulkAction === 'set_shipping_class' && (
                            <select
                              value={bulkValue}
                              onChange={e => setBulkValue(e.target.value)}
                              className="border-gray-300 rounded-md text-sm"
                            >
                              <option value="">اختر فئة الشحن</option>
                              <option value="standard">عادي</option>
                              <option value="heavy">ثقيل</option>
                              <option value="fragile">قابل للكسر</option>
                              <option value="express">سريع</option>
                            </select>
                          )}

                          <button
                            type="button"
                            onClick={applyBulkAction}
                            disabled={!bulkAction || (showBulkInput && !bulkValue)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            تطبيق على {variants.length} متغير
                          </button>
                        </div>
                      </div>
                    )}

                    {showVariants && (
                      <div className="space-y-6">
                        {variants.map((variant, idx) => (
                          <div key={idx} className="border border-gray-300 rounded-lg overflow-hidden">
                            {/* Variant Header */}
                            <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded">{idx + 1}</span>
                                <h4 className="font-medium text-gray-800">
                                  {variant.name || 'متغير جديد'}
                                  {variant.type && <span className="text-gray-500 text-sm mr-2">({variant.type === 'color' ? 'لون' : variant.type === 'size' ? 'حجم' : variant.type})</span>}
                                </h4>
                              </div>
                              <button type="button" onClick={() => removeVariant(idx)} className="text-red-500 hover:text-red-700 p-1">
                                <XMarkIcon className="h-5 w-5" />
                              </button>
                            </div>

                            {/* Variant Content */}
                            <div className="p-4 space-y-6">
                              {/* Section 1: Basic Info */}
                              <div className="border-b border-gray-200 pb-4">
                                <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                  <DocumentTextIcon className="h-4 w-4 ml-1" />
                                  المعلومات الأساسية
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم المتغير *</label>
                                    <input
                                      type="text"
                                      value={variant.name}
                                      onChange={e => updateVariant(idx, 'name', e.target.value)}
                                      placeholder="مثل: أبيض، كبير"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">نوع المتغير</label>
                                    <select
                                      value={variant.type}
                                      onChange={e => updateVariant(idx, 'type', e.target.value)}
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    >
                                      <option value="color">لون</option>
                                      <option value="size">حجم</option>
                                      <option value="material">مادة</option>
                                      <option value="style">نمط</option>
                                      <option value="other">أخرى</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                                    <input
                                      type="text"
                                      value={variant.sku}
                                      onChange={e => updateVariant(idx, 'sku', e.target.value)}
                                      placeholder="PROD-VAR-001"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                </div>
                                {/* Description */}
                                <div className="mt-3">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">وصف المتغير</label>
                                  <textarea
                                    value={variant.description || ''}
                                    onChange={e => updateVariant(idx, 'description', e.target.value)}
                                    rows={2}
                                    placeholder="وصف مختصر لهذا المتغير (اختياري)"
                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                  />
                                </div>
                              </div>

                              {/* Section 2: Image */}
                              <div className="border-b border-gray-200 pb-4">
                                <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                  <PhotoIcon className="h-4 w-4 ml-1" />
                                  صورة المتغير
                                </h5>
                                <div className="flex items-center gap-4">
                                  {variant.image ? (
                                    <div className="relative group">
                                      <img src={variant.image} alt="" className="h-24 w-24 object-cover rounded-lg border" />
                                      <button
                                        type="button"
                                        onClick={() => updateVariant(idx, 'image', undefined)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                                      >×</button>
                                    </div>
                                  ) : (
                                    <label className="h-24 w-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                                      <PhotoIcon className="h-8 w-8 text-gray-400" />
                                      <span className="text-xs text-gray-500 mt-1">رفع صورة</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => handleVariantImageChange(idx, e)}
                                        className="hidden"
                                      />
                                    </label>
                                  )}
                                  <div className="flex-1 space-y-2">
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={variant.image || ''}
                                        onChange={e => updateVariant(idx, 'image', e.target.value)}
                                        placeholder="أو أدخل رابط الصورة"
                                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                      />
                                      <label className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm cursor-pointer hover:bg-indigo-700 flex items-center gap-1">
                                        <PhotoIcon className="h-4 w-4" />
                                        رفع
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={e => handleVariantImageChange(idx, e)}
                                          className="hidden"
                                        />
                                      </label>
                                    </div>
                                    <p className="text-xs text-gray-500">صورة مختلفة لهذا المتغير (اختياري)</p>
                                  </div>
                                </div>
                              </div>

                              {/* Section 3: Pricing */}
                              <div className="border-b border-gray-200 pb-4">
                                <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                  <CurrencyDollarIcon className="h-4 w-4 ml-1" />
                                  التسعير
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">السعر في الخصم ({displayCurrency})</label>
                                    <input
                                      type="number"
                                      value={variant.price || ''}
                                      onChange={e => updateVariant(idx, 'price', e.target.value ? parseFloat(e.target.value) : undefined)}
                                      min="0"
                                      step="0.01"
                                      placeholder="السعر بعد الخصم"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">السعر الأساسي ({displayCurrency})</label>
                                    <input
                                      type="number"
                                      value={variant.comparePrice || ''}
                                      onChange={e => updateVariant(idx, 'comparePrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                                      min="0"
                                      step="0.01"
                                      placeholder="السعر قبل الخصم"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">سعر الشراء ({displayCurrency})</label>
                                    <input
                                      type="number"
                                      value={variant.cost || ''}
                                      onChange={e => updateVariant(idx, 'cost', e.target.value ? parseFloat(e.target.value) : undefined)}
                                      min="0"
                                      step="0.01"
                                      placeholder="تكلفة الشراء"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Section 4: Inventory */}
                              <div className="border-b border-gray-200 pb-4">
                                <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                  <CubeIcon className="h-4 w-4 ml-1" />
                                  المخزون
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700">تتبع المخزون</label>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={variant.trackInventory}
                                      onChange={e => updateVariant(idx, 'trackInventory', e.target.checked)}
                                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                  </div>
                                  {variant.trackInventory && (
                                    <>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">الكمية</label>
                                        <input
                                          type="number"
                                          value={variant.stock}
                                          onChange={e => updateVariant(idx, 'stock', parseInt(e.target.value) || 0)}
                                          min="0"
                                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">حد التنبيه</label>
                                        <input
                                          type="number"
                                          value={variant.lowStockThreshold || ''}
                                          onChange={e => updateVariant(idx, 'lowStockThreshold', parseInt(e.target.value) || undefined)}
                                          min="0"
                                          placeholder="5"
                                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                      </div>
                                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700">طلبات مسبقة</label>
                                          <p className="text-xs text-gray-500">السماح بالشراء عند نفاد المخزون</p>
                                        </div>
                                        <input
                                          type="checkbox"
                                          checked={variant.allowBackorders || false}
                                          onChange={e => updateVariant(idx, 'allowBackorders', e.target.checked)}
                                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Section 5: Shipping */}
                              <div className="border-b border-gray-200 pb-4">
                                <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                  <TruckIcon className="h-4 w-4 ml-1" />
                                  الشحن
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">الوزن (كجم)</label>
                                    <input
                                      type="number"
                                      value={variant.weight || ''}
                                      onChange={e => updateVariant(idx, 'weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                                      min="0"
                                      step="0.01"
                                      placeholder="0.5"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">الطول (سم)</label>
                                    <input
                                      type="number"
                                      value={variant.dimensions?.length || ''}
                                      onChange={e => updateVariant(idx, 'dimensions', { ...variant.dimensions, length: e.target.value ? parseFloat(e.target.value) : undefined })}
                                      min="0"
                                      placeholder="20"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">العرض (سم)</label>
                                    <input
                                      type="number"
                                      value={variant.dimensions?.width || ''}
                                      onChange={e => updateVariant(idx, 'dimensions', { ...variant.dimensions, width: e.target.value ? parseFloat(e.target.value) : undefined })}
                                      min="0"
                                      placeholder="15"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">الارتفاع (سم)</label>
                                    <input
                                      type="number"
                                      value={variant.dimensions?.height || ''}
                                      onChange={e => updateVariant(idx, 'dimensions', { ...variant.dimensions, height: e.target.value ? parseFloat(e.target.value) : undefined })}
                                      min="0"
                                      placeholder="10"
                                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">فئة الشحن</label>
                                  <select
                                    value={variant.shippingClass || 'standard'}
                                    onChange={e => updateVariant(idx, 'shippingClass', e.target.value)}
                                    className="block w-full md:w-1/3 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                  >
                                    <option value="standard">عادي (Standard)</option>
                                    <option value="heavy">ثقيل (Heavy)</option>
                                    <option value="fragile">قابل للكسر (Fragile)</option>
                                    <option value="express">سريع (Express)</option>
                                  </select>
                                </div>
                              </div>

                              {/* Section 6: Status */}
                              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">حالة المتغير</label>
                                  <p className="text-xs text-gray-500">تفعيل أو إيقاف هذا المتغير</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm ${variant.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                                    {variant.isActive ? 'نشط' : 'غير نشط'}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={variant.isActive}
                                    onChange={e => updateVariant(idx, 'isActive', e.target.checked)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Add Variant Button */}
                        <button
                          type="button"
                          onClick={addVariant}
                          className="w-full flex justify-center items-center px-4 py-3 border-2 border-dashed border-indigo-300 rounded-lg text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                        >
                          <PlusIcon className="h-5 w-5 ml-2" />
                          إضافة متغير جديد
                        </button>

                        {/* Info Box */}
                        {variants.length === 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                            <CubeIcon className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                            <p className="text-blue-700 font-medium">لا توجد متغيرات</p>
                            <p className="text-blue-600 text-sm">أضف متغيرات للمنتج مثل الألوان أو الأحجام المختلفة</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Display Customization Tab */}
              {activeTab === 'display' && (
                <div className="space-y-6">
                  <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <EyeIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">تخصيص عرض المتغيرات</h3>
                        <p className="text-sm text-gray-500">
                          اختر كيف تظهر المتغيرات (الألوان، المقاسات) للعملاء في صفحة المنتج.
                          هذه الإعدادات خاصة بهذا المنتج فقط وتلغي الإعدادات العامة.
                        </p>
                      </div>
                    </div>

                    {attributes.filter(a => a.forVariations).length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <SwatchIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">لا توجد صفات للمتغيرات</h3>
                        <p className="mt-1 text-sm text-gray-500">قم بإضافة صفات مثل "اللون" أو "الحجم" في تبويب الصفات أولاً.</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('attributes')}
                          className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          الذهاب للصفات
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {attributes.filter(a => a.forVariations).map((attr) => (
                          <div key={attr.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                <span className="bg-white px-2 py-1 rounded border border-gray-200 text-xs text-gray-500 uppercase">
                                  {attr.name}
                                </span>
                              </h4>
                              <select
                                value={variantSettings.styles[attr.name] || ''}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  setVariantSettings(prev => ({
                                    ...prev,
                                    styles: { ...prev.styles, [attr.name]: val }
                                  }));
                                }}
                                className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value="">(افتراضي من المتجر)</option>
                                <option value="buttons">أزرار (Buttons)</option>
                                <option value="circles">دوائر ألوان (Circles)</option>
                                <option value="dropdown">قائمة منسدلة (Dropdown)</option>
                                <option value="thumbnails">صور مصغرة (Thumbnails)</option>
                                <option value="radio">خيارات (Radio)</option>
                              </select>
                            </div>

                            <div className="p-4 bg-white">
                              <p className="text-sm text-gray-500 mb-4">
                                يمكنك تخصيص صورة لكل قيمة (مثلاً صورة القماش للون الأحمر).
                                ستظهر هذه الصور عند اختيار نمط "دوائر ألوان" أو "صور مصغرة".
                              </p>

                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {attr.values.map((value) => {
                                  const currentImage = variantSettings.attributeImages[attr.name]?.[value];

                                  return (
                                    <div key={value} className="relative group border border-gray-200 rounded-lg p-2 hover:border-indigo-300 transition-colors">
                                      <p className="text-xs font-medium text-center mb-2 text-gray-700 truncate" title={value}>{value}</p>

                                      <div className="aspect-square bg-gray-50 rounded-md overflow-hidden relative">
                                        {currentImage ? (
                                          <>
                                            <img src={currentImage} alt={value} className="w-full h-full object-cover" />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newImages = { ...(variantSettings.attributeImages[attr.name] || {}) };
                                                delete newImages[value];
                                                setVariantSettings(prev => ({
                                                  ...prev,
                                                  attributeImages: { ...prev.attributeImages, [attr.name]: newImages }
                                                }));
                                              }}
                                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                            >
                                              ×
                                            </button>
                                          </>
                                        ) : (
                                          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-gray-100 transition-colors">
                                            <PhotoIcon className="w-6 h-6 text-gray-400" />
                                            <span className="text-[10px] text-gray-500 mt-1">رفع صورة</span>
                                            <input
                                              type="file"
                                              className="hidden"
                                              accept="image/*"
                                              onChange={async (e) => {
                                                if (e.target.files?.[0]) {
                                                  const file = e.target.files[0];
                                                  try {
                                                    const data = await uploadFiles([file]);
                                                    if (data.success && data.data[0]) {
                                                      const url = data.data[0].fullUrl;
                                                      setVariantSettings(prev => ({
                                                        ...prev,
                                                        attributeImages: {
                                                          ...prev.attributeImages,
                                                          [attr.name]: {
                                                            ...(prev.attributeImages[attr.name] || {}),
                                                            [value]: url
                                                          }
                                                        }
                                                      }));
                                                    }
                                                  } catch (err) {
                                                    console.error('Error uploading attribute image', err);
                                                  }
                                                }
                                              }}
                                            />
                                          </label>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="bg-white shadow rounded-lg p-6 space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">معلومات الشحن</h3>
                  <div>
                    <label htmlFor="weight" className="block text-sm font-medium text-gray-700">الوزن (كيلوجرام)</label>
                    <input
                      type="number"
                      id="weight"
                      name="weight"
                      value={formData.weight || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="mt-1 block w-full md:w-1/3 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">الأبعاد (سم)</label>
                      <button
                        type="button"
                        onClick={() => setShowDimensions(!showDimensions)}
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        {showDimensions ? 'إخفاء' : 'إظهار'} الأبعاد
                      </button>
                    </div>
                    {showDimensions && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">الطول</label>
                          <input
                            type="number"
                            value={formData.dimensions?.length || ''}
                            onChange={e => handleDimensionChange('length', e.target.value)}
                            min="0"
                            step="0.1"
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">العرض</label>
                          <input
                            type="number"
                            value={formData.dimensions?.width || ''}
                            onChange={e => handleDimensionChange('width', e.target.value)}
                            min="0"
                            step="0.1"
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">الارتفاع</label>
                          <input
                            type="number"
                            value={formData.dimensions?.height || ''}
                            onChange={e => handleDimensionChange('height', e.target.value)}
                            min="0"
                            step="0.1"
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="bg-white shadow rounded-lg p-6 space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">إعدادات متقدمة</h3>

                  {/* Featured Product */}
                  <div className="space-y-4 border-b border-gray-200 pb-6">
                    <h4 className="text-md font-medium text-gray-900">المنتج المميز</h4>
                    <div className="flex items-center">
                      <input
                        id="isFeatured"
                        name="isFeatured"
                        type="checkbox"
                        checked={formData.isFeatured}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="isFeatured" className="mr-2 block text-sm text-gray-900">
                        تمييز هذا المنتج (Featured)
                      </label>
                    </div>
                    <p className="mr-6 text-xs text-gray-500">سيظهر المنتج في الصفحة الرئيسية والأقسام المميزة</p>

                    {formData.isFeatured && (
                      <div>
                        <label htmlFor="featuredPriority" className="block text-sm font-medium text-gray-700 mb-1">
                          أولوية العرض
                        </label>
                        <input
                          type="number"
                          id="featuredPriority"
                          name="featuredPriority"
                          value={formData.featuredPriority}
                          onChange={handleInputChange}
                          min="0"
                          max="100"
                          className="mt-1 block w-full md:w-1/3 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="0"
                        />
                        <p className="mt-1 text-xs text-gray-500">الأرقام الأعلى تظهر أولاً (0-100)</p>
                      </div>
                    )}
                  </div>

                  {/* Shipping Settings */}
                  <div className="space-y-4 border-b border-gray-200 pb-6">
                    <h4 className="text-md font-medium text-gray-900">إعدادات الشحن</h4>

                    <div>
                      <label htmlFor="shippingClass" className="block text-sm font-medium text-gray-700 mb-1">
                        فئة الشحن
                      </label>
                      <select
                        id="shippingClass"
                        name="shippingClass"
                        value={formData.shippingClass}
                        onChange={handleInputChange}
                        className="mt-1 block w-full md:w-1/2 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="standard">عادي (Standard)</option>
                        <option value="heavy">ثقيل (Heavy)</option>
                        <option value="fragile">قابل للكسر (Fragile)</option>
                        <option value="express">سريع (Express)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">تحدد تكلفة الشحن بناءً على نوع المنتج</p>
                    </div>

                    <div className="flex items-center">
                      <input
                        id="excludeFromFreeShipping"
                        name="excludeFromFreeShipping"
                        type="checkbox"
                        checked={formData.excludeFromFreeShipping}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="excludeFromFreeShipping" className="mr-2 block text-sm text-gray-900">
                        استثناء من الشحن المجاني
                      </label>
                    </div>
                    <p className="mr-6 text-xs text-gray-500">لن ينطبق عليه عروض الشحن المجاني حتى لو وصل الطلب للحد الأدنى</p>
                  </div>

                  {/* Checkout Settings */}
                  <div className="space-y-4 border-b border-gray-200 pb-6">
                    <h4 className="text-md font-medium text-gray-900">إعدادات الشراء</h4>
                    <div className="flex items-center">
                      <input
                        id="enableCheckoutForm"
                        name="enableCheckoutForm"
                        type="checkbox"
                        checked={formData.enableCheckoutForm}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="enableCheckoutForm" className="mr-2 block text-sm text-gray-900">
                        تفعيل فورم الشيك أوت لهذا المنتج
                      </label>
                    </div>
                    <p className="mr-6 text-xs text-gray-500">يسمح للعملاء بإتمام الطلب مباشرة من صفحة المنتج</p>

                    <div className="flex items-center">
                      <input
                        id="showAddToCartButton"
                        name="showAddToCartButton"
                        type="checkbox"
                        checked={formData.showAddToCartButton}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="showAddToCartButton" className="mr-2 block text-sm text-gray-900">
                        إظهار زر إضافة للسلة في صفحة المنتج
                      </label>
                    </div>
                    <p className="mr-6 text-xs text-gray-500">عند إلغاء التفعيل، لن يظهر زر "أضف للسلة"</p>
                  </div>

                  {/* Size Guide */}
                  <div className="space-y-4 border-b border-gray-200 pb-6">
                    <h4 className="text-md font-medium text-gray-900">📏 دليل المقاسات</h4>
                    <div>
                      <label htmlFor="sizeGuide" className="block text-sm font-medium text-gray-700 mb-2">
                        دليل المقاسات
                      </label>
                      <textarea
                        id="sizeGuide"
                        name="sizeGuide"
                        value={formData.sizeGuide}
                        onChange={handleInputChange}
                        rows={8}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                        placeholder="أدخل دليل المقاسات هنا... يمكنك استخدام Markdown أو HTML

مثال:
# دليل المقاسات

| المقاس | الطول (سم) | العرض (سم) |
|--------|------------|------------|
| S      | 65         | 48         |
| M      | 68         | 50         |
| L      | 71         | 52         |
| XL     | 74         | 54         |"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        يمكنك إضافة جدول مقاسات للمنتج. سيظهر للعملاء في صفحة المنتج.
                      </p>
                    </div>
                  </div>

                  {/* Recommended Products */}
                  <div className="space-y-4 border-b border-gray-200 pb-6">
                    <h4 className="text-md font-medium text-gray-900">المنتجات المقترحة</h4>
                    <p className="text-sm text-gray-600">
                      حدد منتجات معينة لعرضها كتوصيات. سيتم دمجها مع التوصيات التلقائية من النظام.
                    </p>

                    {/* Related Products */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        المنتجات المشابهة (Related Products)
                      </label>
                      <p className="text-xs text-gray-500 mb-3">منتجات من نفس الفئة أو مشابهة للمنتج الحالي</p>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={relatedInput}
                            onChange={(e) => setRelatedInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (relatedInput.trim() && !relatedProducts.includes(relatedInput.trim())) {
                                  setRelatedProducts([...relatedProducts, relatedInput.trim()]);
                                  setRelatedInput('');
                                }
                              }
                            }}
                            placeholder="أدخل ID المنتج واضغط Enter"
                            className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (relatedInput.trim() && !relatedProducts.includes(relatedInput.trim())) {
                                setRelatedProducts([...relatedProducts, relatedInput.trim()]);
                                setRelatedInput('');
                              }
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                        {relatedProducts.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {relatedProducts.map((id, index) => (
                              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                                Product #{id}
                                <button
                                  type="button"
                                  onClick={() => setRelatedProducts(relatedProducts.filter((_, i) => i !== index))}
                                  className="mr-1 ml-1"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upsell Products */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        منتجات الترقية (Upsell Products)
                      </label>
                      <p className="text-xs text-gray-500 mb-3">منتجات أفضل وأغلى لتشجيع العميل على الترقية</p>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={upsellInput}
                            onChange={(e) => setUpsellInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (upsellInput.trim() && !upsellProducts.includes(upsellInput.trim())) {
                                  setUpsellProducts([...upsellProducts, upsellInput.trim()]);
                                  setUpsellInput('');
                                }
                              }
                            }}
                            placeholder="أدخل ID المنتج واضغط Enter"
                            className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (upsellInput.trim() && !upsellProducts.includes(upsellInput.trim())) {
                                setUpsellProducts([...upsellProducts, upsellInput.trim()]);
                                setUpsellInput('');
                              }
                            }}
                            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                        {upsellProducts.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {upsellProducts.map((id, index) => (
                              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                                Product #{id}
                                <button
                                  type="button"
                                  onClick={() => setUpsellProducts(upsellProducts.filter((_, i) => i !== index))}
                                  className="mr-1 ml-1"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cross-sell Products */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        منتجات مكملة (Cross-sell Products)
                      </label>
                      <p className="text-xs text-gray-500 mb-3">منتجات تُشترى عادة مع هذا المنتج</p>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={crossSellInput}
                            onChange={(e) => setCrossSellInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (crossSellInput.trim() && !crossSellProducts.includes(crossSellInput.trim())) {
                                  setCrossSellProducts([...crossSellProducts, crossSellInput.trim()]);
                                  setCrossSellInput('');
                                }
                              }
                            }}
                            placeholder="أدخل ID المنتج واضغط Enter"
                            className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (crossSellInput.trim() && !crossSellProducts.includes(crossSellInput.trim())) {
                                setCrossSellProducts([...crossSellProducts, crossSellInput.trim()]);
                                setCrossSellInput('');
                              }
                            }}
                            className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                        {crossSellProducts.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {crossSellProducts.map((id, index) => (
                              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                                Product #{id}
                                <button
                                  type="button"
                                  onClick={() => setCrossSellProducts(crossSellProducts.filter((_, i) => i !== index))}
                                  className="mr-1 ml-1"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-xs text-blue-700">
                        ℹ️ <strong>ملاحظة:</strong> النظام يقترح منتجات تلقائياً بناءً على الفئة والطلبات السابقة.
                        المنتجات المحددة هنا ستُضاف للتوصيات التلقائية.
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">العلامات (Tags)</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center pl-3 pr-2 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="mr-1 flex-shrink-0 ml-1 h-4 w-4 rounded-full inline-flex items-center justify-center text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:outline-none focus:bg-indigo-500 focus:text-white"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyPress={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="أضف علامة جديدة واضغط Enter"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                        إضافة
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">اضغط Enter لإضافة العلامة</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 space-x-reverse pt-5 border-t border-gray-200">
                <button type="button" onClick={() => navigate('/products')} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">إلغاء</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {loading ? 'جاري الحفظ...' : (isEditMode ? 'تحديث المنتج' : 'حفظ المنتج')}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductNewFinal;

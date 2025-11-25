# ✅ حالة التطبيق الكامل - ProductNewTabsDemo

## 🎉 ما تم إنجازه

### المرحلة 1: State Management ✅
- ✅ إضافة كل الـ interfaces (ProductFormData, Category, ProductVariant)
- ✅ إضافة كل الـ imports المطلوبة
- ✅ إضافة كل الـ state variables:
  - `formData` - بيانات المنتج الكاملة
  - `categories` - الفئات
  - `variants` - المتغيرات
  - `uploadedImages` - الصور المرفوعة
  - `loading`, `error`, `success` - حالات النموذج
  - `newTag`, `showDimensions` - حالات إضافية
  - `currency` & `displayCurrency` - العملة

---

## 📋 المراحل المتبقية

### المرحلة 2: إضافة الوظائف الأساسية ⏳

يجب إضافة هذه الوظائف بعد السطر 114 (بعد تعريف tabs):

```typescript
// Load categories from API
useEffect(() => {
  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/products/categories');
      const data = response.data;
      
      if (data.success && data.data) {
        setCategories(data.data);
      } else if (Array.isArray(data)) {
        setCategories(data);
      } else {
        setError('فشل في تحميل الفئات');
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('حدث خطأ أثناء الاتصال بالخادم');
    }
  };
  fetchCategories();
}, []);

// Handle input changes
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

// Handle dimension changes
const handleDimensionChange = (dimension: 'length' | 'width' | 'height', value: string) => {
  const numValue = value === '' ? undefined : parseFloat(value);
  setFormData(prev => ({
    ...prev,
    dimensions: {
      ...prev.dimensions,
      [dimension]: numValue,
    },
  }));
};

// Tags management
const addTag = () => {
  if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
    setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
    setNewTag('');
  }
};

const removeTag = (tagToRemove: string) => {
  setFormData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }));
};

// Variant management
const addVariant = () => {
  const baseVariant: any = {
    name: '',
    type: 'color',
    sku: '',
    images: [],
    stock: 0,
    trackInventory: formData.trackInventory,
    isActive: true,
    sortOrder: variants.length,
    metadata: null
  };
  
  if (formData.price && formData.price > 0) {
    baseVariant.price = formData.price;
  }
  if (formData.comparePrice && formData.comparePrice > 0) {
    baseVariant.comparePrice = formData.comparePrice;
  }
  if (formData.cost && formData.cost > 0) {
    baseVariant.cost = formData.cost;
  }
  
  setVariants(prev => [...prev, baseVariant as ProductVariant]);
};

const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
  setVariants(prev => prev.map((variant, i) =>
    i === index ? { ...variant, [field]: value } : variant
  ));
};

const removeVariant = (index: number) => {
  setVariants(prev => prev.filter((_, i) => i !== index));
};

// Image upload
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
      console.log('Images uploaded successfully:', imageUrls);
    } else {
      console.error('Upload failed:', data.error);
      alert('فشل في رفع الصور: ' + data.error);
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('حدث خطأ أثناء رفع الصور');
  } finally {
    setUploading(false);
  }
};

const removeUploadedImage = async (imageUrl: string, index: number) => {
  try {
    const filename = imageUrl.split('/').pop();
    if (filename) {
      await deleteFile(filename);
    }
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  } catch (error) {
    console.error('Error removing image:', error);
  }
};

// Form validation
const validateForm = (): string | null => {
  if (!formData.name.trim()) return 'اسم المنتج مطلوب';
  if (!formData.category) return 'فئة المنتج مطلوبة';
  if (formData.price <= 0) return 'سعر المنتج يجب أن يكون أكبر من صفر';
  if (formData.trackInventory && formData.stock < 0) return 'كمية المخزون لا يمكن أن تكون سالبة';
  if (formData.comparePrice && formData.comparePrice <= formData.price) {
    return 'السعر القديم لازم يكون أكتر من السعر الحالي';
  }

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    if (!variant) continue;
    if (!variant.name.trim()) return `اسم المتغير ${i + 1} مطلوب`;
    if (variant.trackInventory && variant.stock < 0) return `كمية مخزون المتغير ${i + 1} لا يمكن أن تكون سالبة`;
  }

  return null;
};

// Form submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  const validationError = validateForm();
  if (validationError) {
    setError(validationError);
    return;
  }

  setLoading(true);

  try {
    const productData = {
      name: formData.name,
      description: formData.description,
      price: formData.price,
      comparePrice: formData.comparePrice,
      cost: formData.cost,
      sku: formData.sku,
      category: formData.category,
      stock: formData.trackInventory ? formData.stock : 0,
      trackInventory: formData.trackInventory,
      lowStockThreshold: formData.lowStockThreshold,
      isActive: formData.isActive,
      enableCheckoutForm: formData.enableCheckoutForm,
      showAddToCartButton: formData.showAddToCartButton,
      saleStartDate: formData.saleStartDate ? new Date(formData.saleStartDate).toISOString() : undefined,
      saleEndDate: formData.saleEndDate ? new Date(formData.saleEndDate).toISOString() : undefined,
      tags: formData.tags,
      weight: formData.weight,
      dimensions: formData.dimensions,
      images: uploadedImages,
    };

    const token = authService.getAccessToken();
    if (!token) {
      setError('توكن المصادقة غير موجود. يرجى تسجيل الدخول.');
      setLoading(false);
      return;
    }

    const response = await productApi.create(productData);
    const result = await response.json();

    if (result.success) {
      const productId = result.data?.id;

      if (variants.length > 0 && productId) {
        try {
          for (const variant of variants) {
            const variantResponse = await productApi.createVariant(productId, variant);
            if (!variantResponse.ok) {
              console.error('Failed to create variant:', variant.name);
            }
          }
        } catch (variantError) {
          console.error('Error creating variants:', variantError);
        }
      }

      setSuccess(true);
      setTimeout(() => navigate('/products'), 2000);
    } else {
      setError(result.message || 'فشل في إنشاء المنتج.');
    }
  } catch (err) {
    console.error('Error creating product:', err);
    setError('فشل في إنشاء المنتج. الرجاء المحاولة مرة أخرى.');
  } finally {
    setLoading(false);
  }
};

// Success screen
if (success) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">تم إنشاء المنتج بنجاح!</h3>
        <p className="mt-1 text-sm text-gray-500">سيتم توجيهك إلى صفحة المنتجات...</p>
      </div>
    </div>
  );
}
```

---

### المرحلة 3: تحديث الحقول في الـ JSX ⏳

يجب تحديث كل الحقول لتستخدم `formData` و `handleInputChange`:

#### مثال - المعلومات الأساسية:
```typescript
<input
  type="text"
  id="name"
  name="name"
  value={formData.name}
  onChange={handleInputChange}
  className="w-full px-4 py-2 border border-gray-300 rounded-md"
  placeholder="أدخل اسم المنتج"
  required
/>
```

#### مثال - الفئات (من API):
```typescript
<select
  id="category"
  name="category"
  value={formData.category}
  onChange={handleInputChange}
  className="w-full px-4 py-2 border border-gray-300 rounded-md"
  required
>
  <option value="">اختر فئة</option>
  {categories.map(cat => (
    <option key={cat.id} value={cat.id}>
      {cat.name}
    </option>
  ))}
</select>
```

#### مثال - رفع الصور:
```typescript
<input
  id="images"
  name="images"
  type="file"
  className="sr-only"
  multiple
  onChange={handleImageChange}
  accept="image/png, image/jpeg, image/gif"
/>

{uploading && <div>جاري رفع الصور...</div>}

{uploadedImages.length > 0 && (
  <div className="grid grid-cols-4 gap-4">
    {uploadedImages.map((imageUrl, index) => (
      <div key={index} className="relative group">
        <img src={imageUrl} alt={`صورة ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
        <button
          type="button"
          onClick={() => removeUploadedImage(imageUrl, index)}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6"
        >
          ×
        </button>
      </div>
    ))}
  </div>
)}
```

---

## 🎯 الخطوات التالية

### 1. نسخ الوظائف ✅ (تم)
- ✅ State management
- ⏳ الوظائف الأساسية (يجب إضافتها)

### 2. تحديث الـ JSX ⏳
- [ ] ربط كل الحقول بـ `formData`
- [ ] إضافة `onChange={handleInputChange}`
- [ ] استخدام `categories` من API
- [ ] إضافة رفع الصور الحقيقي
- [ ] إضافة إدارة المتغيرات
- [ ] إضافة إدارة Tags

### 3. إضافة رسائل الخطأ ⏳
```typescript
{error && (
  <div className="bg-red-50 border border-red-200 rounded-md p-4">
    <div className="flex">
      <XMarkIcon className="h-5 w-5 text-red-400" />
      <p className="text-sm text-red-800 mr-3">{error}</p>
    </div>
  </div>
)}
```

### 4. تحديث زر الحفظ ⏳
```typescript
<button
  type="submit"
  disabled={loading}
  className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
  onClick={handleSubmit}
>
  {loading ? 'جاري الحفظ...' : 'حفظ المنتج'}
</button>
```

---

## 📝 ملاحظات مهمة

1. **الملف كبير جداً** (~1000+ سطر)
2. **يجب نسخ كل الوظائف** من `ProductNew.tsx`
3. **يجب تحديث كل الحقول** لتستخدم `formData`
4. **الاختبار ضروري** بعد كل مرحلة

---

## 🚀 الحل السريع

بدلاً من التعديل اليدوي، يمكنك:

1. **نسخ `ProductNew.tsx` بالكامل**
2. **تعديل الـ JSX فقط** لاستخدام القائمة الجانبية
3. **الاحتفاظ بكل الوظائف كما هي**

هذا سيوفر الوقت ويضمن عمل كل شيء!

---

**هل تريد أن أكمل إضافة كل الوظائف الآن؟**

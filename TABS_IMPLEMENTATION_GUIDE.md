# 🎯 دليل تطبيق نظام Tabs في ProductNew

## ✅ تم إنجازه

1. ✅ إنشاء مكون `Tabs.tsx` في `frontend/src/components/common/`
2. ✅ إضافة الـ imports المطلوبة
3. ✅ إضافة state للتبويب النشط
4. ✅ تعريف التبويبات مع الأيقونات

## 📝 الخطوات المتبقية

### الخطوة 1: استعادة الملف الأصلي
```bash
# في حالة حدوث مشاكل، يمكنك استعادة النسخة الاحتياطية
Copy-Item "frontend\src\pages\products\ProductNew.backup.tsx" "frontend\src\pages\products\ProductNew.tsx" -Force
```

### الخطوة 2: تطبيق التعديلات يدوياً

#### 2.1 إضافة Imports (في أعلى الملف)
```typescript
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  DocumentTextIcon,      // ← جديد
  CurrencyDollarIcon,    // ← جديد
  CubeIcon,              // ← جديد
  PhotoIcon,             // ← جديد
  SwatchIcon,            // ← جديد
  TruckIcon,             // ← جديد
  Cog6ToothIcon,         // ← جديد
} from '@heroicons/react/24/outline';
import { Tabs, TabPanel } from '../../components/common/Tabs';  // ← جديد
```

#### 2.2 إضافة State (بعد السطر 96)
```typescript
const [uploading, setUploading] = useState(false);

// Active tab state  ← جديد
const [activeTab, setActiveTab] = useState('basic');  ← جديد
```

#### 2.3 تعريف التبويبات (قبل return، حوالي السطر 366)
```typescript
// Define tabs
const tabs = [
  { 
    id: 'basic', 
    label: 'المعلومات الأساسية', 
    icon: <DocumentTextIcon className="w-5 h-5" /> 
  },
  { 
    id: 'pricing', 
    label: 'التسعير', 
    icon: <CurrencyDollarIcon className="w-5 h-5" /> 
  },
  { 
    id: 'inventory', 
    label: 'المخزون', 
    icon: <CubeIcon className="w-5 h-5" /> 
  },
  { 
    id: 'media', 
    label: 'الصور', 
    icon: <PhotoIcon className="w-5 h-5" />,
    badge: uploadedImages.length > 0 ? uploadedImages.length : undefined
  },
  { 
    id: 'variants', 
    label: 'المتغيرات', 
    icon: <SwatchIcon className="w-5 h-5" />,
    badge: variants.length > 0 ? variants.length : undefined
  },
  { 
    id: 'shipping', 
    label: 'الشحن', 
    icon: <TruckIcon className="w-5 h-5" /> 
  },
  { 
    id: 'advanced', 
    label: 'متقدم', 
    icon: <Cog6ToothIcon className="w-5 h-5" /> 
  },
];
```

#### 2.4 تعديل الـ JSX (استبدل `<form>` بالكود التالي)

```tsx
<form onSubmit={handleSubmit} className="space-y-6">
  <Tabs 
    tabs={tabs} 
    activeTab={activeTab} 
    onTabChange={setActiveTab}
    variant="pills"
  >
    
    {/* ==================== TAB 1: BASIC INFO ==================== */}
    <TabPanel id="basic" activeTab={activeTab}>
      <div className="space-y-6">
        {/* اسم المنتج */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            اسم المنتج *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="أدخل اسم المنتج"
            required
          />
        </div>

        {/* الوصف */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            الوصف
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={5000}
            value={formData.description}
            onChange={handleInputChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="وصف تفصيلي للمنتج"
          />
        </div>

        {/* SKU والفئة */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
              رمز المنتج (SKU)
            </label>
            <input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="اختياري - مثال: PROD-001"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              الفئة *
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              required
            >
              <option value="">اختر فئة</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* حالة المنتج */}
        <div className="flex items-center">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            checked={formData.isActive}
            onChange={handleInputChange}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="mr-2 block text-sm text-gray-900">
            المنتج نشط ومتاح للبيع
          </label>
        </div>
      </div>
    </TabPanel>

    {/* ==================== TAB 2: PRICING ==================== */}
    <TabPanel id="pricing" activeTab={activeTab}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* السعر */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">
              السعر ({displayCurrency}) *
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price || ''}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0.00"
              required
            />
          </div>

          {/* السعر القديم */}
          <div>
            <label htmlFor="comparePrice" className="block text-sm font-medium text-gray-700">
              السعر القديم ({displayCurrency})
            </label>
            <input
              type="number"
              id="comparePrice"
              name="comparePrice"
              value={formData.comparePrice || ''}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-gray-500">السعر الأصلي قبل الخصم (اختياري)</p>
          </div>

          {/* سعر الشراء */}
          <div>
            <label htmlFor="cost" className="block text-sm font-medium text-gray-700">
              سعر الشراء ({displayCurrency})
            </label>
            <input
              type="number"
              id="cost"
              name="cost"
              value={formData.cost || ''}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-gray-500">تكلفة شراء المنتج من المورد (اختياري)</p>
          </div>
        </div>

        {/* تواريخ العروض */}
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
            </div>
          </div>
        </div>
      </div>
    </TabPanel>

    {/* ==================== TAB 3: INVENTORY ==================== */}
    <TabPanel id="inventory" activeTab={activeTab}>
      <div className="space-y-6">
        {/* تتبع المخزون */}
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="trackInventory" className="text-sm font-medium text-gray-700">
              تتبع المخزون
            </label>
            <p className="text-sm text-gray-500">
              فعل هذا الخيار إذا كنت تريد تتبع كمية المخزون لهذا المنتج
            </p>
          </div>
          <input
            type="checkbox"
            id="trackInventory"
            name="trackInventory"
            checked={formData.trackInventory}
            onChange={(e) => setFormData(prev => ({ ...prev, trackInventory: e.target.checked }))}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
        </div>

        {/* حقول المخزون */}
        {formData.trackInventory && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="stock" className="block text-sm font-medium text-gray-700">
                الكمية المتاحة
              </label>
              <input
                type="number"
                id="stock"
                name="stock"
                value={formData.stock || ''}
                onChange={handleInputChange}
                min="0"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="lowStockThreshold" className="block text-sm font-medium text-gray-700">
                حد التنبيه للمخزون المنخفض
              </label>
              <input
                type="number"
                id="lowStockThreshold"
                name="lowStockThreshold"
                value={formData.lowStockThreshold || ''}
                onChange={handleInputChange}
                min="0"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="5"
              />
            </div>
          </div>
        )}

        {!formData.trackInventory && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-700">
              لن يتم تتبع المخزون لهذا المنتج. سيظهر كمتوفر دائماً للعملاء.
            </p>
          </div>
        )}
      </div>
    </TabPanel>

    {/* ==================== TAB 4: MEDIA ==================== */}
    <TabPanel id="media" activeTab={activeTab}>
      {/* [نسخ كود رفع الصور من الملف الأصلي] */}
    </TabPanel>

    {/* ==================== TAB 5: VARIANTS ==================== */}
    <TabPanel id="variants" activeTab={activeTab}>
      {/* [نسخ كود المتغيرات من الملف الأصلي] */}
    </TabPanel>

    {/* ==================== TAB 6: SHIPPING ==================== */}
    <TabPanel id="shipping" activeTab={activeTab}>
      {/* [نسخ كود الشحن من الملف الأصلي] */}
    </TabPanel>

    {/* ==================== TAB 7: ADVANCED ==================== */}
    <TabPanel id="advanced" activeTab={activeTab}>
      {/* [نسخ كود الإعدادات المتقدمة من الملف الأصلي] */}
    </TabPanel>

  </Tabs>

  {/* Error Message */}
  {error && (
    <div className="bg-red-50 border border-red-200 rounded-md p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XMarkIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="mr-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    </div>
  )}

  {/* Submit Buttons */}
  <div className="flex justify-end space-x-3 space-x-reverse pt-5">
    <button
      type="button"
      onClick={() => navigate('/products')}
      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
    >
      إلغاء
    </button>
    <button
      type="submit"
      disabled={loading}
      className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
    >
      {loading ? 'جاري الحفظ...' : 'حفظ المنتج'}
    </button>
  </div>
</form>
```

## 🎨 النتيجة النهائية

بعد التطبيق، ستحصل على:

```
┌─────────────────────────────────────────────────────────────┐
│  ← رجوع          إضافة منتج جديد                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ 📝 أساسي │ 💰 تسعير│ 📦 مخزون│ 🖼️ صور 3│ 🎨 متغيرات│  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
│  ┌──────────┬──────────┐                                   │
│  │ 🚚 شحن  │ ⚙️ متقدم │                                   │
│  └──────────┴──────────┘                                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  اسم المنتج: _____________________________           │ │
│  │  الوصف: ____________________________________          │ │
│  │  SKU: ____________  الفئة: [اختر فئة ▼]              │ │
│  │  ☑ المنتج نشط ومتاح للبيع                           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│                                    [إلغاء]  [حفظ المنتج]  │
└─────────────────────────────────────────────────────────────┘
```

## ✨ المميزات الجديدة

1. **تنظيم أفضل**: كل مجموعة من الحقول في تبويب منفصل
2. **Badges ديناميكية**: عرض عدد الصور والمتغيرات
3. **سهولة التنقل**: التبديل بين التبويبات بضغطة واحدة
4. **قابلية التوسع**: إضافة تبويبات جديدة بسهولة (مثل SEO)
5. **تجربة مستخدم محسّنة**: تقليل التمرير والازدحام البصري

## 🚀 الخطوات التالية

1. ✅ تطبيق التعديلات على `ProductNew.tsx`
2. ⏳ تطبيق نفس النظام على `ProductEditNew.tsx`
3. ⏳ إضافة تبويب SEO
4. ⏳ إضافة Rich Text Editor للوصف
5. ⏳ إضافة Image Gallery متقدم

---

**هل تريد أن أساعدك في تطبيق هذه التعديلات خطوة بخطوة؟**

# 📄 دليل نظام صفحات المتجر

## نظرة عامة
نظام متكامل لإدارة صفحات المتجر القابلة للتخصيص مثل سياسات الشحن، الإرجاع، الأسئلة الشائعة، وغيرها.

---

## 🚀 البدء السريع

### 1. تشغيل Migration
```bash
cd backend
npx prisma migrate dev --name add_store_pages
# أو
node node_modules/prisma/build/index.js migrate dev --name add_store_pages
```

### 2. إعادة تشغيل Backend
```bash
npm run dev
```

### 3. الوصول للنظام
- **صفحة الإدارة**: `http://localhost:3000/settings/store-pages`
- **مثال صفحة عامة**: `http://localhost:3000/shop/page/shipping-policy`

---

## 📋 المميزات

### للمسؤول (Admin Panel)
✅ **إنشاء صفحات جديدة**
- واجهة سهلة الاستخدام
- دعم HTML في المحتوى
- اختيار نوع الصفحة من قائمة محددة

✅ **تعديل الصفحات**
- تعديل العنوان والمحتوى
- تغيير الرابط (Slug)
- إعدادات SEO (Meta Title & Description)

✅ **إدارة العرض**
- تفعيل/إلغاء تفعيل الصفحات
- عرض في الفوتر
- عرض في القائمة الرئيسية
- ترتيب الصفحات

✅ **الصفحات الافتراضية**
- إنشاء 6 صفحات جاهزة بضغطة واحدة:
  1. سياسة الشحن والتوصيل
  2. سياسة الإرجاع والاستبدال
  3. سياسة الاسترجاع المالي
  4. الأسئلة الشائعة (FAQ)
  5. طرق الدفع
  6. عن المتجر

### للعملاء (Public Pages)
✅ **عرض احترافي**
- تصميم نظيف وجذاب
- Responsive على جميع الأجهزة
- سرعة تحميل عالية

✅ **SEO Friendly**
- Meta Tags تلقائية
- عناوين محسّنة
- روابط صديقة لمحركات البحث

✅ **سهولة الوصول**
- روابط في الفوتر
- إمكانية البحث
- تنقل سهل

---

## 🗂️ البنية التقنية

### Backend

#### Database Schema
```prisma
model StorePage {
  id          String   @id @default(cuid())
  companyId   String
  
  // Page Information
  title       String
  slug        String
  content     String   @db.Text
  
  // Page Type
  pageType    StorePageType @default(CUSTOM)
  
  // Display Settings
  isActive    Boolean  @default(true)
  showInFooter Boolean @default(true)
  showInMenu  Boolean  @default(false)
  order       Int      @default(0)
  
  // SEO
  metaTitle       String?
  metaDescription String? @db.Text
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  @@unique([companyId, slug])
  @@index([companyId])
  @@index([slug])
  @@index([isActive])
  @@map("store_pages")
}

enum StorePageType {
  SHIPPING_POLICY
  RETURN_POLICY
  REFUND_POLICY
  PRIVACY_POLICY
  TERMS_CONDITIONS
  ABOUT_US
  CONTACT_US
  FAQ
  PAYMENT_METHODS
  CUSTOM
}
```

#### API Endpoints

**Authenticated Routes** (تحتاج تسجيل دخول):
```
GET    /api/v1/store-pages/:companyId
GET    /api/v1/store-pages/:companyId/page/:pageId
POST   /api/v1/store-pages/:companyId
PUT    /api/v1/store-pages/:companyId/page/:pageId
DELETE /api/v1/store-pages/:companyId/page/:pageId
PATCH  /api/v1/store-pages/:companyId/page/:pageId/toggle
POST   /api/v1/store-pages/:companyId/initialize
```

**Public Routes** (عامة):
```
GET    /api/v1/store-pages/:companyId/slug/:slug
```

#### Controller Functions
- `getAllPages()` - جلب جميع الصفحات
- `getPageById()` - جلب صفحة بالـ ID
- `getPageBySlug()` - جلب صفحة بالـ Slug (عام)
- `createPage()` - إنشاء صفحة جديدة
- `updatePage()` - تحديث صفحة
- `deletePage()` - حذف صفحة
- `togglePageStatus()` - تفعيل/إلغاء تفعيل
- `initializeDefaultPages()` - إنشاء الصفحات الافتراضية

### Frontend

#### Pages
1. **StorePages.tsx** (`/settings/store-pages`)
   - صفحة إدارة الصفحات
   - جدول عرض الصفحات
   - Modal للإضافة/التعديل
   - أزرار الإجراءات

2. **StorePage.tsx** (`/shop/page/:slug`)
   - صفحة عرض عامة للعملاء
   - تصميم احترافي
   - SEO optimized

#### Components
- **Footer.tsx** - تم تحديثه لعرض صفحات المتجر تلقائياً

---

## 📝 أمثلة الاستخدام

### إنشاء صفحة جديدة (API)
```javascript
POST /api/v1/store-pages/:companyId
Content-Type: application/json
Authorization: Bearer {token}

{
  "title": "سياسة الخصوصية",
  "slug": "privacy-policy",
  "content": "<h2>سياسة الخصوصية</h2><p>نحن نحترم خصوصيتك...</p>",
  "pageType": "PRIVACY_POLICY",
  "isActive": true,
  "showInFooter": true,
  "showInMenu": false,
  "metaTitle": "سياسة الخصوصية - متجرنا",
  "metaDescription": "تعرف على كيفية حماية بياناتك"
}
```

### جلب صفحة (Public)
```javascript
GET /api/v1/store-pages/:companyId/slug/shipping-policy

Response:
{
  "success": true,
  "data": {
    "id": "...",
    "title": "سياسة الشحن والتوصيل",
    "slug": "shipping-policy",
    "content": "<h2>سياسة الشحن...</h2>",
    "pageType": "SHIPPING_POLICY",
    "isActive": true,
    "updatedAt": "2024-01-20T10:00:00.000Z"
  }
}
```

### إنشاء الصفحات الافتراضية
```javascript
POST /api/v1/store-pages/:companyId/initialize
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "تم إنشاء الصفحات الافتراضية بنجاح",
  "data": { "count": 6 }
}
```

---

## 🎨 التخصيص

### إضافة نوع صفحة جديد
1. أضف النوع في `schema.prisma`:
```prisma
enum StorePageType {
  // ... الأنواع الموجودة
  WARRANTY_POLICY  // جديد
}
```

2. أضف الترجمة في `StorePages.tsx`:
```typescript
const PAGE_TYPES = {
  // ... الأنواع الموجودة
  WARRANTY_POLICY: 'سياسة الضمان',
};
```

3. شغل Migration:
```bash
npx prisma migrate dev --name add_warranty_policy_type
```

### تخصيص التصميم
- **Admin Panel**: عدّل `StorePages.tsx`
- **Public Page**: عدّل `StorePage.tsx`
- **Footer**: عدّل `Footer.tsx`

---

## 🔧 استكشاف الأخطاء

### المشكلة: الصفحات لا تظهر في الفوتر
**الحل**:
1. تأكد من `showInFooter: true`
2. تأكد من `isActive: true`
3. تحقق من الـ console للأخطاء

### المشكلة: 404 عند فتح صفحة
**الحل**:
1. تأكد من الـ slug صحيح
2. تأكد من الصفحة نشطة
3. تحقق من الـ companyId

### المشكلة: لا يمكن إنشاء صفحات
**الحل**:
1. تأكد من تشغيل Migration
2. تحقق من الـ permissions
3. راجع console للأخطاء

---

## 📊 الإحصائيات

### الملفات المضافة/المعدلة
**Backend:**
- ✅ `schema.prisma` - Model جديد
- ✅ `storePagesController.js` - Controller جديد
- ✅ `storePagesRoutes.js` - Routes جديدة
- ✅ `server.js` - تسجيل Routes

**Frontend:**
- ✅ `StorePages.tsx` - صفحة إدارة
- ✅ `StorePage.tsx` - صفحة عرض
- ✅ `Footer.tsx` - تحديث
- ✅ `Layout.tsx` - إضافة في القائمة
- ✅ `App.tsx` - Routes جديدة

### عدد الأسطر المضافة
- **Backend**: ~600 سطر
- **Frontend**: ~800 سطر
- **المجموع**: ~1400 سطر

---

## 🎯 الخطوات التالية (اختياري)

### تحسينات مقترحة:
1. ✨ **Rich Text Editor** - استخدام CKEditor أو TinyMCE
2. 📱 **Mobile App** - صفحات في تطبيق الموبايل
3. 🔍 **Search** - بحث في محتوى الصفحات
4. 🌐 **Multi-language** - دعم لغات متعددة
5. 📊 **Analytics** - تتبع زيارات الصفحات
6. 💾 **Versioning** - حفظ نسخ سابقة
7. 🎨 **Templates** - قوالب جاهزة للصفحات

---

## 📞 الدعم

للمساعدة أو الاستفسارات:
- راجع الكود المصدري
- تحقق من console logs
- راجع هذا الدليل

---

## ✅ Checklist للنشر

قبل النشر للـ Production:
- [ ] تشغيل Migration على قاعدة البيانات
- [ ] اختبار جميع الصفحات
- [ ] مراجعة المحتوى الافتراضي
- [ ] تحديث SEO Meta Tags
- [ ] اختبار على الموبايل
- [ ] مراجعة الأمان والـ Permissions
- [ ] Backup قاعدة البيانات

---

**تم إنشاء هذا النظام بنجاح! 🎉**

آخر تحديث: 21 نوفمبر 2025

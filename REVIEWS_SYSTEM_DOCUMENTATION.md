# 📖 نظام التقييمات والمراجعات - دليل شامل

## نظرة عامة

نظام التقييمات والمراجعات يسمح للعملاء بتقييم المنتجات وكتابة مراجعات عنها. النظام يدعم:
- ⭐ تقييمات من 1 إلى 5 نجوم
- 📝 مراجعات نصية مع عنوان وتعليق
- ✅ نظام موافقة (Moderation)
- 👍 زر "مفيد" للمراجعات
- 📊 إحصائيات شاملة (متوسط التقييم، توزيع التقييمات)

---

## 🗄️ قاعدة البيانات

### جدول `product_reviews`

```prisma
model ProductReview {
  id              String   @id @default(cuid())
  productId       String
  companyId       String
  customerName    String
  customerEmail   String?
  customerPhone   String?
  rating          Int      // 1-5
  title           String?
  comment         String?  @db.Text
  isVerified      Boolean  @default(false) // تم التحقق من الشراء
  isApproved      Boolean  @default(false) // تمت الموافقة من الإدارة
  helpfulCount    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  product         Product  @relation(...)
  company         Company  @relation(...)
}
```

**الحقول:**
- `rating`: التقييم من 1 إلى 5 (مطلوب)
- `customerName`: اسم العميل (مطلوب)
- `customerEmail`: البريد الإلكتروني (اختياري)
- `customerPhone`: رقم الهاتف (اختياري)
- `title`: عنوان المراجعة (اختياري)
- `comment`: نص المراجعة (اختياري)
- `isApproved`: هل تمت الموافقة على المراجعة؟
- `isVerified`: هل تم التحقق من الشراء؟
- `helpfulCount`: عدد الأشخاص الذين وجدوا المراجعة مفيدة

---

## ⚙️ الإعدادات (Storefront Settings)

يمكن التحكم في نظام التقييمات من إعدادات المتجر:

```typescript
interface StorefrontSettings {
  // Reviews & Ratings Settings
  reviewsEnabled: boolean;              // تفعيل/إلغاء نظام التقييمات
  reviewsRequirePurchase: boolean;       // يتطلب شراء المنتج قبل التقييم
  reviewsModerationEnabled: boolean;    // تفعيل نظام الموافقة
  reviewsShowRating: boolean;           // إظهار متوسط التقييم
  minRatingToDisplay: number;          // الحد الأدنى للتقييم للعرض (1-5)
}
```

### كيفية التفعيل:
1. اذهب إلى **الإعدادات** → **ميزات المتجر**
2. ابحث عن قسم **"التقييمات والمراجعات"**
3. فعّل الخيارات المطلوبة

---

## 🔌 Backend APIs

### 1. جلب التقييمات لمنتج
**Endpoint:** `GET /api/v1/public/products/:productId/reviews`

**Query Parameters:**
- `page`: رقم الصفحة (افتراضي: 1)
- `limit`: عدد التقييمات في الصفحة (افتراضي: 10)
- `minRating`: الحد الأدنى للتقييم (اختياري)

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "...",
        "customerName": "أحمد محمد",
        "rating": 5,
        "title": "منتج رائع",
        "comment": "جودة ممتازة...",
        "helpfulCount": 3,
        "createdAt": "2024-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    },
    "summary": {
      "averageRating": "4.5",
      "totalReviews": 25,
      "ratingDistribution": [
        { "rating": 5, "count": 15 },
        { "rating": 4, "count": 7 },
        { "rating": 3, "count": 2 },
        { "rating": 2, "count": 1 },
        { "rating": 1, "count": 0 }
      ]
    }
  }
}
```

### 2. إضافة تقييم جديد
**Endpoint:** `POST /api/v1/public/products/:productId/reviews`

**Body:**
```json
{
  "customerName": "أحمد محمد",
  "customerEmail": "ahmed@example.com",
  "customerPhone": "01234567890",
  "rating": 5,
  "title": "منتج رائع",
  "comment": "جودة ممتازة وسرعة في التوصيل"
}
```

**Response:**
```json
{
  "success": true,
  "message": "تم إضافة التقييم بنجاح" | "تم إرسال التقييم وانتظار الموافقة",
  "data": { ... }
}
```

**ملاحظات:**
- إذا كان `reviewsModerationEnabled = true`: التقييم يحتاج موافقة (`isApproved = false`)
- إذا كان `reviewsModerationEnabled = false`: التقييم يظهر مباشرة (`isApproved = true`)

### 3. وضع علامة "مفيد" على تقييم
**Endpoint:** `PUT /api/v1/public/reviews/:reviewId/helpful`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "helpfulCount": 4
  }
}
```

---

## 🎨 Frontend Components

### 1. مكون `ProductReviews`

**الموقع:** `frontend/src/components/storefront/ProductReviews.tsx`

**الاستخدام:**
```tsx
<ProductReviews
  productId="product-id"
  enabled={storefrontSettings.reviewsEnabled}
  requirePurchase={storefrontSettings.reviewsRequirePurchase}
  showRating={storefrontSettings.reviewsShowRating}
  minRatingToDisplay={storefrontSettings.minRatingToDisplay}
/>
```

**الميزات:**
- ✅ عرض ملخص التقييمات (متوسط + توزيع)
- ✅ قائمة التقييمات مع pagination
- ✅ نموذج إضافة تقييم جديد
- ✅ زر "مفيد" لكل تقييم
- ✅ فلترة حسب `minRatingToDisplay`

### 2. عرض في صفحة المنتج

**الموقع:** `frontend/src/pages/storefront/ProductDetails.tsx`

**طريقتان للعرض:**

#### أ) داخل Tabs (إذا كان `tabsEnabled = true`)
```tsx
<ProductTabs
  settings={storefrontSettings}
  reviews={
    <ProductReviews
      productId={product.id}
      enabled={storefrontSettings.reviewsEnabled}
      ...
    />
  }
/>
```

#### ب) خارج Tabs (إذا كان `tabsEnabled = false`)
```tsx
{storefrontSettings?.reviewsEnabled && !storefrontSettings?.tabsEnabled && (
  <ProductReviews
    productId={product.id}
    enabled={storefrontSettings.reviewsEnabled}
    ...
  />
)}
```

---

## 🔄 سير العمل (Workflow)

### 1. إضافة تقييم جديد

```
1. العميل يفتح صفحة المنتج
   ↓
2. يضغط على "أضف تقييم"
   ↓
3. يملأ النموذج:
   - الاسم (مطلوب)
   - التقييم من 1-5 (مطلوب)
   - العنوان (اختياري)
   - التعليق (اختياري)
   - البريد/الهاتف (اختياري)
   ↓
4. يضغط "إرسال التقييم"
   ↓
5. Backend يتحقق:
   - هل المنتج موجود؟
   - هل reviewsEnabled = true؟
   - هل reviewsModerationEnabled = true؟
   ↓
6. إذا reviewsModerationEnabled = false:
   → التقييم يظهر مباشرة (isApproved = true)
   ↓
7. إذا reviewsModerationEnabled = true:
   → التقييم يحتاج موافقة (isApproved = false)
   → رسالة: "تم إرسال التقييم وانتظار الموافقة"
```

### 2. عرض التقييمات

```
1. Frontend يستدعي GET /products/:id/reviews
   ↓
2. Backend يجلب:
   - التقييمات الموافق عليها فقط (isApproved = true)
   - يحسب متوسط التقييم
   - يحسب توزيع التقييمات (5⭐, 4⭐, ...)
   ↓
3. Frontend يعرض:
   - ملخص التقييمات (إذا showRating = true)
   - قائمة التقييمات
   - فلترة حسب minRatingToDisplay
```

### 3. الموافقة على التقييمات (Moderation)

**حالياً:** الموافقة تتم يدوياً من قاعدة البيانات أو لوحة التحكم (إن وجدت)

**المستقبل:** يمكن إضافة:
- لوحة تحكم للموافقة على التقييمات
- إشعارات عند إضافة تقييم جديد
- فلترة تلقائية للمحتوى المسيء

---

## 📊 الإحصائيات المحسوبة

### 1. متوسط التقييم (Average Rating)
```javascript
const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
```

### 2. توزيع التقييمات (Rating Distribution)
```javascript
const distribution = [5, 4, 3, 2, 1].map(rating => ({
  rating,
  count: reviews.filter(r => r.rating === rating).length
}));
```

### 3. النسبة المئوية لكل تقييم
```javascript
const percentage = (count / totalReviews) * 100;
```

---

## 🎯 الإعدادات المتقدمة

### 1. `reviewsRequirePurchase`
**الوظيفة:** يتطلب شراء المنتج قبل إضافة تقييم

**التنفيذ الحالي:** ❌ غير مفعّل (يحتاج تطوير)

**كيفية التفعيل المستقبلي:**
- التحقق من وجود طلب (Order) للعميل يحتوي على المنتج
- استخدام `customerEmail` أو `customerPhone` للمطابقة

### 2. `minRatingToDisplay`
**الوظيفة:** إخفاء التقييمات الأقل من قيمة معينة

**مثال:** إذا `minRatingToDisplay = 3`:
- ✅ تظهر التقييمات 3⭐, 4⭐, 5⭐
- ❌ لا تظهر التقييمات 1⭐, 2⭐

### 3. `reviewsModerationEnabled`
**الوظيفة:** تفعيل نظام الموافقة

**عند `true`:**
- التقييمات الجديدة تحتاج موافقة (`isApproved = false`)
- لا تظهر في المتجر حتى الموافقة

**عند `false`:**
- التقييمات تظهر مباشرة (`isApproved = true`)

---

## 🔒 الأمان والتحقق

### 1. التحقق من المنتج
```javascript
const product = await prisma.product.findFirst({
  where: {
    id: productId,
    companyId: company.id,
    isActive: true
  }
});
```

### 2. التحقق من التقييم
```javascript
if (rating < 1 || rating > 5) {
  return res.status(400).json({
    success: false,
    error: 'التقييم يجب أن يكون بين 1 و 5'
  });
}
```

### 3. عزل الشركات (Company Isolation)
- كل شركة ترى تقييمات منتجاتها فقط
- استخدام `companyId` في جميع الاستعلامات

---

## 🐛 المشاكل الشائعة والحلول

### 1. التقييمات لا تظهر
**السبب:** `isApproved = false` و `reviewsModerationEnabled = true`
**الحل:** الموافقة على التقييمات من قاعدة البيانات

### 2. متوسط التقييم غير صحيح
**السبب:** حساب المتوسط من التقييمات غير الموافق عليها
**الحل:** التأكد من حساب المتوسط من `isApproved = true` فقط

### 3. التقييمات لا تُضاف
**السبب:** `reviewsEnabled = false` في الإعدادات
**الحل:** تفعيل `reviewsEnabled` من إعدادات المتجر

---

## 📝 ملاحظات مهمة

1. **الموافقة اليدوية:** حالياً الموافقة تتم يدوياً من قاعدة البيانات
2. **التحقق من الشراء:** `reviewsRequirePurchase` غير مفعّل حالياً
3. **الفلترة التلقائية:** لا توجد فلترة تلقائية للمحتوى المسيء
4. **التقييمات المكررة:** لا يوجد منع للتقييمات المكررة (يمكن إضافتها)

---

## 🚀 تحسينات مستقبلية مقترحة

1. ✅ لوحة تحكم للموافقة على التقييمات
2. ✅ إشعارات عند إضافة تقييم جديد
3. ✅ فلترة تلقائية للمحتوى المسيء
4. ✅ منع التقييمات المكررة (حسب البريد/الهاتف)
5. ✅ ربط التقييمات بالطلبات (`reviewsRequirePurchase`)
6. ✅ إضافة صور للتقييمات
7. ✅ ردود صاحب المتجر على التقييمات
8. ✅ تصدير التقييمات (Excel/CSV)

---

## 📚 الملفات الرئيسية

### Backend
- `backend/routes/productReviewRoutes.js` - Routes
- `backend/controller/productReviewController.js` - Controller
- `backend/prisma/schema.prisma` - Database Schema

### Frontend
- `frontend/src/components/storefront/ProductReviews.tsx` - Component
- `frontend/src/utils/storefrontApi.ts` - API Client
- `frontend/src/pages/storefront/ProductDetails.tsx` - Usage

---

**آخر تحديث:** 2024-12-19


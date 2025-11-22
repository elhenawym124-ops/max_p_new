# 🎟️ نظام الكوبونات والخصومات - مكتمل

## ✅ تم التنفيذ بنجاح

تم إنشاء نظام كامل لإدارة الكوبونات والخصومات لشركة التسويق.

---

## 📋 المكونات المنفذة

### 1. قاعدة البيانات (Prisma Schema)

#### جدول `coupons`
```prisma
model Coupon {
  id                String       @id @default(cuid())
  companyId         String
  code              String       // كود الكوبون (مثل: SUMMER2024)
  name              String       // اسم الكوبون
  description       String?
  type              CouponType   // PERCENTAGE, FIXED, FREE_SHIPPING
  value             Decimal      // القيمة
  minOrderAmount    Decimal?     // الحد الأدنى لقيمة الطلب
  maxDiscountAmount Decimal?     // الحد الأقصى للخصم
  usageLimit        Int?         // عدد مرات الاستخدام الكلي
  usageCount        Int          // عدد مرات الاستخدام الفعلي
  userUsageLimit    Int?         // عدد مرات الاستخدام لكل عميل
  validFrom         DateTime
  validTo           DateTime
  isActive          Boolean
  customerSegments  String?      // JSON: ["all", "new", "VIP", "regular"]
  createdBy         String?
  createdAt         DateTime
  updatedAt         DateTime
}
```

#### جدول `coupon_usages`
```prisma
model CouponUsage {
  id             String   @id @default(cuid())
  couponId       String
  companyId      String
  customerId     String?
  orderId        String?
  discountAmount Decimal
  orderAmount    Decimal
  usedAt         DateTime
}
```

---

## 🎯 الكوبونات المضافة لشركة التسويق

### 1. **SUMMER2024** - خصم الصيف 2024
- **النوع:** نسبة مئوية (20%)
- **الحد الأدنى:** 100 جنيه
- **الحد الأقصى للخصم:** 200 جنيه
- **عدد الاستخدامات:** 100 مرة
- **الفئة المستهدفة:** جميع العملاء
- **الصلاحية:** حتى 31/12/2025

### 2. **NEWCUSTOMER50** - خصم العملاء الجدد
- **النوع:** مبلغ ثابت (50 جنيه)
- **الحد الأدنى:** 200 جنيه
- **عدد الاستخدامات:** 50 مرة
- **الفئة المستهدفة:** العملاء الجدد فقط
- **الصلاحية:** حتى 31/12/2025

### 3. **FREESHIP** - شحن مجاني
- **النوع:** شحن مجاني
- **الحد الأدنى:** 300 جنيه
- **عدد الاستخدامات:** غير محدود
- **الفئة المستهدفة:** جميع العملاء
- **الصلاحية:** حتى 31/12/2025

### 4. **VIP30** - خصم VIP الحصري
- **النوع:** نسبة مئوية (30%)
- **الحد الأدنى:** 500 جنيه
- **الحد الأقصى للخصم:** 500 جنيه
- **عدد الاستخدامات:** 200 مرة (5 مرات لكل عميل)
- **الفئة المستهدفة:** عملاء VIP فقط
- **الصلاحية:** حتى 31/12/2025

### 5. **FLASH100** - عرض فلاش
- **النوع:** مبلغ ثابت (100 جنيه)
- **الحد الأدنى:** 500 جنيه
- **عدد الاستخدامات:** 30 مرة
- **الفئة المستهدفة:** جميع العملاء
- **الصلاحية:** 7 أيام من تاريخ الإنشاء

---

## 🔌 API Endpoints

### الحصول على جميع الكوبونات
```http
GET /api/v1/coupons
Authorization: Bearer {token}

Query Parameters:
- isActive: true/false
- type: PERCENTAGE/FIXED/FREE_SHIPPING
- customerSegment: all/new/VIP/regular
- page: 1
- limit: 20
```

### الحصول على كوبون واحد
```http
GET /api/v1/coupons/:id
Authorization: Bearer {token}
```

### إنشاء كوبون جديد
```http
POST /api/v1/coupons
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "SUMMER2024",
  "name": "خصم الصيف 2024",
  "description": "خصم 20% على جميع المنتجات",
  "type": "PERCENTAGE",
  "value": 20,
  "minOrderAmount": 100,
  "maxDiscountAmount": 200,
  "usageLimit": 100,
  "userUsageLimit": 1,
  "validFrom": "2024-01-01",
  "validTo": "2025-12-31",
  "isActive": true,
  "customerSegments": ["all"]
}
```

### تحديث كوبون
```http
PUT /api/v1/coupons/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "isActive": false
}
```

### حذف كوبون
```http
DELETE /api/v1/coupons/:id
Authorization: Bearer {token}
```

### التحقق من صلاحية كوبون
```http
POST /api/v1/coupons/validate
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "SUMMER2024",
  "orderAmount": 500,
  "customerId": "customer_id_here"
}

Response:
{
  "success": true,
  "data": {
    "coupon": {
      "id": "...",
      "code": "SUMMER2024",
      "name": "خصم الصيف 2024",
      "type": "PERCENTAGE",
      "value": 20
    },
    "discountAmount": 100,
    "finalAmount": 400
  }
}
```

### تطبيق كوبون على طلب
```http
POST /api/v1/coupons/apply
Authorization: Bearer {token}
Content-Type: application/json

{
  "couponId": "coupon_id_here",
  "orderId": "order_id_here",
  "customerId": "customer_id_here",
  "orderAmount": 500,
  "discountAmount": 100
}
```

### إحصائيات الكوبونات
```http
GET /api/v1/coupons/stats
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "totalCoupons": 5,
    "activeCoupons": 5,
    "totalUsages": 0,
    "totalDiscount": 0
  }
}
```

---

## 📁 الملفات المنشأة

### Backend
1. **Schema**: `backend/prisma/schema.prisma`
   - نموذج Coupon
   - نموذج CouponUsage
   - Enum CouponType

2. **Migration**: `backend/prisma/migrations/20241122_add_coupons/migration.sql`
   - إنشاء جدول coupons
   - إنشاء جدول coupon_usages
   - إضافة Foreign Keys

3. **Controller**: `backend/controller/couponsController.js`
   - getCoupons
   - getCoupon
   - createCoupon
   - updateCoupon
   - deleteCoupon
   - validateCoupon
   - applyCoupon
   - getCouponStats

4. **Routes**: `backend/routes/couponsRoutes.js`
   - جميع المسارات محمية بـ authenticateToken

5. **Scripts**:
   - `backend/scripts/runMigration.js` - تشغيل الـ migration
   - `backend/scripts/addTestCoupon.js` - إضافة كوبونات تجريبية

### Frontend
1. **Page**: `frontend/src/pages/coupons/Coupons.tsx`
   - واجهة إدارة الكوبونات
   - فلاتر متقدمة
   - جدول عرض الكوبونات

---

## 🚀 كيفية الاستخدام

### 1. تشغيل الـ Migration
```bash
cd backend
node scripts/runMigration.js
```

### 2. إضافة كوبونات تجريبية
```bash
node scripts/addTestCoupon.js
```

### 3. الوصول للواجهة
```
http://localhost:3000/coupons
```

---

## ✨ المميزات

### 1. أنواع الخصومات
- ✅ نسبة مئوية (PERCENTAGE)
- ✅ مبلغ ثابت (FIXED)
- ✅ شحن مجاني (FREE_SHIPPING)

### 2. شروط الاستخدام
- ✅ الحد الأدنى لقيمة الطلب
- ✅ الحد الأقصى للخصم (للنسبة المئوية)
- ✅ عدد مرات الاستخدام الكلي
- ✅ عدد مرات الاستخدام لكل عميل

### 3. استهداف العملاء
- ✅ جميع العملاء (all)
- ✅ العملاء الجدد (new)
- ✅ عملاء VIP (VIP)
- ✅ العملاء العاديين (regular)

### 4. صلاحية الكوبون
- ✅ تاريخ البداية
- ✅ تاريخ الانتهاء
- ✅ تفعيل/تعطيل الكوبون

### 5. التتبع والإحصائيات
- ✅ عدد مرات الاستخدام
- ✅ سجل الاستخدام
- ✅ إجمالي الخصومات
- ✅ ربط بالطلبات والعملاء

---

## 🔒 الأمان

- ✅ جميع المسارات محمية بـ JWT Authentication
- ✅ التحقق من ملكية الشركة للكوبون
- ✅ التحقق من صلاحية الكوبون قبل الاستخدام
- ✅ منع الاستخدام المتكرر للكوبون

---

## 📊 قاعدة البيانات

### الجداول المنشأة
- ✅ `coupons` - معلومات الكوبونات
- ✅ `coupon_usages` - سجل استخدام الكوبونات

### العلاقات
- ✅ Coupon → Company (Many-to-One)
- ✅ CouponUsage → Coupon (Many-to-One)

---

## 🎉 النتيجة النهائية

تم إنشاء نظام كامل ومتكامل لإدارة الكوبونات والخصومات مع:
- ✅ 5 كوبونات تجريبية لشركة التسويق
- ✅ API كامل للإدارة
- ✅ واجهة مستخدم جاهزة
- ✅ نظام تتبع وإحصائيات
- ✅ أمان وحماية كاملة

**الحالة:** 🟢 جاهز للاستخدام

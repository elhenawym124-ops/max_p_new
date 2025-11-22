# 🧪 اختبار API الكوبونات

## ✅ تم إنشاء النظام بنجاح

---

## 🔍 اختبار سريع

### 1. تسجيل الدخول أولاً
```bash
POST http://localhost:3007/api/v1/auth/login
Content-Type: application/json

{
  "email": "ali@ali.com",
  "password": "your_password"
}
```

احفظ الـ `token` من الرد.

---

### 2. عرض جميع الكوبونات
```bash
GET http://localhost:3007/api/v1/coupons
Authorization: Bearer YOUR_TOKEN_HERE
```

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "code": "SUMMER2024",
      "name": "خصم الصيف 2024",
      "type": "PERCENTAGE",
      "value": 20,
      "isActive": true,
      "usageCount": 0,
      "usageLimit": 100
    },
    // ... المزيد من الكوبونات
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### 3. التحقق من كوبون SUMMER2024
```bash
POST http://localhost:3007/api/v1/coupons/validate
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "code": "SUMMER2024",
  "orderAmount": 500
}
```

**النتيجة المتوقعة:**
```json
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

---

### 4. اختبار كوبون NEWCUSTOMER50
```bash
POST http://localhost:3007/api/v1/coupons/validate
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "code": "NEWCUSTOMER50",
  "orderAmount": 300
}
```

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "data": {
    "coupon": {
      "code": "NEWCUSTOMER50",
      "type": "FIXED",
      "value": 50
    },
    "discountAmount": 50,
    "finalAmount": 250
  }
}
```

---

### 5. اختبار حالة فشل (مبلغ أقل من الحد الأدنى)
```bash
POST http://localhost:3007/api/v1/coupons/validate
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "code": "SUMMER2024",
  "orderAmount": 50
}
```

**النتيجة المتوقعة:**
```json
{
  "success": false,
  "error": "الحد الأدنى لقيمة الطلب هو 100 جنيه"
}
```

---

### 6. عرض إحصائيات الكوبونات
```bash
GET http://localhost:3007/api/v1/coupons/stats
Authorization: Bearer YOUR_TOKEN_HERE
```

**النتيجة المتوقعة:**
```json
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

## 📝 ملاحظات مهمة

### ⚠️ إذا لم يعمل الـ API:
1. **أعد تشغيل الـ Backend:**
   ```bash
   cd backend
   # أوقف الـ server الحالي (Ctrl+C)
   npm start
   ```

2. **تحقق من أن الـ routes مسجلة:**
   - افتح `backend/server.js`
   - ابحث عن: `app.use("/api/v1/coupons", couponsRoutes)`

3. **تحقق من الـ token:**
   - تأكد من أنك مسجل دخول
   - استخدم token صالح في الـ Authorization header

---

## 🎯 الخطوات التالية

### 1. افتح صفحة الكوبونات في المتصفح:
```
http://localhost:3000/coupons
```

### 2. جرب إنشاء كوبون جديد من الواجهة

### 3. اختبر التحقق من الكوبونات

### 4. راقب الإحصائيات

---

## ✅ قائمة التحقق

- [ ] الـ Backend يعمل على `http://localhost:3007`
- [ ] الـ Frontend يعمل على `http://localhost:3000`
- [ ] تم تسجيل الدخول بنجاح
- [ ] يمكن الوصول لـ `/api/v1/coupons`
- [ ] الكوبونات الـ 5 موجودة في قاعدة البيانات
- [ ] صفحة `/coupons` تعمل بشكل صحيح

---

## 🆘 استكشاف الأخطاء

### خطأ 404 - Not Found
```
السبب: الـ routes غير مسجلة
الحل: أعد تشغيل الـ Backend
```

### خطأ 401 - Unauthorized
```
السبب: الـ token غير صالح أو منتهي
الحل: سجل دخول مرة أخرى واحصل على token جديد
```

### خطأ 500 - Internal Server Error
```
السبب: مشكلة في قاعدة البيانات أو الكود
الحل: تحقق من console logs في الـ Backend
```

### الكوبونات لا تظهر
```
السبب: لم يتم تشغيل سكريبت addTestCoupon.js
الحل: 
cd backend
node scripts/addTestCoupon.js
```

---

## 🎉 النتيجة

إذا نجحت جميع الاختبارات أعلاه، فإن نظام الكوبونات يعمل بشكل كامل! 🎊

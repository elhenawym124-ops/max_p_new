# 🧪 دليل الاختبار اليدوي الكامل

## 📋 قائمة الاختبارات

- [ ] 1. تطبيق Database Migration
- [ ] 2. اختبار Backend API
- [ ] 3. اختبار صفحة الإعدادات
- [ ] 4. اختبار حفظ البيانات
- [ ] 5. اختبار CAPI Connection
- [ ] 6. اختبار Pixel في Console
- [ ] 7. اختبار في Facebook Events Manager

---

## 1️⃣ تطبيق Database Migration

### الخطوات:
```bash
# افتح PowerShell كـ Administrator
cd C:\Users\38asfasf\Downloads\max_p_new\backend

# طريقة 1: باستخدام npx
npx prisma db push

# أو طريقة 2: مباشرة
node node_modules/prisma/build/index.js db push
```

### النتيجة المتوقعة:
```
✔ Database schema updated successfully
✔ 26 new columns added to storefront_settings table
```

### كيف تتحقق:
1. افتح Database Client (مثل MySQL Workbench)
2. افتح جدول `storefront_settings`
3. يجب أن ترى الحقول الجديدة:
   - `facebookPixelEnabled`
   - `facebookPixelId`
   - `facebookConvApiEnabled`
   - `facebookConvApiToken`
   - ... إلخ (26 حقل)

---

## 2️⃣ اختبار Backend API

### الخطوة 1: تشغيل Backend
```bash
cd C:\Users\38asfasf\Downloads\max_p_new\backend
npm run dev
```

### النتيجة المتوقعة:
```
✓ Server running on port 5000
✓ Database connected
```

### الخطوة 2: اختبار Endpoints

#### أ. اختبار GET Settings
افتح Postman أو Thunder Client:

```http
GET http://localhost:5000/api/v1/storefront-settings
Authorization: Bearer YOUR_TOKEN
```

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "companyId": "...",
    "facebookPixelEnabled": false,
    "facebookPixelId": null,
    "facebookConvApiEnabled": false,
    "facebookConvApiToken": null,
    ...
  }
}
```

#### ب. اختبار UPDATE Settings
```http
PUT http://localhost:5000/api/v1/storefront-settings
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "facebookPixelEnabled": true,
  "facebookPixelId": "123456789012345",
  "facebookConvApiEnabled": true,
  "facebookConvApiToken": "EAAxxxxxxxx"
}
```

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "data": {
    "facebookPixelEnabled": true,
    "facebookPixelId": "123456789012345",
    ...
  }
}
```

#### ج. اختبار Test CAPI
```http
POST http://localhost:5000/api/v1/storefront-settings/test-facebook-capi
Authorization: Bearer YOUR_TOKEN
```

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "message": "تم إرسال حدث تجريبي بنجاح",
  "data": {
    "eventId": "test_...",
    "pixelId": "123456789012345"
  }
}
```

#### د. اختبار Validate Pixel ID
```http
POST http://localhost:5000/api/v1/storefront-settings/validate-pixel-id
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "pixelId": "123456789012345"
}
```

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "message": "Pixel ID صالح",
  "data": {
    "valid": true,
    "pixelId": "123456789012345"
  }
}
```

---

## 3️⃣ اختبار صفحة الإعدادات (Frontend)

### الخطوة 1: تشغيل Frontend
```bash
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm start
```

### النتيجة المتوقعة:
```
✓ Compiled successfully
✓ Running on http://localhost:3000
```

### الخطوة 2: الوصول للصفحة
1. افتح المتصفح: `http://localhost:3000`
2. سجل دخول
3. من القائمة الجانبية → **إدارة الإعلانات** 🎯
4. اضغط **Facebook Pixel & CAPI**

### ما يجب أن تراه:
```
✅ صفحة كاملة مع:
├─ Header: "Facebook Pixel & Conversions API"
├─ Info Banner (أزرق)
├─ قسم Facebook Pixel
│  ├─ Toggle تفعيل/تعطيل
│  ├─ Input لـ Pixel ID
│  └─ Checkboxes للأحداث
├─ قسم Conversions API
│  ├─ Toggle تفعيل/تعطيل
│  ├─ Input لـ Access Token
│  ├─ زر "اختبار الاتصال"
│  └─ Checkboxes للأحداث
├─ قسم Advanced Settings
│  ├─ Event Deduplication
│  ├─ Event Match Quality Target
│  └─ GDPR Settings
└─ أزرار الحفظ
```

---

## 4️⃣ اختبار حفظ البيانات

### الخطوات:
1. في صفحة الإعدادات
2. فعّل Facebook Pixel ✅
3. أدخل Pixel ID: `123456789012345`
4. فعّل جميع الأحداث ✅
5. فعّل Conversions API ✅
6. أدخل Access Token: `EAAxxxxxxxxxx`
7. اضغط **حفظ الإعدادات**

### النتيجة المتوقعة:
```
✅ Toast notification: "تم حفظ الإعدادات بنجاح"
```

### التحقق:
1. افتح Developer Tools (F12)
2. اذهب إلى **Network** tab
3. ابحث عن Request:
   ```
   PUT /api/v1/storefront-settings
   Status: 200 OK
   ```
4. افحص Response:
   ```json
   {
     "success": true,
     "data": {
       "facebookPixelEnabled": true,
       "facebookPixelId": "123456789012345",
       ...
     }
   }
   ```

---

## 5️⃣ اختبار CAPI Connection

### الخطوات:
1. في صفحة الإعدادات
2. تأكد من إدخال:
   - ✅ Pixel ID صحيح
   - ✅ Access Token صحيح
3. اضغط زر **اختبار الاتصال** 🧪

### النتيجة المتوقعة:
```
✅ Toast: "الاتصال ناجح! تحقق من Facebook Events Manager"
✅ Status يتغير إلى "Active"
✅ Last Test Date يتحدث
```

### التحقق في Console:
```javascript
// يجب أن ترى:
✅ [Facebook CAPI] Test event sent successfully
{
  eventId: "test_1234567890_abc",
  pixelId: "123456789012345",
  eventName: "PageView"
}
```

---

## 6️⃣ اختبار Pixel في المتصفح

### الخطوة 1: تحميل Pixel
1. افتح صفحة Shop: `http://localhost:3000/shop`
2. افتح Developer Tools (F12)
3. اذهب إلى **Console** tab

### النتيجة المتوقعة:
```javascript
✅ [Facebook Pixel] Initialized with ID: 123456789012345
📊 [Facebook Pixel] PageView tracked { eventId: "1234567890_abc" }
```

### الخطوة 2: اختبار ViewContent
1. اضغط على أي منتج
2. افحص Console

### النتيجة المتوقعة:
```javascript
📊 [Facebook Pixel] ViewContent tracked {
  productId: "prod_123",
  eventId: "1234567890_def"
}
```

### الخطوة 3: اختبار AddToCart
1. اضغط "إضافة للسلة"
2. افحص Console

### النتيجة المتوقعة:
```javascript
📊 [Facebook Pixel] AddToCart tracked {
  productId: "prod_123",
  quantity: 1,
  eventId: "1234567890_ghi"
}
```

---

## 7️⃣ اختبار في Facebook Events Manager

### الخطوة 1: الوصول لـ Events Manager
1. اذهب إلى: https://business.facebook.com/events_manager2
2. اختر Pixel الخاص بك
3. اذهب إلى **Test Events**

### الخطوة 2: إضافة Test Event Code
1. في صفحة الإعدادات
2. أدخل Test Event Code (من Facebook)
3. احفظ الإعدادات

### الخطوة 3: اختبار الأحداث
1. في موقعك، قم بـ:
   - زيارة صفحة Shop
   - عرض منتج
   - إضافة للسلة
   - بدء الشراء
2. في Facebook Events Manager → Test Events

### النتيجة المتوقعة:
```
✅ يجب أن ترى الأحداث تظهر فوراً:
├─ PageView (Browser)
├─ PageView (Server) - إذا كان CAPI مفعّل
├─ ViewContent (Browser)
├─ ViewContent (Server)
├─ AddToCart (Browser)
└─ AddToCart (Server)
```

---

## 8️⃣ اختبار Event Match Quality

### الخطوات:
1. في Facebook Events Manager
2. اذهب إلى **Diagnostics**
3. اضغط **Event Match Quality**

### النتيجة المتوقعة:
```
Event Match Quality: 7-9/10 ✅

Parameters Received:
✅ em (Email)
✅ ph (Phone)
✅ fn (First Name)
✅ ln (Last Name)
✅ ct (City)
✅ country
✅ client_ip_address
✅ client_user_agent
✅ fbp (Facebook Browser ID)
```

---

## 9️⃣ اختبار Deduplication

### الهدف:
التأكد من أن نفس الحدث لا يُحسب مرتين (Pixel + CAPI)

### الخطوات:
1. فعّل Pixel + CAPI معاً
2. فعّل Event Deduplication
3. قم بعملية شراء
4. في Facebook Events Manager → Events

### النتيجة المتوقعة:
```
✅ يجب أن ترى حدث واحد فقط "Purchase"
✅ مع علامة "Deduplicated" أو "Matched"
✅ Event ID نفسه في Pixel و CAPI
```

---

## 🔍 استكشاف الأخطاء

### ❌ المشكلة: "لم يتم العثور على إعدادات"
**الحل:**
```bash
# تأكد من تطبيق Migration
cd backend
node node_modules/prisma/build/index.js db push
```

### ❌ المشكلة: "Pixel لا يظهر في Console"
**الحل:**
1. تأكد من تفعيل Pixel في الإعدادات
2. تأكد من صحة Pixel ID (15 رقم)
3. افحص Network tab → ابحث عن `facebook.net`
4. امسح Cache: `Ctrl + Shift + Delete`

### ❌ المشكلة: "فشل اختبار CAPI"
**الحل:**
1. تأكد من صحة Access Token
2. تأكد من صحة Pixel ID
3. تحقق من صلاحيات System User في Facebook
4. افحص Console للأخطاء

### ❌ المشكلة: "الأحداث لا تظهر في Facebook"
**الحل:**
1. تأكد من استخدام Test Event Code
2. انتظر 1-2 دقيقة
3. تحقق من أن Pixel ID صحيح
4. تحقق من أن Access Token صحيح

---

## ✅ Checklist النهائي

### Backend
- [ ] Migration applied successfully
- [ ] Server running without errors
- [ ] GET /storefront-settings works
- [ ] PUT /storefront-settings works
- [ ] POST /test-facebook-capi works
- [ ] POST /validate-pixel-id works

### Frontend
- [ ] Page loads without errors
- [ ] Can see "إدارة الإعلانات" in sidebar
- [ ] Settings page displays correctly
- [ ] Can toggle Pixel on/off
- [ ] Can input Pixel ID
- [ ] Can toggle CAPI on/off
- [ ] Can input Access Token
- [ ] Save button works
- [ ] Test connection button works
- [ ] Toast notifications appear

### Pixel Integration
- [ ] Pixel script loads in browser
- [ ] PageView tracked in console
- [ ] ViewContent tracked when viewing product
- [ ] AddToCart tracked when adding to cart
- [ ] Purchase tracked when completing order

### Facebook Events Manager
- [ ] Events appear in Test Events
- [ ] Event Match Quality > 7/10
- [ ] Deduplication works (no duplicate events)
- [ ] All parameters received correctly

---

## 📊 نتيجة الاختبار

### إذا نجحت جميع الاختبارات:
```
🎉 مبروك! النظام يعمل بشكل كامل!

الآن يمكنك:
✅ استخدام النظام في Production
✅ إنشاء إعلانات Facebook
✅ تتبع الزوار والمشتريات بدقة 90%+
✅ تحسين ROI للإعلانات
```

### إذا فشل أي اختبار:
```
⚠️ راجع قسم "استكشاف الأخطاء" أعلاه
📝 افحص Console للأخطاء
📧 راجع التوثيق في:
   - ANSWERS_TO_YOUR_QUESTIONS.md
   - FACEBOOK_PIXEL_INTEGRATION_GUIDE.md
```

---

## 🎯 الخطوات التالية بعد الاختبار الناجح

1. ✅ احذف Test Event Code
2. ✅ استخدم Access Token حقيقي (System User)
3. ✅ راقب Event Match Quality يومياً
4. ✅ ابدأ في إنشاء إعلانات Facebook
5. ✅ استخدم Custom Audiences
6. ✅ أنشئ Lookalike Audiences

---

**💡 نصيحة:** ابدأ بالاختبارات بالترتيب. كل اختبار يعتمد على نجاح الاختبار السابق.

**⏱️ الوقت المتوقع:** 30-45 دقيقة لإكمال جميع الاختبارات

**🎯 الهدف:** التأكد من أن كل شيء يعمل 100% قبل الاستخدام في Production

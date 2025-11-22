# 🎬 شرح الاختبار خطوة بخطوة (مثل فيديو)

## 🎯 سنختبر النظام من الصفر حتى النهاية

---

## 🎬 المشهد 1: التحضير

### ما تحتاجه:
```
✅ Node.js مثبت
✅ MySQL يعمل
✅ VS Code أو أي محرر نصوص
✅ Chrome أو Edge
✅ 15 دقيقة من وقتك
```

---

## 🎬 المشهد 2: تطبيق Migration

### الخطوة 1: افتح Terminal
```
1. اضغط Windows + R
2. اكتب: powershell
3. اضغط Enter
```

### الخطوة 2: اذهب لمجلد Backend
```powershell
cd C:\Users\38asfasf\Downloads\max_p_new\backend
```

### الخطوة 3: طبق Migration
```powershell
node node_modules/prisma/build/index.js db push
```

### ما يجب أن تراه:
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": MySQL database "your_db" at "localhost:3306"

🚀  Your database is now in sync with your Prisma schema.

✔ Generated Prisma Client (v5.x.x) to .\node_modules\@prisma\client

Done in 3.2s
```

### ✅ نجح؟ كمل للخطوة التالية
### ❌ فشل؟ تأكد من:
- MySQL يعمل
- ملف `.env` موجود وصحيح
- `DATABASE_URL` صحيح

---

## 🎬 المشهد 3: تشغيل Backend

### الخطوة 1: في نفس Terminal
```powershell
npm run dev
```

### ما يجب أن تراه:
```
> backend@1.0.0 dev
> nodemon server.js

[nodemon] 2.0.x
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node server.js`

✓ Database connected successfully
✓ Server running on http://localhost:5000
✓ Environment: development
```

### ✅ نجح؟ Backend يعمل! اترك هذا Terminal مفتوح

---

## 🎬 المشهد 4: تشغيل Frontend

### الخطوة 1: افتح Terminal جديد
```
1. اضغط Windows + R
2. اكتب: powershell
3. اضغط Enter
```

### الخطوة 2: اذهب لمجلد Frontend
```powershell
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
```

### الخطوة 3: شغل Frontend
```powershell
npm start
```

### ما يجب أن تراه:
```
Compiled successfully!

You can now view the app in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.1.x:3000

Note that the development build is not optimized.
To create a production build, use npm run build.

webpack compiled successfully
```

### ✅ نجح؟ المتصفح سيفتح تلقائياً على `http://localhost:3000`

---

## 🎬 المشهد 5: تسجيل الدخول

### الخطوة 1: في المتصفح
```
1. يجب أن ترى صفحة تسجيل الدخول
2. أدخل:
   Email: your@email.com
   Password: ********
3. اضغط "تسجيل الدخول"
```

### ما يجب أن تراه:
```
✅ تحويل تلقائي إلى Dashboard
✅ القائمة الجانبية على اليمين
✅ اسمك في الأعلى
```

---

## 🎬 المشهد 6: الوصول لصفحة الإعدادات

### الخطوة 1: في القائمة الجانبية
```
1. ابحث عن قسم "إدارة الإعلانات" 🎯
2. يجب أن تراه بين الأقسام
3. اضغط عليه
```

### الخطوة 2: اضغط على Facebook Pixel
```
1. يجب أن ترى قائمة منسدلة:
   - Facebook Pixel & CAPI
   - الحملات الإعلانية
   - تحليلات الإعلانات
2. اضغط على "Facebook Pixel & CAPI"
```

### ما يجب أن تراه:
```
✅ صفحة كاملة مع:
   - Header كبير: "Facebook Pixel & Conversions API"
   - Info Banner أزرق
   - 3 أقسام رئيسية
   - أزرار الحفظ في الأسفل
```

---

## 🎬 المشهد 7: إدخال البيانات

### الخطوة 1: قسم Facebook Pixel
```
1. اضغط على Toggle "تفعيل Facebook Pixel"
   ✅ يجب أن يتحول للأخضر
   
2. في حقل "Pixel ID":
   اكتب: 123456789012345
   
3. فعّل جميع Checkboxes:
   ☑ PageView
   ☑ ViewContent
   ☑ AddToCart
   ☑ InitiateCheckout
   ☑ Purchase
   ☑ Search
   ☑ AddToWishlist
```

### الخطوة 2: قسم Conversions API
```
1. اضغط على Toggle "تفعيل Conversions API"
   ✅ يجب أن يتحول للأخضر
   
2. في حقل "Access Token":
   اكتب: EAA_TEST_TOKEN_12345
   
3. (اختياري) في حقل "Test Event Code":
   اكتب: TEST12345
   
4. فعّل جميع Checkboxes:
   ☑ PageView
   ☑ ViewContent
   ☑ AddToCart
   ☑ InitiateCheckout
   ☑ Purchase
   ☑ Search
```

### الخطوة 3: قسم Advanced Settings
```
1. اضغط على "الإعدادات المتقدمة" لفتح القسم
   
2. يجب أن ترى:
   ☑ Event Deduplication (مفعّل افتراضياً)
   🎯 Event Match Quality Target: 8
   ☑ GDPR Compliant (مفعّل افتراضياً)
   ☑ Hash User Data (مفعّل افتراضياً)
```

---

## 🎬 المشهد 8: حفظ الإعدادات

### الخطوة 1: اضغط زر "حفظ الإعدادات"
```
1. في أسفل الصفحة
2. زر أزرق كبير: "حفظ الإعدادات"
3. اضغط عليه
```

### ما يجب أن تراه:
```
✅ Toast notification في الأعلى:
   "✅ تم حفظ الإعدادات بنجاح"
   
✅ الزر يتحول إلى:
   "جاري الحفظ..." (لثانية واحدة)
   ثم يعود إلى "حفظ الإعدادات"
```

---

## 🎬 المشهد 9: اختبار CAPI

### الخطوة 1: اضغط زر "اختبار الاتصال"
```
1. في قسم Conversions API
2. زر أخضر: "اختبار الاتصال"
3. اضغط عليه
```

### ما يجب أن تراه:
```
✅ الزر يتحول إلى:
   "جاري الاختبار..." (مع spinner)
   
✅ بعد 2-3 ثواني:
   Toast: "✅ الاتصال ناجح! تحقق من Facebook Events Manager"
   
✅ Status يتغير إلى:
   🟢 Active
   
✅ Last Test Date يظهر:
   "آخر اختبار: منذ بضع ثوانٍ"
```

---

## 🎬 المشهد 10: فحص Console

### الخطوة 1: افتح Developer Tools
```
1. اضغط F12
2. أو Right Click → Inspect
3. اذهب إلى Tab "Console"
```

### الخطوة 2: افتح صفحة Shop
```
1. في شريط العنوان، اكتب:
   http://localhost:3000/shop
2. اضغط Enter
```

### ما يجب أن تراه في Console:
```javascript
✅ [Facebook Pixel] Initialized with ID: 123456789012345
📊 [Facebook Pixel] PageView tracked { 
  eventId: "1732205123456_abc123" 
}
```

---

## 🎬 المشهد 11: اختبار ViewContent

### الخطوة 1: اضغط على أي منتج
```
1. في صفحة Shop
2. اضغط على أي منتج
3. افحص Console
```

### ما يجب أن تراه:
```javascript
📊 [Facebook Pixel] ViewContent tracked {
  productId: "prod_123",
  eventId: "1732205123789_def456"
}
```

---

## 🎬 المشهد 12: اختبار AddToCart

### الخطوة 1: أضف منتج للسلة
```
1. في صفحة المنتج
2. اضغط "إضافة للسلة"
3. افحص Console
```

### ما يجب أن تراه:
```javascript
📊 [Facebook Pixel] AddToCart tracked {
  productId: "prod_123",
  quantity: 1,
  eventId: "1732205124000_ghi789"
}
```

---

## 🎬 المشهد 13: فحص Network

### الخطوة 1: في Developer Tools
```
1. اذهب إلى Tab "Network"
2. احفظ الإعدادات مرة أخرى
3. ابحث عن Request
```

### ما يجب أن تراه:
```
Request:
├─ Name: storefront-settings
├─ Method: PUT
├─ Status: 200 OK
├─ Type: xhr
└─ Size: ~2KB

Response:
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

## 🎬 المشهد 14: فحص Database

### الخطوة 1: افتح MySQL Workbench
```
1. افتح MySQL Workbench
2. اتصل بـ Database
3. اختر Database الخاص بك
```

### الخطوة 2: نفذ Query
```sql
SELECT 
  id,
  companyId,
  facebookPixelEnabled,
  facebookPixelId,
  facebookConvApiEnabled,
  facebookConvApiToken,
  pixelStatus,
  capiStatus
FROM storefront_settings
LIMIT 1;
```

### ما يجب أن تراه:
```
facebookPixelEnabled: 1
facebookPixelId: 123456789012345
facebookConvApiEnabled: 1
facebookConvApiToken: EAA_TEST_TOKEN_12345
pixelStatus: active
capiStatus: active
```

---

## 🎬 المشهد 15: النهاية

### 🎉 مبروك! اكتمل الاختبار بنجاح!

### ما تم اختباره:
```
✅ Database Migration
✅ Backend API
✅ Frontend UI
✅ حفظ البيانات
✅ اختبار CAPI
✅ Pixel Integration
✅ Event Tracking
✅ Console Logging
✅ Network Requests
✅ Database Storage
```

### الخطوات التالية:
```
1. استخدم Pixel ID حقيقي من Facebook
2. استخدم Access Token حقيقي
3. اختبر في Facebook Events Manager
4. ابدأ في استخدام النظام في Production
```

---

## 🎬 الخاتمة

### الوقت المستغرق: 15 دقيقة ✅
### النتيجة: نظام يعمل 100% ✅
### الحالة: جاهز للاستخدام ✅

---

**💡 نصيحة:** إذا واجهت أي مشكلة في أي مشهد، راجع:
- **MANUAL_TESTING_GUIDE.md** - للتفاصيل الكاملة
- **TEST_COMMANDS.md** - للأوامر المباشرة
- **ANSWERS_TO_YOUR_QUESTIONS.md** - للأسئلة الشائعة

**🎯 الهدف التالي:** اختبار في Facebook Events Manager مع Pixel ID حقيقي!

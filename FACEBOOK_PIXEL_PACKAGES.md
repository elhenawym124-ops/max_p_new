# 📦 المكتبات المطلوبة - Facebook Pixel & Conversions API

## Backend Dependencies

### المكتبات الأساسية (مطلوبة)
```bash
cd backend
npm install crypto  # مدمجة في Node.js - لا حاجة للتثبيت
```

### المكتبات الاختيارية (للتفعيل الكامل)
```bash
npm install facebook-nodejs-business-sdk
```

**ملاحظة:** النظام يعمل حالياً في وضع Simulation بدون الحاجة لـ `facebook-nodejs-business-sdk`. 
لتفعيل الإرسال الحقيقي لـ Facebook، قم بتثبيت المكتبة و uncomment الكود في `facebookConversionsService.js`.

---

## Frontend Dependencies

### لا توجد مكتبات إضافية مطلوبة! ✅

جميع المكتبات المستخدمة موجودة بالفعل:
- `react` ✅
- `react-hot-toast` ✅
- `@heroicons/react` ✅

---

## تفاصيل المكتبات

### facebook-nodejs-business-sdk
```json
{
  "name": "facebook-nodejs-business-sdk",
  "version": "^18.0.0",
  "description": "Official Facebook Business SDK for Node.js"
}
```

**الاستخدام:**
```javascript
const bizSdk = require('facebook-nodejs-business-sdk');

// Initialize
bizSdk.FacebookAdsApi.init(accessToken);

// Create event
const event = new bizSdk.ServerEvent()
  .setEventName('Purchase')
  .setEventTime(Math.floor(Date.now() / 1000))
  .setUserData(userData)
  .setCustomData(customData);

// Send event
const eventRequest = new bizSdk.EventRequest(accessToken, pixelId)
  .setEvents([event]);
  
const response = await eventRequest.execute();
```

---

## الكود الحالي (Simulation Mode)

### ✅ يعمل بدون المكتبة
الكود الحالي في `facebookConversionsService.js` يعمل في وضع Simulation:
- ✅ يقبل جميع البيانات
- ✅ يقوم بـ Validation
- ✅ يقوم بـ Hashing
- ✅ يسجل الأحداث في Console
- ✅ يرجع response وهمي

### 🚀 للتفعيل الكامل
1. تثبيت المكتبة:
   ```bash
   npm install facebook-nodejs-business-sdk
   ```

2. في `facebookConversionsService.js`:
   - Uncomment السطر 7: `const bizSdk = require('facebook-nodejs-business-sdk');`
   - Uncomment السطور 15-20 (Initialize SDK)
   - Uncomment الكود في `sendEvent()` method

---

## التحقق من التثبيت

### Backend
```bash
cd backend
npm list facebook-nodejs-business-sdk
```

**النتيجة المتوقعة:**
```
backend@1.0.0
└── facebook-nodejs-business-sdk@18.0.0
```

---

## الأوامر المفيدة

### تثبيت جميع المكتبات
```bash
cd backend
npm install
```

### تحديث المكتبات
```bash
npm update
```

### التحقق من الإصدارات
```bash
npm outdated
```

---

## 🔧 استكشاف الأخطاء

### ❌ "Cannot find module 'facebook-nodejs-business-sdk'"
**الحل:**
```bash
cd backend
npm install facebook-nodejs-business-sdk
```

### ❌ "Module not found: Can't resolve 'crypto'"
**الحل:** `crypto` مدمج في Node.js، لا حاجة للتثبيت. تأكد من استخدام Node.js v14+

---

## 📊 حجم المكتبات

| المكتبة | الحجم | الوصف |
|---------|-------|-------|
| facebook-nodejs-business-sdk | ~2 MB | SDK الرسمي من Facebook |
| crypto | 0 MB | مدمج في Node.js |

---

## 🎯 الخلاصة

### الحد الأدنى (يعمل الآن)
- ✅ لا حاجة لتثبيت أي شيء
- ✅ النظام يعمل في Simulation Mode
- ✅ جميع الميزات متاحة

### التفعيل الكامل (اختياري)
```bash
npm install facebook-nodejs-business-sdk
```
ثم uncomment الكود في `facebookConversionsService.js`

---

**💡 نصيحة:** ابدأ بـ Simulation Mode للتطوير والاختبار، ثم فعّل SDK الحقيقي عند الجاهزية للإنتاج.

# 🔧 إصلاح مشكلة CORS لقائمة الرغبات

**تاريخ الإصلاح:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

---

## 🐛 المشكلة

### 1. CORS Error - `x-session-id` Header
```
Access to fetch at 'http://localhost:3007/api/v1/public/wishlist?companyId=...' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
Request header field x-session-id is not allowed by Access-Control-Allow-Headers 
in preflight response.
```

**السبب:** الـ backend لا يسمح بـ `x-session-id` header في CORS configuration.

---

### 2. Footer Settings 401 Error
```
GET http://localhost:3007/api/v1/footer-settings/public/... 401 (Unauthorized)
```

**السبب:** الـ frontend يستخدم `apiClient.get` الذي يضيف authentication headers تلقائياً للـ public route.

---

## ✅ الإصلاحات المطبقة

### 1. إضافة `x-session-id` إلى CORS Headers

#### أ) في `backend/middleware/companyMiddleware.js`:
**قبل:**
```javascript
res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-cart-id, X-Company-Subdomain, X-Company-Id');
```

**بعد:**
```javascript
res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-cart-id, x-session-id, X-Company-Subdomain, X-Company-Id');
```

#### ب) في `backend/server.js`:
**قبل:**
```javascript
allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id', 'x-cart-id', 'X-Company-Subdomain', 'X-Company-Id']
```

**بعد:**
```javascript
allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id', 'x-cart-id', 'x-session-id', 'X-Company-Subdomain', 'X-Company-Id']
```

---

### 2. إصلاح Footer Settings Public Route

#### أ) إضافة Public Route في `backend/server.js`:
**قبل:**
```javascript
app.use("/api/v1/footer-settings", footerSettingsRoutes) // 🏪 إعدادات الفوتر
```

**بعد:**
```javascript
app.use("/api/v1/footer-settings", footerSettingsRoutes) // 🏪 إعدادات الفوتر (محمية)
app.use("/api/v1/public/footer-settings", addPublicCORS, footerSettingsRoutes) // 🏪 إعدادات الفوتر (عامة)
```

#### ب) استخدام `storefrontFetch` في `frontend/src/services/footerSettingsService.ts`:
**قبل:**
```typescript
async getPublicSettings(companyId: string) {
  return apiClient.get<{ data: FooterSettings }>(`/footer-settings/public/${companyId}`);
}
```

**بعد:**
```typescript
async getPublicSettings(companyId: string) {
  // Use storefrontFetch for public routes (no authentication required)
  const { storefrontFetch } = await import('../utils/storefrontApi');
  return storefrontFetch(`/footer-settings/public/${companyId}`);
}
```

---

## 📝 ملاحظات

### لماذا `x-session-id`؟
- يستخدم في قائمة الرغبات (Wishlist) للعملاء غير المسجلين
- يستخدم في Recently Viewed للعملاء غير المسجلين
- يستخدم في Back in Stock Notifications

### لماذا `storefrontFetch` بدلاً من `apiClient`؟
- `apiClient` يضيف authentication headers تلقائياً
- `storefrontFetch` مصمم خصيصاً للـ public routes
- `storefrontFetch` يدعم `x-session-id` header

---

## ✅ النتيجة

- ✅ قائمة الرغبات تعمل الآن بدون CORS errors
- ✅ Footer Settings تعمل الآن بدون 401 errors
- ✅ جميع الـ public routes تدعم `x-session-id` header

---

## 🎯 الخلاصة

تم إصلاح المشكلتين:
1. ✅ إضافة `x-session-id` إلى CORS allowed headers
2. ✅ إصلاح Footer Settings public route

الآن قائمة الرغبات و Footer Settings تعملان بشكل صحيح! 🎉



# 💻 أوامر الاختبار - نسخ ولصق مباشر

## 🚀 الأوامر الأساسية

### 1. تطبيق Migration
```powershell
# افتح PowerShell في مجلد backend
cd C:\Users\38asfasf\Downloads\max_p_new\backend

# الطريقة 1 (إذا كان npx يعمل)
npx prisma db push

# الطريقة 2 (إذا كانت الطريقة 1 لا تعمل)
node node_modules/prisma/build/index.js db push

# الطريقة 3 (باستخدام npm)
npm run prisma:push
```

---

### 2. تشغيل Backend
```powershell
cd C:\Users\38asfasf\Downloads\max_p_new\backend
npm run dev
```

**يجب أن ترى:**
```
✓ Server running on http://localhost:5000
✓ Database connected successfully
```

---

### 3. تشغيل Frontend (في terminal جديد)
```powershell
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm start
```

**يجب أن ترى:**
```
✓ Compiled successfully!
✓ You can now view the app in the browser.
✓ Local: http://localhost:3000
```

---

## 🧪 اختبار API باستخدام PowerShell

### 1. اختبار GET Settings
```powershell
# احصل على Token أولاً من localStorage بعد تسجيل الدخول
$token = "YOUR_TOKEN_HERE"

# اختبار GET
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/storefront-settings" `
  -Method GET `
  -Headers @{"Authorization"="Bearer $token"}
```

---

### 2. اختبار UPDATE Settings
```powershell
$token = "YOUR_TOKEN_HERE"
$body = @{
  facebookPixelEnabled = $true
  facebookPixelId = "123456789012345"
  facebookConvApiEnabled = $true
  facebookConvApiToken = "EAAxxxxxxxxxx"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/v1/storefront-settings" `
  -Method PUT `
  -Headers @{
    "Authorization"="Bearer $token"
    "Content-Type"="application/json"
  } `
  -Body $body
```

---

### 3. اختبار Test CAPI
```powershell
$token = "YOUR_TOKEN_HERE"

Invoke-RestMethod -Uri "http://localhost:5000/api/v1/storefront-settings/test-facebook-capi" `
  -Method POST `
  -Headers @{"Authorization"="Bearer $token"}
```

---

### 4. اختبار Validate Pixel ID
```powershell
$token = "YOUR_TOKEN_HERE"
$body = @{
  pixelId = "123456789012345"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/v1/storefront-settings/validate-pixel-id" `
  -Method POST `
  -Headers @{
    "Authorization"="Bearer $token"
    "Content-Type"="application/json"
  } `
  -Body $body
```

---

## 🔍 اختبار Database

### فحص الجدول
```sql
-- افتح MySQL Workbench أو أي DB client
USE your_database_name;

-- فحص الحقول الجديدة
DESCRIBE storefront_settings;

-- فحص البيانات
SELECT 
  id,
  companyId,
  facebookPixelEnabled,
  facebookPixelId,
  facebookConvApiEnabled,
  facebookConvApiToken,
  pixelStatus,
  capiStatus,
  lastPixelTest,
  lastCapiTest
FROM storefront_settings
WHERE companyId = 'YOUR_COMPANY_ID';
```

---

## 🌐 اختبار في المتصفح

### 1. فتح Console
```
1. افتح Chrome/Edge
2. اضغط F12
3. اذهب إلى Console tab
4. افتح: http://localhost:3000/shop
```

### 2. فحص Pixel
```javascript
// في Console، اكتب:
window.fbq

// يجب أن ترى:
// ƒ fbq() { ... }

// فحص Pixel ID
console.log('Pixel ID:', window._fbq?.getState?.()?.pixels?.[0]?.id);
```

### 3. تتبع حدث يدوياً
```javascript
// في Console، اكتب:
fbq('track', 'PageView');

// يجب أن ترى في Network tab:
// Request to: facebook.com/tr?id=123456789012345&ev=PageView
```

---

## 📊 اختبار في Facebook Events Manager

### 1. الوصول
```
1. افتح: https://business.facebook.com/events_manager2
2. اختر Pixel الخاص بك
3. اذهب إلى "Test Events"
```

### 2. إضافة Test Event Code
```
1. في Facebook → Test Events → Generate Test Event Code
2. انسخ الكود (مثال: TEST12345)
3. في موقعك → صفحة الإعدادات → Test Event Code
4. الصق الكود واحفظ
```

### 3. اختبار الأحداث
```
1. في موقعك، افتح: http://localhost:3000/shop
2. في Facebook Events Manager → Test Events
3. يجب أن ترى الأحداث تظهر فوراً
```

---

## 🔧 أوامر استكشاف الأخطاء

### مسح Cache
```powershell
# مسح npm cache
npm cache clean --force

# مسح node_modules وإعادة التثبيت
cd backend
Remove-Item -Recurse -Force node_modules
npm install

cd ..\frontend
Remove-Item -Recurse -Force node_modules
npm install
```

### إعادة تشغيل Prisma
```powershell
cd backend

# إعادة توليد Prisma Client
npx prisma generate

# إعادة تطبيق Schema
npx prisma db push --force-reset
```

### فحص Logs
```powershell
# Backend logs
cd backend
npm run dev 2>&1 | Tee-Object -FilePath backend.log

# Frontend logs
cd frontend
npm start 2>&1 | Tee-Object -FilePath frontend.log
```

---

## 📝 أوامر مفيدة إضافية

### فحص Ports
```powershell
# فحص Port 5000 (Backend)
netstat -ano | findstr :5000

# فحص Port 3000 (Frontend)
netstat -ano | findstr :3000
```

### إيقاف Process
```powershell
# إيقاف Backend (إذا كان معلق)
Get-Process -Name node | Where-Object {$_.Path -like "*backend*"} | Stop-Process -Force

# إيقاف Frontend
Get-Process -Name node | Where-Object {$_.Path -like "*frontend*"} | Stop-Process -Force
```

### فحص Node Version
```powershell
node --version
npm --version
```

---

## 🎯 سيناريو الاختبار الكامل

### نسخ ولصق هذا السيناريو:
```powershell
# 1. تطبيق Migration
cd C:\Users\38asfasf\Downloads\max_p_new\backend
node node_modules/prisma/build/index.js db push

# 2. تشغيل Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\38asfasf\Downloads\max_p_new\backend; npm run dev"

# 3. انتظر 5 ثواني
Start-Sleep -Seconds 5

# 4. تشغيل Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\38asfasf\Downloads\max_p_new\frontend; npm start"

# 5. انتظر 10 ثواني
Start-Sleep -Seconds 10

# 6. فتح المتصفح
Start-Process "http://localhost:3000"
```

---

## ✅ Checklist سريع

```
□ Backend يعمل على Port 5000
□ Frontend يعمل على Port 3000
□ Database متصلة
□ Migration مطبقة
□ يمكن تسجيل الدخول
□ صفحة الإعدادات تفتح
□ يمكن حفظ البيانات
□ Pixel يظهر في Console
□ API Endpoints تعمل
```

---

**💡 نصيحة:** احفظ هذا الملف واستخدمه كمرجع سريع عند الاختبار!

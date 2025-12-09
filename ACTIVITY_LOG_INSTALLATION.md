# 🔧 دليل التثبيت والإصلاح - نظام سجل النشاطات

## 📦 الـ Packages المطلوبة

---

## Backend Dependencies

### 1. ua-parser-js
**الاستخدام:** تحليل معلومات المتصفح ونظام التشغيل من User-Agent

**التثبيت:**
```bash
cd backend
npm install ua-parser-js
```

**أو:**
```bash
cd backend
yarn add ua-parser-js
```

---

## Frontend Dependencies

### 1. date-fns
**الاستخدام:** تنسيق وعرض التواريخ بالعربية

**التثبيت:**
```bash
cd frontend
npm install date-fns
```

### 2. recharts
**الاستخدام:** الرسوم البيانية في صفحة Company Activity

**التثبيت:**
```bash
cd frontend
npm install recharts
```

**أو تثبيت الاثنين معاً:**
```bash
cd frontend
npm install date-fns recharts
```

---

## ⚡ التثبيت السريع

### خطوة واحدة للـ Backend:
```bash
cd backend && npm install ua-parser-js
```

### خطوة واحدة للـ Frontend:
```bash
cd frontend && npm install date-fns recharts
```

---

## 🔍 التحقق من التثبيت

### Backend:
```bash
cd backend
npm list ua-parser-js
```

**النتيجة المتوقعة:**
```
backend@1.0.0 c:\Users\38asfasf\Downloads\max_p_new\backend
└── ua-parser-js@1.0.37
```

### Frontend:
```bash
cd frontend
npm list date-fns recharts
```

**النتيجة المتوقعة:**
```
frontend@0.1.0 c:\Users\38asfasf\Downloads\max_p_new\frontend
├── date-fns@2.30.0
└── recharts@2.10.3
```

---

## 🛠️ حل مشكلة PowerShell Execution Policy

إذا واجهت خطأ:
```
running scripts is disabled on this system
```

**الحل:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 🔄 البديل البسيط (بدون ua-parser-js)

إذا أردت تجنب تثبيت `ua-parser-js`، يمكنك استبدال الكود في `activityLogger.js`:

### استبدل هذا:
```javascript
const UAParser = require('ua-parser-js');

// في دالة extractDeviceInfo:
const parser = new UAParser(req.headers['user-agent']);
const deviceInfo = parser.getResult();
```

### بهذا:
```javascript
// دالة بسيطة لتحليل User-Agent
function parseUserAgent(userAgent = '') {
  return {
    browser: {
      name: userAgent.includes('Chrome') ? 'Chrome' : 
            userAgent.includes('Firefox') ? 'Firefox' : 
            userAgent.includes('Safari') ? 'Safari' : 
            userAgent.includes('Edge') ? 'Edge' : 'Unknown',
      version: 'N/A'
    },
    os: {
      name: userAgent.includes('Windows') ? 'Windows' : 
            userAgent.includes('Mac') ? 'macOS' : 
            userAgent.includes('Linux') ? 'Linux' : 
            userAgent.includes('Android') ? 'Android' : 
            userAgent.includes('iOS') ? 'iOS' : 'Unknown',
      version: 'N/A'
    },
    device: {
      type: userAgent.includes('Mobile') ? 'mobile' : 
            userAgent.includes('Tablet') ? 'tablet' : 'desktop'
    }
  };
}

// في دالة extractDeviceInfo:
const deviceInfo = parseUserAgent(req.headers['user-agent']);
```

---

## 📝 تحديث package.json يدوياً

### Backend (backend/package.json):
```json
{
  "name": "backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "ua-parser-js": "^1.0.37"
  }
}
```

### Frontend (frontend/package.json):
```json
{
  "name": "frontend",
  "version": "0.1.0",
  "dependencies": {
    "react": "^18.2.0",
    "@mui/material": "^5.14.0",
    "date-fns": "^2.30.0",
    "recharts": "^2.10.3",
    "axios": "^1.4.0"
  }
}
```

ثم:
```bash
npm install
```

---

## 🚀 تشغيل النظام

### 1. تشغيل Backend:
```bash
cd backend
npm start
```

**أو:**
```bash
cd backend
node server.js
```

### 2. تشغيل Frontend:
```bash
cd frontend
npm start
```

---

## ✅ اختبار النظام

### 1. اختبار Backend API:

**الحصول على نشاطاتي:**
```bash
GET http://localhost:3001/api/v1/activity/my-activities
Headers: Authorization: Bearer YOUR_TOKEN
```

**الحصول على إحصائياتي:**
```bash
GET http://localhost:3001/api/v1/activity/my-stats
Headers: Authorization: Bearer YOUR_TOKEN
```

### 2. اختبار Frontend:

افتح المتصفح وانتقل إلى:
- `http://localhost:3000/my-activity` - نشاطاتي
- `http://localhost:3000/company/activity` - نشاطات الشركة (للمديرين)

---

## 🐛 حل المشاكل الشائعة

### المشكلة 1: Module not found 'ua-parser-js'
**الحل:**
```bash
cd backend
npm install ua-parser-js
```

### المشكلة 2: Module not found 'date-fns'
**الحل:**
```bash
cd frontend
npm install date-fns
```

### المشكلة 3: Module not found 'recharts'
**الحل:**
```bash
cd frontend
npm install recharts
```

### المشكلة 4: Cannot find module '../models/ActivityLog'
**الحل:** تأكد من وجود الملف:
```
backend/models/ActivityLog.js
```

### المشكلة 5: API returns 404
**الحل:** تأكد من إضافة Routes في `server.js`:
```javascript
const activityLogRoutes = require('./routes/activityLogRoutes');
app.use('/api/v1/activity', activityLogRoutes);
```

### المشكلة 6: Unauthorized (401)
**الحل:** تأكد من:
1. تسجيل الدخول أولاً
2. إرسال Token في Header:
```javascript
Authorization: Bearer YOUR_TOKEN
```

---

## 📊 التحقق من عمل النظام

### 1. فحص Backend:
```bash
# في terminal Backend
# يجب أن ترى:
✓ MongoDB Connected
✓ Server running on port 3001
✓ Activity Log Routes mounted on /api/v1/activity
```

### 2. فحص Frontend:
```bash
# في terminal Frontend
# يجب أن ترى:
✓ Compiled successfully!
✓ webpack compiled successfully
```

### 3. فحص Database:
```bash
# اتصل بـ MongoDB
mongo

# استخدم قاعدة البيانات
use your_database_name

# تحقق من وجود Collection
db.activitylogs.find().limit(1)
```

---

## 📚 الملفات المطلوبة

تأكد من وجود جميع الملفات:

### Backend:
- ✅ `models/ActivityLog.js`
- ✅ `middleware/activityLogger.js`
- ✅ `controllers/activityLogController.js`
- ✅ `routes/activityLogRoutes.js`
- ✅ `server.js` (محدّث)

### Frontend:
- ✅ `pages/MyActivity.jsx`
- ✅ `pages/CompanyActivity.jsx`
- ✅ `App.tsx` (محدّث)
- ✅ `components/layout/Layout.tsx` (محدّث)

---

## 🎯 الخطوات النهائية

1. **تثبيت الـ Packages:**
   ```bash
   cd backend && npm install ua-parser-js
   cd ../frontend && npm install date-fns recharts
   ```

2. **تشغيل Backend:**
   ```bash
   cd backend
   npm start
   ```

3. **تشغيل Frontend:**
   ```bash
   cd frontend
   npm start
   ```

4. **اختبار النظام:**
   - سجل دخول
   - انتقل إلى `/my-activity`
   - تحقق من ظهور النشاطات

---

## ✨ النظام جاهز!

بعد اتباع هذه الخطوات، يجب أن يعمل نظام سجل النشاطات بشكل كامل! 🎉

---

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من console في المتصفح (F12)
2. تحقق من terminal الـ Backend
3. تحقق من terminal الـ Frontend
4. راجع ملف `ACTIVITY_LOG_USAGE.md` للتفاصيل

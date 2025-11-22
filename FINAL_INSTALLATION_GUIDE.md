# 🚀 دليل التثبيت النهائي - Page Builder

## ✅ المتطلبات

- Node.js >= 18.0.0
- npm >= 9.0.0
- MySQL Database
- React 18+
- TypeScript

---

## 📦 الخطوة 1: تثبيت المكتبات

### Frontend
```bash
cd frontend
npm install @craftjs/core react-color
```

### التحقق من التثبيت
```bash
npm list @craftjs/core react-color
```

يجب أن ترى:
```
├── @craftjs/core@0.2.0-beta.12
└── react-color@2.19.3
```

---

## 🗄️ الخطوة 2: إعداد Database

### طريقة 1: استخدام Prisma (موصى بها)

```bash
cd backend

# إضافة Model للـ schema.prisma
```

أضف هذا الكود في `backend/prisma/schema.prisma`:

```prisma
model LandingPage {
  id              String   @id @default(cuid())
  companyId       String
  productId       String?
  title           String   @db.VarChar(255)
  slug            String   @unique @db.VarChar(255)
  content         Json
  isPublished     Boolean  @default(false)
  views           Int      @default(0)
  conversions     Int      @default(0)
  metaTitle       String?  @db.VarChar(255)
  metaDescription String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  product Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([companyId])
  @@index([productId])
  @@index([slug])
  @@index([isPublished])
  @@map("landing_pages")
}
```

ثم شغّل Migration:
```bash
npx prisma migrate dev --name add_landing_pages
npx prisma generate
```

### طريقة 2: استخدام SQL مباشرة

```bash
mysql -u root -p your_database < backend/prisma/migrations/add_landing_pages.sql
```

---

## 🔌 الخطوة 3: إضافة Backend Routes

### في `backend/server.js` أو `backend/app.js`

أضف هذا السطر:

```javascript
const landingPageRoutes = require('./routes/landingPageRoutes');

// بعد السطور الموجودة
app.use('/api/v1/landing-pages', landingPageRoutes);
```

### مثال كامل:

```javascript
const express = require('express');
const app = express();

// ... Middleware الموجود

// Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const landingPageRoutes = require('./routes/landingPageRoutes'); // ✅ جديد

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/landing-pages', landingPageRoutes); // ✅ جديد

// ... باقي الكود
```

---

## 🎨 الخطوة 4: إضافة Frontend Routes

### في `frontend/src/App.tsx`

أضف الـ imports:

```typescript
import PageBuilder from './pages/PageBuilder';
import LandingPageList from './pages/LandingPageList';
```

أضف الـ Routes:

```typescript
<Routes>
  {/* ... Routes الموجودة */}
  
  {/* ✅ Routes جديدة */}
  <Route path="/page-builder" element={<PageBuilder />} />
  <Route path="/landing-pages" element={<LandingPageList />} />
</Routes>
```

### مثال كامل:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PageBuilder from './pages/PageBuilder';
import LandingPageList from './pages/LandingPageList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        
        {/* ✅ Page Builder Routes */}
        <Route path="/page-builder" element={<PageBuilder />} />
        <Route path="/landing-pages" element={<LandingPageList />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 🔐 الخطوة 5: إعداد Authentication (اختياري)

إذا كنت تستخدم Authentication، تأكد من:

### في `backend/middleware/auth.js`:

```javascript
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticateToken };
```

### في `frontend/src/services/landingPageService.ts`:

تأكد من إضافة Token للـ Headers:

```typescript
import axios from 'axios';

// إعداد Axios
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## ⚙️ الخطوة 6: إعداد Environment Variables

### Backend `.env`:

```env
DATABASE_URL="mysql://user:password@localhost:3306/database"
JWT_SECRET="your-secret-key"
PORT=5000
```

### Frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

## 🚀 الخطوة 7: تشغيل المشروع

### Terminal 1 - Backend:
```bash
cd backend
npm start
```

يجب أن ترى:
```
✅ Server running on port 5000
✅ Database connected
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

يجب أن ترى:
```
✅ VITE v4.x.x ready in xxx ms
✅ Local: http://localhost:3000
```

---

## 🧪 الخطوة 8: اختبار التثبيت

### 1. افتح المتصفح:
```
http://localhost:3000/page-builder
```

### 2. يجب أن ترى:
- ✅ Toolbox على اليسار
- ✅ Canvas في الوسط
- ✅ Settings Panel على اليمين
- ✅ Topbar في الأعلى

### 3. اختبر Drag & Drop:
- اسحب مكون "نص" من Toolbox
- أفلته في Canvas
- انقر عليه
- عدّل الإعدادات من Settings Panel

### 4. اختبر الحفظ:
- اضغط زر "💾 حفظ"
- يجب أن ترى رسالة "تم الحفظ بنجاح"

---

## 🔍 حل المشاكل الشائعة

### المشكلة 1: أخطاء TypeScript

**الحل:**
```bash
cd frontend
npm install @craftjs/core react-color
```

### المشكلة 2: Database Connection Error

**الحل:**
- تأكد من تشغيل MySQL
- تحقق من `DATABASE_URL` في `.env`
- شغّل Migration مرة أخرى

### المشكلة 3: CORS Error

**الحل:** أضف في `backend/server.js`:
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

### المشكلة 4: 401 Unauthorized

**الحل:**
- تأكد من تسجيل الدخول
- تحقق من Token في localStorage
- تأكد من Authentication Middleware

### المشكلة 5: المكونات لا تظهر

**الحل:**
- تأكد من إضافة المكونات للـ `resolver`
- تحقق من Console للأخطاء
- أعد تحميل الصفحة

---

## ✅ Checklist النهائي

قبل البدء، تأكد من:

- [ ] تثبيت `@craftjs/core` و `react-color`
- [ ] تشغيل Migration للـ Database
- [ ] إضافة Routes في Backend
- [ ] إضافة Routes في Frontend
- [ ] إعداد Environment Variables
- [ ] تشغيل Backend (Port 5000)
- [ ] تشغيل Frontend (Port 3000)
- [ ] فتح `http://localhost:3000/page-builder`
- [ ] اختبار Drag & Drop
- [ ] اختبار الحفظ

---

## 🎉 تم!

إذا اجتزت جميع الخطوات، فأنت الآن جاهز لاستخدام Page Builder! 🚀

### الخطوات التالية:

1. **إنشاء أول صفحة:**
   - افتح `/page-builder`
   - اسحب المكونات
   - صمم صفحتك
   - احفظها

2. **ربط بمنتج:**
   - افتح `/landing-pages`
   - اختر صفحة
   - اربطها بمنتج

3. **نشر للعملاء:**
   - اضغط زر "نشر"
   - شارك الرابط: `/public/your-slug`

---

## 📚 للمزيد من المساعدة

- **دليل شامل:** `PAGE_BUILDER_GUIDE.md`
- **بداية سريعة:** `QUICK_START_PAGE_BUILDER.md`
- **ملخص التنفيذ:** `IMPLEMENTATION_SUMMARY.md`

---

## 💡 نصيحة أخيرة

إذا واجهت أي مشكلة:
1. تحقق من Console (F12)
2. تحقق من Network Tab
3. تحقق من Backend Logs
4. راجع الخطوات أعلاه

**حظاً موفقاً! 🎨✨**

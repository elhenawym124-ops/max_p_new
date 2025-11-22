# ⚡ Quick Start - Page Builder

## 🚀 التثبيت السريع (5 دقائق)

### 1. تثبيت المكتبات

```bash
cd frontend
npm install @craftjs/core react-color
```

### 2. إضافة Route

افتح `frontend/src/App.tsx` وأضف:

```typescript
import PageBuilder from './pages/PageBuilder';

// في Routes
<Route path="/page-builder" element={<PageBuilder />} />
```

### 3. تشغيل

```bash
npm run dev
```

### 4. افتح المحرر

```
http://localhost:3000/page-builder
```

---

## 🎯 الاستخدام السريع

### إضافة مكون
1. اختر من Toolbox (يسار)
2. اسحب وأفلت في الصفحة

### تعديل مكون
1. انقر على المكون
2. عدّل من Settings Panel (يمين)

### حفظ
- اضغط "💾 حفظ"

---

## 📦 المكونات المتوفرة

### أساسي
- 📝 نص
- 🔘 زر
- 🖼️ صورة
- 📦 حاوية

### متجر
- 🛍️ بطاقة منتج
- ⏰ عداد تنازلي

---

## 🔧 Backend Setup (اختياري)

### 1. أضف للـ schema.prisma

```prisma
model LandingPage {
  id          String   @id @default(cuid())
  companyId   String
  title       String
  slug        String   @unique
  content     Json
  isPublished Boolean  @default(false)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  company Company @relation(...)
  
  @@map("landing_pages")
}
```

### 2. Run Migration

```bash
cd backend
npx prisma migrate dev --name add_landing_pages
```

### 3. أنشئ Controller

انسخ الكود من `PAGE_BUILDER_GUIDE.md` قسم "Backend Controller"

### 4. أضف Routes

```javascript
// في backend/routes/api.js
const landingPageController = require('../controller/landingPageController');

router.post('/landing-pages', auth, landingPageController.createLandingPage);
router.get('/landing-pages', auth, landingPageController.getAllLandingPages);
```

---

## ✅ تم!

الآن لديك Page Builder كامل جاهز للاستخدام! 🎉

**للمزيد من التفاصيل:** اقرأ `PAGE_BUILDER_GUIDE.md`

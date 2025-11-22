# 🎨 دليل Page Builder - محرر الصفحات الاحترافي

## 📋 نظرة عامة

تم بناء Page Builder كامل بنظام **Elementor-Style** باستخدام **Craft.js** مع:
- ✅ Drag & Drop كامل
- ✅ Toolbox بتصنيفات (أساسي، متجر)
- ✅ Settings Panel متقدم
- ✅ Undo/Redo
- ✅ حفظ وتصدير
- ✅ مكونات جاهزة للمنتجات

---

## 🚀 خطوات التثبيت

### 1. تثبيت المكتبات المطلوبة

```bash
cd frontend
npm install @craftjs/core react-color
```

### 2. إضافة Route للمحرر

افتح ملف `frontend/src/App.tsx` وأضف:

```typescript
import PageBuilder from './pages/PageBuilder';

// داخل Routes
<Route path="/page-builder" element={<PageBuilder />} />
```

### 3. تشغيل المشروع

```bash
npm run dev
```

### 4. فتح المحرر

افتح المتصفح على: `http://localhost:3000/page-builder`

---

## 📁 البنية الأساسية

```
frontend/src/
├── components/
│   └── page-builder/
│       ├── user/                    # المكونات القابلة للسحب
│       │   ├── Text.tsx
│       │   ├── TextSettings.tsx
│       │   ├── Button.tsx
│       │   ├── ButtonSettings.tsx
│       │   ├── Container.tsx
│       │   ├── ContainerSettings.tsx
│       │   ├── Image.tsx
│       │   ├── ImageSettings.tsx
│       │   ├── ProductCard.tsx
│       │   ├── ProductCardSettings.tsx
│       │   ├── CountdownTimer.tsx
│       │   ├── CountdownTimerSettings.tsx
│       │   └── index.ts
│       │
│       └── editor/                  # مكونات المحرر
│           ├── Toolbox.tsx          # صندوق الأدوات
│           ├── SettingsPanel.tsx    # لوحة الإعدادات
│           ├── Topbar.tsx           # شريط الأدوات العلوي
│           └── index.ts
│
└── pages/
    └── PageBuilder.tsx              # الصفحة الرئيسية للمحرر
```

---

## 🧩 المكونات المتوفرة

### **1. المكونات الأساسية**

#### 📝 Text (نص)
- تحرير النص مباشرة
- حجم الخط (12-72px)
- سُمك الخط
- اللون
- المحاذاة (يمين، وسط، يسار)
- المسافة الخارجية

#### 🔘 Button (زر)
- نص الزر
- الرابط
- لون الخلفية
- لون النص
- حجم الخط
- المسافة الداخلية
- استدارة الحواف
- عرض كامل

#### 📦 Container (حاوية)
- منطقة قابلة للإسقاط
- لون الخلفية
- المسافة الداخلية
- المسافة الخارجية
- استدارة الحواف

#### 🖼️ Image (صورة)
- رابط الصورة
- النص البديل
- العرض (10-100%)
- الارتفاع (تلقائي أو مخصص)
- استدارة الحواف
- طريقة العرض (Cover, Contain, Fill)

---

### **2. مكونات المتجر**

#### 🛍️ ProductCard (بطاقة منتج)
- صورة المنتج
- اسم المنتج
- السعر
- الخصم (0-90%)
- لون الخلفية
- استدارة الحواف
- زر "أضف للسلة"

#### ⏰ CountdownTimer (عداد تنازلي)
- العنوان
- تاريخ الانتهاء
- لون الخلفية
- لون النص
- عرض (أيام، ساعات، دقائق، ثواني)

---

## 🎯 كيفية الاستخدام

### **1. إضافة مكونات**

1. اختر تصنيف من Toolbox (أساسي أو متجر)
2. اسحب المكون المطلوب
3. أفلته في الصفحة

### **2. تعديل المكونات**

1. انقر على المكون في الصفحة
2. ستظهر إعداداته في Settings Panel على اليمين
3. عدّل الخصائص كما تريد

### **3. ترتيب المكونات**

- اسحب المكون لتغيير موضعه
- يمكنك وضع مكونات داخل Container

### **4. التراجع والإعادة**

- زر "تراجع" (↶) للتراجع عن آخر تغيير
- زر "إعادة" (↷) لإعادة التغيير

### **5. الحفظ**

- زر "💾 حفظ" لحفظ الصفحة
- زر "📥 تصدير" لتنزيل JSON

### **6. المعاينة**

- زر "وضع المعاينة" لرؤية الصفحة بدون أدوات التحرير

---

## 💾 الحفظ والتحميل

### **حفظ الصفحة**

```typescript
const handleSave = (json: string) => {
  // إرسال للـ Backend
  fetch('/api/v1/landing-pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'صفحة المنتج',
      content: json
    })
  });
};
```

### **تحميل صفحة محفوظة**

```typescript
import { Editor, Frame } from '@craftjs/core';

const savedJson = /* جلب من Backend */;

<Editor resolver={...}>
  <Frame json={savedJson}>
    {/* الصفحة ستُحمل تلقائياً */}
  </Frame>
</Editor>
```

---

## 🔌 Backend Integration

### **1. Database Schema**

أضف هذا للـ `schema.prisma`:

```prisma
model LandingPage {
  id          String   @id @default(cuid())
  productId   String?  // ربط بمنتج (اختياري)
  companyId   String
  title       String
  slug        String   @unique
  content     Json     // محتوى الصفحة (JSON من Builder)
  isPublished Boolean  @default(false)
  views       Int      @default(0)
  conversions Int      @default(0)
  
  // SEO
  metaTitle       String?
  metaDescription String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  product Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  
  @@index([companyId])
  @@index([productId])
  @@index([slug])
  @@map("landing_pages")
}
```

### **2. Backend Controller**

أنشئ `backend/controller/landingPageController.js`:

```javascript
const { getSharedPrismaClient } = require('../services/sharedDatabase');

function getPrisma() {
  return getSharedPrismaClient();
}

// إنشاء صفحة جديدة
exports.createLandingPage = async (req, res) => {
  try {
    const { title, slug, content, productId, metaTitle, metaDescription } = req.body;
    const companyId = req.user.companyId;

    const landingPage = await getPrisma().landingPage.create({
      data: {
        companyId,
        productId,
        title,
        slug,
        content,
        metaTitle,
        metaDescription
      }
    });

    res.json(landingPage);
  } catch (error) {
    console.error('Error creating landing page:', error);
    res.status(500).json({ error: 'Failed to create landing page' });
  }
};

// جلب جميع الصفحات
exports.getAllLandingPages = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const pages = await getPrisma().landingPage.findMany({
      where: { companyId },
      include: {
        product: {
          select: { id: true, name: true, image: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(pages);
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    res.status(500).json({ error: 'Failed to fetch landing pages' });
  }
};

// جلب صفحة واحدة
exports.getLandingPage = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    const page = await getPrisma().landingPage.findFirst({
      where: { id, companyId },
      include: {
        product: true
      }
    });

    if (!page) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    res.json(page);
  } catch (error) {
    console.error('Error fetching landing page:', error);
    res.status(500).json({ error: 'Failed to fetch landing page' });
  }
};

// تحديث صفحة
exports.updateLandingPage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, productId, metaTitle, metaDescription, isPublished } = req.body;
    const companyId = req.user.companyId;

    const page = await getPrisma().landingPage.updateMany({
      where: { id, companyId },
      data: {
        title,
        slug,
        content,
        productId,
        metaTitle,
        metaDescription,
        isPublished
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating landing page:', error);
    res.status(500).json({ error: 'Failed to update landing page' });
  }
};

// حذف صفحة
exports.deleteLandingPage = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    await getPrisma().landingPage.deleteMany({
      where: { id, companyId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting landing page:', error);
    res.status(500).json({ error: 'Failed to delete landing page' });
  }
};

// جلب صفحة عامة (للعرض للعملاء)
exports.getPublicLandingPage = async (req, res) => {
  try {
    const { slug } = req.params;

    const page = await getPrisma().landingPage.findFirst({
      where: { slug, isPublished: true },
      include: {
        product: true,
        company: {
          select: { name: true, logo: true }
        }
      }
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // زيادة عدد المشاهدات
    await getPrisma().landingPage.update({
      where: { id: page.id },
      data: { views: { increment: 1 } }
    });

    res.json(page);
  } catch (error) {
    console.error('Error fetching public landing page:', error);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
};
```

### **3. Routes**

أضف للـ `backend/routes/api.js`:

```javascript
const landingPageController = require('../controller/landingPageController');

// Landing Pages
router.post('/landing-pages', auth, landingPageController.createLandingPage);
router.get('/landing-pages', auth, landingPageController.getAllLandingPages);
router.get('/landing-pages/:id', auth, landingPageController.getLandingPage);
router.put('/landing-pages/:id', auth, landingPageController.updateLandingPage);
router.delete('/landing-pages/:id', auth, landingPageController.deleteLandingPage);

// Public route
router.get('/public/landing-pages/:slug', landingPageController.getPublicLandingPage);
```

---

## 🎨 إضافة مكونات جديدة

### **مثال: إضافة مكون Testimonial**

#### 1. إنشاء المكون

```typescript
// frontend/src/components/page-builder/user/Testimonial.tsx
import React from 'react';
import { useNode } from '@craftjs/core';

export interface TestimonialProps {
  name?: string;
  role?: string;
  text?: string;
  avatar?: string;
  rating?: number;
}

export const Testimonial: React.FC<TestimonialProps> = ({
  name = 'أحمد محمد',
  role = 'عميل سعيد',
  text = 'منتج رائع! أنصح به بشدة',
  avatar = 'https://via.placeholder.com/80',
  rating = 5
}) => {
  const {
    connectors: { connect, drag },
    selected
  } = useNode((state: any) => ({
    selected: state.events.selected
  }));

  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        padding: '10px',
        border: selected ? '2px solid #4F46E5' : '2px solid transparent',
        cursor: 'move'
      }}
    >
      <div style={{
        background: '#f9fafb',
        padding: '30px',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <img 
          src={avatar} 
          alt={name}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            marginBottom: '15px'
          }}
        />
        <div style={{ color: '#F59E0B', marginBottom: '10px' }}>
          {'⭐'.repeat(rating)}
        </div>
        <p style={{ fontSize: '16px', marginBottom: '15px' }}>"{text}"</p>
        <h4 style={{ margin: '0 0 5px', fontSize: '18px' }}>{name}</h4>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{role}</p>
      </div>
    </div>
  );
};

Testimonial.craft = {
  displayName: 'تقييم عميل',
  props: {
    name: 'أحمد محمد',
    role: 'عميل سعيد',
    text: 'منتج رائع! أنصح به بشدة',
    avatar: 'https://via.placeholder.com/80',
    rating: 5
  },
  related: {
    settings: 'TestimonialSettings'
  }
};
```

#### 2. إضافة للـ Toolbox

```typescript
// في Toolbox.tsx
import { Testimonial } from '../user';

const widgets = {
  // ...
  advanced: [
    {
      name: 'تقييم عميل',
      icon: '⭐',
      component: <Testimonial />,
      description: 'آراء العملاء'
    }
  ]
};
```

#### 3. إضافة للـ Resolver

```typescript
// في PageBuilder.tsx
import { Testimonial, TestimonialSettings } from '../components/page-builder/user';

<Editor
  resolver={{
    // ...
    Testimonial,
    TestimonialSettings
  }}
>
```

---

## 🎯 نصائح وأفضل الممارسات

### **1. الأداء**
- استخدم `React.memo` للمكونات الثقيلة
- تجنب الـ re-renders غير الضرورية
- استخدم `useMemo` و `useCallback`

### **2. UX**
- أضف animations للـ drag & drop
- استخدم loading states
- أضف tooltips للأزرار

### **3. الأمان**
- تحقق من صلاحيات المستخدم في Backend
- نظف HTML قبل الحفظ
- استخدم CSRF tokens

### **4. SEO**
- أضف meta tags للصفحات
- استخدم semantic HTML
- أضف structured data

---

## 🐛 حل المشاكل الشائعة

### **المشكلة: الأخطاء في TypeScript**

```bash
# حل: تثبيت المكتبات
npm install @craftjs/core react-color
```

### **المشكلة: المكونات لا تظهر**

تأكد من:
1. إضافة المكون للـ `resolver`
2. إضافة المكون للـ `Toolbox`
3. تصدير المكون من `index.ts`

### **المشكلة: الحفظ لا يعمل**

تأكد من:
1. Backend API يعمل
2. Authentication صحيح
3. Database Schema محدث

---

## 📚 موارد إضافية

- **Craft.js Docs:** https://craft.js.org/docs
- **GitHub:** https://github.com/prevwong/craft.js
- **Examples:** https://codesandbox.io/examples/package/@craftjs/core

---

## ✅ الخلاصة

تم إنشاء Page Builder كامل بنظام Elementor مع:

✅ **6 مكونات أساسية** (Text, Button, Container, Image, ProductCard, CountdownTimer)
✅ **Toolbox بتصنيفات** (أساسي، متجر)
✅ **Settings Panel متقدم** (3 تبويبات)
✅ **Topbar** مع Undo/Redo/Save/Export
✅ **Drag & Drop** كامل
✅ **Live Editing** مباشر
✅ **Backend Integration** جاهز

**الخطوة التالية:** تثبيت المكتبات وتشغيل المحرر! 🚀

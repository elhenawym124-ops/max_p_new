# 🏢 نظام الصفحات الرئيسية متعدد الشركات

## 📋 نظرة عامة

كل شركة لها صفحتها الرئيسية المستقلة تماماً. النظام يدعم:
- ✅ **بيئة التطوير (Development)** - localhost
- ✅ **بيئة الإنتاج (Production)** - مع Subdomains

---

## 🔧 كيف يعمل النظام؟

### 1️⃣ **في بيئة التطوير (Development)**

#### الطريقة الأولى: من خلال المستخدم المسجل
```
http://localhost:3000/home
```
- يأخذ الـ `companyId` من المستخدم المسجل دخوله
- كل مستخدم يرى صفحة شركته فقط

#### الطريقة الثانية: من خلال URL Parameter
```
http://localhost:3000/home?companyId=cmem8ayyr004cufakqkcsyn97
```
- يمكنك تحديد أي شركة من خلال الـ URL
- مفيد للاختبار والمعاينة

---

### 2️⃣ **في بيئة الإنتاج (Production)**

#### باستخدام Subdomains:
```
https://company1.yourdomain.com/home
https://company2.yourdomain.com/home
https://company3.yourdomain.com/home
```

كل subdomain يعرض صفحة الشركة الخاصة به تلقائياً!

---

## 🎯 آلية تحديد الشركة

النظام يبحث عن الـ `companyId` بالترتيب التالي:

### 1. من URL Query Parameter
```javascript
// الأولوية الأولى
?companyId=xxx
```

### 2. من المستخدم المسجل
```javascript
// إذا المستخدم مسجل دخول
user.companyId
```

### 3. من Subdomain
```javascript
// في Production
company1.yourdomain.com → company1
```

---

## 📊 قاعدة البيانات

### جدول `homepage_templates`:

```sql
CREATE TABLE homepage_templates (
  id VARCHAR(191) PRIMARY KEY,
  companyId VARCHAR(191) NOT NULL,  -- ← كل قالب مرتبط بشركة
  name VARCHAR(191),
  content LONGTEXT,
  isActive BOOLEAN DEFAULT false,   -- ← قالب واحد نشط لكل شركة
  ...
  INDEX (companyId),
  INDEX (isActive)
);
```

### القواعد:
- ✅ كل شركة لها قوالب خاصة بها
- ✅ قالب واحد فقط يكون نشط لكل شركة
- ✅ الشركات لا ترى قوالب بعضها

---

## 🔐 الأمان (Security)

### في Backend:

```javascript
// ✅ كل API تتحقق من الشركة
exports.getHomepageTemplates = async (req, res) => {
  const { companyId } = req.user; // من الـ token
  
  const templates = await prisma.homepageTemplate.findMany({
    where: { companyId } // ← فقط قوالب هذه الشركة
  });
};
```

### في Frontend:

```javascript
// ✅ كل صفحة تحمل بيانات شركتها فقط
const response = await homepageService.getPublicActiveTemplate(companyId);
```

---

## 🚀 أمثلة الاستخدام

### مثال 1: شركة واحدة في Development

```bash
# 1. سجل دخول كمستخدم من الشركة
# 2. اذهب إلى
http://localhost:3000/home

# ستظهر صفحة شركتك فقط
```

### مثال 2: عدة شركات في Development

```bash
# شركة 1
http://localhost:3000/home?companyId=company1-id

# شركة 2
http://localhost:3000/home?companyId=company2-id

# شركة 3
http://localhost:3000/home?companyId=company3-id
```

### مثال 3: Production مع Subdomains

```bash
# شركة 1
https://store1.yourdomain.com/home

# شركة 2
https://store2.yourdomain.com/home

# شركة 3
https://store3.yourdomain.com/home
```

---

## 🎨 إدارة الصفحات

### لكل شركة:

#### 1. إنشاء صفحة جديدة
```
/settings/homepage → إنشاء صفحة جديدة
```

#### 2. تعديل الصفحة
```
/settings/homepage → تعديل
```

#### 3. تفعيل صفحة
```
/settings/homepage → تفعيل
```

#### 4. معاينة الصفحة
```
/settings/homepage → معاينة
```

---

## 📝 API Endpoints

### Protected (تحتاج Authentication):

```javascript
// جلب جميع قوالب الشركة
GET /api/v1/homepage/templates
Headers: { Authorization: Bearer <token> }

// إنشاء قالب جديد
POST /api/v1/homepage/templates
Headers: { Authorization: Bearer <token> }
Body: { name, description, content }

// تفعيل قالب
PUT /api/v1/homepage/templates/:id/activate
Headers: { Authorization: Bearer <token> }
```

### Public (عامة):

```javascript
// جلب القالب النشط لشركة معينة
GET /api/v1/homepage/public/:companyId

// مثال:
GET /api/v1/homepage/public/cmem8ayyr004cufakqkcsyn97
```

---

## 🔄 سيناريوهات الاستخدام

### السيناريو 1: متجر واحد

```
شركة واحدة → صفحة رئيسية واحدة
```

### السيناريو 2: عدة متاجر (Multi-tenant)

```
شركة 1 → صفحة رئيسية خاصة
شركة 2 → صفحة رئيسية خاصة
شركة 3 → صفحة رئيسية خاصة
```

### السيناريو 3: White Label

```
نفس النظام → عدة علامات تجارية
كل علامة → تصميم مستقل تماماً
```

---

## 🛠️ إعداد Production

### 1. إعداد DNS:

```
*.yourdomain.com → Your Server IP
```

### 2. إعداد Nginx:

```nginx
server {
    server_name ~^(?<subdomain>.+)\.yourdomain\.com$;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Subdomain $subdomain;
    }
}
```

### 3. في Backend:

```javascript
// middleware/companyMiddleware.js
const getCompanyFromSubdomain = async (req, res, next) => {
  const subdomain = req.headers['x-subdomain'] || req.hostname.split('.')[0];
  
  const company = await prisma.company.findUnique({
    where: { slug: subdomain }
  });
  
  req.company = company;
  next();
};
```

---

## 📊 مثال عملي

### الشركة الأولى: "شركة التسويق"

```javascript
{
  id: "cmem8ayyr004cufakqkcsyn97",
  name: "شركة التسويق",
  slug: "shrka-altswyq",
  homepageTemplates: [
    {
      id: "template1",
      name: "WoodMart Fashion - Complete",
      isActive: true
    }
  ]
}
```

**الوصول:**
- Development: `http://localhost:3000/home?companyId=cmem8ayyr004cufakqkcsyn97`
- Production: `https://shrka-altswyq.yourdomain.com/home`

---

## ✅ المميزات

### 1. **عزل تام بين الشركات**
- كل شركة لها بياناتها الخاصة
- لا يمكن لشركة رؤية بيانات شركة أخرى

### 2. **مرونة في التطوير**
- اختبار سهل في Development
- يمكن معاينة أي شركة

### 3. **جاهز للإنتاج**
- يدعم Subdomains
- يدعم Custom Domains
- Scalable

### 4. **سهولة الإدارة**
- كل شركة تدير صفحتها بشكل مستقل
- لا تداخل بين الشركات

---

## 🔍 التحقق من عمل النظام

### اختبار 1: شركة واحدة

```bash
# 1. سجل دخول
# 2. اذهب إلى /home
# 3. يجب أن ترى صفحة شركتك
```

### اختبار 2: عدة شركات

```bash
# 1. أنشئ قالب للشركة الأولى
# 2. أنشئ قالب للشركة الثانية
# 3. افتح كل صفحة بـ companyId مختلف
# 4. يجب أن ترى صفحات مختلفة
```

---

## 📚 الملفات المهمة

### Backend:
```
backend/controller/homepageController.js
backend/routes/homepageRoutes.js
backend/prisma/schema.prisma
```

### Frontend:
```
frontend/src/pages/storefront/Homepage.tsx
frontend/src/services/homepageService.ts
frontend/src/components/homepage/*
```

---

## 🎯 الخلاصة

✅ **كل شركة مستقلة تماماً**
✅ **يعمل في Development و Production**
✅ **آمن ومعزول**
✅ **سهل الإدارة**
✅ **Scalable**

**النظام جاهز للاستخدام في بيئة Multi-tenant!** 🚀

# 🚀 تثبيت Page Builder - الآن!

## ✅ تم تحديث package.json بنجاح!

تم إضافة المكتبات المطلوبة:
- ✅ `@craftjs/core@^0.2.0-beta.12`
- ✅ `react-color@^2.19.3`

---

## 📦 الخطوة التالية: تثبيت المكتبات

### الطريقة 1: PowerShell (موصى بها)

افتح PowerShell كـ **Administrator** وشغّل:

```powershell
# تفعيل تشغيل السكريبتات
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# الانتقال للمجلد
cd "C:\Users\38asfasf\Downloads\max_p_new\frontend"

# التثبيت
npm install
```

### الطريقة 2: Command Prompt (CMD)

افتح CMD وشغّل:

```cmd
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm install
```

### الطريقة 3: من VS Code Terminal

1. افتح VS Code
2. اضغط `` Ctrl + ` `` لفتح Terminal
3. شغّل:
```bash
cd frontend
npm install
```

---

## ⏱️ وقت التثبيت المتوقع

- **2-3 دقائق** (حسب سرعة الإنترنت)

---

## ✅ التحقق من التثبيت

بعد انتهاء التثبيت، شغّل:

```bash
npm list @craftjs/core react-color
```

يجب أن ترى:
```
├── @craftjs/core@0.2.0-beta.12
└── react-color@2.19.3
```

---

## 🎯 بعد التثبيت

### 1. أضف Routes في App.tsx

افتح `frontend/src/App.tsx` وأضف:

```typescript
import PageBuilder from './pages/PageBuilder';
import LandingPageList from './pages/LandingPageList';

// داخل <Routes>
<Route path="/page-builder" element={<PageBuilder />} />
<Route path="/landing-pages" element={<LandingPageList />} />
```

### 2. شغّل المشروع

```bash
npm run dev
```

### 3. افتح المحرر

```
http://localhost:3000/page-builder
```

---

## 🐛 حل المشاكل

### مشكلة: PowerShell Scripts Disabled

**الحل:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### مشكلة: npm not found

**الحل:** تأكد من تثبيت Node.js:
```
https://nodejs.org/
```

### مشكلة: Permission Denied

**الحل:** شغّل Terminal كـ Administrator

---

## 📚 الخطوات الكاملة

1. ✅ تحديث package.json (تم)
2. ⏳ تثبيت المكتبات (الخطوة الحالية)
3. ⏳ إضافة Routes
4. ⏳ تشغيل المشروع
5. ⏳ فتح المحرر

---

## 🎉 بعد التثبيت

راجع هذه الملفات:
- `FINAL_INSTALLATION_GUIDE.md` - دليل التثبيت الكامل
- `QUICK_START_PAGE_BUILDER.md` - بداية سريعة
- `PAGE_BUILDER_GUIDE.md` - دليل شامل

---

## 💡 نصيحة

إذا واجهت أي مشكلة:
1. أغلق Terminal
2. افتحه كـ Administrator
3. أعد المحاولة

**جاهز للتثبيت! 🚀**

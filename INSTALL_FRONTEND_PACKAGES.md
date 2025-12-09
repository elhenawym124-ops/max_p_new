# 🔧 حل خطأ Frontend - ERR_ABORTED 500

## ❌ الخطأ:
```
GET http://localhost:3000/src/main.tsx?t=1765242287614 net::ERR_ABORTED 500 (Internal Server Error)
```

## 🎯 السبب:
الـ packages المطلوبة غير مثبتة في Frontend:
- ❌ `date-fns` - غير مثبت
- ❌ `recharts` - غير مثبت

---

## ✅ الحل السريع

### الطريقة 1: PowerShell (مع تفعيل Execution Policy)

#### خطوة 1: تفعيل PowerShell Scripts
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### خطوة 2: تثبيت الـ Packages
```powershell
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm install date-fns recharts
```

---

### الطريقة 2: Command Prompt (CMD)

افتح **Command Prompt** (CMD) وليس PowerShell:

```cmd
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm install date-fns recharts
```

---

### الطريقة 3: Git Bash

افتح **Git Bash**:

```bash
cd /c/Users/38asfasf/Downloads/max_p_new/frontend
npm install date-fns recharts
```

---

### الطريقة 4: VS Code Terminal

1. افتح VS Code
2. اضغط `` Ctrl + ` `` لفتح Terminal
3. غيّر إلى **Command Prompt** من القائمة المنسدلة
4. نفذ:
```cmd
cd frontend
npm install date-fns recharts
```

---

## 📦 الـ Packages المطلوبة

### 1. date-fns
**الاستخدام:** تنسيق التواريخ بالعربية في MyActivity.jsx
```javascript
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
```

### 2. recharts
**الاستخدام:** الرسوم البيانية في CompanyActivity.jsx
```javascript
import { PieChart, LineChart } from 'recharts';
```

---

## 🔍 التحقق من التثبيت

بعد التثبيت، تحقق من النجاح:

### في Command Prompt:
```cmd
cd frontend
npm list date-fns
npm list recharts
```

**يجب أن ترى:**
```
frontend@0.1.0
├── date-fns@2.30.0
└── recharts@2.10.3
```

---

## 🚀 تشغيل Frontend بعد التثبيت

### في Command Prompt:
```cmd
cd frontend
npm start
```

**أو:**
```cmd
cd frontend
npm run dev
```

---

## ✅ النتيجة المتوقعة

بعد التثبيت والتشغيل:

```
✓ Compiled successfully!
✓ webpack compiled successfully
✓ Local: http://localhost:3000
```

ثم افتح المتصفح:
- ✅ `http://localhost:3000/my-activity`
- ✅ `http://localhost:3000/company/activity`

---

## 🐛 إذا استمر الخطأ

### 1. احذف node_modules وأعد التثبيت:
```cmd
cd frontend
rmdir /s /q node_modules
del package-lock.json
npm install
npm install date-fns recharts
```

### 2. تحقق من package.json:
افتح `frontend/package.json` وتأكد من وجود:
```json
{
  "dependencies": {
    "date-fns": "^2.30.0",
    "recharts": "^2.10.3"
  }
}
```

### 3. أعد تشغيل الخادم:
```cmd
npm start
```

---

## 📝 ملاحظات مهمة

### ⚠️ PowerShell Execution Policy:
إذا واجهت:
```
running scripts is disabled on this system
```

**الحل:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ✅ استخدم Command Prompt بدلاً من PowerShell:
- اضغط `Win + R`
- اكتب `cmd`
- اضغط Enter
- نفذ الأوامر

---

## 🎯 الأوامر الكاملة (نسخ ولصق)

### في Command Prompt (CMD):
```cmd
cd C:\Users\38asfasf\Downloads\max_p_new\frontend
npm install date-fns recharts
npm start
```

---

## ✨ بعد التثبيت

النظام سيعمل بشكل كامل:
- ✅ صفحة نشاطاتي
- ✅ صفحة نشاطات الشركة
- ✅ الرسوم البيانية
- ✅ تنسيق التواريخ بالعربية

---

**🎉 بالتوفيق!**

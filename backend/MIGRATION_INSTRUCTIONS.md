# 🔄 تعليمات تشغيل Migration - صفحات المتجر

## المشكلة
إذا واجهت خطأ عند تشغيل `npx prisma migrate dev`:
```
npx : File C:\Program Files\nodejs\npx.ps1 cannot be loaded because running scripts is disabled
```

## ✅ الحلول (اختر واحد)

### الحل 1: تفعيل PowerShell Scripts (موصى به)
```powershell
# شغل PowerShell كـ Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# ثم شغل Migration
npx prisma migrate dev --name add_store_pages
```

### الحل 2: استخدام Node مباشرة
```bash
node node_modules/prisma/build/index.js migrate dev --name add_store_pages
```

### الحل 3: استخدام CMD بدلاً من PowerShell
```cmd
# افتح CMD (وليس PowerShell)
cd backend
npx prisma migrate dev --name add_store_pages
```

### الحل 4: استخدام Git Bash
```bash
# افتح Git Bash
cd backend
npx prisma migrate dev --name add_store_pages
```

---

## 📝 خطوات التشغيل الكاملة

### 1. افتح Terminal في مجلد backend
```bash
cd c:\Users\38asfasf\Downloads\max_p_new\backend
```

### 2. شغل Migration
اختر أحد الحلول أعلاه

### 3. تأكد من النجاح
يجب أن ترى:
```
✔ Generated Prisma Client
✔ The migration has been created
✔ Applied migration
```

### 4. أعد تشغيل Backend
```bash
npm run dev
```

---

## 🔍 التحقق من نجاح Migration

### تحقق من الجدول في Database
```sql
-- شغل هذا في database client
SELECT * FROM store_pages;
```

### تحقق من Prisma Client
```javascript
// في backend console
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.storePage.findMany().then(console.log);
```

---

## ⚠️ ملاحظات مهمة

1. **Backup Database** - قبل تشغيل Migration
2. **لا تشغل Migration مرتين** - سيعطي خطأ
3. **تأكد من .env** - يحتوي على `DATABASE_URL`
4. **أغلق Prisma Studio** - إذا كان مفتوح

---

## 🆘 حل المشاكل

### المشكلة: "Migration already exists"
```bash
# احذف Migration وأعد إنشاءه
rm -rf prisma/migrations/[migration-name]
npx prisma migrate dev --name add_store_pages
```

### المشكلة: "Database connection failed"
```bash
# تحقق من DATABASE_URL في .env
# تأكد من تشغيل Database
# جرب:
npx prisma db push
```

### المشكلة: "Prisma Client not generated"
```bash
npx prisma generate
```

---

## ✅ Checklist

- [ ] Database يعمل
- [ ] .env موجود وصحيح
- [ ] schema.prisma محدث
- [ ] Migration تم تشغيله بنجاح
- [ ] Prisma Client تم إنشاءه
- [ ] Backend يعمل بدون أخطاء

---

**بعد نجاح Migration، راجع `QUICK_START_STORE_PAGES.md` للخطوات التالية!**

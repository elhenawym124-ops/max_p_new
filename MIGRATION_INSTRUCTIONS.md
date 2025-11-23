# 📋 تعليمات تنفيذ Migration

## المشكلة
PowerShell Execution Policy يمنع تشغيل `npx` مباشرة.

## الحلول المتاحة

### ✅ الحل 1: استخدام SQL مباشر (الأسرع)

1. افتح قاعدة البيانات (phpMyAdmin أو MySQL Workbench)
2. نفذ ملف `backend/migration-manual.sql`
3. بعد ذلك، شغّل فقط:
   ```bash
   npx prisma generate
   ```

### ✅ الحل 2: تغيير Execution Policy (مؤقت)

في PowerShell (كـ Administrator):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

ثم شغّل:
```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

### ✅ الحل 3: استخدام CMD بدلاً من PowerShell

1. افتح Command Prompt (cmd)
2. انتقل للمجلد:
   ```bash
   cd C:\Users\38asfasf\Downloads\max_p_new\backend
   ```
3. شغّل:
   ```bash
   npx prisma db push --accept-data-loss
   npx prisma generate
   ```

### ✅ الحل 4: استخدام Node.js مباشرة

في مجلد `backend`:
```bash
node node_modules\.bin\prisma db push --accept-data-loss
node node_modules\.bin\prisma generate
```

---

## ⚠️ ملاحظات مهمة

1. **أوقف Backend Server** قبل Migration
2. **احفظ نسخة احتياطية** من قاعدة البيانات
3. بعد Migration، **أعد تشغيل Backend**

---

## ✅ بعد Migration

1. تأكد من نجاح Migration
2. أعد تشغيل Backend Server
3. افتح `/settings/storefront-features`
4. فعّل الميزات الجديدة


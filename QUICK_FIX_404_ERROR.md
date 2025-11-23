# 🔧 حل مشكلة 404 Error - Homepage Templates

## ❌ المشكلة
```
Failed to load resource: the server responded with a status of 404 (Not Found)
www.mokhtarelhenawy.online/api/v1/homepage/templates
```

## ✅ الحل

المشكلة أن جدول `homepage_templates` غير موجود في قاعدة البيانات لأننا لم نقم بتشغيل الـ Migration.

### الطريقة الأولى (باستخدام ملف Batch):

1. **افتح مجلد Backend**:
   ```
   c:\Users\38asfasf\Downloads\max_p_new\backend
   ```

2. **شغل ملف `setup-homepage.bat`** بالضغط عليه مرتين

3. **انتظر حتى ينتهي التنصيب**

4. **أعد تشغيل الـ Backend Server**

### الطريقة الثانية (يدوياً):

1. **افتح Command Prompt (CMD)** - ليس PowerShell
   - اضغط `Win + R`
   - اكتب `cmd`
   - اضغط Enter

2. **اذهب لمجلد Backend**:
   ```cmd
   cd c:\Users\38asfasf\Downloads\max_p_new\backend
   ```

3. **شغل Prisma Generate**:
   ```cmd
   npx prisma generate
   ```

4. **شغل Migration**:
   ```cmd
   npx prisma migrate dev --name add_homepage_templates
   ```

5. **أعد تشغيل Backend Server**:
   - أوقف الـ Server الحالي (Ctrl+C)
   - شغله من جديد:
   ```cmd
   npm run dev
   ```

### الطريقة الثالثة (إذا كانت المشكلة في PowerShell):

1. **افتح PowerShell كـ Administrator**

2. **فعّل تشغيل السكريبتات**:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **اذهب لمجلد Backend**:
   ```powershell
   cd c:\Users\38asfasf\Downloads\max_p_new\backend
   ```

4. **شغل الأوامر**:
   ```powershell
   npx prisma generate
   npx prisma migrate dev --name add_homepage_templates
   ```

## 🔍 التحقق من نجاح العملية

بعد تشغيل Migration، يجب أن ترى:
```
✔ Generated Prisma Client
✔ Database migration completed
```

## 🚀 بعد الانتهاء

1. **أعد تشغيل Backend**
2. **أعد تحميل صفحة Frontend** (F5)
3. **اذهب إلى**: `/settings/homepage`

يجب أن تعمل الصفحة بدون أخطاء الآن! ✅

## 📝 ملاحظات

- إذا ظهرت رسالة "Migration already exists"، هذا طبيعي
- إذا استمرت المشكلة، تأكد من:
  - ✅ الـ Backend يعمل
  - ✅ قاعدة البيانات متصلة
  - ✅ ملف `.env` يحتوي على `DATABASE_URL` صحيح

## 🆘 إذا استمرت المشكلة

جرب Reset للـ Database (⚠️ سيحذف البيانات):
```cmd
npx prisma migrate reset
npx prisma migrate dev
```

---

**ملف الـ Batch جاهز في**: `backend/setup-homepage.bat`

فقط شغله وانتظر! 🎉

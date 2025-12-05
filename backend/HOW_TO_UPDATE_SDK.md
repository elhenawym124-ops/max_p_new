# 🔄 كيفية تحديث Facebook Business SDK

## ⚠️ المشكلة
PowerShell Execution Policy يمنع تشغيل npm مباشرة.

## ✅ الحلول

### الحل 1: استخدام Command Prompt (CMD) - الأسهل
1. افتح **Command Prompt** (CMD) - ليس PowerShell
2. اذهب إلى مجلد backend:
   ```
   cd C:\Users\38asfasf\Downloads\max_p_new\backend
   ```
3. شغّل:
   ```
   npm install facebook-nodejs-business-sdk@latest
   ```

### الحل 2: تغيير PowerShell Execution Policy
1. افتح PowerShell **كمسؤول (Run as Administrator)**
2. شغّل:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. ثم شغّل:
   ```powershell
   cd backend
   npm install facebook-nodejs-business-sdk@latest
   ```

### الحل 3: استخدام npm.cmd مباشرة
في PowerShell:
```powershell
cd backend
& "C:\Program Files\nodejs\npm.cmd" install facebook-nodejs-business-sdk@latest
```

### الحل 4: استخدام VS Code Terminal
1. افتح VS Code
2. اضغط `Ctrl + ~` لفتح Terminal
3. اختر **Command Prompt** من القائمة المنسدلة (ليس PowerShell)
4. شغّل:
   ```
   cd backend
   npm install facebook-nodejs-business-sdk@latest
   ```

## ✅ التحقق من التحديث

بعد التحديث، تحقق:
```bash
npm list facebook-nodejs-business-sdk
```

يجب أن ترى إصدار `22.x.x` أو أحدث.

## 📝 ملاحظة
`package.json` تم تحديثه بالفعل إلى `^22.0.0` - تحتاج فقط لتشغيل `npm install` لتثبيت الإصدار الجديد.







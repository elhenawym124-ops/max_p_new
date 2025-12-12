# 🔧 إصلاح ملف .env على السيرفر

## المشكلة:
ملف `.env` يحتوي على `DATABASE_URL=your_database_url_here` بدلاً من الـ URL الحقيقي.

## الحل:

### 1. اتصل بالسيرفر:
```bash
ssh root@153.92.223.119
```

### 2. افتح ملف .env:
```bash
cd /var/www/backend2
nano .env
```

### 3. حدّث DATABASE_URL:
استبدل:
```env
DATABASE_URL=your_database_url_here
```

بـ:
```env
DATABASE_URL=your_actual_database_url_here
```

### 4. احفظ الملف:
- اضغط `Ctrl + X`
- اضغط `Y` للقبول
- اضغط `Enter` للحفظ

### 5. أعد تشغيل PM2:
```bash
pm2 restart backend1
```

---

## ملاحظة:
- ملف `.env` الآن محفوظ تلقائياً عند النشر
- لن يتم استبداله أو حذفه
- تأكد من تحديثه بالـ URL الصحيح

---

## للتحقق:
```bash
# تحقق من محتوى .env
cat /var/www/backend2/.env | grep DATABASE_URL

# تحقق من logs
pm2 logs backend1 --lines 20
```


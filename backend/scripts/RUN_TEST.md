# كيفية تشغيل اختبار نظام التحليل

## الطريقة 1: عبر API Endpoint (مُوصى به)

1. تأكد من أن الخادم يعمل
2. افتح `/test-chat` في المتصفح
3. اضغط على زر "تحليل شامل وإصلاح"
4. انتظر اكتمال التحليل

## الطريقة 2: عبر Terminal

```bash
# في PowerShell
cd backend
node scripts/analyzeAndFixAITest.js

# أو في Bash
cd backend && node scripts/analyzeAndFixAITest.js
```

## الطريقة 3: عبر API مباشرة

```bash
# POST request
curl -X POST http://localhost:3000/api/v1/test-chat/analyze-and-fix \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## ملاحظات

- تأكد من أن قاعدة البيانات متصلة
- تأكد من أن AI Agent Service يعمل
- قد يستغرق الاختبار عدة دقائق
- يتم حفظ النتائج في المحادثة


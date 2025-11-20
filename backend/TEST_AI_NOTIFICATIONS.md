# اختبار نظام إشعارات فشل الـAI

## كيفية الاختبار

### 1. اختبار Timeout (انتهاء الوقت)

```bash
POST http://localhost:YOUR_PORT/api/v1/test-rag/test-ai-notifications
Content-Type: application/json

{
  "testType": "timeout",
  "conversationId": "optional-conversation-id",
  "companyId": "optional-company-id"
}
```

### 2. اختبار Error (خطأ)

```bash
POST http://localhost:YOUR_PORT/api/v1/test-rag/test-ai-notifications
Content-Type: application/json

{
  "testType": "error",
  "conversationId": "optional-conversation-id",
  "companyId": "optional-company-id"
}
```

## المعاملات

- `testType` (اختياري): `'timeout'` أو `'error'` (افتراضي: `'timeout'`)
- `conversationId` (اختياري): معرف محادثة محددة. إذا لم يتم توفيره، سيستخدم أول محادثة موجودة
- `companyId` (اختياري): معرف الشركة. إذا لم يتم توفيره، سيستخدم companyId من المحادثة

## الاستجابة

الاستجابة تحتوي على:
- معلومات المحادثة المستخدمة
- قائمة المستلمين (Agent + Admins)
- الإشعارات المنشأة
- عدد الإشعارات

## مثال باستخدام curl

```bash
# اختبار timeout
curl -X POST http://localhost:3000/api/v1/test-rag/test-ai-notifications \
  -H "Content-Type: application/json" \
  -d '{
    "testType": "timeout"
  }'

# اختبار error
curl -X POST http://localhost:3000/api/v1/test-rag/test-ai-notifications \
  -H "Content-Type: application/json" \
  -d '{
    "testType": "error"
  }'
```

## مثال باستخدام Postman

1. افتح Postman
2. أنشئ طلب POST جديد
3. URL: `http://localhost:YOUR_PORT/api/v1/test-rag/test-ai-notifications`
4. Headers: `Content-Type: application/json`
5. Body (raw JSON):
```json
{
  "testType": "timeout"
}
```
6. أرسل الطلب

## التحقق من النتائج

بعد تشغيل الاختبار:
1. تحقق من الـconsole logs في الـbackend
2. تحقق من قاعدة البيانات - جدول `notifications` حيث `type = 'ai_failure'`
3. تحقق من الـDashboard - يجب أن تظهر الإشعارات للمستخدمين المعنيين

## ملاحظات

- الاختبار يستخدم محادثة حقيقية من قاعدة البيانات
- الإشعارات تُرسل للـAgent المكلّف + كل الـAdmins (COMPANY_ADMIN, MANAGER)
- الإشعارات تُحفظ في قاعدة البيانات وتُرسل عبر Socket.io


# سكريبتات اختبار نظام الـAI

## السكريبتات المتاحة

### 1. `test_ai_complete.js` - اختبار شامل
**الوصف:** بيختبر كل جزء من النظام (الذاكرة، المنتجات، الـPrompt، الردود، الصور، السياق)

**الاستخدام:**
```bash
# بدون معاملات (سيستخدم أول محادثة موجودة)
node backend/test_ai_complete.js

# مع companyId
node backend/test_ai_complete.js YOUR_COMPANY_ID

# مع companyId و conversationId
node backend/test_ai_complete.js YOUR_COMPANY_ID YOUR_CONVERSATION_ID
```

**ما بيختبره:**
- ✅ نظام الذاكرة (جلب وحفظ)
- ✅ البحث عن المنتجات
- ✅ Fuzzy Matching
- ✅ بناء الـPrompt
- ✅ توليد رد الـAI
- ✅ معالجة الصور (مع خطأ)
- ✅ الوعي بالسياق

---

### 2. `test_ai_memory.js` - اختبار الذاكرة فقط
**الوصف:** بيختبر نظام الذاكرة بالتفصيل

**الاستخدام:**
```bash
node backend/test_ai_memory.js COMPANY_ID CONVERSATION_ID SENDER_ID
```

**ما بيختبره:**
- ✅ جلب الذاكرة
- ✅ حفظ تفاعل جديد
- ✅ فحص format البيانات
- ✅ فحص العزل الأمني

---

### 3. `test_ai_products.js` - اختبار المنتجات فقط
**الوصف:** بيختبر البحث عن المنتجات و Fuzzy Matching

**الاستخدام:**
```bash
node backend/test_ai_products.js COMPANY_ID
```

**ما بيختبره:**
- ✅ Fuzzy Matching (Belle vs بيل)
- ✅ البحث عن منتجات بأسماء مختلفة
- ✅ جلب المنتجات من قاعدة البيانات

---

### 4. `test_ai_context.js` - اختبار الوعي بالسياق
**الوصف:** بيختبر ربط المنتجات من الذاكرة بالطلبات الحالية

**الاستخدام:**
```bash
node backend/test_ai_context.js COMPANY_ID CONVERSATION_ID SENDER_ID
```

**ما بيختبره:**
- ✅ حفظ منتج في الذاكرة
- ✅ السؤال عن المنتج بدون ذكر الاسم ("صور")
- ✅ السؤال عن السعر بدون ذكر المنتج ("بكام")

---

## أمثلة على الاستخدام

### مثال 1: اختبار شامل
```bash
node backend/test_ai_complete.js cmdkj6coz0000uf0cyscco6lr
```

### مثال 2: اختبار الذاكرة فقط
```bash
node backend/test_ai_memory.js cmdkj6coz0000uf0cyscco6lr conv_123 customer_456
```

### مثال 3: اختبار المنتجات
```bash
node backend/test_ai_products.js cmdkj6coz0000uf0cyscco6lr
```

### مثال 4: اختبار السياق
```bash
node backend/test_ai_context.js cmdkj6coz0000uf0cyscco6lr conv_123 customer_456
```

---

## النتائج المتوقعة

### ✅ اختبار ناجح:
- كل الاختبارات تظهر ✅
- الرسائل تظهر باللون الأخضر
- النظام يعمل بشكل صحيح

### ❌ اختبار فاشل:
- بعض الاختبارات تظهر ❌
- الرسائل تظهر باللون الأحمر
- يجب مراجعة الأخطاء

---

## ملاحظات

1. **تأكد من وجود بيانات:**
   - محادثات في قاعدة البيانات
   - منتجات في قاعدة البيانات
   - companyId صحيح

2. **الاختبارات بتستخدم بيانات حقيقية:**
   - بيحفظ تفاعلات في الذاكرة
   - ممكن يحفظ رسائل في المحادثة

3. **للاختبار الآمن:**
   - استخدم companyId و conversationId للاختبار
   - أو أنشئ محادثة اختبار منفصلة

---

**تم إنشاء السكريبتات بواسطة:** AI Testing System
**التاريخ:** ${new Date().toISOString()}


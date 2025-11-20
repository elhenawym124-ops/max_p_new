# دليل استخدام نظام اختبار المنتجات والذكاء الاصطناعي

## نظرة سريعة

هذا النظام يسمح باختبار وظائف الذكاء الاصطناعي باستخدام منتجات شركة التسويق. يمكنك جمع معلومات المنتجات، إنشاء أسئلة اختبار شاملة، وإرسال رسائل اختبار تلقائياً.

## الخطوة 1: جمع معلومات المنتجات

### تشغيل السكريبت

```bash
cd backend
node scripts/collectMarketingCompanyProducts.js
```

### النتيجة

سيتم إنشاء ملف `backend/data/marketing-company-products.json` يحتوي على:
- معلومات الشركة
- جميع المنتجات مع التفاصيل
- الفئات
- إحصائيات شاملة

## الخطوة 2: استخدام API Endpoints

### 1. جلب معلومات الشركة

```bash
GET /api/v1/test-chat/marketing-company/info
Authorization: Bearer {token}
```

### 2. جلب المنتجات

```bash
GET /api/v1/test-chat/marketing-company/products?page=1&limit=50
Authorization: Bearer {token}
```

**Query Parameters:**
- `page`: رقم الصفحة (افتراضي: 1)
- `limit`: عدد العناصر (افتراضي: 100)
- `categoryId`: فلترة حسب الفئة
- `search`: البحث في المنتجات
- `isActive`: فلترة حسب الحالة

### 3. جلب أسئلة الاختبار

```bash
GET /api/v1/test-chat/test-questions?includeProducts=true
Authorization: Bearer {token}
```

### 4. إرسال رسائل الاختبار

```bash
POST /api/v1/test-chat/send-test-messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversationId": "conversation-id",
  "intent": "product_inquiry",
  "difficulty": "easy",
  "options": {
    "delayBetweenMessages": 1000,
    "stopOnError": false
  }
}
```

### 5. جلب النتائج

```bash
GET /api/v1/test-chat/test-results/{conversationId}
Authorization: Bearer {token}
```

### 6. إنشاء تقرير

```bash
POST /api/v1/test-chat/generate-report/{conversationId}
Authorization: Bearer {token}
```

## الخطوة 3: استخدام Frontend Components

### ProductInfoPanel

```tsx
import ProductInfoPanel from '@/components/testChat/ProductInfoPanel';

<ProductInfoPanel 
  companyId={companyId}
  onClose={() => setShowPanel(false)}
/>
```

### TestQuestionsPanel

```tsx
import TestQuestionsPanel from '@/components/testChat/TestQuestionsPanel';

<TestQuestionsPanel 
  companyId={companyId}
  onSelectQuestions={(questions) => {
    // التعامل مع الأسئلة المحددة
  }}
  onClose={() => setShowPanel(false)}
/>
```

### TestResultsPanel

```tsx
import TestResultsPanel from '@/components/testChat/TestResultsPanel';

<TestResultsPanel 
  conversationId={conversationId}
  onRefresh={() => loadResults()}
  onClose={() => setShowPanel(false)}
/>
```

## الخطوة 4: استخدام testChatService

### مثال كامل

```typescript
import { testChatService } from '@/services/testChatService';

// 1. إنشاء محادثة جديدة
const conversation = await testChatService.createConversation();
console.log('Conversation created:', conversation.id);

// 2. جلب أسئلة الاختبار
const questionsData = await testChatService.getTestQuestions(true);
console.log('Total questions:', questionsData.summary.totalQuestions);

// 3. إرسال رسائل الاختبار
const results = await testChatService.sendTestMessages(conversation.id, {
  intent: 'product_inquiry',
  difficulty: 'easy',
  options: {
    delayBetweenMessages: 1000,
    stopOnError: false
  }
});
console.log('Test completed:', results.succeeded, 'succeeded');

// 4. جلب النتائج
const testResults = await testChatService.getTestResults(conversation.id);
console.log('Success rate:', testResults.successRate);

// 5. إنشاء تقرير
const reportResponse = await fetch(
  `/api/v1/test-chat/generate-report/${conversation.id}`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const report = await reportResponse.json();
console.log('Report generated:', report.data.reportPath);
```

## أنواع الأسئلة المتاحة

### 1. Greeting (تحية)
- "السلام عليكم"
- "أهلاً وسهلاً"
- "مرحبا"

### 2. Product Inquiry (استفسار عن المنتجات)
- "عايز أشوف المنتجات"
- "ممكن صور المنتجات؟"
- "ممكن معلومات عن {product-name}؟"

### 3. Price Inquiry (استفسار عن الأسعار)
- "بكام المنتجات؟"
- "بكام {product-name}؟"
- "عايز أعرف الأسعار"

### 4. Shipping Inquiry (استفسار عن الشحن)
- "ممكن تفاصيل الشحن؟"
- "كم وقت التوصيل؟"
- "الشحن بكام؟"

### 5. Order Inquiry (استفسار عن الطلبات)
- "عايز أطلب منتج"
- "كيف أطلب؟"
- "عايز أطلب {product-name}"

### 6. General Inquiry (استفسار عام)
- "ممكن معلومات عن الشركة؟"
- "عندكم إيه جديد؟"

### 7. Image Processing (معالجة الصور)
- "ممكن صور {product-name}؟"
- "ممكن أشوف صور المنتجات؟"

### 8. RAG Retrieval (استرجاع RAG)
- "ممكن تفاصيل كاملة عن {product-name}؟"
- "إيه المنتجات اللي في {category-name}؟"

### 9. Order Detection (اكتشاف الطلبات)
- "عايز {product-name} واحد"
- "أريد شراء {product-name}"

### 10. Sentiment Analysis (تحليل المشاعر)
- "المنتج جميل جداً، شكراً ليكم"
- "مش عاجبني المنتج خالص"

### 11. Context Management (إدارة السياق)
- "عايز {product1} وبعدين {product2}"
- "بكام {product1}؟\nبكام {product2}؟"

### 12. Edge Cases (حالات حدية)
- رسائل فارغة
- نص غير مفهوم
- استفسار عن منتج غير موجود

## مستويات الصعوبة

### Easy (سهل)
- أسئلة مباشرة وبسيطة
- لا تحتاج إلى سياق معقد

### Medium (متوسط)
- أسئلة تحتاج إلى معلومات إضافية
- قد تحتاج إلى معالجة بسيطة

### Hard (صعب)
- أسئلة معقدة تحتاج إلى تحليل عميق
- قد تحتاج إلى سياق المحادثة
- حالات حدية

## فهم النتائج

### Success Rate (نسبة النجاح)
نسبة الأسئلة التي نجحت في الحصول على رد من AI

### Processing Time (وقت المعالجة)
الوقت المستغرق لمعالجة كل رسالة

### Intent Detection (اكتشاف النية)
دقة AI في اكتشاف نية العميل

### Sentiment Analysis (تحليل المشاعر)
دقة AI في تحليل مشاعر العميل

## نصائح للاستخدام

1. **ابدأ بأسئلة سهلة**: اختبر النظام بأسئلة سهلة أولاً
2. **استخدم الفلترة**: استخدم الفلترة حسب الـ intent والصعوبة
3. **راقب النتائج**: راقب النتائج بشكل دوري
4. **أنشئ التقارير**: أنشئ تقارير دورية لتتبع الأداء
5. **اختبر جميع الأنواع**: تأكد من اختبار جميع أنواع الأسئلة

## استكشاف الأخطاء

### المشكلة: لا توجد منتجات
**الحل**: تأكد من وجود منتجات لشركة التسويق في قاعدة البيانات

### المشكلة: فشل في إرسال الرسائل
**الحل**: تأكد من وجود محادثة صحيحة ومفتاح Gemini API نشط

### المشكلة: لا توجد نتائج
**الحل**: تأكد من إرسال رسائل الاختبار أولاً

### المشكلة: خطأ في المصادقة
**الحل**: تأكد من وجود token صحيح في headers

## الدعم

للمساعدة أو الاستفسارات، يرجى الرجوع إلى:
- `backend/services/TEST_CHAT_SYSTEM_README.md` - توثيق النظام
- ملفات الكود المصدر
- فريق التطوير


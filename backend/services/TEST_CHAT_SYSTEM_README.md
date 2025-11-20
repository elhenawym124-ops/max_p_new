# نظام اختبار المنتجات والذكاء الاصطناعي

## نظرة عامة

نظام شامل لاختبار وظائف الذكاء الاصطناعي باستخدام منتجات شركة التسويق. يتيح النظام جمع معلومات المنتجات، إنشاء أسئلة اختبار شاملة، وإرسال رسائل اختبار تلقائياً لاختبار جميع وظائف AI.

## المكونات الرئيسية

### 1. جمع معلومات المنتجات

**الملف:** `backend/scripts/collectMarketingCompanyProducts.js`

- البحث عن شركة "شركة التسويق" في قاعدة البيانات
- جمع معلومات المنتجات (اسم، سعر، وصف، صور، فئات، مخزون)
- حفظ البيانات في ملف JSON

**الاستخدام:**
```bash
node backend/scripts/collectMarketingCompanyProducts.js
```

### 2. إنشاء أسئلة الاختبار

**الملف:** `backend/services/testQuestionGenerator.js`

ينشئ أسئلة اختبار شاملة لجميع وظائف AI:

- **greeting**: تحيات
- **product_inquiry**: استفسار عن المنتجات
- **price_inquiry**: استفسار عن الأسعار
- **shipping_inquiry**: استفسار عن الشحن
- **order_inquiry**: استفسار عن الطلبات
- **general_inquiry**: استفسارات عامة
- **image_processing**: معالجة الصور
- **rag_retrieval**: استرجاع RAG
- **order_detection**: اكتشاف الطلبات
- **sentiment_analysis**: تحليل المشاعر
- **context_management**: إدارة السياق
- **edge_cases**: حالات حدية

### 3. إرسال رسائل الاختبار

**الملف:** `backend/services/testMessageSender.js`

- إرسال رسائل اختبار تلقائياً إلى AI
- حفظ الردود في قاعدة البيانات
- تتبع حالة كل رسالة (نجحت، فشلت، صامت)
- حفظ نتائج الاختبار

### 4. إنشاء التقارير

**الملف:** `backend/services/testReportGenerator.js`

- إنشاء تقارير شاملة عن نتائج الاختبار
- تحليل أداء كل وظيفة من وظائف AI
- إحصائيات مفصلة (نسبة النجاح، وقت الاستجابة)
- حفظ التقرير في ملف Markdown

## API Endpoints

### المنتجات

#### `GET /api/v1/test-chat/marketing-company/info`
جلب معلومات شركة التسويق

#### `GET /api/v1/test-chat/marketing-company/products`
جلب جميع منتجات الشركة

**Query Parameters:**
- `page`: رقم الصفحة (افتراضي: 1)
- `limit`: عدد العناصر (افتراضي: 100، حد أقصى: 500)
- `categoryId`: فلترة حسب الفئة
- `search`: البحث في المنتجات
- `isActive`: فلترة حسب الحالة

### أسئلة الاختبار

#### `GET /api/v1/test-chat/test-questions`
جلب أسئلة الاختبار

**Query Parameters:**
- `includeProducts`: تضمين معلومات المنتجات (true/false)

### إرسال الرسائل

#### `POST /api/v1/test-chat/send-test-messages`
إرسال رسائل اختبار تلقائياً

**Request Body:**
```json
{
  "conversationId": "conversation-id",
  "questions": [], // اختياري - إذا لم يتم توفيره، سيتم جلب الأسئلة تلقائياً
  "intent": "product_inquiry", // اختياري - فلترة حسب الـ intent
  "difficulty": "easy", // اختياري - فلترة حسب الصعوبة
  "options": {
    "delayBetweenMessages": 1000, // تأخير بين الرسائل بالمللي ثانية
    "stopOnError": false, // التوقف عند حدوث خطأ
    "maxConcurrent": 1 // عدد الرسائل المتزامنة
  }
}
```

### النتائج

#### `GET /api/v1/test-chat/test-results/:conversationId`
جلب نتائج الاختبار من المحادثة

#### `POST /api/v1/test-chat/generate-report/:conversationId`
إنشاء تقرير شامل عن نتائج الاختبار

## المكونات Frontend

### ProductInfoPanel
عرض معلومات المنتجات وإحصائياتها

### TestQuestionsPanel
عرض أسئلة الاختبار مع إمكانية الفلترة والتحديد

### TestResultsPanel
عرض نتائج الاختبار مع إحصائيات مفصلة

## الاستخدام

### 1. جمع معلومات المنتجات

```bash
node backend/scripts/collectMarketingCompanyProducts.js
```

سيتم حفظ البيانات في: `backend/data/marketing-company-products.json`

### 2. إنشاء محادثة اختبار

```typescript
const conversation = await testChatService.createConversation();
```

### 3. جلب أسئلة الاختبار

```typescript
const questions = await testChatService.getTestQuestions(true);
```

### 4. إرسال رسائل الاختبار

```typescript
const results = await testChatService.sendTestMessages(conversationId, {
  intent: 'product_inquiry',
  difficulty: 'easy',
  options: {
    delayBetweenMessages: 1000
  }
});
```

### 5. جلب النتائج

```typescript
const results = await testChatService.getTestResults(conversationId);
```

### 6. إنشاء تقرير

```typescript
const report = await fetch(`/api/v1/test-chat/generate-report/${conversationId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## بنية البيانات

### TestQuestion
```typescript
interface TestQuestion {
  question: string;
  intent: string;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedBehavior?: string;
  description?: string;
  productId?: string;
  categoryId?: string;
  requiresImageProcessing?: boolean;
  requiresRAG?: boolean;
  requiresOrderDetection?: boolean;
  requiresSentimentAnalysis?: boolean;
  requiresContextManagement?: boolean;
  isEdgeCase?: boolean;
  expectedSentiment?: string;
}
```

### TestResult
```typescript
interface TestResult {
  questionNumber: number;
  question: string;
  success: boolean;
  userMessage: {
    id: string;
    content: string;
    timestamp: Date;
  };
  aiMessage?: {
    id: string;
    content: string;
    timestamp: Date;
  };
  aiResponse?: {
    content: string;
    intent?: string;
    sentiment?: string;
    confidence?: number;
    processingTime?: number;
    model?: string;
    silent?: boolean;
    error?: string;
  };
  processingTime: number;
  error?: string;
}
```

## الملاحظات

1. **الأمان**: جميع endpoints محمية بمصادقة الشركة
2. **الأداء**: استخدام pagination عند جلب المنتجات
3. **التخزين**: حفظ نتائج الاختبار في قاعدة البيانات
4. **التقارير**: يتم حفظ التقارير في `backend/reports/`

## المتطلبات

- وجود شركة "شركة التسويق" في قاعدة البيانات
- وجود منتجات للشركة
- تفعيل جميع وظائف الذكاء الاصطناعي للشركة
- وجود مفتاح Gemini API نشط للشركة

## الدعم

للمساعدة أو الاستفسارات، يرجى التواصل مع فريق التطوير.


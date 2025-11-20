# 📖 تعليمات اختبار ذكاء الذكاء الاصطناعي

## 🎯 الهدف
اختبار قدرة نظام الذكاء الاصطناعي على فهم نوايا العملاء والرد بشكل ذكي ومناسب.

---

## 🚀 طرق الاختبار

### الطريقة 1: الاختبار اليدوي عبر الواجهة

#### الخطوات:
1. افتح لوحة التحكم في المتصفح
2. اذهب إلى صفحة المحادثات
3. اختر محادثة تجريبية أو أنشئ محادثة جديدة
4. ابدأ بإرسال الأسئلة من ملف `AI_INTELLIGENCE_TEST_QUESTIONS.md`
5. قيم كل رد بناءً على معايير التقييم
6. سجل النتائج في ملف تقرير

---

### الطريقة 2: الاختبار عبر API

#### استخدام Postman أو curl:

```bash
# مثال على اختبار سؤال واحد
curl -X POST http://localhost:3001/api/messages/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "content": "السلام عليكم",
    "customerId": "customer_id",
    "companyId": "company_id",
    "conversationId": "conversation_id",
    "channel": "TEST"
  }'
```

#### استخدام Node.js Script:

```javascript
// test-ai-questions.js
const axios = require('axios');

const questions = [
  { id: 1, question: "السلام عليكم", context: null },
  { id: 2, question: "عندك كوتشي Nike؟", context: null },
  // ... باقي الأسئلة
];

async function testQuestion(questionData, companyId, customerId, conversationId) {
  try {
    const response = await axios.post('http://localhost:3001/api/messages/process', {
      content: questionData.question,
      customerId: customerId,
      companyId: companyId,
      conversationId: conversationId,
      channel: 'TEST'
    });
    
    return {
      questionId: questionData.id,
      question: questionData.question,
      response: response.data.aiResponse,
      success: true
    };
  } catch (error) {
    return {
      questionId: questionData.id,
      question: questionData.question,
      error: error.message,
      success: false
    };
  }
}

// تشغيل الاختبارات
async function runTests() {
  const results = [];
  
  for (const question of questions) {
    const result = await testQuestion(question, 'company_id', 'customer_id', 'conversation_id');
    results.push(result);
    console.log(`Question ${result.questionId}: ${result.success ? '✅' : '❌'}`);
    
    // انتظار قصير بين الأسئلة
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // حفظ النتائج
  console.log('\n=== Results ===');
  console.log(JSON.stringify(results, null, 2));
}

runTests();
```

---

### الطريقة 3: الاختبار الآلي المتقدم

#### إنشاء ملف اختبار شامل:

```javascript
// automated-ai-test.js
const axios = require('axios');
const fs = require('fs');

class AITestRunner {
  constructor(apiUrl, companyId, customerId) {
    this.apiUrl = apiUrl;
    this.companyId = companyId;
    this.customerId = customerId;
    this.conversationId = null;
    this.conversationMemory = [];
    this.results = [];
  }

  async initializeConversation() {
    // إنشاء محادثة جديدة
    // هذا يعتمد على API الخاص بك
    this.conversationId = `test_${Date.now()}`;
  }

  async sendMessage(question, expectedIntent = null) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/messages/process`, {
        content: question,
        customerId: this.customerId,
        companyId: this.companyId,
        conversationId: this.conversationId,
        channel: 'TEST'
      });

      const aiResponse = response.data.aiResponse;
      const detectedIntent = response.data.intent;

      // حفظ في الذاكرة
      this.conversationMemory.push({
        userMessage: question,
        aiResponse: aiResponse,
        intent: detectedIntent
      });

      return {
        question,
        response: aiResponse,
        intent: detectedIntent,
        expectedIntent,
        match: expectedIntent ? detectedIntent === expectedIntent : null
      };
    } catch (error) {
      return {
        question,
        error: error.message,
        success: false
      };
    }
  }

  evaluateResponse(result, criteria) {
    const evaluation = {
      questionId: result.questionId,
      question: result.question,
      scores: {
        intentDetection: 0,
        responseQuality: 0,
        contextAwareness: 0,
        handlingAmbiguity: 0,
        conversationFlow: 0
      },
      comments: []
    };

    // تقييم فهم النية
    if (result.match) {
      evaluation.scores.intentDetection = 1;
    } else if (result.intent) {
      evaluation.scores.intentDetection = 0.5;
      evaluation.comments.push('Intent detected but may not match expected');
    }

    // تقييم جودة الرد
    if (result.response && result.response.length > 10) {
      evaluation.scores.responseQuality = 1;
    } else {
      evaluation.comments.push('Response too short or empty');
    }

    // تقييم السياق
    // هذا يحتاج إلى تحليل أكثر تعقيداً
    evaluation.scores.contextAwareness = 0.5; // placeholder

    return evaluation;
  }

  async runTestSuite(testCases) {
    await this.initializeConversation();

    for (const testCase of testCases) {
      console.log(`\n🧪 Testing Question ${testCase.id}: ${testCase.question}`);
      
      const result = await this.sendMessage(
        testCase.question,
        testCase.expectedIntent
      );

      const evaluation = this.evaluateResponse(result, testCase.criteria);
      this.results.push(evaluation);

      console.log(`   Response: ${result.response.substring(0, 100)}...`);
      console.log(`   Intent: ${result.intent}`);
      console.log(`   Score: ${Object.values(evaluation.scores).reduce((a, b) => a + b, 0)}/5`);

      // انتظار بين الأسئلة
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return this.generateReport();
  }

  generateReport() {
    const totalQuestions = this.results.length;
    const averageScore = this.results.reduce((sum, r) => {
      return sum + Object.values(r.scores).reduce((a, b) => a + b, 0);
    }, 0) / totalQuestions;

    const report = {
      summary: {
        totalQuestions,
        averageScore: averageScore.toFixed(2),
        totalScore: (averageScore / 5 * 100).toFixed(2) + '%'
      },
      results: this.results,
      timestamp: new Date().toISOString()
    };

    // حفظ التقرير
    fs.writeFileSync(
      `ai-test-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );

    return report;
  }
}

// استخدام الاختبار
const testCases = [
  {
    id: 1,
    question: "السلام عليكم",
    expectedIntent: "greeting",
    criteria: {}
  },
  {
    id: 2,
    question: "عندك كوتشي Nike؟",
    expectedIntent: "product_inquiry",
    criteria: {}
  },
  // ... المزيد من الأسئلة
];

const runner = new AITestRunner(
  'http://localhost:3001',
  'your_company_id',
  'your_customer_id'
);

runner.runTestSuite(testCases).then(report => {
  console.log('\n📊 Test Report Generated!');
  console.log(`Average Score: ${report.summary.averageScore}/5`);
  console.log(`Total Score: ${report.summary.totalScore}`);
});
```

---

## 📊 تقييم النتائج

### معايير التقييم لكل سؤال:

#### 1. فهم النية (Intent Detection) - 20%
- ✅ صحيح تماماً: 20 نقطة
- ⚠️ قريب ولكن ليس دقيق: 10 نقطة
- ❌ خاطئ: 0 نقطة

#### 2. جودة الرد (Response Quality) - 30%
- ✅ رد شامل ومفيد: 30 نقطة
- ⚠️ رد متوسط: 15 نقطة
- ❌ رد ضعيف أو غير مناسب: 0 نقطة

#### 3. الوعي بالسياق (Context Awareness) - 20%
- ✅ استخدام السياق بشكل صحيح: 20 نقطة
- ⚠️ استخدام جزئي للسياق: 10 نقطة
- ❌ تجاهل السياق: 0 نقطة

#### 4. التعامل مع الغموض (Handling Ambiguity) - 15%
- ✅ طلب توضيح بشكل مناسب: 15 نقطة
- ⚠️ محاولة فهم ولكن غير كافية: 8 نقطة
- ❌ تجاهل الغموض: 0 نقطة

#### 5. استمرارية المحادثة (Conversation Flow) - 15%
- ✅ توجيه المحادثة بشكل صحيح: 15 نقطة
- ⚠️ توجيه جزئي: 8 نقطة
- ❌ عدم التوجيه: 0 نقطة

---

## 📈 تقرير النتائج

### مثال على تقرير النتائج:

```json
{
  "testDate": "2025-01-15",
  "totalQuestions": 50,
  "results": {
    "greeting": {
      "total": 5,
      "passed": 5,
      "averageScore": 4.8
    },
    "product_inquiry": {
      "total": 10,
      "passed": 9,
      "averageScore": 4.5
    },
    "price_inquiry": {
      "total": 8,
      "passed": 7,
      "averageScore": 4.2
    },
    "shipping_inquiry": {
      "total": 7,
      "passed": 6,
      "averageScore": 4.0
    },
    "order_inquiry": {
      "total": 10,
      "passed": 8,
      "averageScore": 4.3
    },
    "complex_cases": {
      "total": 5,
      "passed": 3,
      "averageScore": 3.5
    },
    "support_inquiry": {
      "total": 5,
      "passed": 5,
      "averageScore": 4.6
    }
  },
  "overallScore": 4.3,
  "overallPercentage": 86%
}
```

---

## 🔧 نصائح للاختبار

1. **ابدأ بالأسئلة البسيطة**: ابدأ بالتحيات والاستفسارات البسيطة
2. **اختبر السياق**: تأكد من اختبار الأسئلة التي تحتاج سياق
3. **اختبر الحالات الحدية**: ركز على الحالات المعقدة والغامضة
4. **سجل الملاحظات**: دوّن أي ملاحظات مهمة أثناء الاختبار
5. **كرر الاختبار**: اختبر نفس الأسئلة بعد التحديثات

---

## 📝 قالب تسجيل النتائج

```
السؤال #1: "السلام عليكم"
الرد المتوقع: تحية ودودة + طلب المساعدة
الرد الفعلي: "السلام عليكم ورحمة الله وبركاته 😊 كيف يمكنني مساعدتك اليوم؟"
التقييم:
- فهم النية: ✅ (20/20)
- جودة الرد: ✅ (30/30)
- الوعي بالسياق: ✅ (20/20)
- التعامل مع الغموض: N/A
- استمرارية المحادثة: ✅ (15/15)
النتيجة: 85/85 (100%)
الملاحظات: رد ممتاز ومهذب
```

---

## 🎯 الأهداف المستهدفة

- **الهدف الأدنى**: 70% من الأسئلة يجب أن تحصل على تقييم جيد (3.5/5)
- **الهدف المتوسط**: 80% من الأسئلة يجب أن تحصل على تقييم جيد جداً (4/5)
- **الهدف المثالي**: 90% من الأسئلة يجب أن تحصل على تقييم ممتاز (4.5/5)

---

**تاريخ الإنشاء**: ${new Date().toLocaleDateString('ar-EG')}
**النسخة**: 1.0
**الحالة**: ✅ جاهز للاستخدام



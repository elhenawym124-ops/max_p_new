# 🧪 دليل الاختبار الشامل - إصلاحات نظام مفاتيح Gemini

**التاريخ:** 28 نوفمبر 2025  
**الهدف:** التحقق من جميع الإصلاحات الـ 7

---

## 📋 **قائمة الاختبارات**

### ✅ **الاختبار 1: نظام تتبع عالمي للنماذج المجربة**
### ✅ **الاختبار 2: معامل excludeModels**
### ✅ **الاختبار 3: Cache Invalidation**
### ✅ **الاختبار 4: دمج exhaustedModelsCache مع excludedModels**
### ✅ **الاختبار 5: Optimistic Locking**
### ✅ **الاختبار 6: Cache TTL 30 ثانية**
### ✅ **الاختبار 7: حد أقصى للمحاولات**

---

## 🧪 **الاختبار 1: نظام تتبع عالمي للنماذج المجربة**

### **الهدف:**
التحقق من أن النظام يتتبع النماذج المجربة عبر جميع محاولات الـ fallback ولا يعيد تجربة نفس النموذج.

### **خطوات الاختبار:**

#### **1.1 اختبار التتبع الأساسي**
```javascript
// في Node.js console أو ملف اختبار
const { aiAgentService } = require('./backend/services/aiAgentService');

// محاكاة طلب AI
async function testGlobalTriedModels() {
  const companyId = 'test-company-123';
  const conversationId = 'test-conv-456';
  
  // محاولة توليد رد (سيفشل النموذج الأول)
  const result = await aiAgentService.generateAIResponse(
    'مرحبا، كيف حالك؟',
    [],
    false,
    null,
    companyId,
    conversationId,
    {}
  );
  
  console.log('Result:', result);
}

testGlobalTriedModels();
```

#### **1.2 التحقق من Logs**
ابحث في console عن:
```
📝 [TRIED-MODELS] Added gemini-2.0-flash-exp to tried list. Total tried: 1
📝 [TRIED-MODELS] Added gemini-1.5-pro-002 to tried list. Total tried: 2
🧹 [CLEANUP] Removed old session: test-company-123_test-conv-456_...
```

### **النتيجة المتوقعة:**
- ✅ كل نموذج يُضاف مرة واحدة فقط
- ✅ لا يتم تجربة نفس النموذج مرتين
- ✅ التنظيف التلقائي يعمل بعد 5 دقائق

### **معايير النجاح:**
- [ ] `triedModels.size` يزداد مع كل محاولة
- [ ] لا توجد نماذج مكررة في `triedModels`
- [ ] التنظيف التلقائي يحذف الجلسات القديمة

---

## 🧪 **الاختبار 2: معامل excludeModels**

### **الهدف:**
التحقق من أن `findNextAvailableModel` يستثني النماذج المحددة.

### **خطوات الاختبار:**

#### **2.1 اختبار الاستثناء المباشر**
```javascript
const { modelManager } = require('./backend/services/aiAgent/modelManager');

async function testExcludeModels() {
  const companyId = 'test-company-123';
  const excludeModels = ['gemini-2.0-flash-exp', 'gemini-1.5-pro-002'];
  
  const result = await modelManager.findNextAvailableModel(
    companyId, 
    excludeModels
  );
  
  console.log('Selected model:', result?.model);
  console.log('Should NOT be:', excludeModels);
  
  // التحقق
  if (excludeModels.includes(result?.model)) {
    console.error('❌ FAILED: Selected excluded model!');
  } else {
    console.log('✅ PASSED: Correctly excluded models');
  }
}

testExcludeModels();
```

#### **2.2 التحقق من Logs**
```
🚫 [FIND-NEXT] Excluding 2 models: gemini-2.0-flash-exp, gemini-1.5-pro-002
🚫 [QUOTA-PRIORITY] [1/7] gemini-2.0-flash-exp - مستثنى من القائمة - تخطي
🚫 [QUOTA-PRIORITY] [2/7] gemini-1.5-pro-002 - مستثنى من القائمة - تخطي
✅ [FIND-NEXT] استخدام النظام الجديد - النموذج: gemini-1.5-flash-002
```

### **النتيجة المتوقعة:**
- ✅ النماذج المستثناة لا يتم اختيارها
- ✅ النظام يختار نموذج غير مستثنى
- ✅ Logs تظهر التخطي

### **معايير النجاح:**
- [ ] النموذج المختار ليس في `excludeModels`
- [ ] Logs تظهر "مستثنى من القائمة"
- [ ] النظام يعمل حتى مع قائمة طويلة من الاستثناءات

---

## 🧪 **الاختبار 3: Cache Invalidation**

### **الهدف:**
التحقق من أن cache الكوتة يتم إبطاله فوراً عند تحديث الاستخدام.

### **خطوات الاختبار:**

#### **3.1 اختبار Invalidation بعد updateModelUsage**
```javascript
async function testCacheInvalidation() {
  const modelManager = require('./backend/services/aiAgent/modelManager');
  const companyId = 'test-company-123';
  const modelName = 'gemini-2.0-flash-exp';
  
  // 1. حساب الكوتة (سيتم cache)
  const quota1 = await modelManager.calculateTotalQuota(modelName, companyId);
  console.log('Quota before update:', quota1.rpmPercentage);
  
  // 2. تحديث الاستخدام
  const modelId = 'test-model-id';
  await modelManager.updateModelUsage(modelId, 1000);
  
  // 3. حساب الكوتة مرة أخرى (يجب أن يكون من DB وليس cache)
  const quota2 = await modelManager.calculateTotalQuota(modelName, companyId);
  console.log('Quota after update:', quota2.rpmPercentage);
  
  // التحقق
  if (quota1.rpmPercentage === quota2.rpmPercentage) {
    console.error('❌ FAILED: Cache not invalidated!');
  } else {
    console.log('✅ PASSED: Cache invalidated correctly');
  }
}

testCacheInvalidation();
```

#### **3.2 التحقق من Logs**
```
✅ [USAGE-UPDATE] Updated usage for model gemini-2.0-flash-exp
🗑️ [CACHE-INVALIDATE] Invalidated quota cache for gemini-2.0-flash-exp (company: test-company-123)
```

### **النتيجة المتوقعة:**
- ✅ Cache يتم حذفه فوراً بعد التحديث
- ✅ القراءة التالية تأتي من DB
- ✅ البيانات دقيقة 100%

### **معايير النجاح:**
- [ ] Log يظهر "Invalidated quota cache"
- [ ] الكوتة تتغير بعد التحديث
- [ ] لا توجد بيانات قديمة (stale data)

---

## 🧪 **الاختبار 4: دمج exhaustedModelsCache مع excludedModels**

### **الهدف:**
التحقق من أن النماذج المستنفدة تُضاف إلى قاعدة البيانات وليس فقط الذاكرة.

### **خطوات الاختبار:**

#### **4.1 اختبار الدمج**
```javascript
async function testExhaustedModelsPersistence() {
  const modelManager = require('./backend/services/aiAgent/modelManager');
  const prisma = require('./backend/services/sharedDatabase').getSharedPrismaClient();
  
  const modelName = 'gemini-2.0-flash-exp';
  const companyId = 'test-company-123';
  
  // 1. تحديد النموذج كمستنفد
  await modelManager.markModelAsExhaustedFrom429(modelName, '250', companyId);
  
  // 2. التحقق من الذاكرة
  const inMemory = modelManager.exhaustedModelsCache.has(modelName);
  console.log('In memory cache:', inMemory);
  
  // 3. التحقق من قاعدة البيانات
  const inDB = await prisma.excludedModel.findFirst({
    where: {
      modelName: modelName,
      companyId: companyId,
      reason: 'QUOTA_429'
    }
  });
  console.log('In database:', !!inDB);
  
  // التحقق
  if (inMemory && inDB) {
    console.log('✅ PASSED: Model in both memory and DB');
  } else {
    console.error('❌ FAILED: Model not properly persisted');
  }
}

testExhaustedModelsPersistence();
```

#### **4.2 التحقق من Logs**
```
⚠️ [QUOTA-EXHAUSTED] Updated model gemini-2.0-flash-exp
✅ [FIX-4] Added gemini-2.0-flash-exp to excludedModels (key: Main API Key)
🗑️ [CACHE-INVALIDATE] Invalidated quota cache for gemini-2.0-flash-exp
```

### **النتيجة المتوقعة:**
- ✅ النموذج في `exhaustedModelsCache`
- ✅ النموذج في جدول `excludedModel`
- ✅ البيانات تستمر بعد إعادة تشغيل السيرفر

### **معايير النجاح:**
- [ ] `exhaustedModelsCache.has(modelName)` = true
- [ ] سجل في `excludedModel` table
- [ ] `reason` = 'QUOTA_429'

---

## 🧪 **الاختبار 5: Optimistic Locking**

### **الهدف:**
التحقق من أن Optimistic Locking يمنع Race Conditions.

### **خطوات الاختبار:**

#### **5.1 اختبار التزامن**
```javascript
async function testOptimisticLocking() {
  const modelManager = require('./backend/services/aiAgent/modelManager');
  const modelId = 'test-model-id';
  
  // محاكاة 10 طلبات متزامنة
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(modelManager.updateModelUsage(modelId, 100));
  }
  
  // انتظار جميع الطلبات
  await Promise.all(promises);
  
  // التحقق من العدد النهائي
  const prisma = require('./backend/services/sharedDatabase').getSharedPrismaClient();
  const model = await prisma.geminiKeyModel.findUnique({
    where: { id: modelId }
  });
  
  const usage = JSON.parse(model.usage);
  console.log('Final usage count:', usage.used);
  console.log('Expected:', 10);
  
  if (usage.used === 10) {
    console.log('✅ PASSED: No race conditions');
  } else {
    console.error('❌ FAILED: Race condition detected!');
  }
}

testOptimisticLocking();
```

#### **5.2 التحقق من Logs**
```
⚠️ [OPTIMISTIC-LOCK] Retry 1/3 for model test-model-id
⚠️ [OPTIMISTIC-LOCK] Retry 2/3 for model test-model-id
✅ [USAGE-UPDATE] Updated usage for model gemini-2.0-flash-exp
```

### **النتيجة المتوقعة:**
- ✅ جميع التحديثات تنجح
- ✅ العدد النهائي دقيق (10)
- ✅ Retries تحدث عند التزامن

### **معايير النجاح:**
- [ ] `usage.used` = عدد الطلبات الفعلي
- [ ] لا توجد تحديثات مفقودة
- [ ] Logs تظهر retries عند الحاجة

---

## 🧪 **الاختبار 6: Cache TTL 30 ثانية**

### **الهدف:**
التحقق من أن cache يستمر لمدة 30 ثانية.

### **خطوات الاختبار:**

#### **6.1 اختبار TTL**
```javascript
async function testCacheTTL() {
  const modelManager = require('./backend/services/aiAgent/modelManager');
  const modelName = 'gemini-2.0-flash-exp';
  const companyId = 'test-company-123';
  
  // 1. حساب الكوتة (سيتم cache)
  console.log('First call (will cache)...');
  const start1 = Date.now();
  await modelManager.calculateTotalQuota(modelName, companyId);
  const time1 = Date.now() - start1;
  console.log('Time:', time1, 'ms');
  
  // 2. حساب مرة أخرى فوراً (من cache)
  console.log('Second call (from cache)...');
  const start2 = Date.now();
  await modelManager.calculateTotalQuota(modelName, companyId);
  const time2 = Date.now() - start2;
  console.log('Time:', time2, 'ms');
  
  // 3. انتظار 31 ثانية
  console.log('Waiting 31 seconds...');
  await new Promise(resolve => setTimeout(resolve, 31000));
  
  // 4. حساب مرة أخرى (من DB)
  console.log('Third call (after TTL, from DB)...');
  const start3 = Date.now();
  await modelManager.calculateTotalQuota(modelName, companyId);
  const time3 = Date.now() - start3;
  console.log('Time:', time3, 'ms');
  
  // التحقق
  if (time2 < 10 && time3 > 50) {
    console.log('✅ PASSED: Cache TTL working correctly');
  } else {
    console.error('❌ FAILED: Cache TTL not working');
  }
}

testCacheTTL();
```

#### **6.2 التحقق من Logs**
```
✅ [QUOTA-CACHE] استخدام Cache للكوتة: gemini-2.0-flash-exp (test-company-123)
```

### **النتيجة المتوقعة:**
- ✅ القراءة الثانية سريعة جداً (< 10ms)
- ✅ القراءة الثالثة بطيئة (> 50ms)
- ✅ Cache يعمل لمدة 30 ثانية

### **معايير النجاح:**
- [ ] القراءة من cache أسرع 10x
- [ ] Cache ينتهي بعد 30 ثانية
- [ ] Log يظهر "استخدام Cache"

---

## 🧪 **الاختبار 7: حد أقصى للمحاولات**

### **الهدف:**
التحقق من أن النظام يتوقف بعد 3 محاولات فاشلة.

### **خطوات الاختبار:**

#### **7.1 اختبار الحد الأقصى**
```javascript
async function testMaxFallbackAttempts() {
  // محاكاة سيناريو حيث جميع النماذج تفشل
  // يمكن القيام بذلك عن طريق:
  // 1. تعطيل جميع المفاتيح مؤقتاً
  // 2. أو استخدام API keys غير صالحة
  
  const { aiAgentService } = require('./backend/services/aiAgentService');
  
  const result = await aiAgentService.generateAIResponse(
    'test prompt',
    [],
    false,
    null,
    'test-company-123',
    'test-conv-456',
    {}
  );
  
  console.log('Result:', result);
  
  // التحقق من أن النظام توقف بعد 3 محاولات
  // عن طريق فحص الـ logs
}

testMaxFallbackAttempts();
```

#### **7.2 التحقق من Logs**
```
🔄 [503-ERROR] Model is overloaded. Attempting to switch to backup model (attempt 1/3)...
📝 [TRIED-MODELS] Added gemini-2.0-flash-exp to tried list. Total tried: 1
🔄 [503-ERROR] Model is overloaded. Attempting to switch to backup model (attempt 2/3)...
📝 [TRIED-MODELS] Added gemini-1.5-pro-002 to tried list. Total tried: 2
🔄 [503-ERROR] Model is overloaded. Attempting to switch to backup model (attempt 3/3)...
📝 [TRIED-MODELS] Added gemini-1.5-flash-002 to tried list. Total tried: 3
❌ [503-FALLBACK] استنفدت جميع المحاولات (3/3). Tried models: gemini-2.0-flash-exp, gemini-1.5-pro-002, gemini-1.5-flash-002
```

### **النتيجة المتوقعة:**
- ✅ النظام يتوقف بعد 3 محاولات
- ✅ رسالة واضحة عن استنفاد المحاولات
- ✅ إشعار يُرسل للشركة

### **معايير النجاح:**
- [ ] `triedModels.size` = 3
- [ ] Log يظهر "استنفدت جميع المحاولات"
- [ ] `errorType` = 'max_attempts_exceeded'

---

## 🧪 **اختبار التكامل الشامل**

### **السيناريو الكامل:**

```javascript
async function fullIntegrationTest() {
  console.log('🧪 Starting Full Integration Test...\n');
  
  const { aiAgentService } = require('./backend/services/aiAgentService');
  
  // السيناريو: طلب AI → فشل 503 → تبديل → فشل 429 → تبديل → نجاح
  
  const result = await aiAgentService.generateAIResponse(
    'اكتب لي قصة قصيرة عن الذكاء الصناعي',
    [],
    false,
    null,
    'test-company-123',
    'test-conv-456',
    {}
  );
  
  console.log('\n📊 Test Results:');
  console.log('- Response received:', !!result);
  console.log('- Response length:', result?.length || 0);
  
  // فحص الـ logs للتحقق من:
  console.log('\n✅ Checks:');
  console.log('- [ ] globalTriedModels tracked all attempts');
  console.log('- [ ] excludeModels prevented retries');
  console.log('- [ ] Cache invalidated after updates');
  console.log('- [ ] exhaustedModels saved to DB');
  console.log('- [ ] Optimistic locking prevented race conditions');
  console.log('- [ ] Cache TTL respected');
  console.log('- [ ] Max attempts enforced');
  
  console.log('\n🎉 Integration Test Complete!');
}

fullIntegrationTest();
```

---

## 📊 **اختبار الأداء (Performance Test)**

### **اختبار الحمل:**

```javascript
async function loadTest() {
  const { aiAgentService } = require('./backend/services/aiAgentService');
  
  console.log('🚀 Starting Load Test (100 concurrent requests)...\n');
  
  const startTime = Date.now();
  const promises = [];
  
  for (let i = 0; i < 100; i++) {
    promises.push(
      aiAgentService.generateAIResponse(
        `Test prompt ${i}`,
        [],
        false,
        null,
        'test-company-123',
        `test-conv-${i}`,
        {}
      )
    );
  }
  
  const results = await Promise.allSettled(promises);
  const endTime = Date.now();
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log('\n📊 Load Test Results:');
  console.log(`- Total requests: 100`);
  console.log(`- Successful: ${successful} (${successful}%)`);
  console.log(`- Failed: ${failed} (${failed}%)`);
  console.log(`- Total time: ${endTime - startTime}ms`);
  console.log(`- Avg time per request: ${(endTime - startTime) / 100}ms`);
  
  console.log('\n🎯 Target Metrics:');
  console.log(`- Success rate: ${successful >= 95 ? '✅' : '❌'} (target: ≥95%)`);
  console.log(`- Avg response time: ${(endTime - startTime) / 100 < 5000 ? '✅' : '❌'} (target: <5s)`);
}

loadTest();
```

---

## 📝 **قائمة التحقق النهائية**

### **الإصلاحات الحرجة:**
- [ ] ✅ **FIX 1**: globalTriedModels يتتبع جميع المحاولات
- [ ] ✅ **FIX 2**: excludeModels يمنع إعادة المحاولة
- [ ] ✅ **FIX 3**: Cache invalidation يعمل فوراً
- [ ] ✅ **FIX 4**: exhaustedModels في DB + Memory
- [ ] ✅ **FIX 5**: Optimistic locking يمنع race conditions
- [ ] ✅ **FIX 6**: Cache TTL = 30 ثانية
- [ ] ✅ **FIX 7**: MAX_FALLBACK_ATTEMPTS = 3

### **المؤشرات المستهدفة:**
- [ ] معدل النجاح ≥ 95%
- [ ] دقة الكوتة = 100%
- [ ] وقت الاستجابة < 5 ثواني
- [ ] أخطاء 429 < 5%
- [ ] استعلامات DB منخفضة (50-60% أقل)

### **الجودة:**
- [ ] Logs واضحة ومفيدة
- [ ] Error handling شامل
- [ ] No memory leaks
- [ ] No race conditions

---

## 🚀 **تشغيل الاختبارات**

### **الطريقة السريعة:**
```bash
# في terminal
cd backend
node -e "require('./services/aiAgentService').testAllFixes()"
```

### **الطريقة المفصلة:**
```bash
# اختبار كل إصلاح على حدة
node test-fix-1.js
node test-fix-2.js
node test-fix-3.js
# ... إلخ
```

### **اختبار التكامل:**
```bash
node integration-test.js
```

### **اختبار الأداء:**
```bash
node performance-test.js
```

---

## 📊 **تقرير النتائج**

بعد تشغيل جميع الاختبارات، املأ هذا الجدول:

| الاختبار | الحالة | الملاحظات |
|----------|--------|-----------|
| FIX 1: globalTriedModels | ⬜ Pass / ⬜ Fail | |
| FIX 2: excludeModels | ⬜ Pass / ⬜ Fail | |
| FIX 3: Cache Invalidation | ⬜ Pass / ⬜ Fail | |
| FIX 4: exhaustedModels DB | ⬜ Pass / ⬜ Fail | |
| FIX 5: Optimistic Locking | ⬜ Pass / ⬜ Fail | |
| FIX 6: Cache TTL 30s | ⬜ Pass / ⬜ Fail | |
| FIX 7: MAX_ATTEMPTS | ⬜ Pass / ⬜ Fail | |
| Integration Test | ⬜ Pass / ⬜ Fail | |
| Performance Test | ⬜ Pass / ⬜ Fail | |

---

## ✅ **الخلاصة**

- **الاختبارات الأساسية:** 7 اختبارات
- **اختبارات التكامل:** 1 اختبار
- **اختبارات الأداء:** 1 اختبار
- **الوقت المتوقع:** 15-30 دقيقة

**الحالة:** ⬜ جاهز للاختبار

---

**آخر تحديث:** 28 نوفمبر 2025  
**المسؤول:** فريق التطوير

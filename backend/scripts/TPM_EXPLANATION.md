# 📊 شرح TPM (Tokens Per Minute)

## 🔍 ما هو TPM؟

**TPM = Tokens Per Minute** (عدد الـ Tokens في الدقيقة)

### ما هي الـ Tokens؟

الـ **Tokens** هي الوحدات الأساسية التي يستخدمها نموذج Gemini لمعالجة النصوص:

- **1 Token** ≈ **4 characters** (تقريباً)
- **1 Token** ≈ **0.75 words** (تقريباً)

### مثال:
```
النص: "مرحبا بك في متجرنا"
عدد الـ Tokens: ~8 tokens (تقريباً)
```

---

## 📋 الحدود من Google AI Studio:

من الصورة التي أرسلتها، كل نموذج له حد TPM مختلف:

| النموذج | TPM Limit | الاستخدام الحالي |
|---------|-----------|------------------|
| `gemini-2.5-pro` | 125,000 | 10 tokens |
| `gemini-robotics-er-1.5-preview` | 250,000 | 10 tokens |
| `learnlm-2.0-flash-experimental` | N/A | N/A |
| `gemini-2.5-flash` | 250,000 | 10 tokens |
| `gemini-2.0-flash-lite` | 1,000,000 | 29 tokens |
| `gemini-2.0-flash` | 1,000,000 | 9 tokens |
| `gemini-2.5-flash-lite` | 250,000 | 13 tokens |

---

## 🔍 كيف يعمل TPM؟

### 1. **الحدود الزمنية**:
- ✅ **TPM** = عدد الـ tokens المسموح به **في دقيقة واحدة**
- ✅ بعد مرور دقيقة، يتم إعادة تعيين العداد

### 2. **ما يتم احتسابه**:
- ✅ **Prompt Tokens**: عدد الـ tokens في الـ prompt (السؤال/الطلب)
- ✅ **Response Tokens**: عدد الـ tokens في الرد
- ✅ **Total Tokens** = Prompt Tokens + Response Tokens

### 3. **مثال عملي**:
```
الطلب 1:
  - Prompt: 100 tokens
  - Response: 200 tokens
  - Total: 300 tokens
  
الطلب 2 (في نفس الدقيقة):
  - Prompt: 150 tokens
  - Response: 250 tokens
  - Total: 400 tokens
  
الإجمالي في الدقيقة: 700 tokens
```

---

## ⚠️ المشكلة الحالية:

### النظام الحالي **لا يتتبع TPM** ❌

النظام يتتبع فقط:
- ✅ **RPM** (Requests Per Minute) - عدد الطلبات
- ✅ **RPH** (Requests Per Hour) - عدد الطلبات في الساعة
- ✅ **RPD** (Requests Per Day) - عدد الطلبات في اليوم

لكن **لا يتتبع TPM** (Tokens Per Minute) ❌

### لماذا هذا مشكلة؟

1. **قد نتجاوز الحدود بدون علم**:
   - مثال: `gemini-2.5-pro` له حد TPM = 125,000
   - إذا أرسلنا 10 طلبات كبيرة (كل طلب = 15,000 tokens)
   - الإجمالي = 150,000 tokens (تجاوز الحد!)
   - لكن النظام لن يعرف لأنه لا يتتبع TPM

2. **قد نحصل على خطأ 429 (Rate Limit)**:
   - Google API سيرفض الطلب
   - لكن النظام لن يعرف السبب (TPM أو RPM)

---

## ✅ الحل: إضافة تتبع TPM

### 1. **من أين نحصل على عدد الـ Tokens؟**

Gemini API يرجع `usageMetadata` في كل رد:

```javascript
const response = await model.generateContent(prompt);

// الرد يحتوي على:
response.usageMetadata = {
  promptTokenCount: 100,        // عدد tokens في الـ prompt
  candidatesTokenCount: 200,    // عدد tokens في الرد
  totalTokenCount: 300          // إجمالي tokens
}
```

### 2. **كيف نتتبع TPM؟**

مشابه لتتبع RPM:

```javascript
// في updateModelUsage:
const tpmWindowMs = 60 * 1000; // 1 دقيقة
let tpm = usage.tpm || { used: 0, limit: 125000, windowStart: null };

if (!tpm.windowStart || (now - new Date(tpm.windowStart)) >= tpmWindowMs) {
  // نافذة جديدة - ابدأ من الصفر
  tpm = { 
    used: totalTokenCount, 
    limit: tpm.limit || 125000, 
    windowStart: now.toISOString() 
  };
} else {
  // نفس النافذة - أضف للعدد الحالي
  tpm.used = (tpm.used || 0) + totalTokenCount;
}
```

### 3. **فحص TPM قبل الاستخدام:**

```javascript
// في findBestAvailableModelInActiveKey:
if (usage.tpm && usage.tpm.limit > 0 && usage.tpm.windowStart) {
  const now = new Date();
  const tpmWindowStart = new Date(usage.tpm.windowStart);
  const tpmWindowMs = 60 * 1000; // 1 دقيقة
  
  if ((now - tpmWindowStart) < tpmWindowMs) {
    // النافذة لا تزال نشطة
    if ((usage.tpm.used || 0) >= usage.tpm.limit) {
      console.log(`⚠️ النموذج ${modelRecord.model} تجاوز TPM (${usage.tpm.used}/${usage.tpm.limit})`);
      continue; // تجاوز TPM - تخطي هذا النموذج
    }
  }
}
```

---

## 📊 الفرق بين RPM و TPM:

| المقياس | ما يقيسه | مثال |
|---------|----------|------|
| **RPM** | عدد **الطلبات** في الدقيقة | 2 طلبات/دقيقة |
| **TPM** | عدد **الـ Tokens** في الدقيقة | 125,000 tokens/دقيقة |

### مثال عملي:

```
الطلب 1: 10,000 tokens
الطلب 2: 15,000 tokens
الطلب 3: 20,000 tokens

RPM = 3 طلبات ✅ (لم يتجاوز حد 10 طلبات)
TPM = 45,000 tokens ✅ (لم يتجاوز حد 125,000)
```

لكن:

```
الطلب 1: 50,000 tokens
الطلب 2: 60,000 tokens
الطلب 3: 20,000 tokens

RPM = 3 طلبات ✅ (لم يتجاوز حد 10 طلبات)
TPM = 130,000 tokens ❌ (تجاوز حد 125,000!)
```

---

## 🎯 الخلاصة:

1. **TPM** = عدد الـ **Tokens** في الدقيقة (ليس عدد الطلبات)
2. **النظام الحالي لا يتتبع TPM** ❌
3. **الحل**: إضافة تتبع TPM باستخدام `usageMetadata` من الرد
4. **الأهمية**: مهم جداً لتجنب تجاوز الحدود والحصول على خطأ 429

---

## 📝 الخطوات التالية:

1. ✅ إضافة حقل `tpm` في `usage` JSON
2. ✅ تحديث `updateModelUsage` لتتبع TPM
3. ✅ تحديث `findBestAvailableModelInActiveKey` لفحص TPM
4. ✅ استخدام `usageMetadata.totalTokenCount` من الرد


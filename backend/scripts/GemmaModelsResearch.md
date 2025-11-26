# 🔍 بحث عن نماذج Gemma - المصادر الرسمية

## 📚 المصادر الرسمية

### 1. Google AI Studio (ai.google.dev)
- **الرابط:** https://ai.google.dev/models
- **الملاحظة:** نماذج Gemma تظهر في Google AI Studio لكن قد لا تعمل مع `generateContent` API

### 2. Vertex AI (cloud.google.com)
- **الرابط:** https://cloud.google.com/vertex-ai/generative-ai/docs/models/
- **الملاحظة:** نماذج Gemma قد تكون متوفرة فقط عبر Vertex AI وليس Google AI Studio API

---

## 🔍 الفرق بين Google AI Studio API و Vertex AI

### Google AI Studio API:
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **المكتبة:** `@google/generative-ai`
- **النماذج المتوفرة:** Gemini models (gemini-2.5-pro, gemini-2.5-flash, إلخ)
- **الاستخدام:** مجاني مع حد معين

### Vertex AI:
- **Endpoint:** `https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/{model}:generateContent`
- **المكتبة:** `@google-cloud/aiplatform` أو `google-genai`
- **النماذج المتوفرة:** Gemini models + Gemma models + نماذج أخرى
- **الاستخدام:** مدفوع (Pay-as-you-go)

---

## 💡 الاستنتاج

### نماذج Gemma:
1. **تظهر في Google AI Studio** - لكن قد تكون للعرض فقط
2. **متوفرة في Vertex AI** - للاستخدام الفعلي
3. **لا تعمل مع `generateContent` API** من Google AI Studio
4. **تحتاج Vertex AI** - للاستخدام الفعلي

---

## 🔧 الحلول

### الخيار 1: استخدام Vertex AI
```javascript
// استخدام Vertex AI SDK
const { VertexAI } = require('@google-cloud/aiplatform');

const vertexAI = new VertexAI({
  project: 'YOUR_PROJECT_ID',
  location: 'us-central1'
});

const model = vertexAI.getGenerativeModel({
  model: 'gemma-3-27b'
});
```

### الخيار 2: استخدام Google AI Studio API (لنماذج Gemini فقط)
```javascript
// نماذج Gemini تعمل مع Google AI Studio API
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-pro',
  apiVersion: 'v1beta'
});
```

---

## 📋 التوصية

### للنماذج الحالية:
- ✅ **استخدم Google AI Studio API** لـ:
  - gemini-2.5-pro
  - gemini-2.5-flash
  - gemini-2.0-flash
  - gemini-3-pro-preview
  - إلخ...

### لنماذج Gemma:
- ❌ **لا تعمل مع Google AI Studio API**
- ✅ **تحتاج Vertex AI** - يتطلب:
  - مشروع Google Cloud
  - تفعيل Vertex AI API
  - دفع (Pay-as-you-go)
  - استخدام SDK مختلف

---

## 🎯 الخلاصة

**نماذج Gemma غير متوفرة في Google AI Studio API (`generateContent`)**
- تظهر في Google AI Studio لكن للعرض فقط
- للاستخدام الفعلي، تحتاج Vertex AI
- النظام الحالي يستخدم Google AI Studio API فقط
- **الحل:** إبقاء نماذج Gemma معطلة حتى يتم دمج Vertex AI


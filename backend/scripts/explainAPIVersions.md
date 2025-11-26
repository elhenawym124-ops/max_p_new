# شرح إصدارات Gemini API

## ما هو v1beta؟

### v1beta (Beta Version)
- **المعنى:** إصدار تجريبي من API
- **الاستخدام:** للنماذج الجديدة (Gemini 2.5, 2.0, 3)
- **الـ Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **الحالة:** مستقر لكن قد يكون هناك تغييرات

### v1 (Stable Version)
- **المعنى:** الإصدار المستقر
- **الاستخدام:** للنماذج القديمة (Gemini 1.5)
- **الـ Endpoint:** `https://generativelanguage.googleapis.com/v1/models/{model}:generateContent`
- **الحالة:** مستقر تماماً

### v1alpha (Alpha Version)
- **المعنى:** إصدار تجريبي مبكر
- **الاستخدام:** للميزات التجريبية (مثل media_resolution)
- **الحالة:** قد يتغير في أي وقت

## لماذا النماذج الجديدة تحتاج v1beta؟

النماذج الجديدة مثل:
- `gemini-3-pro-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.0-flash`

كلها تستخدم `v1beta` لأنها نماذج جديدة لم تنتقل بعد إلى الإصدار المستقر (v1).

## كيف يعمل الكود؟

الكود يحاول تلقائياً:
1. للنماذج الجديدة: يبدأ بـ `v1beta` → `v1alpha` → `v1`
2. للنماذج القديمة: يبدأ بـ `v1` → `v1beta` → `v1alpha`


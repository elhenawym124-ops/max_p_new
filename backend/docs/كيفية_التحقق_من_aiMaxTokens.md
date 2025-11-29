# ✅ كيفية التحقق من قيمة aiMaxTokens في قاعدة البيانات

**تاريخ الإنشاء:** $(date)

---

## 🔍 الطرق المتاحة للتحقق

### 1. ✅ استخدام API Endpoint (الأسهل)

**Endpoint جديد:**
```
GET /settings/ai/max-tokens-check
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "companyId": "your-company-id",
    "aiMaxTokens": 1280,
    "defaultValue": 2048,
    "actualValue": 1280,
    "lastUpdated": "2024-01-01T12:00:00.000Z",
    "status": "custom"
  }
}
```

**الحالات:**
- `"status": "custom"` - القيمة مخصصة من الواجهة (مثل 1280)
- `"status": "default"` - القيمة الافتراضية (2048)
- `"status": "not_set"` - لم يتم تعيين قيمة (سيستخدم 2048)

---

### 2. ✅ استخدام Script

**تشغيل السكريبت:**
```bash
cd backend
node scripts/check_aiMaxTokens_simple.js
```

**المخرجات:**
```
📊 AI Max Tokens في قاعدة البيانات:

1. الشركة: Company Name
   Company ID: company-id
   aiMaxTokens: 1280
   آخر تحديث: 2024-01-01T12:00:00.000Z
```

---

### 3. ✅ من Logs

**عند توليد رد AI:**
```
🔍 [AI-CONFIG] Using aiMaxTokens from database: 1280 (companyId: company-id)
```

**عند حفظ الإعدادات:**
```
🔍 [AI-SETTINGS-API] Saved aiMaxTokens value: 1280
```

---

### 4. ✅ من قاعدة البيانات مباشرة

**SQL Query:**
```sql
SELECT 
  companyId,
  aiMaxTokens,
  updatedAt
FROM ai_settings
WHERE companyId = 'your-company-id';
```

---

## 📋 ملخص

- **القيمة الافتراضية في الكود:** 2048 tokens
- **القيمة الفعلية:** تأتي من قاعدة البيانات (التي حفظتها من الواجهة)
- **للتحقق:** استخدم API endpoint `/settings/ai/max-tokens-check`

---

**تم إنشاء هذا الملف بواسطة:** AI Assistant  
**التاريخ:** $(date)


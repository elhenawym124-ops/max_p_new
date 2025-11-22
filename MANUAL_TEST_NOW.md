# 🧪 اختبار يدوي سريع - شركة التسويق

## ✅ الخطوات

### 1. تأكد من تشغيل Backend و Frontend
```bash
# Backend يجب أن يعمل على Port 3007
# Frontend يجب أن يعمل على Port 3000
```

### 2. افتح الصفحة
```
http://localhost:3000/advertising/facebook-pixel
```

### 3. افتح Developer Tools
```
اضغط F12
اذهب لـ Console tab
```

### 4. احصل على التوكن
```javascript
// في Console، اكتب:
localStorage.getItem('token')
```
انسخ التوكن (بدون علامات التنصيص)

### 5. اختبر API مباشرة

#### أ. GET - جلب الإعدادات الحالية
```javascript
// في Console، اكتب:
fetch('http://localhost:3007/api/v1/storefront-settings', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('📥 Current settings:', data);
  console.log('📊 Pixel ID:', data.data?.facebookPixelId);
  console.log('📊 Enabled:', data.data?.facebookPixelEnabled);
});
```

#### ب. PUT - حفظ Pixel ID
```javascript
// في Console، اكتب:
fetch('http://localhost:3007/api/v1/storefront-settings', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    facebookPixelEnabled: true,
    facebookPixelId: '252061987690295',
    pixelTrackPageView: true,
    pixelTrackViewContent: true,
    pixelTrackAddToCart: true,
    pixelTrackInitiateCheckout: true,
    pixelTrackPurchase: true,
    pixelTrackSearch: true
  })
})
.then(r => r.json())
.then(data => {
  console.log('💾 Save response:', data);
  if (data.success) {
    console.log('✅ Saved successfully!');
  } else {
    console.log('❌ Save failed:', data.message);
  }
});
```

#### ج. GET مرة أخرى - التحقق من الحفظ
```javascript
// في Console، اكتب:
fetch('http://localhost:3007/api/v1/storefront-settings', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('🔍 Verified settings:', data);
  console.log('📊 Pixel ID:', data.data?.facebookPixelId);
  console.log('📊 Enabled:', data.data?.facebookPixelEnabled);
  
  if (data.data?.facebookPixelId === '252061987690295') {
    console.log('🎉 SUCCESS! Data saved correctly!');
  } else {
    console.log('❌ FAILED! Data not saved');
  }
});
```

---

## 📊 النتائج المتوقعة

### بعد GET الأول:
```javascript
📥 Current settings: { success: true, data: {...} }
📊 Pixel ID: "252061987690295" (أو null إذا لم يُحفظ بعد)
📊 Enabled: true (أو false)
```

### بعد PUT:
```javascript
💾 Save response: { success: true, message: "تم تحديث الإعدادات بنجاح" }
✅ Saved successfully!
```

### بعد GET الثاني (التحقق):
```javascript
🔍 Verified settings: { success: true, data: {...} }
📊 Pixel ID: "252061987690295"
📊 Enabled: true
🎉 SUCCESS! Data saved correctly!
```

---

## 🔍 استكشاف الأخطاء

### خطأ: "Unauthorized" أو 401
```javascript
// التوكن غير صحيح أو منتهي
// سجل خروج ودخول مرة أخرى
```

### خطأ: "Network Error"
```javascript
// Backend غير شغال
// تأكد من أن Backend يعمل على Port 3007
```

### خطأ: 500 Internal Server Error
```javascript
// مشكلة في Backend
// افحص Backend logs في Terminal
```

---

## 🎯 الاختبار الكامل

### نسخ ولصق سريع (All-in-One):
```javascript
// 1. GET current
console.log('📥 Getting current settings...');
fetch('http://localhost:3007/api/v1/storefront-settings', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
})
.then(r => r.json())
.then(data => {
  console.log('Current:', data.data?.facebookPixelId);
  
  // 2. PUT update
  console.log('💾 Saving...');
  return fetch('http://localhost:3007/api/v1/storefront-settings', {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      facebookPixelEnabled: true,
      facebookPixelId: '252061987690295',
      pixelTrackPageView: true,
      pixelTrackViewContent: true,
      pixelTrackAddToCart: true
    })
  });
})
.then(r => r.json())
.then(data => {
  console.log('Save result:', data.success ? '✅' : '❌');
  
  // 3. GET verify
  console.log('🔍 Verifying...');
  return fetch('http://localhost:3007/api/v1/storefront-settings', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
})
.then(r => r.json())
.then(data => {
  console.log('Verified:', data.data?.facebookPixelId);
  if (data.data?.facebookPixelId === '252061987690295') {
    console.log('🎉 SUCCESS!');
  } else {
    console.log('❌ FAILED!');
  }
});
```

---

## ✅ Checklist

- [ ] Backend يعمل
- [ ] Frontend يعمل
- [ ] مسجل دخول
- [ ] Console مفتوح
- [ ] نسخت الكود أعلاه
- [ ] لصقته في Console
- [ ] ضغطت Enter
- [ ] رأيت "🎉 SUCCESS!"

---

**🚀 جرب الآن!**

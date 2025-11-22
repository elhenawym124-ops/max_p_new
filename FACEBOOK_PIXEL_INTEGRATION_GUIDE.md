# 🔗 دليل ربط Facebook Pixel بالموقع

## 📋 الخطوات الكاملة من البداية للنهاية

---

## 1️⃣ الإعداد في Facebook

### أ. إنشاء Pixel
1. اذهب إلى [Facebook Events Manager](https://business.facebook.com/events_manager2)
2. اضغط **Connect Data Sources** → **Web**
3. اختر **Facebook Pixel** → **Connect**
4. أدخل اسم Pixel (مثال: "متجر أحمد")
5. اضغط **Create Pixel**
6. **انسخ Pixel ID** (15 رقم) - مثال: `123456789012345`

### ب. إنشاء Access Token
1. اذهب إلى [Business Settings](https://business.facebook.com/settings)
2. **System Users** → **Add**
3. أدخل اسم (مثال: "API User")
4. اختر Role: **Admin**
5. اضغط **Create System User**
6. اضغط **Generate New Token**
7. اختر App (أو أنشئ app جديد)
8. اختر Permissions:
   - ✅ `ads_management`
   - ✅ `business_management`
9. **انسخ Access Token** (يبدأ بـ `EAA...`)

### ج. ربط Pixel بـ System User
1. في **System Users** → اختر المستخدم
2. **Assign Assets** → **Pixels**
3. اختر Pixel الخاص بك
4. اختر Permission: **Full Control**
5. اضغط **Save Changes**

---

## 2️⃣ الإعداد في موقعك

### أ. تطبيق Migration
```bash
cd backend
npx prisma db push
```

### ب. تشغيل المشروع
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### ج. إدخال البيانات في الموقع
1. افتح المتصفح: `http://localhost:3000`
2. سجل دخول
3. من القائمة الجانبية → **إدارة الإعلانات** 🎯
4. اضغط **Facebook Pixel & CAPI**

#### إعدادات Pixel
```
☑ تفعيل Facebook Pixel
📝 Pixel ID: 123456789012345
☑ PageView
☑ ViewContent
☑ AddToCart
☑ InitiateCheckout
☑ Purchase
☑ Search
```

#### إعدادات CAPI
```
☑ تفعيل Conversions API
🔑 Access Token: EAAxxxxxxxxxxxxxxxxx
🧪 Test Event Code: TEST12345 (اختياري)
☑ جميع الأحداث
```

#### الإعدادات المتقدمة
```
☑ Event Deduplication: مفعّل
🎯 Event Match Quality Target: 8
☑ GDPR Compliant: مفعّل
☑ Hash User Data: مفعّل
```

5. اضغط **اختبار الاتصال**
6. انتظر النتيجة: ✅ "الاتصال ناجح"
7. اضغط **حفظ الإعدادات**

---

## 3️⃣ دمج Pixel في الواجهة العامة

### أ. تحديث StorefrontLayout
افتح `frontend/src/components/layout/StorefrontLayout.tsx`:

```typescript
import { useFacebookPixel } from '../../hooks/useFacebookPixel';
import { useEffect } from 'react';
import { trackPageView } from '../../utils/facebookPixel';

const StorefrontLayout = ({ children }: { children: React.ReactNode }) => {
  const companyId = 'YOUR_COMPANY_ID'; // احصل عليه من URL أو Context
  
  // تحميل Pixel تلقائياً
  const { isLoaded } = useFacebookPixel(companyId);
  
  // Track PageView عند تحميل أي صفحة
  useEffect(() => {
    if (isLoaded) {
      trackPageView();
    }
  }, [isLoaded, window.location.pathname]);
  
  return (
    <div>
      {/* ... باقي الكود */}
      {children}
    </div>
  );
};
```

### ب. تحديث ProductDetails (عرض منتج)
افتح `frontend/src/pages/storefront/ProductDetails.tsx`:

```typescript
import { useEffect } from 'react';
import { trackViewContent } from '../../utils/facebookPixel';

const ProductDetails = () => {
  const product = /* ... جلب المنتج */;
  
  useEffect(() => {
    if (product) {
      trackViewContent({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category
      });
    }
  }, [product]);
  
  return (
    // ... باقي الكود
  );
};
```

### ج. تحديث Cart (إضافة للسلة)
افتح `frontend/src/pages/storefront/Cart.tsx`:

```typescript
import { trackAddToCart } from '../../utils/facebookPixel';

const handleAddToCart = (product) => {
  // إضافة المنتج للسلة
  addToCart(product);
  
  // Track الحدث
  trackAddToCart({
    id: product.id,
    name: product.name,
    price: product.price,
    quantity: product.quantity
  });
};
```

### د. تحديث Checkout (بدء الشراء)
افتح `frontend/src/pages/storefront/Checkout.tsx`:

```typescript
import { useEffect } from 'react';
import { trackInitiateCheckout } from '../../utils/facebookPixel';

const Checkout = () => {
  const cart = /* ... جلب السلة */;
  
  useEffect(() => {
    if (cart && cart.items.length > 0) {
      trackInitiateCheckout({
        items: cart.items.map(item => ({
          id: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        total: cart.total
      });
    }
  }, []);
  
  return (
    // ... باقي الكود
  );
};
```

### هـ. تحديث OrderConfirmation (إتمام الطلب) - الأهم!
افتح `frontend/src/pages/storefront/OrderConfirmation.tsx`:

```typescript
import { useEffect } from 'react';
import { trackPurchase } from '../../utils/facebookPixel';

const OrderConfirmation = () => {
  const order = /* ... جلب الطلب */;
  
  useEffect(() => {
    if (order) {
      trackPurchase({
        orderNumber: order.orderNumber,
        items: order.items.map(item => ({
          id: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        total: order.total
      });
    }
  }, [order]);
  
  return (
    <div>
      <h1>✅ تم إتمام طلبك بنجاح!</h1>
      {/* ... باقي الكود */}
    </div>
  );
};
```

---

## 4️⃣ الاختبار

### أ. اختبار في المتصفح
1. افتح `http://localhost:3000/shop`
2. افتح **Developer Tools** (F12)
3. اذهب إلى **Console**
4. يجب أن ترى:
```
✅ [Facebook Pixel] Initialized with ID: 123456789012345
📊 [Facebook Pixel] PageView tracked { eventId: "..." }
```

### ب. اختبار في Facebook
1. افتح [Events Manager](https://business.facebook.com/events_manager2)
2. اختر Pixel الخاص بك
3. اذهب إلى **Test Events**
4. في موقعك، قم بـ:
   - ✅ زيارة صفحة منتج
   - ✅ إضافة منتج للسلة
   - ✅ بدء عملية الشراء
5. في Facebook، يجب أن ترى الأحداث تظهر فوراً

### ج. التحقق من Event Match Quality
1. في Events Manager → **Diagnostics**
2. **Event Match Quality**
3. يجب أن ترى درجة **7-9/10** ✅

---

## 5️⃣ كيف يعمل النظام؟

### الآن عندما يزور عميل موقعك:

#### 1. تحميل الصفحة
```
المتصفح → يحمل Pixel Script تلقائياً
         → يرسل PageView لـ Facebook
```

#### 2. عرض منتج
```
المستخدم → يفتح صفحة منتج
         → Pixel يرسل ViewContent
         → Facebook يسجل: "هذا الشخص مهتم بهذا المنتج"
```

#### 3. إضافة للسلة
```
المستخدم → يضيف منتج للسلة
         → Pixel يرسل AddToCart
         → Facebook يسجل: "هذا الشخص جاهز للشراء"
```

#### 4. إتمام الطلب (الأهم!)
```
المستخدم → يتم الطلب
         → Pixel يرسل Purchase (Browser)
         → CAPI يرسل Purchase (Server)
         → Facebook يطابق الحدثين (Deduplication)
         → Facebook يسجل: "هذا الشخص اشترى بقيمة X جنيه"
```

---

## 6️⃣ ماذا يحدث في Facebook؟

### بعد جمع البيانات
```
Facebook يحلل:
├─ من الذي اشترى؟
├─ ما هي اهتماماته؟
├─ كم أنفق؟
└─ متى اشترى؟

ثم يستخدم هذه البيانات في:
├─ Lookalike Audiences (جمهور مشابه)
├─ Retargeting (إعادة الاستهداف)
├─ Dynamic Ads (إعلانات ديناميكية)
└─ Conversion Optimization (تحسين التحويلات)
```

---

## 7️⃣ استكشاف الأخطاء

### ❌ "Pixel لا يظهر في Console"
**الحل:**
1. تأكد من تفعيل Pixel في الإعدادات
2. تأكد من صحة Pixel ID
3. افحص Network Tab → ابحث عن `facebook.net`

### ❌ "الأحداث لا تظهر في Facebook"
**الحل:**
1. تأكد من استخدام Test Event Code
2. انتظر 1-2 دقيقة
3. تحقق من أن Pixel ID صحيح

### ❌ "Event Match Quality منخفض"
**الحل:**
1. تأكد من جمع Email + Phone
2. تأكد من إرسال fbc + fbp
3. راجع [EVENT_MATCH_QUALITY_EXPLAINED.md](./EVENT_MATCH_QUALITY_EXPLAINED.md)

---

## 8️⃣ الخطوات التالية

### بعد الإعداد الناجح:
1. ✅ احذف Test Event Code
2. ✅ راقب Event Match Quality يومياً
3. ✅ ابدأ في إنشاء إعلانات Facebook
4. ✅ استخدم Custom Audiences
5. ✅ أنشئ Lookalike Audiences

---

## 🎯 الخلاصة

### الربط يتم على 3 مستويات:

#### 1. Facebook → موقعك (Pixel ID + Token)
```
Facebook يعطيك:
├─ Pixel ID: 123456789012345
└─ Access Token: EAAxxxxxxxxx

أنت تدخلها في:
└─ صفحة الإعدادات
```

#### 2. موقعك → المتصفح (Pixel Script)
```
موقعك يحمل:
└─ Pixel Script تلقائياً في كل صفحة
```

#### 3. المتصفح → Facebook (الأحداث)
```
المتصفح يرسل:
├─ PageView
├─ ViewContent
├─ AddToCart
└─ Purchase → Facebook
```

---

**🎉 الآن موقعك مربوط بالكامل مع Facebook Pixel!**

**📊 النتيجة:** تتبع دقيق 90%+ للزوار والمشتريات

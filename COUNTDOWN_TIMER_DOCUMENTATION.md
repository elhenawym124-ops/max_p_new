# 📅 ميزة العد التنازلي (Countdown Timer) - التوثيق الكامل

## 📋 نظرة عامة

ميزة **العد التنازلي** (Countdown Timer) هي أداة تسويقية تعرض الوقت المتبقي حتى انتهاء عرض خاص أو خصم على منتج. تساعد هذه الميزة في:
- ✅ خلق إحساس بالإلحاح (Urgency)
- ✅ تحفيز العملاء على الشراء بسرعة
- ✅ زيادة معدل التحويل (Conversion Rate)
- ✅ إظهار العروض المحدودة بوقت

---

## 🎯 كيف تعمل الميزة؟

### 1. **المكون الرئيسي** (`CountdownTimer.tsx`)

```typescript
interface CountdownTimerProps {
  endDate: Date | string;  // تاريخ انتهاء العرض
  enabled: boolean;        // تفعيل/إلغاء الميزة
  className?: string;      // تخصيص التصميم
}
```

### 2. **آلية العمل:**

1. **حساب الوقت المتبقي:**
   - يأخذ `endDate` (تاريخ انتهاء العرض)
   - يحسب الفرق بين التاريخ الحالي وتاريخ الانتهاء
   - يحول الفرق إلى: أيام، ساعات، دقائق، ثواني

2. **التحديث التلقائي:**
   - يتم تحديث العد التنازلي كل ثانية (1000ms)
   - يستخدم `setInterval` لتحديث الوقت
   - يتم تنظيف `interval` عند انتهاء الوقت

3. **عرض الوقت:**
   - يعرض: `X يوم` (إذا كان هناك أيام)
   - يعرض: `ساعات:دقائق:ثواني` (مثل: `02:30:45`)
   - يختفي تلقائياً عند انتهاء الوقت

### 3. **أماكن العرض:**

#### أ) **صفحة المنتج** (`ProductDetails.tsx`):
```typescript
{storefrontSettings?.countdownEnabled && 
 storefrontSettings?.countdownShowOnProduct && 
 product.comparePrice && product.comparePrice > currentPrice && (
  <CountdownTimer
    endDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)} // 7 أيام
    enabled={storefrontSettings.countdownEnabled}
  />
)}
```

**الشروط:**
- ✅ `countdownEnabled` مفعل
- ✅ `countdownShowOnProduct` مفعل
- ✅ المنتج لديه `comparePrice` (سعر قبل الخصم)
- ✅ `comparePrice > price` (يوجد خصم فعلي)

#### ب) **صفحة قائمة المنتجات** (`Shop.tsx`):
```typescript
{storefrontSettings?.countdownEnabled && 
 storefrontSettings?.countdownShowOnListing && 
 product.comparePrice && product.comparePrice > product.price && (
  <CountdownTimer
    endDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)} // 7 أيام
    enabled={storefrontSettings.countdownEnabled}
    className="bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs"
  />
)}
```

**الشروط:**
- ✅ `countdownEnabled` مفعل
- ✅ `countdownShowOnListing` مفعل
- ✅ المنتج لديه خصم

---

## ⚙️ الإعدادات (Storefront Settings)

### في قاعدة البيانات (`schema.prisma`):

```prisma
model StorefrontSettings {
  // Countdown Timer Settings
  countdownEnabled       Boolean @default(true)  // تفعيل الميزة
  countdownShowOnProduct Boolean @default(true)  // إظهار في صفحة المنتج
  countdownShowOnListing Boolean @default(false) // إظهار في قائمة المنتجات
}
```

### في واجهة الإعدادات:
- **تفعيل العد التنازلي:** `countdownEnabled`
- **إظهار في صفحة المنتج:** `countdownShowOnProduct`
- **إظهار في قائمة المنتجات:** `countdownShowOnListing`

---

## ⚠️ المشكلة الحالية

### المشكلة:
- **التاريخ ثابت:** يتم استخدام `new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)` (7 أيام من الآن)
- **لا يوجد حقول في المنتج:** لا توجد `saleStartDate` أو `saleEndDate` في schema المنتج
- **كل المنتجات نفس التاريخ:** جميع المنتجات تعرض نفس تاريخ الانتهاء

### الحل المطلوب:
1. **إضافة حقول للمنتج:**
   ```prisma
   model Product {
     saleStartDate DateTime?  // تاريخ بداية العرض
     saleEndDate   DateTime?  // تاريخ انتهاء العرض
   }
   ```

2. **استخدام التاريخ من المنتج:**
   ```typescript
   {product.saleEndDate && (
     <CountdownTimer
       endDate={product.saleEndDate}
       enabled={storefrontSettings.countdownEnabled}
     />
   )}
   ```

---

## 🎨 التصميم

### المظهر:
- **أيقونة:** ساعة حمراء (`ClockIcon`)
- **النص:** "ينتهي العرض خلال:"
- **الوقت:** خلفية حمراء (`bg-red-500`) مع نص أبيض
- **التنسيق:** `XX يوم` (إذا كان هناك أيام) + `ساعات:دقائق:ثواني`

### مثال:
```
🕐 ينتهي العرض خلال: [3 يوم] [02:30:45]
```

---

## 🔧 كيفية الاستخدام

### 1. **تفعيل الميزة:**
- اذهب إلى `/settings/storefront-features`
- فعّل "العد التنازلي" (`countdownEnabled`)
- اختر أين تريد عرضه:
  - ✅ صفحة المنتج (`countdownShowOnProduct`)
  - ✅ قائمة المنتجات (`countdownShowOnListing`)

### 2. **إعداد المنتج:**
- حالياً: الميزة تعمل تلقائياً إذا كان المنتج لديه خصم (`comparePrice > price`)
- المستقبل: يجب إضافة `saleStartDate` و `saleEndDate` للمنتج

---

## 📊 مثال على الكود

### Component:
```typescript
const CountdownTimer: React.FC<CountdownTimerProps> = ({
  endDate,
  enabled,
  className = ''
}) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const calculateTimeLeft = () => {
      const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
      const now = new Date();
      const difference = end.getTime() - now.getTime();

      if (difference <= 0) {
        setExpired(true);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000)
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (newTimeLeft.days === 0 && newTimeLeft.hours === 0 && 
          newTimeLeft.minutes === 0 && newTimeLeft.seconds === 0) {
        setExpired(true);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate, enabled]);

  if (!enabled || expired) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ClockIcon className="h-5 w-5 text-red-500" />
      <span className="text-sm font-semibold text-gray-900">ينتهي العرض خلال:</span>
      <div className="flex items-center gap-2">
        {timeLeft.days > 0 && (
          <div className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
            {timeLeft.days} يوم
          </div>
        )}
        <div className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
          {String(timeLeft.hours).padStart(2, '0')}:
        </div>
        <div className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
          {String(timeLeft.minutes).padStart(2, '0')}:
        </div>
        <div className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
          {String(timeLeft.seconds).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
};
```

---

## 🚀 التحسينات المقترحة

### 1. **إضافة حقول للمنتج:**
```prisma
model Product {
  saleStartDate DateTime?  // تاريخ بداية العرض
  saleEndDate   DateTime?  // تاريخ انتهاء العرض
}
```

### 2. **استخدام التاريخ من المنتج:**
```typescript
{product.saleEndDate && (
  <CountdownTimer
    endDate={product.saleEndDate}
    enabled={storefrontSettings.countdownEnabled}
  />
)}
```

### 3. **التحقق من صحة التاريخ:**
```typescript
{product.saleStartDate && product.saleEndDate && 
 new Date() >= new Date(product.saleStartDate) && 
 new Date() < new Date(product.saleEndDate) && (
  <CountdownTimer
    endDate={product.saleEndDate}
    enabled={storefrontSettings.countdownEnabled}
  />
)}
```

### 4. **إضافة حقول في صفحة إضافة/تعديل المنتج:**
- حقل لتاريخ بداية العرض
- حقل لتاريخ انتهاء العرض
- التحقق من أن تاريخ الانتهاء بعد تاريخ البداية

---

## 📝 ملخص

### ✅ ما يعمل حالياً:
- ✅ الميزة موجودة وتعمل
- ✅ يتم عرض العد التنازلي في صفحة المنتج وقائمة المنتجات
- ✅ يتم تحديث الوقت كل ثانية
- ✅ يختفي تلقائياً عند انتهاء الوقت

### ⚠️ ما يحتاج تحسين:
- ⚠️ التاريخ ثابت (7 أيام من الآن) - يجب أن يكون من المنتج
- ⚠️ لا توجد حقول `saleStartDate` و `saleEndDate` في المنتج
- ⚠️ لا يمكن تخصيص تاريخ مختلف لكل منتج

---

## 🎯 الخلاصة

ميزة **العد التنازلي** هي أداة تسويقية قوية تساعد في:
- خلق إحساس بالإلحاح
- تحفيز العملاء على الشراء
- زيادة معدل التحويل

**لكن** تحتاج إلى تحسين:
- إضافة حقول `saleStartDate` و `saleEndDate` للمنتج
- استخدام التاريخ من المنتج بدلاً من التاريخ الثابت
- إضافة واجهة لإدارة تواريخ العروض

هل تريد مني تطبيق هذه التحسينات؟


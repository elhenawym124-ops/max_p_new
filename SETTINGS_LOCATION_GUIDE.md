# 📍 دليل موقع إعدادات الميزات الجديدة

## 🎯 الموقع الرئيسي

جميع إعدادات الميزات الـ6 المفقودة ستكون في:

**الصفحة:** `frontend/src/pages/settings/StorefrontFeaturesSettings.tsx`  
**الرابط:** `/settings/storefront-features`  
**الاسم في القائمة:** "إعدادات واجهة المتجر"

---

## 📋 هيكل الإعدادات الحالي

الصفحة `StorefrontFeaturesSettings.tsx` تحتوي على **SettingsSection** لكل ميزة:

```
StorefrontFeaturesSettings.tsx
├── Quick View Section
├── Product Comparison Section
├── Wishlist Section
├── Product Reviews Section
├── Product Badges Section
├── Image Zoom Section
├── Product Videos Section
├── Size Guide Section
├── Product Tabs Section
├── Sticky Add to Cart Section
└── Social Sharing Section
```

---

## ➕ الميزات الجديدة - أين ستكون؟

### 1. ❌ Previous/Next Navigation (التنقل بين المنتجات)

**الموقع:** `StorefrontFeaturesSettings.tsx`  
**القسم:** "التنقل بين المنتجات" (قسم جديد)

**الإعدادات المقترحة:**
- `navigationEnabled` - تفعيل/تعطيل
- `navigationType` - نوع التنقل:
  - `sameCategory` - نفس الفئة
  - `allProducts` - جميع المنتجات
- `showNavigationButtons` - إظهار الأزرار
- `keyboardShortcuts` - اختصارات لوحة المفاتيح

---

### 2. ❌ Sold Number Display (عرض عدد المبيعات)

**الموقع:** `StorefrontFeaturesSettings.tsx`  
**القسم:** "عرض عدد المبيعات" (قسم جديد)

**الإعدادات المقترحة:**
- `soldNumberEnabled` - تفعيل/تعطيل
- `soldNumberType` - نوع العدد:
  - `real` - عدد حقيقي من الطلبات
  - `fake` - عدد عشوائي/مزيف
- `soldNumberMin` - الحد الأدنى (للعشوائي)
- `soldNumberMax` - الحد الأقصى (للعشوائي)
- `soldNumberText` - نص العرض (مثل: "تم بيع {count} قطعة")

---

### 3. ⚠️ Variation Color Styles (أنماط اختيار الألوان)

**الموقع:** `StorefrontFeaturesSettings.tsx`  
**القسم:** "أنماط المتغيرات" (قسم جديد) أو إضافة في قسم موجود

**الإعدادات المقترحة:**
- `variantColorStyle` - نمط عرض الألوان:
  - `buttons` - أزرار (موجود حالياً)
  - `circles` - دوائر ملونة
  - `thumbnails` - صور مصغرة
  - `dropdown` - قائمة منسدلة
  - `swatches` - Swatches مع الأسماء
- `variantColorShowName` - إظهار اسم اللون
- `variantColorSize` - حجم العرض (صغير/متوسط/كبير)

---

### 4. ⚠️ Variation Size Styles (أنماط اختيار المقاسات)

**الموقع:** `StorefrontFeaturesSettings.tsx`  
**القسم:** نفس قسم "أنماط المتغيرات"

**الإعدادات المقترحة:**
- `variantSizeStyle` - نمط عرض المقاسات:
  - `buttons` - أزرار (موجود حالياً)
  - `table` - جدول
  - `dropdown` - قائمة منسدلة
  - `grid` - Grid مع الأسماء
- `variantSizeShowGuide` - إظهار دليل المقاسات
- `variantSizeShowStock` - إظهار المخزون

---

### 5. ❌ Stock Progress Bar (شريط تقدم المخزون)

**الموقع:** `StorefrontFeaturesSettings.tsx`  
**القسم:** "شريط تقدم المخزون" (قسم جديد)

**الإعدادات المقترحة:**
- `stockProgressEnabled` - تفعيل/تعطيل
- `stockProgressType` - نوع العرض:
  - `percentage` - نسبة مئوية
  - `count` - عدد القطع
  - `text` - نص (قليل جداً/متوفر/نفذ)
- `stockProgressColors` - ألوان الشريط:
  - `lowColor` - لون المخزون القليل
  - `mediumColor` - لون المخزون المتوسط
  - `highColor` - لون المخزون العالي
- `stockProgressThreshold` - عتبة المخزون القليل

---

### 6. ❌ Security Badges (شارات الأمان)

**الموقع:** `StorefrontFeaturesSettings.tsx`  
**القسم:** "شارات الأمان" (قسم جديد)

**الإعدادات المقترحة:**
- `securityBadgesEnabled` - تفعيل/تعطيل
- `badgeSecurePayment` - شارة "دفع آمن"
- `badgeFreeShipping` - شارة "شحن مجاني"
- `badgeQualityGuarantee` - شارة "ضمان الجودة"
- `badgeCashOnDelivery` - شارة "دفع عند الاستلام"
- `badgeBuyerProtection` - شارة "حماية المشتري"
- `badgeHighRating` - شارة "تقييمات عالية"
- `badgeCustom1` - شارة مخصصة 1
- `badgeCustom2` - شارة مخصصة 2
- `badgeLayout` - تخطيط الشارات (أفقي/عمودي)

---

### 7. ❌ Reasons to Purchase (أسباب الشراء)

**الموقع:** `StorefrontFeaturesSettings.tsx`  
**القسم:** "أسباب الشراء" (قسم جديد)

**الإعدادات المقترحة:**
- `reasonsToPurchaseEnabled` - تفعيل/تعطيل
- `reasonsToPurchaseType` - نوع العرض:
  - `global` - عام لجميع المنتجات
  - `perProduct` - خاص بكل منتج
- `reasonsToPurchaseList` - قائمة الأسباب (Array):
  - `reason1` - "✅ جودة عالية"
  - `reason2` - "✅ توصيل سريع"
  - `reason3` - "✅ ضمان 30 يوم"
  - `reason4` - "✅ دعم فني 24/7"
  - إلخ...
- `reasonsToPurchaseMaxItems` - عدد الأسباب المعروضة
- `reasonsToPurchaseStyle` - نمط العرض (قائمة/أيقونات)

---

### 8. ❌ Online Visitors Count (عرض الزوار المتصلين)

**الموقع:** `StorefrontFeaturesSettings.tsx`  
**القسم:** "عرض الزوار المتصلين" (قسم جديد)

**الإعدادات المقترحة:**
- `onlineVisitorsEnabled` - تفعيل/تعطيل
- `onlineVisitorsType` - نوع العدد:
  - `real` - عدد حقيقي (Real-time tracking)
  - `fake` - عدد عشوائي/مزيف
- `onlineVisitorsMin` - الحد الأدنى (للعشوائي)
- `onlineVisitorsMax` - الحد الأقصى (للعشوائي)
- `onlineVisitorsUpdateInterval` - فترة التحديث (بالثواني)
- `onlineVisitorsText` - نص العرض (مثل: "{count} شخص يشاهدون هذا المنتج الآن")

---

## 📐 هيكل الصفحة بعد الإضافة

```
StorefrontFeaturesSettings.tsx
├── Quick View Section
├── Product Comparison Section
├── Wishlist Section
├── Product Reviews Section
├── Product Badges Section
├── Image Zoom Section
├── Product Videos Section
├── Size Guide Section
├── Product Tabs Section
├── Sticky Add to Cart Section
├── Social Sharing Section
├── 🆕 Navigation Section (Previous/Next)
├── 🆕 Sold Number Display Section
├── 🆕 Variant Styles Section (Color & Size)
├── 🆕 Stock Progress Bar Section
├── 🆕 Security Badges Section
├── 🆕 Reasons to Purchase Section
└── 🆕 Online Visitors Count Section
```

---

## 🗄️ قاعدة البيانات

جميع الإعدادات ستكون في جدول `storefront_settings` في `schema.prisma`:

```prisma
model StorefrontSettings {
  // ... existing fields ...
  
  // Navigation
  navigationEnabled Boolean @default(false)
  navigationType String @default("sameCategory") // "sameCategory" | "allProducts"
  showNavigationButtons Boolean @default(true)
  keyboardShortcuts Boolean @default(true)
  
  // Sold Number
  soldNumberEnabled Boolean @default(false)
  soldNumberType String @default("real") // "real" | "fake"
  soldNumberMin Int @default(10)
  soldNumberMax Int @default(500)
  soldNumberText String @default("تم بيع {count} قطعة")
  
  // Variant Styles
  variantColorStyle String @default("buttons") // "buttons" | "circles" | "thumbnails" | "dropdown" | "swatches"
  variantColorShowName Boolean @default(true)
  variantSizeStyle String @default("buttons") // "buttons" | "table" | "dropdown" | "grid"
  variantSizeShowGuide Boolean @default(false)
  variantSizeShowStock Boolean @default(true)
  
  // Stock Progress
  stockProgressEnabled Boolean @default(false)
  stockProgressType String @default("percentage") // "percentage" | "count" | "text"
  stockProgressLowColor String @default("#ef4444") // red
  stockProgressMediumColor String @default("#f59e0b") // yellow
  stockProgressHighColor String @default("#10b981") // green
  stockProgressThreshold Int @default(10) // عتبة المخزون القليل
  
  // Security Badges
  securityBadgesEnabled Boolean @default(false)
  badgeSecurePayment Boolean @default(true)
  badgeFreeShipping Boolean @default(true)
  badgeQualityGuarantee Boolean @default(true)
  badgeCashOnDelivery Boolean @default(true)
  badgeBuyerProtection Boolean @default(true)
  badgeHighRating Boolean @default(true)
  badgeCustom1 Boolean @default(false)
  badgeCustom1Text String @default("")
  badgeCustom2 Boolean @default(false)
  badgeCustom2Text String @default("")
  badgeLayout String @default("horizontal") // "horizontal" | "vertical"
  
  // Reasons to Purchase
  reasonsToPurchaseEnabled Boolean @default(false)
  reasonsToPurchaseType String @default("global") // "global" | "perProduct"
  reasonsToPurchaseList String @db.Text // JSON array
  reasonsToPurchaseMaxItems Int @default(4)
  reasonsToPurchaseStyle String @default("list") // "list" | "icons"
  
  // Online Visitors
  onlineVisitorsEnabled Boolean @default(false)
  onlineVisitorsType String @default("fake") // "real" | "fake"
  onlineVisitorsMin Int @default(5)
  onlineVisitorsMax Int @default(50)
  onlineVisitorsUpdateInterval Int @default(30) // seconds
  onlineVisitorsText String @default("{count} شخص يشاهدون هذا المنتج الآن")
}
```

---

## 🎨 مثال على الكود

### إضافة قسم جديد في StorefrontFeaturesSettings.tsx:

```tsx
{/* Stock Progress Bar Section */}
<SettingsSection
  title="شريط تقدم المخزون"
  icon={ChartBarIcon}
  enabled={settings.stockProgressEnabled}
  onToggle={(enabled) => updateSetting('stockProgressEnabled', enabled)}
>
  <SelectSetting
    label="نوع العرض"
    value={settings.stockProgressType}
    onChange={(value) => updateSetting('stockProgressType', value)}
    options={[
      { value: 'percentage', label: 'نسبة مئوية' },
      { value: 'count', label: 'عدد القطع' },
      { value: 'text', label: 'نص' },
    ]}
    disabled={!settings.stockProgressEnabled}
  />
  <ToggleSetting
    label="إظهار الألوان"
    value={settings.stockProgressShowColors}
    onChange={(value) => updateSetting('stockProgressShowColors', value)}
    disabled={!settings.stockProgressEnabled}
  />
</SettingsSection>
```

---

## 📍 الملخص

✅ **جميع الإعدادات في مكان واحد:**  
`/settings/storefront-features` → `StorefrontFeaturesSettings.tsx`

✅ **كل ميزة = قسم منفصل (SettingsSection)**

✅ **جميع الإعدادات في جدول واحد:**  
`storefront_settings` في قاعدة البيانات

---

**تاريخ الإنشاء:** 2025-01-23


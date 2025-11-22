# 🧪 خطة اختبار المزايا الجديدة - Storefront Features

## 📋 قائمة المزايا المطلوب اختبارها

### 1. ✅ Quick View (المعاينة السريعة)
- **Component:** `QuickViewModal.tsx`
- **Backend:** `GET /api/v1/public/products/:id/quick`
- **Settings:** `quickViewEnabled`, `quickViewShowAddToCart`, `quickViewShowWishlist`

### 2. ✅ Product Comparison (مقارنة المنتجات)
- **Component:** `ProductComparison.tsx`
- **Backend:** Local Storage
- **Settings:** `comparisonEnabled`, `maxComparisonProducts`, `comparisonShowPrice`, `comparisonShowSpecs`

### 3. ✅ Wishlist (قائمة الأمنيات)
- **Components:** `WishlistButton.tsx`, `WishlistPage.tsx`
- **Backend:** `POST/GET/DELETE /api/v1/public/wishlist`
- **Settings:** `wishlistEnabled`, `wishlistRequireLogin`, `wishlistMaxItems`

### 4. ✅ Advanced Filters (الفلاتر المتقدمة)
- **Component:** `AdvancedFilters.tsx`
- **Backend:** `GET /api/v1/public/products` (with filters)
- **Settings:** `advancedFiltersEnabled`, `filterByPrice`, `filterByRating`, `filterByBrand`, `filterByAttributes`

### 5. ✅ Product Reviews (تقييمات المنتجات)
- **Component:** `ProductReviews.tsx`
- **Backend:** `GET/POST /api/v1/public/products/:id/reviews`
- **Settings:** `reviewsEnabled`, `reviewsRequirePurchase`, `reviewsModerationEnabled`, `reviewsShowRating`, `minRatingToDisplay`

### 6. ✅ Countdown Timer (عداد تنازلي)
- **Component:** `CountdownTimer.tsx`
- **Backend:** Product `saleEndDate`
- **Settings:** `countdownEnabled`, `countdownShowOnProduct`, `countdownShowOnListing`

### 7. ✅ Back in Stock Notifications (إشعارات عودة المنتج)
- **Component:** `BackInStockNotification.tsx`
- **Backend:** `POST /api/v1/public/back-in-stock`
- **Settings:** `backInStockEnabled`, `backInStockNotifyEmail`, `backInStockNotifySMS`

### 8. ✅ Recently Viewed (المنتجات المشاهدة مؤخراً)
- **Component:** `RecentlyViewed.tsx`
- **Backend:** `POST/GET /api/v1/public/recently-viewed`
- **Settings:** `recentlyViewedEnabled`, `recentlyViewedCount`, `recentlyViewedDays`

### 9. ✅ Image Zoom (تكبير الصور)
- **Component:** `ProductImageZoom.tsx`
- **Backend:** None (Frontend only)
- **Settings:** `imageZoomEnabled`, `imageZoomType`

### 10. ✅ Product Videos (فيديوهات المنتجات)
- **Component:** Embedded in `ProductDetails.tsx`
- **Backend:** Product `videos` field
- **Settings:** `productVideosEnabled`, `videoAutoplay`, `videoShowControls`

### 11. ✅ Size Guide (دليل المقاسات)
- **Component:** Embedded in `ProductDetails.tsx`
- **Backend:** Product `sizeGuide` field
- **Settings:** `sizeGuideEnabled`, `sizeGuideShowOnProduct`

### 12. ✅ Social Sharing (مشاركة اجتماعية)
- **Component:** `SocialSharing.tsx`
- **Backend:** None (Frontend only)
- **Settings:** `socialSharingEnabled`, `shareFacebook`, `shareTwitter`, `shareWhatsApp`, `shareTelegram`

### 13. ✅ Product Badges (شارات المنتجات)
- **Component:** `ProductBadges.tsx`
- **Backend:** Product fields (new, bestSeller, onSale, outOfStock)
- **Settings:** `badgesEnabled`, `badgeNew`, `badgeBestSeller`, `badgeOnSale`, `badgeOutOfStock`

### 14. ✅ Product Tabs (تبويبات المنتجات)
- **Component:** `ProductTabs.tsx`
- **Backend:** Product fields (description, specifications, reviews, shipping)
- **Settings:** `tabsEnabled`, `tabDescription`, `tabSpecifications`, `tabReviews`, `tabShipping`

### 15. ✅ Sticky Add to Cart (زر إضافة للسلة ثابت)
- **Component:** `StickyAddToCart.tsx`
- **Backend:** Cart API
- **Settings:** `stickyAddToCartEnabled`, `stickyShowOnMobile`, `stickyShowOnDesktop`

### 16. ✅ SEO Settings (إعدادات SEO)
- **Utility:** `utils/seo.ts`
- **Backend:** None (Frontend only)
- **Settings:** `seoEnabled`, `seoMetaDescription`, `seoStructuredData`, `seoSitemap`, `seoOpenGraph`

### 17. ✅ Multi-language Support (دعم متعدد اللغات)
- **Component:** `LanguageSwitcher.tsx`
- **Backend:** None (Frontend only - Local Storage)
- **Settings:** `multiLanguageEnabled`, `defaultLanguage`, `supportedLanguages`

---

## 🧪 خطوات الاختبار

### المرحلة 1: اختبار Backend APIs

#### 1.1 Storefront Settings API
```bash
# GET Settings
GET /api/v1/storefront-settings
# Expected: 200, { success: true, data: {...} }

# PUT Settings
PUT /api/v1/storefront-settings
Body: { quickViewEnabled: true, ... }
# Expected: 200, { success: true, data: {...} }

# GET Public Settings
GET /api/v1/public/storefront-settings/:companyId
# Expected: 200, { success: true, data: {...} }
```

#### 1.2 Quick View API
```bash
# GET Quick View
GET /api/v1/public/products/:id/quick
# Expected: 200, { success: true, data: { id, name, price, images, ... } }
```

#### 1.3 Wishlist API
```bash
# POST Add to Wishlist
POST /api/v1/public/wishlist
Body: { productId, sessionId }
# Expected: 200, { success: true, data: {...} }

# GET Wishlist
GET /api/v1/public/wishlist?sessionId=xxx
# Expected: 200, { success: true, data: [...] }

# DELETE Remove from Wishlist
DELETE /api/v1/public/wishlist/:id
# Expected: 200, { success: true }
```

#### 1.4 Product Reviews API
```bash
# GET Reviews
GET /api/v1/public/products/:id/reviews
# Expected: 200, { success: true, data: [...] }

# POST Create Review
POST /api/v1/public/products/:id/reviews
Body: { rating, comment, customerName, ... }
# Expected: 200, { success: true, data: {...} }
```

#### 1.5 Back in Stock API
```bash
# POST Subscribe
POST /api/v1/public/back-in-stock
Body: { productId, customerName, customerEmail, ... }
# Expected: 200, { success: true }
```

#### 1.6 Recently Viewed API
```bash
# POST Record View
POST /api/v1/public/recently-viewed
Body: { productId, sessionId }
# Expected: 200, { success: true }

# GET Recently Viewed
GET /api/v1/public/recently-viewed?sessionId=xxx
# Expected: 200, { success: true, data: [...] }
```

### المرحلة 2: اختبار Frontend Components

#### 2.1 Settings Page
- [ ] فتح `/settings/storefront-features`
- [ ] التحقق من تحميل الإعدادات
- [ ] تفعيل/إلغاء تفعيل كل ميزة
- [ ] حفظ الإعدادات
- [ ] إعادة تعيين الإعدادات

#### 2.2 Shop Page (`/shop`)
- [ ] عرض المنتجات
- [ ] Quick View (عند النقر على "معاينة سريعة")
- [ ] Advanced Filters (فتح/إغلاق، تطبيق فلاتر)
- [ ] Product Comparison (إضافة منتجات للمقارنة)
- [ ] Product Badges (عرض الشارات)
- [ ] Countdown Timer (على المنتجات في العرض)
- [ ] Recently Viewed (في الأسفل)

#### 2.3 Product Details Page (`/shop/products/:id`)
- [ ] Product Image Zoom (hover/click)
- [ ] Product Videos (تشغيل/إيقاف)
- [ ] Size Guide (فتح/إغلاق)
- [ ] Wishlist Button (إضافة/إزالة)
- [ ] Product Reviews (عرض/إضافة تقييم)
- [ ] Countdown Timer (إذا كان المنتج في عرض)
- [ ] Back in Stock (إذا كان المنتج غير متوفر)
- [ ] Social Sharing (مشاركة على الشبكات)
- [ ] Product Badges (عرض الشارات)
- [ ] Product Tabs (التبديل بين التبويبات)
- [ ] Sticky Add to Cart (عند التمرير لأسفل)

#### 2.4 Wishlist Page (`/shop/wishlist`)
- [ ] عرض المنتجات في المفضلة
- [ ] إزالة منتج من المفضلة
- [ ] إضافة منتج للسلة من المفضلة

#### 2.5 Navigation (`StorefrontNav`)
- [ ] Language Switcher (تغيير اللغة)
- [ ] Cart Icon (عرض عدد المنتجات)
- [ ] Cart Preview (عند hover)

### المرحلة 3: اختبار التكامل

#### 3.1 Settings → Components
- [ ] تعطيل Quick View → التحقق من عدم ظهوره
- [ ] تعطيل Wishlist → التحقق من إخفاء الأزرار
- [ ] تعطيل Comparison → التحقق من إخفاء الأزرار
- [ ] تعطيل Reviews → التحقق من إخفاء القسم
- [ ] تعطيل Filters → التحقق من إخفاء الفلاتر

#### 3.2 Data Flow
- [ ] إضافة منتج للمفضلة → التحقق من ظهوره في صفحة المفضلة
- [ ] إضافة منتج للمقارنة → التحقق من ظهوره في نافذة المقارنة
- [ ] عرض منتج → التحقق من ظهوره في Recently Viewed
- [ ] إضافة تقييم → التحقق من ظهوره في قائمة التقييمات

### المرحلة 4: اختبار Edge Cases

#### 4.1 Error Handling
- [ ] API Error (500) → عرض رسالة خطأ
- [ ] Network Error → عرض رسالة خطأ
- [ ] Invalid Data → التحقق من التحقق من البيانات

#### 4.2 Limits
- [ ] Wishlist Max Items → التحقق من الحد الأقصى
- [ ] Comparison Max Products → التحقق من الحد الأقصى
- [ ] Recently Viewed Count → التحقق من العدد

#### 4.3 Guest vs Authenticated
- [ ] Guest User → التحقق من عمل المزايا بدون تسجيل دخول
- [ ] Authenticated User → التحقق من عمل المزايا مع تسجيل دخول

---

## 📝 سجل الاختبار

### ✅ Backend APIs
- [ ] Storefront Settings API
- [ ] Quick View API
- [ ] Wishlist API
- [ ] Product Reviews API
- [ ] Back in Stock API
- [ ] Recently Viewed API

### ✅ Frontend Components
- [ ] Settings Page
- [ ] Shop Page
- [ ] Product Details Page
- [ ] Wishlist Page
- [ ] Navigation

### ✅ Integration
- [ ] Settings → Components
- [ ] Data Flow

### ✅ Edge Cases
- [ ] Error Handling
- [ ] Limits
- [ ] Guest vs Authenticated

---

## 🐛 المشاكل المكتشفة

### Backend
- [ ] 

### Frontend
- [ ] 

### Integration
- [ ] 

---

## ✅ النتيجة النهائية

- **Backend APIs:** ⬜ 0/6
- **Frontend Components:** ⬜ 0/5
- **Integration:** ⬜ 0/2
- **Edge Cases:** ⬜ 0/3

**الإجمالي:** ⬜ 0/16


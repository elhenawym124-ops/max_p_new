const { getSharedPrismaClient } = require('../services/sharedDatabase');

// Helper function to get Prisma client
function getPrisma() {
  return getSharedPrismaClient();
}

/**
 * 🛍️ Controller لإدارة إعدادات واجهة المتجر (Storefront Features)
 */

/**
 * جلب إعدادات واجهة المتجر للشركة
 * GET /api/v1/storefront-settings
 */
exports.getStorefrontSettings = async (req, res) => {
  try {
    // Debug: Log request details
    console.log('🔍 [STOREFRONT-SETTINGS] ===== Request received =====');
    console.log('🔍 [STOREFRONT-SETTINGS] Method:', req.method);
    console.log('🔍 [STOREFRONT-SETTINGS] Path:', req.path);
    console.log('🔍 [STOREFRONT-SETTINGS] req.user exists:', !!req.user);
    
    if (req.user) {
      console.log('🔍 [STOREFRONT-SETTINGS] req.user.id:', req.user.id);
      console.log('🔍 [STOREFRONT-SETTINGS] req.user.email:', req.user.email);
      console.log('🔍 [STOREFRONT-SETTINGS] req.user.companyId:', req.user.companyId);
      console.log('🔍 [STOREFRONT-SETTINGS] req.user.role:', req.user.role);
    } else {
      console.error('❌ [STOREFRONT-SETTINGS] req.user is MISSING!');
      console.error('❌ [STOREFRONT-SETTINGS] This should not happen if requireAuth middleware is working');
      console.error('❌ [STOREFRONT-SETTINGS] req.headers.authorization:', req.headers.authorization ? 'exists' : 'missing');
    }
    
    const companyId = req.user?.companyId;
    const prisma = getPrisma();

    console.log('🔍 [STOREFRONT-SETTINGS] Getting settings for company:', companyId);

    if (!companyId) {
      console.error('❌ [STOREFRONT-SETTINGS] Company ID missing.');
      console.error('❌ [STOREFRONT-SETTINGS] req.user:', req.user);
      console.error('❌ [STOREFRONT-SETTINGS] req.user?.companyId:', req.user?.companyId);
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب',
        error: 'Company ID is required. User may not be authenticated properly.',
        debug: {
          hasUser: !!req.user,
          userCompanyId: req.user?.companyId,
          authHeader: !!req.headers.authorization
        }
      });
    }

    // البحث عن الإعدادات
    let settings = null;
    try {
      console.log('🔍 [STOREFRONT-SETTINGS] Searching for settings with companyId:', companyId);
      settings = await prisma.storefrontSettings.findUnique({
        where: { companyId }
      });
      console.log('📊 [STOREFRONT-SETTINGS] Query result:', settings ? 'Found' : 'Not found');
    } catch (findError) {
      console.error('❌ [STOREFRONT-SETTINGS] Error finding settings:', findError);
      console.error('❌ [STOREFRONT-SETTINGS] Error message:', findError.message);
      console.error('❌ [STOREFRONT-SETTINGS] Error stack:', findError.stack);
      // لا نرمي الخطأ هنا، بل نحاول إنشاء إعدادات جديدة
    }

    console.log('📊 [STOREFRONT-SETTINGS] Found settings:', settings ? 'Yes' : 'No');

    // إذا لم توجد إعدادات، إنشاء إعدادات افتراضية
    if (!settings) {
      console.log('🔨 [STOREFRONT-SETTINGS] Creating default settings for companyId:', companyId);
      try {
        settings = await prisma.storefrontSettings.create({
          data: {
            companyId,
            // جميع القيم الافتراضية موجودة في Schema
            // لكن يجب توفير supportedLanguages لأنه Json field (required)
            supportedLanguages: ["ar"] // القيمة الافتراضية - يجب أن يكون array
          }
        });
        console.log('✅ [STOREFRONT-SETTINGS] Settings created successfully with supportedLanguages:', settings.supportedLanguages);
        console.log('✅ [STOREFRONT-SETTINGS] Created settings:', settings.id);
      } catch (createError) {
        console.error('❌ [STOREFRONT-SETTINGS] Error creating settings:', createError);
        console.error('❌ [STOREFRONT-SETTINGS] Error code:', createError.code);
        console.error('❌ [STOREFRONT-SETTINGS] Error message:', createError.message);
        console.error('❌ [STOREFRONT-SETTINGS] Error meta:', createError.meta);
        
        // إذا فشل الإنشاء، قد يكون بسبب أن السجل موجود بالفعل (race condition)
        // أو مشكلة في قاعدة البيانات
        if (createError.code === 'P2002') {
          // Unique constraint violation - السجل موجود بالفعل
          console.log('⚠️ [STOREFRONT-SETTINGS] Settings already exist (race condition), fetching...');
          try {
            settings = await prisma.storefrontSettings.findUnique({
              where: { companyId }
            });
            if (settings) {
              console.log('✅ [STOREFRONT-SETTINGS] Found existing settings after race condition');
            }
          } catch (retryError) {
            console.error('❌ [STOREFRONT-SETTINGS] Error on retry:', retryError);
            throw createError; // رمي الخطأ الأصلي
          }
        } else {
          // خطأ آخر - رمي الخطأ
          throw createError;
        }
      }
    }

    if (!settings) {
      console.error('❌ [STOREFRONT-SETTINGS] Settings is still null after all attempts');
      return res.status(500).json({
        success: false,
        message: 'فشل في إنشاء أو جلب الإعدادات',
        error: 'Unable to create or retrieve storefront settings'
      });
    }

    // Ensure boolean values are properly serialized (MySQL may return 0/1 instead of true/false)
    const serializedSettings = {
      ...settings,
      // Convert any potential numeric booleans (0/1) or string booleans to actual booleans
      quickViewEnabled: Boolean(settings.quickViewEnabled),
      quickViewShowAddToCart: Boolean(settings.quickViewShowAddToCart),
      quickViewShowWishlist: Boolean(settings.quickViewShowWishlist),
      comparisonEnabled: Boolean(settings.comparisonEnabled),
      comparisonShowPrice: Boolean(settings.comparisonShowPrice),
      comparisonShowSpecs: Boolean(settings.comparisonShowSpecs),
      wishlistEnabled: Boolean(settings.wishlistEnabled),
      wishlistRequireLogin: Boolean(settings.wishlistRequireLogin),
      advancedFiltersEnabled: Boolean(settings.advancedFiltersEnabled),
      filterByPrice: Boolean(settings.filterByPrice),
      filterByRating: Boolean(settings.filterByRating),
      filterByBrand: Boolean(settings.filterByBrand),
      filterByAttributes: Boolean(settings.filterByAttributes),
      reviewsEnabled: Boolean(settings.reviewsEnabled),
      reviewsRequirePurchase: Boolean(settings.reviewsRequirePurchase),
      reviewsModerationEnabled: Boolean(settings.reviewsModerationEnabled),
      reviewsShowRating: Boolean(settings.reviewsShowRating),
      countdownEnabled: Boolean(settings.countdownEnabled),
      countdownShowOnProduct: Boolean(settings.countdownShowOnProduct),
      countdownShowOnListing: Boolean(settings.countdownShowOnListing),
      backInStockEnabled: Boolean(settings.backInStockEnabled),
      backInStockNotifyEmail: Boolean(settings.backInStockNotifyEmail),
      backInStockNotifySMS: Boolean(settings.backInStockNotifySMS),
      recentlyViewedEnabled: Boolean(settings.recentlyViewedEnabled),
      imageZoomEnabled: Boolean(settings.imageZoomEnabled),
      productVideosEnabled: Boolean(settings.productVideosEnabled),
      videoAutoplay: Boolean(settings.videoAutoplay),
      videoShowControls: Boolean(settings.videoShowControls),
      sizeGuideEnabled: Boolean(settings.sizeGuideEnabled),
      sizeGuideShowOnProduct: Boolean(settings.sizeGuideShowOnProduct),
      socialSharingEnabled: Boolean(settings.socialSharingEnabled),
      shareFacebook: Boolean(settings.shareFacebook),
      shareTwitter: Boolean(settings.shareTwitter),
      shareWhatsApp: Boolean(settings.shareWhatsApp),
      shareTelegram: Boolean(settings.shareTelegram),
      badgesEnabled: Boolean(settings.badgesEnabled),
      badgeNew: Boolean(settings.badgeNew),
      badgeBestSeller: Boolean(settings.badgeBestSeller),
      badgeOnSale: Boolean(settings.badgeOnSale),
      badgeOutOfStock: Boolean(settings.badgeOutOfStock),
      tabsEnabled: Boolean(settings.tabsEnabled),
      tabDescription: Boolean(settings.tabDescription),
      tabSpecifications: Boolean(settings.tabSpecifications),
      tabReviews: Boolean(settings.tabReviews),
      tabShipping: Boolean(settings.tabShipping),
      stickyAddToCartEnabled: Boolean(settings.stickyAddToCartEnabled),
      stickyShowOnMobile: Boolean(settings.stickyShowOnMobile),
      stickyShowOnDesktop: Boolean(settings.stickyShowOnDesktop),
      stickyScrollThreshold: parseInt(settings.stickyScrollThreshold) || 300,
      stickyShowBuyNow: Boolean(settings.stickyShowBuyNow !== false),
      stickyShowAddToCartButton: Boolean(settings.stickyShowAddToCartButton !== false),
      stickyShowQuantity: Boolean(settings.stickyShowQuantity !== false),
      stickyShowProductImage: Boolean(settings.stickyShowProductImage !== false),
      stickyShowProductName: Boolean(settings.stickyShowProductName !== false),
      stickyTrackAnalytics: Boolean(settings.stickyTrackAnalytics !== false),
      stickyAutoScrollToCheckout: Boolean(settings.stickyAutoScrollToCheckout === true),
      // Product Navigation Settings
      navigationEnabled: Boolean(settings.navigationEnabled === true),
      navigationType: settings.navigationType || 'sameCategory',
      showNavigationButtons: Boolean(settings.showNavigationButtons !== false),
      keyboardShortcuts: Boolean(settings.keyboardShortcuts !== false),
      // Sold Number Display Settings
      soldNumberEnabled: Boolean(settings.soldNumberEnabled === true),
      soldNumberType: settings.soldNumberType || 'real',
      soldNumberMin: parseInt(settings.soldNumberMin) || 10,
      soldNumberMax: parseInt(settings.soldNumberMax) || 500,
      soldNumberText: settings.soldNumberText || 'تم بيع {count} قطعة',
      // Variant Styles Settings
      variantColorStyle: settings.variantColorStyle || 'buttons',
      variantColorShowName: Boolean(settings.variantColorShowName !== false),
      variantColorSize: settings.variantColorSize || 'medium',
      variantSizeStyle: settings.variantSizeStyle || 'buttons',
      variantSizeShowGuide: Boolean(settings.variantSizeShowGuide === true),
      variantSizeShowStock: Boolean(settings.variantSizeShowStock !== false),
      // Stock Progress Bar Settings
      stockProgressEnabled: Boolean(settings.stockProgressEnabled === true),
      stockProgressType: settings.stockProgressType || 'percentage',
      stockProgressLowColor: settings.stockProgressLowColor || '#ef4444',
      stockProgressMediumColor: settings.stockProgressMediumColor || '#f59e0b',
      stockProgressHighColor: settings.stockProgressHighColor || '#10b981',
      stockProgressThreshold: parseInt(settings.stockProgressThreshold) || 10,
      // Security Badges Settings
      securityBadgesEnabled: Boolean(settings.securityBadgesEnabled === true),
      badgeSecurePayment: Boolean(settings.badgeSecurePayment !== false),
      badgeFreeShipping: Boolean(settings.badgeFreeShipping !== false),
      badgeQualityGuarantee: Boolean(settings.badgeQualityGuarantee !== false),
      badgeCashOnDelivery: Boolean(settings.badgeCashOnDelivery !== false),
      badgeBuyerProtection: Boolean(settings.badgeBuyerProtection !== false),
      badgeHighRating: Boolean(settings.badgeHighRating !== false),
      badgeCustom1: Boolean(settings.badgeCustom1 === true),
      badgeCustom1Text: settings.badgeCustom1Text || null,
      badgeCustom2: Boolean(settings.badgeCustom2 === true),
      badgeCustom2Text: settings.badgeCustom2Text || null,
      badgeLayout: settings.badgeLayout || 'horizontal',
      // Reasons to Purchase Settings
      reasonsToPurchaseEnabled: Boolean(settings.reasonsToPurchaseEnabled === true),
      reasonsToPurchaseType: settings.reasonsToPurchaseType || 'global',
      reasonsToPurchaseList: settings.reasonsToPurchaseList || null,
      reasonsToPurchaseMaxItems: parseInt(settings.reasonsToPurchaseMaxItems) || 4,
      reasonsToPurchaseStyle: settings.reasonsToPurchaseStyle || 'list',
      // Online Visitors Count Settings
      onlineVisitorsEnabled: Boolean(settings.onlineVisitorsEnabled === true),
      onlineVisitorsType: settings.onlineVisitorsType || 'fake',
      onlineVisitorsMin: parseInt(settings.onlineVisitorsMin) || 5,
      onlineVisitorsMax: parseInt(settings.onlineVisitorsMax) || 50,
      onlineVisitorsUpdateInterval: parseInt(settings.onlineVisitorsUpdateInterval) || 30,
      onlineVisitorsText: settings.onlineVisitorsText || '{count} شخص يشاهدون هذا المنتج الآن',
      // Estimated Delivery Time Settings
      estimatedDeliveryEnabled: Boolean(settings.estimatedDeliveryEnabled === true),
      estimatedDeliveryShowOnProduct: Boolean(settings.estimatedDeliveryShowOnProduct !== false),
      estimatedDeliveryDefaultText: settings.estimatedDeliveryDefaultText || 'التوصيل خلال {time}',
      // FOMO Popup Settings
      fomoEnabled: Boolean(settings.fomoEnabled === true),
      fomoType: settings.fomoType || 'soldCount',
      fomoTrigger: settings.fomoTrigger || 'time',
      fomoDelay: parseInt(settings.fomoDelay) || 30,
      fomoShowOncePerSession: Boolean(settings.fomoShowOncePerSession !== false),
      fomoMessage: settings.fomoMessage || null,
      seoEnabled: Boolean(settings.seoEnabled),
      seoMetaDescription: Boolean(settings.seoMetaDescription),
      seoStructuredData: Boolean(settings.seoStructuredData),
      seoSitemap: Boolean(settings.seoSitemap),
      seoOpenGraph: Boolean(settings.seoOpenGraph),
      multiLanguageEnabled: Boolean(settings.multiLanguageEnabled),
      // Facebook Pixel Settings
      facebookPixelEnabled: Boolean(settings.facebookPixelEnabled),
      facebookPixelId: settings.facebookPixelId || null,
      pixelTrackPageView: Boolean(settings.pixelTrackPageView),
      pixelTrackViewContent: Boolean(settings.pixelTrackViewContent),
      pixelTrackAddToCart: Boolean(settings.pixelTrackAddToCart),
      pixelTrackInitiateCheckout: Boolean(settings.pixelTrackInitiateCheckout),
      pixelTrackPurchase: Boolean(settings.pixelTrackPurchase),
      pixelTrackSearch: Boolean(settings.pixelTrackSearch),
      pixelTrackAddToWishlist: Boolean(settings.pixelTrackAddToWishlist),
      // Facebook Conversions API Settings
      facebookConvApiEnabled: Boolean(settings.facebookConvApiEnabled),
      facebookConvApiToken: settings.facebookConvApiToken || null,
      facebookConvApiTestCode: settings.facebookConvApiTestCode || null,
      capiTrackPageView: Boolean(settings.capiTrackPageView),
      capiTrackViewContent: Boolean(settings.capiTrackViewContent),
      capiTrackAddToCart: Boolean(settings.capiTrackAddToCart),
      capiTrackInitiateCheckout: Boolean(settings.capiTrackInitiateCheckout),
      capiTrackPurchase: Boolean(settings.capiTrackPurchase),
      capiTrackSearch: Boolean(settings.capiTrackSearch),
      // Advanced Settings
      eventDeduplicationEnabled: Boolean(settings.eventDeduplicationEnabled),
      eventMatchQualityTarget: settings.eventMatchQualityTarget ? parseInt(settings.eventMatchQualityTarget) : 8,
      gdprCompliant: Boolean(settings.gdprCompliant),
      hashUserData: Boolean(settings.hashUserData),
      lastPixelTest: settings.lastPixelTest || null,
      lastCapiTest: settings.lastCapiTest || null,
      pixelStatus: settings.pixelStatus || 'not_configured',
      capiStatus: settings.capiStatus || 'not_configured'
    };

    console.log('✅ [STOREFRONT-SETTINGS] Returning settings with booleans:', {
      id: serializedSettings.id,
      quickViewEnabled: serializedSettings.quickViewEnabled,
      comparisonEnabled: serializedSettings.comparisonEnabled,
      wishlistEnabled: serializedSettings.wishlistEnabled,
      reviewsEnabled: serializedSettings.reviewsEnabled,
      facebookPixelEnabled: serializedSettings.facebookPixelEnabled
    });

    return res.status(200).json({
      success: true,
      data: serializedSettings
    });
  } catch (error) {
    console.error('❌ [STOREFRONT-SETTINGS] Error fetching settings:', error);
    console.error('❌ [STOREFRONT-SETTINGS] Error name:', error.name);
    console.error('❌ [STOREFRONT-SETTINGS] Error message:', error.message);
    console.error('❌ [STOREFRONT-SETTINGS] Error code:', error.code);
    console.error('❌ [STOREFRONT-SETTINGS] Error stack:', error.stack);
    if (error.meta) {
      console.error('❌ [STOREFRONT-SETTINGS] Error meta:', JSON.stringify(error.meta, null, 2));
    }
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الإعدادات',
      error: error.message,
      errorCode: error.code,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        code: error.code,
        meta: error.meta
      } : undefined
    });
  }
};

/**
 * تحديث إعدادات واجهة المتجر
 * PUT /api/v1/storefront-settings
 */
exports.updateStorefrontSettings = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const settingsData = req.body;
    const prisma = getPrisma();

    console.log('🔄 [STOREFRONT-SETTINGS] Updating settings for company:', companyId);
    console.log('📤 [STOREFRONT-SETTINGS] Data:', settingsData);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    // قائمة الحقول المسموحة
    const allowedFields = [
      // Quick View
      'quickViewEnabled', 'quickViewShowAddToCart', 'quickViewShowWishlist',
      // Comparison
      'comparisonEnabled', 'maxComparisonProducts', 'comparisonShowPrice', 'comparisonShowSpecs',
      // Wishlist
      'wishlistEnabled', 'wishlistRequireLogin', 'wishlistMaxItems',
      // Advanced Filters
      'advancedFiltersEnabled', 'filterByPrice', 'filterByRating', 'filterByBrand', 'filterByAttributes',
      // Reviews
      'reviewsEnabled', 'reviewsRequirePurchase', 'reviewsModerationEnabled', 'reviewsShowRating', 'minRatingToDisplay',
      // Countdown
      'countdownEnabled', 'countdownShowOnProduct', 'countdownShowOnListing',
      // Back in Stock
      'backInStockEnabled', 'backInStockNotifyEmail', 'backInStockNotifySMS',
      // Recently Viewed
      'recentlyViewedEnabled', 'recentlyViewedCount', 'recentlyViewedDays',
      // Image Zoom
      'imageZoomEnabled', 'imageZoomType',
      // Product Videos
      'productVideosEnabled', 'videoAutoplay', 'videoShowControls',
      // Size Guide
      'sizeGuideEnabled', 'sizeGuideShowOnProduct',
      // Social Sharing
      'socialSharingEnabled', 'shareFacebook', 'shareTwitter', 'shareWhatsApp', 'shareTelegram',
      // Badges
      'badgesEnabled', 'badgeNew', 'badgeBestSeller', 'badgeOnSale', 'badgeOutOfStock',
      // Tabs
      'tabsEnabled', 'tabDescription', 'tabSpecifications', 'tabReviews', 'tabShipping',
      // Sticky Add to Cart
      'stickyAddToCartEnabled', 'stickyShowOnMobile', 'stickyShowOnDesktop',
      'stickyScrollThreshold', 'stickyShowBuyNow', 'stickyShowAddToCartButton', 
      'stickyShowQuantity', 'stickyShowProductImage', 'stickyShowProductName',
      'stickyTrackAnalytics', 'stickyAutoScrollToCheckout',
      // Product Navigation
      'navigationEnabled', 'navigationType', 'showNavigationButtons', 'keyboardShortcuts',
      // Sold Number Display
      'soldNumberEnabled', 'soldNumberType', 'soldNumberMin', 'soldNumberMax', 'soldNumberText',
      // Variant Styles
      'variantColorStyle', 'variantColorShowName', 'variantColorSize',
      'variantSizeStyle', 'variantSizeShowGuide', 'variantSizeShowStock',
      // Stock Progress Bar
      'stockProgressEnabled', 'stockProgressType', 'stockProgressLowColor',
      'stockProgressMediumColor', 'stockProgressHighColor', 'stockProgressThreshold',
      // Security Badges
      'securityBadgesEnabled', 'badgeSecurePayment', 'badgeFreeShipping',
      'badgeQualityGuarantee', 'badgeCashOnDelivery', 'badgeBuyerProtection',
      'badgeHighRating', 'badgeCustom1', 'badgeCustom1Text', 'badgeCustom2', 'badgeCustom2Text', 'badgeLayout',
      // Reasons to Purchase
      'reasonsToPurchaseEnabled', 'reasonsToPurchaseType', 'reasonsToPurchaseList',
      'reasonsToPurchaseMaxItems', 'reasonsToPurchaseStyle',
      // Online Visitors Count
      'onlineVisitorsEnabled', 'onlineVisitorsType', 'onlineVisitorsMin',
      'onlineVisitorsMax', 'onlineVisitorsUpdateInterval', 'onlineVisitorsText',
      // Estimated Delivery Time
      'estimatedDeliveryEnabled', 'estimatedDeliveryShowOnProduct', 'estimatedDeliveryDefaultText',
      // FOMO Popup
      'fomoEnabled', 'fomoType', 'fomoTrigger', 'fomoDelay', 'fomoShowOncePerSession', 'fomoMessage',
      // Product Page Layout Order Settings
      'productPageLayoutEnabled', 'productPageOrder',
      'productPageShowTitle', 'productPageShowCategory', 'productPageShowSocialSharing',
      'productPageShowBadges', 'productPageShowPrice', 'productPageShowCountdown',
      'productPageShowStockStatus', 'productPageShowStockProgress', 'productPageShowBackInStock',
      'productPageShowSecurityBadges', 'productPageShowSoldNumber', 'productPageShowOnlineVisitors',
      'productPageShowEstimatedDelivery', 'productPageShowFreeShipping', 'productPageShowPreOrder',
      'productPageShowVariants', 'productPageShowSizeGuide', 'productPageShowQuantity',
      'productPageShowVolumeDiscounts', 'productPageShowReasonsToPurchase', 'productPageShowActions',
      'productPageShowTabs', 'productPageShowDescription', 'productPageShowSKU', 'productPageShowCheckoutForm',
      // SEO
      'seoEnabled', 'seoMetaDescription', 'seoStructuredData', 'seoSitemap', 'seoOpenGraph',
      // Multi-language
      'multiLanguageEnabled', 'defaultLanguage', 'supportedLanguages',
      // Facebook Pixel
      'facebookPixelEnabled', 'facebookPixelId',
      'pixelTrackPageView', 'pixelTrackViewContent', 'pixelTrackAddToCart',
      'pixelTrackInitiateCheckout', 'pixelTrackPurchase', 'pixelTrackSearch', 'pixelTrackAddToWishlist',
      // Facebook Conversions API
      'facebookConvApiEnabled', 'facebookConvApiToken', 'facebookConvApiTestCode',
      'capiTrackPageView', 'capiTrackViewContent', 'capiTrackAddToCart',
      'capiTrackInitiateCheckout', 'capiTrackPurchase', 'capiTrackSearch',
      // Advanced Settings
      'eventDeduplicationEnabled', 'eventMatchQualityTarget', 'gdprCompliant', 'hashUserData',
      'pixelStatus', 'capiStatus'
    ];

    const updateData = {};
    console.log('🔍 [STOREFRONT-SETTINGS] Processing fields. Total allowed fields:', allowedFields.length);
    console.log('🔍 [STOREFRONT-SETTINGS] Settings data keys:', Object.keys(settingsData));
    
    for (const field of allowedFields) {
      if (settingsData[field] !== undefined) {
        console.log(`🔍 [STOREFRONT-SETTINGS] Processing field: ${field}, type: ${typeof settingsData[field]}, value:`, settingsData[field]);
        // معالجة أنواع البيانات المختلفة
        // IMPORTANT: Check specific fields first before generic patterns
        
        // String fields (must be checked BEFORE Boolean patterns to avoid conversion)
        // List of ALL String fields in StorefrontSettings
        // NOTE: productPageOrder is handled separately in Text/JSON fields section
        const stringFields = [
          'imageZoomType', 'navigationType', 'soldNumberType', 'soldNumberText',
          'variantColorStyle', 'variantColorSize', 'variantSizeStyle',
          'stockProgressType', 'stockProgressLowColor', 'stockProgressMediumColor', 'stockProgressHighColor',
          'badgeLayout', 'badgeCustom1Text', 'badgeCustom2Text',
          'reasonsToPurchaseType', 'reasonsToPurchaseStyle',
          'onlineVisitorsType', 'onlineVisitorsText',
          'estimatedDeliveryDefaultText',
          'fomoType', 'fomoTrigger', 'fomoMessage',
          'defaultLanguage', 'pixelStatus', 'capiStatus'
        ];
        
        if (stringFields.includes(field)) {
          console.log(`🔍 [STOREFRONT-SETTINGS] Processing STRING field: ${field}, type: ${typeof settingsData[field]}, value:`, settingsData[field]);
          // Handle String fields - convert to string or null
          if (settingsData[field] === null || settingsData[field] === undefined || settingsData[field] === '') {
            // Set defaults for required fields
            if (field === 'fomoMessage' || field === 'badgeCustom1Text' || field === 'badgeCustom2Text') {
              updateData[field] = null;
            } else if (field === 'estimatedDeliveryDefaultText') {
              updateData[field] = 'التوصيل خلال {time}';
            } else if (field === 'fomoType') {
              updateData[field] = 'soldCount';
            } else if (field === 'fomoTrigger') {
              updateData[field] = 'time';
            } else if (field === 'imageZoomType') {
              updateData[field] = 'hover';
            } else if (field === 'navigationType') {
              updateData[field] = 'sameCategory';
            } else if (field === 'soldNumberType') {
              updateData[field] = 'real';
            } else if (field === 'soldNumberText') {
              updateData[field] = 'تم بيع {count} قطعة';
            } else if (field === 'variantColorStyle') {
              updateData[field] = 'buttons';
            } else if (field === 'variantColorSize') {
              updateData[field] = 'medium';
            } else if (field === 'variantSizeStyle') {
              updateData[field] = 'buttons';
            } else if (field === 'stockProgressType') {
              updateData[field] = 'percentage';
            } else if (field === 'stockProgressLowColor') {
              updateData[field] = '#ef4444';
            } else if (field === 'stockProgressMediumColor') {
              updateData[field] = '#f59e0b';
            } else if (field === 'stockProgressHighColor') {
              updateData[field] = '#10b981';
            } else if (field === 'badgeLayout') {
              updateData[field] = 'horizontal';
            } else if (field === 'reasonsToPurchaseType') {
              updateData[field] = 'global';
            } else if (field === 'reasonsToPurchaseStyle') {
              updateData[field] = 'list';
            } else if (field === 'onlineVisitorsType') {
              updateData[field] = 'fake';
            } else if (field === 'onlineVisitorsText') {
              updateData[field] = '{count} شخص يشاهدون هذا المنتج الآن';
            } else if (field === 'defaultLanguage') {
              updateData[field] = 'ar';
            } else if (field === 'pixelStatus' || field === 'capiStatus') {
              updateData[field] = 'not_configured';
            } else {
              updateData[field] = null;
            }
          } else {
            // Ensure it's a string, not boolean
            const value = settingsData[field];
            if (typeof value === 'boolean') {
              console.error(`❌ [STOREFRONT-SETTINGS] ${field} is Boolean but should be String! Converting...`);
              // Convert boolean to default string based on field
              if (field === 'fomoType') {
                updateData[field] = 'soldCount';
              } else if (field === 'fomoTrigger') {
                updateData[field] = 'time';
              } else if (field === 'estimatedDeliveryDefaultText') {
                updateData[field] = 'التوصيل خلال {time}';
              } else if (field === 'imageZoomType') {
                updateData[field] = 'hover';
              } else if (field === 'navigationType') {
                updateData[field] = 'sameCategory';
              } else if (field === 'soldNumberType') {
                updateData[field] = 'real';
              } else if (field === 'soldNumberText') {
                updateData[field] = 'تم بيع {count} قطعة';
              } else if (field === 'variantColorStyle') {
                updateData[field] = 'buttons';
              } else if (field === 'variantColorSize') {
                updateData[field] = 'medium';
              } else if (field === 'variantSizeStyle') {
                updateData[field] = 'buttons';
              } else if (field === 'stockProgressType') {
                updateData[field] = 'percentage';
              } else if (field === 'stockProgressLowColor') {
                updateData[field] = '#ef4444';
              } else if (field === 'stockProgressMediumColor') {
                updateData[field] = '#f59e0b';
              } else if (field === 'stockProgressHighColor') {
                updateData[field] = '#10b981';
              } else if (field === 'badgeLayout') {
                updateData[field] = 'horizontal';
              } else if (field === 'reasonsToPurchaseType') {
                updateData[field] = 'global';
              } else if (field === 'reasonsToPurchaseStyle') {
                updateData[field] = 'list';
              } else if (field === 'onlineVisitorsType') {
                updateData[field] = 'fake';
              } else if (field === 'onlineVisitorsText') {
                updateData[field] = '{count} شخص يشاهدون هذا المنتج الآن';
              } else if (field === 'defaultLanguage') {
                updateData[field] = 'ar';
              } else {
                updateData[field] = null;
              }
            } else {
              updateData[field] = String(value);
            }
          }
          continue; // Skip to next field
        }
        
        // Boolean filter fields (must be checked first to avoid being caught by generic patterns)
        if (field === 'filterByPrice' || field === 'filterByRating' || field === 'filterByBrand' || field === 'filterByAttributes') {
          updateData[field] = Boolean(settingsData[field]);
          continue; // Skip to next field
        }
        
        // Product Page Layout fields - all Boolean except productPageOrder (handled above)
        if (field.startsWith('productPageShow') || field === 'productPageLayoutEnabled') {
          updateData[field] = Boolean(settingsData[field]);
          continue; // Skip to next field
        }
        
        // Numeric fields
        if (field === 'minRatingToDisplay' || field === 'fomoDelay' ||
            field.includes('Count') || field.includes('Days') || field.includes('Items') || 
            field.includes('Products') || field.includes('Threshold') || field.includes('Interval')) {
          updateData[field] = parseInt(settingsData[field]) || 0;
          continue; // Skip to next field
        }
        
        // Boolean fields (generic pattern) - BUT exclude String fields
        // estimatedDeliveryShowOnProduct is Boolean, so it's OK
        // NOTE: productPageOrder and reasonsToPurchaseList are handled separately in Text/JSON fields section
        const stringFieldsList = [
          'imageZoomType', 'navigationType', 'soldNumberType', 'soldNumberText',
          'variantColorStyle', 'variantColorSize', 'variantSizeStyle',
          'stockProgressType', 'stockProgressLowColor', 'stockProgressMediumColor', 'stockProgressHighColor',
          'badgeLayout', 'badgeCustom1Text', 'badgeCustom2Text',
          'reasonsToPurchaseType', 'reasonsToPurchaseStyle',
          'onlineVisitorsType', 'onlineVisitorsText',
          'estimatedDeliveryDefaultText',
          'fomoType', 'fomoTrigger', 'fomoMessage',
          'defaultLanguage', 'pixelStatus', 'capiStatus'
        ];
        
        if ((field.includes('Enabled') || field.includes('Show') || field.includes('Require') || 
            field.includes('Moderation') || field.includes('Autoplay') || field.includes('Controls') ||
            field.startsWith('badge') || field.startsWith('tab') || field.startsWith('share') ||
            field.startsWith('seo') || field === 'multiLanguageEnabled') &&
            // Exclude ALL String fields
            !stringFieldsList.includes(field)) {
          updateData[field] = Boolean(settingsData[field]);
          continue; // Skip to next field
        }
        
        // JSON/Array fields
        if (field === 'supportedLanguages') {
          if (Array.isArray(settingsData[field])) {
            updateData[field] = settingsData[field];
          } else if (typeof settingsData[field] === 'string') {
            try {
              updateData[field] = JSON.parse(settingsData[field]);
            } catch {
              updateData[field] = ['ar']; // Default if parsing fails
            }
          } else {
            updateData[field] = ['ar']; // Default if not provided
          }
          continue; // Skip to next field
        }
        
        // Text/JSON fields (stored as TEXT in DB) - MUST be checked BEFORE generic patterns
        if (field === 'productPageOrder' || field === 'reasonsToPurchaseList') {
          console.log(`🔍 [STOREFRONT-SETTINGS] Processing TEXT/JSON field: ${field}, type: ${typeof settingsData[field]}, value:`, settingsData[field]);
          if (typeof settingsData[field] === 'string') {
            // Already a string, keep as is (could be JSON string or plain text)
            updateData[field] = settingsData[field];
          } else if (Array.isArray(settingsData[field])) {
            // Convert array to JSON string
            updateData[field] = JSON.stringify(settingsData[field]);
          } else if (settingsData[field] === null || settingsData[field] === undefined) {
            updateData[field] = null;
          } else {
            // Try to stringify if it's an object
            try {
              updateData[field] = JSON.stringify(settingsData[field]);
            } catch (e) {
              console.error(`❌ [STOREFRONT-SETTINGS] Error stringifying ${field}:`, e);
              updateData[field] = null;
            }
          }
          console.log(`✅ [STOREFRONT-SETTINGS] ${field} processed, final value:`, updateData[field]);
          continue; // Skip to next field
        }
        
        // Default: keep as is
        updateData[field] = settingsData[field];
      }
    }

    // Ensure supportedLanguages is always present in updateData (for update operation)
    if (!updateData.supportedLanguages) {
      updateData.supportedLanguages = ["ar"];
    }

    // تحديث pixelStatus تلقائياً بناءً على Pixel ID
    if (updateData.facebookPixelId !== undefined) {
      if (updateData.facebookPixelId && /^\d{16}$/.test(updateData.facebookPixelId)) {
        // Pixel ID صحيح - تحديث الحالة إلى active
        updateData.pixelStatus = 'active';
        console.log('✅ [STOREFRONT-SETTINGS] Pixel ID valid, setting status to active');
      } else if (!updateData.facebookPixelId || updateData.facebookPixelId === '') {
        // Pixel ID محذوف - تحديث الحالة إلى not_configured
        updateData.pixelStatus = 'not_configured';
        console.log('ℹ️ [STOREFRONT-SETTINGS] Pixel ID removed, setting status to not_configured');
      } else {
        // Pixel ID غير صحيح - تحديث الحالة إلى error
        updateData.pixelStatus = 'error';
        console.log('❌ [STOREFRONT-SETTINGS] Pixel ID invalid, setting status to error');
      }
    }

    // إذا تم تعطيل Pixel، تحديث الحالة إلى not_configured
    if (updateData.facebookPixelEnabled === false) {
      updateData.pixelStatus = 'not_configured';
      console.log('ℹ️ [STOREFRONT-SETTINGS] Pixel disabled, setting status to not_configured');
    }

    // تحديث أو إنشاء الإعدادات
    // Note: createData will be built after cleanUpdateData is ready

    // Debug: Log updateData for String fields and check for type mismatches
    // NOTE: productPageOrder and reasonsToPurchaseList are TEXT fields, not String fields
    const stringFieldsList = [
      'imageZoomType', 'navigationType', 'soldNumberType', 'soldNumberText',
      'variantColorStyle', 'variantColorSize', 'variantSizeStyle',
      'stockProgressType', 'stockProgressLowColor', 'stockProgressMediumColor', 'stockProgressHighColor',
      'badgeLayout', 'badgeCustom1Text', 'badgeCustom2Text',
      'reasonsToPurchaseType', 'reasonsToPurchaseStyle',
      'onlineVisitorsType', 'onlineVisitorsText',
      'estimatedDeliveryDefaultText',
      'fomoType', 'fomoTrigger', 'fomoMessage',
      'defaultLanguage', 'pixelStatus', 'capiStatus'
    ];
    const debugData = {};
    const typeErrors = [];
    
    stringFieldsList.forEach(field => {
      if (updateData[field] !== undefined) {
        const value = updateData[field];
        const type = typeof value;
        debugData[field] = { value, type };
        
        // Check if String field has wrong type
        if (type === 'boolean') {
          typeErrors.push(`${field} is Boolean but should be String!`);
        }
      }
    });
    
    if (Object.keys(debugData).length > 0) {
      console.log('🔍 [STOREFRONT-SETTINGS] String fields in updateData:', JSON.stringify(debugData, null, 2));
    }
    
    if (typeErrors.length > 0) {
      console.error('❌ [STOREFRONT-SETTINGS] Type errors found:', typeErrors);
      // Fix the errors - use the same logic as in the main loop
      typeErrors.forEach(error => {
        const field = error.split(' ')[0];
        // Apply default values based on field name
        if (field === 'estimatedDeliveryDefaultText') {
          updateData[field] = 'التوصيل خلال {time}';
        } else if (field === 'fomoType') {
          updateData[field] = 'soldCount';
        } else if (field === 'fomoTrigger') {
          updateData[field] = 'time';
        } else if (field === 'fomoMessage') {
          updateData[field] = null;
        } else if (field === 'imageZoomType') {
          updateData[field] = 'hover';
        } else if (field === 'navigationType') {
          updateData[field] = 'sameCategory';
        } else if (field === 'soldNumberType') {
          updateData[field] = 'real';
        } else if (field === 'soldNumberText') {
          updateData[field] = 'تم بيع {count} قطعة';
        } else if (field === 'variantColorStyle') {
          updateData[field] = 'buttons';
        } else if (field === 'variantColorSize') {
          updateData[field] = 'medium';
        } else if (field === 'variantSizeStyle') {
          updateData[field] = 'buttons';
        } else if (field === 'stockProgressType') {
          updateData[field] = 'percentage';
        } else if (field === 'stockProgressLowColor') {
          updateData[field] = '#ef4444';
        } else if (field === 'stockProgressMediumColor') {
          updateData[field] = '#f59e0b';
        } else if (field === 'stockProgressHighColor') {
          updateData[field] = '#10b981';
        } else if (field === 'badgeLayout') {
          updateData[field] = 'horizontal';
        } else if (field === 'reasonsToPurchaseType') {
          updateData[field] = 'global';
        } else if (field === 'reasonsToPurchaseStyle') {
          updateData[field] = 'list';
        } else if (field === 'onlineVisitorsType') {
          updateData[field] = 'fake';
        } else if (field === 'onlineVisitorsText') {
          updateData[field] = '{count} شخص يشاهدون هذا المنتج الآن';
        } else if (field === 'defaultLanguage') {
          updateData[field] = 'ar';
        } else {
          updateData[field] = null;
        }
        console.log(`✅ [STOREFRONT-SETTINGS] Fixed ${field}`);
      });
    }

    // Clean updateData: remove undefined values and fix type mismatches
    const cleanUpdateData = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value === undefined) continue; // Skip undefined
      
      // Final type check and fix for String fields
      if (stringFieldsList.includes(key)) {
        if (typeof value === 'boolean') {
          console.error(`❌ [STOREFRONT-SETTINGS] CRITICAL: ${key} is Boolean, fixing...`);
          // Fix based on field
          if (key === 'estimatedDeliveryDefaultText') {
            cleanUpdateData[key] = 'التوصيل خلال {time}';
          } else if (key === 'fomoType') {
            cleanUpdateData[key] = 'soldCount';
          } else if (key === 'fomoTrigger') {
            cleanUpdateData[key] = 'time';
          } else if (key === 'fomoMessage') {
            cleanUpdateData[key] = null;
          }
        } else if (typeof value === 'string' || value === null) {
          cleanUpdateData[key] = value;
        } else {
          console.warn(`⚠️ [STOREFRONT-SETTINGS] ${key} has unexpected type: ${typeof value}, skipping`);
        }
      } else {
        // Non-String fields - keep as is
        cleanUpdateData[key] = value;
      }
    }

    console.log('🔄 [STOREFRONT-SETTINGS] Starting upsert with', Object.keys(cleanUpdateData).length, 'fields');
    
    // Final validation log
    stringFieldsList.forEach(field => {
      if (cleanUpdateData[field] !== undefined) {
        console.log(`✅ [STOREFRONT-SETTINGS] ${field}: type=${typeof cleanUpdateData[field]}, value=${cleanUpdateData[field]}`);
      }
    });

    // Final check: Log ALL String fields in cleanUpdateData to find any Boolean values
    console.log('🔍 [STOREFRONT-SETTINGS] === FINAL CHECK: All String fields ===');
    const allStringFields = stringFieldsList;
    allStringFields.forEach(field => {
      if (cleanUpdateData[field] !== undefined) {
        const type = typeof cleanUpdateData[field];
        const value = cleanUpdateData[field];
        if (type === 'boolean') {
          console.error(`❌❌❌ [STOREFRONT-SETTINGS] CRITICAL ERROR: ${field} is still Boolean! Value: ${value}`);
        } else {
          console.log(`✅ [STOREFRONT-SETTINGS] ${field}: ${type} = ${value}`);
        }
      }
    });
    
    // Build createData with final validation
    const createData = {
      companyId,
      ...cleanUpdateData,
      supportedLanguages: cleanUpdateData.supportedLanguages || ["ar"]
    };
    
    console.log('🔍 [STOREFRONT-SETTINGS] === Checking createData String fields ===');
    allStringFields.forEach(field => {
      if (createData[field] !== undefined) {
        const type = typeof createData[field];
        const value = createData[field];
        if (type === 'boolean') {
          console.error(`❌❌❌ [STOREFRONT-SETTINGS] CRITICAL ERROR in createData: ${field} is Boolean! Value: ${value}`);
          // Fix it immediately
          if (field === 'estimatedDeliveryDefaultText') {
            createData[field] = 'التوصيل خلال {time}';
          } else if (field === 'fomoType') {
            createData[field] = 'soldCount';
          } else if (field === 'fomoTrigger') {
            createData[field] = 'time';
          } else if (field === 'fomoMessage') {
            createData[field] = null;
          }
          console.log(`✅ [STOREFRONT-SETTINGS] Fixed ${field} in createData`);
        }
      }
    });

    console.log('🔄 [STOREFRONT-SETTINGS] Attempting upsert with cleanUpdateData keys:', Object.keys(cleanUpdateData));
    console.log('🔄 [STOREFRONT-SETTINGS] cleanUpdateData sample (first 5):', Object.fromEntries(Object.entries(cleanUpdateData).slice(0, 5)));
    
    try {
      const settings = await prisma.storefrontSettings.upsert({
        where: { companyId },
        update: cleanUpdateData,
        create: createData
      });

      console.log('✅ [STOREFRONT-SETTINGS] Settings updated successfully:', settings.id);

      return res.status(200).json({
        success: true,
        message: 'تم تحديث الإعدادات بنجاح',
        data: settings
      });
    } catch (prismaError) {
      console.error('❌ [STOREFRONT-SETTINGS] Prisma error:', prismaError);
      console.error('❌ [STOREFRONT-SETTINGS] Error code:', prismaError.code);
      console.error('❌ [STOREFRONT-SETTINGS] Error meta:', prismaError.meta);
      console.error('❌ [STOREFRONT-SETTINGS] Error message:', prismaError.message);
      
      // Check if it's a field not found error
      if (prismaError.code === 'P2009' || prismaError.message?.includes('Unknown field')) {
        return res.status(500).json({
          success: false,
          message: 'بعض الحقول غير موجودة في قاعدة البيانات. يرجى تشغيل migration.',
          error: prismaError.message,
          code: prismaError.code,
          meta: prismaError.meta
        });
      }
      
      throw prismaError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('❌ [STOREFRONT-SETTINGS] Error updating settings:', error);
    console.error('❌ [STOREFRONT-SETTINGS] Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الإعدادات',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * جلب إعدادات واجهة المتجر للواجهة العامة (بدون مصادقة)
 * GET /api/v1/public/storefront-settings/:companyId
 */
exports.getPublicStorefrontSettings = async (req, res) => {
  try {
    let { companyId } = req.params;
    const prisma = getPrisma();

    console.log('🔍 [STOREFRONT-SETTINGS-PUBLIC] Getting settings for company:', companyId);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    // Check if companyId is a slug (subdomain) instead of actual ID
    // Prisma IDs usually start with 'c' followed by alphanumeric characters
    // Slugs are usually lowercase letters, numbers, and hyphens
    const isSlug = !/^c[a-z0-9]{20,}$/.test(companyId);
    
    if (isSlug) {
      console.log('🔍 [STOREFRONT-SETTINGS-PUBLIC] companyId looks like a slug, finding company by slug...');
      
      // Find company by slug
      const company = await prisma.company.findFirst({
        where: {
          slug: companyId,
          isActive: true
        },
        select: {
          id: true,
          slug: true
        }
      });

      if (company) {
        console.log('✅ [STOREFRONT-SETTINGS-PUBLIC] Company found by slug:', {
          slug: company.slug,
          companyId: company.id
        });
        companyId = company.id; // Use the real companyId
      } else {
        console.warn('⚠️ [STOREFRONT-SETTINGS-PUBLIC] Company not found by slug:', companyId);
        return res.status(404).json({
          success: false,
          message: 'الشركة غير موجودة'
        });
      }
    }

    // البحث عن الإعدادات
    let settings = await prisma.storefrontSettings.findUnique({
      where: { companyId }
    });

    // Debug logging
    console.log('📊 [STOREFRONT-SETTINGS-PUBLIC] Settings from DB:', {
      found: !!settings,
      companyId: companyId,
      facebookPixelEnabled: settings?.facebookPixelEnabled,
      facebookPixelId: settings?.facebookPixelId,
      pixelStatus: settings?.pixelStatus
    });

    // إذا لم توجد إعدادات، إرجاع القيم الافتراضية من Schema
    if (!settings) {
      // إنشاء إعدادات افتراضية مؤقتة (لا نحفظها في DB)
      // يجب أن تطابق القيم الافتراضية في Schema
      settings = {
        quickViewEnabled: true,
        quickViewShowAddToCart: true,
        quickViewShowWishlist: true,
        comparisonEnabled: true,
        maxComparisonProducts: 4,
        comparisonShowPrice: true,
        comparisonShowSpecs: true,
        wishlistEnabled: true,
        wishlistRequireLogin: false,
        wishlistMaxItems: 100,
        advancedFiltersEnabled: true,
        filterByPrice: true,
        filterByRating: true,
        filterByBrand: false,
        filterByAttributes: true,
        reviewsEnabled: true,
        reviewsRequirePurchase: false,
        reviewsModerationEnabled: true,
        reviewsShowRating: true,
        minRatingToDisplay: 1,
        countdownEnabled: true,
        countdownShowOnProduct: true,
        countdownShowOnListing: false,
        backInStockEnabled: true,
        backInStockNotifyEmail: true,
        backInStockNotifySMS: false,
        recentlyViewedEnabled: true,
        recentlyViewedCount: 8,
        recentlyViewedDays: 30,
        imageZoomEnabled: true,
        imageZoomType: 'hover',
        productVideosEnabled: true,
        videoAutoplay: false,
        videoShowControls: true,
        sizeGuideEnabled: true,
        sizeGuideShowOnProduct: true,
        socialSharingEnabled: true,
        shareFacebook: true,
        shareTwitter: true,
        shareWhatsApp: true,
        shareTelegram: true,
        badgesEnabled: true,
        badgeNew: true,
        badgeBestSeller: true,
        badgeOnSale: true,
        badgeOutOfStock: true,
        tabsEnabled: true,
        tabDescription: true,
        tabSpecifications: true,
        tabReviews: true,
        tabShipping: true,
        stickyAddToCartEnabled: true,
        stickyShowOnMobile: true,
        stickyShowOnDesktop: true,
        stickyScrollThreshold: 300,
        stickyShowBuyNow: true,
        stickyShowAddToCartButton: true,
        stickyShowQuantity: true,
        stickyShowProductImage: true,
        stickyShowProductName: true,
        stickyTrackAnalytics: true,
        stickyAutoScrollToCheckout: false,
        // Product Navigation
        navigationEnabled: false,
        navigationType: 'sameCategory',
        showNavigationButtons: true,
        keyboardShortcuts: true,
        // Sold Number Display
        soldNumberEnabled: false,
        soldNumberType: 'real',
        soldNumberMin: 10,
        soldNumberMax: 500,
        soldNumberText: 'تم بيع {count} قطعة',
        // Variant Styles
        variantColorStyle: 'buttons',
        variantColorShowName: true,
        variantColorSize: 'medium',
        variantSizeStyle: 'buttons',
        variantSizeShowGuide: false,
        variantSizeShowStock: true,
        // Stock Progress Bar
        stockProgressEnabled: false,
        stockProgressType: 'percentage',
        stockProgressLowColor: '#ef4444',
        stockProgressMediumColor: '#f59e0b',
        stockProgressHighColor: '#10b981',
        stockProgressThreshold: 10,
        // Security Badges
        securityBadgesEnabled: false,
        badgeSecurePayment: true,
        badgeFreeShipping: true,
        badgeQualityGuarantee: true,
        badgeCashOnDelivery: true,
        badgeBuyerProtection: true,
        badgeHighRating: true,
        badgeCustom1: false,
        badgeCustom1Text: null,
        badgeCustom2: false,
        badgeCustom2Text: null,
        badgeLayout: 'horizontal',
        // Reasons to Purchase
        reasonsToPurchaseEnabled: false,
        reasonsToPurchaseType: 'global',
        reasonsToPurchaseList: null,
        reasonsToPurchaseMaxItems: 4,
        reasonsToPurchaseStyle: 'list',
        // Online Visitors Count
        onlineVisitorsEnabled: false,
        onlineVisitorsType: 'fake',
        onlineVisitorsMin: 5,
        onlineVisitorsMax: 50,
        onlineVisitorsUpdateInterval: 30,
        onlineVisitorsText: '{count} شخص يشاهدون هذا المنتج الآن',
        seoEnabled: true,
        seoMetaDescription: true,
        seoStructuredData: true,
        seoSitemap: true,
        seoOpenGraph: true,
        multiLanguageEnabled: false,
        defaultLanguage: 'ar',
        supportedLanguages: ['ar'],
        // Facebook Pixel Settings
        facebookPixelEnabled: false,
        facebookPixelId: null,
        pixelTrackPageView: true,
        pixelTrackViewContent: true,
        pixelTrackAddToCart: true,
        pixelTrackInitiateCheckout: true,
        pixelTrackPurchase: true,
        pixelTrackSearch: true,
        pixelTrackAddToWishlist: false,
        // Facebook Conversions API Settings
        facebookConvApiEnabled: false,
        facebookConvApiToken: null,
        facebookConvApiTestCode: null,
        capiTrackPageView: true,
        capiTrackViewContent: true,
        capiTrackAddToCart: true,
        capiTrackInitiateCheckout: true,
        capiTrackPurchase: true,
        capiTrackSearch: true,
        // Advanced Settings
        eventDeduplicationEnabled: true,
        eventMatchQualityTarget: 8,
        gdprCompliant: true,
        hashUserData: true,
        pixelStatus: 'not_configured',
        capiStatus: 'not_configured'
      };
    } else {
      // Ensure boolean values are properly serialized
      settings = {
        ...settings,
        // Facebook Pixel Settings
        facebookPixelEnabled: Boolean(settings.facebookPixelEnabled),
        facebookPixelId: settings.facebookPixelId || null, // Ensure Pixel ID is returned
        pixelTrackPageView: Boolean(settings.pixelTrackPageView ?? true),
        pixelTrackViewContent: Boolean(settings.pixelTrackViewContent ?? true),
        pixelTrackAddToCart: Boolean(settings.pixelTrackAddToCart ?? true),
        pixelTrackInitiateCheckout: Boolean(settings.pixelTrackInitiateCheckout ?? true),
        pixelTrackPurchase: Boolean(settings.pixelTrackPurchase ?? true),
        pixelTrackSearch: Boolean(settings.pixelTrackSearch ?? true),
        pixelTrackAddToWishlist: Boolean(settings.pixelTrackAddToWishlist ?? false),
        // Facebook Conversions API Settings
        facebookConvApiEnabled: Boolean(settings.facebookConvApiEnabled ?? false),
        facebookConvApiToken: settings.facebookConvApiToken || null,
        facebookConvApiTestCode: settings.facebookConvApiTestCode || null,
        capiTrackPageView: Boolean(settings.capiTrackPageView ?? true),
        capiTrackViewContent: Boolean(settings.capiTrackViewContent ?? true),
        capiTrackAddToCart: Boolean(settings.capiTrackAddToCart ?? true),
        capiTrackInitiateCheckout: Boolean(settings.capiTrackInitiateCheckout ?? true),
        capiTrackPurchase: Boolean(settings.capiTrackPurchase ?? true),
        capiTrackSearch: Boolean(settings.capiTrackSearch ?? true),
        // Advanced Settings
        eventDeduplicationEnabled: Boolean(settings.eventDeduplicationEnabled ?? true),
        gdprCompliant: Boolean(settings.gdprCompliant ?? true),
        hashUserData: Boolean(settings.hashUserData ?? true),
        eventMatchQualityTarget: settings.eventMatchQualityTarget ? parseInt(settings.eventMatchQualityTarget) : 8,
        pixelStatus: settings.pixelStatus || 'not_configured',
        capiStatus: settings.capiStatus || 'not_configured',
        lastPixelTest: settings.lastPixelTest || null,
        lastCapiTest: settings.lastCapiTest || null
      };
      
      // Debug logging
      console.log('📊 [STOREFRONT-SETTINGS-PUBLIC] Returning settings with Pixel:', {
        facebookPixelEnabled: settings.facebookPixelEnabled,
        facebookPixelId: settings.facebookPixelId,
        pixelStatus: settings.pixelStatus
      });
    }

    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ [STOREFRONT-SETTINGS-PUBLIC] Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الإعدادات',
      error: error.message
    });
  }
};

/**
 * إعادة تعيين الإعدادات للقيم الافتراضية
 * POST /api/v1/storefront-settings/reset
 */
exports.resetStorefrontSettings = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const prisma = getPrisma();

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    // حذف الإعدادات الحالية وإنشاء جديدة بالقيم الافتراضية
    await prisma.storefrontSettings.deleteMany({
      where: { companyId }
    });

    const settings = await prisma.storefrontSettings.create({
      data: { 
        companyId,
        // Ensure supportedLanguages is provided (required Json field)
        supportedLanguages: ["ar"] // Default to Arabic
        // جميع القيم الافتراضية الأخرى موجودة في Schema
      }
    });

    console.log('✅ [STOREFRONT-SETTINGS] Settings reset to defaults:', settings.id);

    return res.status(200).json({
      success: true,
      message: 'تم إعادة تعيين الإعدادات للقيم الافتراضية',
      data: settings
    });
  } catch (error) {
    console.error('❌ [STOREFRONT-SETTINGS] Error resetting settings:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إعادة تعيين الإعدادات',
      error: error.message
    });
  }
};

/**
 * اختبار اتصال Facebook Conversions API
 * POST /api/v1/storefront-settings/test-facebook-capi
 */
exports.testFacebookCapi = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const prisma = getPrisma();

    console.log('🧪 [FACEBOOK-CAPI] Testing connection for company:', companyId);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    // جلب الإعدادات
    const settings = await prisma.storefrontSettings.findUnique({
      where: { companyId }
    });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على إعدادات المتجر'
      });
    }

    if (!settings.facebookConvApiEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Facebook Conversions API غير مفعل'
      });
    }

    if (!settings.facebookPixelId || !settings.facebookConvApiToken) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال Pixel ID و Access Token'
      });
    }

    // استخدام Facebook Service
    const FacebookConversionsService = require('../services/facebookConversionsService');
    const fbService = new FacebookConversionsService(
      settings.facebookPixelId,
      settings.facebookConvApiToken,
      settings.facebookConvApiTestCode
    );

    // اختبار الاتصال
    const testResult = await fbService.testConnection();

    // تحديث حالة الاختبار
    await prisma.storefrontSettings.update({
      where: { companyId },
      data: {
        lastCapiTest: new Date(),
        capiStatus: testResult.success ? 'active' : 'error'
      }
    });

    console.log(testResult.success ? '✅' : '❌', '[FACEBOOK-CAPI] Test result:', testResult.message);

    return res.json({
      success: testResult.success,
      message: testResult.message,
      data: testResult
    });
  } catch (error) {
    console.error('❌ [FACEBOOK-CAPI] Error testing connection:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل اختبار الاتصال',
      error: error.message
    });
  }
};

/**
 * اختبار Facebook Pixel
 * POST /api/v1/storefront-settings/test-facebook-pixel
 */
exports.testFacebookPixel = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const prisma = getPrisma();

    console.log('🧪 [FACEBOOK-PIXEL] Testing Pixel for company:', companyId);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    // جلب الإعدادات
    const settings = await prisma.storefrontSettings.findUnique({
      where: { companyId }
    });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على إعدادات المتجر'
      });
    }

    if (!settings.facebookPixelEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Facebook Pixel غير مفعل'
      });
    }

    if (!settings.facebookPixelId) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال Pixel ID'
      });
    }

    // التحقق من صحة Pixel ID
    if (!/^\d{16}$/.test(settings.facebookPixelId)) {
      // تحديث الحالة إلى error
      await prisma.storefrontSettings.update({
        where: { companyId },
        data: {
          pixelStatus: 'error',
          lastPixelTest: new Date()
        }
      });

      return res.status(400).json({
        success: false,
        message: 'Pixel ID غير صحيح - يجب أن يكون 16 رقم'
      });
    }

    // Pixel ID صحيح - تحديث الحالة إلى active
    await prisma.storefrontSettings.update({
      where: { companyId },
      data: {
        pixelStatus: 'active',
        lastPixelTest: new Date()
      }
    });

    console.log('✅ [FACEBOOK-PIXEL] Pixel test successful:', settings.facebookPixelId);

    return res.json({
      success: true,
      message: 'Pixel ID صحيح وتم تفعيله بنجاح',
      data: {
        pixelId: settings.facebookPixelId,
        status: 'active',
        testDate: new Date()
      }
    });
  } catch (error) {
    console.error('❌ [FACEBOOK-PIXEL] Error testing Pixel:', error);
    return res.status(500).json({
      success: false,
      message: 'فشل اختبار Pixel',
      error: error.message
    });
  }
};

/**
 * التحقق من صحة Pixel ID
 * POST /api/v1/storefront-settings/validate-pixel-id
 */
exports.validatePixelId = async (req, res) => {
  try {
    const { pixelId } = req.body;

    if (!pixelId) {
      return res.status(400).json({
        success: false,
        message: 'Pixel ID مطلوب'
      });
    }

    // Pixel ID يجب أن يكون 16 رقم
    if (!/^\d{16}$/.test(pixelId)) {
      return res.status(400).json({
        success: false,
        message: 'Pixel ID يجب أن يكون 16 رقم'
      });
    }

    return res.json({
      success: true,
      message: 'Pixel ID صحيح',
      data: { pixelId, valid: true }
    });
  } catch (error) {
    console.error('❌ [PIXEL-VALIDATION] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

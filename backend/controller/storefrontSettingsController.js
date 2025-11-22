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
    for (const field of allowedFields) {
      if (settingsData[field] !== undefined) {
        // معالجة أنواع البيانات المختلفة
        // IMPORTANT: Check specific fields first before generic patterns
        
        // Boolean filter fields (must be checked first to avoid being caught by generic patterns)
        if (field === 'filterByPrice' || field === 'filterByRating' || field === 'filterByBrand' || field === 'filterByAttributes') {
          updateData[field] = Boolean(settingsData[field]);
          continue; // Skip to next field
        }
        
        // Numeric fields
        if (field === 'minRatingToDisplay' || 
            field.includes('Count') || field.includes('Days') || field.includes('Items') || 
            field.includes('Products')) {
          updateData[field] = parseInt(settingsData[field]) || 0;
          continue; // Skip to next field
        }
        
        // Boolean fields (generic pattern)
        if (field.includes('Enabled') || field.includes('Show') || field.includes('Require') || 
            field.includes('Moderation') || field.includes('Autoplay') || field.includes('Controls') ||
            field.startsWith('badge') || field.startsWith('tab') || field.startsWith('share') ||
            field.startsWith('seo') || field === 'multiLanguageEnabled') {
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
        
        // Default: keep as is
        updateData[field] = settingsData[field];
      }
    }

    // Ensure supportedLanguages is always present in updateData (for update operation)
    if (!updateData.supportedLanguages) {
      updateData.supportedLanguages = ["ar"];
    }

    // تحديث أو إنشاء الإعدادات
    // Ensure supportedLanguages is always present (required Json field)
    const createData = {
      companyId,
      ...updateData,
      supportedLanguages: updateData.supportedLanguages || ["ar"] // Default to Arabic if not provided
    };

    const settings = await prisma.storefrontSettings.upsert({
      where: { companyId },
      update: updateData,
      create: createData
    });

    console.log('✅ [STOREFRONT-SETTINGS] Settings updated successfully:', settings.id);

    return res.status(200).json({
      success: true,
      message: 'تم تحديث الإعدادات بنجاح',
      data: settings
    });
  } catch (error) {
    console.error('❌ [STOREFRONT-SETTINGS] Error updating settings:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الإعدادات',
      error: error.message
    });
  }
};

/**
 * جلب إعدادات واجهة المتجر للواجهة العامة (بدون مصادقة)
 * GET /api/v1/public/storefront-settings/:companyId
 */
exports.getPublicStorefrontSettings = async (req, res) => {
  try {
    const { companyId } = req.params;
    const prisma = getPrisma();

    console.log('🔍 [STOREFRONT-SETTINGS-PUBLIC] Getting settings for company:', companyId);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    // البحث عن الإعدادات
    let settings = await prisma.storefrontSettings.findUnique({
      where: { companyId }
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
        seoEnabled: true,
        seoMetaDescription: true,
        seoStructuredData: true,
        seoSitemap: true,
        seoOpenGraph: true,
        multiLanguageEnabled: false,
        defaultLanguage: 'ar',
        supportedLanguages: ['ar']
      };
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

    // Pixel ID يجب أن يكون 15 رقم
    if (!/^\d{15}$/.test(pixelId)) {
      return res.status(400).json({
        success: false,
        message: 'Pixel ID يجب أن يكون 15 رقم'
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

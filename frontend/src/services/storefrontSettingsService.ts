import { apiClient } from './apiClient';
import { getApiUrl } from '../config/environment';

/**
 * 🛍️ Service لإدارة إعدادات واجهة المتجر (Storefront Features)
 */

export interface StorefrontSettings {
  id: string;
  companyId: string;
  
  // Quick View Settings
  quickViewEnabled: boolean;
  quickViewShowAddToCart: boolean;
  quickViewShowWishlist: boolean;
  
  // Product Comparison Settings
  comparisonEnabled: boolean;
  maxComparisonProducts: number;
  comparisonShowPrice: boolean;
  comparisonShowSpecs: boolean;
  
  // Wishlist Settings
  wishlistEnabled: boolean;
  wishlistRequireLogin: boolean;
  wishlistMaxItems: number;
  
  // Advanced Filters Settings
  advancedFiltersEnabled: boolean;
  filterByPrice: boolean;
  filterByRating: boolean;
  filterByBrand: boolean;
  filterByAttributes: boolean;
  
  // Reviews & Ratings Settings
  reviewsEnabled: boolean;
  reviewsRequirePurchase: boolean;
  reviewsModerationEnabled: boolean;
  reviewsShowRating: boolean;
  minRatingToDisplay: number;
  
  // Countdown Timer Settings
  countdownEnabled: boolean;
  countdownShowOnProduct: boolean;
  countdownShowOnListing: boolean;
  
  // Back in Stock Settings
  backInStockEnabled: boolean;
  backInStockNotifyEmail: boolean;
  backInStockNotifySMS: boolean;
  
  // Recently Viewed Settings
  recentlyViewedEnabled: boolean;
  recentlyViewedCount: number;
  recentlyViewedDays: number;
  
  // Image Zoom Settings
  imageZoomEnabled: boolean;
  imageZoomType: 'hover' | 'click' | 'both';
  
  // Product Videos Settings
  productVideosEnabled: boolean;
  videoAutoplay: boolean;
  videoShowControls: boolean;
  
  // Size Guide Settings
  sizeGuideEnabled: boolean;
  sizeGuideShowOnProduct: boolean;
  
  // Social Sharing Settings
  socialSharingEnabled: boolean;
  shareFacebook: boolean;
  shareTwitter: boolean;
  shareWhatsApp: boolean;
  shareTelegram: boolean;
  
  // Product Badges Settings
  badgesEnabled: boolean;
  badgeNew: boolean;
  badgeBestSeller: boolean;
  badgeOnSale: boolean;
  badgeOutOfStock: boolean;
  
  // Product Tabs Settings
  tabsEnabled: boolean;
  tabDescription: boolean;
  tabSpecifications: boolean;
  tabReviews: boolean;
  tabShipping: boolean;
  
  // Sticky Add to Cart Settings
  stickyAddToCartEnabled: boolean;
  stickyShowOnMobile: boolean;
  stickyShowOnDesktop: boolean;
  
  // SEO Settings
  seoEnabled: boolean;
  seoMetaDescription: boolean;
  seoStructuredData: boolean;
  seoSitemap: boolean;
  seoOpenGraph: boolean;
  
  // Multi-language Settings
  multiLanguageEnabled: boolean;
  defaultLanguage: string;
  supportedLanguages: string[];
  
  // Facebook Pixel Settings
  facebookPixelEnabled?: boolean;
  facebookPixelId?: string;
  pixelTrackPageView?: boolean;
  pixelTrackViewContent?: boolean;
  pixelTrackAddToCart?: boolean;
  pixelTrackInitiateCheckout?: boolean;
  pixelTrackPurchase?: boolean;
  pixelTrackSearch?: boolean;
  pixelTrackAddToWishlist?: boolean;
  
  // Facebook Conversions API Settings
  facebookConvApiEnabled?: boolean;
  facebookConvApiToken?: string;
  facebookConvApiTestCode?: string;
  capiTrackPageView?: boolean;
  capiTrackViewContent?: boolean;
  capiTrackAddToCart?: boolean;
  capiTrackInitiateCheckout?: boolean;
  capiTrackPurchase?: boolean;
  capiTrackSearch?: boolean;
  
  // Advanced Settings
  eventDeduplicationEnabled?: boolean;
  eventMatchQualityTarget?: number;
  gdprCompliant?: boolean;
  hashUserData?: boolean;
  lastPixelTest?: string;
  lastCapiTest?: string;
  pixelStatus?: string;
  capiStatus?: string;
  
  createdAt: string;
  updatedAt: string;
}

export type StorefrontSettingsUpdate = Partial<Omit<StorefrontSettings, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>>;

export const storefrontSettingsService = {
  /**
   * جلب إعدادات واجهة المتجر للشركة (محمي)
   */
  getSettings: async (): Promise<{ data: StorefrontSettings }> => {
    return apiClient.get('/storefront-settings');
  },

  /**
   * تحديث إعدادات واجهة المتجر (محمي)
   */
  updateSettings: async (data: StorefrontSettingsUpdate): Promise<{ data: StorefrontSettings }> => {
    return apiClient.put('/storefront-settings', data);
  },

  /**
   * إعادة تعيين الإعدادات للقيم الافتراضية (محمي)
   */
  resetSettings: async (): Promise<{ data: StorefrontSettings }> => {
    return apiClient.post('/storefront-settings/reset', {});
  },

  /**
   * اختبار اتصال Facebook Conversions API
   */
  testFacebookCapi: async () => {
    const response = await apiClient.post('/storefront-settings/test-facebook-capi', {});
    return response.data;
  },

  /**
   * التحقق من صحة Pixel ID
   */
  validatePixelId: async (pixelId: string) => {
    const response = await apiClient.post('/storefront-settings/validate-pixel-id', { pixelId });
    return response.data;
  },

  /**
   * جلب إعدادات واجهة المتجر للواجهة العامة (عام - بدون مصادقة)
   * يستخدم Cache مع expiration لتحسين الأداء
   */
  getPublicSettings: async (companyId: string, forceRefresh: boolean = false): Promise<{ success: boolean; data: StorefrontSettings }> => {
    const CACHE_KEY = `storefront_settings_${companyId}`;
    const CACHE_EXPIRY = 5 * 60 * 1000; // 5 دقائق
    const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

    // محاولة جلب البيانات من Cache أولاً (إلا إذا كان forceRefresh = true)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const now = Date.now();
          
          // التحقق من أن الـ cache لم ينتهِ
          if (now - timestamp < CACHE_EXPIRY) {
            // التحقق من أن الـ cache يحتوي على جميع الحقول المطلوبة
            // إذا كان `recentlyViewedEnabled` غير موجود، نعتبر الـ cache قديماً
            const hasRecentlyViewed = 'recentlyViewedEnabled' in data && data.recentlyViewedEnabled !== undefined;
            
            if (!hasRecentlyViewed) {
              if (isDevelopment) {
                console.warn('⚠️ [STOREFRONT-SETTINGS] Cache missing recentlyViewedEnabled, fetching fresh data', {
                  hasKey: 'recentlyViewedEnabled' in data,
                  value: data.recentlyViewedEnabled
                });
              }
              // نتابع لجلب بيانات جديدة - لا نرجع الـ cache
            } else {
              if (isDevelopment) {
                console.log('✅ [STOREFRONT-SETTINGS] Using cached settings', {
                  recentlyViewedEnabled: data.recentlyViewedEnabled
                });
              }
              return {
                success: true,
                data: data as StorefrontSettings
              };
            }
          } else {
            // Cache منتهي - سيتم جلب بيانات جديدة
            if (isDevelopment) {
              console.log('⏰ [STOREFRONT-SETTINGS] Cache expired, fetching fresh data');
            }
          }
        }
      } catch (error) {
        // في حالة خطأ في قراءة الـ cache، نتابع لجلب بيانات جديدة
        if (isDevelopment) {
          console.warn('⚠️ [STOREFRONT-SETTINGS] Cache read error, fetching fresh data');
        }
      }
    }

    // جلب البيانات من API
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/public/storefront-settings/${companyId}`);
      
      if (!response.ok) {
        // Handle 500 errors gracefully - server might be having issues
        if (response.status === 500) {
          // محاولة استخدام الـ cache القديم في حالة خطأ السيرفر
          try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
              const { data } = JSON.parse(cached);
              if (isDevelopment) {
                console.warn('⚠️ [STOREFRONT-SETTINGS] Server error, using stale cache');
              }
              return {
                success: true,
                data: data as StorefrontSettings
              };
            }
          } catch (e) {
            // لا يوجد cache - نستخدم القيم الافتراضية
          }
          
          // Return default disabled settings for server errors
          return {
            success: true,
            data: {
              quickViewEnabled: false,
              comparisonEnabled: false,
              wishlistEnabled: false,
              reviewsEnabled: false,
              advancedFiltersEnabled: false,
              seoEnabled: false,
              recentlyViewedEnabled: false,
              recentlyViewedCount: 8,
              recentlyViewedDays: 30,
            } as StorefrontSettings
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // التحقق من أن البيانات موجودة وصحيحة
      if (data.success && data.data) {
        // حفظ البيانات في Cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: data.data,
            timestamp: Date.now()
          }));
          if (isDevelopment) {
            console.log('✅ [STOREFRONT-SETTINGS] Settings cached successfully');
          }
        } catch (cacheError) {
          // في حالة فشل حفظ الـ cache، نتابع بدون مشكلة
          if (isDevelopment) {
            console.warn('⚠️ [STOREFRONT-SETTINGS] Failed to cache settings');
          }
        }
        
        if (isDevelopment) {
          console.log('✅ [STOREFRONT-SETTINGS] Settings loaded successfully:', {
            quickViewEnabled: data.data.quickViewEnabled,
            comparisonEnabled: data.data.comparisonEnabled,
            wishlistEnabled: data.data.wishlistEnabled,
            recentlyViewedEnabled: data.data.recentlyViewedEnabled,
            recentlyViewedCount: data.data.recentlyViewedCount,
          });
        }
        return data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      // Only log non-500 errors (500 is server issue, expected)
      const status = error?.status || error?.response?.status;
      
      // محاولة استخدام الـ cache القديم في حالة خطأ
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data } = JSON.parse(cached);
          if (isDevelopment) {
            console.warn('⚠️ [STOREFRONT-SETTINGS] Error fetching, using stale cache');
          }
          return {
            success: true,
            data: data as StorefrontSettings
          };
        }
      } catch (e) {
        // لا يوجد cache
      }
      
      if (status !== 500 && isDevelopment) {
        console.error('❌ [STOREFRONT-SETTINGS] Error fetching public storefront settings:', error);
      }
      
      // إرجاع القيم الافتراضية (كلها false) في حالة الخطأ لتجنب عرض المزايا عند فشل الجلب
      // هذا يضمن أن المزايا لن تظهر إذا فشل جلب الإعدادات
      return {
        success: false,
        data: {
          id: '',
          companyId,
          quickViewEnabled: false,
          quickViewShowAddToCart: false,
          quickViewShowWishlist: false,
          comparisonEnabled: false,
          maxComparisonProducts: 4,
          comparisonShowPrice: false,
          comparisonShowSpecs: false,
          wishlistEnabled: false,
          wishlistRequireLogin: false,
          wishlistMaxItems: 100,
          advancedFiltersEnabled: false,
          filterByPrice: false,
          filterByRating: false,
          filterByBrand: false,
          filterByAttributes: false,
          reviewsEnabled: false,
          reviewsRequirePurchase: false,
          reviewsModerationEnabled: false,
          reviewsShowRating: false,
          minRatingToDisplay: 1,
          countdownEnabled: false,
          countdownShowOnProduct: false,
          countdownShowOnListing: false,
          backInStockEnabled: false,
          backInStockNotifyEmail: false,
          backInStockNotifySMS: false,
          recentlyViewedEnabled: false,
          recentlyViewedCount: 8,
          recentlyViewedDays: 30,
          imageZoomEnabled: false,
          imageZoomType: 'hover',
          productVideosEnabled: false,
          videoAutoplay: false,
          videoShowControls: false,
          sizeGuideEnabled: false,
          sizeGuideShowOnProduct: false,
          socialSharingEnabled: false,
          shareFacebook: false,
          shareTwitter: false,
          shareWhatsApp: false,
          shareTelegram: false,
          badgesEnabled: false,
          badgeNew: false,
          badgeBestSeller: false,
          badgeOnSale: false,
          badgeOutOfStock: false,
          tabsEnabled: false,
          tabDescription: false,
          tabSpecifications: false,
          tabReviews: false,
          tabShipping: false,
          stickyAddToCartEnabled: false,
          stickyShowOnMobile: false,
          stickyShowOnDesktop: false,
          seoEnabled: false,
          seoMetaDescription: false,
          seoStructuredData: false,
          seoSitemap: false,
          seoOpenGraph: false,
          multiLanguageEnabled: false,
          defaultLanguage: 'ar',
          supportedLanguages: ['ar'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as StorefrontSettings
      };
    }
  },

  /**
   * مسح Cache للإعدادات (مفيد عند تحديث الإعدادات)
   */
  clearCache: (companyId: string) => {
    const CACHE_KEY = `storefront_settings_${companyId}`;
    localStorage.removeItem(CACHE_KEY);
  }
};


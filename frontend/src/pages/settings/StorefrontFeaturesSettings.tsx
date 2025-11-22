import React, { useState, useEffect } from 'react';
import {
  EyeIcon,
  ArrowsRightLeftIcon,
  HeartIcon,
  FunnelIcon,
  StarIcon,
  ClockIcon,
  BellIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon,
  ScaleIcon,
  ShareIcon,
  TagIcon,
  RectangleStackIcon,
  ShoppingCartIcon,
  GlobeAltIcon,
  LanguageIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { storefrontSettingsService, StorefrontSettings, StorefrontSettingsUpdate } from '../../services/storefrontSettingsService';

const StorefrontFeaturesSettings: React.FC = () => {
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await storefrontSettingsService.getSettings();
      console.log('🔍 [STOREFRONT-SETTINGS] Response from API:', response);
      console.log('🔍 [STOREFRONT-SETTINGS] Response data:', response.data);
      // API returns { success: true, data: {...} }, so we need to extract data.data
      const settingsData = response.data?.data || response.data;
      console.log('🔍 [STOREFRONT-SETTINGS] Settings data:', settingsData);
      console.log('🔍 [STOREFRONT-SETTINGS] Quick View Enabled:', settingsData?.quickViewEnabled);
      console.log('🔍 [STOREFRONT-SETTINGS] Comparison Enabled:', settingsData?.comparisonEnabled);
      console.log('🔍 [STOREFRONT-SETTINGS] Wishlist Enabled:', settingsData?.wishlistEnabled);
      setSettings(settingsData);
    } catch (error: any) {
      console.error('❌ [STOREFRONT-SETTINGS] Error loading settings:', error);
      console.error('❌ [STOREFRONT-SETTINGS] Error response:', error.response?.data);
      console.error('❌ [STOREFRONT-SETTINGS] Error status:', error.response?.status);
      
      // عرض رسالة خطأ أكثر تفصيلاً
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'فشل تحميل الإعدادات';
      
      toast.error(errorMessage);
      
      // في development mode، عرض تفاصيل أكثر
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [STOREFRONT-SETTINGS] Full error details:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          errorCode: error.response?.data?.errorCode,
          details: error.response?.data?.details
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const updateData: StorefrontSettingsUpdate = { 
        ...settings,
        // Ensure supportedLanguages is always an array
        supportedLanguages: Array.isArray(settings.supportedLanguages) 
          ? settings.supportedLanguages 
          : (settings.supportedLanguages ? [settings.supportedLanguages] : ['ar'])
      };
      await storefrontSettingsService.updateSettings(updateData);
      toast.success('تم حفظ الإعدادات بنجاح');
      // Reload settings after save
      await loadSettings();
    } catch (error) {
      toast.error('فشل حفظ الإعدادات');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات للقيم الافتراضية؟')) return;

    try {
      setSaving(true);
      await storefrontSettingsService.resetSettings();
      await loadSettings();
      toast.success('تم إعادة تعيين الإعدادات بنجاح');
    } catch (error) {
      toast.error('فشل إعادة تعيين الإعدادات');
      console.error('Error resetting settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof StorefrontSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">لا توجد إعدادات</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <GlobeAltIcon className="h-8 w-8 text-indigo-600 ml-3" />
          إعدادات واجهة المتجر
        </h1>
        <p className="mt-2 text-gray-600">إدارة ميزات واجهة المتجر وتفعيل/إلغاء تفعيل الميزات</p>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex justify-end gap-4">
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          إعادة تعيين
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Quick View Section */}
        <SettingsSection
          title="المعاينة السريعة"
          icon={EyeIcon}
          enabled={settings.quickViewEnabled}
          onToggle={(enabled) => updateSetting('quickViewEnabled', enabled)}
        >
          <ToggleSetting
            label="إظهار زر إضافة للسلة"
            value={settings.quickViewShowAddToCart}
            onChange={(value) => updateSetting('quickViewShowAddToCart', value)}
            disabled={!settings.quickViewEnabled}
          />
          <ToggleSetting
            label="إظهار زر المفضلة"
            value={settings.quickViewShowWishlist}
            onChange={(value) => updateSetting('quickViewShowWishlist', value)}
            disabled={!settings.quickViewEnabled}
          />
        </SettingsSection>

        {/* Product Comparison Section */}
        <SettingsSection
          title="مقارنة المنتجات"
          icon={ArrowsRightLeftIcon}
          enabled={settings.comparisonEnabled}
          onToggle={(enabled) => updateSetting('comparisonEnabled', enabled)}
        >
          <NumberSetting
            label="الحد الأقصى للمنتجات للمقارنة"
            value={settings.maxComparisonProducts}
            onChange={(value) => updateSetting('maxComparisonProducts', value)}
            min={2}
            max={10}
            disabled={!settings.comparisonEnabled}
          />
          <ToggleSetting
            label="إظهار السعر"
            value={settings.comparisonShowPrice}
            onChange={(value) => updateSetting('comparisonShowPrice', value)}
            disabled={!settings.comparisonEnabled}
          />
          <ToggleSetting
            label="إظهار المواصفات"
            value={settings.comparisonShowSpecs}
            onChange={(value) => updateSetting('comparisonShowSpecs', value)}
            disabled={!settings.comparisonEnabled}
          />
        </SettingsSection>

        {/* Wishlist Section */}
        <SettingsSection
          title="قائمة الرغبات"
          icon={HeartIcon}
          enabled={settings.wishlistEnabled}
          onToggle={(enabled) => updateSetting('wishlistEnabled', enabled)}
        >
          <ToggleSetting
            label="يتطلب تسجيل دخول"
            value={settings.wishlistRequireLogin}
            onChange={(value) => updateSetting('wishlistRequireLogin', value)}
            disabled={!settings.wishlistEnabled}
          />
          <NumberSetting
            label="الحد الأقصى للمنتجات"
            value={settings.wishlistMaxItems}
            onChange={(value) => updateSetting('wishlistMaxItems', value)}
            min={10}
            max={1000}
            disabled={!settings.wishlistEnabled}
          />
        </SettingsSection>

        {/* Advanced Filters Section */}
        <SettingsSection
          title="الفلاتر المتقدمة"
          icon={FunnelIcon}
          enabled={settings.advancedFiltersEnabled}
          onToggle={(enabled) => updateSetting('advancedFiltersEnabled', enabled)}
        >
          <ToggleSetting
            label="فلترة حسب السعر"
            value={settings.filterByPrice}
            onChange={(value) => updateSetting('filterByPrice', value)}
            disabled={!settings.advancedFiltersEnabled}
          />
          <ToggleSetting
            label="فلترة حسب التقييم"
            value={settings.filterByRating}
            onChange={(value) => updateSetting('filterByRating', value)}
            disabled={!settings.advancedFiltersEnabled}
          />
          <ToggleSetting
            label="فلترة حسب العلامة التجارية"
            value={settings.filterByBrand}
            onChange={(value) => updateSetting('filterByBrand', value)}
            disabled={!settings.advancedFiltersEnabled}
          />
          <ToggleSetting
            label="فلترة حسب الخصائص"
            value={settings.filterByAttributes}
            onChange={(value) => updateSetting('filterByAttributes', value)}
            disabled={!settings.advancedFiltersEnabled}
          />
        </SettingsSection>

        {/* Reviews & Ratings Section */}
        <SettingsSection
          title="التقييمات والمراجعات"
          icon={StarIcon}
          enabled={settings.reviewsEnabled}
          onToggle={(enabled) => updateSetting('reviewsEnabled', enabled)}
        >
          <ToggleSetting
            label="يتطلب شراء المنتج"
            value={settings.reviewsRequirePurchase}
            onChange={(value) => updateSetting('reviewsRequirePurchase', value)}
            disabled={!settings.reviewsEnabled}
          />
          <ToggleSetting
            label="الموافقة على التقييمات"
            value={settings.reviewsModerationEnabled}
            onChange={(value) => updateSetting('reviewsModerationEnabled', value)}
            disabled={!settings.reviewsEnabled}
          />
          <ToggleSetting
            label="إظهار التقييم"
            value={settings.reviewsShowRating}
            onChange={(value) => updateSetting('reviewsShowRating', value)}
            disabled={!settings.reviewsEnabled}
          />
          <NumberSetting
            label="الحد الأدنى للتقييم للعرض"
            value={settings.minRatingToDisplay}
            onChange={(value) => updateSetting('minRatingToDisplay', value)}
            min={1}
            max={5}
            disabled={!settings.reviewsEnabled}
          />
        </SettingsSection>

        {/* Countdown Timer Section */}
        <SettingsSection
          title="العد التنازلي"
          icon={ClockIcon}
          enabled={settings.countdownEnabled}
          onToggle={(enabled) => updateSetting('countdownEnabled', enabled)}
        >
          <ToggleSetting
            label="إظهار في صفحة المنتج"
            value={settings.countdownShowOnProduct}
            onChange={(value) => updateSetting('countdownShowOnProduct', value)}
            disabled={!settings.countdownEnabled}
          />
          <ToggleSetting
            label="إظهار في قائمة المنتجات"
            value={settings.countdownShowOnListing}
            onChange={(value) => updateSetting('countdownShowOnListing', value)}
            disabled={!settings.countdownEnabled}
          />
        </SettingsSection>

        {/* Back in Stock Section */}
        <SettingsSection
          title="إشعارات العودة للمخزون"
          icon={BellIcon}
          enabled={settings.backInStockEnabled}
          onToggle={(enabled) => updateSetting('backInStockEnabled', enabled)}
        >
          <ToggleSetting
            label="إشعار عبر البريد"
            value={settings.backInStockNotifyEmail}
            onChange={(value) => updateSetting('backInStockNotifyEmail', value)}
            disabled={!settings.backInStockEnabled}
          />
          <ToggleSetting
            label="إشعار عبر SMS"
            value={settings.backInStockNotifySMS}
            onChange={(value) => updateSetting('backInStockNotifySMS', value)}
            disabled={!settings.backInStockEnabled}
          />
        </SettingsSection>

        {/* Recently Viewed Section */}
        <SettingsSection
          title="المنتجات المشاهدة مؤخراً"
          icon={EyeSlashIcon}
          enabled={settings.recentlyViewedEnabled}
          onToggle={(enabled) => updateSetting('recentlyViewedEnabled', enabled)}
        >
          <NumberSetting
            label="عدد المنتجات المعروضة"
            value={settings.recentlyViewedCount}
            onChange={(value) => updateSetting('recentlyViewedCount', value)}
            min={4}
            max={20}
            disabled={!settings.recentlyViewedEnabled}
          />
          <NumberSetting
            label="عدد الأيام للاحتفاظ"
            value={settings.recentlyViewedDays}
            onChange={(value) => updateSetting('recentlyViewedDays', value)}
            min={7}
            max={90}
            disabled={!settings.recentlyViewedEnabled}
          />
        </SettingsSection>

        {/* Image Zoom Section */}
        <SettingsSection
          title="تكبير الصور"
          icon={MagnifyingGlassIcon}
          enabled={settings.imageZoomEnabled}
          onToggle={(enabled) => updateSetting('imageZoomEnabled', enabled)}
        >
          <SelectSetting
            label="نوع التكبير"
            value={settings.imageZoomType}
            onChange={(value) => updateSetting('imageZoomType', value)}
            options={[
              { value: 'hover', label: 'عند التمرير' },
              { value: 'click', label: 'عند النقر' },
              { value: 'both', label: 'الاثنان معاً' },
            ]}
            disabled={!settings.imageZoomEnabled}
          />
        </SettingsSection>

        {/* Product Videos Section */}
        <SettingsSection
          title="فيديوهات المنتجات"
          icon={VideoCameraIcon}
          enabled={settings.productVideosEnabled}
          onToggle={(enabled) => updateSetting('productVideosEnabled', enabled)}
        >
          <ToggleSetting
            label="تشغيل تلقائي"
            value={settings.videoAutoplay}
            onChange={(value) => updateSetting('videoAutoplay', value)}
            disabled={!settings.productVideosEnabled}
          />
          <ToggleSetting
            label="إظهار عناصر التحكم"
            value={settings.videoShowControls}
            onChange={(value) => updateSetting('videoShowControls', value)}
            disabled={!settings.productVideosEnabled}
          />
        </SettingsSection>

        {/* Size Guide Section */}
        <SettingsSection
          title="دليل المقاسات"
          icon={ScaleIcon}
          enabled={settings.sizeGuideEnabled}
          onToggle={(enabled) => updateSetting('sizeGuideEnabled', enabled)}
        >
          <ToggleSetting
            label="إظهار في صفحة المنتج"
            value={settings.sizeGuideShowOnProduct}
            onChange={(value) => updateSetting('sizeGuideShowOnProduct', value)}
            disabled={!settings.sizeGuideEnabled}
          />
        </SettingsSection>

        {/* Social Sharing Section */}
        <SettingsSection
          title="المشاركة الاجتماعية"
          icon={ShareIcon}
          enabled={settings.socialSharingEnabled}
          onToggle={(enabled) => updateSetting('socialSharingEnabled', enabled)}
        >
          <ToggleSetting
            label="Facebook"
            value={settings.shareFacebook}
            onChange={(value) => updateSetting('shareFacebook', value)}
            disabled={!settings.socialSharingEnabled}
          />
          <ToggleSetting
            label="Twitter"
            value={settings.shareTwitter}
            onChange={(value) => updateSetting('shareTwitter', value)}
            disabled={!settings.socialSharingEnabled}
          />
          <ToggleSetting
            label="WhatsApp"
            value={settings.shareWhatsApp}
            onChange={(value) => updateSetting('shareWhatsApp', value)}
            disabled={!settings.socialSharingEnabled}
          />
          <ToggleSetting
            label="Telegram"
            value={settings.shareTelegram}
            onChange={(value) => updateSetting('shareTelegram', value)}
            disabled={!settings.socialSharingEnabled}
          />
        </SettingsSection>

        {/* Product Badges Section */}
        <SettingsSection
          title="شارات المنتجات"
          icon={TagIcon}
          enabled={settings.badgesEnabled}
          onToggle={(enabled) => updateSetting('badgesEnabled', enabled)}
        >
          <ToggleSetting
            label="شارة 'جديد'"
            value={settings.badgeNew}
            onChange={(value) => updateSetting('badgeNew', value)}
            disabled={!settings.badgesEnabled}
          />
          <ToggleSetting
            label="شارة 'الأكثر مبيعاً'"
            value={settings.badgeBestSeller}
            onChange={(value) => updateSetting('badgeBestSeller', value)}
            disabled={!settings.badgesEnabled}
          />
          <ToggleSetting
            label="شارة 'عرض خاص'"
            value={settings.badgeOnSale}
            onChange={(value) => updateSetting('badgeOnSale', value)}
            disabled={!settings.badgesEnabled}
          />
          <ToggleSetting
            label="شارة 'نفد المخزون'"
            value={settings.badgeOutOfStock}
            onChange={(value) => updateSetting('badgeOutOfStock', value)}
            disabled={!settings.badgesEnabled}
          />
        </SettingsSection>

        {/* Product Tabs Section */}
        <SettingsSection
          title="تبويبات المنتج"
          icon={RectangleStackIcon}
          enabled={settings.tabsEnabled}
          onToggle={(enabled) => updateSetting('tabsEnabled', enabled)}
        >
          <ToggleSetting
            label="تبويب الوصف"
            value={settings.tabDescription}
            onChange={(value) => updateSetting('tabDescription', value)}
            disabled={!settings.tabsEnabled}
          />
          <ToggleSetting
            label="تبويب المواصفات"
            value={settings.tabSpecifications}
            onChange={(value) => updateSetting('tabSpecifications', value)}
            disabled={!settings.tabsEnabled}
          />
          <ToggleSetting
            label="تبويب التقييمات"
            value={settings.tabReviews}
            onChange={(value) => updateSetting('tabReviews', value)}
            disabled={!settings.tabsEnabled}
          />
          <ToggleSetting
            label="تبويب الشحن"
            value={settings.tabShipping}
            onChange={(value) => updateSetting('tabShipping', value)}
            disabled={!settings.tabsEnabled}
          />
        </SettingsSection>

        {/* Sticky Add to Cart Section */}
        <SettingsSection
          title="زر إضافة للسلة الثابت"
          icon={ShoppingCartIcon}
          enabled={settings.stickyAddToCartEnabled}
          onToggle={(enabled) => updateSetting('stickyAddToCartEnabled', enabled)}
        >
          <ToggleSetting
            label="إظهار على الموبايل"
            value={settings.stickyShowOnMobile}
            onChange={(value) => updateSetting('stickyShowOnMobile', value)}
            disabled={!settings.stickyAddToCartEnabled}
          />
          <ToggleSetting
            label="إظهار على الديسكتوب"
            value={settings.stickyShowOnDesktop}
            onChange={(value) => updateSetting('stickyShowOnDesktop', value)}
            disabled={!settings.stickyAddToCartEnabled}
          />
        </SettingsSection>

        {/* SEO Section */}
        <SettingsSection
          title="تحسين محركات البحث (SEO)"
          icon={GlobeAltIcon}
          enabled={settings.seoEnabled}
          onToggle={(enabled) => updateSetting('seoEnabled', enabled)}
        >
          <ToggleSetting
            label="Meta Description"
            value={settings.seoMetaDescription}
            onChange={(value) => updateSetting('seoMetaDescription', value)}
            disabled={!settings.seoEnabled}
          />
          <ToggleSetting
            label="Structured Data"
            value={settings.seoStructuredData}
            onChange={(value) => updateSetting('seoStructuredData', value)}
            disabled={!settings.seoEnabled}
          />
          <ToggleSetting
            label="Sitemap"
            value={settings.seoSitemap}
            onChange={(value) => updateSetting('seoSitemap', value)}
            disabled={!settings.seoEnabled}
          />
          <ToggleSetting
            label="Open Graph"
            value={settings.seoOpenGraph}
            onChange={(value) => updateSetting('seoOpenGraph', value)}
            disabled={!settings.seoEnabled}
          />
        </SettingsSection>

        {/* Multi-language Section */}
        <SettingsSection
          title="دعم متعدد اللغات"
          icon={LanguageIcon}
          enabled={settings.multiLanguageEnabled}
          onToggle={(enabled) => updateSetting('multiLanguageEnabled', enabled)}
        >
          <SelectSetting
            label="اللغة الافتراضية"
            value={settings.defaultLanguage}
            onChange={(value) => updateSetting('defaultLanguage', value)}
            options={[
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
            ]}
            disabled={!settings.multiLanguageEnabled}
          />
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اللغات المدعومة
            </label>
            <div className="space-y-2">
              {['ar', 'en', 'fr'].map((lang) => (
                <label key={lang} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.supportedLanguages?.includes(lang) || false}
                    onChange={(e) => {
                      const current = settings.supportedLanguages || [];
                      const updated = e.target.checked
                        ? [...current, lang]
                        : current.filter((l) => l !== lang);
                      updateSetting('supportedLanguages', updated);
                    }}
                    disabled={!settings.multiLanguageEnabled}
                    className="mr-2"
                  />
                  <span className={settings.multiLanguageEnabled ? 'text-gray-700' : 'text-gray-400'}>
                    {lang === 'ar' ? 'العربية' : lang === 'en' ? 'English' : 'Français'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </SettingsSection>
      </div>

      {/* Save Button at Bottom */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>
    </div>
  );
};

// Helper Components
interface SettingsSectionProps {
  title: string;
  icon: React.ComponentType<any>;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, icon: Icon, enabled, onToggle, children }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Icon className="h-6 w-6 text-indigo-600 ml-3" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>
      <div className={`space-y-4 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        {children}
      </div>
    </div>
  );
};

interface ToggleSettingProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({ label, value, onChange, disabled }) => {
  // Ensure value is always a boolean to prevent controlled/uncontrolled warning
  const checkedValue = value ?? false;
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}
      </span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checkedValue}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
      </label>
    </div>
  );
};

interface NumberSettingProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const NumberSetting: React.FC<NumberSettingProps> = ({ label, value, onChange, min, max, disabled }) => {
  // Ensure value is always a number to prevent controlled/uncontrolled warning
  const numValue = value ?? min ?? 0;
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}
      </label>
      <input
        type="number"
        value={numValue}
        onChange={(e) => {
          const num = parseInt(e.target.value) || min || 0;
          const clamped = Math.max(min || 0, Math.min(max || 1000, num));
          onChange(clamped);
        }}
        min={min}
        max={max}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />
    </div>
  );
};

interface SelectSettingProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

const SelectSetting: React.FC<SelectSettingProps> = ({ label, value, onChange, options, disabled }) => {
  // Ensure value is always a string to prevent controlled/uncontrolled warning
  const stringValue = value ?? (options[0]?.value || '');
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}
      </label>
      <select
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default StorefrontFeaturesSettings;


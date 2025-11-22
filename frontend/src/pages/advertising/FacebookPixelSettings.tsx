import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { storefrontSettingsService } from '../../services/storefrontSettingsService';

interface FacebookPixelSettings {
  // Pixel Settings
  facebookPixelEnabled: boolean;
  facebookPixelId: string;
  pixelTrackPageView: boolean;
  pixelTrackViewContent: boolean;
  pixelTrackAddToCart: boolean;
  pixelTrackInitiateCheckout: boolean;
  pixelTrackPurchase: boolean;
  pixelTrackSearch: boolean;
  pixelTrackAddToWishlist: boolean;
  
  // CAPI Settings
  facebookConvApiEnabled: boolean;
  facebookConvApiToken: string;
  facebookConvApiTestCode: string;
  capiTrackPageView: boolean;
  capiTrackViewContent: boolean;
  capiTrackAddToCart: boolean;
  capiTrackInitiateCheckout: boolean;
  capiTrackPurchase: boolean;
  capiTrackSearch: boolean;
  
  // Advanced
  eventDeduplicationEnabled: boolean;
  eventMatchQualityTarget: number;
  gdprCompliant: boolean;
  hashUserData: boolean;
  
  // Status
  pixelStatus?: string;
  capiStatus?: string;
  lastPixelTest?: string;
  lastCapiTest?: string;
}

const FacebookPixelSettings: React.FC = () => {
  const [settings, setSettings] = useState<Partial<FacebookPixelSettings>>({
    facebookPixelEnabled: false,
    facebookConvApiEnabled: false,
    eventDeduplicationEnabled: true,
    eventMatchQualityTarget: 8,
    gdprCompliant: true,
    hashUserData: true,
    pixelTrackPageView: true,
    pixelTrackViewContent: true,
    pixelTrackAddToCart: true,
    pixelTrackInitiateCheckout: true,
    pixelTrackPurchase: true,
    pixelTrackSearch: true,
    capiTrackPageView: true,
    capiTrackViewContent: true,
    capiTrackAddToCart: true,
    capiTrackInitiateCheckout: true,
    capiTrackPurchase: true,
    capiTrackSearch: true,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await storefrontSettingsService.getSettings();
      console.log('📥 Raw response:', response);
      if (response.data) {
        // Important: response.data should override default values
        const newSettings = {
          // Default values first
          facebookPixelEnabled: false,
          facebookConvApiEnabled: false,
          eventDeduplicationEnabled: true,
          eventMatchQualityTarget: 8,
          gdprCompliant: true,
          hashUserData: true,
          pixelTrackPageView: true,
          pixelTrackViewContent: true,
          pixelTrackAddToCart: true,
          pixelTrackInitiateCheckout: true,
          pixelTrackPurchase: true,
          pixelTrackSearch: true,
          pixelTrackAddToWishlist: false,
          capiTrackPageView: true,
          capiTrackViewContent: true,
          capiTrackAddToCart: true,
          capiTrackInitiateCheckout: true,
          capiTrackPurchase: true,
          capiTrackSearch: true,
          // Then override with actual data from server
          ...response.data
        };
        console.log('✅ Settings loaded:', response.data);
        console.log('🔄 Merged settings:', newSettings);
        console.log('📊 Pixel ID:', newSettings.facebookPixelId);
        console.log('📊 Pixel Enabled:', newSettings.facebookPixelEnabled);
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('فشل تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validation
      if (settings.facebookPixelEnabled && !settings.facebookPixelId) {
        toast.error('يرجى إدخال Pixel ID');
        setSaving(false);
        return;
      }
      
      if (settings.facebookPixelId && !/^\d{15}$/.test(settings.facebookPixelId)) {
        toast.error('Pixel ID يجب أن يكون 15 رقم');
        setSaving(false);
        return;
      }
      
      if (settings.facebookConvApiEnabled && !settings.facebookConvApiToken) {
        toast.error('يرجى إدخال Access Token');
        setSaving(false);
        return;
      }
      
      console.log('💾 Saving settings:', settings);
      
      // Save settings
      const response = await storefrontSettingsService.updateSettings(settings);
      console.log('✅ Save response:', response);
      
      toast.success('✅ تم حفظ الإعدادات بنجاح');
      
      // Reload to get updated data
      await loadSettings();
    } catch (error) {
      toast.error('❌ فشل حفظ الإعدادات');
      console.error('❌ Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestCapi = async () => {
    try {
      setTesting(true);
      
      // Test CAPI connection
      const response = await storefrontSettingsService.testFacebookCapi();
      
      if (response.success) {
        toast.success('✅ الاتصال ناجح! تحقق من Facebook Events Manager');
        await loadSettings(); // Reload to get updated status
      } else {
        toast.error(`❌ فشل الاتصال: ${response.message}`);
      }
    } catch (error: any) {
      toast.error(`❌ خطأ: ${error.message || 'فشل الاتصال'}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <ArrowPathIcon className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">جاري تحميل الإعدادات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <ChartBarIcon className="h-8 w-8 text-indigo-600 ml-3" />
              Facebook Pixel & Conversions API
            </h1>
            <p className="mt-2 text-gray-600">
              تتبع دقيق لزوار متجرك وتحسين أداء إعلانات Facebook
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  حفظ الإعدادات
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex">
          <InformationCircleIcon className="h-6 w-6 text-blue-600 ml-3 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 نصيحة مهمة:</p>
            <p>
              للحصول على أفضل دقة في التتبع (90%+)، فعّل <strong>Pixel + Conversions API معاً</strong>.
              هذا يضمن تتبع الأحداث حتى مع Ad Blockers و iOS 14.5+
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Facebook Pixel Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                🎯 Facebook Pixel
                <span className="mr-2 text-sm font-normal text-gray-500">(Browser Tracking)</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">تتبع الأحداث من متصفح المستخدم</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.facebookPixelEnabled || false}
                onChange={(e) => setSettings({...settings, facebookPixelEnabled: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="mr-3 text-sm font-medium text-gray-900">تفعيل</span>
            </label>
          </div>

          {settings.facebookPixelEnabled && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  معرف البكسل (Pixel ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.facebookPixelId || ''}
                  onChange={(e) => setSettings({...settings, facebookPixelId: e.target.value})}
                  placeholder="123456789012345"
                  maxLength={15}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <p className="mt-2 text-xs text-gray-500 flex items-center">
                  <InformationCircleIcon className="h-4 w-4 ml-1" />
                  15 رقم - يمكنك الحصول عليه من Facebook Events Manager
                </p>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 ml-2" />
                  الأحداث المتتبعة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'pixelTrackPageView', label: 'عرض الصفحات', desc: 'PageView' },
                    { key: 'pixelTrackViewContent', label: 'عرض المنتج', desc: 'ViewContent' },
                    { key: 'pixelTrackAddToCart', label: 'إضافة للسلة', desc: 'AddToCart' },
                    { key: 'pixelTrackInitiateCheckout', label: 'بدء الشراء', desc: 'InitiateCheckout' },
                    { key: 'pixelTrackPurchase', label: 'عمليات الشراء', desc: 'Purchase' },
                    { key: 'pixelTrackSearch', label: 'البحث', desc: 'Search' },
                  ].map((event) => (
                    <label key={event.key} className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={settings[event.key as keyof FacebookPixelSettings] as boolean || false}
                        onChange={(e) => setSettings({...settings, [event.key]: e.target.checked})}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded ml-3 mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{event.label}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">{event.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {settings.pixelStatus && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {settings.pixelStatus === 'active' ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 ml-2" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500 ml-2" />
                      )}
                      <span className="text-sm text-gray-700">
                        الحالة: <span className="font-semibold">{settings.pixelStatus === 'active' ? 'نشط' : 'خطأ'}</span>
                      </span>
                    </div>
                    {settings.lastPixelTest && (
                      <span className="text-xs text-gray-500">
                        آخر اختبار: {new Date(settings.lastPixelTest).toLocaleString('ar-EG')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Facebook Conversions API Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                🚀 Facebook Conversions API
                <span className="mr-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">موصى به</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">تتبع الأحداث من السيرفر - دقة أعلى (90%+)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.facebookConvApiEnabled || false}
                onChange={(e) => setSettings({...settings, facebookConvApiEnabled: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              <span className="mr-3 text-sm font-medium text-gray-900">تفعيل</span>
            </label>
          </div>

          {settings.facebookConvApiEnabled && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={settings.facebookConvApiToken || ''}
                    onChange={(e) => setSettings({...settings, facebookConvApiToken: e.target.value})}
                    placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center">
                  <ShieldCheckIcon className="h-4 w-4 ml-1" />
                  استخدم System User Token من Facebook Business Manager
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Event Code <span className="text-gray-400">(اختياري)</span>
                </label>
                <input
                  type="text"
                  value={settings.facebookConvApiTestCode || ''}
                  onChange={(e) => setSettings({...settings, facebookConvApiTestCode: e.target.value})}
                  placeholder="TEST12345"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
                <p className="mt-2 text-xs text-gray-500">
                  للاختبار فقط - احذفه قبل النشر للإنتاج
                </p>
              </div>

              <div className="border-t pt-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                  <RocketLaunchIcon className="h-5 w-5 text-green-600 ml-2" />
                  الأحداث المتتبعة (Server-side)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'capiTrackPageView', label: 'عرض الصفحات', desc: 'PageView' },
                    { key: 'capiTrackViewContent', label: 'عرض المنتج', desc: 'ViewContent' },
                    { key: 'capiTrackAddToCart', label: 'إضافة للسلة', desc: 'AddToCart' },
                    { key: 'capiTrackInitiateCheckout', label: 'بدء الشراء', desc: 'InitiateCheckout' },
                    { key: 'capiTrackPurchase', label: 'عمليات الشراء', desc: 'Purchase' },
                    { key: 'capiTrackSearch', label: 'البحث', desc: 'Search' },
                  ].map((event) => (
                    <label key={event.key} className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={settings[event.key as keyof FacebookPixelSettings] as boolean || false}
                        onChange={(e) => setSettings({...settings, [event.key]: e.target.checked})}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded ml-3 mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{event.label}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">{event.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleTestCapi}
                  disabled={testing || !settings.facebookPixelId || !settings.facebookConvApiToken}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {testing ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      جاري الاختبار...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      اختبار الاتصال
                    </>
                  )}
                </button>
              </div>

              {settings.capiStatus && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {settings.capiStatus === 'active' ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 ml-2" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500 ml-2" />
                      )}
                      <span className="text-sm text-gray-700">
                        الحالة: <span className="font-semibold">{settings.capiStatus === 'active' ? 'نشط ✅' : 'خطأ ❌'}</span>
                      </span>
                    </div>
                    {settings.lastCapiTest && (
                      <span className="text-xs text-gray-500">
                        آخر اختبار: {new Date(settings.lastCapiTest).toLocaleString('ar-EG')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-right"
          >
            <h2 className="text-xl font-semibold text-gray-900">⚙️ إعدادات متقدمة</h2>
            <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-6 space-y-4">
              <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-900">منع تكرار الأحداث (Deduplication)</span>
                  <p className="text-xs text-gray-500 mt-1">يمنع حساب نفس الحدث مرتين من Pixel و CAPI</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.eventDeduplicationEnabled || false}
                  onChange={(e) => setSettings({...settings, eventDeduplicationEnabled: e.target.checked})}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-900">GDPR Compliant</span>
                  <p className="text-xs text-gray-500 mt-1">الالتزام بقوانين حماية البيانات الأوروبية</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.gdprCompliant || false}
                  onChange={(e) => setSettings({...settings, gdprCompliant: e.target.checked})}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-900">تشفير بيانات المستخدم (Hash)</span>
                  <p className="text-xs text-gray-500 mt-1">تشفير البريد والهاتف قبل الإرسال (SHA256)</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.hashUserData || false}
                  onChange={(e) => setSettings({...settings, hashUserData: e.target.checked})}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </label>

              <div className="p-4 border border-gray-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Event Match Quality Target
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={settings.eventMatchQualityTarget || 8}
                    onChange={(e) => setSettings({...settings, eventMatchQualityTarget: parseInt(e.target.value)})}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-indigo-600 w-12 text-center">
                    {settings.eventMatchQualityTarget}/10
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  الهدف: {settings.eventMatchQualityTarget}/10 - كلما زاد الرقم، زادت دقة التتبع
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Documentation */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
          <div className="flex items-start">
            <DocumentTextIcon className="h-6 w-6 text-indigo-600 ml-3 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">📚 دليل الإعداد</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <span className="text-indigo-600 ml-2">1.</span>
                  <span>احصل على Pixel ID من <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Facebook Events Manager</a></span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 ml-2">2.</span>
                  <span>أنشئ System User Token من Business Settings → System Users</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 ml-2">3.</span>
                  <span>فعّل Pixel و CAPI معاً للحصول على أفضل دقة</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 ml-2">4.</span>
                  <span>اختبر الاتصال وتحقق من Events Manager</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacebookPixelSettings;

/**
 * React Hook لتحميل Facebook Pixel تلقائياً
 * 
 * يتم استدعاؤه في StorefrontLayout لتحميل Pixel في الواجهة العامة
 */

import { useEffect, useState } from 'react';
import { loadFacebookPixel } from '../utils/facebookPixel';
import { storefrontSettingsService } from '../services/storefrontSettingsService';

export const useFacebookPixel = (companyId: string | undefined) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [pixelId, setPixelId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      return;
    }

    // جلب إعدادات المتجر
    const loadPixelSettings = async () => {
      try {
        const response = await storefrontSettingsService.getPublicSettings(companyId);
        
        if (response.success && response.data) {
          const settings = response.data;
          
          // التحقق من أن Pixel مفعّل
          if (settings.facebookPixelEnabled && settings.facebookPixelId) {
            console.log('🎯 [Facebook Pixel] Loading Pixel ID:', settings.facebookPixelId);
            
            // تحميل Pixel Script
            loadFacebookPixel(settings.facebookPixelId);
            
            setPixelId(settings.facebookPixelId);
            setIsLoaded(true);
            
            console.log('✅ [Facebook Pixel] Loaded successfully');
          } else {
            console.log('ℹ️ [Facebook Pixel] Not enabled for this store');
          }
        }
      } catch (error) {
        console.error('❌ [Facebook Pixel] Error loading settings:', error);
      }
    };

    loadPixelSettings();
  }, [companyId]);

  return { isLoaded, pixelId };
};

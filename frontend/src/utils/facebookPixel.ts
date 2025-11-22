/**
 * Facebook Pixel Utility
 * 
 * هذا الملف مسؤول عن:
 * 1. تحميل Pixel Script في المتصفح
 * 2. إرسال الأحداث لـ Facebook
 * 3. Event Deduplication (منع التكرار)
 */

// تخزين Pixel ID
let pixelId: string | null = null;
let isInitialized = false;

/**
 * تحميل Facebook Pixel Script
 */
export const loadFacebookPixel = (pixelIdParam: string) => {
  console.log('🔍 [loadFacebookPixel] Function called', {
    pixelIdParam,
    isInitialized,
    hasPixelId: !!pixelIdParam,
    pixelIdLength: pixelIdParam?.length
  });
  
  if (isInitialized) {
    console.log('ℹ️ [Facebook Pixel] Already initialized, skipping...');
    return;
  }

  if (!pixelIdParam) {
    console.warn('⚠️ [Facebook Pixel] Pixel ID is missing');
    return;
  }

  // التحقق من صحة Pixel ID
  if (!/^\d{16}$/.test(pixelIdParam)) {
    console.error('❌ [Facebook Pixel] Invalid Pixel ID format. Expected 16 digits, got:', {
      pixelId: pixelIdParam,
      length: pixelIdParam.length,
      isValid: /^\d{16}$/.test(pixelIdParam)
    });
    return;
  }

  pixelId = pixelIdParam;
  console.log('🎯 [Facebook Pixel] Loading Pixel with ID:', pixelId);
  console.log('🎯 [Facebook Pixel] Pixel ID validation passed');

  // إضافة Pixel Script للصفحة (الكود الرسمي من Facebook)
  const script = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;

  try {
    console.log('📝 [loadFacebookPixel] Creating script element...');
    const scriptElement = document.createElement('script');
    scriptElement.innerHTML = script;
    
    console.log('📝 [loadFacebookPixel] Adding script to head...', {
      hasHead: !!document.head,
      scriptLength: script.length
    });
    
    document.head.appendChild(scriptElement);
    console.log('✅ [Facebook Pixel] Script element added to head');
    console.log('✅ [Facebook Pixel] Script content preview:', script.substring(0, 100) + '...');

    // إضافة noscript fallback
    console.log('📝 [loadFacebookPixel] Creating noscript fallback...');
    const noscript = document.createElement('noscript');
    const img = document.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
    noscript.appendChild(img);
    
    console.log('📝 [loadFacebookPixel] Adding noscript to body...', {
      hasBody: !!document.body,
      noscriptUrl: img.src
    });
    
    document.body.appendChild(noscript);
    console.log('✅ [Facebook Pixel] Noscript fallback added');

    // التحقق من أن fbq متاح بعد تحميل الـ script
    const checkFbq = (attempt = 1) => {
      console.log(`🔍 [loadFacebookPixel] Checking fbq availability (attempt ${attempt}/5)...`, {
        hasWindow: typeof window !== 'undefined',
        hasFbq: typeof window !== 'undefined' && !!(window as any).fbq,
        windowType: typeof window
      });
      
      if (typeof window !== 'undefined' && (window as any).fbq) {
        console.log('✅ [Facebook Pixel] fbq function is available');
        console.log('✅ [Facebook Pixel] fbq type:', typeof (window as any).fbq);
        isInitialized = true;
        
        // Log the tracking URL that will be used
        console.log('🔗 [Facebook Pixel] Tracking URL:', `https://www.facebook.com/tr?id=${pixelId}&ev=PageView`);
        
        // Log all future event URLs
        const originalFbq = (window as any).fbq;
        (window as any).fbq = function(...args: any[]) {
          const eventName = args[1] || 'Unknown';
          console.log(`📤 [Facebook Pixel] Sending event: ${eventName}`, {
            url: `https://www.facebook.com/tr?id=${pixelId}&ev=${eventName}`,
            data: args[2] || {},
            options: args[3] || {},
            argsCount: args.length
          });
          return originalFbq.apply(this, args);
        };
        
        console.log('✅ [Facebook Pixel] fbq wrapper installed successfully');
      } else if (attempt < 5) {
        console.log(`⏳ [Facebook Pixel] Waiting for fbq (attempt ${attempt}/5)...`);
        setTimeout(() => checkFbq(attempt + 1), 500);
      } else {
        console.error('❌ [Facebook Pixel] fbq function failed to load after 5 attempts', {
          hasWindow: typeof window !== 'undefined',
          windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('fb')) : []
        });
      }
    };
    
    console.log('⏰ [loadFacebookPixel] Starting fbq check in 100ms...');
    setTimeout(() => checkFbq(), 100);
  } catch (error) {
    console.error('❌ [Facebook Pixel] Error loading script:', error);
    console.error('❌ [Facebook Pixel] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
};

/**
 * توليد Event ID فريد (للـ Deduplication)
 * نفس الـ ID سيُستخدم في Pixel و CAPI
 */
const generateEventId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * إرسال حدث PageView
 */
export const trackPageView = () => {
  console.log('🔍 [trackPageView] Function called', {
    isInitialized,
    hasWindow: typeof window !== 'undefined',
    hasFbq: typeof window !== 'undefined' && !!(window as any).fbq
  });
  
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    console.warn('⚠️ [trackPageView] Cannot track - Pixel not ready', {
      isInitialized,
      hasWindow: typeof window !== 'undefined',
      hasFbq: typeof window !== 'undefined' && !!(window as any).fbq
    });
    return;
  }

  const eventId = generateEventId();
  console.log('📊 [trackPageView] Calling fbq with eventId:', eventId);
  
  try {
    (window as any).fbq('track', 'PageView', {}, { eventID: eventId });
    console.log('✅ [Facebook Pixel] PageView tracked successfully', { eventId });
  } catch (error) {
    console.error('❌ [trackPageView] Error calling fbq:', error);
    return;
  }
  
  return eventId;
};

/**
 * إرسال حدث ViewContent (عرض منتج)
 */
export const trackViewContent = (product: {
  id: string;
  name: string;
  price: number;
  category?: string;
}) => {
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    return;
  }

  const eventId = generateEventId();
  (window as any).fbq('track', 'ViewContent', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    content_category: product.category || '',
    value: product.price,
    currency: 'EGP'
  }, { eventID: eventId });

  console.log('📊 [Facebook Pixel] ViewContent tracked', { 
    productId: product.id, 
    eventId 
  });

  return eventId;
};

/**
 * إرسال حدث AddToCart (إضافة للسلة)
 */
export const trackAddToCart = (product: {
  id: string;
  name: string;
  price: number;
  quantity?: number;
}) => {
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    return;
  }

  const eventId = generateEventId();
  (window as any).fbq('track', 'AddToCart', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    value: product.price * (product.quantity || 1),
    currency: 'EGP'
  }, { eventID: eventId });

  console.log('📊 [Facebook Pixel] AddToCart tracked', { 
    productId: product.id,
    quantity: product.quantity || 1,
    eventId 
  });

  return eventId;
};

/**
 * إرسال حدث InitiateCheckout (بدء عملية الشراء)
 */
export const trackInitiateCheckout = (cart: {
  items: Array<{ id: string; quantity: number; price: number }>;
  total: number;
}) => {
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    return;
  }

  const eventId = generateEventId();
  const contentIds = cart.items.map(item => item.id);
  const contents = cart.items.map(item => ({
    id: item.id,
    quantity: item.quantity,
    item_price: item.price
  }));

  (window as any).fbq('track', 'InitiateCheckout', {
    content_ids: contentIds,
    contents: contents,
    content_type: 'product',
    value: cart.total,
    currency: 'EGP',
    num_items: cart.items.length
  }, { eventID: eventId });

  console.log('📊 [Facebook Pixel] InitiateCheckout tracked', { 
    itemCount: cart.items.length,
    total: cart.total,
    eventId 
  });

  return eventId;
};

/**
 * إرسال حدث Purchase (إتمام الطلب) - الأهم!
 * @param order - بيانات الطلب
 * @param eventId - Event ID للـ Deduplication (اختياري)
 */
export const trackPurchase = (order: {
  orderNumber: string;
  items: Array<{ id: string; quantity: number; price: number }>;
  total: number;
}, eventId?: string) => {
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    return;
  }

  // Use provided eventId or generate new one
  const finalEventId = eventId || generateEventId();
  const contentIds = order.items.map(item => item.id);
  const contents = order.items.map(item => ({
    id: item.id,
    quantity: item.quantity,
    item_price: item.price
  }));

  (window as any).fbq('track', 'Purchase', {
    content_ids: contentIds,
    contents: contents,
    content_type: 'product',
    value: order.total,
    currency: 'EGP',
    num_items: order.items.length
  }, { eventID: finalEventId });

  console.log('✅ [Facebook Pixel] Purchase tracked', { 
    orderNumber: order.orderNumber,
    total: order.total,
    eventId: finalEventId,
    deduplication: eventId ? 'enabled' : 'disabled'
  });

  return finalEventId;
};

/**
 * إرسال حدث Search (البحث)
 */
export const trackSearch = (searchQuery: string) => {
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    return;
  }

  const eventId = generateEventId();
  (window as any).fbq('track', 'Search', {
    search_string: searchQuery
  }, { eventID: eventId });

  console.log('📊 [Facebook Pixel] Search tracked', { 
    query: searchQuery,
    eventId 
  });

  return eventId;
};

/**
 * إرسال حدث AddToWishlist (إضافة للمفضلة)
 */
export const trackAddToWishlist = (product: {
  id: string;
  name: string;
  price: number;
}) => {
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    return;
  }

  const eventId = generateEventId();
  (window as any).fbq('track', 'AddToWishlist', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    value: product.price,
    currency: 'EGP'
  }, { eventID: eventId });

  console.log('📊 [Facebook Pixel] AddToWishlist tracked', { 
    productId: product.id,
    eventId 
  });

  return eventId;
};

/**
 * التحقق من أن Pixel مُفعّل
 */
export const isPixelInitialized = (): boolean => {
  return isInitialized;
};

/**
 * الحصول على Pixel ID الحالي
 */
export const getPixelId = (): string | null => {
  return pixelId;
};

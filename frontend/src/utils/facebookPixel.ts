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
  if (isInitialized || !pixelIdParam) {
    return;
  }

  pixelId = pixelIdParam;

  // إضافة Pixel Script للصفحة
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
  `;

  const scriptElement = document.createElement('script');
  scriptElement.innerHTML = script;
  document.head.appendChild(scriptElement);

  // إضافة noscript fallback
  const noscript = document.createElement('noscript');
  const img = document.createElement('img');
  img.height = 1;
  img.width = 1;
  img.style.display = 'none';
  img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.body.appendChild(noscript);

  isInitialized = true;
  console.log('✅ [Facebook Pixel] Initialized with ID:', pixelId);
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
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    return;
  }

  const eventId = generateEventId();
  (window as any).fbq('track', 'PageView', {}, { eventID: eventId });
  
  console.log('📊 [Facebook Pixel] PageView tracked', { eventId });
  
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
 */
export const trackPurchase = (order: {
  orderNumber: string;
  items: Array<{ id: string; quantity: number; price: number }>;
  total: number;
}) => {
  if (!isInitialized || typeof window === 'undefined' || !(window as any).fbq) {
    return;
  }

  const eventId = generateEventId();
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
  }, { eventID: eventId });

  console.log('✅ [Facebook Pixel] Purchase tracked', { 
    orderNumber: order.orderNumber,
    total: order.total,
    eventId 
  });

  return eventId;
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

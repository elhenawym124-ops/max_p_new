/**
 * Store URL Utilities
 * Helper functions for building store URLs with subdomain support
 */

/**
 * Get the base domain
 */
export const getBaseDomain = (): string => {
  // في Production استخدم domain الحقيقي
  if (window.location.hostname.includes('mokhtarelhenawy.online')) {
    return 'mokhtarelhenawy.online';
  }
  
  // في Development استخدم localhost
  return 'localhost:3000';
};

/**
 * Get current subdomain from URL
 */
export const getCurrentSubdomain = (): string | null => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Check if we have a subdomain (and not www)
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0];
  }
  
  return null;
};

/**
 * Check if we're on a subdomain
 */
export const isSubdomain = (): boolean => {
  return getCurrentSubdomain() !== null;
};

/**
 * Build store URL with subdomain
 * @param slug - Store slug
 * @param path - Path (e.g., '/shop', '/product/123')
 * @returns Full URL with subdomain
 */
export const buildStoreUrl = (identifier: string, path: string = '/'): string => {
  const baseDomain = getBaseDomain();
  const protocol = window.location.protocol;
  
  // حفظ identifier في localStorage إذا كان موجوداً
  if (identifier) {
    localStorage.setItem('storefront_companyId', identifier);
  }
  
  // في Development أو إذا كان identifier يبدو كـ ID طويل (أكثر من 20 حرف)
  // استخدم path بسيط بدون companyId في URL
  if (baseDomain.includes('localhost') || identifier.length > 20) {
    return path;
  }
  
  // في Production مع slug قصير، استخدم subdomain
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${identifier}.${baseDomain}${cleanPath}`;
};

/**
 * Build shop link (for navigation)
 * @param companyId - Company ID or slug (optional, will be saved to localStorage)
 * @returns URL for shop page
 */
export const buildShopLink = (companyId?: string): string => {
  // حفظ companyId في localStorage إذا كان موجوداً
  if (companyId) {
    localStorage.setItem('storefront_companyId', companyId);
  }
  
  // دائماً استخدم path بسيط بدون companyId في URL
  return '/shop';
};

/**
 * Build product link
 * @param productId - Product ID
 * @param companyId - Company ID (optional, will be saved to localStorage)
 * @returns URL for product details page
 */
export const buildProductLink = (productId: string, companyId?: string): string => {
  // حفظ companyId في localStorage إذا كان موجوداً
  if (companyId) {
    localStorage.setItem('storefront_companyId', companyId);
  }
  
  // دائماً استخدم path بسيط بدون companyId في URL
  return `/product/${productId}`;
};

/**
 * Build cart link
 * @param companyId - Company ID (optional, will be saved to localStorage)
 * @returns URL for cart page
 */
export const buildCartLink = (companyId?: string): string => {
  // حفظ companyId في localStorage إذا كان موجوداً
  if (companyId) {
    localStorage.setItem('storefront_companyId', companyId);
  }
  
  // دائماً استخدم path بسيط بدون companyId في URL
  return '/cart';
};

/**
 * Build checkout link
 * @param companyId - Company ID (optional, will be saved to localStorage)
 * @returns URL for checkout page
 */
export const buildCheckoutLink = (companyId?: string): string => {
  // حفظ companyId في localStorage إذا كان موجوداً
  if (companyId) {
    localStorage.setItem('storefront_companyId', companyId);
  }
  
  // دائماً استخدم path بسيط بدون companyId في URL
  return '/checkout';
};

/**
 * Get company identifier from URL
 * Checks subdomain first, then query parameter
 */
export const getCompanyIdentifier = (): string | null => {
  // Try subdomain first
  const subdomain = getCurrentSubdomain();
  if (subdomain) {
    return subdomain;
  }
  
  // Fallback to query parameter
  const params = new URLSearchParams(window.location.search);
  return params.get('companyId');
};

/**
 * Navigate to store (external navigation with full URL)
 * @param slug - Store slug
 * @param path - Optional path (default: '/shop')
 */
export const navigateToStore = (slug: string, path: string = '/shop'): void => {
  const url = buildStoreUrl(slug, path);
  
  // إذا كان URL كامل (يحتوي على protocol)، استخدم window.location
  if (url.startsWith('http')) {
    window.location.href = url;
  } else {
    // إذا كان path نسبي، استخدم navigation عادي
    window.location.href = url;
  }
};

/**
 * Get store URL for sharing
 * @param slug - Store slug
 * @returns Full store URL
 */
export const getShareableStoreUrl = (slug: string): string => {
  const baseDomain = getBaseDomain();
  
  // في Production، استخدم subdomain
  if (!baseDomain.includes('localhost')) {
    return `https://${slug}.${baseDomain}/shop`;
  }
  
  // في Development، استخدم path بسيط (companyId سيُحفظ في localStorage عند الزيارة)
  return `${window.location.origin}/shop`;
};

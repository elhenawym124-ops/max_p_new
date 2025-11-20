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
  
  // في Development أو إذا كان identifier يبدو كـ ID طويل (أكثر من 20 حرف)
  // استخدم query parameter كـ fallback
  if (baseDomain.includes('localhost') || identifier.length > 20) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}companyId=${identifier}`;
  }
  
  // في Production مع slug قصير، استخدم subdomain
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${identifier}.${baseDomain}${cleanPath}`;
};

/**
 * Build shop link (for navigation)
 * @param companyId - Company ID or slug
 * @returns URL for shop page
 */
export const buildShopLink = (companyId: string): string => {
  // في Production مع subdomain، استخدم path بسيط
  if (isSubdomain()) {
    return '/shop';
  }
  
  // Fallback: استخدم query parameter
  return `/shop?companyId=${companyId}`;
};

/**
 * Build product link
 * @param productId - Product ID
 * @param companyId - Company ID (optional if on subdomain)
 * @returns URL for product details page
 */
export const buildProductLink = (productId: string, companyId?: string): string => {
  const basePath = `/product/${productId}`;
  
  // إذا كنا على subdomain، استخدم path بسيط
  if (isSubdomain()) {
    return basePath;
  }
  
  // إذا كان لدينا companyId، أضفه
  if (companyId) {
    return `${basePath}?companyId=${companyId}`;
  }
  
  return basePath;
};

/**
 * Build cart link
 * @param companyId - Company ID (optional if on subdomain)
 * @returns URL for cart page
 */
export const buildCartLink = (companyId?: string): string => {
  const basePath = '/cart';
  
  if (isSubdomain()) {
    return basePath;
  }
  
  if (companyId) {
    return `${basePath}?companyId=${companyId}`;
  }
  
  return basePath;
};

/**
 * Build checkout link
 * @param companyId - Company ID (optional if on subdomain)
 * @returns URL for checkout page
 */
export const buildCheckoutLink = (companyId?: string): string => {
  const basePath = '/checkout';
  
  if (isSubdomain()) {
    return basePath;
  }
  
  if (companyId) {
    return `${basePath}?companyId=${companyId}`;
  }
  
  return basePath;
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
  
  if (baseDomain.includes('localhost')) {
    return `${window.location.origin}/shop?companyId=${slug}`;
  }
  
  return `https://${slug}.${baseDomain}/shop`;
};

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Footer from '../common/Footer';
import { useFacebookPixel } from '../../hooks/useFacebookPixel';
import { getCompanyId } from '../../utils/storefrontApi';

interface StorefrontLayoutProps {
  children: React.ReactNode;
}

const StorefrontLayout: React.FC<StorefrontLayoutProps> = ({ children }) => {
  const [searchParams] = useSearchParams();
  
  // الحصول على companyId من URL أو من getCompanyId
  const companyIdFromUrl = searchParams.get('companyId');
  const companyId = companyIdFromUrl || getCompanyId();
  
  // Debug logging
  const currentPath = window.location.pathname;
  const isShopPage = currentPath === '/shop' || currentPath.startsWith('/shop/');
  
  console.log('🔍 [StorefrontLayout] Component rendered', {
    companyIdFromUrl,
    companyIdFromGetCompanyId: getCompanyId(),
    finalCompanyId: companyId,
    url: window.location.href,
    pathname: currentPath,
    isShopPage,
    searchParams: Object.fromEntries(searchParams.entries())
  });
  
  // تحميل Facebook Pixel
  if (companyId) {
    console.log('📊 [StorefrontLayout] Loading Facebook Pixel for company:', companyId);
    if (isShopPage) {
      console.log('🛍️ [StorefrontLayout] Shop page detected - Pixel tracking should work here');
    }
  } else {
    console.warn('⚠️ [StorefrontLayout] No companyId found - Pixel will not load');
  }
  
  useFacebookPixel(companyId || undefined);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* StorefrontNav is now used directly in each page */}
      <main className="pb-8">
        {children}
      </main>
      
      {/* Dynamic Footer */}
      <Footer />
    </div>
  );
};

export default StorefrontLayout;

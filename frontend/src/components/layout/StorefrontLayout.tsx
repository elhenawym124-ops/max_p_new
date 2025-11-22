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
  console.log('🔍 [StorefrontLayout] Component rendered', {
    companyIdFromUrl,
    companyIdFromGetCompanyId: getCompanyId(),
    finalCompanyId: companyId,
    url: window.location.href,
    searchParams: Object.fromEntries(searchParams.entries())
  });
  
  // تحميل Facebook Pixel
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

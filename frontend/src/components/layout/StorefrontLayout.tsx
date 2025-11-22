import React from 'react';
import Footer from '../common/Footer';

interface StorefrontLayoutProps {
  children: React.ReactNode;
}

const StorefrontLayout: React.FC<StorefrontLayoutProps> = ({ children }) => {
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

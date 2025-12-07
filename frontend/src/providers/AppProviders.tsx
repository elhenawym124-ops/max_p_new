import React, { ReactNode } from 'react';
import { AuthProvider } from '../hooks/useAuthSimple';
import { CompanyProvider } from '../contexts/CompanyContext';
import { ThemeProvider } from '../hooks/useTheme';

interface AppProvidersProps {
  children: ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      <CompanyProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </CompanyProvider>
    </AuthProvider>
  );
};

export default AppProviders;

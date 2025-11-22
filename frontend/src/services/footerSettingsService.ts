import { apiClient } from './apiClient';

export interface FooterSettings {
  id?: string;
  companyId?: string;
  aboutStore?: string;
  showAboutStore: boolean;
  email?: string;
  showEmail: boolean;
  phone?: string;
  showPhone: boolean;
  address?: string;
  showAddress: boolean;
  showQuickLinks: boolean;
  copyrightText?: string;
  showCopyright: boolean;
  createdAt?: string;
  updatedAt?: string;
}

class FooterSettingsService {
  /**
   * Get footer settings
   */
  async getSettings() {
    return apiClient.get<{ data: FooterSettings }>('/footer-settings');
  }

  /**
   * Update footer settings
   */
  async updateSettings(data: Partial<FooterSettings>) {
    return apiClient.put<{ data: FooterSettings }>('/footer-settings', data);
  }

  /**
   * Reset footer settings to defaults
   */
  async resetSettings() {
    return apiClient.post<{ data: FooterSettings }>('/footer-settings/reset');
  }

  /**
   * Get public footer settings (for storefront)
   */
  async getPublicSettings(companyId: string) {
    // Use storefrontFetch for public routes (no authentication required)
    const { storefrontFetch } = await import('../utils/storefrontApi');
    // Route structure: /api/v1/public/footer-settings/public/:companyId
    // The route in server.js is: /api/v1/public/footer-settings
    // The route in footerSettingsRoutes.js is: /public/:companyId
    // So the full path is: /footer-settings/public/:companyId
    return storefrontFetch(`/footer-settings/public/${companyId}`);
  }
}

export const footerSettingsService = new FooterSettingsService();

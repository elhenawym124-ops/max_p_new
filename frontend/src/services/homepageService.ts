import { apiClient } from './apiClient';
import axios from 'axios';
import { config } from '../config';

export interface HomepageSection {
  id: string;
  type: 'hero' | 'features' | 'products' | 'banner' | 'categories' | 'testimonials' | 'custom';
  [key: string]: any;
}

export interface HomepageContent {
  sections: HomepageSection[];
  settings: {
    containerWidth: 'full' | 'contained';
    spacing: 'compact' | 'normal' | 'relaxed';
    animation: boolean;
  };
}

export interface HomepageTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  content: HomepageContent;
  thumbnail?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const homepageService = {
  // Get all homepage templates
  getTemplates: async () => {
    return apiClient.get<{ data: HomepageTemplate[] }>('/homepage/templates');
  },

  // Get active homepage template
  getActiveTemplate: async () => {
    return apiClient.get<{ data: HomepageTemplate }>('/homepage/active');
  },

  // Get public active homepage (for storefront) - NO AUTH REQUIRED
  getPublicActiveTemplate: async (companyId: string) => {
    return axios.get<{ data: HomepageTemplate }>(`${config.apiUrl}/homepage/public/${companyId}`);
  },

  // Create new homepage template
  createTemplate: async (data: Partial<HomepageTemplate>) => {
    return apiClient.post<{ data: HomepageTemplate }>('/homepage/templates', data);
  },

  // Create demo template
  createDemoTemplate: async () => {
    return apiClient.post<{ data: HomepageTemplate }>('/homepage/templates/demo', {});
  },

  // Update homepage template
  updateTemplate: async (id: string, data: Partial<HomepageTemplate>) => {
    return apiClient.put<{ data: HomepageTemplate }>(`/homepage/templates/${id}`, data);
  },

  // Set active homepage template
  setActiveTemplate: async (id: string) => {
    return apiClient.put<{ data: HomepageTemplate }>(`/homepage/templates/${id}/activate`, {});
  },

  // Duplicate homepage template
  duplicateTemplate: async (id: string) => {
    return apiClient.post<{ data: HomepageTemplate }>(`/homepage/templates/${id}/duplicate`, {});
  },

  // Delete homepage template
  deleteTemplate: async (id: string) => {
    return apiClient.delete(`/homepage/templates/${id}`);
  }
};

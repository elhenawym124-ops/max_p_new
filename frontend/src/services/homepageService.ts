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
  isSystem?: boolean; // New field to identify global system templates
  createdAt: string;
  updatedAt: string;
}

export const homepageService = {
  // Get all homepage templates (Company specific)
  getTemplates: async () => {
    return apiClient.get<{ data: HomepageTemplate[] }>('/homepage/templates');
  },

  // Get system templates (Global) - Mocked for now
  getSystemTemplates: async () => {
    // In a real app, this would be GET /homepage/templates/system
    // returning templates where isSystem = true
    return new Promise<{ data: HomepageTemplate[] }>((resolve) => {
      setTimeout(() => {
        resolve({
          data: [
            {
              id: 'sys_1',
              companyId: 'system',
              name: 'متجر إلكترونيات عصري',
              description: 'قالب مثالي للمتاجر التقنية، يركز على المواصفات والصور الكبيرة.',
              content: {
                sections: [
                  { id: 's1', type: 'hero' },
                  { id: 's2', type: 'features' },
                  { id: 's3', type: 'products' }
                ],
                settings: {
                  containerWidth: 'full',
                  spacing: 'normal',
                  animation: true
                }
              },
              thumbnail: 'https://placehold.co/600x400/10b981/ffffff?text=Electronics+Theme',
              isActive: false,
              isSystem: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 'sys_2',
              companyId: 'system',
              name: 'بوتيك أزياء',
              description: 'تصميم أنيق وبسيط لعرض الملابس والموضة.',
              content: {
                sections: [
                  { id: 's1', type: 'banner' },
                  { id: 's2', type: 'categories' },
                  { id: 's3', type: 'products' }
                ],
                settings: {
                  containerWidth: 'contained',
                  spacing: 'relaxed',
                  animation: true
                }
              },
              thumbnail: 'https://placehold.co/600x400/8b5cf6/ffffff?text=Fashion+Boutique',
              isActive: false,
              isSystem: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        });
      }, 500);
    });
  },

  // Simulate harvesting/promoting a template
  promoteToSystem: async (templateId: string) => {
    // POST /admin/homepage/promote/${templateId}
    return new Promise((resolve) => setTimeout(resolve, 800));
  },

  // Import a system template to company
  importSystemTemplate: async (systemTemplateId: string) => {
    // This effectively duplicates a system template into the company's templates
    // POST /homepage/templates/import/${systemTemplateId}
    // We can simulate this by calling duplicate but assuming backend handles the source
    return apiClient.post<{ data: HomepageTemplate }>(`/homepage/templates/import-system`, { systemTemplateId });
  },

  // Get active homepage template
  getActiveTemplate: async () => {
    return apiClient.get<{ data: HomepageTemplate }>('/homepage/active');
  },

  // Get public active homepage (for storefront) - NO AUTH REQUIRED
  getPublicActiveTemplate: async (companyId: string) => {
    // config.apiUrl already includes /api/v1, so we just need /homepage/public/...
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

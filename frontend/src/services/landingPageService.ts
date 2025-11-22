import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export interface LandingPage {
  id: string;
  companyId: string;
  productId?: string;
  title: string;
  slug: string;
  content: any; // JSON content from Page Builder
  isPublished: boolean;
  views: number;
  conversions: number;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    image: string;
    price: number;
  };
}

export interface LandingPageStats {
  total: number;
  published: number;
  totalViews: number;
  totalConversions: number;
  conversionRate: string;
  topPages: Array<{
    id: string;
    title: string;
    slug: string;
    views: number;
    conversions: number;
  }>;
}

// إنشاء صفحة جديدة
export const createLandingPage = async (data: {
  title: string;
  slug: string;
  content: any;
  productId?: string;
  metaTitle?: string;
  metaDescription?: string;
}): Promise<LandingPage> => {
  const response = await axios.post(`${API_URL}/landing-pages`, data);
  return response.data;
};

// جلب جميع الصفحات
export const getAllLandingPages = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  productId?: string;
}): Promise<{
  pages: LandingPage[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> => {
  const response = await axios.get(`${API_URL}/landing-pages`, { params });
  return response.data;
};

// جلب صفحة واحدة
export const getLandingPage = async (id: string): Promise<LandingPage> => {
  const response = await axios.get(`${API_URL}/landing-pages/${id}`);
  return response.data;
};

// تحديث صفحة
export const updateLandingPage = async (
  id: string,
  data: Partial<LandingPage>
): Promise<LandingPage> => {
  const response = await axios.put(`${API_URL}/landing-pages/${id}`, data);
  return response.data;
};

// حذف صفحة
export const deleteLandingPage = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/landing-pages/${id}`);
};

// نشر/إلغاء نشر
export const togglePublish = async (id: string): Promise<LandingPage> => {
  const response = await axios.post(`${API_URL}/landing-pages/${id}/toggle-publish`);
  return response.data;
};

// نسخ صفحة
export const duplicateLandingPage = async (id: string): Promise<LandingPage> => {
  const response = await axios.post(`${API_URL}/landing-pages/${id}/duplicate`);
  return response.data;
};

// جلب صفحة عامة (بدون authentication)
export const getPublicLandingPage = async (slug: string): Promise<LandingPage> => {
  const response = await axios.get(`${API_URL}/landing-pages/public/${slug}`);
  return response.data;
};

// تسجيل تحويل
export const recordConversion = async (slug: string, type?: string): Promise<void> => {
  await axios.post(`${API_URL}/landing-pages/public/${slug}/conversion`, { type });
};

// جلب الإحصائيات
export const getLandingPageStats = async (): Promise<LandingPageStats> => {
  const response = await axios.get(`${API_URL}/landing-pages/stats`);
  return response.data;
};

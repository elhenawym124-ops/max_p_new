import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { config } from '../config';

/**
 * API Client
 * 
 * Centralized HTTP client with interceptors for authentication,
 * error handling, and request/response transformation
 */

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token to requests
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else if (import.meta.env.DEV) {
          // Mock token for development - updated with correct company ID
          const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWVtOGF6bHYwMDRldWZha2JrbzB3bW4xIiwiZW1haWwiOiJhbGlAYWxpLmNvbSIsInJvbGUiOiJDT01QQU5ZX0FETUlOIiwiY29tcGFueUlkIjoiY21lbThheXlyMDA0Y3VmYWtxa2NzeW45NyIsImlhdCI6MTc2NTQxOTc2MCwiZXhwIjo0OTIxMTc5NzYwfQ.luOHZEb2BgHS35j2Vn6GiazVwKUOy4Eqm5nR-WmrDVk';
          config.headers.Authorization = `Bearer ${mockToken}`;
          console.log('🔧 Using mock token for development');
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        // Log request in development
        // if (import.meta.env.DEV) {
        //   console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, {
        //     data: config.data,
        //     params: config.params,
        //   });
        // }

        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Log response in development
        // if (import.meta.env.DEV) {
        //   console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        //     status: response.status,
        //     data: response.data,
        //   });
        // }

        return response;
      },
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

        // Enhanced error logging in development
        if (import.meta.env.DEV) {
          console.error(`❌ ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            headers: originalRequest?.headers
          });

          // Handle specific error cases with detailed logging
          if (error.response?.status === 401) {
            console.error('🔒 Authentication failed - token may be invalid or expired');
          } else if (error.response?.status === 403) {
            console.error('🚫 Access denied - insufficient permissions');
            console.error('SERVER RESPONSE:', JSON.stringify(error.response.data));
            // Force logout on 403 to fix permission issues
            this.handleAuthError();
          } else if (error.response?.status === 503) {
            console.error('⏳ Database temporarily unavailable - will retry');
          } else if (error.response?.status === 500) {
            console.error('🔥 Server error occurred');
            console.error('🔥 Error details:', error.response?.data);
            if (error.response?.data?.details) {
              console.error('🔥 Error details (dev):', error.response.data.details);
            }
          }
        }

        // Handle 503 Service Unavailable (database connection issues) with retry
        if (error.response?.status === 503) {
          const retryCount = originalRequest._retryCount || 0;
          const maxRetries = 3;

          if (retryCount < maxRetries) {
            originalRequest._retryCount = retryCount + 1;
            const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff: 1s, 2s, 4s (max 5s)

            console.log(`🔄 Retrying request (${retryCount + 1}/${maxRetries}) after ${delay}ms...`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return this.client(originalRequest);
          }
        }

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue the request
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return this.client(originalRequest);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
              throw new Error('No refresh token');
            }

            const response = await axios.post(`${config.apiUrl}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data;

            // Update tokens
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', newRefreshToken);

            // Process failed queue
            this.processQueue(null, accessToken);

            // Retry original request
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout user
            this.processQueue(refreshError, null);
            this.handleAuthError();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // Handle other errors
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: any, token: string | null): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });

    this.failedQueue = [];
  }

  private handleAuthError(): void {
    // Clear tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // Dispatch auth error event
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));

    // Redirect to login (if not already there AND not on public storefront routes)
    const currentPath = window.location.pathname;
    const isPublicRoute =
      currentPath.startsWith('/test-public') ||
      currentPath.startsWith('/home') ||
      currentPath.startsWith('/shop') ||
      currentPath.startsWith('/auth/') ||
      currentPath.startsWith('/super-admin/login') ||
      currentPath.startsWith('/payment/');

    if (!isPublicRoute) {
      window.location.href = '/auth/login';
    }
  }

  private handleError(error: AxiosError<ApiError>): void {
    const status = error.response?.status;
    const errorData = error.response?.data;
    const originalRequest = error.config as AxiosRequestConfig & { _skipErrorToast?: boolean };

    // Don't show toast for certain errors (503 is retried automatically)
    const silentErrors = [401, 404, 503];
    if (silentErrors.includes(status || 0)) {
      return;
    }

    // Don't show toast if explicitly skipped (e.g., for markAsRead timeouts)
    if (originalRequest._skipErrorToast) {
      return;
    }

    // Don't show toast for timeout errors on markAsRead endpoint
    if (error.message?.includes('timeout') && originalRequest.url?.includes('/whatsapp/messages/read')) {
      return;
    }

    // Show error toast - check both error.message and message (backend sends message directly)
    const message = errorData?.error?.message || errorData?.message || 'حدث خطأ غير متوقع';

    if (status && status >= 500) {
      toast.error('خطأ في الخادم. يرجى المحاولة لاحقاً');
    } else {
      toast.error(message);
    }
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  // File upload
  async upload<T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<AxiosResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }

  // Download file
  async download(url: string, filename?: string): Promise<void> {
    const response = await this.client.get(url, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Cancel request
  createCancelToken() {
    return axios.CancelToken.source();
  }
}

export const apiClient = new ApiClient();

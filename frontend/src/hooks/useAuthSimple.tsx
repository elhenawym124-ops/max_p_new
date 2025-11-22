import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { getApiUrl } from '../config/environment';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  company: {
    id: string;
    name: string;
    slug: string | null; // ✅ FIX: إضافة slug للـ interface
    plan: string;
  };
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials | User, token?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔍 [AuthProvider] Starting auth check...');
      let finalUser: User | null = null;
      
      try {
        const token = localStorage.getItem('accessToken');
        console.log('🔍 [AuthProvider] Token exists:', !!token);
        console.log('🔍 [AuthProvider] Token preview:', token ? token.substring(0, 20) + '...' : 'null');

        if (token) {
          // Call real API to get current user
          const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
          if (isDevelopment) {
            console.log('🔍 [AuthProvider] Making /auth/me request...');
          }
          
          const response = await fetch(`${getApiUrl()}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (isDevelopment) {
              console.log('🔍 [AuthProvider] Response data:', data);
            }

            if (data.success) {
              if (isDevelopment) {
                console.log('✅ [AuthProvider] Setting user:', data.data);
              }
              finalUser = data.data;
              setUser(data.data);
              console.log('✅ [AuthProvider] User set successfully, isAuthenticated should be true now');
              console.log('✅ [AuthProvider] User data:', JSON.stringify(data.data, null, 2));
            } else {
              // Token invalid or expired - silently clear it
              console.warn('⚠️ [AuthProvider] API returned success: false, clearing tokens');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              setUser(null);
              finalUser = null;
            }
          } else if (response.status === 403 || response.status === 401) {
            // Token expired or invalid - silently clear it (this is expected)
            console.warn('⚠️ [AuthProvider] Token expired or invalid (401/403), clearing tokens');
            console.warn('⚠️ [AuthProvider] Response status:', response.status);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
            finalUser = null;
            if (isDevelopment) {
              console.log('🔐 [AuthProvider] Token expired or invalid, cleared');
            }
          } else {
            // Other errors - log and handle
            console.warn('⚠️ [AuthProvider] Auth check failed with status:', response.status);
            try {
              const errorData = await response.text();
              console.warn('⚠️ [AuthProvider] Error response:', errorData);
            } catch (e) {
              // Ignore if can't read response
            }
            
            // Only clear tokens if it's a clear auth error (4xx)
            if (response.status >= 400 && response.status < 500) {
              console.warn('⚠️ [AuthProvider] Client error (4xx), clearing tokens');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              setUser(null);
              finalUser = null;
            } else {
              // Server error (5xx) - might be temporary, keep tokens
              console.warn('⚠️ [AuthProvider] Server error (5xx), keeping tokens for retry');
              setUser(null);
              finalUser = null;
            }
          }
        } else {
          const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
          if (isDevelopment) {
            console.log('🔐 [AuthProvider] No token found');
          }
        }
      } catch (error: any) {
        // Network errors or other issues - log
        console.error('❌ [AuthProvider] Auth check failed:', error);
        console.error('❌ [AuthProvider] Error details:', {
          message: error?.message || 'Unknown error',
          name: error?.name || 'Error',
          stack: error?.stack || 'No stack trace'
        });
        
        // Don't clear tokens on network errors - might be temporary
        // Only clear if it's a clear authentication error
        if (error?.message && error.message.includes('401')) {
          console.warn('⚠️ [AuthProvider] 401 error detected, clearing tokens');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
          finalUser = null;
        } else {
          console.warn('⚠️ [AuthProvider] Network error - keeping tokens, user will be null');
          // Keep tokens but set user to null - will retry on next check
          setUser(null);
          finalUser = null;
        }
      } finally {
        console.log('🔍 [AuthProvider] Final user state:', finalUser ? 'exists' : 'null');
        console.log('🔍 [AuthProvider] Final isAuthenticated:', !!finalUser);
        
        // Ensure user is set before setting loading to false
        // This prevents race condition where isAuthenticated is false when isLoading becomes false
        if (finalUser) {
          console.log('✅ [AuthProvider] User exists, ensuring it\'s set before setting loading to false');
          // User should already be set above, but ensure it's set
          if (!user || user.id !== finalUser.id) {
            setUser(finalUser);
          }
          // Small delay to ensure state update propagates
          setTimeout(() => {
            setIsLoading(false);
            console.log('✅ [AuthProvider] Loading set to false, isAuthenticated should be true');
          }, 50);
        } else {
          setIsLoading(false);
          console.log('⚠️ [AuthProvider] No user, loading set to false, isAuthenticated will be false');
        }
        
        // Log after a short delay to see if state updated
        setTimeout(() => {
          console.log('🔍 [AuthProvider] After 500ms - checking if user state updated...');
        }, 500);
      }
    };

    checkAuth();
  }, []); // Empty dependency array - only run once on mount

  const login = async (credentials: LoginCredentials | User, token?: string) => {
    console.log('🔍 [AuthProvider] Starting login...');
    try {
      // If user and token are provided directly (for Super Admin)
      if (token && typeof credentials === 'object' && 'id' in credentials) {
        console.log('🔍 [AuthProvider] Direct login with token');
        localStorage.setItem('accessToken', token);
        setUser(credentials as User);
        return;
      }

      // Normal login flow
      const loginCredentials = credentials as LoginCredentials;
      console.log('🔍 [AuthProvider] Normal login for:', loginCredentials.email);

      const response = await fetch(`${getApiUrl()}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: loginCredentials.email,
          password: loginCredentials.password
        })
      });

      console.log('🔍 [AuthProvider] Login response status:', response.status);
      
      // Handle network errors
      if (!response.ok) {
        let errorMessage = 'فشل في تسجيل الدخول';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || `خطأ في الاتصال (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('🔍 [AuthProvider] Login response data:', data);

      if (data.success) {
        // Store tokens
        console.log('✅ [AuthProvider] Login successful, storing token');
        localStorage.setItem('accessToken', data.data.token);

        // Set user data
        console.log('✅ [AuthProvider] Setting user data:', data.data.user);
        setUser(data.data.user);
        
        // Store user data in localStorage for Socket.IO connection
        localStorage.setItem('user', JSON.stringify(data.data.user));
      } else {
        throw new Error(data.message || 'فشل في تسجيل الدخول');
      }
    } catch (error: any) {
      console.error('❌ [AuthProvider] Login error:', error);
      // Provide better error message for network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('فشل الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.');
      }
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await fetch(`${getApiUrl()}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'فشل في إنشاء الحساب');
      }

      // Store token and user data
      localStorage.setItem('accessToken', result.data.token);
      setUser(result.data.user);

      return result;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        // Call logout API
        await fetch(`${getApiUrl()}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage and user state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { config } from '../../config';

const HomepageSimple: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get companyId from URL or localStorage
    let companyId = searchParams.get('companyId');
    
    console.log('🏠 [HomepageSimple] URL companyId:', companyId);
    console.log('🏠 [HomepageSimple] localStorage currentCompanyId:', localStorage.getItem('currentCompanyId'));
    console.log('🏠 [HomepageSimple] All URL params:', Object.fromEntries(searchParams.entries()));
    
    if (!companyId) {
      // Try to get from localStorage
      const storedId = localStorage.getItem('currentCompanyId');
      console.log('🏠 [HomepageSimple] Using stored ID:', storedId);
      companyId = storedId;
    }
    
    if (!companyId) {
      // Default fallback
      console.log('🏠 [HomepageSimple] Using default fallback ID');
      companyId = 'cmem8ayyr004cufakqkcsyn97';
    }
    
    console.log('🏠 [HomepageSimple] Final companyId:', companyId);
    
    // Save to localStorage for future use (only if it looks like a valid ID)
    if (companyId && companyId.startsWith('cm')) {
      localStorage.setItem('currentCompanyId', companyId);
    }
    
    loadHomepage(companyId);
  }, [searchParams]);

  const loadHomepage = async (companyId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `${config.apiUrl}/homepage/public/${companyId}`;
      console.log('🏠 [HomepageSimple] Fetching:', url);
      
      const response = await axios.get(url);
      console.log('🏠 [HomepageSimple] Response:', response.data);
      
      setData(response.data.data);
      
    } catch (err: any) {
      console.error('🏠 [HomepageSimple] Error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#4f46e5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: '16px', color: '#6b7280' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>خطأ</h2>
          <p style={{ color: '#6b7280' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            لا توجد صفحة رئيسية
          </h2>
          <p style={{ color: '#6b7280' }}>لم يتم إنشاء صفحة رئيسية لهذا المتجر بعد</p>
        </div>
      </div>
    );
  }

  const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#4f46e5',
        color: 'white',
        padding: '24px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
          {data.name}
        </h1>
        {data.description && (
          <p style={{ marginTop: '8px', opacity: 0.9 }}>{data.description}</p>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '2px solid #86efac',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534', marginBottom: '8px' }}>
            ✅ نجح! الصفحة الرئيسية تعمل!
          </h2>
          <p style={{ color: '#15803d' }}>
            تم تحميل الصفحة الرئيسية بنجاح بدون تسجيل دخول
          </p>
        </div>

        {/* Sections Info */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
            معلومات الصفحة:
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <strong>عدد الأقسام:</strong> {content.sections?.length || 0}
            </div>
            <div>
              <strong>عرض الحاوية:</strong> {content.settings?.containerWidth || 'N/A'}
            </div>
            <div>
              <strong>المسافات:</strong> {content.settings?.spacing || 'N/A'}
            </div>
            <div>
              <strong>الحركات:</strong> {content.settings?.animation ? 'مفعلة' : 'معطلة'}
            </div>
          </div>
        </div>

        {/* Sections List */}
        {content.sections && content.sections.length > 0 && (
          <div style={{
            marginTop: '32px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
              الأقسام:
            </h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {content.sections.map((section: any, index: number) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {index + 1}. {section.title || section.type}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    النوع: {section.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default HomepageSimple;

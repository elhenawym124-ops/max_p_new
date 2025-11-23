import React from 'react';

const TestPublic: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f0f0'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '32px', color: '#10B981', marginBottom: '20px' }}>
          ✅ نجح!
        </h1>
        <p style={{ fontSize: '18px', color: '#333', marginBottom: '10px' }}>
          هذه صفحة عامة بدون أي authentication
        </p>
        <p style={{ fontSize: '14px', color: '#666' }}>
          إذا رأيت هذه الرسالة، فالصفحة تعمل بشكل صحيح
        </p>
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#EFF6FF',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '16px', color: '#1E40AF', fontWeight: 'bold' }}>
            🎉 لم يتم التحويل لصفحة تسجيل الدخول!
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestPublic;

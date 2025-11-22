/**
 * 🧪 سكربت اختبار بسيط لصفحة إدارة التقييمات
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3007/api/v1';
const TEST_EMAIL = process.env.TEST_EMAIL || 'ali@ali.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password';

let authToken = null;

console.log('\n🧪 بدء اختبار صفحة إدارة التقييمات\n');

// Test 0: Check server
async function testServer() {
  console.log('🔍 Test 0: التحقق من الخادم...');
  try {
    const response = await axios.get(`${API_URL.replace('/api/v1', '')}/health`, { timeout: 3000 });
    console.log('✅ الخادم يعمل\n');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ الخادم غير متصل');
      console.log('   تأكد من تشغيل الخادم: cd backend && npm start\n');
    } else {
      console.log(`⚠️  لا يمكن التحقق من حالة الخادم: ${error.message}\n`);
    }
    return false;
  }
}

// Test 1: Login
async function testLogin() {
  console.log('🔍 Test 1: تسجيل الدخول...');
  console.log(`   Email: ${TEST_EMAIL}`);
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }, { timeout: 5000 });

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      console.log('✅ تم تسجيل الدخول بنجاح\n');
      return true;
    } else {
      console.log('❌ فشل تسجيل الدخول - بيانات غير صحيحة\n');
      return false;
    }
  } catch (error) {
    if (error.response) {
      console.log(`❌ فشل تسجيل الدخول: ${error.response.status} ${error.response.statusText}`);
      if (error.response.status === 401) {
        console.log('   تأكد من صحة بيانات المستخدم (Email/Password)\n');
      }
    } else {
      console.log(`❌ فشل تسجيل الدخول: ${error.message}\n`);
    }
    return false;
  }
}

// Test 2: Get Reviews
async function testGetReviews() {
  console.log('🔍 Test 2: جلب التقييمات (GET /reviews)...');
  try {
    const response = await axios.get(`${API_URL}/reviews`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        page: 1,
        limit: 10
      }
    });

    if (response.data.success) {
      console.log('✅ تم جلب التقييمات بنجاح');
      console.log(`   عدد التقييمات: ${response.data.data.pagination?.total || 0}\n`);
      return true;
    } else {
      console.log('❌ فشل جلب التقييمات');
      console.log(`   Response: ${JSON.stringify(response.data)}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ فشل جلب التقييمات: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}\n`);
      
      if (error.response.status === 404) {
        console.log('⚠️  المشكلة: الـ route غير موجود');
        console.log('   الحل: تحقق من server.js - يجب أن يحتوي على:');
        console.log('   app.use("/api/v1/reviews", productReviewRoutes)\n');
      } else if (error.response.status === 401) {
        console.log('⚠️  المشكلة: مشكلة في المصادقة');
        console.log('   الحل: تحقق من globalSecurity middleware\n');
      } else if (error.response.status === 500) {
        console.log('⚠️  المشكلة: خطأ في الخادم');
        console.log('   الحل: تحقق من productReviewController.js و console الخادم\n');
      }
    } else {
      console.log(`   Error: ${error.message}\n`);
    }
    return false;
  }
}

// Run tests
async function runTests() {
  const serverResult = await testServer();
  if (!serverResult) {
    console.log('⚠️  تحذير: لا يمكن التحقق من حالة الخادم، لكن سنتابع الاختبارات\n');
  }

  const loginResult = await testLogin();
  if (!loginResult) {
    console.log('❌ لا يمكن متابعة الاختبارات بدون تسجيل الدخول');
    console.log('   يمكنك تعديل TEST_EMAIL و TEST_PASSWORD في السكربت\n');
    return;
  }

  const reviewsResult = await testGetReviews();
  
  console.log('='.repeat(50));
  if (reviewsResult) {
    console.log('✅ صفحة إدارة التقييمات تعمل بشكل صحيح!\n');
  } else {
    console.log('❌ هناك مشكلة في صفحة إدارة التقييمات\n');
  }
  console.log('='.repeat(50));
}

runTests().catch(error => {
  console.error(`\n❌ خطأ غير متوقع: ${error.message}`);
  process.exit(1);
});


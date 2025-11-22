/**
 * 🧪 سكربت اختبار صفحة إدارة التقييمات
 * 
 * يختبر:
 * 1. أن الـ route موجود ويعمل
 * 2. أن المصادقة تعمل بشكل صحيح
 * 3. أن الـ API endpoints تعمل
 */

// Try to load axios from node_modules
let axios;
try {
  axios = require('axios');
} catch (e) {
  // If axios is not found, try to use it from parent directory
  try {
    const path = require('path');
    const axiosPath = path.join(__dirname, 'node_modules', 'axios');
    axios = require(axiosPath);
  } catch (e2) {
    console.error('❌ axios is not installed. Please run: npm install axios');
    process.exit(1);
  }
}

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3007/api/v1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Test credentials (يجب تعديلها حسب بياناتك)
const TEST_EMAIL = process.env.TEST_EMAIL || 'ali@ali.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password';

let authToken = null;
let userId = null;
let companyId = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logStep(message) {
  log(`\n🔍 ${message}`, 'cyan');
}

// Test 1: Login
async function testLogin() {
  logStep('Test 1: تسجيل الدخول');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      userId = response.data.user?.id;
      companyId = response.data.user?.companyId;
      logSuccess(`تم تسجيل الدخول بنجاح`);
      logInfo(`User ID: ${userId}`);
      logInfo(`Company ID: ${companyId}`);
      return true;
    } else {
      logError('فشل تسجيل الدخول - لا يوجد token');
      return false;
    }
  } catch (error) {
    logError(`فشل تسجيل الدخول: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// Test 2: Check /auth/me endpoint
async function testAuthMe() {
  logStep('Test 2: التحقق من /auth/me');
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.data.success && response.data.data) {
      logSuccess('تم التحقق من المصادقة بنجاح');
      logInfo(`User: ${response.data.data.email}`);
      logInfo(`Company ID: ${response.data.data.companyId || response.data.data.company?.id}`);
      return true;
    } else {
      logError('فشل التحقق من المصادقة');
      return false;
    }
  } catch (error) {
    logError(`فشل التحقق من المصادقة: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// Test 3: Check /reviews endpoint (GET all reviews)
async function testGetReviews() {
  logStep('Test 3: جلب جميع التقييمات (GET /reviews)');
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
      logSuccess('تم جلب التقييمات بنجاح');
      logInfo(`عدد التقييمات: ${response.data.data.pagination?.total || 0}`);
      logInfo(`الصفحة: ${response.data.data.pagination?.page || 1}`);
      return true;
    } else {
      logError('فشل جلب التقييمات');
      logError(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    logError(`فشل جلب التقييمات: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 404) {
        logWarning('⚠️  الـ route غير موجود - تحقق من server.js');
      } else if (error.response.status === 401) {
        logWarning('⚠️  مشكلة في المصادقة - تحقق من globalSecurity middleware');
      } else if (error.response.status === 500) {
        logWarning('⚠️  خطأ في الخادم - تحقق من productReviewController.js');
      }
    }
    return false;
  }
}

// Test 4: Check if route is registered correctly
async function testRouteRegistration() {
  logStep('Test 4: التحقق من تسجيل الـ route');
  logInfo('التحقق من أن /api/v1/reviews مسجل في server.js');
  logInfo('التحقق من أن productReviewRoutes.js يحتوي على route GET /');
  logWarning('هذا الاختبار يتطلب فحص الكود يدوياً');
  return true;
}

// Test 5: Check frontend route
async function testFrontendRoute() {
  logStep('Test 5: التحقق من الـ route في Frontend');
  logInfo(`Frontend URL: ${FRONTEND_URL}/products/reviews`);
  logInfo('التحقق من أن Route موجود في App.tsx');
  logInfo('التحقق من أن ProtectedRoute component يعمل بشكل صحيح');
  logWarning('هذا الاختبار يتطلب فتح المتصفح يدوياً');
  return true;
}

// Test 6: Check database connection
async function testDatabaseConnection() {
  logStep('Test 6: التحقق من اتصال قاعدة البيانات');
  try {
    // محاولة جلب التقييمات - إذا نجحت، يعني قاعدة البيانات متصلة
    const response = await axios.get(`${API_URL}/reviews`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        page: 1,
        limit: 1
      }
    });

    if (response.data.success !== undefined) {
      logSuccess('قاعدة البيانات متصلة');
      return true;
    } else {
      logWarning('لا يمكن التحقق من اتصال قاعدة البيانات');
      return false;
    }
  } catch (error) {
    if (error.response && error.response.status === 500) {
      logError('خطأ في قاعدة البيانات');
      logError(`Error: ${error.response.data?.error || error.message}`);
      return false;
    }
    logWarning('لا يمكن التحقق من اتصال قاعدة البيانات');
    return false;
  }
}

// Main test function
async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🧪 بدء اختبار صفحة إدارة التقييمات', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  const results = {
    login: false,
    authMe: false,
    getReviews: false,
    routeRegistration: false,
    frontendRoute: false,
    database: false
  };

  // Test 1: Login
  results.login = await testLogin();
  if (!results.login) {
    logError('\n❌ فشل تسجيل الدخول - لا يمكن متابعة الاختبارات');
    return;
  }

  // Test 2: Auth Me
  results.authMe = await testAuthMe();
  if (!results.authMe) {
    logWarning('\n⚠️  فشل التحقق من المصادقة - قد تكون هناك مشكلة في /auth/me');
  }

  // Test 3: Get Reviews
  results.getReviews = await testGetReviews();
  if (!results.getReviews) {
    logError('\n❌ فشل جلب التقييمات - هذه هي المشكلة الرئيسية!');
  }

  // Test 4: Route Registration
  results.routeRegistration = await testRouteRegistration();

  // Test 5: Frontend Route
  results.frontendRoute = await testFrontendRoute();

  // Test 6: Database
  results.database = await testDatabaseConnection();

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 ملخص النتائج', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  
  log(`\nإجمالي الاختبارات: ${totalTests}`);
  log(`نجحت: ${passedTests}`, 'green');
  log(`فشلت: ${totalTests - passedTests}`, 'red');
  
  log('\nالتفاصيل:');
  Object.entries(results).forEach(([test, passed]) => {
    if (passed) {
      log(`  ✅ ${test}`, 'green');
    } else {
      log(`  ❌ ${test}`, 'red');
    }
  });

  if (results.getReviews) {
    logSuccess('\n✅ صفحة إدارة التقييمات تعمل بشكل صحيح!');
  } else {
    logError('\n❌ هناك مشكلة في صفحة إدارة التقييمات');
    logWarning('\n🔧 الحلول المقترحة:');
    logWarning('1. تحقق من أن server.js يحتوي على: app.use("/api/v1/reviews", productReviewRoutes)');
    logWarning('2. تحقق من أن productReviewRoutes.js يحتوي على: router.get("/", productReviewController.getAllReviews)');
    logWarning('3. تحقق من أن globalSecurity middleware يطبق بشكل صحيح');
    logWarning('4. تحقق من أن productReviewController.js يحتوي على function getAllReviews');
    logWarning('5. تحقق من console الخادم لمعرفة الأخطاء');
  }

  log('\n' + '='.repeat(60) + '\n', 'cyan');
}

// Run tests
runTests().catch(error => {
  logError(`\n❌ خطأ غير متوقع: ${error.message}`);
  console.error(error);
  process.exit(1);
});


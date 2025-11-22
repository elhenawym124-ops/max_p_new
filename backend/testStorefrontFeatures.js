/**
 * 🧪 سكريبت اختبار شامل لجميع مزايا Storefront الجديدة
 * 
 * الاستخدام:
 * node backend/testStorefrontFeatures.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3007';
const API_BASE = `${BASE_URL}/api/v1`;

// Test data
let testCompanyId = null;
let testProductId = null;
let testSessionId = `test_session_${Date.now()}`;
let authToken = null;

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

function logTest(testName) {
  log(`\n🧪 ${testName}`, 'cyan');
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

// Helper function for API calls
async function apiCall(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    const errorData = error.response?.data || error.message;
    return {
      success: false,
      status: error.response?.status || 500,
      error: typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
      errorObj: errorData, // Keep original for detailed logging
    };
  }
}

// ============================================
// TEST SUITE 1: Storefront Settings API
// ============================================

async function testStorefrontSettings() {
  logTest('TEST SUITE 1: Storefront Settings API');

  // Test 1.1: GET Settings (Protected)
  logTest('1.1 GET /storefront-settings (Protected)');
  const result1 = await apiCall('GET', '/storefront-settings', null, {
    Authorization: `Bearer ${authToken}`,
  });
  if (result1.success && result1.data?.success) {
    logSuccess(`Settings retrieved: ${Object.keys(result1.data.data || {}).length} fields`);
    testCompanyId = result1.data.data?.companyId;
  } else {
    logError(`Failed: ${result1.error?.message || result1.error}`);
  }

  // Test 1.2: PUT Settings (Protected)
  logTest('1.2 PUT /storefront-settings (Protected)');
  const updateData = {
    quickViewEnabled: true,
    comparisonEnabled: true,
    wishlistEnabled: true,
    supportedLanguages: ['ar', 'en'],
  };
  const result2 = await apiCall('PUT', '/storefront-settings', updateData, {
    Authorization: `Bearer ${authToken}`,
  });
  if (result2.success && result2.data?.success) {
    logSuccess('Settings updated successfully');
  } else {
    logError(`Failed: ${result2.error?.message || result2.error}`);
  }

  // Test 1.3: GET Public Settings
  if (testCompanyId) {
    logTest('1.3 GET /public/storefront-settings/:companyId');
    const result3 = await apiCall('GET', `/public/storefront-settings/${testCompanyId}`);
    if (result3.success && result3.data?.success) {
      logSuccess('Public settings retrieved');
    } else {
      logError(`Failed: ${result3.error?.message || result3.error}`);
    }
  } else {
    logWarning('Skipping public settings test - companyId not available');
  }
}

// ============================================
// TEST SUITE 2: Quick View API
// ============================================

async function testQuickView() {
  logTest('TEST SUITE 2: Quick View API');

  if (!testProductId) {
    logWarning('Skipping Quick View tests - productId not available');
    return;
  }

  // Test 2.1: GET Quick View
  logTest('2.1 GET /public/products/:id/quick');
  const result = await apiCall('GET', `/public/products/${testProductId}/quick?companyId=${testCompanyId}`);
  if (result.success && result.data?.success) {
    logSuccess(`Quick view data retrieved for product: ${result.data.data?.name || 'N/A'}`);
  } else {
    const errorMsg = result.error || (result.errorObj ? JSON.stringify(result.errorObj) : 'Unknown error');
    logError(`Failed: ${errorMsg}`);
    if (result.status) log(`   Status: ${result.status}`, 'yellow');
  }
}

// ============================================
// TEST SUITE 3: Wishlist API
// ============================================

async function testWishlist() {
  logTest('TEST SUITE 3: Wishlist API');

  if (!testProductId) {
    logWarning('Skipping Wishlist tests - productId not available');
    return;
  }

  // Test 3.1: POST Add to Wishlist
  logTest('3.1 POST /public/wishlist');
  const addData = {
    productId: testProductId,
    sessionId: testSessionId,
    companyId: testCompanyId,
  };
  const result1 = await apiCall('POST', `/public/wishlist?companyId=${testCompanyId}`, addData);
  if (result1.success && result1.data?.success) {
    logSuccess('Product added to wishlist');
  } else {
    const errorMsg = result1.error || (result1.errorObj ? JSON.stringify(result1.errorObj) : 'Unknown error');
    logError(`Failed: ${errorMsg}`);
    if (result1.status) log(`   Status: ${result1.status}`, 'yellow');
  }

  // Test 3.2: GET Wishlist
  logTest('3.2 GET /public/wishlist');
  const result2 = await apiCall('GET', `/public/wishlist?sessionId=${testSessionId}&companyId=${testCompanyId}`);
  if (result2.success && result2.data?.success) {
    const items = result2.data.data || [];
    logSuccess(`Wishlist retrieved: ${items.length} item(s)`);
  } else {
    const errorMsg = result2.error || (result2.errorObj ? JSON.stringify(result2.errorObj) : 'Unknown error');
    logError(`Failed: ${errorMsg}`);
    if (result2.status) log(`   Status: ${result2.status}`, 'yellow');
  }
}

// ============================================
// TEST SUITE 4: Product Reviews API
// ============================================

async function testProductReviews() {
  logTest('TEST SUITE 4: Product Reviews API');

  if (!testProductId) {
    logWarning('Skipping Reviews tests - productId not available');
    return;
  }

  // Test 4.1: GET Reviews
  logTest('4.1 GET /public/products/:id/reviews');
  const result1 = await apiCall('GET', `/public/products/${testProductId}/reviews?companyId=${testCompanyId}`);
  if (result1.success && result1.data?.success) {
    const reviews = result1.data.data || [];
    logSuccess(`Reviews retrieved: ${reviews.length} review(s)`);
  } else {
    const errorMsg = result1.error || (result1.errorObj ? JSON.stringify(result1.errorObj) : 'Unknown error');
    logError(`Failed: ${errorMsg}`);
    if (result1.status) log(`   Status: ${result1.status}`, 'yellow');
  }

  // Test 4.2: POST Create Review
  logTest('4.2 POST /public/products/:id/reviews');
  const reviewData = {
    rating: 5,
    comment: 'منتج رائع!',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
  };
  const result2 = await apiCall('POST', `/public/products/${testProductId}/reviews?companyId=${testCompanyId}`, reviewData);
  if (result2.success && result2.data?.success) {
    logSuccess('Review created successfully');
  } else {
    const errorMsg = result2.error || (result2.errorObj ? JSON.stringify(result2.errorObj) : 'Unknown error');
    logError(`Failed: ${errorMsg}`);
    if (result2.status) log(`   Status: ${result2.status}`, 'yellow');
  }
}

// ============================================
// TEST SUITE 5: Back in Stock API
// ============================================

async function testBackInStock() {
  logTest('TEST SUITE 5: Back in Stock API');

  if (!testProductId) {
    logWarning('Skipping Back in Stock tests - productId not available');
    return;
  }

  // Test 5.1: POST Subscribe
  logTest('5.1 POST /public/products/:id/back-in-stock');
  const subscribeData = {
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    notifyEmail: true,
    notifySMS: false,
  };
  const result = await apiCall('POST', `/public/products/${testProductId}/back-in-stock?companyId=${testCompanyId}`, subscribeData);
  if (result.success && result.data?.success) {
    logSuccess('Back in stock subscription created');
  } else {
    const errorMsg = result.error || (result.errorObj ? JSON.stringify(result.errorObj) : 'Unknown error');
    logError(`Failed: ${errorMsg}`);
    if (result.status) log(`   Status: ${result.status}`, 'yellow');
  }
}

// ============================================
// TEST SUITE 6: Recently Viewed API
// ============================================

async function testRecentlyViewed() {
  logTest('TEST SUITE 6: Recently Viewed API');

  if (!testProductId) {
    logWarning('Skipping Recently Viewed tests - productId not available');
    return;
  }

  // Test 6.1: POST Record View
  logTest('6.1 POST /public/products/:id/view');
  const result1 = await apiCall('POST', `/public/products/${testProductId}/view?companyId=${testCompanyId}`);
  if (result1.success && result1.data?.success) {
    logSuccess('View recorded');
  } else {
    const errorMsg = result1.error || (result1.errorObj ? JSON.stringify(result1.errorObj) : 'Unknown error');
    logError(`Failed: ${errorMsg}`);
    if (result1.status) log(`   Status: ${result1.status}`, 'yellow');
  }

  // Test 6.2: GET Recently Viewed
  logTest('6.2 GET /public/products/recently-viewed');
  const result2 = await apiCall('GET', `/public/products/recently-viewed?companyId=${testCompanyId}`);
  if (result2.success && result2.data?.success) {
    const items = result2.data.data || [];
    logSuccess(`Recently viewed retrieved: ${items.length} item(s)`);
  } else {
    const errorMsg = result2.error || (result2.errorObj ? JSON.stringify(result2.errorObj) : 'Unknown error');
    logError(`Failed: ${errorMsg}`);
    if (result2.status) log(`   Status: ${result2.status}`, 'yellow');
  }
}

// ============================================
// TEST SUITE 7: Public Products API (with filters)
// ============================================

async function testPublicProducts() {
  logTest('TEST SUITE 7: Public Products API (with Advanced Filters)');

  // Get companyId from settings if available
  if (!testCompanyId && authToken) {
    const settingsResult = await apiCall('GET', '/storefront-settings', null, {
      Authorization: `Bearer ${authToken}`,
    });
    if (settingsResult.success && settingsResult.data?.success) {
      testCompanyId = settingsResult.data.data?.companyId;
    }
  }

  if (!testCompanyId) {
    logWarning('Skipping Public Products tests - companyId not available');
    logWarning('Note: Public Products API requires companyId parameter');
    return;
  }

  // Test 7.1: GET Products (basic)
  logTest('7.1 GET /public/products');
  const result1 = await apiCall('GET', `/public/products?companyId=${testCompanyId}`);
  if (result1.success && result1.data?.success) {
    const products = result1.data.data?.products || result1.data.data || [];
    logSuccess(`Products retrieved: ${products.length} product(s)`);
    if (products.length > 0 && !testProductId) {
      testProductId = products[0].id;
      log(`   Using product ID: ${testProductId}`, 'blue');
    }
  } else {
    const errorMsg = result1.error?.message || JSON.stringify(result1.error) || 'Unknown error';
    logError(`Failed: ${errorMsg}`);
    if (result1.status) {
      log(`   Status: ${result1.status}`, 'yellow');
    }
  }

  // Test 7.2: GET Products with filters
  logTest('7.2 GET /public/products (with filters)');
  const result2 = await apiCall('GET', `/public/products?companyId=${testCompanyId}&minPrice=0&maxPrice=1000&sortBy=price&sortOrder=asc`);
  if (result2.success && result2.data?.success) {
    const products = result2.data.data?.products || result2.data.data || [];
    logSuccess(`Filtered products retrieved: ${products.length} product(s)`);
  } else {
    const errorMsg = result2.error?.message || JSON.stringify(result2.error) || 'Unknown error';
    logError(`Failed: ${errorMsg}`);
  }
}

// ============================================
// Helper: Get Auth Token
// ============================================

async function getAuthToken() {
  logTest('Getting Authentication Token');
  
  // Try to get token from environment or use a test token
  // In production, you would login first
  const testEmail = process.env.TEST_EMAIL || 'ali@ali.com';
  const testPassword = process.env.TEST_PASSWORD || 'admin123'; // Try common passwords
  
  try {
    const result = await apiCall('POST', '/auth/login', {
      email: testEmail,
      password: testPassword,
    });
    
    if (result.success && result.data?.success) {
      authToken = result.data.data?.token || result.data.data?.accessToken;
      if (authToken) {
        logSuccess('Authentication successful');
        return true;
      }
    } else {
      logWarning(`Login failed: ${result.error?.message || 'Unknown error'}`);
      logWarning('Trying alternative password...');
      
      // Try alternative password
      const result2 = await apiCall('POST', '/auth/login', {
        email: testEmail,
        password: 'ali123',
      });
      
      if (result2.success && result2.data?.success) {
        authToken = result2.data.data?.token || result2.data.data?.accessToken;
        if (authToken) {
          logSuccess('Authentication successful with alternative password');
          return true;
        }
      }
    }
  } catch (error) {
    logWarning('Could not authenticate automatically. Some protected tests will be skipped.');
    logWarning('To test protected endpoints, please:');
    logWarning('  1. Login manually and get a token');
    logWarning('  2. Set TEST_EMAIL and TEST_PASSWORD environment variables');
    logWarning('  3. Or set authToken directly in the script');
  }
  
  return false;
}

// ============================================
// Main Test Runner
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('🧪 STOREFRONT FEATURES TEST SUITE', 'blue');
  log('='.repeat(60) + '\n', 'blue');

  // Get auth token
  await getAuthToken();
  if (!authToken) {
    logWarning('Running tests without authentication (some tests may fail)');
  }

  // Run all test suites
  try {
    // First test protected APIs to get companyId
    await testStorefrontSettings();
    
    // Then test public APIs (they need companyId from previous test)
    await testPublicProducts();
    
    // Test other public APIs (they need productId from previous test)
    await testQuickView();
    await testWishlist();
    await testProductReviews();
    await testBackInStock();
    await testRecentlyViewed();

    log('\n' + '='.repeat(60), 'green');
    log('✅ ALL TESTS COMPLETED', 'green');
    log('='.repeat(60) + '\n', 'green');
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
  }
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testStorefrontSettings,
  testQuickView,
  testWishlist,
  testProductReviews,
  testBackInStock,
  testRecentlyViewed,
  testPublicProducts,
};


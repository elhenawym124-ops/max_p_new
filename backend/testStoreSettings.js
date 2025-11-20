/**
 * Test script for Store Settings API
 * Run this script to verify all endpoints are working correctly
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3001/api/v1';
const TEST_COMPANY_SUBDOMAIN = 'test-company';

// Test data
const testBranch = {
  name: 'فرع اختبار',
  address: 'شارع الاختبار، القاهرة',
  city: 'القاهرة',
  phone: '01234567890',
  email: 'test@example.com',
  workingHours: '9:00 - 17:00',
  isActive: true
};

const testShippingZone = {
  name: 'منطقة شحن اختبار',
  governorates: ['القاهرة', 'الجيزة'],
  price: 50,
  deliveryTime: '2-3 أيام',
  isActive: true
};

// Helper function to make API calls
async function apiCall(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status || 500 
    };
  }
}

// Test functions
async function testStoreSettingsRoutes() {
  console.log('🧪 Testing Store Settings Routes...\n');
  
  // Note: These tests require authentication
  // You'll need to get a valid JWT token first
  const authToken = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token
  
  if (authToken === 'YOUR_JWT_TOKEN_HERE') {
    console.log('⚠️  Please update the authToken variable with a valid JWT token');
    console.log('   You can get this by logging in to your application\n');
  }
  
  const authHeaders = { 'Authorization': `Bearer ${authToken}` };
  
  // Test 1: Get all store settings
  console.log('1. Testing GET /store-settings/');
  const result1 = await apiCall('GET', '/store-settings/', null, authHeaders);
  console.log('   Status:', result1.status);
  console.log('   Success:', result1.success);
  if (!result1.success) console.log('   Error:', result1.error);
  console.log();
  
  // Test 2: Get branches
  console.log('2. Testing GET /store-settings/branches');
  const result2 = await apiCall('GET', '/store-settings/branches', null, authHeaders);
  console.log('   Status:', result2.status);
  console.log('   Success:', result2.success);
  if (!result2.success) console.log('   Error:', result2.error);
  console.log();
  
  // Test 3: Create branch
  console.log('3. Testing POST /store-settings/branches');
  const result3 = await apiCall('POST', '/store-settings/branches', testBranch, authHeaders);
  console.log('   Status:', result3.status);
  console.log('   Success:', result3.success);
  if (result3.success) {
    console.log('   Created branch ID:', result3.data.data?.id);
    testBranch.id = result3.data.data?.id; // Save for update test
  } else {
    console.log('   Error:', result3.error);
  }
  console.log();
  
  // Test 4: Get shipping zones
  console.log('4. Testing GET /store-settings/shipping-zones');
  const result4 = await apiCall('GET', '/store-settings/shipping-zones', null, authHeaders);
  console.log('   Status:', result4.status);
  console.log('   Success:', result4.success);
  if (!result4.success) console.log('   Error:', result4.error);
  console.log();
  
  // Test 5: Create shipping zone
  console.log('5. Testing POST /store-settings/shipping-zones');
  const result5 = await apiCall('POST', '/store-settings/shipping-zones', testShippingZone, authHeaders);
  console.log('   Status:', result5.status);
  console.log('   Success:', result5.success);
  if (result5.success) {
    console.log('   Created shipping zone ID:', result5.data.data?.id);
    testShippingZone.id = result5.data.data?.id; // Save for update test
  } else {
    console.log('   Error:', result5.error);
  }
  console.log();
  
  // Test 6: Find shipping price
  console.log('6. Testing GET /store-settings/shipping-zones/find-price?governorate=القاهرة');
  const result6 = await apiCall('GET', '/store-settings/shipping-zones/find-price?governorate=القاهرة', null, authHeaders);
  console.log('   Status:', result6.status);
  console.log('   Success:', result6.success);
  if (result6.success) {
    console.log('   Shipping price:', result6.data.data?.price);
  } else {
    console.log('   Error:', result6.error);
  }
  console.log();
}

async function testPublicRoutes() {
  console.log('🌐 Testing Public Routes (Storefront)...\n');
  
  // Note: These tests require a valid company subdomain
  const publicHeaders = { 'Host': `${TEST_COMPANY_SUBDOMAIN}.localhost:3000` };
  
  // Test 1: Get public products
  console.log('1. Testing GET /public/products');
  const result1 = await apiCall('GET', '/public/products', null, publicHeaders);
  console.log('   Status:', result1.status);
  console.log('   Success:', result1.success);
  if (result1.success) {
    console.log('   Products count:', result1.data.data?.products?.length || 0);
  } else {
    console.log('   Error:', result1.error);
  }
  console.log();
  
  // Test 2: Get public categories
  console.log('2. Testing GET /public/categories');
  const result2 = await apiCall('GET', '/public/categories', null, publicHeaders);
  console.log('   Status:', result2.status);
  console.log('   Success:', result2.success);
  if (result2.success) {
    console.log('   Categories count:', result2.data.data?.length || 0);
  } else {
    console.log('   Error:', result2.error);
  }
  console.log();
  
  // Test 3: Get cart (should create new cart)
  console.log('3. Testing GET /public/cart');
  const result3 = await apiCall('GET', '/public/cart', null, publicHeaders);
  console.log('   Status:', result3.status);
  console.log('   Success:', result3.success);
  if (!result3.success) console.log('   Error:', result3.error);
  console.log();
}

async function testHealthCheck() {
  console.log('🏥 Testing Health Check...\n');
  
  // Test basic health check
  console.log('1. Testing GET /health');
  const result1 = await apiCall('GET', '/health');
  console.log('   Status:', result1.status);
  console.log('   Success:', result1.success);
  if (result1.success) {
    console.log('   Health status:', result1.data.status || 'OK');
  } else {
    console.log('   Error:', result1.error);
  }
  console.log();
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Store Settings API Tests\n');
  console.log('=====================================\n');
  
  await testHealthCheck();
  await testStoreSettingsRoutes();
  await testPublicRoutes();
  
  console.log('✅ Tests completed!\n');
  console.log('📝 Notes:');
  console.log('   - Store settings routes require authentication');
  console.log('   - Public routes require valid company subdomain');
  console.log('   - Make sure the server is running on port 3001');
  console.log('   - Update the authToken variable with a valid JWT token');
  console.log('   - Update TEST_COMPANY_SUBDOMAIN with your actual company subdomain');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testStoreSettingsRoutes,
  testPublicRoutes,
  testHealthCheck,
  runTests
};

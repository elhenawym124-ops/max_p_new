/**
 * 🧪 Script لاختبار الـ APIs الجديدة
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const COMPANY_ID = process.env.TEST_COMPANY_ID || 'test-company-id';

// Test functions
async function testStorefrontSettings() {
  try {
    console.log('\n📋 Testing Storefront Settings API...');
    const response = await axios.get(`${BASE_URL}/api/v1/public/storefront-settings/${COMPANY_ID}`);
    console.log('✅ Storefront Settings:', response.data.success ? 'Success' : 'Failed');
    if (response.data.success) {
      console.log('   - Quick View Enabled:', response.data.data.quickViewEnabled);
      console.log('   - Wishlist Enabled:', response.data.data.wishlistEnabled);
      console.log('   - Reviews Enabled:', response.data.data.reviewsEnabled);
    }
    return response.data;
  } catch (error) {
    console.error('❌ Storefront Settings Error:', error.response?.data || error.message);
    return null;
  }
}

async function testWishlist() {
  try {
    console.log('\n❤️ Testing Wishlist API...');
    const response = await axios.get(`${BASE_URL}/api/v1/public/wishlist`, {
      headers: {
        'x-session-id': 'test-session-123',
        'X-Company-Id': COMPANY_ID
      }
    });
    console.log('✅ Wishlist:', response.data.success ? 'Success' : 'Failed');
    if (response.data.success) {
      console.log('   - Items Count:', response.data.data.count);
    }
    return response.data;
  } catch (error) {
    console.error('❌ Wishlist Error:', error.response?.data || error.message);
    return null;
  }
}

async function testProductReviews(productId) {
  try {
    console.log('\n⭐ Testing Product Reviews API...');
    const response = await axios.get(`${BASE_URL}/api/v1/public/products/${productId}/reviews`, {
      headers: {
        'X-Company-Id': COMPANY_ID
      }
    });
    console.log('✅ Product Reviews:', response.data.success ? 'Success' : 'Failed');
    if (response.data.success) {
      console.log('   - Reviews Count:', response.data.data.reviews.length);
      console.log('   - Average Rating:', response.data.data.averageRating);
    }
    return response.data;
  } catch (error) {
    console.error('❌ Product Reviews Error:', error.response?.data || error.message);
    return null;
  }
}

async function testQuickView(productId) {
  try {
    console.log('\n👁️ Testing Quick View API...');
    const response = await axios.get(`${BASE_URL}/api/v1/public/products/${productId}/quick`, {
      headers: {
        'X-Company-Id': COMPANY_ID
      }
    });
    console.log('✅ Quick View:', response.data.success ? 'Success' : 'Failed');
    if (response.data.success) {
      console.log('   - Product Name:', response.data.data.name);
      console.log('   - Price:', response.data.data.price);
    }
    return response.data;
  } catch (error) {
    console.error('❌ Quick View Error:', error.response?.data || error.message);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting API Tests...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🏢 Company ID: ${COMPANY_ID}`);
  
  // Test 1: Storefront Settings
  await testStorefrontSettings();
  
  // Test 2: Wishlist
  await testWishlist();
  
  // Test 3: Product Reviews (needs a real product ID)
  // await testProductReviews('product-id-here');
  
  // Test 4: Quick View (needs a real product ID)
  // await testQuickView('product-id-here');
  
  console.log('\n✅ Tests completed!');
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testStorefrontSettings, testWishlist, testProductReviews, testQuickView };


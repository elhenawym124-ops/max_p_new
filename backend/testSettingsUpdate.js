/**
 * 🧪 سكريبت اختبار شامل لتحديث إعدادات Storefront
 * 
 * الاستخدام:
 * node backend/testSettingsUpdate.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3007';
const API_BASE = `${BASE_URL}/api/v1`;

// Test data
let authToken = null;
let testCompanyId = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
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
      errorObj: errorData,
    };
  }
}

// Get Auth Token
async function getAuthToken() {
  logTest('Getting Authentication Token');
  
  const testEmail = process.env.TEST_EMAIL || 'ali@ali.com';
  const testPassword = process.env.TEST_PASSWORD || 'admin123';
  
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
      logWarning(`Login failed: ${result.error || 'Unknown error'}`);
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
    logError('Could not authenticate');
  }
  
  return false;
}

// Test 1: Get Current Settings
async function testGetSettings() {
  logTest('TEST 1: Get Current Settings');
  
  const result = await apiCall('GET', '/storefront-settings', null, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (result.success && result.data?.success) {
    const settings = result.data.data;
    testCompanyId = settings.companyId;
    logSuccess(`Settings retrieved: ${Object.keys(settings).length} fields`);
    logInfo(`Company ID: ${testCompanyId}`);
    return settings;
  } else {
    logError(`Failed: ${result.error || 'Unknown error'}`);
    return null;
  }
}

// Test 2: Update Single Setting
async function testUpdateSingleSetting() {
  logTest('TEST 2: Update Single Setting (quickViewEnabled)');
  
  const updateData = {
    quickViewEnabled: false, // Disable quick view
  };
  
  const result = await apiCall('PUT', '/storefront-settings', updateData, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (result.success && result.data?.success) {
    logSuccess('Single setting updated successfully');
    logInfo(`quickViewEnabled: ${result.data.data?.quickViewEnabled}`);
    
    // Verify the update
    const verifyResult = await apiCall('GET', '/storefront-settings', null, {
      Authorization: `Bearer ${authToken}`,
    });
    
    if (verifyResult.success && verifyResult.data?.success) {
      const verified = verifyResult.data.data.quickViewEnabled === false;
      if (verified) {
        logSuccess('✅ Verification: Setting was updated correctly');
      } else {
        logError('❌ Verification: Setting was NOT updated correctly');
      }
    }
    
    return result.data.data;
  } else {
    logError(`Failed: ${result.error || 'Unknown error'}`);
    return null;
  }
}

// Test 3: Update Multiple Settings
async function testUpdateMultipleSettings() {
  logTest('TEST 3: Update Multiple Settings');
  
  const updateData = {
    quickViewEnabled: true,
    comparisonEnabled: true,
    wishlistEnabled: true,
    maxComparisonProducts: 5,
    wishlistMaxItems: 50,
    supportedLanguages: ['ar', 'en', 'fr'],
  };
  
  logInfo('Updating:');
  Object.entries(updateData).forEach(([key, value]) => {
    logInfo(`  - ${key}: ${JSON.stringify(value)}`);
  });
  
  const result = await apiCall('PUT', '/storefront-settings', updateData, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (result.success && result.data?.success) {
    logSuccess('Multiple settings updated successfully');
    
    // Verify the updates
    const verifyResult = await apiCall('GET', '/storefront-settings', null, {
      Authorization: `Bearer ${authToken}`,
    });
    
    if (verifyResult.success && verifyResult.data?.success) {
      const settings = verifyResult.data.data;
      let allVerified = true;
      
      logTest('Verifying Updates:');
      Object.entries(updateData).forEach(([key, value]) => {
        const actual = settings[key];
        const verified = JSON.stringify(actual) === JSON.stringify(value);
        if (verified) {
          logSuccess(`  ✅ ${key}: ${JSON.stringify(actual)}`);
        } else {
          logError(`  ❌ ${key}: Expected ${JSON.stringify(value)}, Got ${JSON.stringify(actual)}`);
          allVerified = false;
        }
      });
      
      if (allVerified) {
        logSuccess('✅ All settings verified correctly');
      } else {
        logError('❌ Some settings were NOT updated correctly');
      }
    }
    
    return result.data.data;
  } else {
    logError(`Failed: ${result.error || 'Unknown error'}`);
    return null;
  }
}

// Test 4: Update All Boolean Settings
async function testUpdateAllBooleanSettings() {
  logTest('TEST 4: Update All Boolean Settings');
  
  const booleanSettings = {
    quickViewEnabled: true,
    quickViewShowAddToCart: true,
    quickViewShowWishlist: true,
    comparisonEnabled: true,
    comparisonShowPrice: true,
    comparisonShowSpecs: true,
    wishlistEnabled: true,
    wishlistRequireLogin: false,
    advancedFiltersEnabled: true,
    filterByPrice: true,
    filterByRating: true,
    filterByBrand: false,
    filterByAttributes: true,
    reviewsEnabled: true,
    reviewsRequirePurchase: false,
    reviewsModerationEnabled: true,
    reviewsShowRating: true,
    countdownEnabled: true,
    countdownShowOnProduct: true,
    countdownShowOnListing: false,
    backInStockEnabled: true,
    backInStockNotifyEmail: true,
    backInStockNotifySMS: false,
    recentlyViewedEnabled: true,
    imageZoomEnabled: true,
    productVideosEnabled: true,
    videoAutoplay: false,
    videoShowControls: true,
    sizeGuideEnabled: true,
    sizeGuideShowOnProduct: true,
    socialSharingEnabled: true,
    shareFacebook: true,
    shareTwitter: true,
    shareWhatsApp: true,
    shareTelegram: true,
    badgesEnabled: true,
    badgeNew: true,
    badgeBestSeller: true,
    badgeOnSale: true,
    badgeOutOfStock: true,
    tabsEnabled: true,
    tabDescription: true,
    tabSpecifications: true,
    tabReviews: true,
    tabShipping: true,
    stickyAddToCartEnabled: true,
    stickyShowOnMobile: true,
    stickyShowOnDesktop: true,
    seoEnabled: true,
    seoMetaDescription: true,
    seoStructuredData: true,
    seoSitemap: true,
    seoOpenGraph: true,
    multiLanguageEnabled: true,
  };
  
  logInfo(`Updating ${Object.keys(booleanSettings).length} boolean settings...`);
  
  const result = await apiCall('PUT', '/storefront-settings', booleanSettings, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (result.success && result.data?.success) {
    logSuccess('All boolean settings updated successfully');
    return result.data.data;
  } else {
    logError(`Failed: ${result.error || 'Unknown error'}`);
    return null;
  }
}

// Test 5: Update Numeric Settings
async function testUpdateNumericSettings() {
  logTest('TEST 5: Update Numeric Settings');
  
  const numericSettings = {
    maxComparisonProducts: 6,
    wishlistMaxItems: 80,
    minRatingToDisplay: 2,
    recentlyViewedCount: 10,
    recentlyViewedDays: 45,
  };
  
  logInfo('Updating numeric settings:');
  Object.entries(numericSettings).forEach(([key, value]) => {
    logInfo(`  - ${key}: ${value}`);
  });
  
  const result = await apiCall('PUT', '/storefront-settings', numericSettings, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (result.success && result.data?.success) {
    logSuccess('Numeric settings updated successfully');
    
    // Verify
    const verifyResult = await apiCall('GET', '/storefront-settings', null, {
      Authorization: `Bearer ${authToken}`,
    });
    
    if (verifyResult.success && verifyResult.data?.success) {
      const settings = verifyResult.data.data;
      let allVerified = true;
      
      logTest('Verifying Numeric Updates:');
      Object.entries(numericSettings).forEach(([key, value]) => {
        const actual = settings[key];
        const verified = actual === value;
        if (verified) {
          logSuccess(`  ✅ ${key}: ${actual}`);
        } else {
          logError(`  ❌ ${key}: Expected ${value}, Got ${actual}`);
          allVerified = false;
        }
      });
      
      if (allVerified) {
        logSuccess('✅ All numeric settings verified correctly');
      }
    }
    
    return result.data.data;
  } else {
    logError(`Failed: ${result.error || 'Unknown error'}`);
    return null;
  }
}

// Test 6: Update String/Array Settings
async function testUpdateStringArraySettings() {
  logTest('TEST 6: Update String/Array Settings');
  
  const stringArraySettings = {
    defaultLanguage: 'en',
    supportedLanguages: ['ar', 'en', 'fr', 'de'],
    imageZoomType: 'click',
  };
  
  logInfo('Updating string/array settings:');
  Object.entries(stringArraySettings).forEach(([key, value]) => {
    logInfo(`  - ${key}: ${JSON.stringify(value)}`);
  });
  
  const result = await apiCall('PUT', '/storefront-settings', stringArraySettings, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (result.success && result.data?.success) {
    logSuccess('String/Array settings updated successfully');
    
    // Verify
    const verifyResult = await apiCall('GET', '/storefront-settings', null, {
      Authorization: `Bearer ${authToken}`,
    });
    
    if (verifyResult.success && verifyResult.data?.success) {
      const settings = verifyResult.data.data;
      let allVerified = true;
      
      logTest('Verifying String/Array Updates:');
      Object.entries(stringArraySettings).forEach(([key, value]) => {
        const actual = settings[key];
        const verified = JSON.stringify(actual) === JSON.stringify(value);
        if (verified) {
          logSuccess(`  ✅ ${key}: ${JSON.stringify(actual)}`);
        } else {
          logError(`  ❌ ${key}: Expected ${JSON.stringify(value)}, Got ${JSON.stringify(actual)}`);
          allVerified = false;
        }
      });
      
      if (allVerified) {
        logSuccess('✅ All string/array settings verified correctly');
      }
    }
    
    return result.data.data;
  } else {
    logError(`Failed: ${result.error || 'Unknown error'}`);
    return null;
  }
}

// Test 7: Test Public Settings Endpoint
async function testPublicSettings() {
  logTest('TEST 7: Test Public Settings Endpoint');
  
  if (!testCompanyId) {
    logWarning('Skipping - companyId not available');
    return;
  }
  
  const result = await apiCall('GET', `/public/storefront-settings/${testCompanyId}`);
  
  if (result.success && result.data?.success) {
    const settings = result.data.data;
    logSuccess('Public settings retrieved successfully');
    logInfo(`Settings fields: ${Object.keys(settings).length}`);
    logInfo(`quickViewEnabled: ${settings.quickViewEnabled}`);
    logInfo(`comparisonEnabled: ${settings.comparisonEnabled}`);
    logInfo(`supportedLanguages: ${JSON.stringify(settings.supportedLanguages)}`);
    return settings;
  } else {
    logError(`Failed: ${result.error || 'Unknown error'}`);
    return null;
  }
}

// Test 8: Test Invalid Data Handling
async function testInvalidDataHandling() {
  logTest('TEST 8: Test Invalid Data Handling');
  
  const invalidData = {
    maxComparisonProducts: -5, // Invalid: negative number
    wishlistMaxItems: 10000, // Invalid: too large
    minRatingToDisplay: 10, // Invalid: should be 1-5
  };
  
  logInfo('Testing with invalid data:');
  Object.entries(invalidData).forEach(([key, value]) => {
    logInfo(`  - ${key}: ${value} (invalid)`);
  });
  
  const result = await apiCall('PUT', '/storefront-settings', invalidData, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (result.success) {
    logWarning('API accepted invalid data (may need validation)');
    logInfo('Response:', JSON.stringify(result.data, null, 2));
  } else {
    logSuccess('API correctly rejected invalid data');
    logInfo(`Error: ${result.error}`);
  }
}

// Test 9: Test Partial Update
async function testPartialUpdate() {
  logTest('TEST 9: Test Partial Update (only some fields)');
  
  // First get current settings
  const currentResult = await apiCall('GET', '/storefront-settings', null, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (!currentResult.success) {
    logError('Could not get current settings');
    return;
  }
  
  const currentSettings = currentResult.data.data;
  const originalQuickView = currentSettings.quickViewEnabled;
  const originalComparison = currentSettings.comparisonEnabled;
  
  logInfo(`Original values: quickViewEnabled=${originalQuickView}, comparisonEnabled=${originalComparison}`);
  
  // Update only one field
  const partialUpdate = {
    quickViewEnabled: !originalQuickView, // Toggle
  };
  
  const result = await apiCall('PUT', '/storefront-settings', partialUpdate, {
    Authorization: `Bearer ${authToken}`,
  });
  
  if (result.success && result.data?.success) {
    logSuccess('Partial update successful');
    
    // Verify only the updated field changed
    const verifyResult = await apiCall('GET', '/storefront-settings', null, {
      Authorization: `Bearer ${authToken}`,
    });
    
    if (verifyResult.success && verifyResult.data?.success) {
      const settings = verifyResult.data.data;
      const quickViewChanged = settings.quickViewEnabled === !originalQuickView;
      const comparisonUnchanged = settings.comparisonEnabled === originalComparison;
      
      if (quickViewChanged && comparisonUnchanged) {
        logSuccess('✅ Partial update verified: Only updated field changed');
      } else {
        logError('❌ Partial update failed: Other fields were affected');
      }
    }
  } else {
    logError(`Failed: ${result.error || 'Unknown error'}`);
  }
}

// Main Test Runner
async function runAllTests() {
  log('\n' + '='.repeat(70), 'magenta');
  log('🧪 STOREFRONT SETTINGS UPDATE TEST SUITE', 'magenta');
  log('='.repeat(70) + '\n', 'magenta');

  // Get auth token
  const authenticated = await getAuthToken();
  if (!authenticated) {
    logError('Cannot proceed without authentication');
    return;
  }

  try {
    // Run all tests
    await testGetSettings();
    await testUpdateSingleSetting();
    await testUpdateMultipleSettings();
    await testUpdateAllBooleanSettings();
    await testUpdateNumericSettings();
    await testUpdateStringArraySettings();
    await testPublicSettings();
    await testInvalidDataHandling();
    await testPartialUpdate();

    log('\n' + '='.repeat(70), 'green');
    log('✅ ALL SETTINGS UPDATE TESTS COMPLETED', 'green');
    log('='.repeat(70) + '\n', 'green');
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
  testGetSettings,
  testUpdateSingleSetting,
  testUpdateMultipleSettings,
  testUpdateAllBooleanSettings,
  testUpdateNumericSettings,
  testUpdateStringArraySettings,
  testPublicSettings,
  testInvalidDataHandling,
  testPartialUpdate,
};


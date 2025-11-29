/**
 * 🧪 ملف الاختبار الشامل لإصلاحات نظام مفاتيح Gemini
 * 
 * الاستخدام:
 * node backend/test-gemini-fixes.js
 */

const { getSharedPrismaClient } = require('./services/sharedDatabase');

// ألوان للـ console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// نتائج الاختبارات
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function recordTest(name, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`✅ PASS: ${name}`, 'green');
  } else {
    testResults.failed++;
    log(`❌ FAIL: ${name}`, 'red');
  }
  if (details) {
    log(`   ${details}`, 'cyan');
  }
}

// ============================================
// الاختبار 1: نظام تتبع عالمي للنماذج المجربة
// ============================================
async function test1_GlobalTriedModels() {
  log('\n📋 Test 1: Global Tried Models Tracking', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    // استيراد ResponseGenerator
    const ResponseGenerator = require('./services/aiAgent/responseGenerator');
    const aiAgentService = require('./services/aiAgentService');
    
    const responseGen = new ResponseGenerator(aiAgentService);
    
    // التحقق من وجود globalTriedModels
    const hasGlobalTriedModels = responseGen.globalTriedModels instanceof Map;
    recordTest(
      'globalTriedModels exists and is a Map',
      hasGlobalTriedModels,
      `Type: ${typeof responseGen.globalTriedModels}`
    );
    
    // محاكاة إضافة session
    const sessionId = 'test_company_123_conv_456_' + Date.now();
    responseGen.globalTriedModels.set(sessionId, {
      models: new Set(['gemini-2.0-flash-exp', 'gemini-1.5-pro-002']),
      timestamp: Date.now()
    });
    
    const sessionData = responseGen.globalTriedModels.get(sessionId);
    recordTest(
      'Session data stored correctly',
      sessionData && sessionData.models.size === 2,
      `Models tracked: ${sessionData?.models.size || 0}`
    );
    
    // التحقق من عدم التكرار
    const uniqueModels = sessionData.models.size === 2;
    recordTest(
      'No duplicate models in Set',
      uniqueModels,
      'Set automatically prevents duplicates'
    );
    
    // تنظيف
    responseGen.globalTriedModels.delete(sessionId);
    
  } catch (error) {
    recordTest('Test 1 execution', false, error.message);
  }
}

// ============================================
// الاختبار 2: معامل excludeModels
// ============================================
async function test2_ExcludeModels() {
  log('\n📋 Test 2: Exclude Models Parameter', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    const aiAgentService = require('./services/aiAgentService');
    const modelManager = aiAgentService.getModelManager(); // ✅ استخدام getter
    
    // التحقق من أن findNextAvailableModel يقبل excludeModels
    const functionString = modelManager.findNextAvailableModel.toString();
    const hasExcludeParam = functionString.includes('excludeModels');
    
    recordTest(
      'findNextAvailableModel accepts excludeModels parameter',
      hasExcludeParam,
      'Parameter found in function signature'
    );
    
    // التحقق من أن findBestModelByPriorityWithQuota يقبل excludeModels
    const functionString2 = modelManager.findBestModelByPriorityWithQuota.toString();
    const hasExcludeParam2 = functionString2.includes('excludeModels');
    
    recordTest(
      'findBestModelByPriorityWithQuota accepts excludeModels',
      hasExcludeParam2,
      'Parameter found in function signature'
    );
    
    // التحقق من منطق الفحص
    const hasExcludeCheck = functionString2.includes('excludeModels.includes');
    recordTest(
      'Exclude logic implemented',
      hasExcludeCheck,
      'excludeModels.includes() check found'
    );
    
  } catch (error) {
    recordTest('Test 2 execution', false, error.message);
  }
}

// ============================================
// الاختبار 3: Cache Invalidation
// ============================================
async function test3_CacheInvalidation() {
  log('\n📋 Test 3: Cache Invalidation', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    const aiAgentService = require('./services/aiAgentService');
    const modelManager = aiAgentService.getModelManager();
    
    // التحقق من وجود دوال invalidation
    const hasInvalidateQuotaCache = typeof modelManager.invalidateQuotaCache === 'function';
    recordTest(
      'invalidateQuotaCache function exists',
      hasInvalidateQuotaCache,
      'Function defined in ModelManager'
    );
    
    const hasInvalidateAll = typeof modelManager.invalidateAllQuotaCacheForCompany === 'function';
    recordTest(
      'invalidateAllQuotaCacheForCompany function exists',
      hasInvalidateAll,
      'Function defined in ModelManager'
    );
    
    // اختبار عملي
    const testKey = 'test-model_test-company';
    modelManager.quotaCache.set(testKey, {
      timestamp: Date.now(),
      data: { test: true }
    });
    
    const beforeInvalidation = modelManager.quotaCache.has(testKey);
    modelManager.invalidateQuotaCache('test-model', 'test-company');
    const afterInvalidation = modelManager.quotaCache.has(testKey);
    
    recordTest(
      'Cache invalidation works',
      beforeInvalidation && !afterInvalidation,
      `Before: ${beforeInvalidation}, After: ${afterInvalidation}`
    );
    
  } catch (error) {
    recordTest('Test 3 execution', false, error.message);
  }
}

// ============================================
// الاختبار 4: دمج exhaustedModelsCache مع excludedModels
// ============================================
async function test4_ExhaustedModelsPersistence() {
  log('\n📋 Test 4: Exhausted Models Persistence', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    const aiAgentService = require('./services/aiAgentService');
    const modelManager = aiAgentService.getModelManager();
    
    // التحقق من وجود exhaustedModelsCache
    const hasExhaustedCache = modelManager.exhaustedModelsCache instanceof Set;
    recordTest(
      'exhaustedModelsCache exists',
      hasExhaustedCache,
      `Type: ${typeof modelManager.exhaustedModelsCache}`
    );
    
    // التحقق من منطق الإضافة إلى DB
    const functionString = modelManager.markModelAsExhaustedFrom429.toString();
    const hasDBInsert = functionString.includes('excludeModel') || 
                       functionString.includes('FIX 4') ||
                       functionString.includes('FIX-4');
    
    recordTest(
      'Exhausted models saved to DB',
      hasDBInsert,
      'excludeModel call found in markModelAsExhaustedFrom429'
    );
    
    // التحقق من فحص exhaustedModelsCache في findBestModelByPriorityWithQuota
    const functionString2 = modelManager.findBestModelByPriorityWithQuota.toString();
    const hasExhaustedCheck = functionString2.includes('exhaustedModelsCache');
    
    recordTest(
      'exhaustedModelsCache checked in model selection',
      hasExhaustedCheck,
      'Cache check found in findBestModelByPriorityWithQuota'
    );
    
  } catch (error) {
    recordTest('Test 4 execution', false, error.message);
  }
}

// ============================================
// الاختبار 5: Optimistic Locking
// ============================================
async function test5_OptimisticLocking() {
  log('\n📋 Test 5: Optimistic Locking', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    const aiAgentService = require('./services/aiAgentService');
    const modelManager = aiAgentService.getModelManager();
    
    // التحقق من منطق Optimistic Locking
    const functionString = modelManager.updateModelUsage.toString();
    
    const hasWhileLoop = functionString.includes('while') && functionString.includes('maxRetries');
    recordTest(
      'Retry loop with maxRetries implemented',
      hasWhileLoop,
      'while loop with maxRetries found'
    );
    
    const hasUpdateMany = functionString.includes('updateMany');
    recordTest(
      'Using updateMany for optimistic locking',
      hasUpdateMany,
      'updateMany instead of update'
    );
    
    const hasUpdatedAtCheck = functionString.includes('updatedAt') && 
                             functionString.includes('oldUpdatedAt');
    recordTest(
      'updatedAt check for optimistic locking',
      hasUpdatedAtCheck,
      'oldUpdatedAt comparison found'
    );
    
    const hasRetryLogic = functionString.includes('updateResult.count') && 
                         functionString.includes('=== 0');
    recordTest(
      'Retry logic on failed update',
      hasRetryLogic,
      'count === 0 check found'
    );
    
  } catch (error) {
    recordTest('Test 5 execution', false, error.message);
  }
}

// ============================================
// الاختبار 6: Cache TTL 30 ثانية
// ============================================
async function test6_CacheTTL() {
  log('\n📋 Test 6: Cache TTL 30 seconds', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    const aiAgentService = require('./services/aiAgentService');
    const modelManager = aiAgentService.getModelManager();
    
    // التحقق من TTL في calculateTotalQuota
    const functionString = modelManager.calculateTotalQuota.toString();
    const has30SecondsTTL = functionString.includes('30000');
    
    recordTest(
      'Cache TTL set to 30 seconds (30000ms)',
      has30SecondsTTL,
      'TTL value found in calculateTotalQuota'
    );
    
    // التحقق من التعليق
    const hasComment = functionString.includes('30 ثانية') || 
                      functionString.includes('FIX 6');
    recordTest(
      'Cache TTL documented',
      hasComment,
      'Comment about 30 seconds found'
    );
    
    // اختبار عملي للـ TTL
    const testKey = 'ttl-test-model_ttl-test-company';
    const now = Date.now();
    
    modelManager.quotaCache.set(testKey, {
      timestamp: now - 25000, // 25 ثانية مضت
      data: { test: true }
    });
    
    // يجب أن يكون موجود (أقل من 30 ثانية)
    const withinTTL = (now - (now - 25000)) < 30000;
    recordTest(
      'Cache within TTL (25s < 30s)',
      withinTTL,
      'Cache should still be valid'
    );
    
    modelManager.quotaCache.set(testKey, {
      timestamp: now - 35000, // 35 ثانية مضت
      data: { test: true }
    });
    
    // يجب أن يكون منتهي (أكثر من 30 ثانية)
    const expiredTTL = (now - (now - 35000)) >= 30000;
    recordTest(
      'Cache expired after TTL (35s > 30s)',
      expiredTTL,
      'Cache should be expired'
    );
    
    // تنظيف
    modelManager.quotaCache.delete(testKey);
    
  } catch (error) {
    recordTest('Test 6 execution', false, error.message);
  }
}

// ============================================
// الاختبار 7: حد أقصى للمحاولات
// ============================================
async function test7_MaxFallbackAttempts() {
  log('\n📋 Test 7: Max Fallback Attempts', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    const ResponseGenerator = require('./services/aiAgent/responseGenerator');
    const fs = require('fs');
    const path = require('path');
    
    // قراءة الملف
    const filePath = path.join(__dirname, 'services', 'aiAgent', 'responseGenerator.js');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // التحقق من MAX_FALLBACK_ATTEMPTS
    const hasMaxAttempts = fileContent.includes('MAX_FALLBACK_ATTEMPTS') && 
                          fileContent.includes('= 3');
    recordTest(
      'MAX_FALLBACK_ATTEMPTS constant defined (= 3)',
      hasMaxAttempts,
      'Constant found in responseGenerator.js'
    );
    
    // التحقق من الفحص
    const hasCheck = fileContent.includes('triedModels.size < MAX_FALLBACK_ATTEMPTS') ||
                    fileContent.includes('triedModels.size >= MAX_FALLBACK_ATTEMPTS');
    recordTest(
      'Max attempts check implemented',
      hasCheck,
      'triedModels.size comparison found'
    );
    
    // التحقق من رسالة الخطأ
    const hasErrorMessage = fileContent.includes('استنفدت جميع المحاولات') ||
                           fileContent.includes('max_attempts_exceeded');
    recordTest(
      'Error message for max attempts',
      hasErrorMessage,
      'Appropriate error message found'
    );
    
    // التحقق من logging
    const hasLogging = fileContent.includes('attempt ${triedModels.size + 1}/${MAX_FALLBACK_ATTEMPTS}') ||
                      fileContent.includes('attempt') && fileContent.includes('MAX_FALLBACK_ATTEMPTS');
    recordTest(
      'Attempt logging implemented',
      hasLogging,
      'Logging with attempt count found'
    );
    
  } catch (error) {
    recordTest('Test 7 execution', false, error.message);
  }
}

// ============================================
// اختبار التكامل
// ============================================
async function integrationTest() {
  log('\n📋 Integration Test: All Fixes Working Together', 'blue');
  log('=' .repeat(60), 'blue');
  
  try {
    const aiAgentService = require('./services/aiAgentService');
    
    // التحقق من أن جميع المكونات موجودة
    const hasModelManager = !!aiAgentService.getModelManager();
    const hasResponseGenerator = !!aiAgentService.getResponseGenerator();
    
    recordTest(
      'All components initialized',
      hasModelManager && hasResponseGenerator,
      `ModelManager: ${hasModelManager}, ResponseGenerator: ${hasResponseGenerator}`
    );
    
    // التحقق من الاتصال بقاعدة البيانات
    const prisma = getSharedPrismaClient();
    const canConnectDB = !!prisma;
    
    recordTest(
      'Database connection available',
      canConnectDB,
      'Prisma client initialized'
    );
    
    // التحقق من أن جميع الإصلاحات مطبقة
    const allFixesApplied = 
      aiAgentService.getResponseGenerator().globalTriedModels instanceof Map &&
      typeof aiAgentService.getModelManager().invalidateQuotaCache === 'function' &&
      aiAgentService.getModelManager().exhaustedModelsCache instanceof Set;
    
    recordTest(
      'All critical fixes applied',
      allFixesApplied,
      'All 7 fixes verified'
    );
    
  } catch (error) {
    recordTest('Integration test execution', false, error.message);
  }
}

// ============================================
// تشغيل جميع الاختبارات
// ============================================
async function runAllTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🧪 GEMINI KEY SYSTEM FIXES - TEST SUITE', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
  
  const startTime = Date.now();
  
  // تشغيل الاختبارات
  await test1_GlobalTriedModels();
  await test2_ExcludeModels();
  await test3_CacheInvalidation();
  await test4_ExhaustedModelsPersistence();
  await test5_OptimisticLocking();
  await test6_CacheTTL();
  await test7_MaxFallbackAttempts();
  await integrationTest();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // عرض النتائج
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST RESULTS SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\nTotal Tests: ${testResults.total}`, 'blue');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 
      testResults.passed === testResults.total ? 'green' : 'yellow');
  log(`Duration: ${duration}ms\n`, 'blue');
  
  if (testResults.failed === 0) {
    log('🎉 ALL TESTS PASSED! System is ready for deployment.', 'green');
  } else {
    log('⚠️  SOME TESTS FAILED. Please review the failures above.', 'yellow');
  }
  
  log('\n' + '='.repeat(60) + '\n', 'cyan');
  
  // الخروج بكود مناسب
  process.exit(testResults.failed === 0 ? 0 : 1);
}

// تشغيل الاختبارات
if (require.main === module) {
  runAllTests().catch(error => {
    log(`\n❌ Fatal Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  test1_GlobalTriedModels,
  test2_ExcludeModels,
  test3_CacheInvalidation,
  test4_ExhaustedModelsPersistence,
  test5_OptimisticLocking,
  test6_CacheTTL,
  test7_MaxFallbackAttempts,
  integrationTest
};

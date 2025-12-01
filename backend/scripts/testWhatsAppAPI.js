/**
 * 📱 WhatsApp API Quick Test Script
 * سكريبت اختبار سريع لـ WhatsApp API
 * 
 * التشغيل: node scripts/testWhatsAppAPI.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3007/api/v1';

// ألوان للطباعة
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
};

// Token from browser localStorage - update this with your actual token
let authToken = process.env.TEST_TOKEN || '';
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function
async function makeRequest(method, endpoint, data = null, params = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      ...(data && { data }),
      ...(params && { params })
    };
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status || 0
    };
  }
}

function recordTest(name, passed, details = '') {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
    log.success(`${name} ${details ? `- ${details}` : ''}`);
  } else {
    testResults.failed++;
    log.error(`${name} ${details ? `- ${details}` : ''}`);
  }
}

async function runTests() {
  console.log('\n');
  log.title('📱 WhatsApp API Test Suite');
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔐 Authentication
  // ═══════════════════════════════════════════════════════════════════════════════
  
  log.title('🔐 Authentication');
  
  const loginResult = await makeRequest('post', '/auth/login', {
    email: 'ali@ali.com',
    password: '123456' // استبدل بكلمة المرور الصحيحة
  });
  
  if (loginResult.success) {
    authToken = loginResult.data.token || loginResult.data.data?.token;
    if (authToken) {
      recordTest('Login', true, 'Token received');
    } else {
      recordTest('Login', false, 'No token in response');
      log.warning('Cannot continue without authentication');
      return;
    }
  } else {
    recordTest('Login', false, loginResult.error?.message || 'Login failed');
    log.warning('Cannot continue without authentication');
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📱 Sessions Tests
  // ═══════════════════════════════════════════════════════════════════════════════
  
  log.title('📱 Sessions API');
  
  // GET Sessions
  const sessionsResult = await makeRequest('get', '/whatsapp/sessions');
  recordTest(
    'GET /whatsapp/sessions',
    sessionsResult.success && sessionsResult.status === 200,
    sessionsResult.success ? `Found ${sessionsResult.data.sessions?.length || 0} sessions` : sessionsResult.error
  );
  
  // POST Session (create)
  const createSessionResult = await makeRequest('post', '/whatsapp/sessions', {
    name: 'Test Session ' + Date.now(),
    aiEnabled: true,
    autoReply: false,
    aiMode: 'suggest'
  });
  recordTest(
    'POST /whatsapp/sessions',
    createSessionResult.success || createSessionResult.status === 400, // 400 = max sessions reached
    createSessionResult.success ? `Created: ${createSessionResult.data.session?.id}` : createSessionResult.error?.error || 'Max sessions reached'
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // ⚙️ Settings Tests
  // ═══════════════════════════════════════════════════════════════════════════════
  
  log.title('⚙️ Settings API');
  
  // GET Settings
  const settingsResult = await makeRequest('get', '/whatsapp/settings');
  recordTest(
    'GET /whatsapp/settings',
    settingsResult.success && settingsResult.status === 200,
    settingsResult.success ? 'Settings loaded' : settingsResult.error
  );
  
  // PUT Settings
  const updateSettingsResult = await makeRequest('put', '/whatsapp/settings', {
    isEnabled: true,
    maxSessions: 3,
    notificationSound: true,
    browserNotifications: true,
    defaultAIMode: 'suggest'
  });
  recordTest(
    'PUT /whatsapp/settings',
    updateSettingsResult.success && updateSettingsResult.status === 200,
    updateSettingsResult.success ? 'Settings updated' : updateSettingsResult.error
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📝 Quick Replies Tests
  // ═══════════════════════════════════════════════════════════════════════════════
  
  log.title('📝 Quick Replies API');
  
  // GET Quick Replies
  const quickRepliesResult = await makeRequest('get', '/whatsapp/quick-replies');
  recordTest(
    'GET /whatsapp/quick-replies',
    quickRepliesResult.success && quickRepliesResult.status === 200,
    quickRepliesResult.success ? `Found ${quickRepliesResult.data.quickReplies?.length || 0} quick replies` : quickRepliesResult.error
  );
  
  // POST Quick Reply
  const createQRResult = await makeRequest('post', '/whatsapp/quick-replies', {
    title: 'Test Quick Reply',
    shortcut: '/test' + Date.now(),
    content: 'مرحباً {{customer_name}}، شكراً لتواصلك معنا!',
    category: 'greeting'
  });
  recordTest(
    'POST /whatsapp/quick-replies',
    createQRResult.success && createQRResult.status === 201,
    createQRResult.success ? `Created: ${createQRResult.data.quickReply?.id}` : createQRResult.error
  );
  
  // Cleanup - Delete created quick reply
  if (createQRResult.success && createQRResult.data.quickReply?.id) {
    const deleteQRResult = await makeRequest('delete', `/whatsapp/quick-replies/${createQRResult.data.quickReply.id}`);
    recordTest(
      'DELETE /whatsapp/quick-replies/:id',
      deleteQRResult.success && deleteQRResult.status === 200,
      deleteQRResult.success ? 'Deleted' : deleteQRResult.error
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 💬 Conversations Tests
  // ═══════════════════════════════════════════════════════════════════════════════
  
  log.title('💬 Conversations API');
  
  if (sessionsResult.success && sessionsResult.data.sessions?.length > 0) {
    const sessionId = sessionsResult.data.sessions[0].id;
    
    const conversationsResult = await makeRequest('get', '/whatsapp/conversations', null, { sessionId });
    recordTest(
      'GET /whatsapp/conversations',
      conversationsResult.success && conversationsResult.status === 200,
      conversationsResult.success ? `Found ${conversationsResult.data.conversations?.length || 0} conversations` : conversationsResult.error
    );
  } else {
    log.warning('No sessions available for conversations test');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📊 Stats Tests
  // ═══════════════════════════════════════════════════════════════════════════════
  
  log.title('📊 Stats API');
  
  const statsResult = await makeRequest('get', '/whatsapp/stats', null, { period: '7d' });
  recordTest(
    'GET /whatsapp/stats',
    statsResult.success && statsResult.status === 200,
    statsResult.success ? 'Stats loaded' : statsResult.error
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📋 Summary
  // ═══════════════════════════════════════════════════════════════════════════════
  
  log.title('📋 Test Summary');
  
  console.log(`\n${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  console.log(`Total: ${testResults.passed + testResults.failed}\n`);
  
  if (testResults.failed === 0) {
    log.success('All tests passed! 🎉');
  } else {
    log.warning(`${testResults.failed} test(s) failed`);
    console.log('\nFailed tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.name}: ${t.details}`));
  }
  
  console.log('\n');
}

// Run tests
runTests().catch(console.error);

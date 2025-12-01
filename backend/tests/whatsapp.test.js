/**
 * 📱 WhatsApp API Tests
 * اختبارات API لنظام WhatsApp
 */

const request = require('supertest');

// Mock configuration
const BASE_URL = 'http://localhost:3007/api/v1';

// Test token - يجب استبداله بتوكن صالح
let authToken = '';

// Helper function to make authenticated requests
const authRequest = (method, endpoint) => {
  const req = request(BASE_URL)[method](endpoint);
  if (authToken) {
    req.set('Authorization', `Bearer ${authToken}`);
  }
  return req;
};

describe('📱 WhatsApp API Tests', () => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔐 Authentication Setup
  // ═══════════════════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    // Login to get auth token
    try {
      const loginRes = await request(BASE_URL)
        .post('/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123' // استبدل بكلمة المرور الصحيحة
        });

      if (loginRes.body.token) {
        authToken = loginRes.body.token;
        console.log('✅ Authentication successful');
      } else if (loginRes.body.data?.token) {
        authToken = loginRes.body.data.token;
        console.log('✅ Authentication successful');
      }
    } catch (error) {
      console.log('⚠️ Could not authenticate, tests may fail');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📱 Sessions Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Sessions API', () => {

    test('GET /whatsapp/sessions - should return sessions list', async () => {
      const res = await authRequest('get', '/whatsapp/sessions');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);

      console.log(`📱 Found ${res.body.sessions.length} sessions`);
    });

    test('POST /whatsapp/sessions - should create new session', async () => {
      const res = await authRequest('post', '/whatsapp/sessions')
        .send({
          name: 'Test Session ' + Date.now(),
          aiEnabled: true,
          autoReply: false,
          aiMode: 'suggest'
        });

      // يمكن أن يكون 201 (created) أو 400 (max sessions reached)
      expect([201, 400]).toContain(res.status);

      if (res.status === 201) {
        expect(res.body).toHaveProperty('session');
        expect(res.body.session).toHaveProperty('id');
        console.log('✅ Session created:', res.body.session.id);
      } else {
        console.log('⚠️ Could not create session:', res.body.error);
      }
    });

    test('GET /whatsapp/sessions/:id - should return session details', async () => {
      // First get sessions list
      const listRes = await authRequest('get', '/whatsapp/sessions');

      if (listRes.body.sessions && listRes.body.sessions.length > 0) {
        const sessionId = listRes.body.sessions[0].id;
        const res = await authRequest('get', `/whatsapp/sessions/${sessionId}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('session');
        expect(res.body.session.id).toBe(sessionId);
      } else {
        console.log('⚠️ No sessions to test');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ⚙️ Settings Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Settings API', () => {

    test('GET /whatsapp/settings - should return settings', async () => {
      const res = await authRequest('get', '/whatsapp/settings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settings');

      console.log('⚙️ Settings loaded:', res.body.settings ? 'Yes' : 'No');
    });

    test('PUT /whatsapp/settings - should update settings', async () => {
      const res = await authRequest('put', '/whatsapp/settings')
        .send({
          isEnabled: true,
          maxSessions: 3,
          notificationSound: true,
          browserNotifications: true,
          defaultAIMode: 'suggest'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settings');
      console.log('✅ Settings updated');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📝 Quick Replies Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Quick Replies API', () => {
    let createdQuickReplyId = null;

    test('GET /whatsapp/quick-replies - should return quick replies list', async () => {
      const res = await authRequest('get', '/whatsapp/quick-replies');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('quickReplies');
      expect(Array.isArray(res.body.quickReplies)).toBe(true);

      console.log(`📝 Found ${res.body.quickReplies.length} quick replies`);
    });

    test('POST /whatsapp/quick-replies - should create quick reply', async () => {
      const res = await authRequest('post', '/whatsapp/quick-replies')
        .send({
          title: 'Test Quick Reply',
          shortcut: '/test',
          content: 'مرحباً {{customer_name}}، شكراً لتواصلك معنا!',
          category: 'greeting'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('quickReply');
      expect(res.body.quickReply).toHaveProperty('id');

      createdQuickReplyId = res.body.quickReply.id;
      console.log('✅ Quick reply created:', createdQuickReplyId);
    });

    test('PUT /whatsapp/quick-replies/:id - should update quick reply', async () => {
      if (!createdQuickReplyId) {
        console.log('⚠️ No quick reply to update');
        return;
      }

      const res = await authRequest('put', `/whatsapp/quick-replies/${createdQuickReplyId}`)
        .send({
          title: 'Updated Quick Reply',
          content: 'محتوى محدث'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('quickReply');
      console.log('✅ Quick reply updated');
    });

    test('DELETE /whatsapp/quick-replies/:id - should delete quick reply', async () => {
      if (!createdQuickReplyId) {
        console.log('⚠️ No quick reply to delete');
        return;
      }

      const res = await authRequest('delete', `/whatsapp/quick-replies/${createdQuickReplyId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      console.log('✅ Quick reply deleted');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 💬 Conversations Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Conversations API', () => {

    test('GET /whatsapp/conversations - should return conversations', async () => {
      // First get a session
      const sessionsRes = await authRequest('get', '/whatsapp/sessions');

      if (sessionsRes.body.sessions && sessionsRes.body.sessions.length > 0) {
        const sessionId = sessionsRes.body.sessions[0].id;
        const res = await authRequest('get', '/whatsapp/conversations')
          .query({ sessionId });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('conversations');
        expect(Array.isArray(res.body.conversations)).toBe(true);

        console.log(`💬 Found ${res.body.conversations.length} conversations`);
      } else {
        console.log('⚠️ No sessions available for conversations test');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📊 Stats Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Stats API', () => {

    test('GET /whatsapp/stats - should return statistics', async () => {
      const res = await authRequest('get', '/whatsapp/stats')
        .query({ period: '7d' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stats');

      console.log('📊 Stats loaded');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🧪 Manual Test Script
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * لتشغيل الاختبارات يدوياً:
 * 
 * 1. تأكد من تشغيل السيرفر: npm start
 * 2. شغل الاختبارات: npm test -- tests/whatsapp.test.js
 * 
 * أو استخدم curl للاختبار اليدوي:
 * 
 * # Get sessions
 * curl -X GET http://localhost:3007/api/v1/whatsapp/sessions \
 *   -H "Authorization: Bearer YOUR_TOKEN"
 * 
 * # Get settings
 * curl -X GET http://localhost:3007/api/v1/whatsapp/settings \
 *   -H "Authorization: Bearer YOUR_TOKEN"
 * 
 * # Get quick replies
 * curl -X GET http://localhost:3007/api/v1/whatsapp/quick-replies \
 *   -H "Authorization: Bearer YOUR_TOKEN"
 */

// Export for use in other test files
module.exports = { authRequest };

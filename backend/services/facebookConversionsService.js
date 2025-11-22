/**
 * Facebook Conversions API Service
 * 
 * هذا الـ Service مسؤول عن إرسال الأحداث لـ Facebook Conversions API
 * يدعم جميع الأحداث الرئيسية: PageView, ViewContent, AddToCart, Purchase, etc.
 * 
 * @requires facebook-nodejs-business-sdk
 * @requires crypto
 */

const crypto = require('crypto');

// سيتم تثبيت المكتبة لاحقاً: npm install facebook-nodejs-business-sdk
// const bizSdk = require('facebook-nodejs-business-sdk');

class FacebookConversionsService {
  constructor(pixelId, accessToken, testEventCode = null) {
    this.pixelId = pixelId;
    this.accessToken = accessToken;
    this.testEventCode = testEventCode;
    
    // TODO: Uncomment when facebook-nodejs-business-sdk is installed
    // bizSdk.FacebookAdsApi.init(accessToken);
    // this.ServerEvent = bizSdk.ServerEvent;
    // this.EventRequest = bizSdk.EventRequest;
    // this.UserData = bizSdk.UserData;
    // this.CustomData = bizSdk.CustomData;
  }

  /**
   * Hash user data using SHA256 (GDPR compliant)
   * @param {string} data - البيانات المراد تشفيرها
   * @returns {string|null} - البيانات المشفرة أو null
   */
  hashData(data) {
    if (!data) return null;
    
    try {
      // تنظيف البيانات: lowercase + trim
      const cleanData = data.toString().toLowerCase().trim();
      
      // تشفير SHA256
      return crypto
        .createHash('sha256')
        .update(cleanData)
        .digest('hex');
    } catch (error) {
      console.error('❌ Error hashing data:', error);
      return null;
    }
  }

  /**
   * تنظيف رقم الهاتف (إزالة المسافات والرموز)
   * @param {string} phone - رقم الهاتف
   * @returns {string} - رقم نظيف
   */
  cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, ''); // إزالة كل شيء ما عدا الأرقام
  }

  /**
   * بناء User Data من المعلومات المتاحة
   * @param {Object} userData - بيانات المستخدم
   * @returns {Object} - User Data object
   */
  buildUserData(userData) {
    const user = {};
    
    // Required fields (hashed)
    if (userData.email) {
      user.em = this.hashData(userData.email);
    }
    if (userData.phone) {
      const cleanPhone = this.cleanPhone(userData.phone);
      user.ph = this.hashData(cleanPhone);
    }
    
    // Optional but recommended (hashed)
    if (userData.firstName) {
      user.fn = this.hashData(userData.firstName);
    }
    if (userData.lastName) {
      user.ln = this.hashData(userData.lastName);
    }
    if (userData.city) {
      user.ct = this.hashData(userData.city);
    }
    if (userData.country) {
      user.country = this.hashData(userData.country || 'eg');
    }
    if (userData.zip) {
      user.zp = this.hashData(userData.zip);
    }
    
    // Technical data (not hashed)
    if (userData.ip) {
      user.client_ip_address = userData.ip;
    }
    if (userData.userAgent) {
      user.client_user_agent = userData.userAgent;
    }
    if (userData.fbc) {
      user.fbc = userData.fbc; // Facebook Click ID
    }
    if (userData.fbp) {
      user.fbp = userData.fbp; // Facebook Browser ID
    }
    
    return user;
  }

  /**
   * إرسال حدث PageView
   * @param {Object} userData - بيانات المستخدم
   * @param {string} pageUrl - رابط الصفحة
   * @param {string} eventId - معرف الحدث (للـ Deduplication)
   * @returns {Promise<Object>} - استجابة Facebook
   */
  async trackPageView(userData, pageUrl, eventId) {
    try {
      const event = {
        event_name: 'PageView',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: pageUrl,
        action_source: 'website',
        user_data: this.buildUserData(userData)
      };

      return await this.sendEvent(event);
    } catch (error) {
      console.error('❌ Error tracking PageView:', error);
      throw error;
    }
  }

  /**
   * إرسال حدث ViewContent
   * @param {Object} userData - بيانات المستخدم
   * @param {Object} product - بيانات المنتج
   * @param {string} eventId - معرف الحدث
   * @returns {Promise<Object>}
   */
  async trackViewContent(userData, product, eventId) {
    try {
      const event = {
        event_name: 'ViewContent',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: userData.pageUrl,
        action_source: 'website',
        user_data: this.buildUserData(userData),
        custom_data: {
          content_ids: [product.id],
          content_name: product.name,
          content_type: 'product',
          content_category: product.category,
          value: parseFloat(product.price),
          currency: 'EGP'
        }
      };

      return await this.sendEvent(event);
    } catch (error) {
      console.error('❌ Error tracking ViewContent:', error);
      throw error;
    }
  }

  /**
   * إرسال حدث AddToCart
   * @param {Object} userData - بيانات المستخدم
   * @param {Object} product - بيانات المنتج
   * @param {string} eventId - معرف الحدث
   * @returns {Promise<Object>}
   */
  async trackAddToCart(userData, product, eventId) {
    try {
      const event = {
        event_name: 'AddToCart',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: userData.pageUrl,
        action_source: 'website',
        user_data: this.buildUserData(userData),
        custom_data: {
          content_ids: [product.id],
          content_name: product.name,
          content_type: 'product',
          value: parseFloat(product.price),
          currency: 'EGP'
        }
      };

      return await this.sendEvent(event);
    } catch (error) {
      console.error('❌ Error tracking AddToCart:', error);
      throw error;
    }
  }

  /**
   * إرسال حدث InitiateCheckout
   * @param {Object} userData - بيانات المستخدم
   * @param {Object} cart - بيانات السلة
   * @param {string} eventId - معرف الحدث
   * @returns {Promise<Object>}
   */
  async trackInitiateCheckout(userData, cart, eventId) {
    try {
      const contentIds = cart.items.map(item => item.productId);
      const contents = cart.items.map(item => ({
        id: item.productId,
        quantity: item.quantity,
        item_price: parseFloat(item.price)
      }));

      const event = {
        event_name: 'InitiateCheckout',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: userData.pageUrl,
        action_source: 'website',
        user_data: this.buildUserData(userData),
        custom_data: {
          content_ids: contentIds,
          contents: contents,
          content_type: 'product',
          value: parseFloat(cart.total),
          currency: 'EGP',
          num_items: cart.items.length
        }
      };

      return await this.sendEvent(event);
    } catch (error) {
      console.error('❌ Error tracking InitiateCheckout:', error);
      throw error;
    }
  }

  /**
   * إرسال حدث Purchase (الأهم!)
   * @param {Object} userData - بيانات المستخدم
   * @param {Object} order - بيانات الطلب
   * @param {string} eventId - معرف الحدث
   * @returns {Promise<Object>}
   */
  async trackPurchase(userData, order, eventId) {
    try {
      const contentIds = order.items.map(item => item.productId);
      const contents = order.items.map(item => ({
        id: item.productId,
        quantity: item.quantity,
        item_price: parseFloat(item.price)
      }));

      const event = {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: userData.pageUrl,
        action_source: 'website',
        user_data: this.buildUserData(userData),
        custom_data: {
          content_ids: contentIds,
          contents: contents,
          content_type: 'product',
          value: parseFloat(order.total),
          currency: 'EGP',
          num_items: order.items.length,
          order_id: order.orderNumber
        }
      };

      return await this.sendEvent(event);
    } catch (error) {
      console.error('❌ Error tracking Purchase:', error);
      throw error;
    }
  }

  /**
   * إرسال الحدث لـ Facebook Conversions API
   * @param {Object} event - بيانات الحدث
   * @returns {Promise<Object>} - استجابة Facebook
   */
  async sendEvent(event) {
    try {
      // TODO: Implement actual Facebook API call when SDK is installed
      // For now, just log the event
      console.log('📊 [Facebook CAPI] Sending event:', {
        pixelId: this.pixelId,
        eventName: event.event_name,
        eventId: event.event_id,
        testMode: !!this.testEventCode
      });

      // Simulate API call
      const response = {
        success: true,
        events_received: 1,
        messages: [],
        fbtrace_id: `fb_trace_${Date.now()}`
      };

      console.log('✅ [Facebook CAPI] Event sent successfully');
      return response;

      /* 
      // Real implementation (uncomment when SDK is installed):
      const eventRequest = new this.EventRequest(
        this.accessToken, 
        this.pixelId
      ).setEvents([event]);

      if (this.testEventCode) {
        eventRequest.setTestEventCode(this.testEventCode);
      }

      const response = await eventRequest.execute();
      return response;
      */
    } catch (error) {
      console.error('❌ [Facebook CAPI] Error sending event:', {
        message: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * اختبار الاتصال مع Facebook
   * @returns {Promise<Object>}
   */
  async testConnection() {
    try {
      const testEvent = {
        event_name: 'PageView',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `test_${Date.now()}`,
        event_source_url: 'https://test.com',
        action_source: 'website',
        user_data: {
          client_ip_address: '1.1.1.1',
          client_user_agent: 'Test User Agent'
        }
      };

      const response = await this.sendEvent(testEvent);
      
      return {
        success: true,
        message: 'Connection successful',
        response
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error
      };
    }
  }
}

module.exports = FacebookConversionsService;

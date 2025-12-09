/**
 * 🔄 WooCommerce Auto Sync Scheduler
 * مزامنة تلقائية للطلبات بنظام Polling - يعمل على localhost بدون webhooks
 */

const { getSharedPrismaClient } = require('./sharedDatabase');

class WooCommerceAutoSyncScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.defaultIntervalMinutes = 5; // كل 5 دقائق افتراضياً
    this.activeCompanies = new Map(); // companyId -> intervalId
  }

  /**
   * بدء المزامنة التلقائية لجميع الشركات
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ [WOOCOMMERCE-SCHEDULER] Already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 [WOOCOMMERCE-SCHEDULER] Starting auto sync scheduler...');

    // تشغيل أول مزامنة بعد 30 ثانية من بدء السيرفر
    setTimeout(() => {
      this.syncAllCompanies();
    }, 30000);

    // جدولة المزامنة الدورية
    this.intervalId = setInterval(() => {
      this.syncAllCompanies();
    }, this.defaultIntervalMinutes * 60 * 1000);

    console.log(`✅ [WOOCOMMERCE-SCHEDULER] Started - syncing every ${this.defaultIntervalMinutes} minutes`);
  }

  /**
   * إيقاف المزامنة التلقائية
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [WOOCOMMERCE-SCHEDULER] Stopped');
  }

  /**
   * مزامنة جميع الشركات المفعلة
   */
  async syncAllCompanies() {
    try {
      const prisma = getSharedPrismaClient();
      
      // جلب الشركات التي لديها مزامنة تلقائية مفعلة
      const companiesWithAutoSync = await prisma.wooCommerceSettings.findMany({
        where: {
          syncEnabled: true,
          isActive: true
        },
        select: {
          companyId: true,
          syncInterval: true,
          lastSyncAt: true
        }
      });

      if (companiesWithAutoSync.length === 0) {
        console.log('📭 [WOOCOMMERCE-SCHEDULER] No companies with auto sync enabled');
        return;
      }

      console.log(`🔄 [WOOCOMMERCE-SCHEDULER] Syncing ${companiesWithAutoSync.length} companies...`);

      for (const company of companiesWithAutoSync) {
        // التحقق من الفاصل الزمني للمزامنة
        const syncIntervalMinutes = company.syncInterval || this.defaultIntervalMinutes;
        const lastSync = company.lastSyncAt ? new Date(company.lastSyncAt) : new Date(0);
        const now = new Date();
        const minutesSinceLastSync = (now - lastSync) / (1000 * 60);

        // تخطي إذا لم يحن وقت المزامنة بعد
        if (minutesSinceLastSync < syncIntervalMinutes) {
          continue;
        }

        // تشغيل المزامنة
        await this.syncCompany(company.companyId);
      }

    } catch (error) {
      console.error('❌ [WOOCOMMERCE-SCHEDULER] Error syncing companies:', error.message);
    }
  }

  /**
   * مزامنة شركة واحدة
   */
  async syncCompany(companyId) {
    try {
      console.log(`🔄 [WOOCOMMERCE-SCHEDULER] Syncing company: ${companyId}`);
      
      const prisma = getSharedPrismaClient();
      
      const settings = await prisma.wooCommerceSettings.findUnique({
        where: { companyId }
      });

      if (!settings || !settings.syncEnabled) {
        return { success: false, message: 'Sync disabled' };
      }

      const axios = require('axios');
      const baseURL = settings.storeUrl.replace(/\/$/, '');
      
      const wooClient = {
        get: async (endpoint, params = {}) => {
          const response = await axios.get(`${baseURL}/wp-json/wc/v3${endpoint}`, {
            params,
            auth: {
              username: settings.consumerKey,
              password: settings.consumerSecret
            },
            timeout: 30000
          });
          return response.data;
        }
      };

      const results = {
        imported: 0,
        updated: 0,
        errors: []
      };

      // جلب الطلبات الجديدة من WooCommerce
      const lastSync = settings.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // آخر 24 ساعة إذا لم يكن هناك مزامنة سابقة
      
      try {
        const wooOrders = await wooClient.get('/orders', {
          after: lastSync.toISOString(),
          per_page: 50,
          orderby: 'date',
          order: 'desc'
        });

        console.log(`📦 [WOOCOMMERCE-SCHEDULER] Found ${wooOrders.length} orders to sync`);

        for (const wooOrder of wooOrders) {
          try {
            // التحقق من وجود الطلب
            const existingOrder = await prisma.order.findFirst({
              where: {
                companyId,
                wooCommerceId: String(wooOrder.id)
              }
            });

            if (existingOrder) {
              // تحديث الطلب الموجود
              const newStatus = this.mapWooStatusToLocal(wooOrder.status);
              if (existingOrder.wooCommerceStatus !== wooOrder.status) {
                await prisma.order.update({
                  where: { id: existingOrder.id },
                  data: {
                    status: newStatus,
                    wooCommerceStatus: wooOrder.status,
                    lastSyncAt: new Date()
                  }
                });
                results.updated++;
              }
            } else {
              // إنشاء طلب جديد
              await this.createOrderFromWoo(prisma, companyId, wooOrder, settings);
              results.imported++;
            }
          } catch (orderError) {
            console.error(`❌ [WOOCOMMERCE-SCHEDULER] Error processing order ${wooOrder.id}:`, orderError.message);
            results.errors.push(`Order ${wooOrder.id}: ${orderError.message}`);
          }
        }

      } catch (fetchError) {
        console.error(`❌ [WOOCOMMERCE-SCHEDULER] Error fetching orders:`, fetchError.message);
        results.errors.push(`Fetch error: ${fetchError.message}`);
      }

      // تحديث وقت آخر مزامنة
      await prisma.wooCommerceSettings.update({
        where: { companyId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: results.errors.length > 0 ? 'partial' : 'success',
          lastSyncMessage: `Imported: ${results.imported}, Updated: ${results.updated}`
        }
      });

      // تسجيل المزامنة
      if (results.imported > 0 || results.updated > 0 || results.errors.length > 0) {
        await prisma.wooCommerceSyncLog.create({
          data: {
            companyId,
            syncType: 'auto_polling',
            syncDirection: 'from_woo',
            status: results.errors.length > 0 ? 'partial' : 'success',
            totalItems: results.imported + results.updated,
            successCount: results.imported + results.updated,
            failedCount: results.errors.length,
            triggeredBy: 'scheduler',
            completedAt: new Date()
          }
        });
      }

      console.log(`✅ [WOOCOMMERCE-SCHEDULER] Company ${companyId}: Imported ${results.imported}, Updated ${results.updated}`);
      return { success: true, results };

    } catch (error) {
      console.error(`❌ [WOOCOMMERCE-SCHEDULER] Error syncing company ${companyId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * إنشاء طلب من بيانات WooCommerce
   */
  async createOrderFromWoo(prisma, companyId, wooOrder, settings) {
    const billing = wooOrder.billing || {};
    const firstName = billing.first_name || 'عميل';
    const lastName = billing.last_name || 'WooCommerce';
    const customerName = `${firstName} ${lastName}`.trim();
    const customerPhone = billing.phone || '';
    const customerEmail = billing.email || '';

    // البحث عن العميل أو إنشاء واحد جديد
    let customer = null;
    
    if (customerEmail) {
      customer = await prisma.customer.findFirst({
        where: { email: customerEmail, companyId }
      });
    }

    if (!customer && customerPhone) {
      customer = await prisma.customer.findFirst({
        where: { phone: customerPhone, companyId }
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId,
          firstName,
          lastName,
          phone: customerPhone || null,
          email: customerEmail || null,
          notes: 'تم الاستيراد تلقائياً من WooCommerce',
          status: 'CUSTOMER'
        }
      });
    }

    // إنشاء الطلب
    const order = await prisma.order.create({
      data: {
        companyId,
        customerId: customer.id,
        orderNumber: `WOO-${wooOrder.id}`,
        status: this.mapWooStatusToLocal(wooOrder.status),
        paymentStatus: wooOrder.date_paid ? 'PAID' : 'PENDING',
        paymentMethod: this.mapPaymentMethod(wooOrder.payment_method),
        subtotal: parseFloat(wooOrder.total) - parseFloat(wooOrder.shipping_total || 0),
        shipping: parseFloat(wooOrder.shipping_total || 0),
        discount: parseFloat(wooOrder.discount_total || 0),
        total: parseFloat(wooOrder.total),
        currency: wooOrder.currency || 'EGP',
        customerName,
        customerPhone,
        customerEmail,
        customerAddress: billing.address_1,
        city: billing.city,
        notes: wooOrder.customer_note,
        wooCommerceId: String(wooOrder.id),
        wooCommerceOrderKey: wooOrder.order_key,
        wooCommerceStatus: wooOrder.status,
        wooCommerceDateCreated: new Date(wooOrder.date_created),
        wooCommerceUrl: `${settings.storeUrl}/wp-admin/post.php?post=${wooOrder.id}&action=edit`,
        syncedFromWoo: true,
        lastSyncAt: new Date(),
        sourceType: 'woocommerce_auto_polling'
      }
    });

    // إنشاء عناصر الطلب
    if (wooOrder.line_items && wooOrder.line_items.length > 0) {
      for (const item of wooOrder.line_items) {
        let product = null;

        if (item.sku) {
          product = await prisma.product.findFirst({
            where: { sku: item.sku, companyId }
          });
        }

        if (!product && item.product_id) {
          product = await prisma.product.findFirst({
            where: { wooCommerceId: String(item.product_id), companyId }
          });
        }

        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product?.id || null,
            productName: item.name,
            productSku: item.sku,
            quantity: item.quantity,
            price: parseFloat(item.price),
            total: parseFloat(item.total)
          }
        });
      }
    }

    return order;
  }

  /**
   * تحويل حالة WooCommerce لحالة النظام
   */
  mapWooStatusToLocal(wooStatus) {
    const statusMap = {
      'pending': 'PENDING',
      'processing': 'PROCESSING',
      'on-hold': 'PENDING',
      'completed': 'DELIVERED',
      'cancelled': 'CANCELLED',
      'refunded': 'CANCELLED',
      'failed': 'CANCELLED'
    };
    return statusMap[wooStatus] || 'PENDING';
  }

  /**
   * تحويل طريقة الدفع
   */
  mapPaymentMethod(wooPaymentMethod) {
    const methodMap = {
      'cod': 'CASH',
      'bacs': 'BANK_TRANSFER',
      'paypal': 'CREDIT_CARD',
      'stripe': 'CREDIT_CARD'
    };
    return methodMap[wooPaymentMethod] || 'CASH';
  }

  /**
   * الحصول على حالة المزامنة
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.defaultIntervalMinutes,
      activeCompanies: this.activeCompanies.size
    };
  }

  /**
   * تغيير فترة المزامنة
   */
  setInterval(minutes) {
    this.defaultIntervalMinutes = minutes;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    console.log(`⏱️ [WOOCOMMERCE-SCHEDULER] Interval changed to ${minutes} minutes`);
  }
}

// Singleton instance
let instance = null;

const getWooCommerceAutoSyncScheduler = () => {
  if (!instance) {
    instance = new WooCommerceAutoSyncScheduler();
  }
  return instance;
};

module.exports = {
  WooCommerceAutoSyncScheduler,
  getWooCommerceAutoSyncScheduler
};

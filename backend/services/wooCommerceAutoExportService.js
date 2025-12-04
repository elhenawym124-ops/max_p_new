/**
 * 🛒 WooCommerce Auto Export Service
 * تصدير الطلبات تلقائياً لـ WooCommerce عند إنشائها
 */

const { getSharedPrismaClient } = require('./sharedDatabase');
const axios = require('axios');

class WooCommerceAutoExportService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء WooCommerce API Client
   */
  createWooClient(settings) {
    const baseURL = settings.storeUrl.replace(/\/$/, '');
    return {
      post: async (endpoint, data = {}) => {
        const response = await axios.post(`${baseURL}/wp-json/wc/v3${endpoint}`, data, {
          auth: {
            username: settings.consumerKey,
            password: settings.consumerSecret
          },
          timeout: 30000
        });
        return response.data;
      }
    };
  }

  /**
   * تحويل حالة النظام لحالة WooCommerce
   */
  mapLocalStatusToWoo(status) {
    const statusMap = {
      'PENDING': 'pending',
      'PROCESSING': 'processing',
      'SHIPPED': 'on-hold',
      'DELIVERED': 'completed',
      'CANCELLED': 'cancelled',
      'REFUNDED': 'refunded'
    };
    return statusMap[status] || 'pending';
  }

  /**
   * تصدير طلب واحد لـ WooCommerce
   */
  async exportOrderToWooCommerce(orderId) {
    try {
      // جلب الطلب مع التفاصيل
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true
            }
          },
          company: true
        }
      });

      if (!order) {
        console.log(`⚠️ [WOOCOMMERCE-EXPORT] Order not found: ${orderId}`);
        return { success: false, message: 'Order not found' };
      }

      // تجاهل الطلبات المستوردة من WooCommerce
      if (order.syncedFromWoo) {
        console.log(`⏭️ [WOOCOMMERCE-EXPORT] Skipping imported order: ${order.orderNumber}`);
        return { success: false, message: 'Order was imported from WooCommerce' };
      }

      // تجاهل الطلبات المصدرة مسبقاً
      if (order.syncedToWoo) {
        console.log(`⏭️ [WOOCOMMERCE-EXPORT] Order already exported: ${order.orderNumber}`);
        return { success: false, message: 'Order already exported' };
      }

      // جلب إعدادات WooCommerce
      const settings = await this.prisma.wooCommerceSettings.findUnique({
        where: { companyId: order.companyId }
      });

      if (!settings || !settings.syncEnabled) {
        console.log(`⏭️ [WOOCOMMERCE-EXPORT] Auto export disabled for company: ${order.companyId}`);
        return { success: false, message: 'Auto export disabled' };
      }

      // التحقق من اتجاه المزامنة
      if (settings.syncDirection === 'import_only') {
        console.log(`⏭️ [WOOCOMMERCE-EXPORT] Export disabled (import_only mode)`);
        return { success: false, message: 'Export disabled' };
      }

      console.log(`📤 [WOOCOMMERCE-EXPORT] Exporting order: ${order.orderNumber}`);

      const wooClient = this.createWooClient(settings);

      // تحضير بيانات الطلب
      const wooOrderData = {
        status: this.mapLocalStatusToWoo(order.status),
        billing: {
          first_name: order.customerName?.split(' ')[0] || '',
          last_name: order.customerName?.split(' ').slice(1).join(' ') || '',
          phone: order.customerPhone || '',
          email: order.customerEmail || '',
          address_1: order.customerAddress || '',
          city: order.city || ''
        },
        shipping: {
          first_name: order.customerName?.split(' ')[0] || '',
          last_name: order.customerName?.split(' ').slice(1).join(' ') || '',
          address_1: order.customerAddress || '',
          city: order.city || ''
        },
        line_items: order.items.map(item => ({
          name: item.product?.name || item.productName || 'منتج',
          quantity: item.quantity,
          total: String(parseFloat(item.total || 0))
        })),
        meta_data: [
          { key: '_local_order_id', value: order.id },
          { key: '_local_order_number', value: order.orderNumber },
          { key: '_synced_from_local', value: 'true' }
        ]
      };

      // إنشاء الطلب في WooCommerce
      const createdOrder = await wooClient.post('/orders', wooOrderData);

      // تحديث الطلب المحلي
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          wooCommerceId: String(createdOrder.id),
          wooCommerceOrderKey: createdOrder.order_key,
          wooCommerceStatus: createdOrder.status,
          wooCommerceUrl: `${settings.storeUrl}/wp-admin/post.php?post=${createdOrder.id}&action=edit`,
          syncedToWoo: true,
          lastSyncAt: new Date()
        }
      });

      // تسجيل المزامنة
      await this.prisma.wooCommerceSyncLog.create({
        data: {
          companyId: order.companyId,
          syncType: 'export_order',
          syncDirection: 'to_woo',
          status: 'success',
          totalItems: 1,
          successCount: 1,
          triggeredBy: 'auto_export',
          completedAt: new Date(),
          metadata: JSON.stringify({
            localOrderId: order.id,
            localOrderNumber: order.orderNumber,
            wooOrderId: createdOrder.id
          })
        }
      });

      console.log(`✅ [WOOCOMMERCE-EXPORT] Order exported successfully: ${order.orderNumber} → WooCommerce #${createdOrder.id}`);

      return {
        success: true,
        wooOrderId: createdOrder.id,
        message: 'Order exported successfully'
      };

    } catch (error) {
      console.error(`❌ [WOOCOMMERCE-EXPORT] Error exporting order ${orderId}:`, error.message);
      
      // تسجيل الخطأ
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: { companyId: true, orderNumber: true }
        });
        
        if (order) {
          await this.prisma.wooCommerceSyncLog.create({
            data: {
              companyId: order.companyId,
              syncType: 'export_order',
              syncDirection: 'to_woo',
              status: 'failed',
              totalItems: 1,
              failedCount: 1,
              triggeredBy: 'auto_export',
              errorMessage: error.message,
              completedAt: new Date()
            }
          });
        }
      } catch (logError) {
        console.error('❌ [WOOCOMMERCE-EXPORT] Error logging failure:', logError.message);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * تصدير طلب بشكل غير متزامن (non-blocking)
   */
  exportOrderAsync(orderId) {
    // تشغيل التصدير في الخلفية بدون انتظار
    setImmediate(async () => {
      try {
        await this.exportOrderToWooCommerce(orderId);
      } catch (error) {
        console.error(`❌ [WOOCOMMERCE-EXPORT] Async export failed for order ${orderId}:`, error.message);
      }
    });
  }
}

// Singleton instance
let instance = null;

const getWooCommerceAutoExportService = () => {
  if (!instance) {
    instance = new WooCommerceAutoExportService();
  }
  return instance;
};

module.exports = {
  WooCommerceAutoExportService,
  getWooCommerceAutoExportService
};

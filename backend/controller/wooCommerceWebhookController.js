const { getSharedPrismaClient } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();
const crypto = require('crypto');

/**
 * 🔧 Helper: التحقق من صحة Webhook Signature
 */
const verifyWebhookSignature = (payload, signature, secret) => {
  if (!signature || !secret) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');
  
  return signature === expectedSignature;
};

/**
 * 🔧 Helper: تحويل حالة WooCommerce لحالة النظام
 */
const mapWooStatusToLocal = (wooStatus) => {
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
};

/**
 * 🔧 Helper: تحويل طريقة الدفع
 */
const mapPaymentMethod = (wooPaymentMethod) => {
  const methodMap = {
    'cod': 'CASH',
    'bacs': 'BANK_TRANSFER',
    'paypal': 'CREDIT_CARD',
    'stripe': 'CREDIT_CARD'
  };
  return methodMap[wooPaymentMethod] || 'CASH';
};

// ═══════════════════════════════════════════════════════════════
// 🔔 Webhook Handlers
// ═══════════════════════════════════════════════════════════════

/**
 * استقبال Webhook من WooCommerce
 * POST /api/v1/woocommerce/webhook/:companyId
 */
const handleWooCommerceWebhook = async (req, res) => {
  try {
    const { companyId } = req.params;
    const signature = req.headers['x-wc-webhook-signature'];
    const topic = req.headers['x-wc-webhook-topic'];
    const rawBody = JSON.stringify(req.body);

    console.log(`🔔 [WEBHOOK] Received WooCommerce webhook for company: ${companyId}`);
    console.log(`   Topic: ${topic}`);

    // جلب إعدادات الشركة
    const settings = await prisma.wooCommerceSettings.findUnique({
      where: { companyId }
    });

    if (!settings || !settings.webhookEnabled) {
      console.log(`⚠️ [WEBHOOK] Webhooks not enabled for company: ${companyId}`);
      return res.status(200).json({ message: 'Webhooks not enabled' });
    }

    // التحقق من الـ Signature
    if (settings.webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, settings.webhookSecret);
      if (!isValid) {
        console.log(`❌ [WEBHOOK] Invalid signature for company: ${companyId}`);
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    // معالجة حسب نوع الـ Webhook
    switch (topic) {
      case 'order.created':
        await handleOrderCreated(companyId, req.body, settings);
        break;
      case 'order.updated':
        await handleOrderUpdated(companyId, req.body, settings);
        break;
      case 'order.deleted':
        await handleOrderDeleted(companyId, req.body);
        break;
      default:
        console.log(`⚠️ [WEBHOOK] Unhandled topic: ${topic}`);
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error);
    // نرجع 200 عشان WooCommerce ما يعيدش المحاولة
    res.status(200).json({ success: false, error: error.message });
  }
};

/**
 * معالجة طلب جديد من WooCommerce
 */
const handleOrderCreated = async (companyId, orderData, settings) => {
  try {
    console.log(`📦 [WEBHOOK] Processing new order: ${orderData.id}`);

    // التحقق من وجود الطلب
    const existingOrder = await prisma.order.findFirst({
      where: {
        wooCommerceId: orderData.id.toString(),
        companyId
      }
    });

    if (existingOrder) {
      console.log(`⚠️ [WEBHOOK] Order already exists: ${orderData.id}`);
      return;
    }

    // البحث عن العميل أو إنشاء واحد جديد
    let customer = null;
    const billing = orderData.billing || {};

    if (billing.email) {
      customer = await prisma.customer.findFirst({
        where: { email: billing.email, companyId }
      });
    }

    if (!customer && billing.phone) {
      customer = await prisma.customer.findFirst({
        where: { phone: billing.phone, companyId }
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          firstName: billing.first_name || 'عميل',
          lastName: billing.last_name || 'WooCommerce',
          email: billing.email || null,
          phone: billing.phone || null,
          companyId,
          status: 'CUSTOMER'
        }
      });
      console.log(`✅ [WEBHOOK] Created customer: ${customer.firstName}`);
    }

    // إنشاء الطلب
    const order = await prisma.order.create({
      data: {
        orderNumber: `WOO-${orderData.id}`,
        customerId: customer.id,
        companyId,
        status: mapWooStatusToLocal(orderData.status),
        paymentStatus: orderData.date_paid ? 'PAID' : 'PENDING',
        paymentMethod: mapPaymentMethod(orderData.payment_method),
        subtotal: parseFloat(orderData.total) - parseFloat(orderData.shipping_total || 0),
        tax: parseFloat(orderData.total_tax || 0),
        shipping: parseFloat(orderData.shipping_total || 0),
        discount: parseFloat(orderData.discount_total || 0),
        total: parseFloat(orderData.total),
        currency: orderData.currency || 'EGP',
        customerName: `${billing.first_name || ''} ${billing.last_name || ''}`.trim(),
        customerPhone: billing.phone,
        customerEmail: billing.email,
        customerAddress: billing.address_1,
        city: billing.city,
        notes: orderData.customer_note,
        sourceType: 'woocommerce_webhook',
        
        // WooCommerce Fields
        wooCommerceId: orderData.id.toString(),
        wooCommerceOrderKey: orderData.order_key,
        wooCommerceStatus: orderData.status,
        wooCommerceDateCreated: new Date(orderData.date_created),
        wooCommerceUrl: `${settings.storeUrl}/wp-admin/post.php?post=${orderData.id}&action=edit`,
        syncedFromWoo: true,
        lastSyncAt: new Date()
      }
    });

    // إنشاء عناصر الطلب
    if (orderData.line_items && orderData.line_items.length > 0) {
      for (const item of orderData.line_items) {
        let product = null;

        if (item.sku) {
          product = await prisma.product.findFirst({
            where: { sku: item.sku, companyId }
          });
        }

        if (!product && item.product_id) {
          product = await prisma.product.findFirst({
            where: { wooCommerceId: item.product_id.toString(), companyId }
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

    // تسجيل في سجل المزامنة
    await prisma.wooCommerceSyncLog.create({
      data: {
        companyId,
        syncType: 'webhook',
        syncDirection: 'from_woo',
        status: 'success',
        totalItems: 1,
        successCount: 1,
        triggeredBy: 'webhook',
        completedAt: new Date(),
        metadata: JSON.stringify({ orderId: order.id, wooCommerceId: orderData.id })
      }
    });

    console.log(`✅ [WEBHOOK] Order created successfully: ${order.orderNumber}`);

  } catch (error) {
    console.error('❌ [WEBHOOK] Error creating order:', error);
    
    // تسجيل الخطأ
    await prisma.wooCommerceSyncLog.create({
      data: {
        companyId,
        syncType: 'webhook',
        syncDirection: 'from_woo',
        status: 'failed',
        totalItems: 1,
        failedCount: 1,
        triggeredBy: 'webhook',
        errorMessage: error.message,
        completedAt: new Date()
      }
    });
    
    throw error;
  }
};

/**
 * معالجة تحديث طلب من WooCommerce
 */
const handleOrderUpdated = async (companyId, orderData, settings) => {
  try {
    console.log(`🔄 [WEBHOOK] Processing order update: ${orderData.id}`);

    const existingOrder = await prisma.order.findFirst({
      where: {
        wooCommerceId: orderData.id.toString(),
        companyId
      }
    });

    if (!existingOrder) {
      // لو الطلب مش موجود، ننشئه
      console.log(`⚠️ [WEBHOOK] Order not found, creating: ${orderData.id}`);
      await handleOrderCreated(companyId, orderData, settings);
      return;
    }

    // تحديث الطلب
    await prisma.order.update({
      where: { id: existingOrder.id },
      data: {
        status: mapWooStatusToLocal(orderData.status),
        wooCommerceStatus: orderData.status,
        paymentStatus: orderData.date_paid ? 'PAID' : existingOrder.paymentStatus,
        lastSyncAt: new Date()
      }
    });

    console.log(`✅ [WEBHOOK] Order updated: ${existingOrder.orderNumber}`);

  } catch (error) {
    console.error('❌ [WEBHOOK] Error updating order:', error);
    throw error;
  }
};

/**
 * معالجة حذف طلب من WooCommerce
 */
const handleOrderDeleted = async (companyId, orderData) => {
  try {
    console.log(`🗑️ [WEBHOOK] Processing order deletion: ${orderData.id}`);

    const existingOrder = await prisma.order.findFirst({
      where: {
        wooCommerceId: orderData.id.toString(),
        companyId
      }
    });

    if (existingOrder) {
      // نحدث الحالة بدل ما نحذف
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          status: 'CANCELLED',
          wooCommerceStatus: 'deleted',
          lastSyncAt: new Date()
        }
      });
      console.log(`✅ [WEBHOOK] Order marked as cancelled: ${existingOrder.orderNumber}`);
    }

  } catch (error) {
    console.error('❌ [WEBHOOK] Error handling order deletion:', error);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 Webhook Setup in WooCommerce
// ═══════════════════════════════════════════════════════════════

/**
 * إنشاء Webhooks في WooCommerce
 * POST /api/v1/woocommerce/webhooks/setup
 */
const setupWooCommerceWebhooks = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول'
      });
    }

    const settings = await prisma.wooCommerceSettings.findUnique({
      where: { companyId }
    });

    if (!settings) {
      return res.status(400).json({
        success: false,
        message: 'إعدادات WooCommerce غير موجودة'
      });
    }

    const axios = require('axios');
    const baseURL = settings.storeUrl.replace(/\/$/, '');
    const webhookUrl = `${process.env.BACKEND_URL || 'https://your-domain.com'}/api/v1/woocommerce/webhook/${companyId}`;

    const webhooksToCreate = [
      { name: 'Order Created', topic: 'order.created' },
      { name: 'Order Updated', topic: 'order.updated' }
    ];

    const createdWebhooks = [];

    for (const webhook of webhooksToCreate) {
      try {
        const response = await axios.post(
          `${baseURL}/wp-json/wc/v3/webhooks`,
          {
            name: webhook.name,
            topic: webhook.topic,
            delivery_url: webhookUrl,
            secret: settings.webhookSecret,
            status: 'active'
          },
          {
            auth: {
              username: settings.consumerKey,
              password: settings.consumerSecret
            }
          }
        );

        createdWebhooks.push({
          id: response.data.id,
          name: webhook.name,
          topic: webhook.topic
        });

      } catch (error) {
        console.error(`❌ [WEBHOOK] Error creating webhook ${webhook.name}:`, error.message);
      }
    }

    // تحديث الإعدادات
    await prisma.wooCommerceSettings.update({
      where: { companyId },
      data: {
        webhookEnabled: true,
        webhookOrderCreated: createdWebhooks.find(w => w.topic === 'order.created')?.id?.toString(),
        webhookOrderUpdated: createdWebhooks.find(w => w.topic === 'order.updated')?.id?.toString()
      }
    });

    res.json({
      success: true,
      message: `تم إنشاء ${createdWebhooks.length} webhook بنجاح`,
      data: {
        webhooks: createdWebhooks,
        webhookUrl
      }
    });

  } catch (error) {
    console.error('❌ [WEBHOOK] Error setting up webhooks:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إعداد Webhooks',
      error: error.message
    });
  }
};

/**
 * اختبار Webhook
 * POST /api/v1/woocommerce/webhooks/test
 */
const testWebhook = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    
    console.log(`🧪 [WEBHOOK] Test webhook received for company: ${companyId}`);
    
    res.json({
      success: true,
      message: 'Webhook يعمل بشكل صحيح!',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في اختبار Webhook',
      error: error.message
    });
  }
};

module.exports = {
  handleWooCommerceWebhook,
  setupWooCommerceWebhooks,
  testWebhook
};

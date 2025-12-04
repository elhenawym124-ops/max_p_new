const { getSharedPrismaClient, executeWithRetry } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();
const axios = require('axios');
const crypto = require('crypto');

/**
 * 🔧 Helper: إنشاء WooCommerce API Client
 */
const createWooClient = (settings) => {
  const baseURL = settings.storeUrl.replace(/\/$/, '');
  return {
    get: async (endpoint, params = {}) => {
      const response = await axios.get(`${baseURL}/wp-json/wc/v3${endpoint}`, {
        auth: {
          username: settings.consumerKey,
          password: settings.consumerSecret
        },
        params,
        timeout: 30000
      });
      return response.data;
    },
    post: async (endpoint, data = {}) => {
      const response = await axios.post(`${baseURL}/wp-json/wc/v3${endpoint}`, data, {
        auth: {
          username: settings.consumerKey,
          password: settings.consumerSecret
        },
        timeout: 30000
      });
      return response.data;
    },
    put: async (endpoint, data = {}) => {
      const response = await axios.put(`${baseURL}/wp-json/wc/v3${endpoint}`, data, {
        auth: {
          username: settings.consumerKey,
          password: settings.consumerSecret
        },
        timeout: 30000
      });
      return response.data;
    }
  };
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
    'failed': 'CANCELLED',
    'trash': 'CANCELLED'
  };
  return statusMap[wooStatus] || 'PENDING';
};

/**
 * 🔧 Helper: تحويل حالة النظام لحالة WooCommerce
 */
const mapLocalStatusToWoo = (localStatus) => {
  const statusMap = {
    'PENDING': 'pending',
    'CONFIRMED': 'processing',
    'PROCESSING': 'processing',
    'SHIPPED': 'processing',
    'DELIVERED': 'completed',
    'CANCELLED': 'cancelled'
  };
  return statusMap[localStatus] || 'pending';
};

/**
 * 🔧 Helper: تحويل طريقة الدفع
 */
const mapPaymentMethod = (wooPaymentMethod) => {
  const methodMap = {
    'cod': 'CASH',
    'bacs': 'BANK_TRANSFER',
    'cheque': 'BANK_TRANSFER',
    'paypal': 'CREDIT_CARD',
    'stripe': 'CREDIT_CARD'
  };
  return methodMap[wooPaymentMethod] || 'CASH';
};

// ═══════════════════════════════════════════════════════════════
// 📥 استيراد الطلبات من WooCommerce
// ═══════════════════════════════════════════════════════════════

/**
 * جلب الطلبات من WooCommerce (معاينة)
 * POST /api/v1/woocommerce/orders/fetch
 */
const fetchOrdersFromWooCommerce = async (req, res) => {
  try {
    console.log('🔍 [WOOCOMMERCE] Fetching orders from WooCommerce...');
    
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    // جلب إعدادات WooCommerce
    let settings = await prisma.wooCommerceSettings.findUnique({
      where: { companyId }
    });

    // لو مفيش إعدادات محفوظة، استخدم البيانات من الـ request
    const { storeUrl, consumerKey, consumerSecret, dateFrom, dateTo, status } = req.body;
    
    if (!settings && (!storeUrl || !consumerKey || !consumerSecret)) {
      return res.status(400).json({
        success: false,
        message: 'إعدادات WooCommerce غير موجودة. يرجى إدخال بيانات الاتصال.'
      });
    }

    const connectionSettings = settings || { storeUrl, consumerKey, consumerSecret };
    const wooClient = createWooClient(connectionSettings);

    // بناء الـ params
    const params = {
      per_page: 100,
      orderby: 'date',
      order: 'desc'
    };

    if (dateFrom) params.after = new Date(dateFrom).toISOString();
    if (dateTo) params.before = new Date(dateTo).toISOString();
    if (status && status !== 'any') params.status = status;

    console.log(`📡 [WOOCOMMERCE] Fetching orders with params:`, params);

    const orders = await wooClient.get('/orders', params);

    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: 'تنسيق البيانات غير صحيح من WooCommerce'
      });
    }

    console.log(`✅ [WOOCOMMERCE] Found ${orders.length} orders`);

    // تحويل الطلبات لصيغة موحدة
    const formattedOrders = orders.map(order => ({
      wooCommerceId: order.id.toString(),
      orderNumber: order.number || order.id.toString(),
      status: mapWooStatusToLocal(order.status),
      wooCommerceStatus: order.status,
      paymentMethod: mapPaymentMethod(order.payment_method),
      paymentStatus: order.date_paid ? 'PAID' : 'PENDING',
      
      // Customer Info
      customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
      customerEmail: order.billing?.email || null,
      customerPhone: order.billing?.phone || null,
      customerAddress: order.billing?.address_1 || null,
      city: order.billing?.city || null,
      
      // Shipping Address
      shippingAddress: order.shipping ? JSON.stringify({
        firstName: order.shipping.first_name,
        lastName: order.shipping.last_name,
        address1: order.shipping.address_1,
        address2: order.shipping.address_2,
        city: order.shipping.city,
        state: order.shipping.state,
        postcode: order.shipping.postcode,
        country: order.shipping.country
      }) : null,
      
      // Totals
      subtotal: parseFloat(order.total) - parseFloat(order.shipping_total || 0) - parseFloat(order.total_tax || 0),
      shipping: parseFloat(order.shipping_total || 0),
      tax: parseFloat(order.total_tax || 0),
      discount: parseFloat(order.discount_total || 0),
      total: parseFloat(order.total),
      currency: order.currency || 'EGP',
      
      // Items
      items: order.line_items?.map(item => ({
        productName: item.name,
        productSku: item.sku,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total: parseFloat(item.total),
        wooCommerceProductId: item.product_id?.toString()
      })) || [],
      
      // Dates
      wooCommerceDateCreated: order.date_created,
      createdAt: order.date_created,
      
      // Notes
      notes: order.customer_note || null,
      
      // URL
      wooCommerceUrl: `${connectionSettings.storeUrl}/wp-admin/post.php?post=${order.id}&action=edit`
    }));

    res.json({
      success: true,
      message: `تم جلب ${formattedOrders.length} طلب من WooCommerce`,
      data: {
        orders: formattedOrders,
        count: formattedOrders.length,
        storeUrl: connectionSettings.storeUrl
      }
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error fetching orders:', error);
    
    let errorMessage = 'فشل جلب الطلبات';
    if (error.response?.status === 401) {
      errorMessage = 'مفاتيح API غير صحيحة';
    } else if (error.response?.status === 404) {
      errorMessage = 'رابط المتجر غير صحيح أو WooCommerce غير مفعل';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
};

/**
 * استيراد الطلبات المحددة من WooCommerce
 * POST /api/v1/woocommerce/orders/import
 */
const importOrdersFromWooCommerce = async (req, res) => {
  try {
    console.log('📦 [WOOCOMMERCE] Importing orders from WooCommerce...');
    
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول'
      });
    }

    const { orders } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'قائمة الطلبات مطلوبة'
      });
    }

    // إنشاء سجل المزامنة
    const syncLog = await prisma.wooCommerceSyncLog.create({
      data: {
        companyId,
        syncType: 'import_orders',
        syncDirection: 'from_woo',
        status: 'in_progress',
        totalItems: orders.length,
        triggeredBy: 'user'
      }
    });

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const orderData of orders) {
      try {
        // التحقق من وجود الطلب مسبقاً
        if (orderData.wooCommerceId) {
          const existingOrder = await prisma.order.findFirst({
            where: {
              wooCommerceId: orderData.wooCommerceId,
              companyId
            }
          });

          if (existingOrder) {
            results.skipped.push({
              order: orderData,
              reason: 'الطلب موجود بالفعل',
              existingOrderId: existingOrder.id
            });
            continue;
          }
        }

        // البحث عن العميل أو إنشاء واحد جديد
        let customer = null;
        
        if (orderData.customerEmail) {
          customer = await prisma.customer.findFirst({
            where: {
              email: orderData.customerEmail,
              companyId
            }
          });
        }
        
        if (!customer && orderData.customerPhone) {
          customer = await prisma.customer.findFirst({
            where: {
              phone: orderData.customerPhone,
              companyId
            }
          });
        }

        if (!customer) {
          // إنشاء عميل جديد
          const nameParts = (orderData.customerName || 'عميل WooCommerce').split(' ');
          customer = await prisma.customer.create({
            data: {
              firstName: nameParts[0] || 'عميل',
              lastName: nameParts.slice(1).join(' ') || 'WooCommerce',
              email: orderData.customerEmail || null,
              phone: orderData.customerPhone || null,
              companyId,
              status: 'CUSTOMER'
            }
          });
          console.log(`✅ [WOOCOMMERCE] Created customer: ${customer.firstName} ${customer.lastName}`);
        }

        // إنشاء رقم طلب فريد
        const orderNumber = `WOO-${orderData.wooCommerceId || Date.now()}`;

        // إنشاء الطلب
        const order = await prisma.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            companyId,
            status: orderData.status || 'PENDING',
            paymentStatus: orderData.paymentStatus || 'PENDING',
            paymentMethod: orderData.paymentMethod || 'CASH',
            subtotal: orderData.subtotal || 0,
            tax: orderData.tax || 0,
            shipping: orderData.shipping || 0,
            discount: orderData.discount || 0,
            total: orderData.total || 0,
            currency: orderData.currency || 'EGP',
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            customerEmail: orderData.customerEmail,
            customerAddress: orderData.customerAddress,
            city: orderData.city,
            shippingAddress: orderData.shippingAddress,
            notes: orderData.notes,
            sourceType: 'woocommerce',
            
            // WooCommerce Fields
            wooCommerceId: orderData.wooCommerceId,
            wooCommerceStatus: orderData.wooCommerceStatus,
            wooCommerceDateCreated: orderData.wooCommerceDateCreated ? new Date(orderData.wooCommerceDateCreated) : null,
            wooCommerceUrl: orderData.wooCommerceUrl,
            syncedFromWoo: true,
            lastSyncAt: new Date()
          }
        });

        // إنشاء عناصر الطلب
        if (orderData.items && orderData.items.length > 0) {
          for (const item of orderData.items) {
            // البحث عن المنتج بالـ SKU أو WooCommerce ID
            let product = null;
            
            if (item.productSku) {
              product = await prisma.product.findFirst({
                where: { sku: item.productSku, companyId }
              });
            }
            
            if (!product && item.wooCommerceProductId) {
              product = await prisma.product.findFirst({
                where: { wooCommerceId: item.wooCommerceProductId, companyId }
              });
            }

            await prisma.orderItem.create({
              data: {
                orderId: order.id,
                productId: product?.id || null,
                productName: item.productName,
                productSku: item.productSku,
                quantity: item.quantity,
                price: item.price,
                total: item.total
              }
            });
          }
        }

        results.success.push(order);

      } catch (error) {
        console.error(`❌ [WOOCOMMERCE] Error importing order:`, error);
        results.failed.push({
          order: orderData,
          reason: error.message
        });
      }
    }

    // تحديث سجل المزامنة
    await prisma.wooCommerceSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        successCount: results.success.length,
        failedCount: results.failed.length,
        skippedCount: results.skipped.length,
        completedAt: new Date(),
        duration: Math.floor((Date.now() - syncLog.startedAt.getTime()) / 1000)
      }
    });

    console.log(`✅ [WOOCOMMERCE] Import completed:`);
    console.log(`   - Success: ${results.success.length}`);
    console.log(`   - Failed: ${results.failed.length}`);
    console.log(`   - Skipped: ${results.skipped.length}`);

    res.status(200).json({
      success: true,
      message: 'تم استيراد الطلبات',
      data: {
        imported: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results
      }
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error importing orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استيراد الطلبات',
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 📤 تصدير الطلبات إلى WooCommerce
// ═══════════════════════════════════════════════════════════════

/**
 * جلب الطلبات المحلية للتصدير
 * GET /api/v1/woocommerce/orders/local
 */
const getLocalOrdersForExport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول'
      });
    }

    const { syncedToWoo, dateFrom, dateTo } = req.query;

    const where = { companyId };
    
    // فلترة حسب حالة التصدير
    if (syncedToWoo === 'false') {
      where.syncedToWoo = false;
    } else if (syncedToWoo === 'true') {
      where.syncedToWoo = true;
    }

    // فلترة حسب التاريخ
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error getting local orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلبات',
      error: error.message
    });
  }
};

/**
 * تصدير الطلبات إلى WooCommerce
 * POST /api/v1/woocommerce/orders/export
 */
const exportOrdersToWooCommerce = async (req, res) => {
  try {
    console.log('📤 [WOOCOMMERCE] Exporting orders to WooCommerce...');
    
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول'
      });
    }

    // جلب إعدادات WooCommerce
    const settings = await prisma.wooCommerceSettings.findUnique({
      where: { companyId }
    });

    if (!settings) {
      return res.status(400).json({
        success: false,
        message: 'إعدادات WooCommerce غير موجودة'
      });
    }

    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'قائمة الطلبات مطلوبة'
      });
    }

    const wooClient = createWooClient(settings);

    // إنشاء سجل المزامنة
    const syncLog = await prisma.wooCommerceSyncLog.create({
      data: {
        companyId,
        syncType: 'export_orders',
        syncDirection: 'to_woo',
        status: 'in_progress',
        totalItems: orderIds.length,
        triggeredBy: 'user'
      }
    });

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    // جلب الطلبات
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        companyId
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: true
      }
    });

    for (const order of orders) {
      try {
        // لو الطلب موجود في WooCommerce، نحدثه
        if (order.wooCommerceId) {
          const wooOrder = await wooClient.put(`/orders/${order.wooCommerceId}`, {
            status: mapLocalStatusToWoo(order.status),
            customer_note: order.notes
          });

          await prisma.order.update({
            where: { id: order.id },
            data: {
              syncedToWoo: true,
              lastSyncAt: new Date(),
              wooCommerceStatus: wooOrder.status
            }
          });

          results.success.push({
            orderId: order.id,
            wooCommerceId: order.wooCommerceId,
            action: 'updated'
          });
          continue;
        }

        // إنشاء طلب جديد في WooCommerce
        const wooOrderData = {
          status: mapLocalStatusToWoo(order.status),
          billing: {
            first_name: order.customer?.firstName || order.customerName?.split(' ')[0] || '',
            last_name: order.customer?.lastName || order.customerName?.split(' ').slice(1).join(' ') || '',
            email: order.customerEmail || order.customer?.email || '',
            phone: order.customerPhone || order.customer?.phone || '',
            address_1: order.customerAddress || '',
            city: order.city || ''
          },
          shipping: order.shippingAddress ? JSON.parse(order.shippingAddress) : {},
          line_items: order.items.map(item => ({
            name: item.productName || item.product?.name || 'منتج',
            quantity: item.quantity,
            price: parseFloat(item.price),
            sku: item.productSku || item.product?.sku || null
          })),
          customer_note: order.notes || ''
        };

        const wooOrder = await wooClient.post('/orders', wooOrderData);

        // تحديث الطلب المحلي
        await prisma.order.update({
          where: { id: order.id },
          data: {
            wooCommerceId: wooOrder.id.toString(),
            wooCommerceOrderKey: wooOrder.order_key,
            wooCommerceStatus: wooOrder.status,
            wooCommerceUrl: `${settings.storeUrl}/wp-admin/post.php?post=${wooOrder.id}&action=edit`,
            syncedToWoo: true,
            lastSyncAt: new Date()
          }
        });

        results.success.push({
          orderId: order.id,
          wooCommerceId: wooOrder.id,
          action: 'created'
        });

      } catch (error) {
        console.error(`❌ [WOOCOMMERCE] Error exporting order ${order.id}:`, error);
        results.failed.push({
          orderId: order.id,
          reason: error.message
        });
      }
    }

    // تحديث سجل المزامنة
    await prisma.wooCommerceSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: results.failed.length === 0 ? 'success' : 'partial',
        successCount: results.success.length,
        failedCount: results.failed.length,
        completedAt: new Date(),
        duration: Math.floor((Date.now() - syncLog.startedAt.getTime()) / 1000)
      }
    });

    console.log(`✅ [WOOCOMMERCE] Export completed:`);
    console.log(`   - Success: ${results.success.length}`);
    console.log(`   - Failed: ${results.failed.length}`);

    res.status(200).json({
      success: true,
      message: 'تم تصدير الطلبات',
      data: {
        exported: results.success.length,
        failed: results.failed.length,
        details: results
      }
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error exporting orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تصدير الطلبات',
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// ⚙️ إعدادات WooCommerce
// ═══════════════════════════════════════════════════════════════

/**
 * حفظ إعدادات WooCommerce
 * POST /api/v1/woocommerce/settings
 */
const saveWooCommerceSettings = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول'
      });
    }

    const { 
      storeUrl, 
      consumerKey, 
      consumerSecret,
      syncEnabled,
      syncDirection,
      syncInterval,
      autoImport,
      autoExport,
      webhookEnabled
    } = req.body;
    
    // تحديد إذا كانت المزامنة التلقائية مفعّلة
    const isSyncEnabled = syncEnabled || autoImport || autoExport;

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        success: false,
        message: 'جميع بيانات الاتصال مطلوبة'
      });
    }

    // اختبار الاتصال
    try {
      const testClient = createWooClient({ storeUrl, consumerKey, consumerSecret });
      await testClient.get('/orders', { per_page: 1 });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'فشل الاتصال بـ WooCommerce. تأكد من صحة البيانات.',
        error: error.message
      });
    }

    // إنشاء webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // تحديد اتجاه المزامنة بناءً على الخيارات
    let effectiveSyncDirection = syncDirection || 'both';
    if (autoImport && !autoExport) {
      effectiveSyncDirection = 'import_only';
    } else if (!autoImport && autoExport) {
      effectiveSyncDirection = 'export_only';
    } else if (autoImport && autoExport) {
      effectiveSyncDirection = 'both';
    }

    // حفظ أو تحديث الإعدادات
    const settings = await prisma.wooCommerceSettings.upsert({
      where: { companyId },
      update: {
        storeUrl: storeUrl.replace(/\/$/, ''),
        consumerKey,
        consumerSecret,
        syncEnabled: isSyncEnabled,
        syncDirection: effectiveSyncDirection,
        syncInterval: syncInterval || 15,
        webhookEnabled: webhookEnabled || false,
        webhookSecret,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        companyId,
        storeUrl: storeUrl.replace(/\/$/, ''),
        consumerKey,
        consumerSecret,
        syncEnabled: isSyncEnabled,
        syncDirection: effectiveSyncDirection,
        syncInterval: syncInterval || 15,
        webhookEnabled: webhookEnabled || false,
        webhookSecret
      }
    });

    res.json({
      success: true,
      message: 'تم حفظ الإعدادات بنجاح',
      data: {
        id: settings.id,
        storeUrl: settings.storeUrl,
        syncEnabled: settings.syncEnabled,
        syncDirection: settings.syncDirection,
        webhookEnabled: settings.webhookEnabled,
        webhookUrl: `${process.env.BACKEND_URL || 'https://your-domain.com'}/api/v1/woocommerce/webhook/${companyId}`
      }
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error saving settings:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حفظ الإعدادات',
      error: error.message
    });
  }
};

/**
 * جلب إعدادات WooCommerce
 * GET /api/v1/woocommerce/settings
 */
const getWooCommerceSettings = async (req, res) => {
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
      return res.json({
        success: true,
        data: null,
        message: 'لا توجد إعدادات محفوظة'
      });
    }

    res.json({
      success: true,
      data: {
        id: settings.id,
        storeUrl: settings.storeUrl,
        hasCredentials: !!(settings.consumerKey && settings.consumerSecret),
        syncEnabled: settings.syncEnabled,
        syncDirection: settings.syncDirection,
        syncInterval: settings.syncInterval,
        webhookEnabled: settings.webhookEnabled,
        lastSyncAt: settings.lastSyncAt,
        lastSyncStatus: settings.lastSyncStatus,
        webhookUrl: `${process.env.BACKEND_URL || 'https://your-domain.com'}/api/v1/woocommerce/webhook/${companyId}`
      }
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error getting settings:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإعدادات',
      error: error.message
    });
  }
};

/**
 * جلب سجل المزامنة
 * GET /api/v1/woocommerce/sync-logs
 */
const getSyncLogs = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول'
      });
    }

    const logs = await prisma.wooCommerceSyncLog.findMany({
      where: { companyId },
      orderBy: { startedAt: 'desc' },
      take: 50
    });

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Error getting sync logs:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب سجل المزامنة',
      error: error.message
    });
  }
};

/**
 * 🔄 Auto Sync: مزامنة تلقائية للطلبات
 */
const runAutoSync = async (companyId) => {
  try {
    console.log(`🔄 [WOOCOMMERCE] Running auto sync for company: ${companyId}`);
    
    const settings = await prisma.wooCommerceSettings.findUnique({
      where: { companyId }
    });

    if (!settings || !settings.syncEnabled) {
      console.log(`⏭️ [WOOCOMMERCE] Auto sync disabled for company: ${companyId}`);
      return { success: false, message: 'Auto sync disabled' };
    }

    const results = {
      imported: 0,
      exported: 0,
      errors: []
    };

    const wooClient = createWooClient(settings);

    // Auto Import
    if (settings.syncDirection === 'both' || settings.syncDirection === 'import_only') {
      try {
        // Get last sync time
        const lastSync = settings.lastSyncAt || new Date(0);
        
        // Fetch new orders from WooCommerce
        const wooOrders = await wooClient.get('/orders', {
          after: lastSync.toISOString(),
          per_page: 100,
          orderby: 'date',
          order: 'desc'
        });

        for (const wooOrder of wooOrders) {
          // Check if already imported
          const existing = await prisma.order.findFirst({
            where: { 
              companyId,
              wooCommerceId: String(wooOrder.id)
            }
          });

          if (!existing) {
            // Import the order
            const customerName = `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim() || 'عميل WooCommerce';
            const customerPhone = wooOrder.billing?.phone || '';
            const customerEmail = wooOrder.billing?.email || '';

            // Find or create customer
            let customer = await prisma.customer.findFirst({
              where: {
                companyId,
                OR: [
                  { phone: customerPhone },
                  { email: customerEmail }
                ].filter(c => Object.values(c)[0])
              }
            });

            if (!customer) {
              customer = await prisma.customer.create({
                data: {
                  companyId,
                  name: customerName,
                  phone: customerPhone || null,
                  email: customerEmail || null,
                  source: 'woocommerce'
                }
              });
            }

            // Create order
            await prisma.order.create({
              data: {
                companyId,
                customerId: customer.id,
                orderNumber: `WOO-${wooOrder.id}`,
                status: mapWooStatusToLocal(wooOrder.status),
                paymentStatus: wooOrder.status === 'completed' ? 'PAID' : 'PENDING',
                paymentMethod: mapPaymentMethod(wooOrder.payment_method),
                subtotal: parseFloat(wooOrder.total) - parseFloat(wooOrder.shipping_total || 0),
                shipping: parseFloat(wooOrder.shipping_total || 0),
                discount: parseFloat(wooOrder.discount_total || 0),
                total: parseFloat(wooOrder.total),
                currency: wooOrder.currency || 'EGP',
                customerName,
                customerPhone,
                customerEmail,
                shippingAddress: JSON.stringify(wooOrder.shipping),
                billingAddress: JSON.stringify(wooOrder.billing),
                wooCommerceId: String(wooOrder.id),
                wooCommerceOrderKey: wooOrder.order_key,
                wooCommerceStatus: wooOrder.status,
                wooCommerceDateCreated: new Date(wooOrder.date_created),
                syncedFromWoo: true,
                lastSyncAt: new Date(),
                sourceType: 'woocommerce_auto_sync'
              }
            });

            results.imported++;
          }
        }
      } catch (error) {
        console.error('❌ [WOOCOMMERCE] Auto import error:', error.message);
        results.errors.push(`Import error: ${error.message}`);
      }
    }

    // Auto Export
    if (settings.syncDirection === 'both' || settings.syncDirection === 'export_only') {
      try {
        // Get orders not yet exported
        const ordersToExport = await prisma.order.findMany({
          where: {
            companyId,
            syncedToWoo: false,
            syncedFromWoo: false // Don't re-export imported orders
          },
          include: {
            items: {
              include: {
                product: true
              }
            }
          },
          take: 50
        });

        for (const order of ordersToExport) {
          try {
            const wooOrderData = {
              status: mapLocalStatusToWoo(order.status),
              billing: {
                first_name: order.customerName?.split(' ')[0] || '',
                last_name: order.customerName?.split(' ').slice(1).join(' ') || '',
                phone: order.customerPhone || '',
                email: order.customerEmail || ''
              },
              line_items: order.items.map(item => ({
                name: item.product?.name || item.productName || 'منتج',
                quantity: item.quantity,
                total: String(item.total)
              }))
            };

            const createdOrder = await wooClient.post('/orders', wooOrderData);

            await prisma.order.update({
              where: { id: order.id },
              data: {
                wooCommerceId: String(createdOrder.id),
                wooCommerceOrderKey: createdOrder.order_key,
                wooCommerceStatus: createdOrder.status,
                syncedToWoo: true,
                lastSyncAt: new Date()
              }
            });

            results.exported++;
          } catch (orderError) {
            console.error(`❌ [WOOCOMMERCE] Failed to export order ${order.orderNumber}:`, orderError.message);
            results.errors.push(`Export order ${order.orderNumber}: ${orderError.message}`);
          }
        }
      } catch (error) {
        console.error('❌ [WOOCOMMERCE] Auto export error:', error.message);
        results.errors.push(`Export error: ${error.message}`);
      }
    }

    // Update last sync time
    await prisma.wooCommerceSettings.update({
      where: { companyId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: results.errors.length > 0 ? 'partial' : 'success',
        lastSyncMessage: `Imported: ${results.imported}, Exported: ${results.exported}`
      }
    });

    // Log the sync
    await prisma.wooCommerceSyncLog.create({
      data: {
        companyId,
        syncType: 'auto_sync',
        syncDirection: settings.syncDirection,
        status: results.errors.length > 0 ? 'partial' : 'success',
        totalItems: results.imported + results.exported,
        successCount: results.imported + results.exported,
        failedCount: results.errors.length,
        triggeredBy: 'cron',
        completedAt: new Date()
      }
    });

    console.log(`✅ [WOOCOMMERCE] Auto sync completed: Imported ${results.imported}, Exported ${results.exported}`);
    return { success: true, results };

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Auto sync failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 🔄 Run Auto Sync for All Companies
 */
const runAutoSyncForAllCompanies = async () => {
  try {
    console.log('🔄 [WOOCOMMERCE] Starting auto sync for all companies...');
    
    const companiesWithAutoSync = await prisma.wooCommerceSettings.findMany({
      where: {
        syncEnabled: true,
        isActive: true
      },
      select: {
        companyId: true,
        syncInterval: true
      }
    });

    console.log(`📊 [WOOCOMMERCE] Found ${companiesWithAutoSync.length} companies with auto sync enabled`);

    for (const company of companiesWithAutoSync) {
      await runAutoSync(company.companyId);
    }

    console.log('✅ [WOOCOMMERCE] Auto sync completed for all companies');
  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Auto sync for all companies failed:', error);
  }
};

/**
 * 🔄 Trigger Auto Sync (API endpoint)
 */
const triggerAutoSync = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح'
      });
    }

    const result = await runAutoSync(companyId);

    res.json({
      success: result.success,
      message: result.success ? 'تمت المزامنة بنجاح' : 'فشلت المزامنة',
      data: result
    });

  } catch (error) {
    console.error('❌ [WOOCOMMERCE] Trigger auto sync error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في المزامنة',
      error: error.message
    });
  }
};

module.exports = {
  // Orders Import
  fetchOrdersFromWooCommerce,
  importOrdersFromWooCommerce,
  
  // Orders Export
  getLocalOrdersForExport,
  exportOrdersToWooCommerce,
  
  // Settings
  saveWooCommerceSettings,
  getWooCommerceSettings,
  getSyncLogs,
  
  // Auto Sync
  runAutoSync,
  runAutoSyncForAllCompanies,
  triggerAutoSync
};

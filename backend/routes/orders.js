const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const simpleOrderService = require('../services/simpleOrderService');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

const prisma = getSharedPrismaClient();

// الحصول على الطلبات البسيطة
router.get('/simple', async (req, res) => {
  try {
    // الحصول على companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح - معرف الشركة مطلوب'
      });
    }
    
    console.log('📦 [ORDERS] Fetching orders for company:', companyId);
    
    // جلب الطلبات العادية من الـ database
    const regularOrders = await prisma.order.findMany({
      where: { companyId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        },
        conversation: {
          select: {
            id: true,
            channel: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📦 [ORDERS] Regular orders found:', regularOrders.length);
    
    // جلب طلبات الضيوف (Guest Orders) من المتجر العام
    const guestOrders = await prisma.guestOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('🛒 [ORDERS] Guest orders found:', guestOrders.length);

    // تحويل البيانات للصيغة المتوافقة مع الـ frontend
    const formattedRegularOrders = regularOrders.map(order => {
      // Parse shippingAddress if it's a JSON string
      let shippingAddress = order.shippingAddress || '';
      try {
        if (typeof shippingAddress === 'string' && shippingAddress.startsWith('{')) {
          shippingAddress = JSON.parse(shippingAddress);
        }
      } catch (e) {
        // Keep as string if parsing fails
      }

      return {
      id: order.orderNumber,
      orderNumber: order.orderNumber,
      customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : '',
      customerPhone: order.customerPhone || order.customer?.phone || '',
      customerEmail: order.customer?.email || '',
      total: order.total,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      status: order.status.toLowerCase(),
      paymentStatus: order.paymentStatus.toLowerCase(),
      paymentMethod: order.paymentMethod.toLowerCase().replace('_', '_on_'),
      shippingAddress: shippingAddress,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.product?.name || JSON.parse(item.metadata || '{}').productName || '',
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        metadata: JSON.parse(item.metadata || '{}')
      })),
      trackingNumber: order.trackingNumber,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      metadata: order.metadata ? JSON.parse(order.metadata) : {}
    };
    });
    
    // تحويل طلبات الضيوف للصيغة المتوافقة
    const formattedGuestOrders = guestOrders.map(order => {
      // Parse items if JSON string
      let items = order.items || [];
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      
      // Parse shippingAddress if JSON string
      let shippingAddress = order.shippingAddress || {};
      if (typeof shippingAddress === 'string') {
        try {
          shippingAddress = JSON.parse(shippingAddress);
        } catch (e) {
          shippingAddress = {};
        }
      }
      
      return {
        id: order.orderNumber,
        orderNumber: order.orderNumber,
        customerName: order.guestName || '',
        customerPhone: order.guestPhone || '',
        customerEmail: order.guestEmail || '',
        total: order.total || 0,
        subtotal: order.total || 0,
        tax: 0,
        shipping: order.shippingCost || 0,
        status: order.status?.toLowerCase() || 'pending',
        paymentStatus: 'pending',
        paymentMethod: order.paymentMethod?.toLowerCase() || 'cash_on_delivery',
        shippingAddress: shippingAddress,
        items: Array.isArray(items) ? items.map(item => ({
          id: item.productId || '',
          productId: item.productId || '',
          name: item.name || '',
          price: item.price || 0,
          quantity: item.quantity || 1,
          total: (item.price || 0) * (item.quantity || 1),
          metadata: {}
        })) : [],
        trackingNumber: null,
        notes: order.notes || '',
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        metadata: { source: 'storefront', isGuestOrder: true }
      };
    });
    
    // دمج القائمتين وترتيبهما حسب التاريخ
    const allOrders = [...formattedRegularOrders, ...formattedGuestOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log('📊 [ORDERS] Total orders:', allOrders.length);

    res.json({
      success: true,
      data: allOrders,
      total: allOrders.length
    });

  } catch (error) {
    console.error('❌ Error fetching simple orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلبات',
      error: error.message
    });
  }
});

// إحصائيات الطلبات البسيطة
router.get('/simple/stats', async (req, res) => {
  try {
    const stats = await simpleOrderService.getSimpleStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching simple stats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإحصائيات',
      error: error.message
    });
  }
});

// تحديث حالة الطلب البسيط
router.post('/simple/:orderNumber/status', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status, notes } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح - معرف الشركة مطلوب'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب مطلوبة'
      });
    }

    // Try to update regular order first
    const regularOrder = await prisma.order.updateMany({
      where: { 
        orderNumber,
        companyId 
      },
      data: {
        status: status.toUpperCase(),
        notes: notes || undefined,
        updatedAt: new Date()
      }
    });

    // If regular order not found, try guest order
    let guestOrder = { count: 0 };
    if (regularOrder.count === 0) {
      console.log('🔍 [ORDER-STATUS-UPDATE] Regular order not found, trying guest order');
      guestOrder = await prisma.guestOrder.updateMany({
        where: { 
          orderNumber,
          companyId 
        },
        data: {
          status: status.toUpperCase(),
          notes: notes || undefined,
          updatedAt: new Date()
        }
      });
    }

    // If neither order type found
    if (regularOrder.count === 0 && guestOrder.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    const orderType = regularOrder.count > 0 ? 'regular' : 'guest';
    console.log(`✅ [ORDER-STATUS-UPDATE] Updated ${orderType} order: ${orderNumber}`);

    res.json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      data: { orderType, orderNumber, status: status.toUpperCase() }
    });

  } catch (error) {
    console.error('❌ Error updating simple order status:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة الطلب',
      error: error.message
    });
  }
});

// تحديث حالة الدفع للطلب البسيط
router.post('/simple/:orderNumber/payment-status', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { paymentStatus, notes } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح - معرف الشركة مطلوب'
      });
    }

    if (!paymentStatus) {
      return res.status(400).json({
        success: false,
        message: 'حالة الدفع مطلوبة'
      });
    }

    // Try to update regular order first
    const regularOrder = await prisma.order.updateMany({
      where: { 
        orderNumber,
        companyId 
      },
      data: {
        paymentStatus: paymentStatus.toUpperCase(),
        notes: notes || undefined,
        updatedAt: new Date()
      }
    });

    // If regular order not found, try guest order
    let guestOrder = { count: 0 };
    if (regularOrder.count === 0) {
      console.log('🔍 [PAYMENT-STATUS-UPDATE] Regular order not found, trying guest order');
      guestOrder = await prisma.guestOrder.updateMany({
        where: { 
          orderNumber,
          companyId 
        },
        data: {
          paymentStatus: paymentStatus.toUpperCase(),
          notes: notes || undefined,
          updatedAt: new Date()
        }
      });
    }

    // If neither order type found
    if (regularOrder.count === 0 && guestOrder.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    const orderType = regularOrder.count > 0 ? 'regular' : 'guest';
    console.log(`✅ [PAYMENT-STATUS-UPDATE] Updated ${orderType} order: ${orderNumber}`);

    res.json({
      success: true,
      message: 'تم تحديث حالة الدفع بنجاح',
      data: { orderType, orderNumber, paymentStatus: paymentStatus.toUpperCase() }
    });

  } catch (error) {
    console.error('❌ Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة الدفع',
      error: error.message
    });
  }
});

// الحصول على جميع الطلبات
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, customerId } = req.query;
    const skip = (page - 1) * limit;

    // التأكد من وجود companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const where = { companyId }; // فلترة بـ companyId
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        },
        conversation: {
          select: {
            id: true,
            channel: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    // Ensure where clause includes companyId for security
    if (!where.companyId && req.user?.companyId) {
      where.companyId = req.user.companyId;
    }
            // Security: Ensure company isolation for order count
    if (!where.companyId) {
      if (!req.user?.companyId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      where.companyId = req.user.companyId;
    }
    const total = await prisma.order.count({ where });

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلبات',
      error: error.message
    });
  }
});

// الحصول على طلب بسيط محدد بالرقم
router.get('/simple/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح - معرف الشركة مطلوب'
      });
    }
    
    const order = await prisma.order.findFirst({
      where: { 
        orderNumber,
        companyId 
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        },
        conversation: {
          select: {
            id: true,
            channel: true
          }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    // Parse shippingAddress if it's a JSON string
    let shippingAddress = order.shippingAddress || '';
    try {
      if (typeof shippingAddress === 'string' && shippingAddress.startsWith('{')) {
        shippingAddress = JSON.parse(shippingAddress);
      }
    } catch (e) {
      // Keep as string if parsing fails
    }

    // تحويل البيانات للصيغة المتوافقة مع الـ frontend
    const formattedOrder = {
      id: order.orderNumber,
      orderNumber: order.orderNumber,
      customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : '',
      customerPhone: order.customerPhone || order.customer?.phone || '',
      customerEmail: order.customer?.email || '',
      total: order.total,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      status: order.status.toLowerCase(),
      paymentStatus: order.paymentStatus.toLowerCase(),
      paymentMethod: order.paymentMethod.toLowerCase().replace('_', '_on_'),
      shippingAddress: shippingAddress,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.product?.name || JSON.parse(item.metadata || '{}').productName || '',
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        metadata: JSON.parse(item.metadata || '{}')
      })),
      trackingNumber: order.trackingNumber,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      metadata: order.metadata ? JSON.parse(order.metadata) : {}
    };

    res.json({
      success: true,
      data: formattedOrder
    });

  } catch (error) {
    console.error('❌ Error fetching simple order:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلب',
      error: error.message
    });
  }
});

// الحصول على طلب محدد
router.get('/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    const order = await orderService.getOrderByNumber(orderNumber);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلب',
      error: error.message
    });
  }
});

// تحديث حالة الطلب
router.patch('/:orderNumber/status', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب مطلوبة'
      });
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب غير صحيحة'
      });
    }

    const order = await orderService.updateOrderStatus(orderNumber, status, notes);

    res.json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      data: order
    });

  } catch (error) {
    console.error('❌ Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة الطلب',
      error: error.message
    });
  }
});

// تأكيد الطلب
router.post('/:orderNumber/confirm', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { shippingAddress } = req.body;

    const order = await orderService.confirmOrder(orderNumber, shippingAddress);

    res.json({
      success: true,
      message: 'تم تأكيد الطلب بنجاح',
      data: order
    });

  } catch (error) {
    console.error('❌ Error confirming order:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تأكيد الطلب',
      error: error.message
    });
  }
});

// إلغاء الطلب
router.post('/:orderNumber/cancel', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { reason } = req.body;

    const order = await orderService.cancelOrder(orderNumber, reason);

    res.json({
      success: true,
      message: 'تم إلغاء الطلب بنجاح',
      data: order
    });

  } catch (error) {
    console.error('❌ Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إلغاء الطلب',
      error: error.message
    });
  }
});

// إحصائيات الطلبات
router.get('/stats/summary', async (req, res) => {
  try {
    const { days = 30, companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const stats = await orderService.getOrderStats(companyId, parseInt(days));

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات الطلبات',
      error: error.message
    });
  }
});

// طلبات العميل
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { limit = 10 } = req.query;

    const orders = await orderService.getCustomerOrders(customerId, parseInt(limit));

    res.json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error('❌ Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب طلبات العميل',
      error: error.message
    });
  }
});

// إنشاء طلب بسيط من المحادثة (باستخدام EnhancedOrderService)
router.post('/simple', async (req, res) => {
  try {
    const EnhancedOrderService = require('../services/enhancedOrderService');
    const enhancedOrderService = new EnhancedOrderService();
    
    const { 
      customerId, 
      conversationId, 
      items, 
      subtotal, 
      shipping, 
      total, 
      city, 
      customerPhone, 
      shippingAddress, 
      notes 
    } = req.body;
    
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح - معرف الشركة مطلوب'
      });
    }

    // التحقق من البيانات المطلوبة
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الطلب غير مكتملة'
      });
    }

    // تحويل items للصيغة المتوافقة مع EnhancedOrderService
    const products = items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productColor: item.productColor,
      productSize: item.productSize,
      price: parseFloat(item.price),
      quantity: item.quantity,
      total: parseFloat(item.total),
      variantId: item.variantId
    }));

    // تحضير بيانات الطلب بنفس صيغة الـ AI
    const orderData = {
      companyId,
      customerId,
      conversationId,
      
      // معلومات المنتجات
      productName: products.map(p => p.productName).join(', '),
      productColor: products[0]?.productColor,
      productSize: products[0]?.productSize,
      productPrice: products[0]?.price,
      quantity: products.reduce((sum, p) => sum + p.quantity, 0),
      
      // معلومات الشحن
      customerAddress: shippingAddress || '',
      city: city || 'غير محدد',
      customerPhone: customerPhone || '',
      
      // التكاليف
      subtotal: parseFloat(subtotal) || 0,
      shipping: parseFloat(shipping) || 0,
      total: parseFloat(total) || 0,
      
      // ملاحظات
      notes: notes || '',
      
      // معلومات الاستخراج
      extractionMethod: 'manual_order_modal',
      confidence: 1.0,
      sourceType: 'manual',
      
      // المنتجات للحفظ في OrderItems
      products: products
    };

    console.log('📝 Creating order with EnhancedOrderService:', {
      companyId,
      customerId,
      conversationId,
      itemsCount: products.length,
      total: orderData.total
    });

    // إنشاء الطلب باستخدام نفس service الـ AI
    const result = await enhancedOrderService.createEnhancedOrder(orderData);
    await enhancedOrderService.disconnect();

    if (result.success) {
      console.log('✅ Order created successfully:', result.order.orderNumber);
      
      res.status(201).json({
        success: true,
        message: 'تم إنشاء الطلب بنجاح',
        data: result.order
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الطلب',
      error: error.message
    });
  }
});

// إنشاء طلب بسيط (للاختبار)
router.post('/create-simple', async (req, res) => {
  try {
    const orderData = req.body;

    // التحقق من البيانات المطلوبة
    const requiredFields = ['productName', 'productPrice'];
    for (const field of requiredFields) {
      if (!orderData[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} مطلوب`
        });
      }
    }

    const result = await simpleOrderService.createSimpleOrder(orderData);

    // حفظ الطلب في ملف
    await simpleOrderService.saveOrderToFile(result.order);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      data: result.order
    });

  } catch (error) {
    console.error('❌ Error creating simple order:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الطلب',
      error: error.message
    });
  }
});

// إنشاء طلب يدوي (للاختبار)
router.post('/create', async (req, res) => {
  try {
    const orderData = req.body;

    // التحقق من البيانات المطلوبة
    const requiredFields = ['customerId', 'companyId', 'productName', 'productPrice'];
    for (const field of requiredFields) {
      if (!orderData[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} مطلوب`
        });
      }
    }

    const order = await orderService.createOrderFromConversation(orderData);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      data: order
    });

  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الطلب',
      error: error.message
    });
  }
});

module.exports = router;

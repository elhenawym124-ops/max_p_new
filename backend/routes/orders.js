const express = require('express');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const socketService = require('../services/socketService');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const simpleOrderService = require('../services/simpleOrderService');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

// الحصول على الطلبات البسيطة
// الحصول على الطلبات البسيطة (مع Pagination & Filtering)
router.get('/simple', requireAuth, async (req, res) => {
  try {
    // الحصول على companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId;

    // Debug logging (development only)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ORDERS] /simple request - req.user:`, req.user ? { id: req.user.id, email: req.user.email, companyId: req.user.companyId } : 'null');
      console.log(`[ORDERS] /simple request - companyId:`, companyId);
    }

    if (!companyId) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[ORDERS] /simple - Missing companyId. req.user:`, req.user);
      }
      return res.status(403).json({
        success: false,
        message: 'غير مصرح - معرف الشركة مطلوب'
      });
    }

    // استخراج معاملات الفلترة والصفحات
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const paymentStatus = req.query.paymentStatus;
    const search = req.query.search;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // "Fetch Top N" Strategy:
    // لجلب الصفحة رقم P، نحتاج لجلب أول (P * limit) عنصر من الجدولين
    // ثم دمجهم، ترتيبهم، وأخذ الشريحة المناسبة.
    // هذا يضمن الترتيب الصحيح عبر الجدولين دون جلب الداتا كاملة.
    const fetchLimit = page * limit;

    // Log only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📦 [ORDERS] Fetching page ${page} (limit ${limit}) for company: ${companyId}`);
    }

    // بناء شروط البحث (Where Clause)
    const whereClause = { companyId };
    const guestWhereClause = { companyId };

    // 1. Filter by Status
    if (status && status !== 'all') {
      whereClause.status = status.toUpperCase();
      guestWhereClause.status = status.toLowerCase(); // Guest orders use lowercase usually, but let's check schema
      // GuestOrder status is string, Order is enum. Let's be careful.
    }

    // 2. Filter by Payment Status
    if (paymentStatus && paymentStatus !== 'all') {
      whereClause.paymentStatus = paymentStatus.toUpperCase();
      // GuestOrder doesn't have paymentStatus field in the mapped object usually, but let's check schema
      // Schema says GuestOrder has paymentMethod, but paymentStatus is hardcoded to pending in previous code.
      // We will skip paymentStatus filter for GuestOrders if they don't support it, or assume 'pending'.
      if (paymentStatus.toLowerCase() === 'pending') {
        // Guest orders are usually pending payment
      } else {
        // If filtering by PAID, GuestOrders might not match
        // For now, let's apply it if we can, or just filter in memory for guests if needed.
        // Actually, previous code hardcoded paymentStatus: 'pending' for guests.
      }
    }

    // 3. Filter by Date Range
    if (startDate || endDate) {
      whereClause.createdAt = {};
      guestWhereClause.createdAt = {};

      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
        guestWhereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
        guestWhereClause.createdAt.lte = end;
      }
    }

    // 4. Search (Complex because it spans multiple fields)
    if (search) {
      const searchInt = parseInt(search);
      const searchCondition = {
        OR: [
          { orderNumber: { contains: search } },
          { customer: { firstName: { contains: search } } },
          { customer: { lastName: { contains: search } } },
          { customer: { phone: { contains: search } } }
        ]
      };

      // Merge search into whereClause
      Object.assign(whereClause, searchCondition);

      const guestSearchCondition = {
        OR: [
          { orderNumber: { contains: search } },
          { guestName: { contains: search } },
          { guestPhone: { contains: search } },
          { guestEmail: { contains: search } }
        ]
      };
      Object.assign(guestWhereClause, guestSearchCondition);
    }

    // تنفيذ الاستعلامات (Top N)
    const [regularOrders, guestOrders, totalRegular, totalGuest] = await Promise.all([
      // Fetch Regular Orders
      getSharedPrismaClient().order.findMany({
        where: whereClause,
        take: fetchLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true }
          },
          items: {
            include: {
              product: { select: { id: true, name: true, images: true } }
            }
          },
          conversation: { select: { id: true, channel: true } }
        }
      }),
      // Fetch Guest Orders
      getSharedPrismaClient().guestOrder.findMany({
        where: guestWhereClause,
        take: fetchLimit,
        orderBy: { createdAt: 'desc' }
      }),
      // Count Total Regular (for pagination metadata)
      getSharedPrismaClient().order.count({ where: whereClause }),
      // Count Total Guest (for pagination metadata)
      getSharedPrismaClient().guestOrder.count({ where: guestWhereClause })
    ]);

    console.log(`📦 [ORDERS] Found ${regularOrders.length} regular, ${guestOrders.length} guest (Top ${fetchLimit})`);

    // تحويل البيانات (Mapping)
    const formattedRegularOrders = regularOrders.map(order => {
      let shippingAddress = order.shippingAddress || '';
      try {
        if (typeof shippingAddress === 'string' && shippingAddress.startsWith('{')) {
          shippingAddress = JSON.parse(shippingAddress);
        }
      } catch (e) { }

      // PRIORITY: Use order.customerName from WooCommerce first
      // This ensures each order shows the actual customer name from WooCommerce
      let finalCustomerName = '';
      
      // First: Try order.customerName (from WooCommerce)
      if (order.customerName && order.customerName.trim()) {
        finalCustomerName = order.customerName.trim();
      }
      // Second: Fallback to Customer relation if customerName is empty
      else if (order.customer) {
        const firstName = order.customer.firstName || '';
        const lastName = order.customer.lastName || '';
        finalCustomerName = `${firstName} ${lastName}`.trim();
      }
      // Final fallback: empty string
      else {
        finalCustomerName = '';
      }
      
      // Debug logging for all orders to help diagnose the issue
      const orderIndex = regularOrders.indexOf(order);
      if (orderIndex < 5) {
        console.log(`📦 [ORDER-API] Order #${orderIndex + 1} - ${order.orderNumber}:`, {
          hasCustomer: !!order.customer,
          customerId: order.customerId,
          customerFirstName: order.customer?.firstName || 'N/A',
          customerLastName: order.customer?.lastName || 'N/A',
          storedCustomerName: order.customerName || 'N/A',
          finalCustomerName: finalCustomerName || 'EMPTY'
        });
      }

      return {
        id: order.orderNumber,
        orderNumber: order.orderNumber,
        customerName: finalCustomerName,
        customerPhone: order.customerPhone || order.customer?.phone || '',
        customerEmail: order.customerEmail || order.customer?.email || '',
        customerAddress: order.customerAddress || '',
        city: order.city || '',
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

    const formattedGuestOrders = guestOrders.map(order => {
      let items = order.items || [];
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }

      let shippingAddress = order.shippingAddress || {};
      if (typeof shippingAddress === 'string') {
        try { shippingAddress = JSON.parse(shippingAddress); } catch (e) { shippingAddress = {}; }
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

    // دمج وترتيب (Merge & Sort)
    const allFetchedOrders = [...formattedRegularOrders, ...formattedGuestOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // تطبيق Pagination (Slice)
    // بما أننا جلبنا Top N، فالصفحة المطلوبة هي آخر (limit) عنصر في المصفوفة المدمجة
    // ولكن يجب أن نأخذ في الاعتبار الـ offset
    // الـ offset الحقيقي في المصفوفة المدمجة هو (page - 1) * limit
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = allFetchedOrders.slice(startIndex, endIndex);

    const totalOrders = totalRegular + totalGuest;

    console.log(`📊 [ORDERS] Returning ${paginatedOrders.length} orders (Page ${page}/${Math.ceil(totalOrders / limit)})`);

    res.json({
      success: true,
      data: paginatedOrders,
      pagination: {
        total: totalOrders,
        page: page,
        limit: limit,
        pages: Math.ceil(totalOrders / limit)
      }
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
    const regularOrder = await getSharedPrismaClient().order.updateMany({
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
      guestOrder = await getSharedPrismaClient().guestOrder.updateMany({
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
    const regularOrder = await getSharedPrismaClient().order.updateMany({
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
      guestOrder = await getSharedPrismaClient().guestOrder.updateMany({
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

    const orders = await getSharedPrismaClient().order.findMany({
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
    const total = await getSharedPrismaClient().order.count({ where });

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
router.get('/simple/:orderNumber', requireAuth, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    // Debug logging
    console.log('🔍 [ORDER-DETAIL] Request for order:', orderNumber);
    console.log('🔍 [ORDER-DETAIL] req.user:', req.user ? { id: req.user.id, email: req.user.email, companyId: req.user.companyId } : 'null');
    
    const companyId = req.user?.companyId;

    if (!companyId) {
      console.error('❌ [ORDER-DETAIL] Missing companyId!', { 
        user: req.user,
        hasUser: !!req.user,
        orderNumber 
      });
      return res.status(403).json({
        success: false,
        message: 'غير مصرح - معرف الشركة مطلوب'
      });
    }

    console.log('🔍 [ORDER-DETAIL] Searching for order:', { orderNumber, companyId });

    // Try to find regular order first
    let order = await getSharedPrismaClient().order.findFirst({
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

    let isGuestOrder = false;
    let guestOrder = null;

    // If not found, try guest order
    if (!order) {
      console.log('🔍 [ORDER-DETAIL] Regular order not found, trying guest order...');
      guestOrder = await getSharedPrismaClient().guestOrder.findFirst({
        where: {
          orderNumber,
          companyId
        }
      });

      if (guestOrder) {
        isGuestOrder = true;
        console.log('✅ [ORDER-DETAIL] Found guest order:', orderNumber);
      }
    }

    // If neither found, return 404
    if (!order && !guestOrder) {
      console.error('❌ [ORDER-DETAIL] Order not found:', { 
        orderNumber, 
        companyId,
        searchedRegular: true,
        searchedGuest: true
      });
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        orderNumber,
        companyId
      });
    }

    let formattedOrder;

    if (isGuestOrder && guestOrder) {
      // Format guest order
      let items = guestOrder.items || [];
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }

      let shippingAddress = guestOrder.shippingAddress || {};
      if (typeof shippingAddress === 'string') {
        try { shippingAddress = JSON.parse(shippingAddress); } catch (e) { shippingAddress = {}; }
      }

      formattedOrder = {
        id: guestOrder.orderNumber,
        orderNumber: guestOrder.orderNumber,
        customerName: guestOrder.guestName || '',
        customerPhone: guestOrder.guestPhone || '',
        customerEmail: guestOrder.guestEmail || '',
        customerAddress: typeof shippingAddress === 'object' ? (shippingAddress.address || shippingAddress.street || '') : '',
        city: typeof shippingAddress === 'object' ? (shippingAddress.city || '') : '',
        total: guestOrder.total || 0,
        subtotal: guestOrder.total || 0,
        tax: 0,
        shipping: guestOrder.shippingCost || 0,
        status: guestOrder.status?.toLowerCase() || 'pending',
        paymentStatus: 'pending',
        paymentMethod: guestOrder.paymentMethod?.toLowerCase() || 'cash_on_delivery',
        shippingAddress: shippingAddress,
        items: Array.isArray(items) ? items.map(item => ({
          id: item.productId || item.id || '',
          productId: item.productId || '',
          productName: item.name || item.productName || '',
          name: item.name || item.productName || '',
          price: item.price || 0,
          quantity: item.quantity || 1,
          total: (item.price || 0) * (item.quantity || 1),
          metadata: item.metadata || {}
        })) : [],
        trackingNumber: null,
        notes: guestOrder.notes || '',
        createdAt: guestOrder.createdAt,
        updatedAt: guestOrder.updatedAt,
        metadata: { source: 'storefront', isGuestOrder: true }
      };
    } else {
      // Format regular order
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
      // PRIORITY: Use order.customerName from WooCommerce first
      let finalCustomerName = '';
      
      // First: Try order.customerName (from WooCommerce)
      if (order.customerName && order.customerName.trim()) {
        finalCustomerName = order.customerName.trim();
      }
      // Second: Fallback to Customer relation if customerName is empty
      else if (order.customer) {
        const firstName = order.customer.firstName || '';
        const lastName = order.customer.lastName || '';
        finalCustomerName = `${firstName} ${lastName}`.trim();
      }
      // Final fallback: empty string
      else {
        finalCustomerName = '';
      }
      
      formattedOrder = {
        id: order.orderNumber,
        orderNumber: order.orderNumber,
        customerName: finalCustomerName,
        customerPhone: order.customerPhone || order.customer?.phone || '',
        customerEmail: order.customerEmail || order.customer?.email || '',
        customerAddress: order.customerAddress || '',
        city: order.city || '',
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
    }

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

// Bulk Status Update
router.post('/bulk/status', async (req, res) => {
  try {
    const { orderIds, status } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Order IDs required' });
    }

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status required' });
    }

    // Update Regular Orders
    const regularUpdate = await getSharedPrismaClient().order.updateMany({
      where: {
        companyId,
        orderNumber: { in: orderIds }
      },
      data: {
        status: status.toUpperCase(),
        updatedAt: new Date()
      }
    });

    // Update Guest Orders
    const guestUpdate = await getSharedPrismaClient().guestOrder.updateMany({
      where: {
        companyId,
        orderNumber: { in: orderIds }
      },
      data: {
        status: status.toLowerCase(), // Guest orders often use lowercase
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Orders updated successfully',
      data: {
        regularUpdated: regularUpdate.count,
        guestUpdated: guestUpdate.count
      }
    });

  } catch (error) {
    console.error('❌ Error bulk updating orders:', error);
    res.status(500).json({ success: false, message: 'Failed to update orders', error: error.message });
  }
});

// Bulk Delete
router.post('/bulk/delete', async (req, res) => {
  try {
    const { orderIds } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Order IDs required' });
    }

    // Delete Regular Orders
    const regularDelete = await getSharedPrismaClient().order.deleteMany({
      where: {
        companyId,
        orderNumber: { in: orderIds }
      }
    });

    // Delete Guest Orders
    const guestDelete = await getSharedPrismaClient().guestOrder.deleteMany({
      where: {
        companyId,
        orderNumber: { in: orderIds }
      }
    });

    res.json({
      success: true,
      message: 'Orders deleted successfully',
      data: {
        regularDeleted: regularDelete.count,
        guestDeleted: guestDelete.count
      }
    });

  } catch (error) {
    console.error('❌ Error bulk deleting orders:', error);
    res.status(500).json({ success: false, message: 'Failed to delete orders', error: error.message });
  }
});

// Export Orders
router.get('/export', async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ success: false, message: 'Unauthorized' });

    const { status, paymentStatus, search, startDate, endDate } = req.query;

    // Build Filters (Same as /simple)
    const whereClause = { companyId };
    const guestWhereClause = { companyId };

    if (status && status !== 'all') {
      whereClause.status = status.toUpperCase();
      guestWhereClause.status = status.toLowerCase();
    }

    if (paymentStatus && paymentStatus !== 'all') {
      whereClause.paymentStatus = paymentStatus.toUpperCase();
      // Guest orders logic for payment status (simplified)
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      guestWhereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
        guestWhereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
        guestWhereClause.createdAt.lte = end;
      }
    }

    if (search) {
      const searchCondition = {
        OR: [
          { orderNumber: { contains: search } },
          { customer: { firstName: { contains: search } } },
          { customer: { lastName: { contains: search } } },
          { customer: { phone: { contains: search } } }
        ]
      };
      Object.assign(whereClause, searchCondition);

      const guestSearchCondition = {
        OR: [
          { orderNumber: { contains: search } },
          { guestName: { contains: search } },
          { guestPhone: { contains: search } },
          { guestEmail: { contains: search } }
        ]
      };
      Object.assign(guestWhereClause, guestSearchCondition);
    }

    // Fetch All Data (No Pagination)
    const [regularOrders, guestOrders] = await Promise.all([
      getSharedPrismaClient().order.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, items: true }
      }),
      getSharedPrismaClient().guestOrder.findMany({
        where: guestWhereClause,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // Format Data for Excel
    const allOrders = [
      ...regularOrders.map(o => ({
        'Order Number': o.orderNumber,
        'Date': o.createdAt,
        'Customer Name': o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : '',
        'Phone': o.customer?.phone || '',
        'Total': o.total,
        'Status': o.status,
        'Payment Status': o.paymentStatus,
        'Type': 'Regular'
      })),
      ...guestOrders.map(o => ({
        'Order Number': o.orderNumber,
        'Date': o.createdAt,
        'Customer Name': o.guestName || '',
        'Phone': o.guestPhone || '',
        'Total': o.total,
        'Status': o.status,
        'Payment Status': 'Pending',
        'Type': 'Guest'
      }))
    ].sort((a, b) => new Date(b.Date) - new Date(a.Date));

    // Create Workbook
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(allOrders);
    xlsx.utils.book_append_sheet(wb, ws, 'Orders');

    // Generate Buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Send Response
    res.setHeader('Content-Disposition', 'attachment; filename="orders.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error('❌ Error exporting orders:', error);
    res.status(500).json({ success: false, message: 'Export failed', error: error.message });
  }
});

module.exports = router;

// Update Order Details (Address, Notes)
router.put('/simple/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { shippingAddress, notes, customerName, customerPhone } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) return res.status(403).json({ success: false, message: 'Unauthorized' });

    // Try Regular Order
    const regularOrder = await getSharedPrismaClient().order.findFirst({
      where: { orderNumber, companyId }
    });

    if (regularOrder) {
      const updateData = {
        shippingAddress: JSON.stringify(shippingAddress),
        notes,
        updatedAt: new Date()
      };

      await getSharedPrismaClient().order.update({
        where: { id: regularOrder.id },
        data: updateData
      });

      // Socket Emit
      if (socketService?.getIO()) {
        socketService.getIO().to(`company_${companyId}`).emit('order:updated', {
          orderNumber,
          ...updateData,
          shippingAddress: typeof updateData.shippingAddress === 'string' ? JSON.parse(updateData.shippingAddress) : updateData.shippingAddress
        });
      }

      return res.json({ success: true, message: 'Order updated successfully' });
    }

    // Try Guest Order
    const guestOrder = await getSharedPrismaClient().guestOrder.findFirst({
      where: { orderNumber, companyId }
    });

    if (guestOrder) {
      await getSharedPrismaClient().guestOrder.update({
        where: { id: guestOrder.id },
        data: {
          shippingAddress: JSON.stringify(shippingAddress),
          notes,
          guestName: customerName,
          guestPhone: customerPhone,
          updatedAt: new Date()
        }
      });

      // Socket Emit
      if (socketService?.getIO()) {
        socketService.getIO().to(`company_${companyId}`).emit('order:updated', {
          orderNumber,
          shippingAddress,
          notes,
          customerName,
          customerPhone
        });
      }

      return res.json({ success: true, message: 'Order updated successfully' });
    }

    res.status(404).json({ success: false, message: 'Order not found' });

  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({ success: false, message: 'Failed to update order', error: error.message });
  }
});

// Update Order Items
router.put('/simple/:orderNumber/items', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { items, total, subtotal, tax, shipping } = req.body; // Expecting full new list of items
    const companyId = req.user?.companyId;

    if (!companyId) return res.status(403).json({ success: false, message: 'Unauthorized' });

    // Try Regular Order
    const regularOrder = await getSharedPrismaClient().order.findFirst({
      where: { orderNumber, companyId }
    });

    if (regularOrder) {
      // Transaction: Delete old items, Create new items, Update totals
      await getSharedPrismaClient().$transaction(async (prisma) => {
        // Delete existing items
        await prisma.orderItem.deleteMany({
          where: { orderId: regularOrder.id }
        });

        // Create new items
        for (const item of items) {
          await prisma.orderItem.create({
            data: {
              orderId: regularOrder.id,
              productId: item.productId, // Must exist
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              metadata: JSON.stringify(item.metadata || {})
            }
          });
        }

        // Update Order Totals
        await prisma.order.update({
          where: { id: regularOrder.id },
          data: {
            total,
            subtotal,
            tax,
            shipping,
            updatedAt: new Date()
          }
        });
      });

      // Socket Emit
      if (socketService?.getIO()) {
        socketService.getIO().to(`company_${companyId}`).emit('order:updated', {
          orderNumber,
          total,
          shipping,
          _refetch: true
        });
      }

      return res.json({ success: true, message: 'Order items updated successfully' });
    }

    // Try Guest Order
    const guestOrder = await getSharedPrismaClient().guestOrder.findFirst({
      where: { orderNumber, companyId }
    });

    if (guestOrder) {
      // Guest Order stores items as JSON, much easier
      await getSharedPrismaClient().guestOrder.update({
        where: { id: guestOrder.id },
        data: {
          items: JSON.stringify(items),
          total,
          shippingCost: shipping,
          updatedAt: new Date()
        }
      });

      // Socket Emit
      if (socketService?.getIO()) {
        socketService.getIO().to(`company_${companyId}`).emit('order:updated', {
          orderNumber,
          total,
          shipping,
          _refetch: true
        });
      }

      return res.json({ success: true, message: 'Order items updated successfully' });
    }

    res.status(404).json({ success: false, message: 'Order not found' });

  } catch (error) {
    console.error('❌ Error updating order items:', error);
    res.status(500).json({ success: false, message: 'Failed to update order items', error: error.message });
  }
});


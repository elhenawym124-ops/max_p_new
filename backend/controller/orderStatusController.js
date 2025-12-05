const { getSharedPrismaClient } = require('../services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════
// 🎨 Default System Statuses
// ═══════════════════════════════════════════════════════════════

const DEFAULT_ORDER_STATUSES = [
  { code: 'PENDING', name: 'قيد الانتظار', nameEn: 'Pending', color: '#F59E0B', icon: 'Clock', sortOrder: 1, wooCommerceStatus: 'pending' },
  { code: 'CONFIRMED', name: 'مؤكد', nameEn: 'Confirmed', color: '#3B82F6', icon: 'CheckCircle', sortOrder: 2, wooCommerceStatus: 'processing' },
  { code: 'PROCESSING', name: 'قيد التجهيز', nameEn: 'Processing', color: '#8B5CF6', icon: 'Package', sortOrder: 3, wooCommerceStatus: 'processing' },
  { code: 'SHIPPED', name: 'تم الشحن', nameEn: 'Shipped', color: '#06B6D4', icon: 'Truck', sortOrder: 4, wooCommerceStatus: 'completed' },
  { code: 'DELIVERED', name: 'تم التسليم', nameEn: 'Delivered', color: '#10B981', icon: 'CheckCircle2', sortOrder: 5, wooCommerceStatus: 'completed' },
  { code: 'CANCELLED', name: 'ملغي', nameEn: 'Cancelled', color: '#EF4444', icon: 'XCircle', sortOrder: 6, wooCommerceStatus: 'cancelled' },
  { code: 'REFUNDED', name: 'مسترد', nameEn: 'Refunded', color: '#6B7280', icon: 'RotateCcw', sortOrder: 7, wooCommerceStatus: 'refunded' }
];

const DEFAULT_PAYMENT_STATUSES = [
  { code: 'PENDING', name: 'في انتظار الدفع', nameEn: 'Pending', color: '#F59E0B', icon: 'Clock', sortOrder: 1 },
  { code: 'COMPLETED', name: 'مدفوع', nameEn: 'Completed', color: '#10B981', icon: 'CheckCircle', sortOrder: 2 },
  { code: 'FAILED', name: 'فشل الدفع', nameEn: 'Failed', color: '#EF4444', icon: 'XCircle', sortOrder: 3 },
  { code: 'REFUNDED', name: 'مسترد', nameEn: 'Refunded', color: '#6B7280', icon: 'RotateCcw', sortOrder: 4 }
];

// WooCommerce default statuses mapping
const WOOCOMMERCE_STATUSES = {
  'pending': { name: 'في انتظار الدفع', nameEn: 'Pending payment', color: '#F59E0B', mapsToSystem: 'PENDING' },
  'processing': { name: 'قيد التجهيز', nameEn: 'Processing', color: '#3B82F6', mapsToSystem: 'PROCESSING' },
  'on-hold': { name: 'معلق', nameEn: 'On hold', color: '#F97316', mapsToSystem: 'PENDING' },
  'completed': { name: 'مكتمل', nameEn: 'Completed', color: '#10B981', mapsToSystem: 'DELIVERED' },
  'cancelled': { name: 'ملغي', nameEn: 'Cancelled', color: '#EF4444', mapsToSystem: 'CANCELLED' },
  'refunded': { name: 'مسترد', nameEn: 'Refunded', color: '#6B7280', mapsToSystem: 'REFUNDED' },
  'failed': { name: 'فشل', nameEn: 'Failed', color: '#DC2626', mapsToSystem: 'CANCELLED' },
  'checkout-draft': { name: 'مسودة', nameEn: 'Draft', color: '#9CA3AF', mapsToSystem: 'PENDING' }
};

// ═══════════════════════════════════════════════════════════════
// 📋 Get All Status Configurations
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/order-status
 * جلب جميع حالات الطلبات للشركة
 */
const getAllStatuses = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    console.log('🏷️ [ORDER-STATUS] Getting statuses for company:', companyId);
    
    if (!companyId) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    }

    const { statusType } = req.query;

    const where = { companyId, isActive: true };
    if (statusType) where.statusType = statusType;

    let statuses = await getSharedPrismaClient().orderStatusConfig.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });

    console.log('🏷️ [ORDER-STATUS] Found statuses:', statuses.length);

    // إذا لم توجد حالات، أنشئ الحالات الافتراضية
    if (statuses.length === 0) {
      console.log('🏷️ [ORDER-STATUS] No statuses found, initializing defaults...');
      await initializeDefaultStatuses(companyId);
      statuses = await getSharedPrismaClient().orderStatusConfig.findMany({
        where,
        orderBy: { sortOrder: 'asc' }
      });
      console.log('🏷️ [ORDER-STATUS] After init, found statuses:', statuses.length);
    }

    res.json({
      success: true,
      data: statuses
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error getting statuses:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الحالات',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/order-status/:id
 * جلب حالة محددة
 */
const getStatusById = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const status = await getSharedPrismaClient().orderStatusConfig.findFirst({
      where: { id, companyId }
    });

    if (!status) {
      return res.status(404).json({ success: false, message: 'الحالة غير موجودة' });
    }

    res.json({ success: true, data: status });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error getting status:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الحالة', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// ➕ Create Status
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/order-status
 * إنشاء حالة جديدة
 */
const createStatus = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    }

    const {
      code,
      name,
      nameEn,
      description,
      color,
      icon,
      sortOrder,
      statusType,
      mapsToSystem,
      wooCommerceStatus,
      allowedNextStatuses,
      autoActions,
      notifyCustomer,
      notifyAdmin,
      emailTemplate,
      smsTemplate
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'الكود والاسم مطلوبان' });
    }

    // التحقق من عدم تكرار الكود
    const existing = await getSharedPrismaClient().orderStatusConfig.findFirst({
      where: { companyId, code }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'هذا الكود موجود بالفعل' });
    }

    const status = await getSharedPrismaClient().orderStatusConfig.create({
      data: {
        companyId,
        code: code.toUpperCase().replace(/\s+/g, '_'),
        name,
        nameEn,
        description,
        color: color || '#6B7280',
        icon,
        sortOrder: sortOrder || 0,
        statusType: statusType || 'order',
        source: 'custom',
        isSystemStatus: false,
        mapsToSystem,
        wooCommerceStatus,
        allowedNextStatuses: allowedNextStatuses ? JSON.stringify(allowedNextStatuses) : null,
        autoActions: autoActions ? JSON.stringify(autoActions) : null,
        notifyCustomer: notifyCustomer || false,
        notifyAdmin: notifyAdmin || false,
        emailTemplate,
        smsTemplate
      }
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحالة بنجاح',
      data: status
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error creating status:', error);
    res.status(500).json({ success: false, message: 'خطأ في إنشاء الحالة', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// ✏️ Update Status
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/v1/order-status/:id
 * تحديث حالة
 */
const updateStatus = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const existing = await getSharedPrismaClient().orderStatusConfig.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'الحالة غير موجودة' });
    }

    const {
      name,
      nameEn,
      description,
      color,
      icon,
      sortOrder,
      mapsToSystem,
      wooCommerceStatus,
      allowedNextStatuses,
      autoActions,
      notifyCustomer,
      notifyAdmin,
      emailTemplate,
      smsTemplate,
      isActive
    } = req.body;

    const status = await getSharedPrismaClient().orderStatusConfig.update({
      where: { id },
      data: {
        name: name || existing.name,
        nameEn,
        description,
        color: color || existing.color,
        icon,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        mapsToSystem,
        wooCommerceStatus,
        allowedNextStatuses: allowedNextStatuses ? JSON.stringify(allowedNextStatuses) : existing.allowedNextStatuses,
        autoActions: autoActions ? JSON.stringify(autoActions) : existing.autoActions,
        notifyCustomer: notifyCustomer !== undefined ? notifyCustomer : existing.notifyCustomer,
        notifyAdmin: notifyAdmin !== undefined ? notifyAdmin : existing.notifyAdmin,
        emailTemplate,
        smsTemplate,
        isActive: isActive !== undefined ? isActive : existing.isActive
      }
    });

    res.json({
      success: true,
      message: 'تم تحديث الحالة بنجاح',
      data: status
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error updating status:', error);
    res.status(500).json({ success: false, message: 'خطأ في تحديث الحالة', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🗑️ Delete Status
// ═══════════════════════════════════════════════════════════════

/**
 * DELETE /api/v1/order-status/:id
 * حذف حالة (soft delete)
 */
const deleteStatus = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const existing = await getSharedPrismaClient().orderStatusConfig.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'الحالة غير موجودة' });
    }

    if (existing.isSystemStatus) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف حالات النظام الأساسية' });
    }

    await getSharedPrismaClient().orderStatusConfig.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'تم حذف الحالة بنجاح'
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error deleting status:', error);
    res.status(500).json({ success: false, message: 'خطأ في حذف الحالة', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 Sync with WooCommerce
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/order-status/sync-woocommerce
 * مزامنة واكتشاف الحالات من WooCommerce
 */
const syncWooCommerceStatuses = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    }

    // جلب إعدادات WooCommerce
    const settings = await getSharedPrismaClient().wooCommerceSettings.findUnique({
      where: { companyId }
    });

    if (!settings) {
      return res.status(400).json({
        success: false,
        message: 'إعدادات WooCommerce غير موجودة. يرجى ربط المتجر أولاً.'
      });
    }

    const baseURL = settings.storeUrl.replace(/\/$/, '');
    
    // جلب الحالات من WooCommerce
    let wooStatuses = [];
    
    try {
      // محاولة جلب الحالات من WooCommerce API
      const response = await axios.get(`${baseURL}/wp-json/wc/v3/orders`, {
        auth: {
          username: settings.consumerKey,
          password: settings.consumerSecret
        },
        params: { per_page: 100 },
        timeout: 30000
      });

      // استخراج الحالات الفريدة من الطلبات
      const uniqueStatuses = new Set();
      response.data.forEach(order => {
        if (order.status) {
          uniqueStatuses.add(order.status);
        }
      });

      wooStatuses = Array.from(uniqueStatuses);
      
    } catch (apiError) {
      console.log('⚠️ [ORDER-STATUS] Could not fetch orders, using default WooCommerce statuses');
      wooStatuses = Object.keys(WOOCOMMERCE_STATUSES);
    }

    // إضافة الحالات الافتراضية لـ WooCommerce
    Object.keys(WOOCOMMERCE_STATUSES).forEach(status => {
      if (!wooStatuses.includes(status)) {
        wooStatuses.push(status);
      }
    });

    const results = {
      discovered: [],
      existing: [],
      created: []
    };

    // معالجة كل حالة
    for (const wooStatus of wooStatuses) {
      const statusCode = `WOO_${wooStatus.toUpperCase().replace(/-/g, '_')}`;
      
      // التحقق من وجود الحالة
      const existing = await getSharedPrismaClient().orderStatusConfig.findFirst({
        where: { 
          companyId, 
          OR: [
            { code: statusCode },
            { wooCommerceStatus: wooStatus }
          ]
        }
      });

      if (existing) {
        results.existing.push({ code: wooStatus, localCode: existing.code });
        continue;
      }

      // إنشاء حالة جديدة
      const defaultInfo = WOOCOMMERCE_STATUSES[wooStatus] || {
        name: wooStatus,
        nameEn: wooStatus,
        color: '#6B7280',
        mapsToSystem: 'PENDING'
      };

      const newStatus = await getSharedPrismaClient().orderStatusConfig.create({
        data: {
          companyId,
          code: statusCode,
          name: defaultInfo.name,
          nameEn: defaultInfo.nameEn,
          color: defaultInfo.color,
          icon: 'Tag',
          sortOrder: 100 + results.created.length,
          statusType: 'order',
          source: 'woocommerce',
          isSystemStatus: false,
          mapsToSystem: defaultInfo.mapsToSystem,
          wooCommerceStatus: wooStatus
        }
      });

      results.discovered.push(wooStatus);
      results.created.push(newStatus);
    }

    res.json({
      success: true,
      message: `تم اكتشاف ${results.discovered.length} حالة جديدة من WooCommerce`,
      data: {
        discovered: results.discovered,
        existing: results.existing.length,
        created: results.created.length,
        statuses: results.created
      }
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error syncing WooCommerce statuses:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في مزامنة الحالات',
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 Update Status Mapping
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/v1/order-status/:id/mapping
 * تحديث ربط الحالة
 */
const updateStatusMapping = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    const { mapsToSystem, wooCommerceStatus } = req.body;

    const existing = await getSharedPrismaClient().orderStatusConfig.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'الحالة غير موجودة' });
    }

    const status = await getSharedPrismaClient().orderStatusConfig.update({
      where: { id },
      data: { mapsToSystem, wooCommerceStatus }
    });

    res.json({
      success: true,
      message: 'تم تحديث الربط بنجاح',
      data: status
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error updating mapping:', error);
    res.status(500).json({ success: false, message: 'خطأ في تحديث الربط', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 Reorder Statuses
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/v1/order-status/reorder
 * إعادة ترتيب الحالات
 */
const reorderStatuses = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { statusIds } = req.body; // Array of status IDs in new order

    if (!statusIds || !Array.isArray(statusIds)) {
      return res.status(400).json({ success: false, message: 'قائمة الحالات مطلوبة' });
    }

    // تحديث الترتيب
    for (let i = 0; i < statusIds.length; i++) {
      await getSharedPrismaClient().orderStatusConfig.updateMany({
        where: { id: statusIds[i], companyId },
        data: { sortOrder: i + 1 }
      });
    }

    res.json({
      success: true,
      message: 'تم إعادة الترتيب بنجاح'
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error reordering:', error);
    res.status(500).json({ success: false, message: 'خطأ في إعادة الترتيب', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 Initialize Default Statuses
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/order-status/initialize
 * تهيئة الحالات الافتراضية
 */
const initializeStatuses = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    }

    await initializeDefaultStatuses(companyId);

    const statuses = await getSharedPrismaClient().orderStatusConfig.findMany({
      where: { companyId },
      orderBy: { sortOrder: 'asc' }
    });

    res.json({
      success: true,
      message: 'تم تهيئة الحالات الافتراضية',
      data: statuses
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error initializing:', error);
    res.status(500).json({ success: false, message: 'خطأ في التهيئة', error: error.message });
  }
};

/**
 * Helper: تهيئة الحالات الافتراضية
 */
const initializeDefaultStatuses = async (companyId) => {
  // حالات الطلبات
  for (const status of DEFAULT_ORDER_STATUSES) {
    const existing = await getSharedPrismaClient().orderStatusConfig.findFirst({
      where: { companyId, code: status.code, statusType: 'order' }
    });

    if (!existing) {
      await getSharedPrismaClient().orderStatusConfig.create({
        data: {
          companyId,
          ...status,
          statusType: 'order',
          source: 'system',
          isSystemStatus: true
        }
      });
    }
  }

  // حالات الدفع
  for (const status of DEFAULT_PAYMENT_STATUSES) {
    const existing = await getSharedPrismaClient().orderStatusConfig.findFirst({
      where: { companyId, code: status.code, statusType: 'payment' }
    });

    if (!existing) {
      await getSharedPrismaClient().orderStatusConfig.create({
        data: {
          companyId,
          ...status,
          statusType: 'payment',
          source: 'system',
          isSystemStatus: true
        }
      });
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// 📊 Get Status Statistics
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/order-status/stats
 * إحصائيات الحالات
 */
const getStatusStats = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    }

    // عدد الحالات حسب النوع
    const statusCounts = await getSharedPrismaClient().orderStatusConfig.groupBy({
      by: ['statusType', 'source'],
      where: { companyId, isActive: true },
      _count: true
    });

    // عدد الطلبات لكل حالة
    const ordersByStatus = await getSharedPrismaClient().order.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true
    });

    res.json({
      success: true,
      data: {
        statusCounts,
        ordersByStatus
      }
    });

  } catch (error) {
    console.error('❌ [ORDER-STATUS] Error getting stats:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات', error: error.message });
  }
};

module.exports = {
  getAllStatuses,
  getStatusById,
  createStatus,
  updateStatus,
  deleteStatus,
  syncWooCommerceStatuses,
  updateStatusMapping,
  reorderStatuses,
  initializeStatuses,
  getStatusStats,
  initializeDefaultStatuses
};


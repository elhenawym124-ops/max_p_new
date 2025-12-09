const ActivityLog = require('../models/ActivityLog');
const { validationResult } = require('express-validator');

/**
 * الحصول على نشاطات المستخدم الحالي
 * GET /api/v1/activity/my-activities
 */
exports.getMyActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      action,
      severity,
      isSuccess,
      startDate,
      endDate,
      search
    } = req.query;

    // بناء الفلتر
    const filter = {
      userId: req.user._id,
      companyId: req.user.companyId
    };

    if (category) filter.category = category;
    if (action) filter.action = action;
    if (severity) filter.severity = severity;
    if (isSuccess !== undefined) filter.isSuccess = isSuccess === 'true';

    // فلتر التاريخ
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // البحث في الوصف
    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    // الحصول على النشاطات مع Pagination
    const skip = (page - 1) * limit;
    const activities = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // عدد النشاطات الكلي
    const total = await ActivityLog.countDocuments(filter);

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching my activities:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب النشاطات',
      error: error.message
    });
  }
};

/**
 * الحصول على تفاصيل نشاط محدد
 * GET /api/v1/activity/:id
 */
exports.getActivityById = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await ActivityLog.findOne({
      _id: id,
      $or: [
        { userId: req.user._id }, // المستخدم نفسه
        { companyId: req.user.companyId, userId: { $ne: req.user._id } } // مدير الشركة
      ]
    })
      .populate('userId', 'name email avatar')
      .lean();

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'النشاط غير موجود'
      });
    }

    // التحقق من الصلاحيات - فقط المستخدم نفسه أو مدير الشركة
    if (activity.userId._id.toString() !== req.user._id.toString() && 
        req.user.role !== 'company_admin' && 
        req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض هذا النشاط'
      });
    }

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب النشاط',
      error: error.message
    });
  }
};

/**
 * الحصول على إحصائيات نشاطات المستخدم
 * GET /api/v1/activity/my-stats
 */
exports.getMyStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {
      userId: req.user._id,
      companyId: req.user.companyId
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // إحصائيات حسب التصنيف
    const categoryStats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          successCount: { $sum: { $cond: ['$isSuccess', 1, 0] } },
          failureCount: { $sum: { $cond: ['$isSuccess', 0, 1] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // إحصائيات حسب اليوم (آخر 7 أيام)
    const dailyStats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]);

    // إجمالي النشاطات
    const totalActivities = await ActivityLog.countDocuments(filter);

    // آخر نشاط
    const lastActivity = await ActivityLog.findOne(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        totalActivities,
        categoryStats,
        dailyStats,
        lastActivity
      }
    });
  } catch (error) {
    console.error('Error fetching my stats:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الإحصائيات',
      error: error.message
    });
  }
};

/**
 * الحصول على نشاطات جميع موظفي الشركة (للمديرين فقط)
 * GET /api/v1/activity/company-activities
 */
exports.getCompanyActivities = async (req, res) => {
  try {
    // التحقق من الصلاحيات
    if (req.user.role !== 'company_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض نشاطات الشركة'
      });
    }

    const {
      page = 1,
      limit = 20,
      userId,
      category,
      action,
      severity,
      isSuccess,
      startDate,
      endDate,
      search
    } = req.query;

    // بناء الفلتر
    const filter = {
      companyId: req.user.companyId
    };

    if (userId) filter.userId = userId;
    if (category) filter.category = category;
    if (action) filter.action = action;
    if (severity) filter.severity = severity;
    if (isSuccess !== undefined) filter.isSuccess = isSuccess === 'true';

    // فلتر التاريخ
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // البحث
    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    // الحصول على النشاطات
    const skip = (page - 1) * limit;
    const activities = await ActivityLog.find(filter)
      .populate('userId', 'name email avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // عدد النشاطات الكلي
    const total = await ActivityLog.countDocuments(filter);

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching company activities:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب نشاطات الشركة',
      error: error.message
    });
  }
};

/**
 * الحصول على إحصائيات الشركة (للمديرين فقط)
 * GET /api/v1/activity/company-stats
 */
exports.getCompanyStats = async (req, res) => {
  try {
    // التحقق من الصلاحيات
    if (req.user.role !== 'company_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض إحصائيات الشركة'
      });
    }

    const { startDate, endDate } = req.query;

    // استخدام الدالة الجاهزة من Model
    const categoryStats = await ActivityLog.getStats(
      req.user.companyId,
      startDate,
      endDate
    );

    // أكثر المستخدمين نشاطاً
    const mostActiveUsers = await ActivityLog.getMostActiveUsers(
      req.user.companyId,
      10
    );

    // إحصائيات حسب اليوم (آخر 30 يوم)
    const filter = { companyId: req.user.companyId };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const dailyStats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          successCount: { $sum: { $cond: ['$isSuccess', 1, 0] } },
          failureCount: { $sum: { $cond: ['$isSuccess', 0, 1] } }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    // إحصائيات حسب الخطورة
    const severityStats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // إجمالي النشاطات
    const totalActivities = await ActivityLog.countDocuments(filter);

    // النشاطات الحساسة الأخيرة
    const criticalActivities = await ActivityLog.find({
      companyId: req.user.companyId,
      severity: { $in: ['HIGH', 'CRITICAL'] }
    })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        totalActivities,
        categoryStats,
        mostActiveUsers,
        dailyStats,
        severityStats,
        criticalActivities
      }
    });
  } catch (error) {
    console.error('Error fetching company stats:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب إحصائيات الشركة',
      error: error.message
    });
  }
};

/**
 * الحصول على نشاطات مستخدم محدد (للمديرين فقط)
 * GET /api/v1/activity/user/:userId
 */
exports.getUserActivities = async (req, res) => {
  try {
    // التحقق من الصلاحيات
    if (req.user.role !== 'company_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض نشاطات المستخدمين'
      });
    }

    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      category,
      action,
      startDate,
      endDate
    } = req.query;

    // بناء الفلتر
    const filter = {
      userId,
      companyId: req.user.companyId
    };

    if (category) filter.category = category;
    if (action) filter.action = action;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // الحصول على النشاطات
    const skip = (page - 1) * limit;
    const activities = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await ActivityLog.countDocuments(filter);

    // إحصائيات المستخدم
    const userStats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        activities,
        userStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب نشاطات المستخدم',
      error: error.message
    });
  }
};

/**
 * تصدير نشاطات المستخدم (CSV)
 * GET /api/v1/activity/export
 */
exports.exportActivities = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    // بناء الفلتر
    const filter = {};

    // إذا كان مستخدم عادي، فقط نشاطاته
    if (req.user.role !== 'company_admin' && req.user.role !== 'super_admin') {
      filter.userId = req.user._id;
    } else {
      // إذا كان مدير، يمكنه تصدير نشاطات الشركة أو مستخدم محدد
      filter.companyId = req.user.companyId;
      if (userId) filter.userId = userId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const activities = await ActivityLog.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10000) // حد أقصى للتصدير
      .lean();

    // تحويل إلى CSV
    const csv = [
      ['التاريخ', 'المستخدم', 'التصنيف', 'الإجراء', 'الوصف', 'الحالة', 'الخطورة'].join(','),
      ...activities.map(a => [
        new Date(a.createdAt).toLocaleString('ar-EG'),
        a.userId?.name || 'غير معروف',
        a.category,
        a.action,
        `"${a.description}"`,
        a.isSuccess ? 'نجح' : 'فشل',
        a.severity
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=activities-${Date.now()}.csv`);
    res.send('\uFEFF' + csv); // BOM for UTF-8
  } catch (error) {
    console.error('Error exporting activities:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تصدير النشاطات',
      error: error.message
    });
  }
};

/**
 * حذف النشاطات القديمة (للسوبر أدمن فقط - Cleanup)
 * DELETE /api/v1/activity/cleanup
 */
exports.cleanupOldActivities = async (req, res) => {
  try {
    // فقط السوبر أدمن
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لحذف النشاطات'
      });
    }

    const { days = 90 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // حذف النشاطات الأقدم من التاريخ المحدد
    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: cutoffDate },
      severity: { $nin: ['CRITICAL'] } // الاحتفاظ بالنشاطات الحرجة
    });

    res.json({
      success: true,
      message: `تم حذف ${result.deletedCount} نشاط قديم`,
      data: {
        deletedCount: result.deletedCount,
        cutoffDate
      }
    });
  } catch (error) {
    console.error('Error cleaning up activities:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف النشاطات القديمة',
      error: error.message
    });
  }
};

/**
 * Success Learning Routes
 * 
 * مسارات API لنظام تعلم أنماط النجاح
 */

const express = require('express');
const router = express.Router();
const SuccessAnalyzer = require('../services/successAnalyzer');
const PatternDetector = require('../services/patternDetector');
const OutcomeTracker = require('../services/outcomeTracker');
const PatternApplicationService = require('../services/patternApplicationService');
const PatternCleanupService = require('../services/patternCleanupService');
const scheduledMaintenance = require('../services/scheduledPatternMaintenanceService');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

const prisma = getSharedPrismaClient();
const successAnalyzer = new SuccessAnalyzer();
const patternDetector = new PatternDetector();
const outcomeTracker = new OutcomeTracker();
const patternApplication = new PatternApplicationService();
const patternCleanup = new PatternCleanupService();

/**
 * حالة النظام العامة (بدون مصادقة للمراقبة)
 * GET /api/v1/success-learning/public/system-status
 */
router.get('/public/system-status', async (req, res) => {
  try {
    // إحصائيات عامة بدون معلومات حساسة
    const totalPatterns = await prisma.successPattern.count();
    const activePatterns = await prisma.successPattern.count({
      where: { isActive: true }
    });
    const approvedPatterns = await prisma.successPattern.count({
      where: { isApproved: true }
    });

    // إحصائيات الاستخدام
    const totalUsage = await prisma.patternUsage.count();
    const recentUsage = await prisma.patternUsage.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // آخر 24 ساعة
        }
      }
    });

    // حالة الخدمات
    const autoPatternService = require('../services/autoPatternDetectionService');
    const serviceStatus = autoPatternService.getStatus();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        status: 'operational',
        version: '2.0',
        uptime: Math.floor(process.uptime())
      },
      patterns: {
        total: totalPatterns,
        active: activePatterns,
        approved: approvedPatterns,
        approvalRate: totalPatterns > 0 ? (approvedPatterns / totalPatterns * 100).toFixed(1) : 0
      },
      usage: {
        total: totalUsage,
        last24h: recentUsage
      },
      services: {
        autoDetection: {
          isRunning: serviceStatus.isRunning,
          lastDetection: serviceStatus.lastDetection,
          companiesMonitored: serviceStatus.companies?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ [API] Error getting public system status:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الحصول على حالة النظام',
      error: error.message
    });
  }
});

/**
 * تحليل أنماط النجاح
 * GET /api/v1/success-learning/analyze-patterns
 */
router.get('/analyze-patterns', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const {
      timeRange = 30,
      minSampleSize = 10,
      patternTypes = 'word_usage,timing,response_style,emotional_tone'
    } = req.query;

    const patternTypesArray = patternTypes.split(',');

    //console.log(`🔍 [API] Analyzing success patterns for company: ${companyId}`);

    const result = await successAnalyzer.analyzeSuccessPatterns(companyId, {
      timeRange: parseInt(timeRange),
      minSampleSize: parseInt(minSampleSize),
      patternTypes: patternTypesArray
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'فشل في تحليل الأنماط',
        error: result.error
      });
    }

    // حفظ الأنماط المكتشفة
    const savedPatterns = [];
    for (const pattern of result.patterns) {
      try {
        const saved = await successAnalyzer.saveSuccessPattern(companyId, pattern);
        savedPatterns.push(saved);
      } catch (error) {
        console.error('❌ Error saving pattern:', error);
      }
    }

    res.json({
      success: true,
      message: 'تم تحليل الأنماط بنجاح',
      data: {
        patterns: result.patterns,
        savedPatterns: savedPatterns.length,
        metadata: result.metadata
      }
    });

  } catch (error) {
    console.error('❌ [API] Error analyzing patterns:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحليل الأنماط',
      error: error.message
    });
  }
});

/**
 * اكتشاف أنماط جديدة
 * GET /api/v1/success-learning/detect-patterns
 */
router.get('/detect-patterns', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const {
      timeRange = 7
    } = req.query;

    //console.log(`🔍 [API] Detecting new patterns for company: ${companyId}`);

    const result = await patternDetector.detectNewPatterns(companyId, parseInt(timeRange));

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'فشل في اكتشاف الأنماط',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'تم اكتشاف الأنماط بنجاح',
      data: result
    });

  } catch (error) {
    console.error('❌ [API] Error detecting patterns:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في اكتشاف الأنماط',
      error: error.message
    });
  }
});

/**
 * تسجيل نتيجة محادثة
 * POST /api/v1/success-learning/record-outcome
 */
router.post('/record-outcome', async (req, res) => {
  try {
    const outcomeData = req.body;

    //console.log(`📊 [API] Recording outcome for conversation: ${outcomeData.conversationId}`);

    const result = await outcomeTracker.recordConversationOutcome(outcomeData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'فشل في تسجيل النتيجة',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'تم تسجيل النتيجة بنجاح',
      data: result.outcome
    });

  } catch (error) {
    console.error('❌ [API] Error recording outcome:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تسجيل النتيجة',
      error: error.message
    });
  }
});

/**
 * الحصول على الأنماط المحفوظة مع دعم التصفح
 * GET /api/v1/success-learning/patterns
 */
router.get('/patterns', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const {
      patternType,
      isActive,
      isApproved,
      limit = 50,
      page = 1,
      sortBy = 'successRate',
      sortOrder = 'desc'
    } = req.query;

    const where = { companyId };
    if (patternType) where.patternType = patternType;
    if (isActive !== undefined && isActive !== '') where.isActive = isActive === 'true';
    if (isApproved !== undefined && isApproved !== '') where.isApproved = isApproved === 'true';

    // حساب التصفح
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(parseInt(limit), 100); // حد أقصى 100
    const skip = (pageNum - 1) * limitNum;

    // ترتيب النتائج
    const orderBy = {};
    if (sortBy === 'successRate') {
      orderBy.successRate = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'sampleSize') {
      orderBy.sampleSize = sortOrder;
    } else {
      orderBy.successRate = 'desc';
      orderBy.createdAt = 'desc';
    }

    // جلب الأنماط مع التصفح
    const [patterns, totalCount] = await Promise.all([
      prisma.successPattern.findMany({
        where,
        orderBy: Array.isArray(orderBy) ? orderBy : [orderBy, { createdAt: 'desc' }],
        skip,
        take: limitNum
      }),
      prisma.successPattern.count({ where })
    ]);

    // حساب معلومات التصفح
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    res.json({
      success: true,
      message: 'تم جلب الأنماط بنجاح',
      data: {
        patterns,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages,
          hasNext,
          hasPrev
        }
      }
    });

  } catch (error) {
    console.error('❌ [API] Error fetching patterns:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الأنماط',
      error: error.message
    });
  }
});

/**
 * الموافقة على نمط
 * PUT /api/v1/success-learning/patterns/:id/approve
 */
router.put('/patterns/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy = 'system' } = req.body;

    const pattern = await prisma.successPattern.update({
      where: { id },
      data: {
        isApproved: true,
        approvedBy,
        approvedAt: new Date()
      }
    });

    //console.log(`✅ [API] Pattern approved: ${id}`);

    res.json({
      success: true,
      message: 'تم الموافقة على النمط',
      data: pattern
    });

  } catch (error) {
    console.error('❌ [API] Error approving pattern:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الموافقة على النمط',
      error: error.message
    });
  }
});

/**
 * رفض نمط
 * PUT /api/v1/success-learning/patterns/:id/reject
 */
router.put('/patterns/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const pattern = await prisma.successPattern.update({
      where: { id },
      data: {
        isActive: false,
        isApproved: false
      }
    });

    //console.log(`❌ [API] Pattern rejected: ${id}`);

    res.json({
      success: true,
      message: 'تم رفض النمط',
      data: pattern
    });

  } catch (error) {
    console.error('❌ [API] Error rejecting pattern:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في رفض النمط',
      error: error.message
    });
  }
});

/**
 * إيقاف اعتماد نمط معتمد
 * PUT /api/v1/success-learning/patterns/:id/unapprove
 */
router.put('/patterns/:id/unapprove', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'تم إيقاف الاعتماد يدوياً' } = req.body;

    // التحقق من وجود النمط وأنه معتمد
    const existingPattern = await prisma.successPattern.findUnique({
      where: { id },
      select: { id: true, isApproved: true, description: true }
    });

    if (!existingPattern) {
      return res.status(404).json({
        success: false,
        message: 'النمط غير موجود'
      });
    }

    if (!existingPattern.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'النمط غير معتمد أصلاً'
      });
    }

    // إيقاف الاعتماد مع الاحتفاظ بالنشاط
    const pattern = await prisma.successPattern.update({
      where: { id },
      data: {
        isApproved: false,
        approvedBy: null,
        approvedAt: null,
        metadata: JSON.stringify({
          ...JSON.parse(existingPattern.metadata || '{}'),
          unapprovedAt: new Date().toISOString(),
          unapprovalReason: reason,
          previouslyApproved: true
        })
      }
    });

    //console.log(`⏸️ [API] Pattern approval revoked: ${id} - ${existingPattern.description.substring(0, 50)}...`);

    res.json({
      success: true,
      message: 'تم إيقاف اعتماد النمط',
      data: pattern
    });

  } catch (error) {
    console.error('❌ [API] Error unapproving pattern:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إيقاف اعتماد النمط',
      error: error.message
    });
  }
});

/**
 * حذف نمط نهائياً
 * DELETE /api/v1/success-learning/patterns/:id
 */
router.delete('/patterns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'تم الحذف يدوياً' } = req.body;

    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    // التحقق من وجود النمط وأنه ينتمي للشركة
    const existingPattern = await prisma.successPattern.findFirst({
      where: {
        id,
        companyId
      },
      select: {
        id: true,
        description: true,
        patternType: true,
        isApproved: true,
        isActive: true
      }
    });

    if (!existingPattern) {
      return res.status(404).json({
        success: false,
        message: 'النمط غير موجود أو لا تملك صلاحية حذفه'
      });
    }

    // حذف سجلات الاستخدام المرتبطة بالنمط أولاً
    const deletedUsageCount = // SECURITY WARNING: Ensure companyId filter is included
      await prisma.patternUsage.deleteMany({
      where: {
        patternId: id,
        companyId
      }
    });

    // حذف النمط نهائياً
    await prisma.successPattern.delete({
      where: { id }
    });

    //console.log(`🗑️ [API] Pattern deleted permanently: ${id} - ${existingPattern.description.substring(0, 50)}...`);
    //console.log(`🗑️ [API] Deleted ${deletedUsageCount.count} usage records for pattern: ${id}`);

    res.json({
      success: true,
      message: 'تم حذف النمط نهائياً',
      data: {
        deletedPattern: existingPattern,
        deletedUsageRecords: deletedUsageCount.count,
        reason
      }
    });

  } catch (error) {
    console.error('❌ [API] Error deleting pattern:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف النمط',
      error: error.message
    });
  }
});

/**
 * الحصول على إحصائيات النتائج
 * GET /api/v1/success-learning/outcome-stats
 */
router.get('/outcome-stats', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const {
      timeRange = 30
    } = req.query;

    // استخدام البيانات الفعلية من جدول الطلبات
    const EnhancedOrderService = require('../services/enhancedOrderService');
    const enhancedOrderService = new EnhancedOrderService();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // جلب الطلبات الفعلية
    const orders = await enhancedOrderService.prisma.order.findMany({
      where: {
        companyId,
        createdAt: { gte: startDate }
      },
      include: {
        conversation: true
      }
    });

    // جلب المحادثات النشطة
    const conversations = await enhancedOrderService.prisma.conversation.findMany({
      where: {
        companyId,
        createdAt: { gte: startDate }
      }
    });

    // حساب الإحصائيات الفعلية
    const stats = {
      total: conversations.length,
      purchase: orders.length,
      abandoned: Math.max(0, conversations.length - orders.length - Math.floor(conversations.length * 0.1)), // تقدير المهجورة
      escalated: 0, // لا توجد تصعيدات حالياً
      resolved: orders.length,
      pending: Math.floor(conversations.length * 0.1) // تقدير المعلقة
    };

    stats.conversionRate = stats.total > 0 ? (stats.purchase / stats.total * 100).toFixed(2) : "0.00";
    stats.totalValue = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);

    await enhancedOrderService.disconnect();

    res.json({
      success: true,
      message: 'تم جلب الإحصائيات بنجاح',
      data: stats
    });

  } catch (error) {
    console.error('❌ [API] Error fetching outcome stats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإحصائيات',
      error: error.message
    });
  }
});

/**
 * الحصول على فعالية الردود
 * GET /api/v1/success-learning/response-effectiveness
 */
router.get('/response-effectiveness', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const {
      conversationId,
      responseType,
      minEffectiveness = 0,
      limit = 100
    } = req.query;

    const where = { companyId };
    if (conversationId) where.conversationId = conversationId;
    if (responseType) where.responseType = responseType;
    if (minEffectiveness > 0) where.effectivenessScore = { gte: parseFloat(minEffectiveness) };

    const responses = await prisma.responseEffectiveness.findMany({
      where,
      orderBy: { effectivenessScore: 'desc' },
      take: parseInt(limit)
    });

    // حساب إحصائيات سريعة
    const stats = {
      total: responses.length,
      averageEffectiveness: responses.length > 0 
        ? (responses.reduce((sum, r) => sum + r.effectivenessScore, 0) / responses.length).toFixed(2)
        : 0,
      leadToPurchaseCount: responses.filter(r => r.leadToPurchase).length,
      conversionRate: responses.length > 0 
        ? ((responses.filter(r => r.leadToPurchase).length / responses.length) * 100).toFixed(2)
        : 0
    };

    res.json({
      success: true,
      message: 'تم جلب فعالية الردود بنجاح',
      data: {
        responses,
        stats
      }
    });

  } catch (error) {
    console.error('❌ [API] Error fetching response effectiveness:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب فعالية الردود',
      error: error.message
    });
  }
});

/**
 * تشغيل تحليل شامل
 * POST /api/v1/success-learning/run-analysis
 */
router.post('/run-analysis', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const {
      timeRange = 30
    } = req.body;

    //console.log(`🚀 [API] Running comprehensive analysis for company: ${companyId}`);

    // تشغيل التحليل الشامل
    const [patternsResult, detectionResult, outcomeStats] = await Promise.all([
      successAnalyzer.analyzeSuccessPatterns(companyId, { timeRange }),
      patternDetector.detectNewPatterns(companyId, Math.min(timeRange, 14)),
      outcomeTracker.getOutcomeStats(companyId, timeRange)
    ]);

    res.json({
      success: true,
      message: 'تم تشغيل التحليل الشامل بنجاح',
      data: {
        successPatterns: patternsResult,
        newPatterns: detectionResult,
        outcomeStats,
        analysisDate: new Date()
      }
    });

  } catch (error) {
    console.error('❌ [API] Error running comprehensive analysis:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تشغيل التحليل الشامل',
      error: error.message
    });
  }
});

/**
 * تصدير البيانات
 * GET /api/v1/success-learning/export
 */
router.get('/export', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const {
      format = 'csv',
      timeRange = 30
    } = req.query;

    //console.log(`📤 [API] Exporting data for company: ${companyId}, format: ${format}`);

    // جلب الأنماط
    const patterns = await prisma.successPattern.findMany({
      where: {
        companyId,
        createdAt: {
          gte: new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (format === 'csv') {
      // تحويل إلى CSV
      const csvHeader = 'ID,Pattern Type,Description,Success Rate,Sample Size,Confidence Level,Is Active,Is Approved,Created At\n';
      const csvRows = patterns.map(pattern =>
        `${pattern.id},"${pattern.patternType}","${pattern.description}",${pattern.successRate},${pattern.sampleSize},${pattern.confidenceLevel},${pattern.isActive},${pattern.isApproved},"${pattern.createdAt}"`
      ).join('\n');

      const csvData = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="patterns-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } else {
      // تصدير JSON
      res.json({
        success: true,
        message: 'تم تصدير البيانات بنجاح',
        data: patterns
      });
    }

  } catch (error) {
    console.error('❌ [API] Error exporting data:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تصدير البيانات',
      error: error.message
    });
  }
});

/**
 * جلب إحصائيات أداء الأنماط
 * GET /api/v1/success-learning/pattern-performance
 */
router.get('/pattern-performance', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    //console.log(`📊 [API] Getting pattern performance for company: ${companyId}`);

    // جلب إحصائيات الأداء
    const performance = await prisma.patternPerformance.findMany({
      where: { companyId },
      include: {
        pattern: {
          select: {
            id: true,
            patternType: true,
            description: true,
            successRate: true,
            isActive: true,
            isApproved: true
          }
        }
      },
      orderBy: { currentSuccessRate: 'desc' }
    });

    // حساب إحصائيات إجمالية
    const totalPatterns = performance.length;
    const activePatterns = performance.filter(p => p.pattern.isActive && p.pattern.isApproved).length;
    const avgSuccessRate = performance.length > 0
      ? performance.reduce((sum, p) => sum + p.currentSuccessRate, 0) / performance.length
      : 0;
    const totalUsage = performance.reduce((sum, p) => sum + p.usageCount, 0);

    res.json({
      success: true,
      data: {
        performance,
        summary: {
          totalPatterns,
          activePatterns,
          avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
          totalUsage
        }
      }
    });

  } catch (error) {
    console.error('❌ [API] Error getting pattern performance:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات الأداء',
      error: error.message
    });
  }
});

/**
 * جلب إحصائيات استخدام الأنماط
 * GET /api/v1/success-learning/pattern-usage
 */
router.get('/pattern-usage', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const {
      patternId,
      days = 30
    } = req.query;

    //console.log(`📈 [API] Getting pattern usage stats for company: ${companyId}`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let whereClause = {
      companyId,
      createdAt: { gte: startDate }
    };

    if (patternId) {
      whereClause.patternId = patternId;
    }

    // جلب بيانات الاستخدام
    const usage = await prisma.patternUsage.findMany({
      where: whereClause,
      include: {
        pattern: {
          select: {
            id: true,
            patternType: true,
            description: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // تجميع البيانات حسب النمط
    const usageByPattern = usage.reduce((acc, u) => {
      const key = u.patternId;
      if (!acc[key]) {
        acc[key] = {
          patternId: u.patternId,
          patternType: u.pattern.patternType,
          description: u.pattern.description,
          totalUsage: 0,
          appliedUsage: 0,
          dailyUsage: {}
        };
      }

      acc[key].totalUsage++;
      if (u.applied) acc[key].appliedUsage++;

      const day = u.createdAt.toISOString().split('T')[0];
      acc[key].dailyUsage[day] = (acc[key].dailyUsage[day] || 0) + 1;

      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        usage: Object.values(usageByPattern),
        totalRecords: usage.length,
        dateRange: {
          from: startDate.toISOString(),
          to: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('❌ [API] Error getting pattern usage:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات الاستخدام',
      error: error.message
    });
  }
});

/**
 * اختبار نمط معين
 * POST /api/v1/success-learning/test-pattern
 */
router.post('/test-pattern', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const { patternId, testMessage } = req.body;

    if (!patternId || !testMessage) {
      return res.status(400).json({
        success: false,
        message: 'معرف النمط والرسالة التجريبية مطلوبان'
      });
    }

    // إصلاح encoding النص العربي
    //console.log('📝 [API] Original testMessage:', testMessage);
    const decodedMessage = decodeURIComponent(escape(testMessage));
    //console.log('🔧 [API] Decoded testMessage:', decodedMessage);

    //console.log(`🧪 [API] Testing pattern ${patternId} with message: ${testMessage.substring(0, 50)}...`);

    // جلب النمط
    const pattern = await prisma.successPattern.findUnique({
      where: { id: patternId }
    });

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'النمط غير موجود'
      });
    }

    // تطبيق النمط على الرسالة التجريبية مع timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Pattern application timeout')), 10000);
    });

    const patternPromise = patternApplication.applyAllPatterns(
      decodedMessage,  // استخدام النص المُصحح
      companyId,
      null // no conversation ID for testing
    );

    const optimizedMessage = await Promise.race([patternPromise, timeoutPromise]);

    // إعداد headers للنص العربي
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    res.json({
      success: true,
      data: {
        originalMessage: decodedMessage,  // استخدام النص المُصحح
        optimizedMessage,
        pattern: {
          id: pattern.id,
          type: pattern.patternType,
          description: pattern.description,
          successRate: pattern.successRate
        },
        improvement: {
          lengthChange: optimizedMessage.length - testMessage.length,
          wordsAdded: optimizedMessage.split(' ').length - testMessage.split(' ').length
        }
      }
    });

  } catch (error) {
    console.error('❌ [API] Error testing pattern:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في اختبار النمط',
      error: error.message
    });
  }
});

// تحليل أنماط جديدة
router.post('/analyze-patterns', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    //console.log(`🔍 [API] Analyzing new patterns for company: ${companyId}`);

    // استدعاء خدمة التعلم المستمر لاكتشاف أنماط جديدة
    const ContinuousLearningServiceV2 = require('../services/continuousLearningServiceV2');
    const learningService = new ContinuousLearningServiceV2();

    const result = await learningService.analyzeAndDiscoverPatterns(companyId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [API] Error analyzing new patterns:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحليل الأنماط الجديدة',
      error: error.message
    });
  }
});

// اعتماد نمط
router.post('/patterns/:patternId/approve', async (req, res) => {
  try {
    const { patternId } = req.params;

    //console.log(`✅ [API] Approving pattern: ${patternId}`);

    // تحديث النمط في قاعدة البيانات
    const updatedPattern = await prisma.successPattern.update({
      where: { id: patternId },
      data: {
        isApproved: true,
        isActive: true,
        approvedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: updatedPattern
    });

  } catch (error) {
    console.error('❌ [API] Error approving pattern:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في اعتماد النمط',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/success-learning/cleanup-patterns/:companyId
 * تنظيف الأنماط المكررة والمتشابهة
 */
router.post('/cleanup-patterns/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { dryRun = false } = req.body;

    //console.log(`🧹 [API] Starting pattern cleanup for company: ${companyId} (dryRun: ${dryRun})`);

    if (dryRun) {
      // فحص فقط بدون تنظيف
      const duplicateGroups = await patternCleanup.findDuplicatePatterns(companyId);
      const stats = await patternCleanup.getCleanupStats(companyId);

      res.json({
        success: true,
        dryRun: true,
        stats,
        duplicateGroups: duplicateGroups.length,
        potentialDeletions: duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0),
        message: `Found ${duplicateGroups.length} duplicate groups with ${duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0)} patterns that can be cleaned up`
      });
    } else {
      // تنظيف فعلي
      const result = await patternCleanup.cleanupDuplicatePatterns(companyId);

      if (result.success) {
        res.json({
          success: true,
          dryRun: false,
          ...result,
          message: `Successfully cleaned up ${result.patternsDeleted} duplicate patterns in ${result.timeTaken}ms`
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          message: 'Failed to cleanup patterns'
        });
      }
    }

  } catch (error) {
    console.error('❌ [API] Error in pattern cleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Internal server error during pattern cleanup'
    });
  }
});

/**
 * GET /api/v1/success-learning/cleanup-stats/:companyId
 * إحصائيات الأنماط والتكرارات
 */
router.get('/cleanup-stats/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    //console.log(`📊 [API] Getting cleanup stats for company: ${companyId}`);

    const stats = await patternCleanup.getCleanupStats(companyId);
    const duplicateGroups = await patternCleanup.findDuplicatePatterns(companyId);

    if (stats) {
      res.json({
        success: true,
        stats: {
          ...stats,
          duplicateGroups: duplicateGroups.length,
          potentialDeletions: duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0),
          duplicateDetails: duplicateGroups.map(group => ({
            count: group.length,
            type: group[0].patternType,
            successRate: group[0].successRate,
            sample: group[0].description.substring(0, 50) + '...'
          }))
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to get cleanup stats'
      });
    }

  } catch (error) {
    console.error('❌ [API] Error getting cleanup stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/success-learning/maintenance/status
 * حالة نظام الصيانة الدورية
 */
router.get('/maintenance/status', async (req, res) => {
  try {
    const stats = scheduledMaintenance.getStats();

    res.json({
      success: true,
      data: stats,
      message: 'Maintenance status retrieved successfully'
    });

  } catch (error) {
    console.error('❌ [API] Error getting maintenance status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/success-learning/maintenance/run
 * تشغيل صيانة فورية
 */
router.post('/maintenance/run', async (req, res) => {
  try {
    const { type = 'full' } = req.body;

    //console.log(`🔧 [API] Running immediate maintenance: ${type}`);

    await scheduledMaintenance.runImmediateMaintenance(type);

    res.json({
      success: true,
      message: `Immediate maintenance (${type}) completed successfully`,
      data: scheduledMaintenance.getStats()
    });

  } catch (error) {
    console.error('❌ [API] Error running immediate maintenance:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to run immediate maintenance'
    });
  }
});

/**
 * POST /api/v1/success-learning/maintenance/start
 * بدء نظام الصيانة الدورية
 */
router.post('/maintenance/start', async (req, res) => {
  try {
    scheduledMaintenance.start();

    res.json({
      success: true,
      message: 'Scheduled maintenance started successfully',
      data: {
        schedules: {
          weekly: 'Sundays at 2:00 AM',
          daily: 'Every day at 3:00 AM',
          monthly: '1st of month at 1:00 AM'
        }
      }
    });

  } catch (error) {
    console.error('❌ [API] Error starting scheduled maintenance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * تشغيل نظام إدارة الأنماط
 * POST /api/v1/success-learning/system/enable
 */
router.post('/system/enable', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    //console.log(`🚀 [API] Enabling pattern management system for company: ${companyId}`);

    // تفعيل جميع الأنماط المعتمدة
    const enabledPatterns = // SECURITY WARNING: Ensure companyId filter is included
      await prisma.successPattern.updateMany({
      where: {
        companyId,
        isApproved: true
      },
      data: { isActive: true }
    });

    // تسجيل حالة النظام
    const systemStatus = {
      enabled: true,
      enabledAt: new Date(),
      enabledBy: 'admin',
      patternsEnabled: enabledPatterns.count
    };

    // حفظ الحالة في metadata أو جدول منفصل
    await prisma.company.update({
      where: { id: companyId },
      data: {
        settings: JSON.stringify({
          patternSystemEnabled: true,
          lastSystemChange: new Date().toISOString(),
          systemChangeBy: req.user?.email || 'admin'
        })
      }
    });

    // إشعار خدمة الاكتشاف التلقائي
    try {
      const autoPatternService = require('../services/autoPatternDetectionService');
      await autoPatternService.enablePatternSystemForCompany(companyId);
      //console.log(`🔔 [API] Auto pattern service notified of system enable for company: ${companyId}`);
    } catch (serviceError) {
      console.warn(`⚠️ [API] Failed to notify auto pattern service:`, serviceError.message);
    }

    //console.log(`✅ [API] Pattern system enabled - ${enabledPatterns.count} patterns activated`);

    res.json({
      success: true,
      message: 'تم تفعيل نظام إدارة الأنماط بنجاح',
      data: {
        ...systemStatus,
        patternsAffected: enabledPatterns.count
      }
    });

  } catch (error) {
    console.error('❌ [API] Error enabling pattern system:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تفعيل نظام الأنماط',
      error: error.message
    });
  }
});

/**
 * إيقاف نظام إدارة الأنماط
 * POST /api/v1/success-learning/system/disable
 */
router.post('/system/disable', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const { reason = 'تم الإيقاف يدوياً' } = req.body;

    //console.log(`🛑 [API] Disabling pattern management system for company: ${companyId}`);

    // إيقاف جميع الأنماط
    const disabledPatterns = // SECURITY WARNING: Ensure companyId filter is included
      await prisma.successPattern.updateMany({
      where: { companyId },
      data: { isActive: false }
    });

    // التحقق من أن جميع الأنماط تم إيقافها فعلاً
    const stillActiveCount = await prisma.successPattern.count({
      where: {
        companyId,
        isActive: true
      }
    });

    if (stillActiveCount > 0) {
      console.warn(`⚠️ [API] تحذير: لا يزال هناك ${stillActiveCount} نمط نشط بعد الإيقاف!`);

      // محاولة إضافية لإيقاف الأنماط المتبقية
      // SECURITY WARNING: Ensure companyId filter is included
      await prisma.successPattern.updateMany({
        where: {
          companyId,
          isActive: true
        },
        data: { isActive: false }
      });

      //console.log(`🔧 [API] تم إيقاف ${stillActiveCount} نمط إضافي`);
    }

    // تسجيل حالة النظام
    const systemStatus = {
      enabled: false,
      disabledAt: new Date(),
      disabledBy: 'admin',
      reason: reason,
      patternsDisabled: disabledPatterns.count
    };

    // حفظ الحالة
    await prisma.company.update({
      where: { id: companyId },
      data: {
        settings: JSON.stringify({
          patternSystemEnabled: false,
          lastSystemChange: new Date().toISOString(),
          systemChangeBy: req.user?.email || 'admin',
          disableReason: reason
        })
      }
    });

    // إشعار خدمة الاكتشاف التلقائي
    try {
      const autoPatternService = require('../services/autoPatternDetectionService');
      await autoPatternService.disablePatternSystemForCompany(companyId);
      //console.log(`🔔 [API] Auto pattern service notified of system disable for company: ${companyId}`);
    } catch (serviceError) {
      console.warn(`⚠️ [API] Failed to notify auto pattern service:`, serviceError.message);
    }

    //console.log(`✅ [API] Pattern system disabled - ${disabledPatterns.count} patterns deactivated`);

    res.json({
      success: true,
      message: 'تم إيقاف نظام إدارة الأنماط بنجاح',
      data: {
        ...systemStatus,
        patternsAffected: disabledPatterns.count
      }
    });

  } catch (error) {
    console.error('❌ [API] Error disabling pattern system:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إيقاف نظام الأنماط',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/success-learning/system/companies-status
 * الحصول على حالة نظام الأنماط لجميع الشركات (للمدراء العامين)
 */
router.get('/system/companies-status', async (req, res) => {
  try {
    // التحقق من صلاحيات المدير العام
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول لهذه المعلومات'
      });
    }

    //console.log('📊 [API] Getting pattern system status for all companies');

    // جلب جميع الشركات مع إعداداتها
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        settings: true,
        createdAt: true
      }
    });

    const companiesStatus = [];

    for (const company of companies) {
      let systemSettings = {};
      try {
        systemSettings = company.settings ? JSON.parse(company.settings) : {};
      } catch (e) {
        systemSettings = {};
      }

      // عد الأنماط
      const patternsCount = await prisma.successPattern.count({
        where: { companyId: company.id }
      });

      const activePatternsCount = await prisma.successPattern.count({
        where: {
          companyId: company.id,
          isActive: true
        }
      });

      companiesStatus.push({
        companyId: company.id,
        companyName: company.name,
        systemEnabled: systemSettings.patternSystemEnabled !== false,
        totalPatterns: patternsCount,
        activePatterns: activePatternsCount,
        lastSystemChange: systemSettings.lastSystemChange,
        systemChangeBy: systemSettings.systemChangeBy,
        disableReason: systemSettings.disableReason
      });
    }

    res.json({
      success: true,
      data: {
        totalCompanies: companies.length,
        enabledCompanies: companiesStatus.filter(c => c.systemEnabled).length,
        disabledCompanies: companiesStatus.filter(c => !c.systemEnabled).length,
        companies: companiesStatus
      }
    });

  } catch (error) {
    console.error('❌ [API] Error getting companies pattern status:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب حالة الأنماط للشركات',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/success-learning/system/bulk-control
 * التحكم الجماعي في نظام الأنماط للشركات (للمدراء العامين)
 */
router.post('/system/bulk-control', async (req, res) => {
  try {
    // التحقق من صلاحيات المدير العام
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول لهذه المعلومات'
      });
    }

    const { action, companyIds, reason = 'تحكم جماعي' } = req.body;

    if (!action || !['enable', 'disable'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد العملية: enable أو disable'
      });
    }

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد معرفات الشركات'
      });
    }

    //console.log(`🔧 [API] Bulk ${action} pattern system for ${companyIds.length} companies`);

    const results = [];
    const autoPatternService = require('../services/autoPatternDetectionService');

    for (const companyId of companyIds) {
      try {
        if (action === 'enable') {
          // تفعيل الأنماط
          const enabledPatterns = // SECURITY WARNING: Ensure companyId filter is included
      await prisma.successPattern.updateMany({
            where: { companyId },
            data: { isActive: true }
          });

          // تحديث الإعدادات
          await prisma.company.update({
            where: { id: companyId },
            data: {
              settings: JSON.stringify({
                patternSystemEnabled: true,
                lastSystemChange: new Date().toISOString(),
                systemChangeBy: req.user?.email || 'super-admin',
                enableReason: reason
              })
            }
          });

          await autoPatternService.enablePatternSystemForCompany(companyId);

          results.push({
            companyId,
            success: true,
            action: 'enabled',
            patternsAffected: enabledPatterns.count
          });

        } else {
          // إيقاف الأنماط
          const disabledPatterns = // SECURITY WARNING: Ensure companyId filter is included
      await prisma.successPattern.updateMany({
            where: { companyId },
            data: { isActive: false }
          });

          // تحديث الإعدادات
          await prisma.company.update({
            where: { id: companyId },
            data: {
              settings: JSON.stringify({
                patternSystemEnabled: false,
                lastSystemChange: new Date().toISOString(),
                systemChangeBy: req.user?.email || 'super-admin',
                disableReason: reason
              })
            }
          });

          await autoPatternService.disablePatternSystemForCompany(companyId);

          results.push({
            companyId,
            success: true,
            action: 'disabled',
            patternsAffected: disabledPatterns.count
          });
        }

      } catch (error) {
        console.error(`❌ [API] Error ${action} pattern system for company ${companyId}:`, error);
        results.push({
          companyId,
          success: false,
          action: action,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `تم ${action === 'enable' ? 'تفعيل' : 'إيقاف'} النظام بنجاح`,
      data: {
        totalProcessed: companyIds.length,
        successful: successCount,
        failed: failureCount,
        results
      }
    });

  } catch (error) {
    console.error('❌ [API] Error in bulk pattern system control:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في التحكم الجماعي بنظام الأنماط',
      error: error.message
    });
  }
});

/**
 * الحصول على حالة نظام إدارة الأنماط
 * GET /api/v1/success-learning/system/status
 */
router.get('/system/status', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    //console.log(`📊 [API] Getting pattern system status for company: ${companyId}`);

    // جلب معلومات الشركة
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true }
    });

    let systemSettings = {};
    try {
      systemSettings = company?.settings ? JSON.parse(company.settings) : {};
    } catch (e) {
      systemSettings = {};
    }

    // إحصائيات الأنماط
    const totalPatterns = await prisma.successPattern.count({
      where: { companyId }
    });

    const activePatterns = await prisma.successPattern.count({
      where: {
        companyId,
        isActive: true
      }
    });

    const approvedPatterns = await prisma.successPattern.count({
      where: {
        companyId,
        isApproved: true
      }
    });

    const systemStatus = {
      enabled: systemSettings.patternSystemEnabled !== false, // افتراضياً مفعل
      totalPatterns,
      activePatterns,
      approvedPatterns,
      inactivePatterns: totalPatterns - activePatterns,
      lastChange: systemSettings.lastSystemChange || null,
      changedBy: systemSettings.systemChangeBy || null,
      disableReason: systemSettings.disableReason || null
    };

    res.json({
      success: true,
      message: 'تم جلب حالة النظام بنجاح',
      data: systemStatus
    });

  } catch (error) {
    console.error('❌ [API] Error getting system status:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب حالة النظام',
      error: error.message
    });
  }
});

/**
 * تنظيف الأنماط المكررة
 * POST /api/v1/success-learning/cleanup-patterns
 */
router.post('/cleanup-patterns', async (req, res) => {
  try {
    // استخدام companyId من المستخدم المصادق عليه
    const companyId = req.user?.companyId || req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشركة مطلوب'
      });
    }

    const { dryRun = false } = req.body;

    //console.log(`🧹 [API] Cleaning up duplicate patterns for company: ${companyId}`);

    // استخدام خدمة تنظيف الأنماط المتخصصة
    let result;

    if (dryRun) {
      // في حالة الفحص فقط، نحصل على الإحصائيات
      const stats = await patternCleanup.getCleanupStats(companyId);
      result = {
        success: true,
        duplicateGroupsFound: stats?.potentialDuplicates || 0,
        patternsProcessed: 0,
        patternsDeleted: 0,
        patternsMerged: 0,
        dryRun: true
      };
    } else {
      // تنظيف فعلي
      result = await patternCleanup.cleanupDuplicatePatterns(companyId);
    }

    res.json({
      success: result.success,
      message: dryRun ? 'تم فحص الأنماط المكررة' : 'تم تنظيف الأنماط المكررة بنجاح',
      data: {
        duplicateGroups: result.duplicateGroupsFound || 0,
        patternsDeleted: result.patternsDeleted || 0,
        patternsMerged: result.patternsMerged || 0,
        patternsProcessed: result.patternsProcessed || 0,
        timeTaken: result.timeTaken || 0,
        dryRun,
        error: result.error || null
      }
    });

  } catch (error) {
    console.error('❌ [API] Error cleaning up patterns:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تنظيف الأنماط',
      error: error.message
    });
  }
});

module.exports = router;

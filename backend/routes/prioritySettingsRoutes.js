/**
 * مسارات إعدادات الأولوية
 * Priority Settings Routes
 */

const express = require('express');
const { getSharedPrismaClient } = require('../services/sharedDatabase');
const { requireAuth } = require('../middleware/auth');
const ConflictDetectionService = require('../services/conflictDetectionService');

const router = express.Router();
const prisma = getSharedPrismaClient();
const conflictDetector = new ConflictDetectionService();

/**
 * GET /api/v1/priority-settings/:companyId
 * الحصول على إعدادات الأولوية للشركة
 */
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    //console.log(`📊 [API] Getting priority settings for company: ${companyId}`);
    
    const aiSettings = await prisma.aiSettings.findFirst({
      where: { companyId }
    });
    
    if (!aiSettings) {
      return res.status(404).json({
        success: false,
        error: 'Company AI settings not found'
      });
    }
    
    const prioritySettings = {
      promptPriority: aiSettings.promptPriority || 'high',
      patternsPriority: aiSettings.patternsPriority || 'medium',
      conflictResolution: aiSettings.conflictResolution || 'merge_smart',
      enforcePersonality: aiSettings.enforcePersonality !== false,
      enforceLanguageStyle: aiSettings.enforceLanguageStyle !== false,
      autoDetectConflicts: aiSettings.autoDetectConflicts !== false,
      conflictReports: aiSettings.conflictReports !== false
    };
    
    res.json({
      success: true,
      data: prioritySettings
    });
    
  } catch (error) {
    console.error('❌ [API] Error getting priority settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get priority settings'
    });
  }
});

/**
 * PUT /api/v1/priority-settings/:companyId
 * تحديث إعدادات الأولوية للشركة
 */
router.put('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      promptPriority,
      patternsPriority,
      conflictResolution,
      enforcePersonality,
      enforceLanguageStyle,
      autoDetectConflicts,
      conflictReports
    } = req.body;
    
    //console.log(`💾 [API] Updating priority settings for company: ${companyId}`);
    
    // التحقق من صحة القيم
    const validPromptPriorities = ['high', 'medium', 'low'];
    const validPatternsPriorities = ['high', 'medium', 'low'];
    const validConflictResolutions = ['prompt_wins', 'patterns_win', 'merge_smart'];
    
    if (promptPriority && !validPromptPriorities.includes(promptPriority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid promptPriority value'
      });
    }
    
    if (patternsPriority && !validPatternsPriorities.includes(patternsPriority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid patternsPriority value'
      });
    }
    
    if (conflictResolution && !validConflictResolutions.includes(conflictResolution)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conflictResolution value'
      });
    }
    
    // تحديث الإعدادات
    const updatedSettings = await prisma.aiSettings.update({
      where: { companyId },
      data: {
        promptPriority: promptPriority || undefined,
        patternsPriority: patternsPriority || undefined,
        conflictResolution: conflictResolution || undefined,
        enforcePersonality: enforcePersonality !== undefined ? enforcePersonality : undefined,
        enforceLanguageStyle: enforceLanguageStyle !== undefined ? enforceLanguageStyle : undefined,
        autoDetectConflicts: autoDetectConflicts !== undefined ? autoDetectConflicts : undefined,
        conflictReports: conflictReports !== undefined ? conflictReports : undefined,
        updatedAt: new Date()
      }
    });
    
    //console.log('✅ [API] Priority settings updated successfully');
    
    res.json({
      success: true,
      data: {
        promptPriority: updatedSettings.promptPriority,
        patternsPriority: updatedSettings.patternsPriority,
        conflictResolution: updatedSettings.conflictResolution,
        enforcePersonality: updatedSettings.enforcePersonality,
        enforceLanguageStyle: updatedSettings.enforceLanguageStyle,
        autoDetectConflicts: updatedSettings.autoDetectConflicts,
        conflictReports: updatedSettings.conflictReports
      },
      message: 'Priority settings updated successfully'
    });
    
  } catch (error) {
    console.error('❌ [API] Error updating priority settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update priority settings'
    });
  }
});

/**
 * POST /api/v1/priority-settings/:companyId/test-conflict
 * اختبار كشف التعارض
 */
router.post('/:companyId/test-conflict', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { prompt, patterns } = req.body;
    
    //console.log(`🧪 [API] Testing conflict detection for company: ${companyId}`);
    
    if (!prompt || !patterns) {
      return res.status(400).json({
        success: false,
        error: 'Prompt and patterns are required'
      });
    }
    
    // تشغيل كشف التعارض
    const conflicts = await conflictDetector.detectAllConflicts(prompt, patterns, companyId);
    
    res.json({
      success: true,
      data: {
        hasConflicts: conflicts.hasConflicts,
        conflictsCount: conflicts.conflicts.length,
        severity: conflicts.severity,
        conflicts: conflicts.conflicts,
        recommendations: conflicts.recommendations
      },
      message: conflicts.hasConflicts 
        ? `تم اكتشاف ${conflicts.conflicts.length} تعارض`
        : 'لا يوجد تعارض'
    });
    
  } catch (error) {
    console.error('❌ [API] Error testing conflict detection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test conflict detection'
    });
  }
});

/**
 * GET /api/v1/priority-settings/:companyId/conflict-reports
 * الحصول على تقارير التعارض
 */
router.get('/:companyId/conflict-reports', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10, severity, resolved } = req.query;
    
    //console.log(`📊 [API] Getting conflict reports for company: ${companyId}`);
    
    const whereClause = { companyId };
    
    if (severity) {
      whereClause.severity = severity;
    }
    
    if (resolved !== undefined) {
      whereClause.resolved = resolved === 'true';
    }
    
    const reports = await prisma.conflictReports.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });
    
    const totalReports = await prisma.conflictReports.count({
      where: whereClause
    });
    
    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalReports,
          pages: Math.ceil(totalReports / parseInt(limit))
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [API] Error getting conflict reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conflict reports'
    });
  }
});

/**
 * PUT /api/v1/priority-settings/:companyId/conflict-reports/:reportId/resolve
 * حل تقرير تعارض
 */
router.put('/:companyId/conflict-reports/:reportId/resolve', async (req, res) => {
  try {
    const { companyId, reportId } = req.params;
    const { resolutionResult } = req.body;
    
    //console.log(`✅ [API] Resolving conflict report: ${reportId}`);
    
    const updatedReport = await prisma.conflictReports.update({
      where: { 
        id: reportId,
        companyId 
      },
      data: {
        resolved: true,
        resolutionResult: resolutionResult || 'تم حل التعارض',
        updatedAt: new Date()
      }
    });
    
    res.json({
      success: true,
      data: updatedReport,
      message: 'Conflict report resolved successfully'
    });
    
  } catch (error) {
    console.error('❌ [API] Error resolving conflict report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve conflict report'
    });
  }
});

module.exports = router;

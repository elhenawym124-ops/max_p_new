const processedMessages = new Map();
const aiAgentService = require('../services/aiAgentService');
const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('../services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
const getDebugInfo = async(req, res) => {
  try {
    const queueStats = messageQueueManager.getQueueStats();
    const processedMessagesStats = {
      totalProcessedMessages: processedMessages.size,
      oldestMessage: Math.min(...Array.from(processedMessages.values())),
      newestMessage: Math.max(...Array.from(processedMessages.values()))
    };

    res.json({
      success: true,
      data: {
        queues: queueStats,
        processedMessages: processedMessagesStats,
        timestamp: new Date().toISOString()
      },
      message: 'حالة طوابير الرسائل'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'خطأ في جلب حالة الطوابير'
    });
  }
}

const getDebugAiErrors =async (req, res) => {
  try {
    const { companyId } = req.query;

    const errorStats = aiAgentService.errorHandler.getErrorStats(companyId);

    res.json({
      success: true,
      data: {
        ...errorStats,
        timestamp: new Date().toISOString(),
        companyFilter: companyId || 'all'
      },
      message: 'إحصائيات أخطاء الذكاء الاصطناعي'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'خطأ في جلب إحصائيات الأخطاء'
    });
  }
}

const postResetAiErrors = async(req, res) => {
  try {
    const { companyId } = req.body;

    aiAgentService.errorHandler.resetErrorStats(companyId);

    res.json({
      success: true,
      data: {
        resetTimestamp: new Date().toISOString(),
        companyFilter: companyId || 'all'
      },
      message: 'تم إعادة تعيين إحصائيات الأخطاء'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'خطأ في إعادة تعيين الإحصائيات'
    });
  }
}

const getDebugDataBase = async (req, res) => {
  try {
    const stats = {
      customers: await getSharedPrismaClient().customer.count(),
      conversations: await getSharedPrismaClient().conversation.count(),
      messages: await getSharedPrismaClient().message.count(),
      products: await getSharedPrismaClient().product.count(),
      facebookPages: await getSharedPrismaClient().facebookPage.count(),
      companies: await getSharedPrismaClient().company.count()
    };

    const facebookPages = await getSharedPrismaClient().facebookPage.findMany({
      select: {
        id: true,
        pageId: true,
        pageName: true,
        status: true,
        companyId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const companies = await getSharedPrismaClient().company.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: {
        stats,
        facebookPages,
        companies,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Database debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = { getDebugInfo, getDebugAiErrors, postResetAiErrors , getDebugDataBase };

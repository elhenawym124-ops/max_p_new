/**
 * خدمة الاكتشاف التلقائي للأنماط
 * Auto Pattern Detection Service
 */

const PatternDetector = require('./patternDetector');
const { getSharedPrismaClient, safeQuery } = require('./sharedDatabase');

class AutoPatternDetectionService {
  constructor() {
    this.detector = new PatternDetector();
    this.isRunning = false;
    this.intervalId = null;
    this.detectionInterval = 6 * 60 * 60 * 1000; // كل 6 ساعات (reduced from 2 hours)
    this.lastDetection = null;
    this.companies = []; // سيتم تحميل الشركات من قاعدة البيانات
    
    //console.log('🤖 [AutoPatternService] Service initialized');
  }

  /**
   * Get Prisma client instance
   */
  getPrisma() {
    return getSharedPrismaClient();
  }

  /**
   * تحميل الشركات من قاعدة البيانات
   */
  async loadCompanies() {
    try {
      const companies = await safeQuery(async () => {
        const prisma = this.getPrisma();
        return await prisma.company.findMany({
          select: { id: true, name: true }
        });
      }, 5); // Priority 5

      this.companies = companies.map(c => c.id);
      //console.log(`🏢 [AutoPatternService] Loaded ${this.companies.length} companies for pattern detection`);

      return this.companies;
    } catch (error) {
      console.error('❌ [AutoPatternService] Error loading companies:', error);
      return [];
    }
  }

  /**
   * بدء الخدمة التلقائية
   */
  async start() {
    if (this.isRunning) {
      //console.log('⚠️ [AutoPatternService] Service is already running');
      return;
    }

    //console.log('🚀 [AutoPatternService] Starting automatic pattern detection service...');
    //console.log(`⏰ [AutoPatternService] Detection interval: ${this.detectionInterval / 1000 / 60} minutes`);

    // تحميل الشركات أولاً
    await this.loadCompanies();

    this.isRunning = true;

    // تشغيل فوري بعد 30 ثانية من بدء الخادم
    setTimeout(() => {
      this.runDetectionCycle();
    }, 30000);

    // جدولة التشغيل التلقائي
    this.intervalId = setInterval(() => {
      this.runDetectionCycle();
    }, this.detectionInterval);

    //console.log('✅ [AutoPatternService] Service started successfully');
  }

  /**
   * إيقاف الخدمة
   */
  stop() {
    if (!this.isRunning) {
      //console.log('⚠️ [AutoPatternService] Service is not running');
      return;
    }

    //console.log('🛑 [AutoPatternService] Stopping service...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    //console.log('✅ [AutoPatternService] Service stopped');
  }

  /**
   * تشغيل دورة اكتشاف كاملة
   */
  async runDetectionCycle() {
    const startTime = new Date();
    //console.log(`\n🔍 [AutoPatternService] Starting detection cycle at ${startTime.toLocaleString('ar-EG')}`);

    let totalNewPatterns = 0;
    const results = [];

    for (const companyId of this.companies) {
      try {
        //console.log(`📊 [AutoPatternService] Processing company: ${companyId}`);
        
        const result = await this.detectPatternsForCompany(companyId);
        results.push({ companyId, ...result });
        
        if (result.success && result.newPatterns > 0) {
          totalNewPatterns += result.newPatterns;
          //console.log(`🎉 [AutoPatternService] Found ${result.newPatterns} new patterns for ${companyId}`);
        }

      } catch (error) {
        console.error(`❌ [AutoPatternService] Error processing company ${companyId}:`, error.message);
        results.push({ companyId, success: false, error: error.message });
      }
    }

    const endTime = new Date();
    const duration = endTime - startTime;

    //console.log(`⏱️ [AutoPatternService] Detection cycle completed in ${duration}ms`);
    //console.log(`📊 [AutoPatternService] Total new patterns: ${totalNewPatterns}`);

    // حفظ نتائج الدورة
    this.lastDetection = {
      timestamp: endTime,
      duration: duration,
      totalNewPatterns: totalNewPatterns,
      results: results
    };

    // إشعار إذا تم اكتشاف أنماط جديدة
    if (totalNewPatterns > 0) {
      await this.notifyNewPatterns(totalNewPatterns, results);
    }

    // تنظيف الذاكرة
    await this.cleanup();
  }

  /**
   * اكتشاف الأنماط لشركة محددة
   */
  async detectPatternsForCompany(companyId) {
    try {
      //console.log(`📊 [AutoPatternService] Processing company: ${companyId}`);

      // فحص إعدادات الشركة أولاً
      const isEnabled = await this.isPatternSystemEnabledForCompany(companyId);
      if (!isEnabled) {
        //console.log(`⏸️ [AutoPatternService] Pattern system disabled for company: ${companyId}`);
        return {
          companyId,
          success: true,
          newPatterns: 0,
          timeRange: 0,
          skipped: true,
          reason: 'Pattern system disabled for this company'
        };
      }

      // فحص آخر مرة تم اكتشاف أنماط فيها
      const lastPattern = await safeQuery(async () => {
        const prisma = this.getPrisma();
        return await prisma.successPattern.findFirst({
          where: { companyId },
          orderBy: { createdAt: 'desc' }
        });
      }, 3);

      // تحديد المدة الزمنية للبحث
      let timeRange = 7; // أسبوع افتراضي
      if (lastPattern) {
        const daysSinceLastPattern = Math.floor(
          (Date.now() - new Date(lastPattern.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        timeRange = Math.min(Math.max(daysSinceLastPattern, 3), 30); // بين 3 و 30 يوم
      }

      //console.log(`📅 [AutoPatternService] Searching patterns for last ${timeRange} days`);

      // اكتشاف الأنماط
      const result = await this.detector.detectNewPatterns(companyId, timeRange);

      return {
        companyId,
        success: result.success,
        newPatterns: result.patterns?.length || 0,
        timeRange: timeRange,
        message: result.message
      };

    } catch (error) {
      console.error(`❌ [AutoPatternService] Error detecting patterns for ${companyId}:`, error.message);
      return {
        companyId,
        success: false,
        newPatterns: 0,
        error: error.message,
        timeRange: 0
      };
    }
  }

  /**
   * فحص ما إذا كان نظام الأنماط مفعل للشركة
   */
  async isPatternSystemEnabledForCompany(companyId) {
    try {
      // جلب إعدادات الشركة
      const company = await safeQuery(async () => {
        const prisma = this.getPrisma();
        return await prisma.company.findUnique({
          where: { id: companyId },
          select: { settings: true }
        });
      }, 3); // Priority 3

      if (!company) {
        //console.log(`⚠️ [AutoPatternService] Company ${companyId} not found`);
        return false;
      }

      // فحص الإعدادات
      let systemSettings = {};
      try {
        systemSettings = company.settings ? JSON.parse(company.settings) : {};
      } catch (e) {
        //console.log(`⚠️ [AutoPatternService] Error parsing settings for company ${companyId}`);
        systemSettings = {};
      }

      // افتراضياً النظام مفعل إذا لم تكن هناك إعدادات
      const isEnabled = systemSettings.patternSystemEnabled !== false;

      //console.log(`🔍 [AutoPatternService] Pattern system for company ${companyId}: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);

      return isEnabled;
    } catch (error) {
      console.error(`❌ [AutoPatternService] Error checking pattern system status for company ${companyId}:`, error.message);
      // في حالة الخطأ، افتراضياً النظام مفعل
      return true;
    }
  }

  /**
   * إشعار بالأنماط الجديدة
   */
  async notifyNewPatterns(totalPatterns, results) {
    //console.log(`\n📢 [AutoPatternService] NOTIFICATION: ${totalPatterns} new patterns detected!`);

    try {
      // حفظ الإشعار في قاعدة البيانات
      await this.saveNotification({
        type: 'new_patterns_detected',
        title: `تم اكتشاف ${totalPatterns} نمط جديد`,
        message: `تم اكتشاف ${totalPatterns} نمط جديد تلقائياً. يرجى مراجعتها والموافقة عليها.`,
        data: {
          totalPatterns,
          results,
          timestamp: new Date().toISOString()
        }
      });

      //console.log('✅ [AutoPatternService] Notification saved to database');
      //console.log('🔗 [AutoPatternService] Check patterns at: https://www.mokhtarelhenawy.online/pattern-management');

    } catch (error) {
      console.error('❌ [AutoPatternService] Error saving notification:', error.message);
    }
  }

  /**
   * حفظ الإشعار في قاعدة البيانات
   */
  async saveNotification(notification) {
    try {
      // يمكن إنشاء جدول notifications إذا لم يكن موجود
      // أو استخدام جدول موجود لحفظ الإشعارات
      
      //console.log('📝 [AutoPatternService] Notification details:');
      //console.log(`   📋 Title: ${notification.title}`);
      //console.log(`   💬 Message: ${notification.message}`);
      //console.log(`   📊 Total patterns: ${notification.data.totalPatterns}`);
      
      // يمكن إضافة كود حفظ الإشعار هنا
      // await this.prisma.notification.create({ data: notification });
      
    } catch (error) {
      console.error('❌ [AutoPatternService] Error in saveNotification:', error.message);
    }
  }

  /**
   * تنظيف الذاكرة
   */
  async cleanup() {
    try {
      // تنظيف cache الأنماط القديمة
      if (this.detector.patternCache) {
        this.detector.patternCache.clear();
      }
      
      // يمكن إضافة تنظيفات أخرى هنا
      
    } catch (error) {
      console.error('❌ [AutoPatternService] Error during cleanup:', error.message);
    }
  }

  /**
   * الحصول على حالة الخدمة
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      detectionInterval: this.detectionInterval,
      intervalMinutes: this.detectionInterval / 1000 / 60,
      companies: this.companies,
      lastDetection: this.lastDetection,
      nextDetection: this.isRunning && this.lastDetection ? 
        new Date(this.lastDetection.timestamp.getTime() + this.detectionInterval) : null
    };
  }

  /**
   * تغيير فترة الاكتشاف
   */
  setDetectionInterval(minutes) {
    const newInterval = minutes * 60 * 1000;
    
    //console.log(`⏰ [AutoPatternService] Changing detection interval to ${minutes} minutes`);
    
    this.detectionInterval = newInterval;
    
    if (this.isRunning) {
      //console.log('🔄 [AutoPatternService] Restarting service with new interval...');
      this.stop();
      this.start();
    }
  }

  /**
   * إضافة شركة للمراقبة
   */
  addCompany(companyId) {
    if (!this.companies.includes(companyId)) {
      this.companies.push(companyId);
      //console.log(`✅ [AutoPatternService] Added company ${companyId} to monitoring`);
    }
  }

  /**
   * إزالة شركة من المراقبة
   */
  removeCompany(companyId) {
    const index = this.companies.indexOf(companyId);
    if (index > -1) {
      this.companies.splice(index, 1);
      //console.log(`✅ [AutoPatternService] Removed company ${companyId} from monitoring`);
    }
  }

  /**
   * تشغيل اكتشاف فوري
   */
  async runImmediateDetection(companyId = null) {
    //console.log('⚡ [AutoPatternService] Running immediate detection...');

    if (companyId) {
      return await this.detectPatternsForCompany(companyId);
    } else {
      await this.runDetectionCycle();
      return this.lastDetection;
    }
  }

  /**
   * تفعيل نظام الأنماط لشركة معينة
   */
  async enablePatternSystemForCompany(companyId) {
    try {
      //console.log(`🟢 [AutoPatternService] Enabling pattern system for company: ${companyId}`);

      // جلب الإعدادات الحالية
      const company = await safeQuery(async () => {
        const prisma = this.getPrisma();
        return await prisma.company.findUnique({
          where: { id: companyId },
          select: { settings: true }
        });
      }, 3);

      let currentSettings = {};
      try {
        currentSettings = company?.settings ? JSON.parse(company.settings) : {};
      } catch (e) {
        currentSettings = {};
      }

      // تحديث الإعدادات
      const updatedSettings = {
        ...currentSettings,
        patternSystemEnabled: true,
        lastSystemChange: new Date().toISOString(),
        systemChangeBy: 'auto-service'
      };

      // حفظ الإعدادات
      await safeQuery(async () => {
        const prisma = this.getPrisma();
        return await prisma.company.update({
          where: { id: companyId },
          data: {
            settings: JSON.stringify(updatedSettings)
          }
        });
      }, 5);

      //console.log(`✅ [AutoPatternService] Pattern system enabled for company: ${companyId}`);
      return true;
    } catch (error) {
      console.error(`❌ [AutoPatternService] Error enabling pattern system for company ${companyId}:`, error.message);
      return false;
    }
  }

  /**
   * إيقاف نظام الأنماط لشركة معينة
   */
  async disablePatternSystemForCompany(companyId) {
    try {
      //console.log(`🔴 [AutoPatternService] Disabling pattern system for company: ${companyId}`);

      // جلب الإعدادات الحالية
      const company = await safeQuery(async () => {
        const prisma = this.getPrisma();
        return await prisma.company.findUnique({
          where: { id: companyId },
          select: { settings: true }
        });
      }, 3);

      let currentSettings = {};
      try {
        currentSettings = company?.settings ? JSON.parse(company.settings) : {};
      } catch (e) {
        currentSettings = {};
      }

      // تحديث الإعدادات
      const updatedSettings = {
        ...currentSettings,
        patternSystemEnabled: false,
        lastSystemChange: new Date().toISOString(),
        systemChangeBy: 'auto-service'
      };

      // حفظ الإعدادات
      await safeQuery(async () => {
        const prisma = this.getPrisma();
        return await prisma.company.update({
          where: { id: companyId },
          data: {
            settings: JSON.stringify(updatedSettings)
          }
        });
      }, 5);

      //console.log(`✅ [AutoPatternService] Pattern system disabled for company: ${companyId}`);
      return true;
    } catch (error) {
      console.error(`❌ [AutoPatternService] Error disabling pattern system for company ${companyId}:`, error.message);
      return false;
    }
  }

  /**
   * الحصول على قائمة الشركات المفعلة
   */
  async getEnabledCompanies() {
    try {
      const enabledCompanies = [];

      for (const companyId of this.companies) {
        const isEnabled = await this.isPatternSystemEnabledForCompany(companyId);
        if (isEnabled) {
          enabledCompanies.push(companyId);
        }
      }

      //console.log(`📊 [AutoPatternService] Found ${enabledCompanies.length}/${this.companies.length} enabled companies`);
      return enabledCompanies;
    } catch (error) {
      console.error(`❌ [AutoPatternService] Error getting enabled companies:`, error.message);
      return this.companies; // في حالة الخطأ، ارجع جميع الشركات
    }
  }
}

// إنشاء instance واحد للخدمة
const autoPatternService = new AutoPatternDetectionService();

module.exports = autoPatternService;

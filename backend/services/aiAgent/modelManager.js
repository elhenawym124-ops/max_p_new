/**
 * Model Manager Module
 * 
 * هذا الـ module يحتوي على منطق إدارة نماذج Gemini:
 * 1. getActiveGeminiKey - الحصول على المفتاح النشط
 * 2. findNextAvailableModel - البحث عن نموذج احتياطي
 * 3. إدارة النماذج والتبديل بينها
 * 
 * ✅ تحويل من singleton إلى class مع lazy initialization
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class ModelManager {
  constructor(aiAgentService) {
    this.aiAgentService = aiAgentService;
    this.prisma = getSharedPrismaClient();
    this.exhaustedModelsCache = new Set(); // ذاكرة مؤقتة للنماذج المستنفدة
    this.currentActiveModel = null; // النموذج النشط الحالي للجلسة
  }

  /**
   * الحصول على القيم الافتراضية الصحيحة للنموذج
   */
  getModelDefaults(modelName) {
    const defaults = {
      // نماذج Pro
      'gemini-3-pro': { limit: 50000, rpm: 2, rph: 120, rpd: 50 },
      'gemini-2.5-pro': { limit: 50000, rpm: 2, rph: 120, rpd: 50 },
      'gemini-1.5-pro': { limit: 50, rpm: 2, rph: 120, rpd: 50 },
      
      // نماذج Flash
      'gemini-2.5-flash': { limit: 250000, rpm: 10, rph: 600, rpd: 250 },
      'gemini-2.5-flash-lite': { limit: 1000000, rpm: 15, rph: 900, rpd: 1000 },
      'gemini-1.5-flash': { limit: 1500, rpm: 15, rph: 900, rpd: 1500 },
      'gemini-2.0-flash': { limit: 200000, rpm: 15, rph: 900, rpd: 200 },
      'gemini-2.0-flash-lite': { limit: 200000, rpm: 30, rph: 1800, rpd: 200 },
      
      // نماذج Live API
      'gemini-2.5-flash-live': { limit: 1000000, rpm: 15, rph: 900, rpd: 1000 },
      'gemini-2.0-flash-live': { limit: 1000000, rpm: 15, rph: 900, rpd: 200 },
      'gemini-2.5-flash-native-audio-dialog': { limit: 1000000, rpm: 15, rph: 900, rpd: 1000 },
      
      // نماذج الصوت
      'gemini-2.5-flash-tts': { limit: 15, rpm: 3, rph: 180, rpd: 15 },
      
      // نماذج متخصصة
      'gemini-robotics-er-1.5-preview': { limit: 250000, rpm: 15, rph: 900, rpd: 250 },
      'learnlm-2.0-flash-experimental': { limit: 1500000, rpm: 30, rph: 1800, rpd: 1500 },
      
      // نماذج Gemma
      'gemma-3-27b': { limit: 14400, rpm: 10, rph: 600, rpd: 14400 },
      'gemma-3-12b': { limit: 14400, rpm: 10, rph: 600, rpd: 14400 },
      'gemma-3-4b': { limit: 14400, rpm: 10, rph: 600, rpd: 14400 },
      'gemma-3-2b': { limit: 14400, rpm: 10, rph: 600, rpd: 14400 }
    };
    
    return defaults[modelName] || { limit: 1000000, rpm: 15, rph: 900, rpd: 1000 };
  }

  /**
   * الحصول على مفتاح Gemini نشط للشركة
   * ✅ نقل من aiAgentService.js
   * @param {string} companyId - معرف الشركة
   * @returns {Promise<Object|null>} - المفتاح النشط أو null
   */
  async getActiveGeminiKey(companyId) {
    try {
      if (!companyId) {
        console.error('❌ [SECURITY] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      // البحث عن المفتاح النشط للشركة المحددة
      const activeKey = await this.prisma.geminiKey.findFirst({
        where: {
          isActive: true,
          companyId: companyId
        },
        orderBy: { priority: 'asc' }
      });

      if (!activeKey) {
        console.error(`❌ لم يتم العثور على مفتاح نشط للشركة: ${companyId}`);
        return null;
      }

      return activeKey;

    } catch (error) {
      console.error('❌ [MODEL-MANAGER] Error getting active Gemini key:', error);
      return null;
    }
  }

  /**
   * Get active Gemini API key using new multi-key system with company isolation
   * ✅ نقل من aiAgentService.js
   */
  async getActiveGeminiKeyWithModel(companyId) {
    try {
      // ⚠️ IMPORTANT: لا نستدعي this.aiAgentService.getActiveGeminiKey هنا لتجنب حلقة لا نهائية
      // بدلاً من ذلك، نستخدم الكود مباشرة من aiAgentService.js
      
      if (!companyId) {
        console.error('❌ [MODEL-MANAGER] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      // 1. التحقق من إعدادات الشركة (useCentralKeys)
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { useCentralKeys: true }
      });

      const useCentralKeys = company?.useCentralKeys || false;

      // 2. إذا كانت الشركة تستخدم المفاتيح المركزية، ابحث في المفاتيح المركزية أولاً
      if (useCentralKeys) {
        const centralKey = await this.findActiveCentralKey();
        if (centralKey) {
          const bestModel = await this.findBestAvailableModelInActiveKey(centralKey.id);
          if (bestModel) {
            await this.updateModelUsage(bestModel.id);
            return {
              apiKey: centralKey.apiKey,
              model: bestModel.model,
              keyId: centralKey.id,
              modelId: bestModel.id,
              keyType: 'CENTRAL'
            };
          }
        }
      }

      // 3. البحث عن المفتاح النشط للشركة المحددة
      const activeKey = await this.prisma.geminiKey.findFirst({
        where: {
          isActive: true,
          companyId: companyId,
          keyType: 'COMPANY'
        },
        orderBy: { priority: 'asc' }
      });

      if (!activeKey) {
        // البحث عن أول مفتاح متاح وتفعيله تلقائياً
        const autoActivatedKey = await this.findAndActivateFirstAvailableKey(companyId);
        if (autoActivatedKey) {
          return autoActivatedKey;
        }

        // 4. Fallback: إذا لم توجد مفاتيح شركة، جرب المفاتيح المركزية
        if (!useCentralKeys) {
          console.log('🔄 [MODEL-MANAGER] محاولة استخدام المفاتيح المركزية كبديل...');
          const centralKey = await this.findActiveCentralKey();
          if (centralKey) {
            console.log(`✅ [MODEL-MANAGER] تم العثور على مفتاح مركزي: ${centralKey.name}`);
            const bestModel = await this.findBestAvailableModelInActiveKey(centralKey.id);
            if (bestModel) {
              console.log(`✅ [MODEL-MANAGER] تم العثور على نموذج متاح: ${bestModel.model}`);
              await this.updateModelUsage(bestModel.id);
              return {
                apiKey: centralKey.apiKey,
                model: bestModel.model,
                keyId: centralKey.id,
                modelId: bestModel.id,
                keyType: 'CENTRAL'
              };
            }
          }
        }

        return null;
      }

      // البحث عن أفضل نموذج متاح في هذا المفتاح
      const bestModel = await this.findBestAvailableModelInActiveKey(activeKey.id);
      
      if (bestModel) {
        return {
          apiKey: activeKey.apiKey,
          model: bestModel.model,
          keyId: activeKey.id,
          modelId: bestModel.id
        };
      }

      return null;

    } catch (error) {
      console.error('❌ خطأ في الحصول على مفتاح Gemini:', error);
      return null;
    }
  }

  /**
   * البحث عن أفضل نموذج متاح في المفتاح النشط
   * ✅ نقل من aiAgentService.js
   * ✅ FIX: تخطي النماذج غير المتوفرة في v1beta API
   */
  async findBestAvailableModelInActiveKey(keyId, forceRefresh = false) {
    try {
      // ⚠️ قائمة النماذج المعطلة مؤقتاً (غير متوفرة في API)
      const disabledModels = [
        'gemini-3-pro' // ⚠️ معطل - غير متوفر في API (404 Not Found) - تم الاختبار والتأكد
      ];
      
      // ✅ قائمة النماذج المتوفرة (جميع النماذج المدعومة)
      const supportedModels = [
        // أحدث نماذج 2025
        'gemini-3-pro',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-tts',
        
        // نماذج Gemini 2.0
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        
        // نماذج Live API
        'gemini-2.5-flash-live',
        'gemini-2.0-flash-live',
        'gemini-2.5-flash-native-audio-dialog',
        
        // نماذج مستقرة 1.5
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        
        // نماذج متخصصة
        'gemini-robotics-er-1.5-preview',
        'learnlm-2.0-flash-experimental',
        
        // نماذج Gemma
        'gemma-3-12b',
        'gemma-3-27b',
        'gemma-3-4b',
        'gemma-3-2b'
      ];

      const availableModels = await this.prisma.geminiKeyModel.findMany({
        where: {
          keyId: keyId,
          isEnabled: true
        },
        orderBy: {
          priority: 'asc'
        }
      });

      console.log(`📋 [MODEL-MANAGER] فحص ${availableModels.length} نموذج (مرتبة حسب الأولوية)`);

      for (const modelRecord of availableModels) {
        console.log(`🔍 [MODEL-MANAGER] فحص النموذج: ${modelRecord.model} (Priority: ${modelRecord.priority})`);
        
        // ✅ FIX: تخطي النماذج المعطلة مؤقتاً (غير متوفرة في API)
        if (disabledModels.includes(modelRecord.model)) {
          console.warn(`⚠️ [MODEL-MANAGER] Skipping disabled model (not available in API): ${modelRecord.model}`);
          continue;
        }
        
        // ✅ FIX: تخطي النماذج غير المتوفرة في v1beta API
        if (!supportedModels.includes(modelRecord.model)) {
          console.warn(`⚠️ [MODEL-MANAGER] Skipping unsupported model: ${modelRecord.model}`);
          continue;
        }

        // فحص الذاكرة المؤقتة أولاً
        if (this.exhaustedModelsCache && this.exhaustedModelsCache.has(modelRecord.model)) {
          console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} في قائمة المستنفدة المؤقتة`);
          continue;
        }

        let usage;
        try {
          usage = JSON.parse(modelRecord.usage || '{}');
        } catch (e) {
          console.warn(`⚠️ [MODEL-MANAGER] خطأ في تحليل JSON للنموذج ${modelRecord.model} (ID: ${modelRecord.id}):`, e.message);
          console.warn(`   Usage string length: ${(modelRecord.usage || '').length}`);
          console.warn(`   Usage string preview: ${(modelRecord.usage || '').substring(0, 200)}...`);
          
          // ⚠️ إذا فشل تحليل JSON، استخدم JSON افتراضي بقيم صحيحة بناءً على النموذج
          console.log(`   🔧 [MODEL-MANAGER] استخدام JSON افتراضي صحيح للنموذج ${modelRecord.model}`);
          
          // الحصول على القيم الافتراضية الصحيحة للنموذج
          const modelDefaults = this.getModelDefaults(modelRecord.model);
          usage = {
            used: 0,
            limit: modelDefaults.limit,
            rpm: { used: 0, limit: modelDefaults.rpm, windowStart: null },
            rph: { used: 0, limit: modelDefaults.rph, windowStart: null },
            rpd: { used: 0, limit: modelDefaults.rpd, windowStart: null },
            resetDate: null
          };
          
          // محاولة إصلاح JSON في قاعدة البيانات
          try {
            await this.prisma.geminiKeyModel.update({
              where: { id: modelRecord.id },
              data: {
                usage: JSON.stringify(usage)
              }
            });
            console.log(`   ✅ [MODEL-MANAGER] تم إصلاح JSON للنموذج ${modelRecord.model} بقيم صحيحة`);
          } catch (fixError) {
            console.warn(`   ⚠️ [MODEL-MANAGER] فشل إصلاح JSON: ${fixError.message}`);
          }
        }

        // التحقق من RPM (Requests Per Minute) - فقط إذا كان limit > 0 و windowStart موجود
        if (usage.rpm && usage.rpm.limit > 0 && usage.rpm.windowStart) {
          const now = new Date();
          const rpmWindowStart = new Date(usage.rpm.windowStart);
          const rpmWindowMs = 60 * 1000; // 1 دقيقة
          
          // فقط إذا كانت النافذة لا تزال نشطة (أقل من دقيقة)
          if ((now - rpmWindowStart) < rpmWindowMs) {
            if ((usage.rpm.used || 0) >= usage.rpm.limit) {
              console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تجاوز RPM (${usage.rpm.used}/${usage.rpm.limit})`);
              continue; // تجاوز RPM
            }
          }
          // إذا انتهت النافذة (> دقيقة)، لا نحتاج للفحص - سيتم إعادة تعيينها تلقائياً
        }

        // التحقق من RPH (Requests Per Hour) - فقط إذا كان limit > 0 و windowStart موجود
        if (usage.rph && usage.rph.limit > 0 && usage.rph.windowStart) {
          const now = new Date();
          const rphWindowStart = new Date(usage.rph.windowStart);
          const rphWindowMs = 60 * 60 * 1000; // 1 ساعة
          
          // فقط إذا كانت النافذة لا تزال نشطة (أقل من ساعة)
          if ((now - rphWindowStart) < rphWindowMs) {
            if ((usage.rph.used || 0) >= usage.rph.limit) {
              console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تجاوز RPH (${usage.rph.used}/${usage.rph.limit})`);
              continue; // تجاوز RPH
            }
          }
          // إذا انتهت النافذة (> ساعة)، لا نحتاج للفحص
        }

        // التحقق من RPD (Requests Per Day) - فقط إذا كان limit > 0 و windowStart موجود
        if (usage.rpd && usage.rpd.limit > 0 && usage.rpd.windowStart) {
          const now = new Date();
          const rpdWindowStart = new Date(usage.rpd.windowStart);
          const rpdWindowMs = 24 * 60 * 60 * 1000; // 1 يوم
          
          // فقط إذا كانت النافذة لا تزال نشطة (أقل من يوم)
          if ((now - rpdWindowStart) < rpdWindowMs) {
            if ((usage.rpd.used || 0) >= usage.rpd.limit) {
              console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تجاوز RPD (${usage.rpd.used}/${usage.rpd.limit})`);
              continue; // تجاوز RPD
            }
          }
          // إذا انتهت النافذة (> يوم)، لا نحتاج للفحص
        }

        const currentUsage = usage.used || 0;
        const maxRequests = usage.limit || 1000000;

        // فحص إضافي: إذا كان النموذج يبدو متاحاً لكن تم تحديثه مؤخراً كمستنفد
        if (forceRefresh && usage.exhaustedAt) {
          const exhaustedTime = new Date(usage.exhaustedAt);
          const now = new Date();
          const timeDiff = now - exhaustedTime;

          // إذا تم تحديد النموذج كمستنفد خلال آخر 5 دقائق، تجاهله
          if (timeDiff < 5 * 60 * 1000) {
            console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تم تحديده كمستنفد مؤخراً`);
            continue;
          }
        }

        if (currentUsage >= maxRequests) {
          console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تجاوز الحد العام (${currentUsage}/${maxRequests})`);
          continue;
        }

        console.log(`✅ [MODEL-MANAGER] نموذج متاح: ${modelRecord.model} (Priority: ${modelRecord.priority}, Usage: ${currentUsage}/${maxRequests})`);
        return modelRecord;
      }

      console.log(`❌ [MODEL-MANAGER] لم يتم العثور على نموذج متاح في المفتاح: ${keyId}`);

      return null;
    } catch (error) {
      console.error('❌ خطأ في البحث عن نموذج متاح:', error);
      return null;
    }
  }

  /**
   * تحديد نموذج كمستنفد بناءً على خطأ 429
   * ✅ نقل من aiAgentService.js
   * ✅ FIX: تحديث جميع النماذج التي تحمل نفس الاسم في جميع المفاتيح
   */
  async markModelAsExhaustedFrom429(modelName, quotaValue, companyId = null) {
    try {
      // ✅ FIX: البحث عن جميع النماذج التي تحمل نفس الاسم
      // إذا تم تمرير companyId، نبحث فقط في نماذج هذه الشركة
      const whereClause = companyId 
        ? {
            model: modelName,
            key: {
              companyId: companyId
            }
          }
        : {
            model: modelName
          };

      const modelRecords = await this.prisma.geminiKeyModel.findMany({
        where: whereClause,
        include: {
          key: true
        }
      });

      if (modelRecords && modelRecords.length > 0) {
        // ✅ FIX: تحديث جميع النماذج المتأثرة
        for (const modelRecord of modelRecords) {
          const usage = JSON.parse(modelRecord.usage);

          // تحديث الاستخدام بناءً على الحد الحقيقي من Google
          const realLimit = parseInt(quotaValue) || usage.limit || 250;
          const exhaustedUsage = {
            ...usage,
            used: realLimit,
            limit: realLimit,
            lastReset: new Date().toISOString(),
            exhaustedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };

          await this.prisma.geminiKeyModel.update({
            where: {
              id: modelRecord.id
            },
            data: {
              usage: JSON.stringify(exhaustedUsage),
              updatedAt: new Date()
            }
          });

          console.log(`⚠️ [QUOTA-EXHAUSTED] Updated model ${modelName} (${modelRecord.id}) in key ${modelRecord.key.name} - Used: ${realLimit}/${realLimit}`);
        }

        // إضافة النموذج إلى قائمة النماذج المستنفدة المؤقتة
        if (!this.exhaustedModelsCache) {
          this.exhaustedModelsCache = new Set();
        }
        this.exhaustedModelsCache.add(modelName);

        // إزالة النموذج من الذاكرة المؤقتة بعد 10 دقائق
        setTimeout(() => {
          if (this.exhaustedModelsCache) {
            this.exhaustedModelsCache.delete(modelName);
          }
        }, 10 * 60 * 1000);
      } else {
        console.warn(`⚠️ [QUOTA-EXHAUSTED] No models found with name: ${modelName}`);
      }
    } catch (error) {
      console.error('❌ خطأ في تحديد النموذج كمستنفد:', error);
    }
  }

  /**
   * تحديد نموذج كمستنفد (تجاوز الحد)
   * ✅ نقل من aiAgentService.js
   */
  async markModelAsExhausted(modelId) {
    try {
      const modelRecord = await this.prisma.geminiKeyModel.findMany({
        where: {
          id: modelId
        }
      });

      if (modelRecord && modelRecord.length > 0) {
        const model = modelRecord[0];
        const usage = JSON.parse(model.usage);

        // تحديث الاستخدام ليصبح مساوياً للحد الأقصى
        const exhaustedUsage = {
          ...usage,
          used: usage.limit || 250,
          lastReset: new Date().toISOString(),
          exhaustedAt: new Date().toISOString()
        };

        await this.prisma.geminiKeyModel.update({
          where: {
            id: modelId
          },
          data: {
            usage: JSON.stringify(exhaustedUsage)
          }
        });
      }
    } catch (error) {
      console.error('❌ خطأ في تحديد النموذج كمستنفد:', error);
    }
  }

  /**
   * تحديث عداد الاستخدام لنموذج معين مع دعم RPM, RPH, RPD
   * ✅ نقل من aiAgentService.js
   */
  async updateModelUsage(modelId) {
    try {
      if (!modelId) {
        console.warn('⚠️ [USAGE-UPDATE] modelId is null or undefined - cannot update usage');
        return;
      }

      const modelRecord = await this.prisma.geminiKeyModel.findUnique({
        where: {
          id: modelId
        }
      });

      if (modelRecord) {
        let usage;
        try {
          usage = JSON.parse(modelRecord.usage || '{}');
        } catch (e) {
          console.warn(`⚠️ [USAGE-UPDATE] خطأ في تحليل JSON للنموذج ${modelId}:`, e.message);
          usage = { used: 0, limit: 1000000 };
        }

        const now = new Date();
        
        // تحديث RPM (Requests Per Minute)
        const rpmWindowMs = 60 * 1000; // 1 دقيقة
        let rpm = usage.rpm || { used: 0, limit: 15, windowStart: null };
        if (!rpm.windowStart || (now - new Date(rpm.windowStart)) >= rpmWindowMs) {
          rpm = { used: 1, limit: rpm.limit || 15, windowStart: now.toISOString() };
        } else {
          rpm.used = (rpm.used || 0) + 1;
        }

        // تحديث RPH (Requests Per Hour)
        const rphWindowMs = 60 * 60 * 1000; // 1 ساعة
        let rph = usage.rph || { used: 0, limit: 900, windowStart: null };
        if (!rph.windowStart || (now - new Date(rph.windowStart)) >= rphWindowMs) {
          rph = { used: 1, limit: rph.limit || 900, windowStart: now.toISOString() };
        } else {
          rph.used = (rph.used || 0) + 1;
        }

        // تحديث RPD (Requests Per Day)
        const rpdWindowMs = 24 * 60 * 60 * 1000; // 1 يوم
        let rpd = usage.rpd || { used: 0, limit: 1000, windowStart: null };
        if (!rpd.windowStart || (now - new Date(rpd.windowStart)) >= rpdWindowMs) {
          rpd = { used: 1, limit: rpd.limit || 1000, windowStart: now.toISOString() };
        } else {
          rpd.used = (rpd.used || 0) + 1;
        }

        const newUsage = {
          ...usage,
          used: (usage.used || 0) + 1,
          lastUpdated: now.toISOString(),
          rpm,
          rph,
          rpd
        };

        await this.prisma.geminiKeyModel.update({
          where: {
            id: modelId
          },
          data: {
            usage: JSON.stringify(newUsage),
            lastUsed: now,
            updatedAt: now
          }
        });

        console.log(`✅ [USAGE-UPDATE] Updated usage for model ${modelRecord.model} (${modelId}): Total=${newUsage.used}/${usage.limit || 1000000}, RPM=${rpm.used}/${rpm.limit}, RPH=${rph.used}/${rph.limit}, RPD=${rpd.used}/${rpd.limit}`);
      } else {
        console.warn(`⚠️ [USAGE-UPDATE] Model not found: ${modelId}`);
      }
    } catch (error) {
      console.error('❌ خطأ في تحديث عداد الاستخدام:', error);
      console.error('❌ [USAGE-UPDATE] Error details:', {
        modelId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * فحص صحة نموذج معين
   * ✅ نقل من aiAgentService.js
   * ✅ FIX: تحسين معالجة الأخطاء 404 (نموذج غير متوفر)
   */
  async testModelHealth(apiKey, model) {
    try {
      // ✅ قائمة النماذج المتوفرة (جميع النماذج المدعومة)
      const supportedModels = [
        // أحدث نماذج 2025
        'gemini-3-pro',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-tts',
        
        // نماذج Gemini 2.0
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        
        // نماذج Live API
        'gemini-2.5-flash-live',
        'gemini-2.0-flash-live',
        'gemini-2.5-flash-native-audio-dialog',
        
        // نماذج مستقرة 1.5
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        
        // نماذج متخصصة
        'gemini-robotics-er-1.5-preview',
        'learnlm-2.0-flash-experimental',
        
        // نماذج Gemma
        'gemma-3-12b',
        'gemma-3-27b',
        'gemma-3-4b',
        'gemma-3-2b'
      ];

      // ✅ إذا كان النموذج غير مدعوم، إرجاع false مباشرة
      if (!supportedModels.includes(model)) {
        console.warn(`⚠️ [MODEL-HEALTH] Model ${model} is not supported in v1beta API`);
        return false;
      }

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const testModel = genAI.getGenerativeModel({ model: model });
      
      // ✅ استخدام timeout لتجنب الانتظار الطويل
      const testPromise = testModel.generateContent('Hello');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), 5000)
      );
      
      const testResponse = await Promise.race([testPromise, timeoutPromise]);
      return testResponse && testResponse.response;
    } catch (error) {
      // ✅ FIX: معالجة أفضل للأخطاء 404 (نموذج غير متوفر)
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.warn(`⚠️ [MODEL-HEALTH] Model ${model} is not available: ${error.message}`);
        return false;
      }
      // ✅ للأخطاء الأخرى (مثل timeout, quota), إرجاع false أيضاً
      console.warn(`⚠️ [MODEL-HEALTH] Model ${model} health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * البحث عن نموذج احتياطي متاح
   * ✅ نقل من aiAgentService.js
   */
  async findNextAvailableModel(companyId) {
    try {
      let targetCompanyId = companyId;
      if (!targetCompanyId) {
        console.error('❌ [SECURITY] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      // الحصول على المفتاح النشط الحالي للشركة
      const currentActiveKey = await this.prisma.geminiKey.findFirst({
        where: {
          isActive: true,
          companyId: targetCompanyId
        },
        orderBy: { priority: 'asc' }
      });

      if (currentActiveKey) {
        // أولاً: البحث عن نموذج آخر في نفس المفتاح
        const nextModelInSameKey = await this.findNextModelInKey(currentActiveKey.id);
        if (nextModelInSameKey) {
          return {
            apiKey: currentActiveKey.apiKey,
            model: nextModelInSameKey.model,
            keyId: currentActiveKey.id,
            keyName: currentActiveKey.name,
            modelId: nextModelInSameKey.id, // ✅ FIX: إضافة modelId
            switchType: 'same_key_different_model'
          };
        }
      }

      // ثانياً: البحث في مفاتيح أخرى للشركة
      const nextKeyWithModel = await this.findNextAvailableKey(targetCompanyId);
      
      if (nextKeyWithModel) {
        // تفعيل المفتاح الجديد
        await this.activateKey(nextKeyWithModel.keyId);
        
        return {
          apiKey: nextKeyWithModel.apiKey,
          model: nextKeyWithModel.model,
          keyId: nextKeyWithModel.keyId,
          keyName: nextKeyWithModel.keyName,
          modelId: nextKeyWithModel.modelId, // ✅ FIX: إضافة modelId (موجود بالفعل في findNextAvailableKey)
          switchType: 'different_key'
        };
      }

      return null;

    } catch (error) {
      console.error('❌ خطأ في البحث عن نموذج احتياطي:', error);
      return null;
    }
  }

  /**
   * البحث عن نموذج آخر متاح في نفس المفتاح
   * ✅ نقل من aiAgentService.js
   * ✅ FIX: تخطي النماذج غير المتوفرة في v1beta API
   */
  async findNextModelInKey(keyId) {
    try {
      // ✅ قائمة النماذج المتوفرة (جميع النماذج المدعومة)
      const supportedModels = [
        // أحدث نماذج 2025
        'gemini-3-pro',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-tts',
        
        // نماذج Gemini 2.0
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        
        // نماذج Live API
        'gemini-2.5-flash-live',
        'gemini-2.0-flash-live',
        'gemini-2.5-flash-native-audio-dialog',
        
        // نماذج مستقرة 1.5
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        
        // نماذج متخصصة
        'gemini-robotics-er-1.5-preview',
        'learnlm-2.0-flash-experimental',
        
        // نماذج Gemma
        'gemma-3-12b',
        'gemma-3-27b',
        'gemma-3-4b',
        'gemma-3-2b'
      ];

      const availableModels = await this.prisma.geminiKeyModel.findMany({
        where: {
          keyId: keyId,
          isEnabled: true
        },
        orderBy: {
          priority: 'asc'
        }
      });

      for (const modelRecord of availableModels) {
        // ✅ FIX: تخطي النماذج غير المتوفرة في v1beta API
        if (!supportedModels.includes(modelRecord.model)) {
          console.warn(`⚠️ [MODEL-MANAGER] Skipping unsupported model: ${modelRecord.model}`);
          continue;
        }

        // فحص الذاكرة المؤقتة أولاً
        if (this.exhaustedModelsCache && this.exhaustedModelsCache.has(modelRecord.model)) {
          continue;
        }

        const usage = JSON.parse(modelRecord.usage);
        const currentUsage = usage.used || 0;
        const maxRequests = usage.limit || 1000000;

        // فحص إضافي: إذا كان النموذج تم تحديده كمستنفد مؤخراً، تجاهله
        if (usage.exhaustedAt) {
          const exhaustedTime = new Date(usage.exhaustedAt);
          const now = new Date();
          const timeDiff = now - exhaustedTime;

          // إذا تم تحديد النموذج كمستنفد خلال آخر 5 دقائق، تجاهله
          if (timeDiff < 5 * 60 * 1000) {
            continue;
          }
        }

        if (currentUsage < maxRequests) {
          // ✅ FIX: تخطي testModelHealth للنماذج المعروفة أنها متوفرة (لتوفير الوقت)
          // اختبار صحة النموذج فقط إذا لم يكن في القائمة المدعومة
          const keyRecord = await this.prisma.geminiKey.findUnique({ where: { id: keyId } });
          
          // تخطي testModelHealth للنماذج المدعومة المعروفة (تحسين الأداء)
          if (supportedModels.includes(modelRecord.model)) {
            await this.prisma.geminiKeyModel.update({
              where: {
                id: modelRecord.id
              },
              data: {
                lastUsed: new Date(),
                updatedAt: new Date()
              }
            });
            
            return modelRecord;
          }
          
          // اختبار صحة النموذج فقط للنماذج الأخرى
          const isHealthy = await this.testModelHealth(keyRecord.apiKey, modelRecord.model);
          
          if (isHealthy) {
            await this.prisma.geminiKeyModel.update({
              where: {
                id: modelRecord.id
              },
              data: {
                lastUsed: new Date(),
                updatedAt: new Date()
              }
            });
            
            return modelRecord;
          }
        }
      }

      return null;

    } catch (error) {
      console.error('❌ خطأ في البحث عن نموذج في المفتاح:', error);
      return null;
    }
  }

  /**
   * البحث عن مفتاح آخر متاح للشركة المحددة
   * ✅ نقل من aiAgentService.js
   */
  async findNextAvailableKey(companyId) {
    try {
      let targetCompanyId = companyId;
      if (!targetCompanyId) {
        console.error('❌ [SECURITY] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      // الحصول على مفاتيح الشركة المحددة مرتبة حسب الأولوية
      const allKeys = await this.prisma.geminiKey.findMany({
        where: { companyId: targetCompanyId },
        orderBy: { priority: 'asc' }
      });

      for (const key of allKeys) {
        // البحث عن نموذج متاح في هذا المفتاح
        const availableModel = await this.findBestModelInKey(key.id);
        
        if (availableModel) {
          return {
            keyId: key.id,
            keyName: key.name,
            apiKey: key.apiKey,
            model: availableModel.model,
            modelId: availableModel.id
          };
        }
      }

      return null;

    } catch (error) {
      console.error('❌ خطأ في البحث عن مفتاح متاح:', error);
      return null;
    }
  }

  /**
   * البحث عن أفضل نموذج في مفتاح معين
   * ✅ نقل من aiAgentService.js
   * ✅ FIX: تخطي النماذج غير المتوفرة في v1beta API
   */
  async findBestModelInKey(keyId) {
    try {
      // ✅ قائمة النماذج المتوفرة (جميع النماذج المدعومة)
      const supportedModels = [
        // أحدث نماذج 2025
        'gemini-3-pro',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-tts',
        
        // نماذج Gemini 2.0
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        
        // نماذج Live API
        'gemini-2.5-flash-live',
        'gemini-2.0-flash-live',
        'gemini-2.5-flash-native-audio-dialog',
        
        // نماذج مستقرة 1.5
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        
        // نماذج متخصصة
        'gemini-robotics-er-1.5-preview',
        'learnlm-2.0-flash-experimental',
        
        // نماذج Gemma
        'gemma-3-12b',
        'gemma-3-27b',
        'gemma-3-4b',
        'gemma-3-2b'
      ];

      const availableModels = await this.prisma.geminiKeyModel.findMany({
        where: {
          keyId: keyId,
          isEnabled: true
        },
        orderBy: {
          priority: 'asc'
        }
      });

      for (const modelRecord of availableModels) {
        // ✅ FIX: تخطي النماذج غير المتوفرة في v1beta API
        if (!supportedModels.includes(modelRecord.model)) {
          console.warn(`⚠️ [MODEL-MANAGER] Skipping unsupported model: ${modelRecord.model}`);
          continue;
        }

        const usage = JSON.parse(modelRecord.usage);
        const currentUsage = usage.used || 0;
        const maxRequests = usage.limit || 1000000;

        if (currentUsage < maxRequests) {
          // ✅ FIX: تخطي testModelHealth للنماذج المدعومة المعروفة (تحسين الأداء)
          if (supportedModels.includes(modelRecord.model)) {
            return modelRecord;
          }
          
          // اختبار صحة النموذج فقط للنماذج الأخرى
          const keyRecord = await this.prisma.geminiKey.findUnique({ where: { id: keyId } });
          const isHealthy = await this.testModelHealth(keyRecord.apiKey, modelRecord.model);
          
          if (isHealthy) {
            return modelRecord;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('❌ خطأ في البحث عن أفضل نموذج:', error);
      return null;
    }
  }

  /**
   * البحث عن أول مفتاح متاح وتفعيله تلقائياً
   * ✅ نقل من aiAgentService.js
   */
  // البحث عن مفتاح مركزي نشط
  async findActiveCentralKey() {
    try {
      const centralKey = await this.prisma.geminiKey.findFirst({
        where: {
          keyType: 'CENTRAL',
          companyId: null,
          isActive: true
        },
        orderBy: { priority: 'asc' }
      });

      if (centralKey) {
        console.log(`✅ [MODEL-MANAGER] تم العثور على مفتاح مركزي نشط: ${centralKey.name} (ID: ${centralKey.id})`);
        return centralKey;
      }

      console.log('⚠️ [MODEL-MANAGER] لا يوجد مفتاح مركزي نشط');
      return null;
    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في البحث عن مفتاح مركزي:', error);
      return null;
    }
  }

  async findAndActivateFirstAvailableKey(companyId) {
    try {
      // البحث عن جميع مفاتيح الشركة
      const allKeys = await this.prisma.geminiKey.findMany({
        where: { companyId: companyId },
        orderBy: { priority: 'asc' }
      });

      if (allKeys.length === 0) {
        return null;
      }

      // البحث عن أول مفتاح يحتوي على نماذج متاحة
      for (const key of allKeys) {
        // البحث عن نموذج متاح في هذا المفتاح
        const availableModel = await this.findBestModelInKey(key.id);

        if (availableModel) {
          // تفعيل هذا المفتاح
          const activated = await this.activateKey(key.id);
          if (activated) {
            return {
              apiKey: key.apiKey,
              model: availableModel.model,
              keyId: key.id,
              keyName: key.name,
              modelId: availableModel.id,
              autoActivated: true
            };
          }
        }
      }

      return null;

    } catch (error) {
      console.error('❌ خطأ في البحث عن مفتاح للتفعيل التلقائي:', error);
      return null;
    }
  }

  /**
   * تفعيل مفتاح معين
   * ✅ نقل من aiAgentService.js
   */
  async activateKey(keyId) {
    try {
      // FIXED: Add company isolation to prevent affecting other companies
      // First get the company ID from the key
      const keyRecord = await this.prisma.geminiKey.findUnique({
        where: { id: keyId },
        select: { companyId: true }
      });

      if (!keyRecord) {
        throw new Error('Key not found');
      }

      // إلغاء تفعيل جميع المفاتيح للشركة فقط
      await this.prisma.geminiKey.updateMany({
        where: {
          companyId: keyRecord.companyId // Company isolation
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      // تفعيل المفتاح المطلوب
      await this.prisma.geminiKey.update({
        where: {
          id: keyId
        },
        data: {
          isActive: true,
          updatedAt: new Date()
        }
      });
      
      return true;

    } catch (error) {
      console.error('❌ خطأ في تفعيل المفتاح:', error);
      return false;
    }
  }

  /**
   * Get current active model
   * ✅ نقل من aiAgentService.js
   */
  async getCurrentActiveModel(companyId) {
    // إذا تم تمرير companyId، احصل على نموذج جديد للشركة المحددة
    if (companyId) {
      const model = await this.getActiveGeminiKeyWithModel(companyId);
      if (model) {
        // Model found successfully
      } else {
        console.error(`❌ [AI-MODEL] No active model found for company: ${companyId}`);
      }
      return model;
    }

    // إذا لم يتم تمرير companyId، يجب رفض الطلب للأمان
    console.error('❌ [SECURITY] getCurrentActiveModel called without companyId - request denied');
    return null;
  }

  /**
   * Update current active model (used when switching)
   * ✅ نقل من aiAgentService.js
   */
  updateCurrentActiveModel(newModel) {
    this.currentActiveModel = newModel;
  }

  /**
   * تحديث حالة النموذج
   * @param {string} keyId - معرف المفتاح
   * @param {Object} updates - التحديثات
   * @returns {Promise<boolean>} - نجح التحديث أم لا
   */
  async updateModelStatus(keyId, updates) {
    try {
      await this.prisma.geminiKey.update({
        where: { id: keyId },
        data: updates
      });
      return true;
    } catch (error) {
      console.error('❌ [MODEL-MANAGER] Error updating model status:', error);
      return false;
    }
  }
}

module.exports = ModelManager;

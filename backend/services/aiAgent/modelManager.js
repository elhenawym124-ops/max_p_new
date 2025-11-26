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
    this.lastUsedGlobalKeyId = null; // آخر مفتاح مستخدم (Global Round-Robin)
    this.quotaCache = new Map(); // Cache للكوتة الإجمالية مع TTL 10 ثواني
    this.excludedModels = new Map(); // ذاكرة مؤقتة للنماذج المستثناة
  }

  /**
   * ✅ الحصول على قائمة النماذج المعطلة (غير متوفرة في v1beta API)
   * تم الاختبار الفعلي للتأكد من النماذج التي لا تعمل
   */
  getDisabledModels() {
    return [
      // ✅ فقط النماذج المستخدمة فعلياً (7 نماذج) مفعلة
      // باقي النماذج معطلة أو مخفية
      
      // نماذج مدفوعة أو تجريبية (غير مستخدمة)
      'gemini-3-pro',
      'gemini-3-pro-preview',
      'gemini-2.5-pro-preview-05-06',
      'gemini-2.0-flash-exp',
      
      // نماذج قديمة (لا تعمل - 404)
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro',
      'gemini-flash',
      'gemini-2.5-flash-preview-05-20',
      
      // نماذج Live/Audio (غير مستخدمة)
      'gemini-2.5-flash-live',
      'gemini-2.0-flash-live',
      'gemini-2.5-flash-native-audio-dialog',
      'gemini-2.5-flash-tts',
      
      // نماذج Gemma (غير متوفرة في Google AI Studio API)
      'gemma-3-27b',
      'gemma-3-12b',
      'gemma-3-4b',
      'gemma-3-2b',
      'gemma-3-1b',
      'gemma-2-27b-it',
      'gemma-2-9b-it'
    ];
  }
  
  /**
   * ✅ الحصول على قائمة النماذج المتوفرة في v1beta API
   * بناءً على النماذج المستخدمة فعلياً في Google AI Studio
   * فقط النماذج التي تظهر في الصورة مفعلة
   */
  getSupportedModels() {
    return [
      // ✅ النماذج المستخدمة فعلياً (من صورة Google AI Studio)
      'gemini-2.5-pro',                    // RPM: 1/2
      'gemini-robotics-er-1.5-preview',    // RPM: 2/10
      'learnlm-2.0-flash-experimental',    // RPM: 3/15
      'gemini-2.5-flash',                  // RPM: 1/10
      'gemini-2.0-flash-lite',             // RPM: 2/30
      'gemini-2.0-flash',                  // RPM: 1/15
      'gemini-2.5-flash-lite'              // RPM: 1/15
    ];
  }
  
  /**
   * الحصول على القيم الافتراضية الصحيحة للنموذج
   */
  getModelDefaults(modelName) {
    const defaults = {
      // نماذج Pro
      'gemini-3-pro': { limit: 125000, rpm: 2, rph: 120, rpd: 50, tpm: 125000 },
      // ✅ القيم الفعلية من Google AI Studio Dashboard
      'gemini-2.5-pro': { limit: 125000, rpm: 2, rph: 120, rpd: 50, tpm: 125000 },
      
      // نماذج Flash
      'gemini-2.5-flash': { limit: 250000, rpm: 10, rph: 600, rpd: 250, tpm: 250000 },
      'gemini-2.5-flash-lite': { limit: 250000, rpm: 15, rph: 900, rpd: 1000, tpm: 250000 },
      'gemini-2.0-flash': { limit: 1000000, rpm: 15, rph: 900, rpd: 200, tpm: 1000000 },
      'gemini-2.0-flash-lite': { limit: 1000000, rpm: 30, rph: 1800, rpd: 200, tpm: 1000000 },
      
      // نماذج متخصصة
      'gemini-robotics-er-1.5-preview': { limit: 250000, rpm: 10, rph: 600, rpd: 250, tpm: 250000 },
      'learnlm-2.0-flash-experimental': { limit: 1500000, rpm: 15, rph: 900, rpd: 1500, tpm: null }, // N/A
      
      // نماذج تجريبية ومدفوعة (قيم تقريبية)
      'gemini-2.0-flash-exp': { limit: 250000, rpm: 10, rph: 600, rpd: 50 },
      
      // نماذج Gemma
      'gemma-3-27b': { limit: 15000, rpm: 30, rph: 1800, rpd: 14400 },
      'gemma-3-12b': { limit: 15000, rpm: 30, rph: 1800, rpd: 14400 },
      'gemma-3-4b': { limit: 15000, rpm: 30, rph: 1800, rpd: 14400 },
      'gemma-3-2b': { limit: 15000, rpm: 30, rph: 1800, rpd: 14400 },
      'gemma-3-1b': { limit: 15000, rpm: 30, rph: 1800, rpd: 14400 },
      
      // نماذج Live
      'gemini-2.5-flash-live': { limit: 1000000, rpm: 15, rph: 900, rpd: 1000 },
      'gemini-2.0-flash-live': { limit: 1000000, rpm: 15, rph: 900, rpd: 200 }
    };
    
    return defaults[modelName] || { limit: 250000, rpm: 10, rph: 600, rpd: 250, tpm: 250000 };
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
   * ✅ تحديث لاستخدام النظام الجديد (Quota Aggregation + Round-Robin) مع fallback للنظام القديم
   */
  async getActiveGeminiKeyWithModel(companyId) {
    try {
      // ⚠️ IMPORTANT: لا نستدعي this.aiAgentService.getActiveGeminiKey هنا لتجنب حلقة لا نهائية
      // بدلاً من ذلك، نستخدم الكود مباشرة من aiAgentService.js
      
      if (!companyId) {
        console.error('❌ [MODEL-MANAGER] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      // 1. محاولة استخدام النظام الجديد (Quota Aggregation + Round-Robin)
      try {
        const newSystemResult = await this.findBestModelByPriorityWithQuota(companyId);
        if (newSystemResult) {
          console.log(`✅ [MODEL-MANAGER] استخدام النظام الجديد - النموذج: ${newSystemResult.model} (Key: ${newSystemResult.keyName})`);
          
          // تحديث lastUsedGlobalKeyId
          this.lastUsedGlobalKeyId = newSystemResult.keyId;
          
          // تحديث الاستخدام
          if (newSystemResult.modelId) {
            await this.updateModelUsage(newSystemResult.modelId);
          }
          
          return {
            apiKey: newSystemResult.apiKey,
            model: newSystemResult.model,
            keyId: newSystemResult.keyId,
            modelId: newSystemResult.modelId,
            keyName: newSystemResult.keyName,
            quota: newSystemResult.quota
          };
        }
      } catch (newSystemError) {
        console.warn(`⚠️ [MODEL-MANAGER] فشل النظام الجديد، استخدام النظام القديم:`, newSystemError.message);
      }

      // 2. Fallback: استخدام النظام القديم
      console.log('🔄 [MODEL-MANAGER] استخدام النظام القديم كـ fallback...');

      // 2.1. التحقق من إعدادات الشركة (useCentralKeys)
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { useCentralKeys: true }
      });

      const useCentralKeys = company?.useCentralKeys || false;

      // 2.2. إذا كانت الشركة تستخدم المفاتيح المركزية، ابحث في المفاتيح المركزية أولاً
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

      // 2.3. البحث عن المفتاح النشط للشركة المحددة
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

        // 2.4. Fallback: إذا لم توجد مفاتيح شركة، جرب المفاتيح المركزية
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
      // ⚠️ قائمة النماذج المعطلة مؤقتاً (غير متوفرة في v1beta API)
      // ✅ تم الاختبار الفعلي للتأكد من النماذج التي لا تعمل
      const disabledModels = this.getDisabledModels();
      
      // ✅ قائمة النماذج المتوفرة في v1beta API (تم الاختبار الفعلي)
      const supportedModels = this.getSupportedModels();

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
            tpm: { used: 0, limit: modelDefaults.tpm || 125000, windowStart: null }, // ✅ إضافة TPM
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

        // ✅ التحقق من TPM (Tokens Per Minute) - جديد
        if (usage.tpm && usage.tpm.limit > 0 && usage.tpm.windowStart) {
          const now = new Date();
          const tpmWindowStart = new Date(usage.tpm.windowStart);
          const tpmWindowMs = 60 * 1000; // 1 دقيقة
          
          // فقط إذا كانت النافذة لا تزال نشطة (أقل من دقيقة)
          if ((now - tpmWindowStart) < tpmWindowMs) {
            if ((usage.tpm.used || 0) >= usage.tpm.limit) {
              console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تجاوز TPM (${usage.tpm.used}/${usage.tpm.limit})`);
              continue; // تجاوز TPM
            }
          }
          // إذا انتهت النافذة (> دقيقة)، لا نحتاج للفحص - سيتم إعادة تعيينها تلقائياً
        }

        // التحقق من RPD (Requests Per Day) - فقط إذا كان limit > 0 و windowStart موجود
        if (usage.rpd && usage.rpd.limit > 0 && usage.rpd.windowStart) {
          const now = new Date();
          const rpdWindowStart = new Date(usage.rpd.windowStart);
          const rpdWindowMs = 24 * 60 * 60 * 1000; // 1 يوم
          
          // ✅ إعادة تعيين RPD تلقائياً إذا انتهت النافذة (أكثر من 24 ساعة)
          if ((now - rpdWindowStart) >= rpdWindowMs) {
            // إعادة تعيين RPD
            usage.rpd = {
              used: 0,
              limit: usage.rpd.limit || 1000,
              windowStart: null // سيتم ضبطه عند الاستخدام التالي
            };
            
            // حفظ التغييرات في قاعدة البيانات
            try {
              await this.prisma.geminiKeyModel.update({
                where: { id: modelRecord.id },
                data: {
                  usage: JSON.stringify(usage),
                  updatedAt: now
                }
              });
              console.log(`✅ [MODEL-MANAGER] تم إعادة تعيين RPD للنموذج ${modelRecord.model} تلقائياً`);
            } catch (updateError) {
              console.warn(`⚠️ [MODEL-MANAGER] فشل تحديث RPD: ${updateError.message}`);
            }
          }
          
          // فقط إذا كانت النافذة لا تزال نشطة (أقل من يوم)
          if (usage.rpd.windowStart && (now - new Date(usage.rpd.windowStart)) < rpdWindowMs) {
            if ((usage.rpd.used || 0) >= usage.rpd.limit) {
              console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تجاوز RPD (${usage.rpd.used}/${usage.rpd.limit})`);
              continue; // تجاوز RPD
            }
          }
          // إذا انتهت النافذة أو تم إعادة تعيينها، النموذج متاح
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
   * تحديث عداد الاستخدام لنموذج معين مع دعم RPM, RPH, RPD, TPM
   * ✅ نقل من aiAgentService.js
   * @param {string} modelId - معرف النموذج
   * @param {number} totalTokenCount - عدد الـ tokens المستخدمة (اختياري)
   */
  async updateModelUsage(modelId, totalTokenCount = 0) {
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

        // ✅ تحديث TPM (Tokens Per Minute) - جديد
        const tpmWindowMs = 60 * 1000; // 1 دقيقة
        let tpm = usage.tpm || { used: 0, limit: 125000, windowStart: null };
        
        // الحصول على حد TPM من القيم الافتراضية للنموذج
        const modelDefaults = this.getModelDefaults(modelRecord.model);
        const tpmLimit = tpm.limit || modelDefaults.tpm || 125000;
        
        if (!tpm.windowStart || (now - new Date(tpm.windowStart)) >= tpmWindowMs) {
          // نافذة جديدة - ابدأ من الصفر
          tpm = { 
            used: totalTokenCount || 0, 
            limit: tpmLimit, 
            windowStart: now.toISOString() 
          };
        } else {
          // نفس النافذة - أضف للعدد الحالي
          tpm.used = (tpm.used || 0) + (totalTokenCount || 0);
        }

        const newUsage = {
          ...usage,
          used: (usage.used || 0) + 1,
          lastUpdated: now.toISOString(),
          rpm,
          rph,
          rpd,
          tpm // ✅ إضافة TPM
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

        console.log(`✅ [USAGE-UPDATE] Updated usage for model ${modelRecord.model} (${modelId}): Total=${newUsage.used}/${usage.limit || 1000000}, RPM=${rpm.used}/${rpm.limit}, RPH=${rph.used}/${rph.limit}, RPD=${rpd.used}/${rpd.limit}, TPM=${tpm.used}/${tpm.limit}`);
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
   * ✅ تحديث لاستخدام النظام الجديد (Quota Aggregation + Round-Robin)
   */
  async findNextAvailableModel(companyId) {
    try {
      let targetCompanyId = companyId;
      if (!targetCompanyId) {
        console.error('❌ [SECURITY] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      // استخدام النظام الجديد (Quota Aggregation + Round-Robin)
      const newSystemResult = await this.findBestModelByPriorityWithQuota(targetCompanyId);
      if (newSystemResult) {
        console.log(`✅ [FIND-NEXT] استخدام النظام الجديد - النموذج: ${newSystemResult.model} (Key: ${newSystemResult.keyName})`);
        
        // تحديث lastUsedGlobalKeyId
        this.lastUsedGlobalKeyId = newSystemResult.keyId;
        
        return {
          apiKey: newSystemResult.apiKey,
          model: newSystemResult.model,
          keyId: newSystemResult.keyId,
          keyName: newSystemResult.keyName,
          modelId: newSystemResult.modelId,
          switchType: 'quota_aggregation_round_robin',
          quota: newSystemResult.quota
        };
      }

      // Fallback: استخدام النظام القديم
      console.log('🔄 [FIND-NEXT] استخدام النظام القديم كـ fallback...');

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
      // ✅ FIX: استخدام نفس القوائم المستخدمة في findBestAvailableModelInActiveKey
      const disabledModels = this.getDisabledModels();
      const supportedModels = this.getSupportedModels();

      const availableModels = await this.prisma.geminiKeyModel.findMany({
        where: {
          keyId: keyId,
          isEnabled: true
        },
        orderBy: {
          priority: 'asc'
        }
      });

      console.log(`📋 [MODEL-MANAGER] findNextModelInKey: فحص ${availableModels.length} نموذج`);

      for (const modelRecord of availableModels) {
        // ✅ FIX: تخطي النماذج المعطلة مؤقتاً (غير متوفرة في API)
        if (disabledModels.includes(modelRecord.model)) {
          console.warn(`⚠️ [MODEL-MANAGER] Skipping disabled model: ${modelRecord.model}`);
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
          console.warn(`⚠️ [MODEL-MANAGER] خطأ في تحليل JSON للنموذج ${modelRecord.model}:`, e.message);
          usage = { used: 0, limit: 1000000 };
        }

        const currentUsage = usage.used || 0;
        const maxRequests = usage.limit || 1000000;

        // فحص إضافي: إذا كان النموذج تم تحديده كمستنفد مؤخراً، تجاهله
        if (usage.exhaustedAt) {
          const exhaustedTime = new Date(usage.exhaustedAt);
          const now = new Date();
          const timeDiff = now - exhaustedTime;

          // إذا تم تحديد النموذج كمستنفد خلال آخر 5 دقائق، تجاهله
          if (timeDiff < 5 * 60 * 1000) {
            console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تم تحديده كمستنفد مؤخراً`);
            continue;
          }
        }

        if (currentUsage < maxRequests) {
          console.log(`✅ [MODEL-MANAGER] findNextModelInKey: نموذج متاح: ${modelRecord.model}`);
          
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
        } else {
          console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تجاوز الحد (${currentUsage}/${maxRequests})`);
        }
      }

      console.log(`❌ [MODEL-MANAGER] findNextModelInKey: لم يتم العثور على نموذج متاح`);
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
      // ✅ FIX: استخدام نفس القوائم المستخدمة في findBestAvailableModelInActiveKey
      const disabledModels = this.getDisabledModels();
      const supportedModels = this.getSupportedModels();

      const availableModels = await this.prisma.geminiKeyModel.findMany({
        where: {
          keyId: keyId,
          isEnabled: true
        },
        orderBy: {
          priority: 'asc'
        }
      });

      console.log(`📋 [MODEL-MANAGER] findBestModelInKey: فحص ${availableModels.length} نموذج`);

      for (const modelRecord of availableModels) {
        // ✅ FIX: تخطي النماذج المعطلة مؤقتاً (غير متوفرة في API)
        if (disabledModels.includes(modelRecord.model)) {
          console.warn(`⚠️ [MODEL-MANAGER] Skipping disabled model: ${modelRecord.model}`);
          continue;
        }

        // ✅ FIX: تخطي النماذج غير المتوفرة في v1beta API
        if (!supportedModels.includes(modelRecord.model)) {
          console.warn(`⚠️ [MODEL-MANAGER] Skipping unsupported model: ${modelRecord.model}`);
          continue;
        }

        let usage;
        try {
          usage = JSON.parse(modelRecord.usage || '{}');
        } catch (e) {
          console.warn(`⚠️ [MODEL-MANAGER] خطأ في تحليل JSON للنموذج ${modelRecord.model}:`, e.message);
          usage = { used: 0, limit: 1000000 };
        }

        const currentUsage = usage.used || 0;
        const maxRequests = usage.limit || 1000000;

        if (currentUsage < maxRequests) {
          console.log(`✅ [MODEL-MANAGER] findBestModelInKey: نموذج متاح: ${modelRecord.model}`);
          return modelRecord;
        } else {
          console.log(`⚠️ [MODEL-MANAGER] النموذج ${modelRecord.model} تجاوز الحد (${currentUsage}/${maxRequests})`);
        }
      }

      console.log(`❌ [MODEL-MANAGER] findBestModelInKey: لم يتم العثور على نموذج متاح`);
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

  /**
   * تجميع النماذج من كل المفاتيح حسب الأولوية
   * يجمع النماذج من نفس النوع من مفاتيح الشركة والمفاتيح المركزية (منفصلة)
   * @param {string} modelName - اسم النموذج
   * @param {string} companyId - معرف الشركة
   * @returns {Promise<Array>} - قائمة النماذج المجمعة مرتبة حسب الأولوية
   */
  async aggregateModelsByPriority(modelName, companyId) {
    try {
      if (!companyId) {
        console.error('❌ [MODEL-MANAGER] لم يتم تمرير companyId - رفض الطلب للأمان');
        return [];
      }

      // 1. التحقق من إعدادات الشركة (useCentralKeys)
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { useCentralKeys: true }
      });

      const useCentralKeys = company?.useCentralKeys || false;

      const allModels = [];

      // 2. جمع النماذج من مفاتيح الشركة
      const companyModels = await this.prisma.geminiKeyModel.findMany({
        where: {
          model: modelName,
          isEnabled: true,
          key: {
            companyId: companyId,
            keyType: 'COMPANY',
            isActive: true
          }
        },
        include: {
          key: {
            select: {
              id: true,
              name: true,
              priority: true,
              apiKey: true
            }
          }
        },
        orderBy: [
          { key: { priority: 'asc' } },
          { lastUsed: 'asc' }
        ]
      });

      allModels.push(...companyModels);

      // 3. إذا كانت الشركة تستخدم المفاتيح المركزية، جمع النماذج من المفاتيح المركزية (منفصلة)
      if (useCentralKeys) {
        const centralModels = await this.prisma.geminiKeyModel.findMany({
          where: {
            model: modelName,
            isEnabled: true,
            key: {
              keyType: 'CENTRAL',
              companyId: null,
              isActive: true
            }
          },
          include: {
            key: {
              select: {
                id: true,
                name: true,
                priority: true,
                apiKey: true
              }
            }
          },
          orderBy: [
            { key: { priority: 'asc' } },
            { lastUsed: 'asc' }
          ]
        });

        allModels.push(...centralModels);
      }

      // 4. Fallback: إذا لم توجد مفاتيح شركة، جرب المفاتيح المركزية
      if (allModels.length === 0 && !useCentralKeys) {
        console.log('🔄 [MODEL-MANAGER] محاولة استخدام المفاتيح المركزية كبديل...');
        const centralModels = await this.prisma.geminiKeyModel.findMany({
          where: {
            model: modelName,
            isEnabled: true,
            key: {
              keyType: 'CENTRAL',
              companyId: null,
              isActive: true
            }
          },
          include: {
            key: {
              select: {
                id: true,
                name: true,
                priority: true,
                apiKey: true
              }
            }
          },
          orderBy: [
            { key: { priority: 'asc' } },
            { lastUsed: 'asc' }
          ]
        });

        allModels.push(...centralModels);
      }

      console.log(`📋 [MODEL-MANAGER] تم تجميع ${allModels.length} نموذج من نوع ${modelName} للشركة ${companyId}`);
      return allModels;

    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في تجميع النماذج:', error);
      return [];
    }
  }

  /**
   * حساب الكوتة الإجمالية للنموذج من كل المفاتيح مع Caching (10 ثواني)
   * @param {string} modelName - اسم النموذج
   * @param {string} companyId - معرف الشركة
   * @returns {Promise<Object>} - معلومات الكوتة الإجمالية
   */
  /**
   * حساب الكوتة الإجمالية باستخدام البيانات المحضرة مسبقاً (لتحسين الأداء)
   */
  async calculateTotalQuotaWithPreFetchedModels(modelName, companyId, preFetchedModels, useCentralKeys) {
    try {
      // 1. فحص Cache أولاً (TTL: 10 ثواني)
      const cacheKey = `${modelName}_${companyId}`;
      const cached = this.quotaCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < 10000) {
        return cached.data;
      }

      // 2. استخدام البيانات المحضرة مسبقاً
      let allModels = preFetchedModels || [];
      
      // ترتيب حسب الأولوية و lastUsed
      allModels.sort((a, b) => {
        const priorityDiff = (a.key.priority || 0) - (b.key.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        const aLastUsed = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
        const bLastUsed = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
        return aLastUsed - bLastUsed;
      });

      // 3. إذا لم توجد نماذج محضرة، استخدم الطريقة القديمة
      if (allModels.length === 0) {
        allModels = await this.aggregateModelsByPriority(modelName, companyId);
      }
      
      // 3. استخدام نفس منطق حساب الكوتة
      return await this._calculateQuotaFromModels(modelName, companyId, allModels, now);

    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في حساب الكوتة الإجمالية:', error);
      return {
        totalRPM: 0,
        totalRPMUsed: 0,
        totalTPM: 0,
        totalTPMUsed: 0,
        totalRPD: 0,
        totalRPDUsed: 0,
        rpmPercentage: 0,
        tpmPercentage: 0,
        rpdPercentage: 0,
        availableModels: [],
        totalModels: 0
      };
    }
  }

  /**
   * حساب الكوتة الإجمالية (الطريقة القديمة - للتوافق مع الكود الموجود)
   */
  async calculateTotalQuota(modelName, companyId) {
    try {
      // 1. فحص Cache أولاً (TTL: 10 ثواني)
      const cacheKey = `${modelName}_${companyId}`;
      const cached = this.quotaCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < 10000) {
        console.log(`✅ [QUOTA-CACHE] استخدام Cache للكوتة: ${modelName} (${companyId})`);
        return cached.data;
      }

      // 2. تجميع النماذج من كل المفاتيح
      const allModels = await this.aggregateModelsByPriority(modelName, companyId);
      
      // 3. استخدام نفس منطق حساب الكوتة
      return await this._calculateQuotaFromModels(modelName, companyId, allModels, now);
    } catch (error) {
      console.error(`❌ [QUOTA-CALC] خطأ في حساب الكوتة: ${modelName} (${companyId}):`, error);
      return {
        totalRPM: 0,
        totalRPMUsed: 0,
        totalTPM: 0,
        totalTPMUsed: 0,
        totalRPD: 0,
        totalRPDUsed: 0,
        rpmPercentage: 0,
        tpmPercentage: 0,
        rpdPercentage: 0,
        availableModels: [],
        totalModels: 0
      };
    }
  }

  /**
   * اختيار المفتاح التالي (Round-Robin) مع Optimistic Locking
   * آخر مفتاح استخدمته النظام ككل → المفتاح التالي
   * @param {Array} availableModels - قائمة النماذج المتاحة
   * @param {string} lastUsedKeyId - آخر مفتاح مستخدم (Global)
   * @returns {Promise<Object|null>} - النموذج المختار أو null
   */
  async selectNextKeyRoundRobin(availableModels, lastUsedKeyId = null) {
    try {
      if (availableModels.length === 0) {
        return null;
      }

      // 1. إذا لم يكن هناك lastUsedKeyId، استخدم lastUsedGlobalKeyId
      let targetLastUsedKeyId = lastUsedKeyId || this.lastUsedGlobalKeyId;

      // 2. إذا لم يكن هناك lastUsedKeyId على الإطلاق، استخدم الأول
      if (!targetLastUsedKeyId) {
        const selectedModel = availableModels[0];
        this.lastUsedGlobalKeyId = selectedModel.keyId;
        
        // تحديث lastUsed في قاعدة البيانات
        await this.updateModelLastUsed(selectedModel.id, selectedModel.keyId);
        
        console.log(`🔄 [ROUND-ROBIN] اختيار أول مفتاح: ${selectedModel.key.name} (${selectedModel.keyId})`);
        return selectedModel;
      }

      // 3. البحث عن آخر مفتاح مستخدم في القائمة
      const lastUsedIndex = availableModels.findIndex(
        m => m.keyId === targetLastUsedKeyId
      );

      if (lastUsedIndex === -1) {
        // لم يتم العثور - استخدم الأول
        const selectedModel = availableModels[0];
        this.lastUsedGlobalKeyId = selectedModel.keyId;
        
        await this.updateModelLastUsed(selectedModel.id, selectedModel.keyId);
        
        console.log(`🔄 [ROUND-ROBIN] آخر مفتاح غير موجود، اختيار أول مفتاح: ${selectedModel.key.name} (${selectedModel.keyId})`);
        return selectedModel;
      }

      // 4. Optimistic Locking: قراءة lastUsed من DB
      const lastUsedModel = availableModels[lastUsedIndex];
      const dbModel = await this.prisma.geminiKeyModel.findUnique({
        where: { id: lastUsedModel.id },
        select: { lastUsed: true }
      });

      // 5. المفتاح التالي (Round-Robin)
      const nextIndex = (lastUsedIndex + 1) % availableModels.length;
      const selectedModel = availableModels[nextIndex];

      // 6. تحديث lastUsed للنموذج المختار مباشرة (لا نحتاج Optimistic Locking هنا)
      // لأننا نختار النموذج التالي بناءً على lastUsed، وليس نحدثه
      try {
        // 7. تحديث lastUsedGlobalKeyId أولاً
        this.lastUsedGlobalKeyId = selectedModel.keyId;
        
        // 8. تحديث lastUsed للنموذج المختار
        await this.updateModelLastUsed(selectedModel.id, selectedModel.keyId);

        console.log(`🔄 [ROUND-ROBIN] اختيار المفتاح التالي: ${selectedModel.key.name} (${selectedModel.keyId}) من ${availableModels.length} مفاتيح`);

        return selectedModel;

      } catch (updateError) {
        // إذا فشل التحديث، استخدم النموذج المختار على أي حال
        console.warn(`⚠️ [ROUND-ROBIN] Error updating lastUsed، لكن سيتم استخدام النموذج المختار:`, updateError.message);
        
        // تحديث lastUsedGlobalKeyId على أي حال
        this.lastUsedGlobalKeyId = selectedModel.keyId;
        
        // محاولة تحديث lastUsed بدون Optimistic Locking
        try {
          await this.updateModelLastUsed(selectedModel.id, selectedModel.keyId);
        } catch (err) {
          console.warn(`⚠️ [ROUND-ROBIN] فشل تحديث lastUsed:`, err.message);
        }
        
        return selectedModel;
      }

    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في Round-Robin:', error);
      // Fallback: إرجاع أول نموذج متاح
      return availableModels.length > 0 ? availableModels[0] : null;
    }
  }

  /**
   * تحديث lastUsed للنموذج
   * @param {string} modelId - معرف النموذج
   * @param {string} keyId - معرف المفتاح
   */
  async updateModelLastUsed(modelId, keyId) {
    try {
      await this.prisma.geminiKeyModel.update({
        where: { id: modelId },
        data: {
          lastUsed: new Date()
        }
      });
    } catch (error) {
      console.warn(`⚠️ [MODEL-MANAGER] فشل تحديث lastUsed للنموذج ${modelId}:`, error.message);
    }
  }

  /**
   * استثناء نموذج (RPD exhausted, etc.)
   * @param {string} modelName - اسم النموذج
   * @param {string} keyId - معرف المفتاح
   * @param {string} companyId - معرف الشركة
   * @param {string} reason - سبب الاستثناء (RPD_EXHAUSTED, etc.)
   */
  async excludeModel(modelName, keyId, companyId, reason = 'RPD_EXHAUSTED') {
    try {
      const now = new Date();
      const retryAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 ساعات

      // حفظ في قاعدة البيانات
      await this.prisma.excludedModel.create({
        data: {
          modelName,
          keyId,
          companyId,
          reason,
          excludedAt: now,
          retryAt,
          retryCount: 0
        }
      });

      // حفظ في الذاكرة المؤقتة
      const cacheKey = `${modelName}_${keyId}_${companyId}`;
      this.excludedModels.set(cacheKey, {
        modelName,
        keyId,
        companyId,
        reason,
        excludedAt: now,
        retryAt,
        retryCount: 0
      });

      console.log(`🚫 [EXCLUDE] تم استثناء النموذج ${modelName} (Key: ${keyId}, Company: ${companyId}) - السبب: ${reason}, إعادة المحاولة: ${retryAt.toISOString()}`);

    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في استثناء النموذج:', error);
    }
  }

  /**
   * التحقق من إذا كان النموذج مستثنى
   * @param {string} modelName - اسم النموذج
   * @param {string} keyId - معرف المفتاح
   * @param {string} companyId - معرف الشركة
   * @returns {Promise<boolean>} - true إذا كان مستثنى
   */
  async isModelExcluded(modelName, keyId, companyId) {
    try {
      const cacheKey = `${modelName}_${keyId}_${companyId}`;
      
      // 1. فحص الذاكرة المؤقتة أولاً
      const cached = this.excludedModels.get(cacheKey);
      if (cached) {
        const now = new Date();
        if (now < new Date(cached.retryAt)) {
          // لا يزال مستثنى
          return true;
        } else {
          // انتهت فترة الاستثناء - إزالة من الذاكرة
          this.excludedModels.delete(cacheKey);
        }
      }

      // 2. فحص قاعدة البيانات
      const excluded = await this.prisma.excludedModel.findFirst({
        where: {
          modelName,
          keyId,
          companyId,
          retryAt: {
            gt: new Date() // لا يزال مستثنى
          }
        }
      });

      if (excluded) {
        // تحديث الذاكرة المؤقتة
        this.excludedModels.set(cacheKey, {
          modelName: excluded.modelName,
          keyId: excluded.keyId,
          companyId: excluded.companyId,
          reason: excluded.reason,
          excludedAt: excluded.excludedAt,
          retryAt: excluded.retryAt,
          retryCount: excluded.retryCount
        });
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في التحقق من استثناء النموذج:', error);
      return false;
    }
  }

  /**
   * التحقق من النماذج المستثناة وإعادة المحاولة
   * - إذا وصل retryAt → إعادة المحاولة
   * - إذا نجحت → إزالة من الاستثناء
   * - إذا فشلت:
   *   - retryCount = 1 → retryAt = الآن + 3 ساعات
   *   - retryCount = 2 → retryAt = بداية اليوم التالي
   */
  async checkAndRetryExcludedModels() {
    try {
      const now = new Date();
      
      // 1. البحث عن النماذج المستثناة التي وصلت retryAt
      const excludedModels = await this.prisma.excludedModel.findMany({
        where: {
          retryAt: {
            lte: now // وصلت موعد إعادة المحاولة
          }
        }
      });

      console.log(`🔄 [RETRY-EXCLUDED] فحص ${excludedModels.length} نموذج مستثنى للتحقق من إعادة المحاولة`);

      for (const excluded of excludedModels) {
        try {
          // 2. التحقق من إذا كان النموذج متاحاً الآن
          const modelRecord = await this.prisma.geminiKeyModel.findFirst({
            where: {
              model: excluded.modelName,
              keyId: excluded.keyId,
              isEnabled: true
            }
          });

          if (!modelRecord) {
            console.warn(`⚠️ [RETRY-EXCLUDED] النموذج ${excluded.modelName} غير موجود أو معطل`);
            // إزالة من الاستثناء
            await this.removeExcludedModel(excluded.id);
            continue;
          }

          // 3. فحص الكوتة
          let usage;
          try {
            usage = JSON.parse(modelRecord.usage || '{}');
          } catch (e) {
            usage = { rpd: { used: 0, limit: 0, windowStart: null } };
          }

          const modelDefaults = this.getModelDefaults(excluded.modelName);
          const rpdLimit = modelDefaults.rpd || 0;

          let isAvailable = false;

          if (usage.rpd && usage.rpd.windowStart) {
            const windowStart = new Date(usage.rpd.windowStart);
            const windowMs = 24 * 60 * 60 * 1000; // 1 يوم

            if ((now - windowStart) < windowMs) {
              // نفس اليوم
              const rpdUsed = usage.rpd.used || 0;
              if (rpdUsed < rpdLimit) {
                isAvailable = true; // متاح الآن
              }
            } else {
              // انتهى اليوم - الكوتة تجددت
              isAvailable = true;
            }
          } else {
            // لا يوجد windowStart - متاح
            isAvailable = true;
          }

          // 4. إذا كان متاحاً، إزالة من الاستثناء
          if (isAvailable) {
            console.log(`✅ [RETRY-EXCLUDED] النموذج ${excluded.modelName} متاح الآن - إزالة من الاستثناء`);
            await this.removeExcludedModel(excluded.id);
            continue;
          }

          // 5. إذا لم يكن متاحاً، تحديث retryAt
          let newRetryAt;
          if (excluded.retryCount === 0) {
            // المحاولة الأولى فشلت - إعادة المحاولة بعد 3 ساعات
            newRetryAt = new Date(now.getTime() + 3 * 60 * 60 * 1000);
            await this.prisma.excludedModel.update({
              where: { id: excluded.id },
              data: {
                retryAt: newRetryAt,
                retryCount: 1,
                lastRetryAt: now
              }
            });
            console.log(`⏰ [RETRY-EXCLUDED] النموذج ${excluded.modelName} لا يزال مستنفد - إعادة المحاولة بعد 3 ساعات: ${newRetryAt.toISOString()}`);
          } else if (excluded.retryCount === 1) {
            // المحاولة الثانية فشلت - إعادة المحاولة مع اليوم الجديد
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0); // بداية اليوم التالي
            newRetryAt = tomorrow;
            
            await this.prisma.excludedModel.update({
              where: { id: excluded.id },
              data: {
                retryAt: newRetryAt,
                retryCount: 2,
                lastRetryAt: now
              }
            });
            console.log(`⏰ [RETRY-EXCLUDED] النموذج ${excluded.modelName} لا يزال مستنفد - إعادة المحاولة مع اليوم الجديد: ${newRetryAt.toISOString()}`);
          } else {
            // retryCount >= 2 - إعادة المحاولة مع اليوم الجديد
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            newRetryAt = tomorrow;
            
            await this.prisma.excludedModel.update({
              where: { id: excluded.id },
              data: {
                retryAt: newRetryAt,
                lastRetryAt: now
              }
            });
            console.log(`⏰ [RETRY-EXCLUDED] النموذج ${excluded.modelName} لا يزال مستنفد - إعادة المحاولة مع اليوم الجديد: ${newRetryAt.toISOString()}`);
          }

          // تحديث الذاكرة المؤقتة
          const cacheKey = `${excluded.modelName}_${excluded.keyId}_${excluded.companyId}`;
          this.excludedModels.set(cacheKey, {
            modelName: excluded.modelName,
            keyId: excluded.keyId,
            companyId: excluded.companyId,
            reason: excluded.reason,
            excludedAt: excluded.excludedAt,
            retryAt: newRetryAt,
            retryCount: excluded.retryCount + 1
          });

        } catch (error) {
          console.error(`❌ [RETRY-EXCLUDED] خطأ في التحقق من النموذج ${excluded.modelName}:`, error);
        }
      }

    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في التحقق من النماذج المستثناة:', error);
    }
  }

  /**
   * إزالة نموذج من الاستثناء
   * @param {string} excludedId - معرف الاستثناء
   */
  async removeExcludedModel(excludedId) {
    try {
      const excluded = await this.prisma.excludedModel.findUnique({
        where: { id: excludedId }
      });

      if (excluded) {
        // إزالة من قاعدة البيانات
        await this.prisma.excludedModel.delete({
          where: { id: excludedId }
        });

        // إزالة من الذاكرة المؤقتة
        const cacheKey = `${excluded.modelName}_${excluded.keyId}_${excluded.companyId}`;
        this.excludedModels.delete(cacheKey);

        console.log(`✅ [REMOVE-EXCLUDED] تم إزالة النموذج ${excluded.modelName} من الاستثناء`);
      }
    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في إزالة النموذج من الاستثناء:', error);
    }
  }

  /**
   * اختيار أفضل نموذج بناءً على الأولوية والكوتة الإجمالية
   * - لكل نموذج حسب الأولوية:
   *   1. حساب الكوتة الإجمالية
   *   2. فحص إذا كان متجاوز 80% → تخطي
   *   3. فحص RPD → إذا 100% → استثناء
   *   4. فحص الاستثناءات → إذا مستثنى → تخطي
   *   5. اختيار المفتاح التالي (Round-Robin)
   *   6. إرجاع النموذج المختار
   * @param {string} companyId - معرف الشركة
   * @returns {Promise<Object|null>} - النموذج المختار أو null
   */
  async findBestModelByPriorityWithQuota(companyId) {
    try {
      if (!companyId) {
        console.error('❌ [MODEL-MANAGER] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      // 1. الحصول على قائمة النماذج المدعومة مرتبة حسب الأولوية
      const supportedModels = this.getSupportedModels();

      console.log(`🔍 [QUOTA-PRIORITY] البحث عن أفضل نموذج للشركة ${companyId} من ${supportedModels.length} نموذج`);

      // 2. لكل نموذج حسب الأولوية
      for (const modelName of supportedModels) {
        try {
          // 3. حساب الكوتة الإجمالية
          const quota = await this.calculateTotalQuota(modelName, companyId);

          // 4. فحص إذا كان متجاوز 80%
          if (quota.rpmPercentage >= 80 || quota.tpmPercentage >= 80) {
            console.log(`⚠️ [QUOTA-PRIORITY] ${modelName} قرب يخلص (RPM: ${quota.rpmPercentage.toFixed(1)}%, TPM: ${quota.tpmPercentage.toFixed(1)}%) - تخطي`);
            continue; // انتقل للنموذج التالي
          }

          // 5. فحص RPD (إذا كان 100%، استثناء)
          if (quota.rpdPercentage >= 100) {
            console.log(`⚠️ [QUOTA-PRIORITY] ${modelName} استنفد RPD (${quota.rpdPercentage.toFixed(1)}%) - استثناء`);
            
            // استثناء النموذج من كل المفاتيح المتاحة (فقط إذا لم يكن مستثنى بالفعل)
            for (const modelRecord of quota.availableModels) {
              const alreadyExcluded = await this.isModelExcluded(modelName, modelRecord.keyId, companyId);
              if (!alreadyExcluded) {
                await this.excludeModel(modelName, modelRecord.keyId, companyId, 'RPD_EXHAUSTED');
              }
            }
            continue;
          }

          // 6. فحص الاستثناءات (تخطي النماذج المستثناة)
          const availableModelsAfterExclusion = [];
          for (const modelRecord of quota.availableModels) {
            const isExcluded = await this.isModelExcluded(modelName, modelRecord.keyId, companyId);
            if (!isExcluded) {
              availableModelsAfterExclusion.push(modelRecord);
            }
          }

          if (availableModelsAfterExclusion.length === 0) {
            console.log(`⚠️ [QUOTA-PRIORITY] ${modelName} كل النماذج مستثناة - تخطي`);
            continue;
          }

          // 7. اختيار المفتاح التالي (Round-Robin)
          const selectedModel = await this.selectNextKeyRoundRobin(
            availableModelsAfterExclusion,
            this.lastUsedGlobalKeyId
          );

          if (selectedModel) {
            console.log(`✅ [QUOTA-PRIORITY] تم اختيار النموذج: ${selectedModel.model} (Key: ${selectedModel.key.name}, Priority: ${selectedModel.priority})`);
            
            return {
              apiKey: selectedModel.key.apiKey,
              model: selectedModel.model,
              keyId: selectedModel.keyId,
              modelId: selectedModel.id,
              keyName: selectedModel.key.name,
              quota: quota
            };
          }

        } catch (error) {
          console.error(`❌ [QUOTA-PRIORITY] خطأ في فحص النموذج ${modelName}:`, error);
          continue; // انتقل للنموذج التالي
        }
      }

      console.log(`❌ [QUOTA-PRIORITY] لم يتم العثور على نموذج متاح للشركة ${companyId}`);
      return null;

    } catch (error) {
      console.error('❌ [MODEL-MANAGER] خطأ في اختيار أفضل نموذج:', error);
      return null;
    }
  }
}

module.exports = ModelManager;

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
      const activeKey = await this.getActiveGeminiKey(companyId);
      
      if (!activeKey) {
        // Fallback: محاولة تفعيل أول مفتاح متاح تلقائياً
        const autoActivatedKey = await this.findAndActivateFirstAvailableKey(companyId);
        if (autoActivatedKey) {
          return autoActivatedKey;
        }
        return null;
      }

      // البحث عن أفضل نموذج متاح في هذا المفتاح
      const bestModel = await this.findBestAvailableModelInActiveKey(activeKey.id);
      
      if (bestModel) {
        // ✅ FIX: لا نحدث الاستخدام هنا - سيتم تحديثه بعد نجاح الطلب فقط
        // هذا يضمن دقة عداد الاستخدام
        return {
          apiKey: activeKey.apiKey,
          model: bestModel.model,
          keyId: activeKey.id,
          modelId: bestModel.id
        };
      }

      // البحث عن نموذج احتياطي للشركة
      const backupModel = await this.findNextAvailableModel(companyId);
      if (backupModel) {
        return {
          apiKey: backupModel.apiKey,
          model: backupModel.model,
          keyId: backupModel.keyId,
          modelId: backupModel.modelId || null, // ✅ FIX: إضافة modelId للنموذج الاحتياطي
          switchType: backupModel.switchType
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
      // ✅ قائمة النماذج المتوفرة (جميع النماذج المدعومة)
      const supportedModels = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
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

        // فحص إضافي: إذا كان النموذج يبدو متاحاً لكن تم تحديثه مؤخراً كمستنفد
        if (forceRefresh && usage.exhaustedAt) {
          const exhaustedTime = new Date(usage.exhaustedAt);
          const now = new Date();
          const timeDiff = now - exhaustedTime;

          // إذا تم تحديد النموذج كمستنفد خلال آخر 5 دقائق، تجاهله
          if (timeDiff < 5 * 60 * 1000) {
            continue;
          }
        }

        if (currentUsage < maxRequests) {
          return modelRecord;
        }
      }

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
   * تحديث عداد الاستخدام لنموذج معين
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
        const usage = JSON.parse(modelRecord.usage || '{"used": 0, "limit": 1000000}'); // ✅ FIX: استخدام modelRecord بدلاً من model
        const newUsage = {
          ...usage,
          used: (usage.used || 0) + 1,
          lastUpdated: new Date().toISOString()
        };

        await this.prisma.geminiKeyModel.update({
          where: {
            id: modelId
          },
          data: {
            usage: JSON.stringify(newUsage),
            lastUsed: new Date(),
            updatedAt: new Date()
          }
        });

        console.log(`✅ [USAGE-UPDATE] Updated usage for model ${modelRecord.model} (${modelId}): ${newUsage.used}/${usage.limit || 1000000}`);
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
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
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
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
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
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
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

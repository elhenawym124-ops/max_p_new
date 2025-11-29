/**
 * Settings Manager Module
 * 
 * هذا الـ module مسؤول عن إدارة إعدادات الذكاء الاصطناعي: جلب الإعدادات، تحديثها، جلب prompts الشركة
 * تم نقله من aiAgentService.js لتسهيل الصيانة
 */

const { getSharedPrismaClient, safeQuery } = require('../sharedDatabase');
// ✅ استخدام الـ constants المركزي
const { DEFAULT_AI_SETTINGS } = require('./aiConstants');

class SettingsManager {
  constructor(aiAgentService) {
    this.prisma = getSharedPrismaClient();
    // ✅ حفظ reference لـ aiAgentService للوصول للدوال المساعدة
    this.aiAgentService = aiAgentService;
  }

  /**
   * Get company prompts and settings
   */
  async getCompanyPrompts(companyId, customPrompt = null) {
    ////console.log('🔍 Getting company prompts for:', companyId);

    // Require companyId for security
    if (!companyId) {
      console.error('❌ [SECURITY] companyId is required for getCompanyPrompts');
      return {
        personalityPrompt: null,
        responsePrompt: null,
        hasCustomPrompts: false,
        source: 'none'
      };
    }

    try {
      // 0. HIGHEST PRIORITY: Check for custom prompt passed in messageData (for comments)
      if (customPrompt && customPrompt.trim()) {
        //console.log('✅ [CUSTOM-PROMPT] Using custom prompt from message data');
        return {
          personalityPrompt: customPrompt,
          responsePrompt: null,
          hasCustomPrompts: true,
          source: 'custom_message_prompt',
          promptName: 'Custom Comment/Post Prompt'
        };
      }
      
      // 1. First check for active system prompt (highest priority)
      ////console.log('🔍 Checking for active system prompt...');

      try {
        const activeSystemPrompt = await safeQuery(async () => {
          return await this.prisma.systemPrompt.findFirst({
            where: {
              isActive: true,
              companyId: companyId  // إضافة فلترة حسب الشركة للأمان
            },
            orderBy: { updatedAt: 'desc' }
          });
        }, 5); // Priority 5 - عملية عادية (جلب prompts)

        if (activeSystemPrompt) {
          ////console.log('✅ Found active system prompt:', activeSystemPrompt.name);
          ////console.log('📝 Prompt length:', activeSystemPrompt.content.length, 'characters');
          return {
            personalityPrompt: activeSystemPrompt.content,
            responsePrompt: null,
            hasCustomPrompts: true,
            source: 'system_prompt',
            promptName: activeSystemPrompt.name
          };
        } else {
          ////console.log('❌ No active system prompt found');
        }
      } catch (systemPromptError) {
        console.error('❌ Error checking system prompts:', systemPromptError.message);
        ////console.log('⚠️ Falling back to other prompt sources...');
      }

      // 2. Check AI settings table
      ////console.log('🔍 Checking AI settings table...');
      try {
        const aiSettings = await safeQuery(async () => {
          return await this.prisma.aiSettings.findFirst({
            where: { companyId }
          });
        }, 5); // Priority 5 - عملية عادية (جلب إعدادات)

        if (aiSettings && (aiSettings.personalityPrompt || aiSettings.responsePrompt)) {
          ////console.log('✅ Found prompts in AI settings');
          return {
            personalityPrompt: aiSettings.personalityPrompt,
            responsePrompt: aiSettings.responsePrompt,
            responseRules: aiSettings.responseRules, // ✅ إضافة قواعد الاستجابة
            hasCustomPrompts: !!(aiSettings.personalityPrompt || aiSettings.responsePrompt),
            source: 'ai_settings'
          };
        } else {
          ////console.log('❌ No prompts in AI settings');
        }
      } catch (aiSettingsError) {
        console.error('❌ Error checking AI settings:', aiSettingsError.message);
      }

      // 3. Fallback to company table
      ////console.log('🔍 Checking company table...');
      try {
        const company = await safeQuery(async () => {
          return await this.prisma.company.findUnique({
            where: { id: companyId }
          });
        }, 5); // Priority 5 - عملية عادية (جلب prompts)

        if (company && (company.personalityPrompt || company.responsePrompt)) {
          ////console.log('✅ Found prompts in company table');
          return {
            personalityPrompt: company.personalityPrompt,
            responsePrompt: company.responsePrompt,
            hasCustomPrompts: !!(company.personalityPrompt || company.responsePrompt),
            source: 'company'
          };
        } else {
          ////console.log('❌ No prompts in company table');
        }
      } catch (companyError) {
        console.error('❌ Error checking company table:', companyError.message);
      }

      ////console.log('❌ No custom prompts found, using default');
      return {
        personalityPrompt: null,
        responsePrompt: null,
        hasCustomPrompts: false,
        source: 'default'
      };
    } catch (error) {
      console.error('❌ Error getting company prompts:', error);
      return {
        personalityPrompt: null,
        responsePrompt: null,
        hasCustomPrompts: false,
        source: 'error'
      };
    }
  }

  /**
   * Reload system prompt (called when prompt is activated)
   */
  async reloadSystemPrompt() {
    try {
      ////console.log('🔄 Reloading system prompt...');
      // Clear any cached prompts if needed
      if (this.aiAgentService.cachedPrompts) {
        this.aiAgentService.cachedPrompts = null;
      }
      ////console.log('✅ System prompt reloaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Error reloading system prompt:', error);
      return false;
    }
  }

  /**
   * Get AI settings
   */
  async getSettings(companyId) {
    try {
      ////console.log('🔍 [aiAgentService] Loading settings from database...');

      // Require companyId for security
      if (!companyId) {
        console.error('❌ [SECURITY] companyId is required for getSettings');
        return {
          isEnabled: false,
          workingHours: { start: '09:00', end: '18:00' },
          workingHoursEnabled: false,
          maxRepliesPerCustomer: 5,
          multimodalEnabled: true,
          ragEnabled: true,
          learningEnabled: true,
          replyMode: 'all' // ✅ Default reply mode
        };
      }

      const company = await safeQuery(async () => {
        return await this.prisma.company.findUnique({ where: { id: companyId } });
      }, 5); // Priority 5 - عملية عادية (جلب إعدادات)
      ////console.log(`🏢 [aiAgentService] Using specific company: ${companyId}`);
      if (!company) {
        ////console.log('❌ [aiAgentService] No company found');
        return {
          isEnabled: false,
          workingHours: { start: '09:00', end: '18:00' },
          workingHoursEnabled: false,
          maxRepliesPerCustomer: 5,
          multimodalEnabled: true,
          ragEnabled: true,
          learningEnabled: true,
          replyMode: 'all' // ✅ Default reply mode
        };
      }

      ////console.log(`🏢 [aiAgentService] Company: ${company.id}`);

      // Get AI settings for the company
      const aiSettings = await safeQuery(async () => {
        return await this.prisma.aiSettings.findFirst({
          where: { companyId: company.id },
          select: {
            id: true,
            companyId: true,
            replyMode: true, // ✅ Explicitly select replyMode
            autoReplyEnabled: true,
            maxRepliesPerCustomer: true,
            multimodalEnabled: true,
            ragEnabled: true,
            workingHours: true,
            workingHoursEnabled: true,
            maxMessagesPerConversation: true,
            memoryRetentionDays: true,
            aiTemperature: true,
            aiTopP: true,
            aiTopK: true,
            aiMaxTokens: true,
            aiResponseStyle: true,
            enableDiversityCheck: true,
            enableToneAdaptation: true,
            enableEmotionalResponse: true,
            enableSmartSuggestions: true,
            enableLongTermMemory: true,
            enablePatternApplication: true,
            patternPriority: true,
            minQualityScore: true,
            enableLowQualityAlerts: true,
            maxConversationsPerUser: true,
            autoCleanup: true,
            compressionEnabled: true
          }
        });
      }, 5); // Priority 5 - عملية عادية (جلب إعدادات)

      // //console.log(`⚙️ [aiAgentService] AI Settings found: ${!!aiSettings}`);
      // //console.log(`🔍 [aiAgentService] Raw aiSettings from DB:`, {
      //   id: aiSettings?.id,
      //   companyId: aiSettings?.companyId,
      //   replyMode: aiSettings?.replyMode,
      //   autoReplyEnabled: aiSettings?.autoReplyEnabled,
      //   allKeys: aiSettings ? Object.keys(aiSettings) : []
      // });
      
      // ✅ Enhanced logging for replyMode debugging
      if (aiSettings) {
        // //console.log(`🔍 [aiAgentService] ReplyMode value from DB: "${aiSettings.replyMode}" (type: ${typeof aiSettings.replyMode})`);
        // //console.log(`🔍 [aiAgentService] ReplyMode === 'new_only': ${aiSettings.replyMode === 'new_only'}`);
        // //console.log(`🔍 [aiAgentService] ReplyMode === 'all': ${aiSettings.replyMode === 'all'}`);
      }

      if (!aiSettings) {
        ////console.log('❌ [aiAgentService] No AI settings found, returning defaults');
        return {
          isEnabled: false,
          workingHours: { start: '09:00', end: '18:00' },
          workingHoursEnabled: false,
          maxRepliesPerCustomer: 5,
          multimodalEnabled: true,
          ragEnabled: true,
          learningEnabled: true,
          replyMode: 'all' // ✅ Default reply mode
        };
      }

      ////console.log('🔍 [aiAgentService] Raw settings:', {
      //   autoReplyEnabled: aiSettings.autoReplyEnabled,
      //   workingHours: aiSettings.workingHours,
      //   maxRepliesPerCustomer: aiSettings.maxRepliesPerCustomer,
      //   multimodalEnabled: aiSettings.multimodalEnabled,
      //   ragEnabled: aiSettings.ragEnabled,
      //   hasPersonalityPrompt: !!aiSettings.personalityPrompt
      // });

      // Parse working hours
      let workingHours = { start: '09:00', end: '18:00' };
      try {
        if (aiSettings.workingHours) {
          workingHours = JSON.parse(aiSettings.workingHours);
          ////console.log('✅ [aiAgentService] Working hours parsed:', workingHours);
        }
      } catch (e) {
        ////console.log('⚠️ [aiAgentService] Failed to parse working hours, using defaults');
      }

      // Check if working hours are enabled (for now, disable working hours check)
      const workingHoursEnabled = false; // aiSettings.workingHoursEnabled || false;
      ////console.log(`🕐 [aiAgentService] Working hours check ${workingHoursEnabled ? 'ENABLED' : 'DISABLED'} - AI will work ${workingHoursEnabled ? 'within working hours only' : '24/7'}`);

      const settings = {
        isEnabled: aiSettings.autoReplyEnabled || false,
        autoReplyEnabled: aiSettings.autoReplyEnabled || false, // ✅ Alias for backward compatibility
        workingHours,
        workingHoursEnabled,
        maxRepliesPerCustomer: aiSettings.maxRepliesPerCustomer || 5,
        multimodalEnabled: aiSettings.multimodalEnabled || true,
        ragEnabled: aiSettings.ragEnabled || true,
        learningEnabled: true, // Always enabled for now
        replyMode: aiSettings.replyMode ?? 'all', // ✅ FIXED: Use nullish coalescing instead of ||
        // Memory controls
        maxMessagesPerConversation: aiSettings.maxMessagesPerConversation || 50,
        memoryRetentionDays: aiSettings.memoryRetentionDays || 30,
        // ✅ Dynamic generation config (القيم من قاعدة البيانات - مصدرها الواجهة)
        // ⚠️ القيمة الافتراضية موجودة في الواجهة فقط (AIManagement.tsx)
        aiTemperature: aiSettings.aiTemperature ?? DEFAULT_AI_SETTINGS.TEMPERATURE,
        aiTopP: aiSettings.aiTopP ?? DEFAULT_AI_SETTINGS.TOP_P,
        aiTopK: aiSettings.aiTopK ?? DEFAULT_AI_SETTINGS.TOP_K,
        aiMaxTokens: aiSettings.aiMaxTokens ?? DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS, // ⚠️ fallback فقط
        aiResponseStyle: aiSettings.aiResponseStyle || 'balanced',
        // Smart behavior toggles
        enableDiversityCheck: aiSettings.enableDiversityCheck !== false,
        enableToneAdaptation: aiSettings.enableToneAdaptation !== false,
        enableEmotionalResponse: aiSettings.enableEmotionalResponse !== false,
        enableSmartSuggestions: aiSettings.enableSmartSuggestions || false,
        enableLongTermMemory: aiSettings.enableLongTermMemory || false,
        // Pattern application and quality
        enablePatternApplication: aiSettings.enablePatternApplication !== false,
        patternPriority: aiSettings.patternPriority || 'balanced',
        minQualityScore: aiSettings.minQualityScore ?? 70,
        enableLowQualityAlerts: aiSettings.enableLowQualityAlerts !== false
      };

      // ✅ Enhanced logging: Show what we're returning
      //console.log(`📤 [aiAgentService] Returning settings with replyMode: "${settings.replyMode}"`);
      //console.log(`📤 [aiAgentService] Raw replyMode from DB: "${aiSettings.replyMode}" (type: ${typeof aiSettings.replyMode})`);
      
      return settings;

    } catch (error) {
      console.error('❌ [aiAgentService] Error loading settings:', error);
      return {
        isEnabled: false,
        autoReplyEnabled: false, // ✅ Alias for backward compatibility
        workingHours: { start: '09:00', end: '18:00' },
        workingHoursEnabled: false,
        maxRepliesPerCustomer: 5,
        multimodalEnabled: true,
        ragEnabled: true,
        learningEnabled: true,
        replyMode: 'all' // ✅ Default reply mode
      };
    }
  }

  /**
   * Update AI settings in database
   */
  async updateSettings(settings, companyId) {
    try {
      ////console.log('🔧 [AIAgent] Updating AI settings:', settings);

      // Require companyId for security
      if (!companyId) {
        throw new Error('Company ID is required for security');
      }

      const company = await safeQuery(async () => {
        return await this.prisma.company.findUnique({ where: { id: companyId } });
      }, 5); // Priority 5 - عملية عادية

      if (!company) {
        throw new Error(`Company ${companyId} not found`);
      }

      // Check if AI settings exist
      let aiSettings = await safeQuery(async () => {
        return await this.prisma.aiSettings.findUnique({
          where: { companyId: company.id }
        });
      }, 5); // Priority 5 - عملية عادية

      if (aiSettings) {
        // Update existing settings
        aiSettings = await safeQuery(async () => {
          return await this.prisma.aiSettings.update({
            where: { companyId: company.id },
            data: {
              autoReplyEnabled: settings.isEnabled !== undefined ? settings.isEnabled : aiSettings.autoReplyEnabled,
              workingHours: settings.workingHours ? JSON.stringify(settings.workingHours) : aiSettings.workingHours,
              workingHoursEnabled: settings.workingHoursEnabled !== undefined ? settings.workingHoursEnabled : aiSettings.workingHoursEnabled,
              maxRepliesPerCustomer: settings.maxRepliesPerCustomer !== undefined ? settings.maxRepliesPerCustomer : aiSettings.maxRepliesPerCustomer,
              multimodalEnabled: settings.multimodalEnabled !== undefined ? settings.multimodalEnabled : aiSettings.multimodalEnabled,
              ragEnabled: settings.ragEnabled !== undefined ? settings.ragEnabled : aiSettings.ragEnabled,
              replyMode: settings.replyMode !== undefined ? settings.replyMode : aiSettings.replyMode,
              updatedAt: new Date()
            }
          });
        }, 5); // Priority 5 - عملية عادية
      } else {
        // Create new settings
        aiSettings = await safeQuery(async () => {
          return await this.prisma.aiSettings.create({
            data: {
              companyId: company.id,
              autoReplyEnabled: settings.isEnabled || false,
              workingHours: settings.workingHours ? JSON.stringify(settings.workingHours) : JSON.stringify({ start: '09:00', end: '18:00' }),
              workingHoursEnabled: settings.workingHoursEnabled || false,
              maxRepliesPerCustomer: settings.maxRepliesPerCustomer || 5,
              multimodalEnabled: settings.multimodalEnabled !== undefined ? settings.multimodalEnabled : true,
              ragEnabled: settings.ragEnabled !== undefined ? settings.ragEnabled : true,
              replyMode: settings.replyMode || 'all'
            }
          });
        }, 5); // Priority 5 - عملية عادية
      }

      ////console.log('✅ [AIAgent] AI settings updated successfully');
      return aiSettings;

    } catch (error) {
      console.error('❌ [AIAgent] Error updating settings:', error);
      throw error;
    }
  }
}

module.exports = SettingsManager;

const { getSharedPrismaClient } = require('./sharedDatabase');
const memoryService = require('./memoryService');
const ContinuousLearningServiceV2 = require('./continuousLearningServiceV2');
const QualityMonitorService = require('./qualityMonitorService');
const PatternApplicationService = require('./patternApplicationService');
const PromptEnhancementService = require('./promptEnhancementService');
const ResponseOptimizer = require('./responseOptimizer');
const AIErrorHandler = require('./aiErrorHandler'); // نظام معالجة أخطاء الذكاء الاصطناعي
const aiResponseMonitor = require('./aiResponseMonitor'); // نظام مراقبة ردود AI
// ✅ استخدام الـ constants المركزي
const { DEFAULT_AI_SETTINGS } = require('./services/aiAgent/aiConstants');
// ✅ استخدام قواعد الاستجابة
const { buildPromptFromRules, getDefaultRules } = require('./services/aiAgent/responseRulesConfig');

// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues // Use shared database connection

class AIAgentService {
  constructor() {
    this.prisma = prisma;
    this.ragService = null;
    this.isInitialized = false;
    this.learningService = new ContinuousLearningServiceV2();
    this.qualityMonitor = new QualityMonitorService(); // نظام التقييم الذكي
    this.patternApplication = new PatternApplicationService(); // خدمة تطبيق الأنماط
    this.promptEnhancement = new PromptEnhancementService(); // خدمة تحسين الـ prompts
    this.responseOptimizer = new ResponseOptimizer(); // محسن الردود
    this.errorHandler = new AIErrorHandler(); // نظام معالجة أخطاء الذكاء الاصطناعي
    this.exhaustedModelsCache = new Set(); // ذاكرة مؤقتة للنماذج المستنفدة
    this.currentActiveModel = null; // النموذج النشط الحالي للجلسة
    //console.log('🧠 [AIAgent] Continuous Learning Service initialized');
    //console.log('📊 [AIAgent] Quality Monitor Service initialized');
    //console.log('🎯 [AIAgent] Pattern Application Service initialized');
    //console.log('🎨 [AIAgent] Prompt Enhancement Service initialized');
    //console.log('🚀 [AIAgent] Response Optimizer initialized');
    //console.log('🛡️ [AIAgent] AI Error Handler initialized');
  }

  /**
   * Get current active model for the session (with fallback to fresh lookup)
   */
  async getCurrentActiveModel(companyId) {
    console.log(`🔍 [AI-MODEL] getCurrentActiveModel called for company: ${companyId}`);
    // إذا تم تمرير companyId، احصل على نموذج جديد للشركة المحددة
    if (companyId) {
      console.log(`🔍 [AI-MODEL] Getting active model for company: ${companyId}`);
      const model = await this.getActiveGeminiKey(companyId);
      if (model) {
        console.log(`✅ [AI-MODEL] Active model found: ${model.model} (Key Type: ${model.keyType || 'COMPANY'})`);
      } else {
        console.error(`❌ [AI-MODEL] No active model found for company: ${companyId}`);
        // Check if company exists
        try {
          const company = await this.getSharedPrismaClient().company.findUnique({
            where: { id: companyId }
          });
          if (!company) {
            console.error(`❌ [AI-MODEL] Company does not exist in database: ${companyId}`);
          } else {
            // Check for active Gemini keys
            const geminiKeys = await this.getSharedPrismaClient().geminiKey.findMany({
              where: { 
                companyId: companyId,
                isActive: true
              }
            });
            console.error(`❌ [AI-MODEL] Company exists but has no active Gemini keys. Keys found:`, geminiKeys);
          }
        } catch (dbError) {
          console.error(`❌ [AI-MODEL] Database error while checking company/Gemini keys:`, dbError);
        }
      }
      return model;
    }

    // إذا لم يتم تمرير companyId، يجب رفض الطلب للأمان
    console.error('❌ [SECURITY] getCurrentActiveModel called without companyId - request denied');
    console.error('❌ [SECURITY] This is a security violation - all AI requests must be isolated by company');
    return null;
  }

  /**
   * Update current active model (used when switching)
   */
  updateCurrentActiveModel(newModel) {
    //console.log(`🔄 [DEBUG] Updating current active model to: ${newModel?.model}`);
    this.currentActiveModel = newModel;
  }

  /**
   * Get current time of day for pattern context
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Process customer message and generate AI response
   */
  async processCustomerMessage(messageData) {
    const startTime = Date.now(); // Move outside try block for error handling
    // ✅ FIX: Define finalCompanyId before try block to ensure it's available in catch block
    const { conversationId, senderId, content, attachments, customerData, companyId, customPrompt } = messageData || {};
    let finalCompanyId = companyId || customerData?.companyId;
    
    try {
      console.log(`🤖 [DEBUG] ===== Starting processCustomerMessage =====`);
      console.log(`📝 [DEBUG] Message content: "${messageData?.content?.substring(0, 100)}"`);
      console.log(messageData)
      
      // 🔍 Enhanced diagnostics
      //console.log(`🔍 [AI-PROCESS] Processing message for company: ${companyId || 'NULL'}`);
      //console.log(`🔍 [AI-PROCESS] Customer data:`, customerData);
      //console.log(`🔍 [AI-PROCESS] Message content: ${content.substring(0, 100)}...`);
      
      // 🔍 Additional diagnostics for companyId tracking
      if (!finalCompanyId) {
        console.error('❌ [SECURITY] processCustomerMessage called without companyId - this is a critical security issue');
        console.error('❌ [SECURITY] Message data:', JSON.stringify(messageData, null, 2));
      }

      // 🔍 فحص حالة الذكاء الاصطناعي للمحادثة
      if (conversationId) {
        try {
          const conversation = await this.getSharedPrismaClient().conversation.findUnique({
            where: { id: conversationId },
            select: { 
              id: true, 
              customerId: true, 
              metadata: true,
              createdAt: true 
            }
          });

          // التحقق من وجود حقل aiEnabled في metadata
          if (conversation && conversation.metadata) {
            try {
              const metadata = JSON.parse(conversation.metadata);
              if (metadata.aiEnabled === false) {
                //console.log(`🚫 [AI-DISABLED] AI is disabled for conversation ${conversationId}, skipping AI processing`);
                return {
                  success: false,
                  content: null,
                  reason: 'AI_DISABLED',
                  message: 'الذكاء الاصطناعي معطل لهذه المحادثة'
                };
              }
            } catch (metadataError) {
              console.warn('⚠️ [AI-CHECK] Could not parse conversation metadata, proceeding with AI processing');
            }
          }
          
          // ✅ NEW: Check Reply Mode setting
          console.log(`\n🔍 [REPLY-MODE-DEBUG] ==================== START ====================`);
          console.log(`🔍 [REPLY-MODE-DEBUG] Conversation ID: ${conversationId}`);
          console.log(`🔍 [REPLY-MODE-DEBUG] Company ID: ${companyId}`);
          console.log(`🔍 [REPLY-MODE-DEBUG] Message content preview: "${(content || '').substring(0, 50)}..."`);
          
          if (conversation && companyId) {
            try {
              const aiSettings = await this.getSettings(companyId);
              console.log(`🔍 [REPLY-MODE-DEBUG] AI Settings loaded:`, JSON.stringify({
                exists: !!aiSettings,
                replyMode: aiSettings?.replyMode,
                autoReplyEnabled: aiSettings?.autoReplyEnabled,
                isEnabled: aiSettings?.isEnabled
              }));
              
              // ✅ Enhanced debugging: Show actual replyMode value
              console.log(`🔍 [REPLY-MODE-DEBUG] ReplyMode value (direct): "${aiSettings?.replyMode}"`);
              console.log(`🔍 [REPLY-MODE-DEBUG] ReplyMode type: ${typeof aiSettings?.replyMode}`);
              console.log(`🔍 [REPLY-MODE-DEBUG] ReplyMode === 'new_only': ${aiSettings?.replyMode === 'new_only'}`);
              console.log(`🔍 [REPLY-MODE-DEBUG] ReplyMode === 'all': ${aiSettings?.replyMode === 'all'}`);
              
              if (aiSettings && aiSettings.replyMode === 'new_only') {
                console.log(`🔍 [REPLY-MODE-DEBUG] Reply mode is 'new_only' - checking if employee has replied...`);
                
                // ✅ NEW LOGIC: Check if there are any messages from EMPLOYEES in this conversation
                // A "new" conversation = conversation with NO employee messages
                // If an employee has replied, the conversation is now under human supervision → AI should not reply
                const employeeMessageCount = await this.getSharedPrismaClient().message.count({
                  where: {
                    conversationId,
                    isFromCustomer: false, // Not from customer
                    senderId: { not: null } // senderId exists = Employee (not AI)
                  }
                });
                
                console.log(`🔍 [REPLY-MODE-DEBUG] Employee message count in conversation: ${employeeMessageCount}`);
                console.log(`🔍 [REPLY-MODE-DEBUG] Conversation created at: ${conversation.createdAt}`);
                
                // Get all messages for debugging
                const allMessages = await this.getSharedPrismaClient().message.findMany({
                  where: { conversationId },
                  select: {
                    id: true,
                    isFromCustomer: true,
                    senderId: true,
                    content: true,
                    createdAt: true
                  },
                  orderBy: { createdAt: 'asc' },
                  take: 10
                });
                
                console.log(`🔍 [REPLY-MODE-DEBUG] Total messages in conversation: ${allMessages.length}`);
                console.log(`🔍 [REPLY-MODE-DEBUG] Message breakdown:`);
                allMessages.forEach((msg, idx) => {
                  const msgType = msg.isFromCustomer ? '👤 Customer' : (msg.senderId ? '👨‍💼 Employee' : '🤖 AI');
                  console.log(`   ${idx + 1}. ${msgType} | senderId: ${msg.senderId || 'null'} | createdAt: ${msg.createdAt} | "${(msg.content || '').substring(0, 50)}..."`);
                });
                
                // ✅ NEW LOGIC: If there are employee messages, this conversation is under human supervision
                // AI should not reply to avoid interference with human agents
                if (employeeMessageCount > 0) {
                  console.log(`🚫 [REPLY-MODE-DEBUG] DECISION: SKIP - Employee has replied (${employeeMessageCount} employee message(s) found)`);
                  console.log(`🔍 [REPLY-MODE-DEBUG] Reason: Conversation is now under human supervision - AI should not interfere`);
                  console.log(`🔍 [REPLY-MODE-DEBUG] ==================== END (SKIPPED) ====================\n`);
                  return {
                    success: false,
                    content: null,
                    reason: 'EMPLOYEE_REPLIED',
                    message: 'الذكاء الاصطناعي يرد على المحادثات الجديدة فقط - تم تدخل موظف'
                  };
                }
                
                console.log(`✅ [REPLY-MODE-DEBUG] DECISION: PROCEED - No employee messages found (${employeeMessageCount} employee message(s))`);
                console.log(`🔍 [REPLY-MODE-DEBUG] Reason: This conversation has no human intervention yet - AI can reply`);
              } else if (aiSettings) {
                console.log(`🔍 [REPLY-MODE-DEBUG] Reply mode is '${aiSettings.replyMode || 'all'}' - AI will reply to all messages`);
              } else {
                console.log(`🔍 [REPLY-MODE-DEBUG] No AI settings found - using default behavior`);
              }
              
              console.log(`🔍 [REPLY-MODE-DEBUG] ==================== END (PROCEEDING) ====================\n`);
            } catch (replyModeError) {
              console.error('❌ [REPLY-MODE-DEBUG] ERROR checking reply mode:', replyModeError);
              console.error('❌ [REPLY-MODE-DEBUG] Error details:', replyModeError.message);
              console.log(`🔍 [REPLY-MODE-DEBUG] ==================== END (ERROR) ====================\n`);
              console.warn('⚠️ [REPLY-MODE] Could not check reply mode, proceeding with AI processing:', replyModeError.message);
            }
          } else {
            console.log(`🔍 [REPLY-MODE-DEBUG] Missing conversation or companyId - skipping check`);
            console.log(`🔍 [REPLY-MODE-DEBUG] ==================== END (SKIPPED CHECK) ====================\n`);
          }
        } catch (error) {
          console.warn('⚠️ [AI-CHECK] Could not check AI status for conversation, proceeding with AI processing:', error.message);
        }
      }
      //console.log('🔍 [DEBUG] Extracted content:', content);
      //console.log('🔍 [DEBUG] Content type:', typeof content);
      //console.log('🔍 [DEBUG] Attachments:', attachments);
      //console.log('🔍 [DEBUG] messageData:', JSON.stringify(messageData, null, 2));

      // 🖼️ معالجة الصور إذا كانت موجودة
      if (attachments && attachments.length > 0) {
        //console.log(`🖼️ [IMAGE-PROCESSING] Found ${attachments.length} attachment(s)`);

        // التحقق من وجود صور
        const imageAttachments = attachments.filter(att =>
          att.type === 'image' ||
          (att.payload && att.payload.url && att.payload.url.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        );

        if (imageAttachments.length > 0) {
          //console.log(`🖼️ [IMAGE-PROCESSING] Found ${imageAttachments.length} image(s), processing with multimodal service...`);

          try {
            // استدعاء خدمة معالجة الصور
            const multimodalService = require('./multimodalService');
            const imageResult = await multimodalService.processImage(messageData);

            //console.log('🖼️ [IMAGE-PROCESSING] Image analysis result:', imageResult);

            if (imageResult && imageResult.type === 'image_analysis') {
              // بدلاً من الرد المباشر، نمرر النتيجة للـ AI Agent للرد بشخصية ساره
              //console.log('🖼️ [IMAGE-ANALYSIS] Processing image result with AI Agent...');

              // تحديد نوع الاستعلام بناءً على نتيجة تحليل الصورة
              const intent = imageResult.productMatch?.found ? 'product_inquiry' : 'general_inquiry';

              // إنشاء رسالة للـ AI Agent
              const imageContext = imageResult.processedContent;
              const customerMessage = messageData.content || 'العميل أرسل صورة';

              // معالجة الصورة بدون استخدام الذاكرة لضمان الاستقلالية
              const aiResponse = await this.processImageWithAI(
                imageContext,
                messageData,
                intent,
                imageResult.productMatch
              );

              // حفظ الرد النهائي في الذاكرة بدلاً من التحليل الخام
              await this.saveImageResponseToMemory(
                messageData,
                aiResponse.content,
                imageResult.productMatch
              );

              return {
                ...aiResponse,
                imageAnalysis: imageResult.analysis,
                imageUrl: imageResult.imageUrl,
                productMatch: imageResult.productMatch
              };
            } else if (imageResult && imageResult.type === 'image_error') {
              // معالجة أخطاء الصور مع الـ AI Agent للرد بشخصية ساره
              //console.log('❌ [IMAGE-ERROR] Processing image error with AI Agent...');
              //console.log('🔍 [IMAGE-ERROR] Error type:', imageResult.errorType);
              //console.log('📝 [IMAGE-ERROR] Error context:', imageResult.processedContent);

              // تحديد نوع الاستعلام بناءً على نوع الخطأ
              const intent = imageResult.errorType === 'general_error' ? 'product_inquiry' : 'general_inquiry';

              // إنشاء رسالة واضحة للـ AI Agent
              const imageContext = imageResult.processedContent;
              const customerMessage = messageData.content || 'العميل أرسل صورة';

              //console.log('🤖 [IMAGE-ERROR] Sending to AI:', `${customerMessage}\n\nتوضيح الموقف: ${imageContext}`);

              // معالجة الرسالة مع الـ AI Agent
              const aiResponse = await this.processWithAI(
                `${customerMessage}\n\nتوضيح الموقف: ${imageContext}`,
                messageData,
                intent
              );

              return {
                ...aiResponse,
                shouldEscalate: imageResult.shouldEscalate || false,
                errorType: imageResult.errorType || 'general_error'
              };
            }
          } catch (imageError) {
            console.error('❌ [IMAGE-PROCESSING] Error processing image:', imageError);
            // في حالة فشل معالجة الصورة، نكمل بالمعالجة النصية العادية
          }
        }
      }

      // Get active Gemini key using session-aware system with company isolation
      // ✅ FIX: finalCompanyId already defined at the start, just update if needed
      finalCompanyId = finalCompanyId || companyId || customerData?.companyId;
      //console.log(`🏢 [AI-PROCESS] Final company ID for processing: ${finalCompanyId || 'NULL'}`);
      
      // Enhanced diagnostics for companyId tracking
      if (!finalCompanyId) {
        console.error('❌ [SECURITY] No companyId available for AI processing - checking fallback options');
        console.error('❌ [SECURITY] companyId from messageData:', companyId);
        console.error('❌ [SECURITY] customerData.companyId:', customerData?.companyId);
      }
      
      // Fallback: Try to get company ID from database if not provided
      if (!finalCompanyId && customerData?.id) {
        try {
          //console.log(`🔄 [AI-PROCESS] Trying to get company ID from customer record`);
          const customerRecord = await this.getSharedPrismaClient().customer.findUnique({
            where: { id: customerData.id },
            select: { companyId: true }
          });
          if (customerRecord?.companyId) {
            finalCompanyId = customerRecord.companyId;
            //console.log(`✅ [AI-PROCESS] Found company ID from customer record: ${finalCompanyId}`);
          } else {
            console.error('❌ [AI-PROCESS] No companyId found in customer record');
            console.error('❌ [AI-PROCESS] Customer record:', customerRecord);
          }
        } catch (error) {
          console.error('❌ [AI-PROCESS] Error getting company ID from customer record:', error);
        }
      }
      
      if (!finalCompanyId) {
        console.error('❌ [SECURITY] No companyId available for AI processing - request denied');
        console.error('❌ [SECURITY] This is a critical security violation - all AI requests must be isolated by company');
        
        // تسجيل الفشل في نظام المراقبة
        await aiResponseMonitor.recordAIFailure({
          companyId: 'unknown',
          conversationId,
          customerId: senderId,
          errorType: 'security_error',
          errorMessage: 'No company ID found for security isolation',
          context: { messageData }
        });
        
        return {
          success: false,
          error: 'No company ID found for security isolation',
          content: null, // 🤐 النظام الصامت - لا نرسل رسالة للعميل
          shouldEscalate: false,
          silent: true, // 🤐 علامة النظام الصامت
          errorType: 'security_error'
        };
      }

      const geminiConfig = await this.getCurrentActiveModel(finalCompanyId);

      if (!geminiConfig) {
        console.error(`❌ No active Gemini key available for company: ${finalCompanyId}`);
        
        // تسجيل الفشل في نظام المراقبة
        await aiResponseMonitor.recordAIFailure({
          companyId: finalCompanyId,
          conversationId,
          customerId: senderId,
          errorType: 'no_api_key',
          errorMessage: 'No active Gemini API key found',
          context: { content: content.substring(0, 100) }
        });
        
        return {
          success: false,
          error: 'No active Gemini API key found',
          content: null, // 🤐 النظام الصامت - لا نرسل رسالة للعميل
          shouldEscalate: false,
          silent: true, // 🤐 علامة النظام الصامت
          errorType: 'no_api_key'
        };
      }

      //console.log(`✅ Using model: ${geminiConfig.model} from key: ${geminiConfig.keyId}`);

      // Initialize RAG service if not already done
      if (!this.ragService) {
        this.ragService = require('./ragService');
        await this.ragService.ensureInitialized();
      }

      // Get company prompts and settings (pass customPrompt if available)
      const companyPrompts = await this.getCompanyPrompts(finalCompanyId, customPrompt);

      // Get conversation memory with settings
      const settings = await this.getSettings(finalCompanyId);
      const memoryLimit = settings.maxMessagesPerConversation || 50;
      
      console.log('🧠 [MEMORY-SERVICE] جاري جلب سجل المحادثة...');
      console.log('  - conversationId:', conversationId);
      console.log('  - senderId:', senderId);
      console.log('  - memoryLimit:', memoryLimit);
      
      const conversationMemory = await memoryService.getConversationMemory(conversationId, senderId, memoryLimit, finalCompanyId);
      
      console.log('✅ [MEMORY-SERVICE] تم جلب سجل المحادثة:', conversationMemory.length, 'رسالة');
      if (conversationMemory.length > 0) {
        console.log('📋 [MEMORY-SERVICE] أول 3 رسائل:');
        conversationMemory.slice(0, 3).forEach((msg, i) => {
          console.log(`  ${i + 1}. [${msg.isFromCustomer ? 'عميل' : 'AI'}]: ${msg.content?.substring(0, 60)}...`);
        });
      } else {
        console.log('⚠️ [MEMORY-SERVICE] لا توجد رسائل سابقة - محادثة جديدة');
      }

      // Enhanced conversation context analysis
      const enhancedContext = await this.analyzeEnhancedConversationContext(content, conversationMemory, finalCompanyId);
      const intent = enhancedContext.intent;
      
      //console.log(`🎯 Enhanced analysis complete:`, {
      //   intent: enhancedContext.intent,
      //   confidence: enhancedContext.confidence,
      //   phase: enhancedContext.conversationPhase,
      //   engagement: enhancedContext.customerEngagement,
      //   direction: enhancedContext.conversationFlow.direction,
      //   memorySize: conversationMemory.length
      // });

      // Get unified smart response (images + RAG data)
      console.log(`🔍 [DEBUG] About to call getSmartResponse for: "${content.substring(0, 50)}"`);
      let smartResponse;
      try {
        smartResponse = await this.getSmartResponse(content, intent, conversationMemory, customerData?.id, finalCompanyId);
        console.log(`✅ [DEBUG] getSmartResponse completed. Images: ${smartResponse?.images?.length || 0}, RAG: ${smartResponse?.ragData?.length || 0}`);
      } catch (smartResponseError) {
        console.error('❌ [DEBUG] Error in getSmartResponse:', smartResponseError);
        // Fallback to empty response
        smartResponse = { images: [], ragData: [], hasSpecificProduct: false, productInfo: null };
      }
      const images = smartResponse.images || [];
      const ragData = smartResponse.ragData || [];
      const hasImages = images && images.length > 0;

      // Build advanced prompt with RAG data and enhanced context
      console.log(`🔍 [DEBUG] Building advanced prompt...`);
      console.log('📦 [DEBUG] Data being passed to buildAdvancedPrompt:');
      console.log('  - conversationMemory.length:', conversationMemory?.length || 0);
      console.log('  - ragData.length:', ragData?.length || 0);
      console.log('  - hasImages:', hasImages);
      console.log('  - customerData:', customerData?.name || 'No name');
      
      let advancedPrompt;
      try {
        advancedPrompt = await this.buildAdvancedPrompt(
          content,
          customerData,
          companyPrompts,
          ragData,
          conversationMemory, // Use full conversation memory respecting user settings
          hasImages,
          smartResponse,
          messageData
        );
        console.log(`✅ [DEBUG] Prompt built. Length: ${advancedPrompt?.length || 0} characters`);
      } catch (promptError) {
        console.error('❌ [DEBUG] Error building prompt:', promptError);
        throw promptError; // Re-throw to be caught by outer try-catch
      }

      //console.log('🧠 Using advanced prompt with RAG data');
      //console.log('📝 Prompt preview:', advancedPrompt.substring(0, 200) + '...');
      //console.log('📏 Total prompt length:', advancedPrompt.length, 'characters');

      // Generate AI response using the unified method with enhanced context
      console.log(`🔍 [DEBUG] Calling generateAIResponse...`);
      let aiContent;
      try {
        aiContent = await this.generateAIResponse(
          advancedPrompt,
          conversationMemory, // Use full conversation memory
          true, // useRAG
          null, // providedGeminiConfig
          finalCompanyId, // companyId for pattern tracking
          conversationId, // conversationId for pattern usage recording
          { 
            messageType: intent, 
            inquiryType: intent,
            conversationPhase: enhancedContext.conversationPhase,
            customerEngagement: enhancedContext.customerEngagement,
            topicContinuity: enhancedContext.topicContinuity
          } // Enhanced message context
        );
        console.log(`✅ [DEBUG] AI response generated. Length: ${aiContent?.length || 0} characters`);
      } catch (aiError) {
        console.error('❌ [DEBUG] Error generating AI response:', aiError);
        throw aiError; // Re-throw to be caught by outer try-catch
      }
      
      // Enhance the response with conversation state
      const enhancedResponse = this.enhanceResponseWithConversationState(
        aiContent, 
        {
          phase: enhancedContext.conversationPhase,
          engagement: enhancedContext.customerEngagement,
          needsRedirection: enhancedContext.needsRedirection,
          direction: enhancedContext.conversationFlow.direction,
          momentum: enhancedContext.conversationFlow.momentum
        },
        enhancedContext
      );
      
      let finalResponse = enhancedResponse || aiContent; // ✅ let instead of const - can be updated for order confirmation

      // ✅ FIX: Remove any image mentions from response text
      if (finalResponse && typeof finalResponse === 'string') {
        // Remove patterns like [صورة المنتج], [صورة كوتشي], etc.
        finalResponse = finalResponse.replace(/\[صورة[^\]]*\]/gi, '');
        // Remove phrases like "هبعتلك الصور", "الصور جاية", etc.
        finalResponse = finalResponse.replace(/(هبعتلك|هبعت|سأرسل|سأبعث|سأرسل لك|سأبعث لك)\s*(الصور?|صور?|صورة)/gi, '');
        finalResponse = finalResponse.replace(/الصور?\s*(جاية|جاي|جايين|ستُرسل|سترسل|ستُبعث|ستبعث)/gi, '');
        // Clean up extra spaces
        finalResponse = finalResponse.replace(/\s+/g, ' ').trim();
        console.log('🧹 [CLEANUP] Removed image mentions from response text');
      }

      // ⚡ IMPROVED Fallback 1: Only mention images if we're sure they will be sent
      if ((!finalResponse || finalResponse.trim().length === 0) && images && images.length > 0) {
        console.log(`🖼️ [FALLBACK] AI response empty but ${images.length} images available - checking if images are valid`);
        
        // ✅ Validate images before mentioning them in text
        const validImages = images.filter(image => {
          return image && image.payload && image.payload.url && 
                 image.payload.url.startsWith('http') && 
                 image.payload.url.length > 10;
        });
        
        if (validImages.length > 0) {
          console.log(`✅ [FALLBACK] ${validImages.length} valid images confirmed - adding fallback text`);
          finalResponse = validImages.length === 1 
            ? 'تفضل صورة المنتج 📸' 
            : `تفضل ${validImages.length} صور للمنتج 📸`;
        } else {
          console.log(`❌ [FALLBACK] No valid images found - not mentioning images in text`);
          finalResponse = 'كيف يمكنني مساعدتك؟ 😊';
        }
      }

      // ⚡ Fallback 2: If AI response is empty and user provided a governorate, reply with shipping info directly
      try {
        if (!finalResponse || finalResponse.trim().length === 0) {
          const shippingService = require('./shippingService');
          const extractedGov = await shippingService.extractGovernorateFromMessage(content, finalCompanyId);
          if (extractedGov && extractedGov.found) {
            const shippingInfo = await shippingService.findShippingInfo(extractedGov.governorate, finalCompanyId);
            if (shippingInfo && shippingInfo.found) {
              // Build a concise, action-oriented reply
              finalResponse = `تمام، الشحن لـ ${shippingInfo.governorate} ${shippingInfo.price} جنيه، والتوصيل خلال ${shippingInfo.deliveryTime} أيام.\nلو حابة نكمل الطلب ابعتي الاسم والعنوان ورقم الموبايل.`;
            } else {
              // If shipping not found, ask politely for alternative
              finalResponse = `بالنسبة لمحافظة ${extractedGov.governorate} مش متاح شحن حالياً. تحبي نرشح أقرب بديل أو نتواصل معك لحل مناسب؟`;
            }
          }
        }
      } catch (__shippingFallbackError) {
        // لا تؤثر على تدفق الرد في حال حدوث خطأ بالفallback
      }

      const processingTime = Date.now() - startTime;

      //console.log(`✅ AI response generated in ${processingTime}ms with RAG data`);

      // Save interaction to memory
      try {
        // ✅ تحسين: إضافة معلومات المنتج للـ memory لو كان في صور
        let memoryResponse = finalResponse;
        if (images && images.length > 0 && ragData && ragData.length > 0) {
          // استخراج اسم المنتج من ragData
          const productNames = ragData.map(p => p.name).filter(Boolean).join(', ');
          if (productNames) {
            memoryResponse = `${finalResponse}\n[المنتج: ${productNames}]`;
            console.log(`📝 [MEMORY-CONTEXT] Adding product context to memory: ${productNames}`);
          }
        }
        
        await memoryService.saveInteraction({
          conversationId,
          senderId,
          companyId: finalCompanyId, // ✅ إضافة companyId للعزل الأمني
          userMessage: content,
          aiResponse: memoryResponse, // ✅ Use enhanced response with product context
          intent,
          sentiment: this.analyzeSentiment(content),
          timestamp: new Date()
        });
        //console.log(`💾 Interaction saved to memory`);
      } catch (memoryError) {
        console.error('⚠️ Failed to save to memory:', memoryError.message);
      }



      // Collect learning data for continuous improvement
      try {
        const sentiment = this.analyzeSentiment(content);
        await this.collectLearningData({
          companyId,
          customerId: senderId,
          conversationId,
          userMessage: content,
          aiResponse: finalResponse, // Use enhanced response
          intent,
          sentiment,
          processingTime,
          ragDataUsed: ragData.length > 0,
          memoryUsed: conversationMemory.length > 0,
          model: this.currentActiveModel?.model || geminiConfig.model,
          confidence: enhancedContext.confidence,
          // Enhanced conversation flow data
          conversationPhase: enhancedContext.conversationPhase,
          customerEngagement: enhancedContext.customerEngagement,
          topicContinuity: enhancedContext.topicContinuity,
          conversationDirection: enhancedContext.conversationFlow.direction,
          conversationMomentum: enhancedContext.conversationFlow.momentum,
          contextualCues: enhancedContext.contextualCues
        });
        //console.log(`📊 [AIAgent] Learning data collected for conversation: ${conversationId}`);
      } catch (learningError) {
        console.error('⚠️ [AIAgent] Failed to collect learning data:', learningError.message);
      }

      // فحص إذا كان العميل يرسل بيانات مطلوبة لطلب معلق
      const pendingOrderData = await this.checkForPendingOrderData(content, conversationMemory);
      if (pendingOrderData.isProvidingData) {
        //console.log('📋 [DATA-COLLECTION] العميل يرسل بيانات لطلب معلق...');

        // محاولة إنشاء الطلب بالبيانات الجديدة
        const orderCreationResult = await this.attemptOrderCreationWithNewData(pendingOrderData, messageData, conversationId);
        if (orderCreationResult) {
          return orderCreationResult;
        }
      }

      // Check if customer is confirming an order
      const orderConfirmation = await this.detectOrderConfirmation(content, conversationMemory, messageData.customerData?.id, companyId);
      let orderCreated = null;

      if (orderConfirmation.isConfirming) {
        //console.log('✅ [ORDER-CONFIRMATION] تم اكتشاف تأكيد الطلب');

        // محاولة استخراج تفاصيل الطلب إذا لم تكن موجودة
        if (!orderConfirmation.orderDetails) {
          //console.log('🔍 [ORDER-EXTRACTION] محاولة استخراج تفاصيل الطلب من المحادثة...');
          orderConfirmation.orderDetails = await this.extractOrderDetailsFromMemory(conversationMemory, finalCompanyId, content);
        }

        if (orderConfirmation.orderDetails) {
        //console.log('🛒 Customer is confirming order, checking data completeness...');

        // فحص اكتمال البيانات قبل إنشاء الطلب
        const dataCompleteness = await this.checkDataCompleteness(orderConfirmation.orderDetails, conversationMemory, content);

        // ✅ استخدام البيانات المحدثة من checkDataCompleteness
        const finalOrderDetails = dataCompleteness.updatedOrderDetails || orderConfirmation.orderDetails;

        if (!dataCompleteness.isComplete) {
          //console.log('📋 [DATA-COLLECTION] البيانات غير مكتملة، طلب البيانات المفقودة...');
          //console.log('📋 [DATA-COLLECTION] البيانات المفقودة:', dataCompleteness.missingData);

          // إنشاء رد لطلب البيانات المفقودة
          const dataRequestResponse = await this.generateDataRequestResponse(dataCompleteness.missingData, finalOrderDetails, finalCompanyId);

          // إرجاع الرد لطلب البيانات بدلاً من إنشاء الطلب
          return {
            success: true,
            content: dataRequestResponse,
            model: geminiConfig?.model,
            keyId: geminiConfig?.id,
            processingTime: Date.now() - startTime,
            intent: 'data_collection',
            sentiment: this.analyzeSentiment(content),
            confidence: 0.9,
            shouldEscalate: false,
            switchType: 'normal',
            ragDataUsed: false,
            memoryUsed: true,
            images: [],
            orderCreated: null,
            dataCollection: {
              isRequesting: true,
              missingData: dataCompleteness.missingData,
              orderDetails: finalOrderDetails
            }
          };
        }

        //console.log('✅ [DATA-COLLECTION] البيانات مكتملة، إنشاء الطلب...');
        try {
          // استخدام الخدمة المحسنة للطلبات
          const EnhancedOrderService = require('./enhancedOrderService');
          const enhancedOrderService = new EnhancedOrderService();

          //console.log('🚀 [AI-AGENT] استخدام الخدمة المحسنة لإنشاء الطلب...');

          // الحصول على companyId الصحيح - يجب استخدام finalCompanyId المؤكد
          const orderCompanyId = finalCompanyId || customerData?.companyId;

          // التأكد من وجود companyId قبل إنشاء الأوردر
          if (!orderCompanyId) {
            console.error('❌ [SECURITY] لا يمكن إنشاء أوردر بدون companyId - رفض الطلب');
            throw new Error('Company ID is required for order creation');
          }

          //console.log('🏢 [ORDER-CREATION] إنشاء أوردر للشركة:', orderCompanyId);

          // ✅ استخدام finalOrderDetails المحدثة
          orderCreated = await enhancedOrderService.createEnhancedOrder({
            conversationId,
            customerId: customerData?.id,
            companyId: orderCompanyId,
            productName: finalOrderDetails.productName,
            productColor: finalOrderDetails.productColor,
            productSize: finalOrderDetails.productSize,
            productPrice: finalOrderDetails.productPrice,
            quantity: finalOrderDetails.quantity || 1,
            customerName: finalOrderDetails.customerName || customerData?.name || 'عميل جديد',
            customerPhone: finalOrderDetails.customerPhone || '',
            customerEmail: finalOrderDetails.customerEmail || '',
            customerAddress: finalOrderDetails.customerAddress || '',
            city: finalOrderDetails.city || 'غير محدد',
            notes: `طلب تلقائي من المحادثة ${conversationId} - ${new Date().toLocaleString('ar-EG')}`,
            confidence: finalOrderDetails.confidence || 0.7,
            validation: finalOrderDetails.validation,
            extractionMethod: 'ai_enhanced'
          });

          if (orderCreated.success) {
            console.log('✅ [AI-AGENT] تم إنشاء الطلب المحسن بنجاح:', orderCreated.order.orderNumber);

            // ✅ إعادة توليد رد طبيعي من الـ AI مع معلومات الطلب
            const order = orderCreated.order;
            
            // بناء prompt جديد مع معلومات الطلب المؤكدة - استخدام finalOrderDetails
            const orderConfirmationPrompt = await this.buildOrderConfirmationPrompt(
              content,
              customerData,
              companyPrompts,
              order,
              finalOrderDetails,
              conversationMemory,
              finalCompanyId
            );
            
            // توليد رد طبيعي من الـ AI
            const naturalConfirmation = await this.generateAIResponse(
              orderConfirmationPrompt,
              conversationMemory,
              false, // no RAG needed
              null,
              finalCompanyId,
              conversationId,
              { messageType: 'order_confirmation' }
            );
            
            // ✅ تحديث finalResponse برد الـ AI الطبيعي
            finalResponse = naturalConfirmation;
            
            console.log('✅ [ORDER-CONFIRMATION] تم إنشاء رد تأكيد طبيعي من الـ AI');
            
            // ✅ تحديث الذاكرة برد التأكيد الجديد
            try {
              await memoryService.saveInteraction({
                conversationId,
                senderId,
                companyId: finalCompanyId,
                userMessage: content,
                aiResponse: finalResponse,
                intent: 'order_confirmation',
                sentiment: 'positive',
                timestamp: new Date(),
                metadata: {
                  orderNumber: order.orderNumber,
                  orderId: order.id,
                  orderCreated: true
                }
              });
              console.log('💾 [ORDER-CONFIRMATION] تم حفظ رد التأكيد في الذاكرة');
            } catch (memoryError) {
              console.error('⚠️ [ORDER-CONFIRMATION] فشل حفظ الذاكرة:', memoryError.message);
            }

            // ✅ إنشاء نسخة احتياطية بنفس رقم الطلب من الـ database
            try {
              const simpleOrderService = require('./simpleOrderService');
              
              // ✅ استخدام البيانات من الـ database order بدلاً من finalOrderDetails
              const backupOrder = await simpleOrderService.createSimpleOrder({
                conversationId,
                customerId: customerData?.id,
                companyId: orderCompanyId,
                productName: finalOrderDetails.productName,
                productColor: finalOrderDetails.productColor,
                productSize: finalOrderDetails.productSize,
                productPrice: finalOrderDetails.productPrice,
                quantity: finalOrderDetails.quantity || 1,
                customerName: finalOrderDetails.customerName || customerData?.name || 'عميل جديد',
                customerPhone: finalOrderDetails.customerPhone || '',
                customerAddress: finalOrderDetails.customerAddress || '',
                city: finalOrderDetails.city || 'غير محدد',
                notes: `طلب تلقائي من المحادثة ${conversationId} - ${new Date().toLocaleString('ar-EG')}`,
                // ✅ تمرير رقم الطلب من الـ database لضمان التطابق
                orderNumber: order.orderNumber,
                confidence: finalOrderDetails.confidence || 0.7,
                validation: finalOrderDetails.validation,
                // ✅ تمرير الشحن الفعلي من الـ database order
                shipping: order.shipping,
                subtotal: order.subtotal,
                total: order.total
              });

              if (backupOrder.success) {
                await simpleOrderService.saveOrderToFile(backupOrder.order);
                //console.log('💾 [AI-AGENT] تم حفظ نسخة احتياطية في ملف');
              }
            } catch (backupError) {
              console.warn('⚠️ [AI-AGENT] فشل في إنشاء النسخة الاحتياطية:', backupOrder.message);
            }
          }

          // إغلاق الاتصال
          await enhancedOrderService.disconnect();
        } catch (error) {
          console.error('❌ Error creating automatic order:', error);
        }
      }

      // 🤖 تقييم جودة الرد بالذكاء الاصطناعي
      try {
        const messageId = `msg_${conversationId}_${Date.now()}`;
        const evaluationData = {
          messageId,
          conversationId,
          userMessage: content,
          botResponse: finalResponse, // Use enhanced response
          ragData: {
            used: ragData.length > 0,
            sources: ragData
          },
          confidence: enhancedContext.confidence,
          model: this.currentActiveModel?.model || geminiConfig.model,
          timestamp: new Date(),
          companyId: finalCompanyId, // استخدام finalCompanyId المحدد مسبقاً
          // Enhanced conversation flow data for quality evaluation
          conversationFlow: {
            phase: enhancedContext.conversationPhase,
            engagement: enhancedContext.customerEngagement,
            topicContinuity: enhancedContext.topicContinuity,
            direction: enhancedContext.conversationFlow.direction,
            momentum: enhancedContext.conversationFlow.momentum,
            contextualCues: enhancedContext.contextualCues
          }
        };

        // تقييم الرد تلقائياً (غير متزامن)
        this.qualityMonitor.evaluateResponse(evaluationData).catch(error => {
          console.error('⚠️ [QUALITY-MONITOR] Error evaluating response:', error);
        });

        //console.log(`📊 [QUALITY-MONITOR] Response queued for evaluation: ${messageId}`);
      } catch (evaluationError) {
        console.error('❌ [QUALITY-MONITOR] Failed to queue evaluation:', evaluationError);
      }
      
      } // End of if (orderConfirmation.isConfirming)

      //console.log(`\n📤 [FINAL-RESPONSE] ===== إعداد الرد النهائي المحسن =====`);
      //console.log(`📝 [FINAL-RESPONSE] محتوى الرد: "${finalResponse.substring(0, 100)}..."`);
      //console.log(`📸 [FINAL-RESPONSE] عدد الصور المرفقة: ${images ? images.length : 0}`);
      //console.log(`🔍 [FINAL-RESPONSE] مرحلة المحادثة: ${enhancedContext.conversationPhase}`);
      //console.log(`📊 [FINAL-RESPONSE] مستوى التفاعل: ${enhancedContext.customerEngagement}`);
      //console.log(`🎯 [FINAL-RESPONSE] اتجاه المحادثة: ${enhancedContext.conversationFlow.direction}`);

      if (images && images.length > 0) {
        //console.log(`✅ [FINAL-RESPONSE] الصور التي سيتم إرسالها:`);
        images.forEach((img, index) => {
          //console.log(`   📸 ${index + 1}. ${img.payload?.title || 'بدون عنوان'}`);
          //console.log(`      🔗 ${img.payload?.url?.substring(0, 60)}...`);
        });
      } else {
        //console.log(`❌ [FINAL-RESPONSE] لا توجد صور للإرسال`);
      }

      //console.log(`🎯 [FINAL-RESPONSE] ===== الرد المحسن جاهز للإرسال =====`);

      // تسجيل النجاح في نظام المراقبة
      aiResponseMonitor.recordAISuccess(finalCompanyId);
      
      // 📊 تسجيل في Simple Monitor أيضاً
      const { simpleMonitor } = require('./simpleMonitor');
      const isEmpty = !finalResponse || finalResponse.trim().length === 0;
      simpleMonitor.logResponse(processingTime, isEmpty, true);

      console.log(`✅ [DEBUG] ===== Returning final response =====`);
      console.log(`📝 [DEBUG] Response length: ${finalResponse?.length || 0}, Images: ${images?.length || 0}`);
      
      return {
        success: true,
        content: finalResponse, // Use enhanced response
        model: this.currentActiveModel?.model || geminiConfig.model,
        keyId: this.currentActiveModel?.keyId || geminiConfig.keyId,
        processingTime,
        intent,
        sentiment: this.analyzeSentiment(content),
        confidence: enhancedContext.confidence, // Use enhanced confidence
        shouldEscalate: enhancedContext.needsRedirection && enhancedContext.customerEngagement === 'low',
        switchType: this.currentActiveModel?.switchType || geminiConfig.switchType || 'normal',
        ragDataUsed: ragData.length > 0,
        memoryUsed: conversationMemory.length > 0,
        images: images,
        orderCreated: orderCreated,
        // Enhanced conversation flow metadata
        conversationFlow: {
          phase: enhancedContext.conversationPhase,
          engagement: enhancedContext.customerEngagement,
          topicContinuity: enhancedContext.topicContinuity,
          direction: enhancedContext.conversationFlow.direction,
          momentum: enhancedContext.conversationFlow.momentum,
          expectedNext: enhancedContext.conversationFlow.expectedNext,
          contextualCues: enhancedContext.contextualCues,
          suggestedActions: enhancedContext.suggestedActions
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('🚨 [DEBUG] ===== ERROR in processCustomerMessage =====');
      console.error('🚨 [DEBUG] Error type:', error?.name);
      console.error('🚨 [DEBUG] Error message:', error?.message);
      console.error('🚨 [DEBUG] Error stack:', error?.stack);
      console.error('🚨 [AIAgent] Full error:', error);

      // استخدام نظام معالجة الأخطاء المحسن
      const errorContext = {
        companyId: finalCompanyId || messageData.companyId,
        conversationId,
        customerId: senderId,
        intent: messageData.intent,
        userMessage: content,
        isUrgent: this.isUrgentMessage(content),
        consecutiveFailures: messageData.consecutiveFailures || 1
      };

      // تسجيل الفشل في نظام المراقبة
      await aiResponseMonitor.recordAIFailure({
        companyId: errorContext.companyId,
        conversationId,
        customerId: senderId,
        errorType: this.errorHandler.classifyError(error),
        errorMessage: error.message,
        context: {
          intent: errorContext.intent,
          userMessage: content.substring(0, 100),
          isUrgent: errorContext.isUrgent
        }
      });
      
      // 📊 تسجيل الخطأ في Simple Monitor أيضاً
      const { simpleMonitor } = require('./simpleMonitor');
      await simpleMonitor.logError(error, {
        companyId: errorContext.companyId,
        conversationId,
        customerId: senderId,
        intent: errorContext.intent,
        silent: true // خطأ صامت
      });

      // معالجة شاملة للخطأ وإرجاع رد مناسب
      const fallbackResponse = await this.errorHandler.handleError(error, errorContext);
      
      // 📊 تسجيل fallback response في Simple Monitor
      const hasFallbackContent = fallbackResponse && fallbackResponse.content;
      simpleMonitor.logResponse(processingTime, !hasFallbackContent, false);

      // إضافة معلومات المعالجة
      const enhancedResponse = {
        ...fallbackResponse,
        model: geminiConfig?.model || 'unknown',
        keyId: geminiConfig?.id || 'unknown',
        processingTime,
        intent: errorContext.intent || 'general_inquiry',
        sentiment: this.analyzeSentiment(content),
        switchType: 'error_fallback',
        ragDataUsed: false,
        memoryUsed: false,
        images: [],
        orderCreated: null
      };

      // حفظ الخطأ في الذاكرة للتعلم
      try {
        await memoryService.saveInteraction({
          conversationId,
          senderId,
          companyId: finalCompanyId,
          userMessage: content,
          aiResponse: fallbackResponse.content,
          intent: 'error_fallback',
          sentiment: 'neutral',
          timestamp: new Date(),
          metadata: {
            errorType: fallbackResponse.errorType,
            fallback: true,
            requiresHumanIntervention: fallbackResponse.requiresHumanIntervention,
            enhancedContextAvailable: false // Indicate this was a fallback without enhanced context
          }
        });
      } catch (memoryError) {
        console.error('⚠️ [AIAgent] Failed to save error interaction to memory:', memoryError);
      }

      // محاولة إعادة المحاولة مع نموذج بديل في حالات معينة
      if (error.status === 429 || error.message.includes('quota')) {
        try {
          const backupModel = await this.findNextAvailableModel(finalCompanyId);
          if (backupModel && (messageData.retryCount || 0) < 1) {
            //console.log('🔄 [AIAgent] Retrying with backup model:', backupModel.model);
            
            const retryMessageData = {
              ...messageData,
              retryCount: (messageData.retryCount || 0) + 1
            };
            
            return await this.processCustomerMessage(retryMessageData);
          }
        } catch (retryError) {
          console.error('❌ [AIAgent] Backup model also failed:', retryError);
        }
      }

      //console.log('🔄 [AI-FALLBACK] Generated enhanced fallback response:', {
      //   content: enhancedResponse.content.substring(0, 50) + '...',
      //   shouldEscalate: enhancedResponse.shouldEscalate,
      //   errorType: enhancedResponse.errorType,
      //   requiresHumanIntervention: enhancedResponse.requiresHumanIntervention
      // });

      return enhancedResponse;
    }
  }

  /**
   * معالجة الصور مع الـ AI بدون استخدام الذاكرة لضمان الاستقلالية
   */
  async processImageWithAI(imageAnalysis, messageData, intent = 'general_inquiry', productMatch ) {
    try {
      //console.log('🖼️ [IMAGE-AI] Processing image with AI (memory-independent)...');

      // الحصول على معلومات الشركة والـ prompts
      const finalCompanyId = messageData.companyId || messageData.customerData?.companyId;
      //console.log('🏢 [IMAGE-AI] Using companyId:', finalCompanyId);
      const companyPrompts = await this.getCompanyPrompts(finalCompanyId);

      // بناء prompt خاص بالصور بدون استخدام الذاكرة
      const imagePrompt = this.buildImageResponsePrompt(
        imageAnalysis,
        companyPrompts,
        productMatch,
        messageData.customerData
      );

      // تحضير سياق الرسالة للأنماط (بدون ذاكرة)
      const messageContext = {
        messageType: 'image_analysis',
        inquiryType: intent,
        timeOfDay: this.getTimeOfDay(),
        customerHistory: {
          isReturning: false, // نعتبر كل صورة كتفاعل جديد
          previousPurchases: 0
        }
      };

      // إنشاء الرد مع الـ AI بدون ذاكرة
      const aiContent = await this.generateAIResponse(
        imagePrompt,
        [], // ذاكرة فارغة لضمان الاستقلالية
        true,
        null, // geminiConfig
        finalCompanyId,
        messageData.conversationId,
        messageContext
      );

      //console.log('✅ [IMAGE-AI] Image processed successfully with independent analysis');

      return {
        content: aiContent,
        intent: intent,
        confidence: 0.9,
        shouldEscalate: false,
        metadata: {
          processingType: 'image_independent',
          hasProductMatch: !!productMatch?.found,
          analysisTimestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ [IMAGE-AI] Error processing image with AI:', error);

      // رد افتراضي في حالة الخطأ
      return {
        content: 'عذراً، حدث خطأ في تحليل الصورة. ممكن تجربي ترسليها تاني؟',
        intent: 'error_handling',
        confidence: 0.1,
        shouldEscalate: true,
        metadata: {
          processingType: 'image_error',
          error: error.message
        }
      };
    }
  }

  /**
   * دالة معالجة منفصلة مع الـ AI Agent للصور
   */
  async processWithAI(content, messageData, intent = 'general_inquiry') {
    const startTime = Date.now();

    try {
      //console.log('🤖 [AI-PROCESSING] Processing with AI Agent...');
      //console.log('📝 [AI-PROCESSING] Content:', content.substring(0, 100) + '...');
      //console.log('🎯 [AI-PROCESSING] Intent:', intent);

      // الحصول على معلومات الشركة والـ prompts
      const finalCompanyId = messageData.companyId || messageData.customerData?.companyId;
      //console.log('🏢 [COMPANY-DEBUG] Using companyId:', finalCompanyId);
      const companyPrompts = await this.getCompanyPrompts(finalCompanyId);

      // جلب الذاكرة والتفاعلات السابقة
      // الحصول على إعدادات الذاكرة من قاعدة البيانات
      const settings = await this.getSettings(finalCompanyId);
      const memoryLimit = settings.maxMessagesPerConversation || 50;
      const conversationMemory = await memoryService.getConversationMemory(messageData.conversationId, messageData.senderId, memoryLimit, finalCompanyId);

      // معالجة الرد مع الـ RAG إذا كان مطلوباً
      let ragData = [];
      if (intent === 'product_inquiry' || intent === 'price_inquiry') {
        try {
          if (!this.ragService) {
            this.ragService = require('./ragService');
            await this.ragService.ensureInitialized();
          }
          ragData = await this.ragService.retrieveRelevantData(content, intent, customerData?.id, finalCompanyId);
        } catch (error) {
          console.error('❌ Error getting RAG data:', error);
          ragData = [];
        }
      }

      // إنشاء الـ prompt المتقدم
      const prompt = this.buildPrompt(content, companyPrompts, conversationMemory, ragData, messageData.customerData, messageData);

      // تحضير سياق الرسالة للأنماط
      const messageContext = {
        messageType: intent,
        inquiryType: intent,
        timeOfDay: this.getTimeOfDay(),
        customerHistory: {
          isReturning: conversationMemory.length > 0,
          previousPurchases: 0 // يمكن تحسينه لاحقاً
        }
      };

      // إنشاء الرد مع الـ AI مع تطبيق الأنماط
      const aiContent = await this.generateAIResponse(
        prompt,
        conversationMemory,
        true,
        null, // geminiConfig
        finalCompanyId,
        messageData.conversationId,
        messageContext
      );

      // الحصول على معلومات النموذج المستخدم للشركة
      const currentModel = await this.getCurrentActiveModel(finalCompanyId);

      return {
        success: true,
        content: aiContent,
        model: currentModel?.model || 'unknown',
        keyId: currentModel?.keyId || 'unknown',
        processingTime: Date.now() - startTime,
        intent: intent,
        sentiment: 'neutral',
        confidence: 0.9,
        shouldEscalate: false,
        ragDataUsed: ragData.length > 0,
        memoryUsed: conversationMemory.length > 0,
        images: []
      };

    } catch (error) {
      // 🤐 النظام الصامت - تسجيل الخطأ داخلياً فقط
      console.error('🚨 [SILENT-AI-ERROR] ProcessWithAI error (hidden from customer):', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      });

      return {
        success: false,
        error: error.message,
        content: null, // 🚫 لا محتوى للعميل - صمت تام
        shouldEscalate: false, // 🚫 لا تصعيد تلقائي
        processingTime: Date.now() - startTime,
        errorType: 'ai_processing_error',
        silent: true // 🤐 علامة الصمت
      };
    }
  }

  /**
   * حفظ الرد النهائي للصورة في الذاكرة
   */
  async saveImageResponseToMemory(messageData, finalResponse, productMatch) {
    try {
      const memoryService = require('./memoryService');

      // حفظ الرد النهائي المفيد بدلاً من التحليل الخام
      await memoryService.saveInteraction({
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
        companyId: messageData.companyId,
        userMessage: 'العميل أرسل صورة منتج',
        aiResponse: finalResponse, // الرد النهائي المفيد
        intent: 'image_analysis',
        sentiment: 'neutral',
        timestamp: new Date(),
        metadata: {
          hasProductMatch: !!productMatch?.found,
          productName: productMatch?.productName || null,
          processingType: 'image_independent'
        }
      });

      //console.log('💾 Final image response saved to memory (helpful response, not raw analysis)');
    } catch (error) {
      //console.log('⚠️ Could not save image response to memory:', error.message);
    }
  }

  /**
   * بناء prompt خاص بالصور بدون استخدام الذاكرة
   */
  buildImageResponsePrompt(imageAnalysis, companyPrompts, productMatch, customerData) {
    let prompt = '';

    // إضافة شخصية الشركة
    if (companyPrompts.personalityPrompt) {
      prompt += companyPrompts.personalityPrompt + '\n\n';
    }

    // تعليمات خاصة بالرد على الصور
    prompt += `🖼️ مهمة: الرد على العميل بناءً على تحليل الصورة المرسلة

📋 معلومات تحليل الصورة:
${imageAnalysis}

🎯 تعليمات مهمة للرد:
1. ✅ استخدم نتائج تحليل الصورة فقط
2. 🚫 لا تشير لأي محادثات أو تفاعلات سابقة
3. 💬 رد بشكل طبيعي وودود كأنها أول مرة تتفاعل مع العميل
4. 🎨 اذكر الألوان والتفاصيل التي تم تحليلها
5. 💰 اذكر السعر إذا تم العثور على منتج مطابق
6. ❓ اسأل إذا كان العميل يريد معرفة المزيد

`;

    // إضافة معلومات المطابقة إذا وجدت
    if (productMatch && productMatch.found) {
      prompt += `✅ تم العثور على منتج مطابق:
- اسم المنتج: ${productMatch.productName}
- السعر: ${productMatch.price}
- التفاصيل: ${productMatch.details || 'غير متوفر'}

`;
    } else {
      prompt += `⚠️ لم يتم العثور على منتج مطابق تماماً في المتجر.

`;
    }

    // إضافة معلومات العميل إذا توفرت
    if (customerData && customerData.name) {
      prompt += `👤 معلومات العميل: ${customerData.name}\n\n`;
    }

    prompt += `🎯 المطلوب: رد طبيعي وودود بناءً على تحليل الصورة فقط، بدون أي إشارة لسياق سابق.`;

    return prompt;
  }

  /**
   * بناء الـ prompt للذكاء الاصطناعي
   */
  buildPrompt(customerMessage, companyPrompts, conversationMemory, ragData, customerData, messageData ) {
    let prompt = '';

    //console.log('🔍 Building prompt with companyPrompts:', {
    //   hasPersonalityPrompt: !!companyPrompts.personalityPrompt,
    //   source: companyPrompts.source,
    //   promptLength: companyPrompts.personalityPrompt?.length || 0,
    //   hasReplyContext: !!(messageData?.replyContext?.isReply)
    // });

    // التحقق من وجود personality prompt مخصص
    if (!companyPrompts.personalityPrompt || companyPrompts.personalityPrompt.trim() === '') {
      //console.log('❌ لا يوجد personality prompt مخصص للشركة');
      throw new Error('MISSING_PERSONALITY_PROMPT: يجب إعداد شخصية المساعد الذكي من لوحة التحكم أولاً');
    }

    //console.log('✅ استخدام personality prompt مخصص من الشركة');
    prompt += `${companyPrompts.personalityPrompt.trim()}\n\n`;

    // ✅ إضافة قواعد الاستجابة (Response Rules Checkpoints)
    if (companyPrompts.responseRules) {
      try {
        const rules = typeof companyPrompts.responseRules === 'string' 
          ? JSON.parse(companyPrompts.responseRules) 
          : companyPrompts.responseRules;
        prompt += buildPromptFromRules(rules);
      } catch (e) {
        console.warn('⚠️ [RESPONSE-RULES] Failed to parse responseRules:', e.message);
        // استخدام القواعد الافتراضية في حالة الخطأ
        prompt += buildPromptFromRules(getDefaultRules());
      }
    } else {
      // استخدام القواعد الافتراضية إذا لم تكن موجودة
      prompt += buildPromptFromRules(getDefaultRules());
    }

    // Add response guidelines (legacy - للتوافق مع الإعدادات القديمة)
    // ✅ ملاحظة: القواعد الافتراضية تم نقلها إلى buildPromptFromRules لتجنب التكرار
    if (companyPrompts.responsePrompt) {
      prompt += `${companyPrompts.responsePrompt}\n\n`;
    }

    // Add customer information
    prompt += `معلومات العميل:
- الاسم: ${customerData?.name || 'عميل جديد'}
- الهاتف: ${customerData?.phone || 'غير محدد'}
- عدد الطلبات السابقة: ${customerData?.orderCount || 0}\n\n`;

    // 🔄 إضافة معلومات الرد إذا كان العميل يرد على رسالة سابقة
    if (messageData?.replyContext?.isReply) {
      //console.log('🔄 [REPLY-CONTEXT] العميل يرد على رسالة سابقة');
      prompt += `🔄 سياق الرد - العميل يرد على رسالة سابقة:\n`;
      prompt += `=====================================\n`;

      if (messageData.replyContext.originalMessage?.content) {
        prompt += `📝 الرسالة الأصلية التي يرد عليها العميل:\n`;
        prompt += `"${messageData.replyContext.originalMessage.content}"\n\n`;

        const originalDate = new Date(messageData.replyContext.originalMessage.createdAt);
        const timeAgo = this.getTimeAgo(originalDate);
        prompt += `⏰ تم إرسال الرسالة الأصلية منذ: ${timeAgo}\n\n`;
      } else {
        prompt += `📝 العميل يرد على رسالة سابقة (المحتوى غير متوفر)\n\n`;
      }

      prompt += `💬 رد العميل الحالي: "${customerMessage}"\n`;
      prompt += `=====================================\n`;
      prompt += `💡 مهم: اربطي ردك بالرسالة الأصلية وتأكدي من الاستمرارية في السياق.\n\n`;
    }

    // Add conversation memory if available
    if (conversationMemory && conversationMemory.length > 0) {
      prompt += `📚 سجل المحادثة السابقة (للسياق):\n`;
      prompt += `=====================================\n`;

      conversationMemory.forEach((interaction, index) => {
        const timeAgo = this.getTimeAgo(new Date(interaction.createdAt || interaction.timestamp));
        const sender = interaction.isFromCustomer ? 'العميل' : 'ردك';
        prompt += `${index + 1}. ${sender} (منذ ${timeAgo}): ${interaction.content}\n`;
      });

      prompt += `\n=====================================\n`;
      prompt += `💡 استخدمي هذا السجل لفهم السياق والاستمرارية في المحادثة.\n`;
      prompt += `🚫 مهم: هذه ليست أول رسالة في المحادثة - لا ترحبي بالعميل مرة أخرى! كملي المحادثة بشكل طبيعي بدون ترحيب.\n\n`;
    } else {
      // هذا أول تفاعل - يمكن الترحيب بالعميل
      prompt += `💡 ملاحظة: هذا أول تفاعل مع العميل في هذه المحادثة - رحبي بالعميل بشكل طبيعي وودود.\n\n`;
    }

    // Add RAG data if available
    if (ragData && ragData.length > 0) {
      prompt += `🗃️ المعلومات المتاحة من قاعدة البيانات (استخدميها فقط):\n`;
      prompt += `=====================================\n`;

      ragData.forEach((item, index) => {
        if (item.type === 'product') {
          prompt += `🛍️ منتج ${index + 1}: ${item.content}\n`;
        } else if (item.type === 'faq') {
          prompt += `❓ سؤال شائع ${index + 1}: ${item.content}\n`;
        } else if (item.type === 'policy') {
          prompt += `📋 سياسة ${index + 1}: ${item.content}\n`;
        }
      });

      prompt += `=====================================\n\n`;
      prompt += `⚠️ مهم جداً: استخدمي فقط المعلومات المذكورة أعلاه. لا تذكري أي منتجات أو معلومات أخرى غير موجودة في القائمة.\n\n`;
    }

    // Add customer message
    prompt += `رسالة العميل: "${customerMessage}"\n\n`;

    // Add final instructions - مختصرة لتجنب التكرار
    if (ragData && ragData.length > 0) {
      prompt += `<data_rules>
⚠️ استخدمي فقط المعلومات أعلاه • لا تخترعي منتجات • اذكري الأسعار بدقة
</data_rules>\n\n`;
    }

    return prompt;
  }

  /**
   * Get company prompts and settings
   */
  async getCompanyPrompts(companyId, customPrompt = null) {
    //console.log('🔍 Getting company prompts for:', companyId);

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
        console.log('✅ [CUSTOM-PROMPT] Using custom prompt from message data');
        
        // ✅ جلب responseRules من settings
        const settings = await this.getSettings(companyId);
        
        return {
          personalityPrompt: customPrompt,
          responsePrompt: null,
          responseRules: settings.responseRules, // ✅ إضافة قواعد الاستجابة
          hasCustomPrompts: true,
          source: 'custom_message_prompt',
          promptName: 'Custom Comment/Post Prompt'
        };
      }
      
      // 1. First check for active system prompt (highest priority)
      //console.log('🔍 Checking for active system prompt...');

      try {
        const activeSystemPrompt = await this.getSharedPrismaClient().systemPrompt.findFirst({
          where: {
            isActive: true,
            companyId: companyId  // إضافة فلترة حسب الشركة للأمان
          },
          orderBy: { updatedAt: 'desc' }
        });

        if (activeSystemPrompt) {
          //console.log('✅ Found active system prompt:', activeSystemPrompt.name);
          //console.log('📝 Prompt length:', activeSystemPrompt.content.length, 'characters');
          
          // ✅ جلب responseRules من settings
          const settings = await this.getSettings(companyId);
          
          return {
            personalityPrompt: activeSystemPrompt.content,
            responsePrompt: null,
            responseRules: settings.responseRules, // ✅ إضافة قواعد الاستجابة
            hasCustomPrompts: true,
            source: 'system_prompt',
            promptName: activeSystemPrompt.name
          };
        } else {
          //console.log('❌ No active system prompt found');
        }
      } catch (systemPromptError) {
        console.error('❌ Error checking system prompts:', systemPromptError.message);
        //console.log('⚠️ Falling back to other prompt sources...');
      }

      // 2. Check AI settings table
      //console.log('🔍 Checking AI settings table...');
      try {
        const aiSettings = await this.getSharedPrismaClient().aiSettings.findFirst({
          where: { companyId }
        });

        if (aiSettings && (aiSettings.personalityPrompt || aiSettings.responsePrompt)) {
          //console.log('✅ Found prompts in AI settings');
          return {
            personalityPrompt: aiSettings.personalityPrompt,
            responsePrompt: aiSettings.responsePrompt,
            responseRules: aiSettings.responseRules, // ✅ إضافة قواعد الاستجابة
            hasCustomPrompts: !!(aiSettings.personalityPrompt || aiSettings.responsePrompt),
            source: 'ai_settings'
          };
        } else {
          //console.log('❌ No prompts in AI settings');
        }
      } catch (aiSettingsError) {
        console.error('❌ Error checking AI settings:', aiSettingsError.message);
      }

      // 3. Fallback to company table
      //console.log('🔍 Checking company table...');
      try {
        const company = await this.getSharedPrismaClient().company.findUnique({
          where: { id: companyId }
        });

        if (company && (company.personalityPrompt || company.responsePrompt)) {
          //console.log('✅ Found prompts in company table');
          
          // ✅ جلب responseRules من settings
          const settings = await this.getSettings(companyId);
          
          return {
            personalityPrompt: company.personalityPrompt,
            responsePrompt: company.responsePrompt,
            responseRules: settings.responseRules, // ✅ إضافة قواعد الاستجابة
            hasCustomPrompts: !!(company.personalityPrompt || company.responsePrompt),
            source: 'company'
          };
        } else {
          //console.log('❌ No prompts in company table');
        }
      } catch (companyError) {
        console.error('❌ Error checking company table:', companyError.message);
      }

      //console.log('❌ No custom prompts found, using default');
      return {
        personalityPrompt: null,
        responsePrompt: null,
        responseRules: null, // ✅ إضافة قواعد الاستجابة
        hasCustomPrompts: false,
        source: 'default'
      };
    } catch (error) {
      console.error('❌ Error getting company prompts:', error);
      return {
        personalityPrompt: null,
        responsePrompt: null,
        responseRules: null, // ✅ إضافة قواعد الاستجابة
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
      //console.log('🔄 Reloading system prompt...');
      // Clear any cached prompts if needed
      this.cachedPrompts = null;
      //console.log('✅ System prompt reloaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Error reloading system prompt:', error);
      return false;
    }
  }

  /**
   * Build advanced prompt with RAG data, company settings, and conversation memory
   */
  async buildAdvancedPrompt(customerMessage, customerData, companyPrompts, ragData, conversationMemory , hasImages = false, smartResponseInfo , messageData ) {
    let prompt = '';

    console.log('\n🔧 [BUILD-PROMPT] بدء بناء الـ Prompt');
    console.log('📊 [BUILD-PROMPT] المعلومات الواردة:');
    console.log('  - رسالة العميل:', customerMessage?.substring(0, 50));
    console.log('  - Personality Prompt:', companyPrompts.source, '- الطول:', companyPrompts.personalityPrompt?.length || 0);
    console.log('  - RAG Data:', ragData?.length || 0, 'عنصر');
    console.log('  - Conversation Memory:', conversationMemory?.length || 0, 'رسالة');
    console.log('  - Has Images:', hasImages);
    console.log('  - Smart Response Info:', !!smartResponseInfo);

    // التحقق من وجود personality prompt مخصص
    if (!companyPrompts.personalityPrompt || companyPrompts.personalityPrompt.trim() === '') {
      //console.log('❌ لا يوجد personality prompt مخصص للشركة');
      throw new Error('MISSING_PERSONALITY_PROMPT: يجب إعداد شخصية المساعد الذكي من لوحة التحكم أولاً');
    }

    //console.log('✅ استخدام personality prompt مخصص من الشركة');
    prompt += `${companyPrompts.personalityPrompt.trim()}\n\n`;

    // ✅ إضافة قواعد الاستجابة (Response Rules Checkpoints)
    if (companyPrompts.responseRules) {
      try {
        const rules = typeof companyPrompts.responseRules === 'string' 
          ? JSON.parse(companyPrompts.responseRules) 
          : companyPrompts.responseRules;
        prompt += buildPromptFromRules(rules);
        console.log('✅ [BUILD-PROMPT] تم إضافة قواعد الاستجابة');
      } catch (e) {
        console.warn('⚠️ [RESPONSE-RULES] Failed to parse responseRules:', e.message);
        // استخدام القواعد الافتراضية في حالة الخطأ
        prompt += buildPromptFromRules(getDefaultRules());
        console.log('✅ [BUILD-PROMPT] تم إضافة القواعد الافتراضية');
      }
    } else {
      // استخدام القواعد الافتراضية إذا لم تكن موجودة
      prompt += buildPromptFromRules(getDefaultRules());
      console.log('✅ [BUILD-PROMPT] تم إضافة القواعد الافتراضية (لا توجد قواعد مخصصة)');
    }

    // ✨ تحليل ذكي متقدم للسياق + أمثلة عملية
    try {
      const dynamicBuilder = require('./services/dynamicPromptBuilder');
      
      const emotionalState = dynamicBuilder.detectEmotionalState(customerMessage);
      const customerTone = dynamicBuilder.detectCustomerTone(customerMessage);
      const urgencyLevel = dynamicBuilder.detectUrgencyLevel(customerMessage);
      const conversationPhase = dynamicBuilder.determineConversationPhase(conversationMemory);
      
      // ✅ إضافة أمثلة الردود الجيدة والسيئة (Few-Shot Prompting)
      prompt += dynamicBuilder.buildGoodBadExamples();
      console.log('✅ [BUILD-PROMPT] تم إضافة أمثلة الردود');
      
      // ✅ إضافة توجيهات عاطفية إذا كان العميل منزعج أو سعيد
      if (emotionalState && emotionalState !== 'neutral') {
        const emotionalGuidance = dynamicBuilder.buildEmotionalGuidance(emotionalState, urgencyLevel);
        prompt += emotionalGuidance;
        console.log(`✅ [BUILD-PROMPT] تم إضافة توجيهات عاطفية: ${emotionalState}`);
      }
      
      // إضافة ملاحظات مختصرة فقط عند الضرورة
      let contextNotes = [];
      if (emotionalState === 'angry') contextNotes.push('🔴 العميل منزعج - تعاطفي معاه');
      if (emotionalState === 'worried') contextNotes.push('💙 العميل قلقان - طمنيه');
      if (emotionalState === 'confused') contextNotes.push('🤔 العميل محتار - ساعديه');
      if (urgencyLevel === 'high') contextNotes.push('⚡ رد سريع ومباشر');
      if (customerTone === 'formal') contextNotes.push('📝 حافظي على الرسمية');
      if (conversationPhase === 'closing') contextNotes.push('🎯 قرب تختمي المحادثة');
      
      if (contextNotes.length > 0) {
        prompt += `\n💡 ملاحظات السياق: ${contextNotes.join(' • ')}\n\n`;
      }
    } catch (dynamicError) {
      console.warn('⚠️ [BUILD-PROMPT] خطأ في التحليل الديناميكي:', dynamicError.message);
      // المتابعة بدون التحليل إذا فشل
    }

    // 🚚 إضافة معلومات الشحن إذا كان العميل يسأل عنها أو ذكر محافظة
    try {
      const shippingService = require('./shippingService');
      const companyId = messageData?.companyId || customerData?.companyId;
      
      if (companyId) {
        // فحص إذا كان العميل يسأل عن الشحن
        const isAskingAboutShipping = shippingService.isAskingAboutShipping(customerMessage);
        
        // محاولة استخراج المحافظة من الرسالة
        const extractedGov = await shippingService.extractGovernorateFromMessage(customerMessage, companyId);
        
        if (isAskingAboutShipping || extractedGov.found) {
          //console.log('🚚 [SHIPPING] العميل يسأل عن الشحن أو ذكر محافظة');
          
          if (extractedGov.found) {
            // العميل ذكر محافظة - جلب معلومات الشحن
            const shippingInfo = await shippingService.findShippingInfo(extractedGov.governorate, companyId);
            
            if (shippingInfo && shippingInfo.found) {
              prompt += `🚚 معلومات الشحن للمحافظة المذكورة:\n`;
              prompt += `=====================================\n`;
              prompt += `📍 المحافظة: ${shippingInfo.governorate}\n`;
              prompt += `💰 سعر الشحن: ${shippingInfo.price} جنيه\n`;
              prompt += `⏰ مدة التوصيل: ${shippingInfo.deliveryTime}\n`;
              prompt += `=====================================\n`;
              prompt += `💡 استخدمي هذه المعلومات للرد على العميل بشكل طبيعي وودود.\n\n`;
            } else {
              prompt += `🚚 معلومات الشحن:\n`;
              prompt += `=====================================\n`;
              prompt += `❌ للأسف، لا يوجد شحن متاح لمحافظة "${extractedGov.governorate}" حالياً.\n`;
              prompt += `💡 اعتذري للعميل بشكل لطيف واقترحي عليه التواصل للبحث عن حل بديل.\n`;
              prompt += `=====================================\n\n`;
            }
          } else {
            // العميل يسأل عن الشحن لكن لم يذكر المحافظة - اطلبي منه المحافظة
            const availableGovernorates = await shippingService.getAvailableGovernorates(companyId);
            
            if (availableGovernorates.length > 0) {
              prompt += `🚚 معلومات الشحن المتاحة:\n`;
              prompt += `=====================================\n`;
              prompt += `💡 العميل يسأل عن الشحن لكن لم يحدد المحافظة.\n`;
              prompt += `📋 المحافظات المتاحة للشحن:\n`;
              availableGovernorates.slice(0, 10).forEach((gov, index) => {
                prompt += `   ${index + 1}. ${gov.name} - ${gov.price} جنيه (${gov.deliveryTime})\n`;
              });
              if (availableGovernorates.length > 10) {
                prompt += `   ... و ${availableGovernorates.length - 10} محافظة أخرى\n`;
              }
              prompt += `=====================================\n`;
              prompt += `💡 اسألي العميل عن محافظته بشكل ودود لتعطيه السعر الدقيق.\n\n`;
            }
          }
        }
      }
    } catch (shippingError) {
      console.error('⚠️ [SHIPPING] خطأ في جلب معلومات الشحن:', shippingError);
      // الاستمرار بدون معلومات الشحن
    }

    // Add response guidelines only if custom responsePrompt exists
    if (companyPrompts.responsePrompt) {
      prompt += `${companyPrompts.responsePrompt}\n\n`;
    }
    // Note: Default guidelines removed to avoid duplication with personality prompt

    // Add customer information with dynamic context
    const isNewCustomer = !customerData?.orderCount || customerData.orderCount === 0;
    const conversationLength = conversationMemory?.length || 0;

    prompt += `معلومات العميل:
- الاسم: ${customerData?.name || 'عميل جديد'}
- الهاتف: ${customerData?.phone || 'غير محدد'}
- ${isNewCustomer ? '🆕 عميل جديد (أول مرة يتواصل معانا)' : `عميل راجع (عنده ${customerData.orderCount} طلب سابق)`}
- مرحلة المحادثة: ${conversationLength === 0 ? 'بداية المحادثة' : conversationLength < 3 ? 'في بداية التفاعل' : 'محادثة متقدمة'}\n`;

    // 🔄 إضافة معلومات الرد إذا كان العميل يرد على رسالة سابقة
    if (messageData?.replyContext?.isReply) {
      //console.log('🔄 [REPLY-CONTEXT] العميل يرد على رسالة سابقة في buildAdvancedPrompt');
      prompt += `🔄 سياق الرد - العميل يرد على رسالة سابقة:\n`;
      prompt += `=====================================\n`;

      if (messageData.replyContext.originalMessage?.content) {
        prompt += `📝 الرسالة الأصلية التي يرد عليها العميل:\n`;
        prompt += `"${messageData.replyContext.originalMessage.content}"\n\n`;

        const originalDate = new Date(messageData.replyContext.originalMessage.createdAt);
        const timeAgo = this.getTimeAgo(originalDate);
        prompt += `⏰ تم إرسال الرسالة الأصلية منذ: ${timeAgo}\n\n`;
      } else {
        prompt += `📝 العميل يرد على رسالة سابقة (المحتوى غير متوفر)\n\n`;
      }

      prompt += `💬 رد العميل الحالي: "${customerMessage}"\n`;
      prompt += `=====================================\n`;
      prompt += `💡 مهم: اربطي ردك بالرسالة الأصلية وتأكدي من الاستمرارية في السياق.\n\n`;
    }

    // Add conversation memory if available
    console.log('📚 [MEMORY-CHECK] فحص سجل المحادثة:');
    console.log('  - conversationMemory موجود؟', !!conversationMemory);
    console.log('  - عدد الرسائل:', conversationMemory?.length || 0);
    
    // 🔍 استخراج آخر منتج تم السؤال عنه من المحادثة
    let lastMentionedProduct = null;
    let lastProductContext = null;
    
    if (conversationMemory && conversationMemory.length > 0) {
      // البحث في آخر 15 رسالة (الأحدث أولاً)
      const recentMessages = conversationMemory.slice(-15).reverse();
      
      for (const msg of recentMessages) {
        const content = msg.content || '';
        const contentLower = content.toLowerCase();
        
        // إذا كانت رسالة من الـ AI تذكر منتج محدد
        if (!msg.isFromCustomer) {
          // Pattern 0: ✅ منتج من context tag [المنتج: ...]
          const contextPattern = content.match(/\[المنتج:\s*([^\]]{2,100})\]/);
          if (contextPattern && contextPattern[1]) {
            lastMentionedProduct = contextPattern[1].trim();
            lastProductContext = content.substring(0, 150);
            console.log('🎯 [LAST-PRODUCT] تم استخراج اسم المنتج من context tag:', lastMentionedProduct);
            break;
          }
          
          // Pattern 1: منتج في مربع أو علامات تنصيص
          const boxedPattern = content.match(/[📦🎁✨]\s*["']?([^"'\n]{3,50})["']?/);
          if (boxedPattern && boxedPattern[1]) {
            lastMentionedProduct = boxedPattern[1].trim();
            lastProductContext = content.substring(0, 150);
            console.log('🎯 [LAST-PRODUCT] تم استخراج اسم المنتج من رد AI (مربع):', lastMentionedProduct);
            break;
          }
          
          // Pattern 2: "المنتج [name] متاح" or similar
          const availabilityPatterns = [
            /(?:المنتج|منتج)\s+["']?([أ-يA-Za-z\s]{2,40})["']?\s+(?:متاح|موجود|متوفر)/,
            /["']([أ-يA-Za-z\s]{2,40})["']\s+(?:متاح|موجود|متوفر)/,
            /(?:عندنا|لدينا)\s+["']?([أ-يA-Za-z\s]{2,40})["']?/
          ];
          
          for (const pattern of availabilityPatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              const productName = match[1].trim();
              // تجاهل الكلمات العامة
              const ignoreWords = ['كل', 'جميع', 'أي', 'هذا', 'ذلك', 'التي', 'الذي'];
              if (!ignoreWords.some(word => productName === word)) {
                lastMentionedProduct = productName;
                lastProductContext = content.substring(0, 150);
                console.log('🎯 [LAST-PRODUCT] تم استخراج اسم المنتج (AR) من رد AI:', lastMentionedProduct);
                break;
              }
            }
          }
          
          if (lastMentionedProduct) break;
        }
        
        // إذا كانت رسالة من العميل تسأل عن منتج محدد
        if (msg.isFromCustomer) {
          // Pattern 1: منتج بالإنجليزي في سؤال العميل
          const englishInquiry = content.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/);
          if (englishInquiry && englishInquiry[1]) {
            lastMentionedProduct = englishInquiry[1].trim();
            lastProductContext = content;
            console.log('🎯 [LAST-PRODUCT] تم استخراج اسم المنتج (EN) من سؤال العميل:', lastMentionedProduct);
            break;
          }
          
          // Pattern 2: منتج بالعربي في سؤال العميل
          const arabicInquiryPatterns = [
            /(?:عايز|محتاج|أشوف|اشوف|عاوز)\s+["']?([أ-ي\s]{2,40})["']?\s*(?:متاح|موجود|ب\s*كام|؟)?/,
            /سعر\s+["']?([أ-ي\s]{2,40})["']?\s*(?:كام|؟)?/,
            /["']([أ-ي\s]{2,40})["']\s+(?:متاح|موجود|ب\s*كام)/
          ];
          
          for (const pattern of arabicInquiryPatterns) {
            const match = content.match(pattern);
            if (match && match[1] && !match[1].match(/صور|معلومات|تفاصيل|شحن/)) {
              const productName = match[1].trim();
              const ignoreWords = ['كل', 'جميع', 'أي', 'هذا', 'ذلك'];
              if (!ignoreWords.some(word => productName === word)) {
                lastMentionedProduct = productName;
                lastProductContext = content;
                console.log('🎯 [LAST-PRODUCT] تم استخراج اسم المنتج (AR) من سؤال العميل:', lastMentionedProduct);
                break;
              }
            }
          }
          
          if (lastMentionedProduct) break;
        }
      }
    }
    
    // ✅ Fallback: لو مفيش منتج في الـ memory، استخرج من الـ RAG data
    if (!lastMentionedProduct && ragData && ragData.length > 0) {
      // استخدم أول منتج في الـ RAG data (الأكثر صلة)
      const firstProduct = ragData[0];
      if (firstProduct && firstProduct.name) {
        lastMentionedProduct = firstProduct.name;
        lastProductContext = `المنتج المطلوب: ${firstProduct.name}`;
        console.log('🔄 [LAST-PRODUCT-FALLBACK] استخراج من RAG data:', lastMentionedProduct);
      }
    }
    
    if (conversationMemory && conversationMemory.length > 0) {
      console.log('✅ [MEMORY] تم العثور على سجل محادثة:', conversationMemory.length, 'رسالة');
      
      // عرض أول 3 رسائل للتأكد
      conversationMemory.slice(0, 3).forEach((interaction, index) => {
        console.log(`  ${index + 1}. ${interaction.isFromCustomer ? 'العميل' : 'AI'}: ${interaction.content?.substring(0, 50)}...`);
      });
      
      prompt += `📚 سجل المحادثة:\n`;
      conversationMemory.forEach((interaction, index) => {
        const sender = interaction.isFromCustomer ? 'العميل' : 'أنتِ';
        const content = interaction.content || '[رسالة فارغة]';
        prompt += `${index + 1}. ${sender}: ${content}\n`;
        
        // ✅ Debug log لمعرفة المحتوى الفعلي
        if (!interaction.content || interaction.content.trim() === '') {
          console.warn(`⚠️ [MEMORY-EMPTY] رسالة ${index + 1} فارغة في سجل المحادثة:`, {
            id: interaction.id,
            isFromCustomer: interaction.isFromCustomer,
            hasContent: !!interaction.content
          });
        }
      });
      prompt += `\n🚫 لا ترحبي مرة أخرى - كملي المحادثة.\n`;
      
      // ✅ إضافة سياق آخر منتج مذكور
      if (lastMentionedProduct) {
        const msgLower = customerMessage.toLowerCase();
        const isAskingForImages = msgLower.includes('صور') || msgLower.includes('صوره') || 
                                  msgLower.includes('الصور') || msgLower.includes('ابعت') ||
                                  msgLower.includes('ارسل') || msgLower.includes('شوف');
        const isAskingForInfo = msgLower.includes('معلومات') || msgLower.includes('تفاصيل') ||
                               msgLower.includes('مواصفات');
        const isAskingForOrder = msgLower.includes('اوردر') || msgLower.includes('أوردر') || 
                                msgLower.includes('اطلب') || msgLower.includes('أطلب') ||
                                msgLower.includes('اشتري') || msgLower.includes('أشتري');
        
        // فحص إذا كان العميل يطلب صور/معلومات/order بدون ذكر منتج محدد في الرسالة الحالية
        const hasNoProductInCurrentMessage = !ragData || ragData.length === 0;
        
        if ((isAskingForImages || isAskingForInfo || isAskingForOrder) && hasNoProductInCurrentMessage) {
          let requestType = 'صور';
          if (isAskingForOrder) requestType = 'طلب/أوردر';
          else if (isAskingForInfo) requestType = 'معلومات';
          
          prompt += `\n🎯🎯 مهم جداً - سياق المحادثة:\n`;
          prompt += `=====================================\n`;
          prompt += `📌 آخر منتج تم السؤال عنه: "${lastMentionedProduct}"\n`;
          prompt += `💬 السياق: ${lastProductContext?.substring(0, 100)}...\n`;
          prompt += `\n⚠️ العميل يطلب ${requestType} بدون تحديد منتج!\n`;
          prompt += `✅ المقصود هو: "${lastMentionedProduct}"\n`;
          if (isAskingForOrder) {
            prompt += `💡 العميل يريد إتمام الطلب لهذا المنتج - اسأليه عن المقاس واللون والمحافظة.\n`;
          } else {
            prompt += `💡 ابحثي عن ${requestType} هذا المنتج تحديداً وأرسليها للعميل.\n`;
          }
          prompt += `=====================================\n\n`;
          
          console.log('🚨 [CONTEXT-AWARE] العميل يطلب', requestType, 'عن آخر منتج:', lastMentionedProduct);
        } else {
          prompt += `\n🎯 آخر منتج تم السؤال عنه في المحادثة: "${lastMentionedProduct}"\n`;
          prompt += `💡 لو العميل طلب صور أو معلومات أو أوردر بدون تحديد، المقصود هو هذا المنتج.\n`;
        }
      }
      prompt += `\n`;
      
      console.log('✅ [MEMORY] تم إضافة سجل المحادثة للـ prompt');
    } else {
      console.log('⚠️ [MEMORY] لا يوجد سجل محادثة - هذا أول تفاعل');
      prompt += `💡 أول تفاعل - رحبي بالعميل.\n\n`;
    }

    // Add RAG data if available
    if (ragData && ragData.length > 0) {
      // 🆕 فحص إذا كان الطلب عن category معينة
      const isCategoryRequest = smartResponseInfo?.categoryInfo;
      
      if (isCategoryRequest) {
        // طلب category - عرض جميع المنتجات من التصنيف
        prompt += `📦 المنتجات المتاحة من التصنيف "${smartResponseInfo.categoryInfo.categoryName}":\n`;
        prompt += `=====================================\n`;
        prompt += `📊 إجمالي المنتجات: ${smartResponseInfo.categoryInfo.totalProducts}\n`;
        prompt += `📸 إجمالي الصور: ${smartResponseInfo.categoryInfo.totalImages}\n\n`;
        
        ragData.forEach((item, index) => {
          if (item.type === 'product' && item.metadata) {
            prompt += `${index + 1}. ${item.metadata.name}\n`;
            prompt += `   💰 السعر: ${item.metadata.price} جنيه\n`;
            prompt += `   📦 المخزون: ${item.metadata.stock > 0 ? 'متوفر' : 'غير متوفر'}\n`;
            prompt += `   📸 الصور: ${item.metadata.images?.length || 0} صورة\n\n`;
          }
        });
        
        prompt += `=====================================\n`;
        prompt += `💡 الصور ستُرسل تلقائياً (${smartResponseInfo.categoryInfo.totalImages} صورة) - اذكري المنتجات بشكل طبيعي.\n\n`;
      } else {
        // طلب منتج محدد أو منتجات متعددة - العرض العادي
        prompt += `🗃️ المعلومات المتاحة من قاعدة البيانات (استخدميها فقط):\n`;
        prompt += `=====================================\n`;

        // جمع معلومات الصور من جميع المنتجات
        const imageInfo = [];

        ragData.forEach((item, index) => {
          if (item.type === 'product') {
            prompt += `🛍️ منتج ${index + 1}: ${item.content}\n`;

            // إضافة معلومات الصور للمنتج
            if (item.metadata) {
              const imageStatus = item.metadata.imageStatus || 'غير محددة';
              const imageCount = item.metadata.imageCount || 0;
              const hasValidImages = item.metadata.hasValidImages || false;

              imageInfo.push({
                name: item.metadata.name || `منتج ${index + 1}`,
                status: imageStatus,
                count: imageCount,
                hasImages: hasValidImages
              });
            }
          } else if (item.type === 'faq') {
            prompt += `❓ سؤال شائع ${index + 1}: ${item.content}\n`;
          } else if (item.type === 'policy') {
            prompt += `📋 سياسة ${index + 1}: ${item.content}\n`;
          }
        });

        prompt += `=====================================\n\n`;

        // إضافة ملخص حالة الصور مختصر
        if (imageInfo.length > 0) {
          const hasAnyImages = imageInfo.some(info => info.hasImages);
          if (hasAnyImages) {
            prompt += `📸 الصور متاحة وستُرسل تلقائياً.\n\n`;
          } else {
            prompt += `❌ لا توجد صور متاحة.\n\n`;
          }
        }
      }
    }

    // Add customer message
    prompt += `رسالة العميل: "${customerMessage}"\n\n`;

    // 💰 فحص إذا كانت الرسالة سؤال عن السعر
    const msgLower = (customerMessage || '').toLowerCase().trim();
    const priceKeywords = [
      'عامل كام', 'عاملة كام', 'عامله كام',
      'بكام', 'بكم', 'ب كام', 'ب كم',
      'سعره', 'سعرها', 'سعر ال', 'سعر',
      'ثمنه', 'ثمنها', 'ثمن',
      'تمنه', 'تمنها', 'تمن',
      'كام الثمن', 'كام التمن', 'كام السعر'
    ];
    const isPriceQuestion = priceKeywords.some(keyword => msgLower.includes(keyword));

    // Add concise contextual guidance
    if (ragData && ragData.length > 0) {
      const multipleProductsFound = smartResponseInfo?.multipleProducts && smartResponseInfo.multipleProducts.length > 1;
      
      // ✅ فحص إذا كان عميل جديد يسأل عن سعر منتج له إعلان ممول
      const hasPromotedProduct = ragData.some(item => 
        item.type === 'product' && 
        item.metadata && 
        item.metadata.hasPromotedAd === true
      );
      
      // ✅ استخراج معلومات المنتج الممول (أول منتج له إعلان ممول)
      const promotedProduct = ragData.find(item => 
        item.type === 'product' && 
        item.metadata && 
        item.metadata.hasPromotedAd === true
      );
      
      let finalNotes = [];
      if (isPriceQuestion) {
        // ✅ إذا كان عميل جديد ويسأل عن سعر منتج له إعلان ممول، الرد يكون: اسم المنتج + السعر + سؤال عن المحافظة
        if (isNewCustomer && hasPromotedProduct && promotedProduct) {
          const productName = promotedProduct.metadata?.name || 'المنتج';
          // استخراج السعر من metadata أو من content
          let productPrice = '';
          if (promotedProduct.metadata?.price) {
            productPrice = promotedProduct.metadata.price.toString();
          } else if (promotedProduct.content) {
            // محاولة استخراج السعر من content
            const priceMatch = promotedProduct.content.match(/السعر[^:]*:\s*(\d+(?:\.\d+)?)/);
            if (priceMatch) {
              productPrice = priceMatch[1];
            }
          }
          
          prompt += `\n⚠️ مهم جداً - حالة خاصة:\n`;
          prompt += `=====================================\n`;
          prompt += `🆕 العميل جديد (أول مرة يتواصل مع الشركة)\n`;
          prompt += `💰 يسأل عن السعر\n`;
          prompt += `📢 المنتج له إعلان ممول على Facebook\n`;
          prompt += `\n📋 المعلومات المطلوبة في الرد:\n`;
          prompt += `- اسم المنتج: "${productName}"\n`;
          if (productPrice) {
            prompt += `- السعر: ${productPrice} جنيه\n`;
          }
          prompt += `- يجب أن تسألي العميل عن المحافظة (من أي محافظة أنت؟ / في أي محافظة بتسكن؟)\n`;
          prompt += `\n💡 ملاحظات مهمة:\n`;
          prompt += `- استخدمي شخصيتك وطريقة كلامك الطبيعية من الـ personality prompt أعلاه\n`;
          prompt += `- الرد يكون مختصر ومباشر لكن باسلوبك المميز\n`;
          prompt += `- لا تستخدمي كلام ثابت، بل ردّي بطريقتك بناءً على شخصيتك\n`;
          prompt += `- تأكدي من ذكر اسم المنتج والسعر وسؤال عن المحافظة بطريقة طبيعية\n`;
          prompt += `=====================================\n\n`;
        } else {
          finalNotes.push('💰 السؤال عن السعر فقط');
        }
      } else if (hasImages) {
        if (multipleProductsFound) {
          finalNotes.push(`📸 الصور ستُرسل تلقائياً (${smartResponseInfo.multipleProducts.length} منتج)`);
        } else {
          finalNotes.push('📸 الصور ستُرسل تلقائياً');
        }
      }
      
      if (multipleProductsFound) {
        finalNotes.push(`🎯 ${smartResponseInfo.multipleProducts.length} منتجات متاحة`);
      }
      
      if (finalNotes.length > 0) {
        prompt += `\n💡 ${finalNotes.join(' • ')}\n\n`;
      }
    }

    // ✅ إضافة Chain of Thought - تفكير منظم قبل الرد
    prompt += `\n🧠 قبل ما تردي، فكري في الآتي:
═══════════════════════════════════
1️⃣ نية العميل: (شراء / استفسار / شكوى / دردشة)
2️⃣ المعلومات المطلوبة: هل متوفرة في البيانات أعلاه؟
3️⃣ الخطوة التالية: إيه أفضل رد يخدم العميل؟
═══════════════════════════════════
💡 ملاحظة: لا تكتبي تحليلك - اكتبي الرد النهائي فقط!
\n`;

    console.log('\n✅ [BUILD-PROMPT] تم بناء الـ Prompt بنجاح');
    console.log('📏 [BUILD-PROMPT] طول الـ Prompt النهائي:', prompt.length, 'حرف');
    console.log('📝 [BUILD-PROMPT] أول 200 حرف من الـ Prompt:');
    console.log(prompt.substring(0, 200) + '...');
    console.log('📝 [BUILD-PROMPT] آخر 200 حرف من الـ Prompt:');
    console.log('...' + prompt.substring(prompt.length - 200));
    
    return prompt;
  }

  /**
   * ✨ بناء إعدادات التوليد الديناميكية بناءً على السياق
   */
  async buildGenerationConfig(companyId, messageContext = {}) {
    try {
      // الحصول على إعدادات AI من قاعدة البيانات
      const settings = await this.getSettings(companyId);
      
      // ✅ الإعدادات الأساسية (استخدام constants)
      const baseConfig = {
        temperature: settings.aiTemperature ?? DEFAULT_AI_SETTINGS.TEMPERATURE,
        topK: settings.aiTopK ?? DEFAULT_AI_SETTINGS.TOP_K,
        topP: settings.aiTopP ?? DEFAULT_AI_SETTINGS.TOP_P,
        maxOutputTokens: settings.aiMaxTokens ?? DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS, // ✅ استخدام constants
      };

      // تعديل الإعدادات حسب نوع الرسالة
      const messageType = messageContext.messageType || 'general';
      
      if (messageType === 'greeting' || messageType === 'casual_chat') {
        // للتحيات والدردشة: إبداع أعلى قليلاً
        baseConfig.temperature = Math.min(baseConfig.temperature + 0.1, 0.9);
      } else if (messageType === 'order_confirmation' || messageType === 'order_details') {
        // لتأكيد الطلبات: دقة عالية (temperature منخفض)
        baseConfig.temperature = 0.3;
        baseConfig.topK = 10;
        baseConfig.topP = 0.8;
      } else if (messageType === 'product_inquiry' || messageType === 'price_inquiry') {
        // للاستفسارات: توازن بين الدقة والإبداع
        baseConfig.temperature = 0.6;
      } else if (messageType === 'complaint' || messageType === 'problem') {
        // للشكاوى: دقة عالية وتعاطف
        baseConfig.temperature = 0.4;
        baseConfig.topK = 20;
      }

      //console.log(`🎛️ [AI-CONFIG] Using generation config:`, baseConfig);
      return baseConfig;
      
    } catch (error) {
      console.error('❌ [AI-CONFIG] Error building generation config:', error);
      // ✅ إرجاع الإعدادات الافتراضية من constants عند حدوث خطأ
      return {
        temperature: DEFAULT_AI_SETTINGS.TEMPERATURE,
        topK: DEFAULT_AI_SETTINGS.TOP_K,
        topP: DEFAULT_AI_SETTINGS.TOP_P,
        maxOutputTokens: DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS,
      };
    }
  }

  /**
   * Generate AI response using Gemini API with Pattern Enhancement
   */
  async generateAIResponse(prompt, conversationMemory , useRAG , providedGeminiConfig , companyId , conversationId, messageContext) {
    try {
      //console.log('🎯 [AIAgent] Starting pattern-enhanced AI response generation');

      // 🔍 لوج مفصل لتتبع طلب generateAIResponse
      //console.log('📋 [REQUEST-TRACKING] ===== تتبع طلب generateAIResponse =====');
      //console.log('🏢 [REQUEST-TRACKING] Company ID:', companyId);
      //console.log('💬 [REQUEST-TRACKING] Conversation ID:', conversationId);
      //console.log('📝 [REQUEST-TRACKING] Prompt Length:', prompt?.length);
      //console.log('🧠 [REQUEST-TRACKING] Memory Length:', conversationMemory?.length);
      //console.log('📚 [REQUEST-TRACKING] Use RAG:', useRAG);
      //console.log('🔧 [REQUEST-TRACKING] Provided Config:', !!providedGeminiConfig);
      //console.log('📋 [REQUEST-TRACKING] ===== نهاية تتبع الطلب =====');

      // Get active Gemini configuration (use provided one if available, otherwise use session model with company isolation)
      const geminiConfig = providedGeminiConfig || await this.getCurrentActiveModel(companyId);
      // console.log('🔑 [AI-CONFIG] Gemini config:', {
      //   hasConfig: !!geminiConfig,
      //   model: geminiConfig?.model,
      //   hasApiKey: !!geminiConfig?.apiKey,
      //   apiKeyLength: geminiConfig?.apiKey?.length || 0,
      //   companyId: companyId
      // });
      if (!geminiConfig) {
        throw new Error(`No active Gemini key found for company: ${companyId}`);
      }

      // Step 1: Enhance prompt with approved patterns (if companyId provided)
      let enhancedPrompt = prompt;
      let approvedPatterns = [];

      if (companyId) {
        try {
          approvedPatterns = await this.patternApplication.getApprovedPatterns(companyId);
          if (approvedPatterns.length > 0) {
            enhancedPrompt = await this.promptEnhancement.enhancePromptWithPatterns(
              prompt,
              approvedPatterns,
              messageContext.messageType || 'general',
              companyId
            );
            //console.log(`🎨 [AIAgent] Enhanced prompt with ${approvedPatterns.length} patterns`);
          }
        } catch (patternError) {
          console.error('⚠️ [AIAgent] Error applying patterns to prompt:', patternError);
          // Continue with original prompt if pattern enhancement fails
        }
      }

      // ✨ الحصول على إعدادات التوليد الديناميكية
      const generationConfig = await this.buildGenerationConfig(companyId, messageContext);
      // console.log(`🎛️ [AI-CONFIG] Generation config:`, generationConfig);
      // console.log(`📝 [AI-PROMPT] Prompt length: ${enhancedPrompt?.length || 0}`);
      // console.log(`📝 [AI-PROMPT] Prompt preview (first 200 chars):`, enhancedPrompt?.substring(0, 200) + '...');
      
      // ⚠️ Warning for thinking models
      if (geminiConfig.model.includes('2.5') || geminiConfig.model.includes('thinking')) {
        // console.log(`⚠️ [THINKING-MODEL] Using thinking model: ${geminiConfig.model}`);
        // console.log(`⚠️ [THINKING-MODEL] These models use tokens for internal reasoning.`);
        // console.log(`⚠️ [THINKING-MODEL] Current maxOutputTokens: ${generationConfig.maxOutputTokens}`);
      }

      // Step 2: Generate AI response using enhanced prompt with API version fallback
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
      
      // ✅ تحديد إصدارات API للاختبار حسب نوع النموذج
      const isNewModel = geminiConfig.model.includes('3') || geminiConfig.model.includes('2.5') || geminiConfig.model.includes('2.0');
      const apiVersions = isNewModel ? ['v1beta', 'v1alpha', 'v1'] : ['v1', 'v1beta', 'v1alpha'];
      
      let response = null;
      let lastError = null;
      let usedApiVersion = null;
      
      // ✅ تجربة إصدارات API المختلفة
      for (const apiVersion of apiVersions) {
        try {
          const model = genAI.getGenerativeModel({ 
            model: geminiConfig.model,
            ...(apiVersion !== 'v1' ? { apiVersion } : {}), // v1 هو الافتراضي
            generationConfig
          });
          
          // 🔄 Retry logic for 503 errors
          const maxRetries = 3;
          const retryDelays = [1000, 2000, 4000];
          
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const result = await model.generateContent(enhancedPrompt);
              response = result.response;
              usedApiVersion = apiVersion === 'v1' ? 'v1 (default)' : apiVersion;
              
              if (usedApiVersion !== 'v1 (default)') {
                console.log(`✅ [API-VERSION] Using ${usedApiVersion} for model ${geminiConfig.model}`);
              }
              
              break; // Success
            } catch (retryError) {
              lastError = retryError;
              
              // Check if it's a 503 Service Unavailable error
              const is503Error = retryError.status === 503 || 
                               retryError.message?.includes('503') || 
                               retryError.message?.includes('Service Unavailable') ||
                               retryError.message?.includes('overloaded');
              
              if (is503Error && attempt < maxRetries) {
                const delay = retryDelays[attempt];
                console.log(`🔄 [RETRY-503] API ${apiVersion}, Attempt ${attempt + 1}/${maxRetries + 1} failed with 503. Retrying after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry
              } else if (!is503Error) {
                // Not a 503 error, try next API version
                break;
              }
            }
          }
          
          if (response) {
            break; // Success, exit API version loop
          }
        } catch (error) {
          lastError = error;
          // ✅ إذا كان الخطأ 404 أو 400، قد يعني أن النموذج غير متوفر في هذا الإصدار
          const is404or400 = error.status === 404 || error.status === 400 || 
                            error.message?.includes('404') || error.message?.includes('400') ||
                            error.message?.includes('not found') || error.message?.includes('invalid');
          
          if (is404or400) {
            console.log(`⚠️ [API-VERSION] Model ${geminiConfig.model} not available with ${apiVersion}, trying next version...`);
            continue; // Try next API version
          }
          
          // ✅ للأخطاء الأخرى، نستمر في المحاولة مع إصدار API التالي
          continue;
        }
      }
      
      if (!response) {
        throw lastError || new Error(`Failed to generate content with all API versions for model: ${geminiConfig.model}`);
      }
      
      // 🔍 Debug full response object
      console.log(`🔍 [AI-RESPONSE-DEBUG] Full response object:`, {
        hasResponse: !!response,
        hasCandidates: !!response?.candidates,
        candidatesLength: response?.candidates?.length || 0,
        promptFeedback: response?.promptFeedback,
        usageMetadata: response?.usageMetadata
      });
      
      // Check if response was blocked
      if (response.promptFeedback?.blockReason) {
        console.error(`🚫 [AI-BLOCKED] Response was blocked! Reason: ${response.promptFeedback.blockReason}`);
        console.error(`🚫 [AI-BLOCKED] Safety ratings:`, response.promptFeedback.safetyRatings);
      }
      
      // Check candidates
      if (response.candidates && response.candidates.length > 0) {
        console.log(`📊 [AI-CANDIDATES] First candidate:`, {
          finishReason: response.candidates[0].finishReason,
          safetyRatings: response.candidates[0].safetyRatings,
          hasContent: !!response.candidates[0].content,
          partsLength: response.candidates[0].content?.parts?.length || 0
        });
      }
      
      let aiContent = '';
      try {
        aiContent = response.text();
      } catch (textError) {
        console.error(`❌ [AI-TEXT-ERROR] Error calling response.text():`, textError.message);
        // Try to extract text from candidates manually
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          if (candidate.content?.parts?.length > 0) {
            aiContent = candidate.content.parts.map(part => part.text || '').join('');
            console.log(`✅ [AI-TEXT-FALLBACK] Extracted text manually from candidates`);
          }
        }
      }
      
      console.log(`🔍 [AI-RESPONSE-DEBUG] Response received from Gemini`);
      console.log(`📏 [AI-RESPONSE-DEBUG] Response length: ${aiContent?.length || 0}`);
      console.log(`📝 [AI-RESPONSE-DEBUG] Response preview: ${aiContent?.substring(0, 100) || 'EMPTY'}`);
      console.log(`🔑 [AI-RESPONSE-DEBUG] Model used: ${geminiConfig.model}`);
      console.log(`🏢 [AI-RESPONSE-DEBUG] Company ID: ${companyId}`);

      // Step 3: Optimize the generated response with patterns and priority settings
      if (companyId && approvedPatterns.length > 0) {
        try {
          const optimizedResponse = await this.responseOptimizer.optimizeResponse(
            aiContent,
            approvedPatterns,
            messageContext,
            companyId,
            prompt // تمرير البرونت الأساسي للمحسن
          );

          if (optimizedResponse !== aiContent) {
            //console.log('🚀 [AIAgent] Response optimized with patterns and priority settings');
            aiContent = optimizedResponse;
          }
        } catch (optimizationError) {
          console.error('⚠️ [AIAgent] Error optimizing response:', optimizationError);
          // Continue with original response if optimization fails
        }
      }
      try {
        const settings2 = await this.getSettings(companyId);
        if (settings2.enableDiversityCheck) {
          const diversityService = require('./responseDiversityService');
          aiContent = await diversityService.diversifyResponse(
            aiContent,
            conversationId,
            conversationMemory
          );
        }
      } catch (diversityError) {
      }

      try {
        const settings3 = await this.getSettings(companyId);
        if (settings3.enableToneAdaptation && conversationMemory && conversationMemory.length > 0) {
          const toneService = require('./toneAdaptationService');
          const customerMessages = conversationMemory
            .filter(m => m.isFromCustomer)
            .map(m => m.content);
          const toneAnalysis = toneService.analyzeTone(customerMessages);
          if (toneAnalysis.confidence > 0.3) {
            aiContent = toneService.adaptResponseToTone(aiContent, toneAnalysis);
          }
        }
      } catch (toneError) {
      }
      // Step 4: Record pattern usage for performance tracking (BATCH OPTIMIZED)
      if (conversationId && approvedPatterns.length > 0) {
        //console.log(`🚀 [AIAgent] Recording batch usage for ${approvedPatterns.length} patterns in conversation: ${conversationId}`);
        try {
          // استخدام الدالة المحسنة للسرعة
          const patternIds = approvedPatterns.map(p => p.id);
          await this.patternApplication.recordPatternUsageBatch(patternIds, conversationId, companyId);
          //console.log(`✅ [AIAgent] Successfully recorded batch usage for ${approvedPatterns.length} patterns`);
        } catch (recordError) {
          console.error('⚠️ [AIAgent] Error recording batch pattern usage:', recordError);
        }
      } else {
        if (!conversationId) {
          //console.log('⚠️ [AIAgent] No conversationId provided - skipping pattern usage recording');
        }
        if (approvedPatterns.length === 0) {
          //console.log('⚠️ [AIAgent] No approved patterns found - skipping pattern usage recording');
        }
      }

      //console.log('✅ [AIAgent] Pattern-enhanced response generated successfully');

      // 🔍 لوج مفصل لتتبع نتيجة generateAIResponse
      //console.log('🎯 [RESPONSE-RESULT] ===== نتيجة generateAIResponse =====');
      //console.log('🏢 [RESPONSE-RESULT] Company ID:', companyId);
      //console.log('💬 [RESPONSE-RESULT] Conversation ID:', conversationId);
      //console.log('🔑 [RESPONSE-RESULT] Key Used:', geminiConfig?.keyId);
      //console.log('🤖 [RESPONSE-RESULT] Model Used:', geminiConfig?.model);
      //console.log('📝 [RESPONSE-RESULT] Response Length:', aiContent?.length);
      //console.log('📄 [RESPONSE-RESULT] Response Preview:', aiContent?.substring(0, 100) + '...');
      //console.log('🎯 [RESPONSE-RESULT] ===== نهاية النتيجة =====');

      return aiContent;

    } catch (error) {
      console.error('❌ Error in generateAIResponse:', error.message);

      // فحص إذا كان خطأ 404 (Model Not Found)
      const is404Error = error.status === 404 || 
                        error.message?.includes('404') || 
                        error.message?.includes('not found') ||
                        error.message?.includes('is not found for API version');
      
      if (is404Error && providedGeminiConfig) {
        console.log(`🔄 [404-ERROR] Model ${providedGeminiConfig.model} not found. Attempting to switch to next available model...`);
        
        // تحديد النموذج كمستنفد (غير متوفر)
        if (providedGeminiConfig.modelId) {
          await this.markModelAsExhausted(providedGeminiConfig.modelId);
        }
        
        // إضافة النموذج إلى قائمة المستنفدة المؤقتة
        if (this.exhaustedModelsCache) {
          this.exhaustedModelsCache.add(providedGeminiConfig.model);
          console.log(`⚠️ [404-ERROR] Added ${providedGeminiConfig.model} to exhausted cache`);
        }
        
        // محاولة الحصول على نموذج بديل للشركة
        const backupModel = await this.findNextAvailableModel(companyId);
        if (backupModel) {
          console.log(`🔄 [404-FALLBACK] Switching to backup model: ${backupModel.model}`);
          
          // إعادة المحاولة مع النموذج البديل
          try {
            const retryResult = await this.generateAIResponse(
              prompt, 
              conversationMemory, 
              useRAG, 
              backupModel, 
              companyId, 
              conversationId, 
              messageContext
            );
            return retryResult;
          } catch (retryError) {
            console.error('❌ Error in retry with backup model:', retryError.message);
            throw retryError;
          }
        }
      }

      // فحص إذا كان خطأ 503 (Service Unavailable - Model Overloaded)
      const is503Error = error.status === 503 || 
                        error.message?.includes('503') || 
                        error.message?.includes('Service Unavailable') ||
                        error.message?.includes('overloaded');
      
      if (is503Error) {
        console.log('🔄 [503-ERROR] Model is overloaded. Attempting to switch to backup model...');
        
        // محاولة الحصول على نموذج بديل للشركة
        const backupModel = await this.findNextAvailableModel(companyId);
        if (backupModel) {
          console.log(`🔄 [503-FALLBACK] Switching to backup model: ${backupModel.model}`);
          
          // إعادة المحاولة مع النموذج البديل (مع retry logic أيضاً)
          try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(backupModel.apiKey);
            const model = genAI.getGenerativeModel({ 
              model: backupModel.model,
              generationConfig: await this.buildGenerationConfig(companyId, messageContext)
            });

            // 🔄 Retry logic مع exponential backoff للنموذج البديل أيضاً
            let result;
            let response;
            const maxRetries = 3;
            const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s
            let lastRetryError;
            
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
              try {
                result = await model.generateContent(prompt);
                response = result.response;
                break; // Success
              } catch (retryError) {
                lastRetryError = retryError;
                
                const isStill503 = retryError.status === 503 || 
                                 retryError.message?.includes('503') || 
                                 retryError.message?.includes('Service Unavailable') ||
                                 retryError.message?.includes('overloaded');
                
                if (isStill503 && attempt < maxRetries) {
                  const delay = retryDelays[attempt];
                  console.log(`🔄 [RETRY-503-BACKUP] Backup model attempt ${attempt + 1}/${maxRetries + 1} failed with 503. Retrying after ${delay}ms...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                } else {
                  throw retryError;
                }
              }
            }
            
            if (!response) {
              throw lastRetryError || new Error('Backup model failed after retries');
            }
            
            const aiContent = response.text();

            // تحديث عداد الاستخدام للنموذج الجديد
            if (backupModel.modelId) {
              await this.updateModelUsage(backupModel.modelId);
            }

            // تحديث النموذج النشط للجلسة
            this.updateCurrentActiveModel(backupModel);

            console.log(`✅ [503-FALLBACK] Successfully got response from backup model: ${backupModel.model}`);
            return aiContent;
          } catch (retryError) {
            console.error('❌ [503-FALLBACK] Backup model also failed:', retryError.message);
            
            // ✅ FIX: التحقق من نوع الخطأ - إذا كان 429، حاول البحث عن نموذج بديل آخر
            const is429Error = retryError.status === 429 || 
                              retryError.message?.includes('429') || 
                              retryError.message?.includes('Too Many Requests') ||
                              retryError.message?.includes('quota');
            
            if (is429Error) {
              console.log('🔄 [503-FALLBACK-429] Backup model failed with 429. Attempting to find another backup model...');
              
              // محاولة البحث عن نموذج بديل آخر (نموذج ثالث)
              const secondBackupModel = await this.findNextAvailableModel(companyId);
              if (secondBackupModel && secondBackupModel.model !== backupModel.model) {
                console.log(`🔄 [503-FALLBACK-429] Found second backup model: ${secondBackupModel.model}`);
                
                try {
                  const { GoogleGenerativeAI } = require('@google/generative-ai');
                  const genAI = new GoogleGenerativeAI(secondBackupModel.apiKey);
                  const model = genAI.getGenerativeModel({ 
                    model: secondBackupModel.model,
                    generationConfig: await this.buildGenerationConfig(companyId, messageContext)
                  });

                  // 🔄 Retry logic مع exponential backoff للنموذج البديل الثاني
                  let result;
                  let response;
                  const maxRetries = 3;
                  const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s
                  let lastRetryError;
                  
                  for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    try {
                      result = await model.generateContent(prompt);
                      response = result.response;
                      break; // Success
                    } catch (secondRetryError) {
                      lastRetryError = secondRetryError;
                      
                      const isStill503 = secondRetryError.status === 503 || 
                                       secondRetryError.message?.includes('503') || 
                                       secondRetryError.message?.includes('Service Unavailable') ||
                                       secondRetryError.message?.includes('overloaded');
                      
                      if (isStill503 && attempt < maxRetries) {
                        const delay = retryDelays[attempt];
                        console.log(`🔄 [RETRY-503-SECOND-BACKUP] Second backup model attempt ${attempt + 1}/${maxRetries + 1} failed with 503. Retrying after ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                      } else {
                        throw secondRetryError;
                      }
                    }
                  }
                  
                  if (!response) {
                    throw lastRetryError || new Error('Second backup model failed after retries');
                  }
                  
                  const aiContent = response.text();

                  // تحديث عداد الاستخدام للنموذج الجديد
                  if (secondBackupModel.modelId) {
                    await this.updateModelUsage(secondBackupModel.modelId);
                  }

                  // تحديث النموذج النشط للجلسة
                  this.updateCurrentActiveModel(secondBackupModel);

                  console.log(`✅ [503-FALLBACK-429] Successfully got response from second backup model: ${secondBackupModel.model}`);
                  return aiContent;
                } catch (secondBackupError) {
                  console.error('❌ [503-FALLBACK-429] Second backup model also failed:', secondBackupError.message);
                  // سقوط إلى throw retryError الأصلي
                }
              } else {
                console.error('❌ [503-FALLBACK-429] No second backup model available');
              }
            }
            
            throw retryError;
          }
        } else {
          console.error('❌ [503-FALLBACK] No backup model available');
          throw new Error('Model is overloaded and no backup models are available');
        }
      }

      // فحص إذا كان خطأ 429 (تجاوز الحد)
      if (error.status === 429 || error.message.includes('429') || error.message.includes('Too Many Requests')) {
        //console.log('🔄 تم تجاوز حد النموذج، محاولة التبديل...');

        // استخراج معلومات الحد من رسالة الخطأ
        let quotaValue = null;
        let modelName = null;
        try {
          const errorDetails = error.errorDetails || [];
          for (const detail of errorDetails) {
            if (detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure') {
              const violations = detail.violations || [];
              for (const violation of violations) {
                if (violation.quotaValue) {
                  quotaValue = violation.quotaValue;
                }
                if (violation.quotaDimensions && violation.quotaDimensions.model) {
                  modelName = violation.quotaDimensions.model;
                }
              }
            }
          }
        } catch (parseError) {
          //console.log('⚠️ لا يمكن استخراج تفاصيل الحد من الخطأ');
        }

        // تحديث النموذج كمستنفد بناءً على المعلومات الحقيقية
        if (modelName && quotaValue) {
          await this.markModelAsExhaustedFrom429(modelName, quotaValue);
        }

        //console.log('🔄 تم تجاوز حد النموذج، محاولة التبديل...');

        // محاولة الحصول على نموذج بديل للشركة
        const backupModel = await this.findNextAvailableModel(companyId);
        if (backupModel) {
          //console.log(`🔄 تم التبديل إلى نموذج بديل: ${backupModel.model}`);

          // إعادة المحاولة مع النموذج الجديد
          try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(backupModel.apiKey);
            const model = genAI.getGenerativeModel({ model: backupModel.model });

            const result = await model.generateContent(prompt);
            const response = result.response;
            const aiContent = response.text();

            // تحديث عداد الاستخدام للنموذج الجديد
            if (backupModel.modelId) {
              await this.updateModelUsage(backupModel.modelId);
            }

            // تحديث النموذج النشط للجلسة
            this.updateCurrentActiveModel(backupModel);

            return aiContent;
          } catch (retryError) {
            console.error('❌ فشل النموذج البديل أيضاً:', retryError.message);
            throw retryError;
          }
        } else {
          //console.log('❌ لا توجد نماذج بديلة متاحة');
          throw new Error('جميع النماذج المتاحة تجاوزت الحد المسموح');
        }
      }

      throw error;
    }
  }

  /**
   * Enhanced Conversation Flow and Context Analysis System
   * Provides advanced conversation understanding and direction
   */
  async analyzeEnhancedConversationContext(message, conversationMemory , companyId ) {
    try {
      //console.log('🔍 [ENHANCED-CONTEXT] Starting enhanced conversation analysis...');
      
      // Enhanced context building with conversation flow tracking
      const conversationContext = this.buildEnhancedConversationContext(conversationMemory);
      const conversationState = this.analyzeConversationState(conversationMemory);
      const intentWithContext = await this.analyzeIntentWithEnhancedContext(message, conversationContext, conversationState, companyId);
      
      const enhancedContext = {
        intent: intentWithContext.intent,
        confidence: intentWithContext.confidence,
        conversationPhase: conversationState.phase,
        customerEngagement: conversationState.engagement,
        topicContinuity: conversationState.topicContinuity,
        needsRedirection: conversationState.needsRedirection,
        suggestedActions: conversationState.suggestedActions,
        contextualCues: intentWithContext.contextualCues,
        conversationFlow: {
          direction: conversationState.direction,
          momentum: conversationState.momentum,
          expectedNext: conversationState.expectedNext
        }
      };
      
      //console.log('✅ [ENHANCED-CONTEXT] Analysis complete:', {
      //   intent: enhancedContext.intent,
      //   phase: enhancedContext.conversationPhase,
      //   engagement: enhancedContext.customerEngagement,
      //   direction: enhancedContext.conversationFlow.direction
      // });
      
      return enhancedContext;
      
    } catch (error) {
      console.error('❌ [ENHANCED-CONTEXT] Error in enhanced analysis:', error);
      // Fallback to simple intent analysis
      const basicIntent = await this.analyzeIntent(message, conversationMemory, companyId);
      return {
        intent: basicIntent,
        confidence: 0.6,
        conversationPhase: 'unknown',
        customerEngagement: 'moderate',
        topicContinuity: 'unclear',
        needsRedirection: false,
        suggestedActions: [],
        contextualCues: [],
        conversationFlow: {
          direction: 'neutral',
          momentum: 'stable',
          expectedNext: 'any'
        }
      };
    }
  }

  /**
   * Build enhanced conversation context with flow analysis
   */
  buildEnhancedConversationContext(conversationMemory) {
    if (!conversationMemory || conversationMemory.length === 0) {
      return {
        recentContext: '',
        topics: [],
        customerBehavior: 'new',
        conversationLength: 0
      };
    }

    // Analyze conversation topics and patterns
    const topics = this.extractConversationTopics(conversationMemory);
    const customerBehavior = this.analyzeCustomerBehavior(conversationMemory);
    
    // Build rich context from recent messages (last 5 interactions)
    const recentMessages = conversationMemory.slice(-5);
    const recentContext = recentMessages.map((memory, index) => {
      const timeAgo = this.getTimeAgo(new Date(memory.createdAt || memory.timestamp));
      const position = recentMessages.length - index;
      const sender = memory.isFromCustomer ? 'العميل' : 'الرد';
      return `[${position}] منذ ${timeAgo}:\n   ${sender}: ${memory.content}\n   النية: ${memory.intent || 'غير محدد'}`;
    }).join('\n---\n');

    return {
      recentContext,
      topics,
      customerBehavior,
      conversationLength: conversationMemory.length
    };
  }

  /**
   * Analyze current conversation state and flow
   */
  analyzeConversationState(conversationMemory) {
    const state = {
      phase: 'discovery', // discovery, consideration, decision, support
      engagement: 'moderate', // low, moderate, high
      topicContinuity: 'stable', // stable, shifting, scattered
      needsRedirection: false,
      suggestedActions: [],
      direction: 'neutral', // positive, neutral, negative
      momentum: 'stable', // increasing, stable, decreasing
      expectedNext: 'any' // specific expectations based on flow
    };

    if (!conversationMemory || conversationMemory.length === 0) {
      state.phase = 'initial';
      state.expectedNext = 'greeting_or_inquiry';
      return state;
    }

    // Analyze conversation phase based on intents and content
    const recentIntents = conversationMemory.slice(-3).map(m => m.intent || 'unknown');
    const hasProductInquiry = recentIntents.includes('product_inquiry');
    const hasPriceInquiry = recentIntents.includes('price_inquiry');
    const hasOrderInquiry = recentIntents.includes('order_inquiry');

    if (hasOrderInquiry || conversationMemory.some(m => {
      const msg = m.userMessage || (m.isFromCustomer ? m.content : '');
      return msg && (msg.includes('أريد أطلب') || msg.includes('عايز أشتري'));
    })) {
      state.phase = 'decision';
      state.expectedNext = 'order_details_or_confirmation';
    } else if (hasPriceInquiry && hasProductInquiry) {
      state.phase = 'consideration';
      state.expectedNext = 'decision_or_more_questions';
    } else if (hasProductInquiry) {
      state.phase = 'discovery';
      state.expectedNext = 'price_or_details_inquiry';
    }

    // Analyze engagement level
    const messageFrequency = this.calculateMessageFrequency(conversationMemory);
    const responseLength = conversationMemory.slice(-3).reduce((avg, m) => {
      const msgLength = m.userMessage?.length || (m.isFromCustomer ? m.content?.length : 0) || 0;
      return avg + msgLength;
    }, 0) / Math.min(3, conversationMemory.length);
    
    if (messageFrequency > 2 && responseLength > 20) {
      state.engagement = 'high';
    } else if (messageFrequency < 0.5 || responseLength < 10) {
      state.engagement = 'low';
    }

    // Analyze topic continuity
    const topicConsistency = this.analyzeTopicConsistency(conversationMemory);
    if (topicConsistency < 0.3) {
      state.topicContinuity = 'scattered';
      state.needsRedirection = true;
      state.suggestedActions.push('focus_conversation');
    } else if (topicConsistency < 0.6) {
      state.topicContinuity = 'shifting';
    }

    // Analyze conversation direction and momentum
    const sentimentTrend = this.analyzeSentimentTrend(conversationMemory);
    if (sentimentTrend > 0.2) {
      state.direction = 'positive';
      state.momentum = 'increasing';
    } else if (sentimentTrend < -0.2) {
      state.direction = 'negative';
      state.momentum = 'decreasing';
      state.suggestedActions.push('improve_sentiment');
    }

    return state;
  }

  /**
   * Enhanced intent analysis with contextual understanding
   */
  async analyzeIntentWithEnhancedContext(message, conversationContext, conversationState, companyId) {
    try {
      // ⚡ OPTIMIZATION: Quick pattern check for obvious intents
      const quickIntent = this.quickIntentCheck(message);
      if (quickIntent) {
        //console.log(`⚡ [OPTIMIZATION] Quick intent detected: ${quickIntent} - skipping AI`);
        return {
          intent: quickIntent,
          confidence: 0.85,
          contextualCues: ['pattern_match'],
          reasoning: 'Quick pattern detection'
        };
      }
      
      const enhancedPrompt = `
أنت خبير متقدم في تحليل المحادثات وفهم نوايا العملاء بعمق.

الرسالة الحالية: "${message}"

السياق المتقدم للمحادثة:
=====================================
${conversationContext.recentContext || 'لا يوجد سياق سابق'}
=====================================

حالة المحادثة الحالية:
- المرحلة: ${conversationState.phase}
- مستوى التفاعل: ${conversationState.engagement}
- استمرارية الموضوع: ${conversationState.topicContinuity}
- اتجاه المحادثة: ${conversationState.direction}
- الزخم: ${conversationState.momentum}

مهمتك:
1. حدد النية الأساسية من الخيارات التالية:
   - product_inquiry: استفسار عن المنتجات
   - price_inquiry: استفسار عن الأسعار
   - shipping_inquiry: استفسار عن الشحن
   - order_inquiry: رغبة في الطلب
   - greeting: تحية أو بداية محادثة
   - clarification: طلب توضيح
   - comparison: مقارنة منتجات
   - support: طلب دعم أو مساعدة
   - general_inquiry: استفسار عام

2. حدد الإشارات السياقية المهمة
3. قدر مستوى الثقة (0.1-1.0)

صيغة الرد (JSON):
{
  "intent": "اختر_من_القائمة",
  "confidence": 0.8,
  "contextualCues": ["إشارة1", "إشارة2"],
  "reasoning": "السبب في تحديد هذه النية"
}

ملاحظات خاصة:
- إذا ذكر "صور" أو "صورة" = product_inquiry
- إذا ذكر أرقام أو "كام" = price_inquiry  
- إذا ذكر "طلب" أو "أشتري" = order_inquiry
- انتبه للسياق المتراكم من المحادثة السابقة
- إذا كان السياق غامض، اطلب توضيح = clarification
`;

      const aiResponse = await this.generateAIResponse(enhancedPrompt, [], false, null, companyId);
      
      try {
        const result = JSON.parse(aiResponse.trim());
        
        // Validate the result
        const validIntents = ['product_inquiry', 'price_inquiry', 'shipping_inquiry', 'order_inquiry', 'greeting', 'clarification', 'comparison', 'support', 'general_inquiry'];
        
        if (validIntents.includes(result.intent)) {
          //console.log(`🎯 [ENHANCED-INTENT] Detected: ${result.intent} (confidence: ${result.confidence})`);
          return {
            intent: result.intent,
            confidence: result.confidence || 0.7,
            contextualCues: result.contextualCues || [],
            reasoning: result.reasoning || ''
          };
        }
      } catch (parseError) {
        //console.log('⚠️ [ENHANCED-INTENT] Failed to parse AI response, extracting intent...');
        // Try to extract intent from response text
        const extractedIntent = this.extractIntentFromResponse(aiResponse);
        if (extractedIntent) {
          return {
            intent: extractedIntent,
            confidence: 0.6,
            contextualCues: [],
            reasoning: 'Extracted from unstructured response'
          };
        }
      }
      
      // Fallback to pattern-based analysis instead of another AI call
      //console.log('🔄 [ENHANCED-INTENT] Falling back to pattern analysis');
      const fallbackIntent = this.fallbackIntentAnalysis(message);
      return {
        intent: fallbackIntent,
        confidence: 0.5,
        contextualCues: [],
        reasoning: 'Fallback analysis'
      };
      
    } catch (error) {
      console.error('❌ [ENHANCED-INTENT] Error in enhanced intent analysis:', error);
      return {
        intent: 'general_inquiry',
        confidence: 0.3,
        contextualCues: [],
        reasoning: 'Error fallback'
      };
    }
  }

  /**
   * Analyze customer intent using AI-powered understanding (Original function - kept for compatibility)
   */
  async analyzeIntent(message, conversationMemory , companyId) {
    try {
      // Build context from recent conversation
      let conversationContext = '';
      if (conversationMemory.length > 0) {
        const recentMessages = conversationMemory.slice(-3); // Last 3 interactions
        conversationContext = recentMessages.map(memory =>
          `العميل: ${memory.userMessage}\nالرد: ${memory.aiResponse}`
        ).join('\n---\n');
      }

      // AI-powered intent analysis prompt
      const intentPrompt = `
أنت خبير في تحليل نوايا العملاء. حلل الرسالة التالية وحدد النية بدقة:

الرسالة الحالية: "${message}"

${conversationContext ? `سياق المحادثة السابقة:\n${conversationContext}\n` : ''}

حدد النية من الخيارات التالية فقط:
- product_inquiry: إذا كان يسأل عن المنتجات أو يريد معلومات أو صور عن المنتجات
- price_inquiry: إذا كان يسأل عن الأسعار أو التكلفة
- shipping_inquiry: إذا كان يسأل عن الشحن أو التوصيل
- order_inquiry: إذا كان يريد طلب أو شراء شيء
- greeting: إذا كان يحيي أو يبدأ المحادثة
- general_inquiry: لأي استفسار عام آخر

ملاحظات مهمة:
- إذا طلب "صور" أو "صورة" أو "ممكن أشوف" أو "صورته" = product_inquiry
- إذا كان السياق يتحدث عن منتج وطلب شيء غامض مثل "ممكن صورته" = product_inquiry
- ركز على السياق والمعنى وليس فقط الكلمات

أجب بكلمة واحدة فقط من الخيارات أعلاه.
`;

      // Use AI to analyze intent (no pattern tracking needed for intent analysis)
      const aiResponse = await this.generateAIResponse(intentPrompt, [], false, null, companyId);
      const detectedIntent = aiResponse.trim().toLowerCase();

      // Validate the response and fallback to keyword-based if needed
      const validIntents = ['product_inquiry', 'price_inquiry', 'shipping_inquiry', 'order_inquiry', 'greeting', 'general_inquiry'];

      if (validIntents.includes(detectedIntent)) {
        //console.log(`🧠 AI detected intent: ${detectedIntent} for message: "${message}"`);
        return detectedIntent;
      } else {
        //console.log(`⚠️ AI returned invalid intent: ${detectedIntent}, falling back to keyword analysis`);
        return this.fallbackIntentAnalysis(message);
      }

    } catch (error) {
      //console.log(`❌ Error in AI intent analysis: ${error.message}, falling back to keyword analysis`);
      return this.fallbackIntentAnalysis(message);
    }
  }

  /**
   * Fallback keyword-based intent analysis
   */
  /**
   * Helper functions for Enhanced Conversation Flow Analysis
   */

  /**
   * Extract conversation topics from memory
   */
  extractConversationTopics(conversationMemory) {
    const topics = new Map();
    
    conversationMemory.forEach(memory => {
      // ✅ Add null safety check
      if (!memory) return;
      
      // ✅ دعم كلا الـ formats (القديم والجديد)
      let userMessage = '';
      if (memory.userMessage) {
        userMessage = memory.userMessage.toLowerCase();
      } else if (memory.content && memory.isFromCustomer) {
        userMessage = memory.content.toLowerCase();
      } else {
        return; // Skip if no user message
      }
      
      const intent = memory.intent || 'unknown';
      
      // Extract product-related topics
      const productKeywords = ['كوتشي', 'حذاء', 'شوز', 'حقيبة', 'جزمة', 'صندل'];
      const foundProducts = productKeywords.filter(keyword => userMessage.includes(keyword));
      foundProducts.forEach(product => {
        topics.set(`product_${product}`, (topics.get(`product_${product}`) || 0) + 1);
      });
      
      // Extract color topics
      const colorKeywords = ['أسود', 'أبيض', 'أحمر', 'أزرق', 'أخضر', 'بني', 'رمادي'];
      const foundColors = colorKeywords.filter(color => userMessage.includes(color));
      foundColors.forEach(color => {
        topics.set(`color_${color}`, (topics.get(`color_${color}`) || 0) + 1);
      });
      
      // Extract size topics
      const sizePattern = /\b(\d{2})\b|مقاس|مقاسات|سايز/g;
      if (sizePattern.test(userMessage)) {
        topics.set('sizing', (topics.get('sizing') || 0) + 1);
      }
      
      // Extract intent-based topics
      topics.set(`intent_${intent}`, (topics.get(`intent_${intent}`) || 0) + 1);
    });
    
    // Convert to sorted array
    return Array.from(topics.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 topics
  }

  /**
   * Analyze customer behavior patterns
   */
  analyzeCustomerBehavior(conversationMemory) {
    if (conversationMemory.length === 0) return 'new';
    
    const totalMessages = conversationMemory.length;
    const uniqueIntents = new Set(conversationMemory.map(m => m.intent)).size;
    const messageFrequency = this.calculateMessageFrequency(conversationMemory);
    const avgMessageLength = conversationMemory.reduce((sum, m) => {
      const msgLength = m.userMessage?.length || (m.isFromCustomer ? m.content?.length : 0) || 0;
      return sum + msgLength;
    }, 0) / totalMessages;
    
    // Determine behavior type
    if (totalMessages >= 10 && uniqueIntents >= 3) {
      return 'engaged_explorer'; // Active customer exploring multiple aspects
    } else if (messageFrequency > 2 && avgMessageLength > 30) {
      return 'detail_seeker'; // Wants detailed information
    } else if (messageFrequency > 1 && avgMessageLength < 15) {
      return 'quick_decider'; // Fast, concise decision maker
    } else if (totalMessages >= 5 && uniqueIntents <= 2) {
      return 'focused_buyer'; // Focused on specific product/service
    } else if (messageFrequency < 0.5) {
      return 'casual_browser'; // Slow, casual browsing
    } else {
      return 'standard'; // Standard behavior pattern
    }
  }

  /**
   * Calculate message frequency (messages per hour)
   */
  calculateMessageFrequency(conversationMemory) {
    if (conversationMemory.length < 2) return 0;
    
    const firstMessage = new Date(conversationMemory[0].timestamp);
    const lastMessage = new Date(conversationMemory[conversationMemory.length - 1].timestamp);
    const timeDiffHours = (lastMessage - firstMessage) / (1000 * 60 * 60);
    
    return timeDiffHours > 0 ? conversationMemory.length / timeDiffHours : 0;
  }

  /**
   * Analyze topic consistency across conversation
   */
  analyzeTopicConsistency(conversationMemory) {
    if (conversationMemory.length < 2) return 1.0;
    
    const topics = this.extractConversationTopics(conversationMemory);
    if (topics.length === 0) return 0.5;
    
    // Calculate how focused the conversation is on top topics
    const totalTopicMentions = topics.reduce((sum, topic) => sum + topic.count, 0);
    const topTopicMentions = topics.slice(0, 2).reduce((sum, topic) => sum + topic.count, 0);
    
    return totalTopicMentions > 0 ? topTopicMentions / totalTopicMentions : 0.5;
  }

  /**
   * Analyze sentiment trend across conversation
   */
  analyzeSentimentTrend(conversationMemory) {
    if (conversationMemory.length < 2) return 0;
    
    const sentimentValues = conversationMemory.map(memory => {
      const sentiment = memory.sentiment || 'neutral';
      switch (sentiment) {
        case 'positive': return 1;
        case 'negative': return -1;
        default: return 0;
      }
    });
    
    // Calculate trend using simple linear regression approach
    const n = sentimentValues.length;
    const recent = sentimentValues.slice(-3); // Last 3 messages
    const earlier = sentimentValues.slice(0, Math.min(3, n - 3)); // Earlier messages
    
    const recentAvg = recent.length > 0 ? recent.reduce((sum, val) => sum + val, 0) / recent.length : 0;
    const earlierAvg = earlier.length > 0 ? earlier.reduce((sum, val) => sum + val, 0) / earlier.length : 0;
    
    return recentAvg - earlierAvg; // Positive = improving, negative = declining
  }

  /**
   * Extract intent from unstructured AI response
   */
  extractIntentFromResponse(response) {
    const text = response.toLowerCase();
    const validIntents = ['product_inquiry', 'price_inquiry', 'shipping_inquiry', 'order_inquiry', 'greeting', 'clarification', 'comparison', 'support', 'general_inquiry'];
    
    for (const intent of validIntents) {
      if (text.includes(intent) || text.includes(intent.replace('_', ' '))) {
        return intent;
      }
    }
    
    // Try to match Arabic terms
    if (text.includes('منتج') || text.includes('صور')) return 'product_inquiry';
    if (text.includes('سعر') || text.includes('ثمن')) return 'price_inquiry';
    if (text.includes('شحن') || text.includes('توصيل')) return 'shipping_inquiry';
    if (text.includes('طلب') || text.includes('شراء')) return 'order_inquiry';
    if (text.includes('تحية') || text.includes('مرحبا')) return 'greeting';
    if (text.includes('توضيح') || text.includes('فهم')) return 'clarification';
    if (text.includes('مقارنة') || text.includes('فرق')) return 'comparison';
    if (text.includes('مساعدة') || text.includes('دعم')) return 'support';
    
    return null;
  }

  /**
   * Enhanced conversation state management for response generation
   */
  enhanceResponseWithConversationState(baseResponse, conversationState, enhancedContext) {
    try {
      //console.log('🎨 [ENHANCED-RESPONSE] Enhancing response with conversation state...');
      
      // ✅ SMART ENHANCEMENT: إضافة تحسينات ذكية فقط عند الحاجة
      let enhancedResponse = baseResponse;
      
      // تحقق من أن الرد الأساسي موجود ومفيد
      if (!baseResponse || baseResponse.trim().length < 10) {
        return baseResponse; // رد قصير جداً أو فاضي - نسيبه زي ما هو
      }
      
      // تجنب إضافة أي شيء إذا كان الرد يحتوي على أسئلة أو طلبات واضحة
      const hasQuestion = baseResponse.includes('؟') || baseResponse.includes('?');
      const hasActionRequest = /تحب|عايز|محتاج|ممكن|أبعت|وريني|اشوف/.test(baseResponse);
      
      if (hasQuestion || hasActionRequest) {
        // الرد يحتوي على سؤال أو طلب فعل - نسيبه زي ما هو
        return baseResponse;
      }
      
      // إضافة توجيه خفيف فقط في حالات محددة جداً:
      
      // 1. لو المحادثة في مرحلة القرار وengagement عالي - ساعده يكمل
      if (conversationState.phase === 'decision' && 
          conversationState.engagement === 'high' &&
          conversationState.momentum === 'increasing') {
        // المستخدم مهتم وجاهز للشراء - لا داعي لإضافة أي شيء
        return enhancedResponse;
      }
      
      // 2. لو engagement منخفض جداً ولم يكن هناك تقدم - سؤال خفيف
      if (conversationState.engagement === 'low' && 
          conversationState.momentum === 'stagnant' &&
          !hasQuestion &&
          Math.random() > 0.8) { // 20% فقط من الوقت
        enhancedResponse += '\n\nفي حاجة محددة تحبي تعرفي عنها أكتر؟';
      }
      
      //console.log('✅ [ENHANCED-RESPONSE] Response enhanced intelligently');
      return enhancedResponse;
      
    } catch (error) {
      console.error('❌ [ENHANCED-RESPONSE] Error enhancing response:', error);
      return baseResponse; // Return original response if enhancement fails
    }
  }

  /**
   * Conversation context memory optimization
   */
  optimizeConversationMemoryForContext(conversationMemory, currentIntent, maxContextSize = 5) {
    if (!conversationMemory || conversationMemory.length <= maxContextSize) {
      return conversationMemory;
    }
    
    //console.log('🔧 [MEMORY-OPTIMIZE] Optimizing conversation memory for context...');
    
    // Always include the most recent messages
    const recentMessages = conversationMemory.slice(-2);
    
    // Include intent-relevant messages
    const intentRelevantMessages = conversationMemory.filter(memory => {
      const memoryIntent = memory.intent || 'unknown';
      return memoryIntent === currentIntent && !recentMessages.includes(memory);
    }).slice(-2); // Last 2 relevant messages
    
    // Include high-engagement messages (longer user messages)
    const highEngagementMessages = conversationMemory.filter(memory => {
      const msgLength = memory.userMessage?.length || (memory.isFromCustomer ? memory.content?.length : 0) || 0;
      return msgLength > 30 && 
             !recentMessages.includes(memory) && 
             !intentRelevantMessages.includes(memory);
    }).slice(-1); // Last 1 high-engagement message
    
    // Combine and sort by timestamp
    const optimizedMemory = [...recentMessages, ...intentRelevantMessages, ...highEngagementMessages]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-maxContextSize);
    
    //console.log(`📊 [MEMORY-OPTIMIZE] Optimized from ${conversationMemory.length} to ${optimizedMemory.length} messages`);
    
    return optimizedMemory;
  }

  /**
   * Fallback intent analysis (Original function - kept for compatibility)
   */
  fallbackIntentAnalysis(message) {
    const lowerMessage = message.toLowerCase();

    // Enhanced patterns with better logic
    if (lowerMessage.includes('شحن') || lowerMessage.includes('توصيل') || lowerMessage.includes('delivery')) {
      return 'shipping_inquiry';
    }

    if (lowerMessage.includes('صور') || lowerMessage.includes('صورة') || lowerMessage.includes('صورته') ||
        lowerMessage.includes('أشوف') || lowerMessage.includes('اشوف') || lowerMessage.includes('منتج') ||
        lowerMessage.includes('كوتشي') || lowerMessage.includes('ايه المنتجات') || lowerMessage.includes('عندك ايه')) {
      return 'product_inquiry';
    }

    if (lowerMessage.includes('سعر') || lowerMessage.includes('كام') || lowerMessage.includes('بكام')) {
      return 'price_inquiry';
    }

    if (lowerMessage.includes('طلب') || lowerMessage.includes('اشتري') || lowerMessage.includes('اطلب')) {
      return 'order_inquiry';
    }

    if (lowerMessage.includes('سلام') || lowerMessage.includes('مرحبا') || lowerMessage.includes('اهلا')) {
      return 'greeting';
    }

    // Smart contextual detection
    if (lowerMessage.includes('ممكن') || lowerMessage.includes('عايز') || lowerMessage.includes('يا ريت')) {
      return 'product_inquiry'; // Most requests are about products
    }

    return 'general_inquiry';
  }

  /**
   * Quick intent check using pattern matching (optimization)
   */
  quickIntentCheck(message) {
    const lowerMsg = message.toLowerCase();
    
    // Product inquiry patterns
    if (lowerMsg.includes('صور') || lowerMsg.includes('صورة') || 
        lowerMsg.includes('أشوف') || lowerMsg.includes('اشوف') ||
        lowerMsg.includes('عايز') || lowerMsg.includes('عاوز') ||
        lowerMsg.includes('عندك ايه') || lowerMsg.includes('ايه المنتجات') ||
        lowerMsg.includes('منتج') || lowerMsg.includes('كوتشي')) {
      return 'product_inquiry';
    }
    
    // Price inquiry patterns
    if (lowerMsg.includes('سعر') || lowerMsg.includes('كام') || 
        lowerMsg.includes('بكام') || lowerMsg.includes('تمن')) {
      return 'price_inquiry';
    }
    
    // Shipping inquiry patterns
    if (lowerMsg.includes('شحن') || lowerMsg.includes('توصيل') || 
        lowerMsg.includes('delivery')) {
      return 'shipping_inquiry';
    }
    
    // Order inquiry patterns
    if (lowerMsg.includes('طلب') || lowerMsg.includes('اشتري') || 
        lowerMsg.includes('اطلب') || lowerMsg.includes('احجز')) {
      return 'order_inquiry';
    }
    
    // Greeting patterns
    if (lowerMsg.includes('سلام') || lowerMsg.includes('مرحبا') || 
        lowerMsg.includes('اهلا') || lowerMsg.includes('هاي')) {
      return 'greeting';
    }
    
    return null; // No quick match, need AI analysis
  }

  /**
   * Analyze customer sentiment
   */
  analyzeSentiment(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('شكرا') || lowerMessage.includes('ممتاز') || lowerMessage.includes('جميل')) {
      return 'positive';
    } else if (lowerMessage.includes('مشكلة') || lowerMessage.includes('سيء') || lowerMessage.includes('غلط')) {
      return 'negative';
    }

    return 'neutral';
  }

  /**
   * Calculate similarity between two strings (0 = completely different, 1 = identical)
   * Uses Levenshtein distance algorithm
   */
  calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    // Calculate Levenshtein distance
    const editDistance = this.levenshteinDistance(longer, shorter);
    
    // Convert to similarity score (0-1)
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Detect if customer is confirming an order using AI only (Pure AI Version)
   */
  async detectOrderConfirmation(message, conversationMemory, customerId, companyId ) {
  if (message.length < 2) {
    return { isConfirming: false, orderDetails: null };
  }
  
  // ⚡ OPTIMIZATION: Quick pattern check للحالات الواضحة
  const lowerMsg = message.toLowerCase();
  const clearlyNotConfirmation = [
    'صور', 'صورة', 'شوف', 'أشوف', 'عايز', 'عاوز', 'ممكن', 
    'متوفر', 'موجود', 'سعر', 'كام', 'بكام', 'ايه', 'إيه'
  ];
  
  // إذا الرسالة تحتوي على كلمات استفسار واضحة، skip AI
  if (clearlyNotConfirmation.some(word => lowerMsg.includes(word)) && 
      !lowerMsg.includes('تأكيد') && !lowerMsg.includes('نعم') && !lowerMsg.includes('موافق')) {
    //console.log('⚡ [OPTIMIZATION] Message clearly not a confirmation - skipping AI');
    return { isConfirming: false, orderDetails: null };
  }
  
  try {
    // فحص إضافي: منع إنشاء طلبات مكررة
    if (customerId) {
      const recentOrder = await this.checkRecentOrderForCustomer(customerId);
      if (recentOrder) {
        console.log(`⚠️ [DUPLICATE-PREVENTION] Customer ${customerId} has recent order`);
        return { isConfirming: false, orderDetails: null, reason: 'recent_order_exists' };
      }
    }
    
    // ✅ PASS companyId to AI detection
    const isConfirming = await this.detectConfirmationWithAI(
      message, 
      conversationMemory, 
      companyId // ✅ Already passed correctly
    );
    
    console.log(`🤖 AI Confirmation Detection: ${isConfirming ? 'YES' : 'NO'}`);
    
    if (!isConfirming) {
      return { isConfirming: false, orderDetails: null };
    }
    
    // ✅ CRITICAL FIX: Pass companyId and current message to extractOrderDetailsFromMemory
    const orderDetails = await this.extractOrderDetailsFromMemory(
      conversationMemory,
      companyId, // ✅ ADD THIS PARAMETER
      message // ✅ PASS current message
    );
    
    return {
      isConfirming: true,
      orderDetails: orderDetails,
      detectionMethod: 'pure_ai'
    };
    
  } catch (error) {
    console.error('❌ AI confirmation detection failed:', error);
    return { isConfirming: false, orderDetails: null };
  }
}

  /**
   * فحص وجود طلب حديث للعميل (خلال آخر 5 دقائق)
   */
  async checkRecentOrderForCustomer(customerId) {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const recentOrder = await this.getSharedPrismaClient().order.findFirst({
        where: {
          customerId: customerId,
          createdAt: {
            gte: fiveMinutesAgo
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return recentOrder;
    } catch (error) {
      console.error('❌ Error checking recent orders:', error);
      return null;
    }
  }

  /**
   * فحص اكتمال البيانات المطلوبة لإنشاء الطلب
   */
  async checkDataCompleteness(orderDetails, conversationMemory, messageContent ) {
    console.log('📋 [DATA-CHECK] فحص اكتمال البيانات...');
    console.log('📋 [DATA-CHECK] Order Details:', JSON.stringify(orderDetails, null, 2));
    
    const missingData = [];
    const requiredFields = ['customerName', 'customerPhone', 'customerAddress', 'city', 'productSize', 'productColor'];

    // فحص البيانات الأساسية
    if (!orderDetails.customerName || orderDetails.customerName === 'عميل جديد' || /^\d+/.test(orderDetails.customerName)) {
      console.log('⚠️ [DATA-CHECK] اسم العميل مفقود أو غير صحيح');
      missingData.push('customerName');
    }

    if (!orderDetails.customerPhone || orderDetails.customerPhone.length < 10) {
      console.log('⚠️ [DATA-CHECK] رقم الهاتف مفقود أو غير صحيح');
      missingData.push('customerPhone');
    }

    if (!orderDetails.customerAddress || orderDetails.customerAddress.trim() === '' || orderDetails.customerAddress === 'غير محدد') {
      console.log('⚠️ [DATA-CHECK] العنوان مفقود أو غير صحيح');
      missingData.push('customerAddress');
    }

    // فحص المدينة/المحافظة
    if (!orderDetails.city || orderDetails.city === 'غير محدد' || orderDetails.city.trim() === '') {
      console.log('⚠️ [DATA-CHECK] المدينة/المحافظة مفقودة');
      missingData.push('city');
    }

    // فحص المقاس
    if (!orderDetails.productSize || orderDetails.productSize === null) {
      console.log('⚠️ [DATA-CHECK] المقاس مفقود');
      missingData.push('productSize');
    }

    // فحص اللون
    if (!orderDetails.productColor || orderDetails.productColor === null) {
      console.log('⚠️ [DATA-CHECK] اللون مفقود');
      missingData.push('productColor');
    }

    // ✅ البحث المتقدم في المحادثة للبيانات المفقودة
    let conversationText = conversationMemory.map(m => m.content || '').join(' ');
    
    // إضافة محتوى الرسالة الحالية للبحث
    if (messageContent) {
      conversationText += ' ' + messageContent;
    }
    
    console.log('📝 [DATA-CHECK] Conversation text length:', conversationText.length);
    const conversationLower = conversationText.toLowerCase();

    // البحث عن رقم هاتف في المحادثة
    const phoneMatch = conversationText.match(/01[0-9]{9}/);
    if (phoneMatch && missingData.includes('customerPhone')) {
      console.log('✅ [DATA-CHECK] وجدت رقم هاتف في المحادثة:', phoneMatch[0]);
      orderDetails.customerPhone = phoneMatch[0];
      missingData.splice(missingData.indexOf('customerPhone'), 1);
    }

    // البحث عن عنوان في المحادثة - تحسين البحث
    const addressKeywords = ['عنوان', 'شارع', 'عمارة', 'الدور', 'شقة', 'منطقة', 'برج', 'الشروق', 'بورسعيد', 'اسكندري', 'سموحه', 'النصر'];
    const hasAddress = addressKeywords.some(keyword => conversationLower.includes(keyword));
    if (hasAddress && missingData.includes('customerAddress')) {
      console.log('✅ [DATA-CHECK] وجدت عنوان في المحادثة');
      // استخراج العنوان من النص
      const addressMatch = conversationText.match(/(?:عنوان|العنوان)\s*:?\s*([^.\n]+)/i) ||
                          conversationText.match(/(?:شارع|منطقة|برج)\s+([^.\n]+)/i);
      if (addressMatch) {
        orderDetails.customerAddress = addressMatch[1].trim();
        missingData.splice(missingData.indexOf('customerAddress'), 1);
      }
    }

    // البحث عن اسم العميل في المحادثة - تحسين البحث
    const namePatterns = [
      /(?:الاسم الكامل|لاسم الكامل|الاسم)\s*:?\s*([^\n.]+?)(?:\s+العنوان|رقم|$)/i,
      /(?:اسمي|انا)\s+([^\n.]+?)(?:\s+من|$)/i,
      // البحث عن أسماء عربية في بداية الرسالة
      /^([^\d\n.]{3,50})/m
    ];
    
    for (const pattern of namePatterns) {
      const nameMatch = conversationText.match(pattern);
      if (nameMatch && missingData.includes('customerName')) {
        let extractedName = nameMatch[1].trim();
        // تنظيف الاسم من الكلمات غير المرغوبة
        extractedName = extractedName.replace(/^(ال|يا|اهلا|مرحبا)/i, '').trim();
        // التحقق من أن الاسم يبدو صحيحاً (يحتوي على حروف عربية وليس أرقام فقط)
        if (extractedName.length > 2 && !/^\d+$/.test(extractedName) && /[\u0600-\u06FF]/.test(extractedName)) {
          console.log('✅ [DATA-CHECK] وجدت اسم العميل في المحادثة:', extractedName);
          orderDetails.customerName = extractedName;
          missingData.splice(missingData.indexOf('customerName'), 1);
          break;
        }
      }
    }

    // البحث عن المقاس في المحادثة
    const sizePatterns = [
      /(?:المقاس|قياس|مقاس)\s*:?\s*(\d{2})/i,
      /(\d{2})\s*(?:مقاس|قياس)/i,
      /مقاس\s+(\d{2})/i
    ];
    
    for (const pattern of sizePatterns) {
      const sizeMatch = conversationText.match(pattern);
      if (sizeMatch && missingData.includes('productSize')) {
        const size = sizeMatch[1];
        if (parseInt(size) >= 35 && parseInt(size) <= 46) {
          console.log('✅ [DATA-CHECK] وجدت المقاس في المحادثة:', size);
          orderDetails.productSize = size;
          missingData.splice(missingData.indexOf('productSize'), 1);
          break;
        }
      }
    }

    // البحث عن اللون في المحادثة
    const colorPatterns = [
      /(?:اللون|لون)\s*:?\s*([\u0600-\u06FF]+?)(?:\s|$)/i,
      /لون\s+([\u0600-\u06FF]+?)(?:\s|$)/i,
      /(أسود|أبيض|بني|كحلي|أحمر|أزرق|أخضر|رمادي|وردي|بنفسجي|برتقالي)/i
    ];
    
    for (const pattern of colorPatterns) {
      const colorMatch = conversationText.match(pattern);
      if (colorMatch && missingData.includes('productColor')) {
        let color = colorMatch[1] || colorMatch[0];
        // تنظيف اللون من الكلمات الإضافية
        color = color.replace(/^(اللون|لون)/i, '').trim();
        if (color.length > 1 && /[\u0600-\u06FF]/.test(color)) {
          console.log('✅ [DATA-CHECK] وجدت اللون في المحادثة:', color);
          orderDetails.productColor = color;
          missingData.splice(missingData.indexOf('productColor'), 1);
          break;
        }
      }
    }

    // البحث عن المدينة في المحادثة
    const cities = ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا', 'الزقازيق', 'أسوان', 'الأقصر', 'اسكندريه', 'اسكندري', 'سموحة', 'سموحه'];
    for (const city of cities) {
      if (conversationLower.includes(city.toLowerCase()) && missingData.includes('city')) {
        console.log('✅ [DATA-CHECK] وجدت المدينة في المحادثة:', city);
        orderDetails.city = city;
        missingData.splice(missingData.indexOf('city'), 1);
        break;
      }
    }

    console.log('📋 [DATA-CHECK] نتيجة الفحص بعد البحث المتقدم:', {
      orderDetails: {
        customerName: orderDetails.customerName,
        customerPhone: orderDetails.customerPhone,
        customerAddress: orderDetails.customerAddress,
        city: orderDetails.city,
        productSize: orderDetails.productSize,
        productColor: orderDetails.productColor
      },
      missingData,
      isComplete: missingData.length === 0
    });

    return {
      isComplete: missingData.length === 0,
      missingData,
      completedFields: requiredFields.filter(field => !missingData.includes(field)),
      // ✅ إرجاع orderDetails المحدثة
      updatedOrderDetails: orderDetails
    };
  }

  /**
   * إنشاء رد لطلب البيانات المفقودة باستخدام الذكاء الاصطناعي
   */
  async generateDataRequestResponse(missingData, orderDetails, companyId ) {
    try {
      //console.log('🤖 [AI-DATA-REQUEST] Generating AI response for missing data request');

      // بناء prompt للذكاء الاصطناعي
      const missingDataText = missingData.map(field => {
        switch(field) {
          case 'customerName': return 'الاسم الكامل';
          case 'customerPhone': return 'رقم الهاتف';
          case 'customerAddress': return 'العنوان الكامل';
          case 'city': return 'المدينة أو المحافظة';
          case 'productSize': return 'المقاس';
          case 'productColor': return 'اللون';
          default: return field;
        }
      }).join(' و ');

      const prompt = `أنت مساعد مبيعات في متجر مصري. العميل أكد رغبته في الشراء.

🛍️ تفاصيل الطلب:
${orderDetails.productName ? `• المنتج: ${orderDetails.productName}` : ''}
${orderDetails.productColor ? `• اللون: ${orderDetails.productColor}` : ''}
${orderDetails.productSize ? `• المقاس: ${orderDetails.productSize}` : ''}
${orderDetails.productPrice ? `• السعر: ${orderDetails.productPrice} جنيه` : ''}

📋 البيانات المطلوبة: ${missingDataText}

🎯 مهمتك:
1. اشكر العميل بكلمة بسيطة (تمام/حلو/أوكي)
2. اطلب البيانات المفقودة مباشرة وبوضوح

🚫🚫🚫 ممنوع منعاً باتاً (مهم جداً):
❌ "مبسوطين" أو "فرحانين" أو "يا هلا بيك"
❌ "اختيار رائع" أو "أحلى حاجة" أو "ولا في الأحلام"
❌ "في لمح البصر" أو "على طول" أو "مستنينك"
❌ أكثر من emoji واحد
❌ أكثر من 3 جمل

✅ مثال صحيح:
"تمام 👍 محتاجين منك الاسم والعنوان ورقم الموبايل عشان نجهزلك الطلب."

اكتب الرد الآن:`;

      // استدعاء الذكاء الاصطناعي
      const aiResponse = await this.generateAIResponse(
        prompt,
        [], // no conversation memory needed
        false, // no RAG needed
        null, // default gemini config
        companyId, // pass company ID for security
        null, // no conversation ID needed
        { messageType: 'data_request', inquiryType: 'order_completion' }
      );

      if (aiResponse && aiResponse.trim()) {
        //console.log('✅ [AI-DATA-REQUEST] AI generated response successfully');
        return aiResponse;
      } else {
        //console.log('⚠️ [AI-DATA-REQUEST] AI response empty, using fallback');
        // fallback بسيط جداً في حالة فشل الذكاء الاصطناعي
        return `شكراً لتأكيد طلبك! نحتاج منك ${missingData.join(' و ')} لإتمام الطلب.`;
      }

    } catch (error) {
      console.error('❌ [AI-DATA-REQUEST] Error generating AI response:', error);
      // fallback بسيط في حالة الخطأ
      return `شكراً لتأكيد طلبك! نحتاج منك بعض البيانات لإتمام الطلب.`;
    }
  }

  /**
   * فحص إذا كان العميل يرسل بيانات لطلب معلق
   */
  async checkForPendingOrderData(message, conversationMemory, companyId) {
  const lastMessages = conversationMemory.slice(-5);
  const hasDataRequest = lastMessages.some(msg => {
    const response = msg.aiResponse || msg.response || '';
    return response.includes('محتاجين منك') ||
           response.includes('عشان نكمل الطلب') ||
           response.includes('البيانات المفقودة');
  });
  
  if (!hasDataRequest) {
    return { isProvidingData: false };
  }
  
  console.log('🔍 [PENDING-ORDER] Found data request, analyzing message...');
  
  // استخراج بيانات العميل من الرسالة
  const extractedData = await this.extractCustomerDataFromMessage(message);
  
  return {
    isProvidingData: extractedData.hasData,
    extractedData,
    companyId // ✅ Include companyId for later use
  };
}

  /**
   * استخراج بيانات العميل من الرسالة
   */
  async extractCustomerDataFromMessage(message) {
    const data = {
      hasData: false,
      customerName: null,
      customerPhone: null,
      customerAddress: null,
      city: null
    };

    // تحليل الرسالة وتقسيمها إلى أسطر
    const lines = message.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // البحث عن رقم الهاتف (النمط المحدث)
    const phonePatterns = [
      /01[0-9]{9}/,           // النمط الحالي
      /01\d{9}/,              // نمط بديل
      /\b01[0-9]{9}\b/        // نمط مع حدود كلمة
    ];
    
    for (const line of lines) {
      for (const pattern of phonePatterns) {
        const phoneMatch = line.match(pattern);
        if (phoneMatch) {
          data.customerPhone = phoneMatch[0];
          data.hasData = true;
          break;
        }
      }
      if (data.customerPhone) break;
    }

    // البحث عن المحافظة/المدينة
    const cities = ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا', 'الزقازيق', 'أسوان', 'الأقصر', 'اسكندريه'];
    for (const line of lines) {
      const cityMatch = cities.find(city => line.includes(city));
      if (cityMatch) {
        data.city = cityMatch;
        data.hasData = true;
        break;
      }
    }

    // البحث عن العنوان (كلمات مفتاحية موسعة)
    const addressKeywords = ['عمارة', 'شارع', 'الدور', 'شقة', 'منطقة', 'حي', 'برج', 'سموحه', 'نصر', 'الشروق'];
    for (const line of lines) {
      if (addressKeywords.some(keyword => line.includes(keyword))) {
        data.customerAddress = line;
        data.hasData = true;
        break;
      }
    }

    // البحث عن الاسم (السطر الأول عادة ما يكون الاسم إذا لم يحتوِ على أرقام)
    if (lines.length > 0) {
      const firstLine = lines[0];
      // التحقق من أن السطر لا يحتوي على أرقام طويلة (مثل الهاتف) ولا عناوين معروفة
      const hasLongNumbers = /\d{5,}/.test(firstLine);
      const isAddressLine = addressKeywords.some(keyword => firstLine.includes(keyword));
      
      if (!hasLongNumbers && !isAddressLine && firstLine.length > 2 && firstLine.length < 50) {
        // تحقق من أن الرسالة تبدو كاسم (تحتوي على حروف عربية)
        if (/[\u0600-\u06FF]/.test(firstLine) && !/[0-9]{3,}/.test(firstLine)) {
          data.customerName = firstLine.trim();
          data.hasData = true;
        }
      }
    }

    // إذا لم نجد الاسم في السطر الأول، نحاول البحث في الأسطر الأخرى
    if (!data.customerName) {
      for (const line of lines) {
        // تجنب الخطوط التي تحتوي على أرقام طويلة أو كلمات عنوان
        const hasLongNumbers = /\d{5,}/.test(line);
        const isAddressLine = addressKeywords.some(keyword => line.includes(keyword));
        
        if (!hasLongNumbers && !isAddressLine && line.length > 2 && line.length < 50) {
          if (/[\u0600-\u06FF]/.test(line) && !/[0-9]{3,}/.test(line)) {
            data.customerName = line.trim();
            data.hasData = true;
            break;
          }
        }
      }
    }

    //console.log('📋 [DATA-EXTRACT] استخراج البيانات من الرسالة:', {
    //   message,
    //   lines,
    //   extractedData: data
    // });

    return data;
  }

  /**
   * محاولة إنشاء الطلب بالبيانات الجديدة
   */
  async attemptOrderCreationWithNewData(pendingOrderData, messageData, conversationId) {
  try {
    // ✅ EXTRACT companyId early
    const companyId = messageData.companyId || messageData.customerData?.companyId;
    
    if (!companyId) {
      console.error('❌ [SECURITY] No companyId - rejecting order creation');
      return null;
    }
    
    console.log('🏢 [ORDER-CREATION] Creating order for company:', companyId);
    
    // البحث عن تفاصيل الطلب المعلق
    const settings = await this.getSettings(companyId);
    const memoryLimit = settings.maxMessagesPerConversation || 50;
    const conversationMemory = await memoryService.getConversationMemory(
      conversationId, 
      messageData.senderId, 
      memoryLimit, 
      companyId
    );
    
    // ✅ PASS companyId and current message to extractOrderDetailsFromMemory
    const orderDetails = await this.extractOrderDetailsFromMemory(
      conversationMemory,
      companyId, // ✅ CRITICAL
      messageData.content // ✅ PASS current message
    );
    
    // ✅ HANDLE NULL ORDER DETAILS
    if (!orderDetails) {
      console.error('❌ [ORDER-CREATION] Failed to extract order details from memory');
      // Use the extracted customer data directly instead
      const fallbackOrderDetails = {
        productName: 'كوتشي حريمي', // Default product
        productColor: 'أسود', // Default color
        productSize: '37', // Default size
        productPrice: 299, // Default price
        customerName: pendingOrderData.extractedData.customerName || messageData.customerData?.name || 'عميل جديد',
        customerPhone: pendingOrderData.extractedData.customerPhone || messageData.customerData?.phone || '',
        customerAddress: pendingOrderData.extractedData.customerAddress || '',
        city: pendingOrderData.extractedData.city || 'غير محدد',
        quantity: 1,
        confidence: 0.3 // Low confidence for fallback
      };
      
      // Continue with fallback data
      const updatedOrderDetails = {
        ...fallbackOrderDetails,
        customerName: pendingOrderData.extractedData.customerName || fallbackOrderDetails.customerName,
        customerPhone: pendingOrderData.extractedData.customerPhone || fallbackOrderDetails.customerPhone,
        customerAddress: pendingOrderData.extractedData.customerAddress || fallbackOrderDetails.customerAddress,
        city: pendingOrderData.extractedData.city || fallbackOrderDetails.city
      };
      
      // If we have customer data from the message, use it to improve completeness
      if (messageData.content) {
        const messageCustomerData = await this.extractCustomerDataFromMessage(messageData.content);
        if (messageCustomerData.hasData) {
          updatedOrderDetails.customerName = messageCustomerData.customerName || updatedOrderDetails.customerName;
          updatedOrderDetails.customerPhone = messageCustomerData.customerPhone || updatedOrderDetails.customerPhone;
          updatedOrderDetails.customerAddress = messageCustomerData.customerAddress || updatedOrderDetails.customerAddress;
          updatedOrderDetails.city = messageCustomerData.city || updatedOrderDetails.city;
        }
      }
      
      // فحص اكتمال البيانات
      const dataCompleteness = await this.checkDataCompleteness(
        updatedOrderDetails, 
        conversationMemory,
        messageData.content
      );
      
      if (!dataCompleteness.isComplete) {
        const dataRequestResponse = await this.generateDataRequestResponse(
          dataCompleteness.missingData, 
          updatedOrderDetails,
          companyId // Pass companyId for security
        );
        
        return {
          success: true,
          content: dataRequestResponse,
          intent: 'data_collection',
          // ... rest of response
        };
      }
      
      // البيانات مكتملة - إنشاء الأوردر
      console.log('✅ [DATA-COLLECTION] Data complete, creating order with fallback data...');
      
      const EnhancedOrderService = require('./enhancedOrderService');
      const enhancedOrderService = new EnhancedOrderService();
      
      const orderCreated = await enhancedOrderService.createEnhancedOrder({
        conversationId,
        customerId: messageData.customerData?.id,
        companyId: companyId, // ✅ Use validated companyId
        productName: updatedOrderDetails.productName,
        productColor: updatedOrderDetails.productColor,
        productSize: updatedOrderDetails.productSize,
        productPrice: updatedOrderDetails.productPrice,
        quantity: updatedOrderDetails.quantity || 1,
        customerName: updatedOrderDetails.customerName,
        customerPhone: updatedOrderDetails.customerPhone,
        customerEmail: updatedOrderDetails.customerEmail || '',
        customerAddress: updatedOrderDetails.customerAddress,
        city: updatedOrderDetails.city,
        notes: `Order created after data collection - ${new Date().toLocaleString('ar-EG')} (Fallback data used)`,
        confidence: updatedOrderDetails.confidence || 0.3,
        extractionMethod: 'ai_data_collection_fallback'
      });
      
      await enhancedOrderService.disconnect();
      
      if (orderCreated.success) {
        const successMessage = `تم تأكيد طلبك بنجاح! ✅\n\nرقم الطلب: ${orderCreated.order.orderNumber}\nالإجمالي: ${orderCreated.order.total} جنيه\n\nسيتم توصيل طلبك خلال 3-5 أيام. شكراً لك!`;
        
        return {
          success: true,
          content: successMessage,
          intent: 'order_created',
          sentiment: 'positive',
          confidence: 0.95,
          orderCreated: orderCreated
        };
      }
      
      return null;
    }
    
    // دمج البيانات الجديدة
    const updatedOrderDetails = {
      ...orderDetails,
      customerName: pendingOrderData.extractedData.customerName || orderDetails.customerName,
      customerPhone: pendingOrderData.extractedData.customerPhone || orderDetails.customerPhone,
      customerAddress: pendingOrderData.extractedData.customerAddress || orderDetails.customerAddress,
      city: pendingOrderData.extractedData.city || orderDetails.city
    };
    
    // If we have customer data from the message, use it to improve completeness
    if (messageData.content) {
      const messageCustomerData = await this.extractCustomerDataFromMessage(messageData.content);
      if (messageCustomerData.hasData) {
        updatedOrderDetails.customerName = messageCustomerData.customerName || updatedOrderDetails.customerName;
        updatedOrderDetails.customerPhone = messageCustomerData.customerPhone || updatedOrderDetails.customerPhone;
        updatedOrderDetails.customerAddress = messageCustomerData.customerAddress || updatedOrderDetails.customerAddress;
        updatedOrderDetails.city = messageCustomerData.city || updatedOrderDetails.city;
      }
    }
    
    // فحص اكتمال البيانات
    const dataCompleteness = await this.checkDataCompleteness(
      updatedOrderDetails, 
      conversationMemory,
      messageData.content
    );
    
    if (!dataCompleteness.isComplete) {
      const dataRequestResponse = await this.generateDataRequestResponse(
        dataCompleteness.missingData, 
        updatedOrderDetails,
        companyId // Pass companyId for security
      );
      
      return {
        success: true,
        content: dataRequestResponse,
        intent: 'data_collection',
        // ... rest of response
      };
    }
    
    // البيانات مكتملة - إنشاء الأوردر
    console.log('✅ [DATA-COLLECTION] Data complete, creating order...');
    
    const EnhancedOrderService = require('./enhancedOrderService');
    const enhancedOrderService = new EnhancedOrderService();
    
    const orderCreated = await enhancedOrderService.createEnhancedOrder({
      conversationId,
      customerId: messageData.customerData?.id,
      companyId: companyId, // ✅ Use validated companyId
      productName: updatedOrderDetails.productName,
      productColor: updatedOrderDetails.productColor,
      productSize: updatedOrderDetails.productSize,
      productPrice: updatedOrderDetails.productPrice,
      quantity: updatedOrderDetails.quantity || 1,
      customerName: updatedOrderDetails.customerName,
      customerPhone: updatedOrderDetails.customerPhone,
      customerEmail: updatedOrderDetails.customerEmail || '',
      customerAddress: updatedOrderDetails.customerAddress,
      city: updatedOrderDetails.city,
      notes: `Order created after data collection - ${new Date().toLocaleString('ar-EG')}`,
      confidence: 0.9,
      extractionMethod: 'ai_data_collection'
    });
    
    await enhancedOrderService.disconnect();
    
    if (orderCreated.success) {
      const successMessage = `تم تأكيد طلبك بنجاح! ✅\n\nرقم الطلب: ${orderCreated.order.orderNumber}\nالإجمالي: ${orderCreated.order.total} جنيه شامل الشحن\n\nسيتم توصيل طلبك خلال 3-5 أيام. شكراً لك!`;
      
      return {
        success: true,
        content: successMessage,
        intent: 'order_created',
        sentiment: 'positive',
        confidence: 0.95,
        orderCreated: orderCreated
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Error creating order with new data:', error);
    return null;
  }
}

  /**
   * Use AI to detect if customer is confirming an order
   */
  async detectConfirmationWithAI(message, conversationMemory, companyId) {
    try {
      // Get recent conversation context
      const recentMessages = conversationMemory.slice(-5).map(m =>
        `العميل: ${m.userMessage || m.content}\nالرد: ${m.aiResponse || m.response}`
      ).join('\n\n');

      const prompt = `أنت خبير في فهم نوايا العملاء. مهمتك: تحديد هل العميل بيأكد طلب كامل ولا لأ.

المحادثة السابقة:
${recentMessages}

رسالة العميل الآن: "${message}"

🔍 تحليل الرسالة:
1. هل فيها اسم شخص؟ (مثال: أحمد محمد، سلمى عبده)
2. هل فيها رقم موبايل 11 رقم؟ (يبدأ بـ 01)
3. هل فيها عنوان مفصل؟ (شارع، منطقة، مدينة)

✅ أجب بـ "نعم" إذا:
- الرسالة فيها الـ 3 عناصر دول مع بعض (اسم + موبايل + عنوان)
- أو العميل قال صراحة: "أكد الطلب", "اكد الاوردر"

❌ أجب بـ "لا" إذا:
- كلمة واحدة بس: "اسكندريه", "موافق", "تمام"
- سؤال: "كام؟", "متوفر؟"
- بيانات ناقصة: اسم بس، أو رقم بس، أو عنوان بس

مثال "نعم":
"سلمي عبده \nاسكندريه سموحه شارع النصر برج الشروق \n01271459824"
(فيها اسم + عنوان + موبايل = نعم)

مثال "لا":
"اسكندريه" (عنوان بس = لا)
"01271459824" (موبايل بس = لا)

أجب بكلمة واحدة فقط: نعم أو لا`;

      // Get active Gemini configuration for the company
      const geminiConfig = await this.getCurrentActiveModel(companyId);
      //console.log('[CONFIRM-CONFIG]', geminiConfig?.model, 'for company:', companyId);
      if (!geminiConfig) {
        console.error(`❌ No active Gemini key found for confirmation detection for company: ${companyId}`);
        return false;
      }

      // Generate AI response using unified method with switching support (no pattern tracking for confirmation detection)
      const aiResponse = await this.generateAIResponse(prompt, [], false, null, companyId);
      const aiAnswer = aiResponse?.toLowerCase().trim();

      // تحسين تحليل الرد - البحث عن أي إشارة للموافقة
      const isConfirming = aiAnswer === 'نعم' ||
                          aiAnswer.includes('نعم') ||
                          aiAnswer === 'yes' ||
                          aiAnswer.includes('yes') ||
                          aiAnswer === 'موافق' ||
                          aiAnswer.includes('موافق') ||
                          (aiAnswer.includes('تأكيد') || aiAnswer.includes('تاكيد'));

      // إضافة تسجيل مفصل للتشخيص
      console.log(`🔍 [CONFIRMATION-DEBUG] Message: "${message.substring(0, 100)}"`);
      console.log(`🔍 [CONFIRMATION-DEBUG] AI Response: "${aiResponse}"`);
      console.log(`🔍 [CONFIRMATION-DEBUG] AI Decision: ${isConfirming ? '✅ CONFIRMED' : '❌ NOT CONFIRMED'}`);

      // ✅ Fallback: فحص يدوي للتأكد
      if (!isConfirming) {
        const hasPhone = /01[0-9]{9}/.test(message);
        const hasName = message.split(/\s+/).length >= 2 && /[\u0600-\u06FF]{2,}/.test(message);
        const hasAddress = /(شارع|عمارة|برج|منطقة|مدينة|محافظة|اسكندري|قاهر|جيز|سموحه|مصر|النصر|الشروق)/i.test(message);
        const hasSize = /(مقاس|قياس)\s*:?\s*\d+/i.test(message) || /\d{2}/.test(message);
        const hasColor = /(لون|اللون)\s*:?\s*[\u0600-\u06FF]+/i.test(message);
        
        // ✅ حالة 1: رسالة كاملة (اسم + موبايل + عنوان)
        if (hasPhone && hasName && hasAddress) {
          console.log('✅ [FALLBACK-CHECK] الرسالة فيها كل البيانات - تأكيد يدوي!');
          return true;
        }
        
        // ✅ حالة 2: رسالة منظمة فيها بيانات طلب (اسم + عنوان + مقاس/لون)
        if (hasName && hasAddress && (hasSize || hasColor)) {
          console.log('✅ [FALLBACK-CHECK] رسالة منظمة فيها بيانات طلب - تأكيد!');
          console.log(`   - اسم: ${hasName}, عنوان: ${hasAddress}, مقاس: ${hasSize}, لون: ${hasColor}`);
          return true;
        }
        
        // ✅ حالة 3: رسالة فيها حقول واضحة (الاسم:، العنوان:، المقاس:)
        const hasStructuredFields = /(الاسم|لاسم)\s*:/i.test(message) && 
                                    /(العنوان|لعنوان)\s*:/i.test(message);
        if (hasStructuredFields) {
          console.log('✅ [FALLBACK-CHECK] رسالة منظمة بحقول واضحة - تأكيد!');
          return true;
        }
      }

      return isConfirming;

    } catch (error) {
      console.error('❌ Error in AI confirmation detection:', error);
      return false;
    }
  }

  /**
   * Extract order details from conversation memory using AI
   */
async extractOrderDetailsFromMemory(conversationMemory, companyId, currentMessage) {
  try {
    console.log('🔍 [ORDER-EXTRACTION] بدء استخراج تفاصيل الطلب من المحادثة...');
    console.log('🏢 [ORDER-EXTRACTION] Company ID:', companyId);
    console.log('📝 [ORDER-EXTRACTION] Current Message:', currentMessage?.substring(0, 200) || 'N/A');
    
    // ✅ SECURITY CHECK
    if (!companyId) {
      console.error('❌ [SECURITY] extractOrderDetailsFromMemory requires companyId');
      return null;
    }
    
    // بناء سياق المحادثة
    let conversationText = this.buildConversationContext(conversationMemory);
    
    // ✅ CRITICAL FIX: إضافة الرسالة الحالية للسياق إذا كانت موجودة
    if (currentMessage && currentMessage.trim().length > 0) {
      console.log('✅ [ORDER-EXTRACTION] إضافة الرسالة الحالية للسياق');
      conversationText += `\n\n[رسالة جديدة] العميل: ${currentMessage}`;
    }
    
    console.log('📝 [ORDER-EXTRACTION] Final conversation text length:', conversationText.length);
    
    // ✅ PASS companyId to extractDetailsWithAI
    const extractedDetails = await this.extractDetailsWithAI(conversationText, companyId);
    
    // تنظيف وتحسين البيانات المستخرجة
    const cleanedDetails = this.cleanAndValidateOrderDetails(extractedDetails);
    
    console.log('✅ [ORDER-EXTRACTION] تم استخراج التفاصيل:', cleanedDetails);
    return cleanedDetails;
    
  } catch (error) {
    console.error('❌ [ORDER-EXTRACTION] خطأ في استخراج التفاصيل:', error);
    return null;
  }
}

  /**
   * Build conversation context for AI analysis
   */
  buildConversationContext(conversationMemory) {
    console.log('📝 [CONTEXT-BUILD] Building conversation context...');
    console.log('📝 [CONTEXT-BUILD] Total messages:', conversationMemory?.length || 0);
    
    if (!conversationMemory || conversationMemory.length === 0) {
      console.warn('⚠️ [CONTEXT-BUILD] No conversation memory provided!');
      return '';
    }
    
    const recentMessages = conversationMemory.slice(-15); // آخر 15 رسالة
    console.log('📝 [CONTEXT-BUILD] Using last', recentMessages.length, 'messages');
    
    // ✅ Debug: فحص محتوى الرسائل
    console.log('🔍 [CONTEXT-DEBUG] Sample messages:');
    recentMessages.slice(0, 3).forEach((msg, i) => {
      // ✅ التحقق من format الرسالة
      if (msg.content) {
        console.log(`  [${i}] NEW FORMAT - content: "${msg.content?.substring(0, 50) || 'N/A'}", isFromCustomer: ${msg.isFromCustomer}`);
      } else if (msg.userMessage || msg.aiResponse) {
        console.log(`  [${i}] OLD FORMAT - userMessage: "${msg.userMessage?.substring(0, 50) || 'N/A'}", aiResponse: "${msg.aiResponse?.substring(0, 50) || 'N/A'}"`);
      }
    });

    const contextText = recentMessages.map((interaction, index) => {
      const timestamp = interaction.timestamp || interaction.createdAt;
      const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString('ar-EG') : '';

      // ✅ دعم كلا الـ formats: القديم (userMessage/aiResponse) والجديد (content/isFromCustomer)
      if (interaction.content) {
        // NEW FORMAT من memoryService
        const role = interaction.isFromCustomer ? 'العميل' : 'النظام';
        return `[${index + 1}] ${timeStr} ${role}: ${interaction.content}`;
      } else {
        // OLD FORMAT (للتوافق)
        const userMsg = interaction.userMessage || '';
        const aiMsg = interaction.aiResponse || '';

        let text = '';
        if (userMsg) {
          text += `[${index + 1}] ${timeStr} العميل: ${userMsg}`;
        }
        if (aiMsg) {
          if (text) text += '\n';
          text += `[${index + 1}] ${timeStr} النظام: ${aiMsg}`;
        }
        return text;
      }
    }).filter(t => t).join('\n\n');
    
    console.log('📝 [CONTEXT-BUILD] Context text length:', contextText.length);
    console.log('📝 [CONTEXT-BUILD] Context preview:', contextText.substring(0, 500));
    
    return contextText;
  }

  /**
   * Extract details using AI
   */
  async extractDetailsWithAI(conversationText, companyId) {
  console.log('🔍 [ORDER-EXTRACTION] نص المحادثة المرسل للذكاء الاصطناعي:');
  console.log('📝 [ORDER-EXTRACTION] Conversation Text Length:', conversationText?.length || 0);
  console.log('📝 [ORDER-EXTRACTION] Conversation Text Preview:', conversationText?.substring(0, 500) || 'EMPTY');
  console.log('🏢 [ORDER-EXTRACTION] Company ID:', companyId);
  
  // ✅ SECURITY CHECK
  if (!companyId) {
    console.error('❌ [SECURITY] extractDetailsWithAI requires companyId');
    throw new Error('Company ID is required for AI order extraction');
  }
  
  // ✅ CHECK if conversation text is empty
  if (!conversationText || conversationText.trim().length === 0) {
    console.error('❌ [ORDER-EXTRACTION] Conversation text is empty!');
    return null;
  }
  
  // ✅ جلب المنتجات من قاعدة البيانات للشركة
  let productsInfo = '';
  let defaultProduct = null;
  try {
    const products = await this.getSharedPrismaClient().product.findMany({
      where: { companyId: companyId },
      select: {
        name: true,
        price: true,
        description: true,
        category: true,
        stock: true
      },
      take: 50 // آخر 50 منتج
    });
    
    if (products && products.length > 0) {
      console.log(`✅ [ORDER-EXTRACTION] وجدت ${products.length} منتج للشركة`);
      
      // ✅ لو في منتج واحد بس، استخدمه كـ default
      if (products.length === 1) {
        defaultProduct = products[0];
        console.log(`💡 [ORDER-EXTRACTION] منتج واحد فقط - سيتم استخدامه كافتراضي: ${defaultProduct.name}`);
      }
      
      productsInfo = '\n\n🛍️ المنتجات المتاحة في الشركة:\n';
      productsInfo += '=====================================\n';
      products.forEach((product, index) => {
        productsInfo += `${index + 1}. ${product.name}`;
        if (product.price) productsInfo += ` - السعر: ${product.price} جنيه`;
        if (product.description) productsInfo += ` - ${product.description}`;
        if (product.category) productsInfo += ` - الفئة: ${product.category}`;
        productsInfo += '\n';
      });
      productsInfo += '=====================================\n';
      
      // ✅ إضافة ملاحظة إذا كان في منتج واحد فقط
      if (products.length === 1) {
        productsInfo += `\n⚠️ ملاحظة مهمة: يوجد منتج واحد فقط متاح (${defaultProduct.name} - السعر: ${defaultProduct.price} جنيه).\n`;
        productsInfo += `إذا لم يُذكر اسم المنتج صراحة في المحادثة، استخدم هذا المنتج كافتراضي واستخدم السعر المذكور.\n\n`;
      } else {
        productsInfo += `\n⚠️ ملاحظة: يجب تحديد المنتج من القائمة أعلاه فقط. لا تستخدم أسماء منتجات غير موجودة.\n\n`;
      }
    } else {
      console.log('⚠️ [ORDER-EXTRACTION] لا توجد منتجات للشركة');
    }
  } catch (error) {
    console.error('❌ [ORDER-EXTRACTION] خطأ في جلب المنتجات:', error);
  }
  
  const prompt = `أنت خبير في تحليل المحادثات التجارية واستخراج تفاصيل الطلبات. حلل المحادثة التالية بعناية فائقة واستخرج جميع البيانات الموجودة:
${productsInfo}

=== المحادثة ===
${conversationText}
=== نهاية المحادثة ===

🎯 مهمتك: استخراج تفاصيل الطلب من هذه المحادثة بدقة عالية. اقرأ كل رسالة بعناية واستخرج أي معلومة موجودة.

📋 ابحث عن المعلومات التالية في أي مكان في المحادثة:
1. 🛍️ اسم المنتج: (يجب أن يكون من قائمة المنتجات المتاحة أعلاه فقط - لا تخترع اسم منتج!)
2. 🎨 لون المنتج: (أسود، أبيض، بني، كحلي، أحمر، أزرق، إلخ - استخرجه من المحادثة فقط)
3. 📏 مقاس المنتج: (أي رقم يمثل مقاس مثل 37، 38، 39، 40، 41، 42، إلخ - استخرجه من المحادثة فقط)
4. 💰 سعر المنتج: (يجب أن يكون السعر من قائمة المنتجات أعلاه - استخدم السعر المذكور في القائمة للمنتج المحدد)
5. 👤 اسم العميل الكامل: (ابحث عن أي اسم شخص مذكور في المحادثة - قد يكون بعد "الاسم الكامل:" أو "لاسم الكامل:" أو في أي مكان)
6. 📱 رقم الهاتف: (11 رقم يبدأ بـ 01 مثل 01234567890 - قد يكون بعد "رقم الموبايل:" أو "الموبايل:" أو في أي مكان)
7. 🏠 العنوان الكامل: (أي عنوان أو منطقة أو شارع مذكور - قد يكون بعد "العنوان:" أو في أي مكان)
8. 🏙️ المدينة/المحافظة: (القاهرة، الإسكندرية، الجيزة، اسكندريه، سموحه، إلخ)
9. 📝 ملاحظات إضافية: (أي معلومات أخرى مهمة)

🔍 تعليمات مهمة جداً:
- 🔥 اقرأ المحادثة كاملة من أول رسالة لآخر رسالة - البيانات متوزعة على كل المحادثة
- 🔥 المنتج واللون والمقاس ممكن يكونوا في رسائل سابقة - مش بس في الرسالة الأخيرة!
- 🔥 اجمع البيانات من كل الرسائل - كل رسالة ممكن تحتوي على جزء من البيانات
- استخرج أي معلومة موجودة في أي مكان في المحادثة حتى لو كانت غير مكتملة
- ابحث عن الأنماط مثل "الاسم :" أو "لاسم :" أو "الاسم الكامل :" متبوعة بالاسم
- ابحث عن "رقم الموبايل:" أو "الموبايل:" متبوعة برقم الهاتف
- ابحث عن "العنوان :" أو "لعنوان :" متبوعة بالعنوان
- ابحث عن "المدينة:" أو "المحافظة:" أو أي مدينة مصرية مذكورة
- ابحث عن "المقاس :" أو "لمقاس :" أو أي رقم منفرد قد يكون مقاس (37-46)
- ابحث عن "اللون :" أو "لون :" أو "اللون الابيض" أو "لون ابيض" لاستخراج اللون
- ابحث عن أسماء المنتجات في أي مكان في المحادثة (مثل: كوتشي، شانكي، حذاء، إلخ)
- 🚨 مهم جداً: اسم المنتج يجب أن يكون من قائمة المنتجات المتاحة فقط - لا تخترع اسم!
- 🚨 مهم جداً: السعر يجب أن يكون من قائمة المنتجات - استخدم السعر المذكور للمنتج المحدد
- ركز على آخر معلومة مذكورة إذا تكررت نفس المعلومة
- إذا لم تجد معلومة محددة في المحادثة، ضع null - لا تخترع معلومات!
- انتبه للأخطاء الإملائية الشائعة مثل "لاسم" بدلاً من "الاسم"
- إذا كان اللون مكتوب بدون ":" مثل "اللون الابيض" أو "لون ابيض"، استخرج "أبيض"
- رقم المقاس ممكن يكون لوحده بدون كلمة "مقاس" - أي رقم بين 37-46 يمكن أن يكون مقاس

📤 أجب بصيغة JSON صحيحة فقط (بدون أي نص إضافي قبل أو بعد):
{
  "productName": "اسم المنتج الكامل أو null",
  "productColor": "اللون أو null",
  "productSize": "المقاس أو null",
  "productPrice": رقم السعر أو null,
  "customerName": "الاسم الكامل للعميل أو null",
  "customerPhone": "رقم الهاتف أو null",
  "customerAddress": "العنوان الكامل أو null",
  "city": "المدينة أو null",
  "notes": "أي ملاحظات مهمة أو null",
  "confidence": رقم من 0 إلى 1 يمثل مدى ثقتك في البيانات المستخرجة
}

⚠️ مهم جداً:
- إذا لم تجد معلومة معينة في المحادثة، ضع null
- لا تخترع معلومات غير موجودة - خصوصاً اسم المنتج والسعر!
- اسم المنتج يجب أن يكون بالضبط كما في قائمة المنتجات أعلاه
- السعر يجب أن يكون بالضبط كما في قائمة المنتجات أعلاه
- تأكد من صحة JSON قبل الإرسال
- يجب أن يكون الرد JSON فقط بدون أي نص آخر

📝 مثال توضيحي:
إذا كانت المحادثة:
[1] العميل: "عايز أطلب"
[2] النظام: "تمام! عايزة إيه بالظبط؟"
[3] العميل: "كوتشي شانكي"
[4] النظام: "ممتاز! أي لون؟"
[5] العميل: "لون ابيض"
[6] النظام: "تمام! والمقاس؟"
[7] العميل: "41"
[8] النظام: "محتاج الاسم والعنوان"
[9] العميل: "سلمي عبده اسكندريه سموحه شارع النصر برج الشروق 01271459824"

يجب أن يكون الرد:
{
  "productName": "كوتشي شانكي",
  "productColor": "أبيض",
  "productSize": "41",
  "productPrice": 420,
  "customerName": "سلمي عبده",
  "customerPhone": "01271459824",
  "customerAddress": "اسكندريه سموحه شارع النصر برج الشروق",
  "city": "الإسكندرية",
  "notes": null,
  "confidence": 0.95
}`;

  try {
    // ✅ PASS companyId to generateAIResponse
    const aiResponse = await this.generateAIResponse(
      prompt, 
      [],      // conversationMemory
      false,   // useRAG
      null,    // providedGeminiConfig
      companyId // ✅ CRITICAL: Pass companyId for security
    );
    
    console.log('🤖 [ORDER-EXTRACTION] رد الذكاء الاصطناعي الخام:', aiResponse);
    
    // تحسين استخراج JSON
    const firstBrace = aiResponse.indexOf('{');
    const lastBrace = aiResponse.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonString = aiResponse.substring(firstBrace, lastBrace + 1);
      
      try {
        const extractedData = JSON.parse(jsonString);
        console.log('✅ [ORDER-EXTRACTION] البيانات المستخرجة بنجاح:', extractedData);
        
        // ✅ التحقق من وجود البيانات الأساسية (الاسم فقط مطلوب - الموبايل ممكن يتجمع لاحقاً)
        if (!extractedData.customerName) {
          console.warn('⚠️ [ORDER-EXTRACTION] اسم العميل مفقود');
          return null;
        }
        
        // ✅ تحذير إذا كان الموبايل مفقود (لكن لا نرفض البيانات)
        if (!extractedData.customerPhone) {
          console.warn('⚠️ [ORDER-EXTRACTION] رقم الموبايل مفقود - سيتم جمعه من المحادثة');
        }
        
        return extractedData;
      } catch (parseError) {
        console.error('❌ [ORDER-EXTRACTION] خطأ في تحليل JSON:', parseError.message);
        return null;
      }
    } else {
      console.warn('⚠️ [ORDER-EXTRACTION] لم يتم العثور على JSON صحيح');
      return null;
    }
  } catch (error) {
    console.error('❌ [ORDER-EXTRACTION] خطأ في استخراج التفاصيل بالذكاء الاصطناعي:', error);
    return null;
  }
}

  /**
   * Clean and validate extracted order details
   */
  cleanAndValidateOrderDetails(extractedDetails) {
    // ✅ HANDLE NULL INPUT
    if (!extractedDetails) {
      console.warn('⚠️ [ORDER-CLEANING] Received null extractedDetails, using default values');
      extractedDetails = this.getDefaultOrderDetails();
    }
    
    //console.log('🧹 [ORDER-CLEANING] البيانات الخام قبل التنظيف:', extractedDetails);

    const cleaned = {
      productName: this.cleanProductName(extractedDetails.productName),
      productColor: this.cleanProductColor(extractedDetails.productColor),
      productSize: this.cleanProductSize(extractedDetails.productSize),
      productPrice: this.cleanProductPrice(extractedDetails.productPrice),
      customerName: this.cleanCustomerName(extractedDetails.customerName),
      customerPhone: this.cleanPhoneNumber(extractedDetails.customerPhone),
      customerAddress: this.cleanAddress(extractedDetails.customerAddress),
      city: this.cleanCity(extractedDetails.city),
      quantity: 1,
      notes: extractedDetails.notes || '',
      confidence: extractedDetails.confidence || 0.5
    };

    //console.log('✨ [ORDER-CLEANING] البيانات بعد التنظيف:', cleaned);

    // تشغيل الـ validation المتقدم
    const validation = this.validateOrderDetails(cleaned);

    // إضافة نتائج الـ validation للبيانات
    cleaned.validation = validation;

    // تعديل مستوى الثقة بناءً على الـ validation
    if (!validation.isValid) {
      cleaned.confidence = Math.min(cleaned.confidence, 0.4);
    } else if (validation.warnings.length > 2) {
      cleaned.confidence = Math.min(cleaned.confidence, 0.6);
    } else if (validation.warnings.length > 0) {
      cleaned.confidence = Math.min(cleaned.confidence, 0.8);
    }

    // إضافة ملاحظات الـ validation
    if (validation.errors.length > 0) {
      cleaned.notes += `\n⚠️ أخطاء: ${validation.errors.join(', ')}`;
    }
    if (validation.warnings.length > 0) {
      cleaned.notes += `\n⚡ تحذيرات: ${validation.warnings.join(', ')}`;
    }
    if (validation.suggestions.length > 0) {
      cleaned.notes += `\n💡 اقتراحات: ${validation.suggestions.join(', ')}`;
    }

    //console.log('🧹 [ORDER-CLEANING] تنظيف البيانات:', {
    //   original: extractedDetails,
    //   cleaned: cleaned,
    //   validation: validation
    // });

    return cleaned;
  }

  /**
   * Clean product name with enhanced intelligence
   */
  cleanProductName(name) {
    if (!name || typeof name !== 'string') return null;  // ✅ لا تفترض اسم منتج!

    // ✅ تنظيف بسيط فقط - الـ AI بيستخرج من قائمة المنتجات الموجودة
    let cleaned = name.trim()
      .replace(/[()[\]{}]/g, '') // إزالة الأقواس
      .replace(/\s+/g, ' '); // توحيد المسافات

    // ✅ نرجع الاسم كما هو - الـ AI استخرجه من قائمة المنتجات
    return cleaned || null;
  }

  /**
   * Clean product color with enhanced mapping
   */
  cleanProductColor(color) {
    //console.log('🎨 [COLOR-CLEANING] اللون الخام:', color);

    if (!color || typeof color !== 'string') {
      //console.log('🎨 [COLOR-CLEANING] لا يوجد لون');
      return null;  // ✅ لا تفترض لون
    }

    // تنظيف اللون وتوحيد الأسماء
    const colorMap = {
      // الألوان الأساسية
      'اسود': 'أسود',
      'ابيض': 'أبيض',
      'احمر': 'أحمر',
      'ازرق': 'أزرق',
      'اخضر': 'أخضر',
      'اصفر': 'أصفر',
      'بنفسجي': 'بنفسجي',
      'وردي': 'وردي',
      'برتقالي': 'برتقالي',

      // درجات الألوان
      'بني': 'بني',
      'بيج': 'بيج',
      'رمادي': 'رمادي',
      'كحلي': 'كحلي',
      'نيفي': 'كحلي',
      'navy': 'كحلي',

      // الألوان بالإنجليزية
      'black': 'أسود',
      'white': 'أبيض',
      'red': 'أحمر',
      'blue': 'أزرق',
      'green': 'أخضر',
      'yellow': 'أصفر',
      'brown': 'بني',
      'beige': 'بيج',
      'gray': 'رمادي',
      'grey': 'رمادي',
      'pink': 'وردي',
      'purple': 'بنفسجي',
      'orange': 'برتقالي',

      // أخطاء إملائية شائعة
      'اسوود': 'أسود',
      'ابييض': 'أبيض',
      'احمرر': 'أحمر',
      'ازررق': 'أزرق'
    };

    let cleaned = color.trim()
      .replace(/[()[\]{}]/g, '')
      .replace(/^(ال|لون)\s*/i, '')
      .toLowerCase();

    const finalColor = colorMap[cleaned] || color.trim() || null;  // ✅ لا تفترض لون!
    //console.log('🎨 [COLOR-CLEANING] اللون النهائي:', finalColor);
    return finalColor;
  }

  /**
   * Clean product size with enhanced validation
   */
  cleanProductSize(size) {
    //console.log('👟 [SIZE-CLEANING] المقاس الخام:', size);

    if (!size) {
      //console.log('👟 [SIZE-CLEANING] لا يوجد مقاس');
      return null;  // ✅ لا تفترض مقاس
    }

    // استخراج الرقم فقط
    const sizeMatch = String(size).match(/(\d+(?:\.\d+)?)/);
    const numericSize = sizeMatch ? parseFloat(sizeMatch[1]) : null;
    //console.log('👟 [SIZE-CLEANING] المقاس الرقمي المستخرج:', numericSize);

    // التحقق من صحة المقاس حسب النوع
    if (numericSize) {
      // مقاسات الأحذية النسائية (35-42)
      if (numericSize >= 35 && numericSize <= 42) {
        const finalSize = String(Math.round(numericSize));
        //console.log('👟 [SIZE-CLEANING] مقاس نسائي صحيح:', finalSize);
        return finalSize;
      }

      // مقاسات الأحذية الرجالية (39-46)
      if (numericSize >= 39 && numericSize <= 46) {
        const finalSize = String(Math.round(numericSize));
        //console.log('👟 [SIZE-CLEANING] مقاس رجالي صحيح:', finalSize);
        return finalSize;
      }

      // مقاسات الأطفال (25-35)
      if (numericSize >= 25 && numericSize <= 35) {
        const finalSize = String(Math.round(numericSize));
        //console.log('👟 [SIZE-CLEANING] مقاس أطفال صحيح:', finalSize);
        return finalSize;
      }

      // تحويل المقاسات الأوروبية إلى مصرية (تقريبي)
      if (numericSize >= 6 && numericSize <= 12) {
        const convertedSize = Math.round(numericSize + 30);
        if (convertedSize >= 35 && convertedSize <= 42) {
          //console.log('👟 [SIZE-CLEANING] تحويل من أوروبي:', numericSize, '->', convertedSize);
          return String(convertedSize);
        }
      }

      //console.log('👟 [SIZE-CLEANING] مقاس رقمي غير صحيح:', numericSize);
    }

    // مقاسات نصية شائعة
    const sizeMap = {
      'صغير': '37',
      'متوسط': '38',
      'كبير': '40',
      'small': '37',
      'medium': '38',
      'large': '40',
      'xl': '41',
      'xxl': '42'
    };

    const textSize = String(size).toLowerCase().trim();
    if (sizeMap[textSize]) {
      //console.log('👟 [SIZE-CLEANING] تم العثور على مقاس نصي:', textSize, '->', sizeMap[textSize]);
      return sizeMap[textSize];
    }

    //console.log('👟 [SIZE-CLEANING] لم يتم العثور على مقاس صحيح');
    return null;  // ✅ لا تفترض مقاس
  }

  /**
   * Clean product price with enhanced validation
   */
  cleanProductPrice(price) {
    if (!price) return null;  // ✅ لا تفترض سعر

    // استخراج الرقم من النص
    let numericPrice;
    if (typeof price === 'number') {
      numericPrice = price;
    } else {
      // البحث عن أرقام في النص
      const priceMatch = String(price).match(/(\d+(?:\.\d+)?)/);
      numericPrice = priceMatch ? parseFloat(priceMatch[1]) : null;
    }

    if (numericPrice) {
      // التحقق من منطقية السعر حسب فئات المنتجات

      // أحذية عادية (100-500 جنيه)
      if (numericPrice >= 100 && numericPrice <= 500) {
        return Math.round(numericPrice);
      }

      // أحذية متوسطة (500-1000 جنيه)
      if (numericPrice >= 500 && numericPrice <= 1000) {
        return Math.round(numericPrice);
      }

      // أحذية فاخرة (1000-3000 جنيه)
      if (numericPrice >= 1000 && numericPrice <= 3000) {
        return Math.round(numericPrice);
      }

      // أسعار منخفضة جداً (قد تكون خطأ)
      if (numericPrice >= 50 && numericPrice < 100) {
        return Math.round(numericPrice);
      }

      // تحويل الأسعار بالدولار إلى جنيه (تقريبي)
      if (numericPrice >= 5 && numericPrice <= 100) {
        const convertedPrice = Math.round(numericPrice * 30); // سعر صرف تقريبي
        if (convertedPrice >= 150 && convertedPrice <= 3000) {
          return convertedPrice;
        }
      }
    }

    // ✅ لا تفترض سعر - يجب أن يأتي من قاعدة البيانات
    return null;
  }

  /**
   * Transliterate English name to Arabic
   */
  transliterateToArabic(name) {
    if (!name || typeof name !== 'string') return name;

    // خريطة تحويل الحروف الإنجليزية للعربية
    const transliterationMap = {
      'a': 'ا', 'A': 'ا',
      'b': 'ب', 'B': 'ب',
      'd': 'د', 'D': 'د',
      'e': 'ي', 'E': 'ي',
      'f': 'ف', 'F': 'ف',
      'g': 'ج', 'G': 'ج',
      'h': 'ه', 'H': 'ه',
      'i': 'ي', 'I': 'ي',
      'j': 'ج', 'J': 'ج',
      'k': 'ك', 'K': 'ك',
      'l': 'ل', 'L': 'ل',
      'm': 'م', 'M': 'م',
      'n': 'ن', 'N': 'ن',
      'o': 'و', 'O': 'و',
      'r': 'ر', 'R': 'ر',
      's': 'س', 'S': 'س',
      't': 'ت', 'T': 'ت',
      'u': 'و', 'U': 'و',
      'v': 'ف', 'V': 'ف',
      'w': 'و', 'W': 'و',
      'y': 'ي', 'Y': 'ي',
      'z': 'ز', 'Z': 'ز',
      // أسماء شائعة
      'ahmed': 'أحمد', 'Ahmed': 'أحمد', 'AHMED': 'أحمد',
      'mohamed': 'محمد', 'Mohammed': 'محمد', 'Muhammad': 'محمد',
      'ali': 'علي', 'Ali': 'علي',
      'omar': 'عمر', 'Omar': 'عمر',
      'sara': 'سارة', 'Sarah': 'سارة',
      'fatma': 'فاطمة', 'Fatima': 'فاطمة',
      'mona': 'منى', 'Mona': 'منى',
      'nour': 'نور', 'Noor': 'نور',
      'hassan': 'حسن', 'Hassan': 'حسن',
      'hussein': 'حسين', 'Hussein': 'حسين',
      'mahmoud': 'محمود', 'Mahmoud': 'محمود',
      'khaled': 'خالد', 'Khaled': 'خالد',
      'youssef': 'يوسف', 'Yousef': 'يوسف', 'Joseph': 'يوسف'
    };

    // التحقق إذا كان الاسم إنجليزي
    const isEnglish = /^[a-zA-Z\s]+$/.test(name);
    
    if (!isEnglish) {
      return name; // إذا كان عربي بالفعل، أرجعه كما هو
    }

    // محاولة تحويل الاسم الكامل أولاً
    const lowerName = name.toLowerCase().trim();
    if (transliterationMap[lowerName]) {
      return transliterationMap[lowerName];
    }

    // تحويل كل كلمة على حدة
    const words = name.split(' ');
    const transliteratedWords = words.map(word => {
      const lowerWord = word.toLowerCase();
      if (transliterationMap[lowerWord]) {
        return transliterationMap[lowerWord];
      }
      
      // تحويل حرف بحرف
      return word.split('').map(char => transliterationMap[char] || char).join('');
    });

    return transliteratedWords.join(' ');
  }

  /**
   * Clean customer name
   */
  cleanCustomerName(name) {
    if (!name || typeof name !== 'string') return null;

    // تنظيف الاسم
    let cleaned = name.trim()
      .replace(/[()[\]{}]/g, '')
      .replace(/\d+/g, '') // إزالة الأرقام
      .replace(/\s+/g, ' ')
      .trim();

    // التحقق من أن الاسم ليس Facebook ID
    if (cleaned.length < 3 || /^\d+$/.test(cleaned)) {
      return null;
    }

    // تحويل الاسم للعربية إذا كان إنجليزي
    cleaned = this.transliterateToArabic(cleaned);

    return cleaned;
  }

  /**
   * Clean phone number
   */
  cleanPhoneNumber(phone) {
    if (!phone) return '';

    // استخراج الأرقام فقط
    const digits = String(phone).replace(/[^\d]/g, '');

    // التحقق من صحة رقم الهاتف المصري
    if (digits.length === 11 && digits.startsWith('01')) {
      return digits;
    }

    if (digits.length === 10 && digits.startsWith('1')) {
      return '0' + digits;
    }

    return '';
  }

  /**
   * Clean address
   */
  cleanAddress(address) {
    if (!address || typeof address !== 'string') return '';

    return address.trim()
      .replace(/[()[\]{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clean city name
   */
  cleanCity(city) {
    if (!city || typeof city !== 'string') return null;  // ✅ لا تفترض مدينة!

    // قائمة المدن المصرية الشائعة
    const egyptianCities = {
      'القاهره': 'القاهرة',
      'الاسكندريه': 'الإسكندرية',
      'الاسكندرية': 'الإسكندرية',
      'اسكندريه': 'الإسكندرية',
      'الجيزه': 'الجيزة',
      'شبرا': 'شبرا الخيمة',
      'المنصوره': 'المنصورة',
      'المنصورة': 'المنصورة',
      'طنطا': 'طنطا',
      'الزقازيق': 'الزقازيق',
      'اسيوط': 'أسيوط',
      'سوهاج': 'سوهاج',
      'قنا': 'قنا',
      'الاقصر': 'الأقصر',
      'اسوان': 'أسوان',
      'بورسعيد': 'بورسعيد',
      'السويس': 'السويس',
      'الاسماعيليه': 'الإسماعيلية',
      'دمياط': 'دمياط',
      'كفر الشيخ': 'كفر الشيخ',
      'البحيره': 'البحيرة',
      'الغربيه': 'الغربية',
      'المنوفيه': 'المنوفية',
      'القليوبيه': 'القليوبية',
      'الشرقيه': 'الشرقية',
      'الدقهليه': 'الدقهلية',
      'سموحه': 'الإسكندرية',
      'سموحة': 'الإسكندرية'
    };

    let cleaned = city.trim()
      .replace(/[()[\]{}]/g, '')
      .replace(/^(محافظة|مدينة)\s*/i, '');

    return egyptianCities[cleaned] || cleaned || null;  // ✅ لا تفترض مدينة!
  }

  /**
   * Advanced validation for extracted order details
   */
  validateOrderDetails(details) {
    const validationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // ✅ التحقق من اسم المنتج - الآن التحقق من null
    if (!details.productName) {
      validationResults.errors.push('اسم المنتج مفقود');
      validationResults.isValid = false;
    }

    // ✅ التحقق من اللون
    if (!details.productColor) {
      validationResults.errors.push('اللون مفقود');
      validationResults.isValid = false;
    }

    // ✅ التحقق من المقاس
    if (!details.productSize) {
      validationResults.errors.push('المقاس مفقود');
      validationResults.isValid = false;
    } else {
      const sizeNum = parseInt(details.productSize);
      if (isNaN(sizeNum) || sizeNum < 25 || sizeNum > 46) {
        validationResults.errors.push(`مقاس غير صحيح: ${details.productSize}`);
        validationResults.isValid = false;
      }
    }

    // ✅ التحقق من السعر
    if (!details.productPrice) {
      validationResults.errors.push('السعر مفقود');
      validationResults.isValid = false;
    } else if (details.productPrice < 50 || details.productPrice > 5000) {
      validationResults.warnings.push(`سعر غير عادي: ${details.productPrice} جنيه`);
    }

    // ✅ التحقق من رقم الهاتف
    if (!details.customerPhone) {
      validationResults.errors.push('رقم الهاتف مفقود');
      validationResults.isValid = false;
    } else if (!/^01[0-9]{9}$/.test(details.customerPhone)) {
      validationResults.errors.push(`رقم هاتف غير صحيح: ${details.customerPhone}`);
      validationResults.isValid = false;
    }

    // ✅ التحقق من اسم العميل
    if (!details.customerName || /^\d+/.test(details.customerName)) {
      validationResults.errors.push('اسم العميل غير واضح أو مفقود');
      validationResults.isValid = false;
    }

    // ✅ التحقق من العنوان
    if (!details.customerAddress || details.customerAddress.trim() === '') {
      validationResults.errors.push('العنوان مفقود');
      validationResults.isValid = false;
    }

    // ✅ التحقق من المدينة
    if (!details.city || details.city === 'غير محدد') {
      validationResults.errors.push('المدينة/المحافظة مفقودة');
      validationResults.isValid = false;
    }

    // اقتراحات للتحسين
    if (details.confidence < 0.7) {
      validationResults.suggestions.push('مستوى الثقة منخفض - قد تحتاج مراجعة يدوية');
    }

    return validationResults;
  }

  /**
   * Get default order details - NO ASSUMPTIONS!
   */
  getDefaultOrderDetails() {
    return {
      productName: null,  // ✅ لا تفترض منتج
      productColor: null,
      productSize: null,
      productPrice: null,
      customerName: null,
      customerPhone: '',
      customerAddress: '',
      city: null,  // ✅ لا تفترض مدينة
      quantity: 1,
      notes: 'لم يتم العثور على بيانات كافية',
      confidence: 0.1  // ثقة منخفضة جداً
    };
  }

  /**
   * Get time ago in Arabic
   */
  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `${diffMins} دقيقة`;
    if (diffHours < 24) return `${diffHours} ساعة`;
    if (diffDays < 7) return `${diffDays} يوم`;
    return `${Math.floor(diffDays / 7)} أسبوع`;
  }

  /**
   * 🧠 استخدام الذكاء الاصطناعي المتقدم لتحديد طلب الصور
   */
  async isCustomerRequestingImages(message, conversationMemory , companyId ) {
    try {
      //console.log(`\n🧠 [AI-IMAGE-DETECTION] ===== بدء تحليل طلب الصور =====`);
      //console.log(`📝 [AI-IMAGE-DETECTION] الرسالة الكاملة: "${message}"`);
      //console.log(`🏢 [AI-IMAGE-DETECTION] معرف الشركة: ${companyId}`);
      //console.log(`💭 [AI-IMAGE-DETECTION] ذاكرة المحادثة: ${conversationMemory.length} رسالة`);

      // بناء السياق من المحادثة السابقة
      let conversationContext = '';
      if (conversationMemory.length > 0) {
        const recentMessages = conversationMemory.slice(-3);
        conversationContext = recentMessages.map(memory =>
          `العميل: ${memory.userMessage}\nالرد: ${memory.aiResponse}`
        ).join('\n---\n');
        //console.log(`📚 [AI-IMAGE-DETECTION] سياق المحادثة:\n${conversationContext.substring(0, 200)}...`);
      } else {
        //console.log(`📚 [AI-IMAGE-DETECTION] لا يوجد سياق محادثة سابق`);
      }

      const msgLower = (message || '').toLowerCase().trim();
      
      // ⚡ Quick rule 0: Price question - NO IMAGES (أولوية قصوى)
      const priceKeywords = [
        'عامل كام', 'عاملة كام', 'عامله كام',
        'بكام', 'بكم', 'ب كام', 'ب كم',
        'سعره', 'سعرها', 'سعر ال', 'سعر',
        'ثمنه', 'ثمنها', 'ثمن',
        'تمنه', 'تمنها', 'تمن',
        'كام الثمن', 'كام التمن', 'كام السعر'
      ];
      
      const isPriceQuestion = priceKeywords.some(keyword => msgLower.includes(keyword));
      
      if (isPriceQuestion) {
        console.log('💰 [AI-IMAGE-DETECTION] Price question detected - returning FALSE (no images)');
        return false;
      }
      
      // ⚡ Quick rule 1: Explicit image request keywords (very high confidence)
      const explicitImageWords = [
        'صور', 'صورة', 'صوره', 'ممكن صورة', 'ابعتلي صور', 'ابعت صور',
        'عايز صور', 'عايزه صور', 'عايزة صور', 'عاوز صور', 'عاوزة صور',
        'اريد صور', 'اشوف صور', 'شوف صور', 'وريني صور', 'ورني صور',
        'ابعتي صور', 'ابعتيلي صور', 'ابعتى صور'
      ];
      
      // Check for explicit image request
      const hasExplicitImageRequest = explicitImageWords.some(keyword => {
        const keywordLower = keyword.toLowerCase();
        // Match whole word or at word boundary
        return msgLower.includes(keywordLower);
      });
      
      if (hasExplicitImageRequest) {
        console.log('⚡ [AI-IMAGE-DETECTION] Explicit image request detected - returning true immediately');
        return true;
      }

      // ⚡ Quick rule 2: if last AI asked about sending images and user replied with a short affirmative, treat as requesting images
      try {
        const shortYes = ['اه', 'ايوه', 'ايوة', 'نعم', 'تمام', 'ماشي', 'اوكي', 'تمام اوي', 'تمام جدا', 'اه تمام'];
        const userSaidYes = shortYes.some(y => msgLower.includes(y)) && msgLower.length <= 12;

        if (userSaidYes && Array.isArray(conversationMemory) && conversationMemory.length > 0) {
          const recent = conversationMemory.slice(-3);
          const aiOffersImagesPatterns = [
            'أبعتلك صور', 'ابعتلك صور', 'أبعت لك صور', 'ابعت لك صور',
            'أبعتلك صوره', 'ابعتلك صوره', 'أبعت لك صوره', 'ابعت لك صوره',
            'تحبي أبعتلك صور', 'تحب أبعتلك صور', 'عايزه صورته', 'عايز صورته',
            'أبعت الصور', 'ابعت الصور', 'أبعتلك الصورة', 'ابعتلك الصورة',
            'تبقي عايز صور', 'تحبي اشوفك صور', 'ارسل الصور'
          ].map(s => s.toLowerCase());

          const aiRecentlyOfferedImages = recent.some(m => {
            // NEW FORMAT: content/isFromCustomer
            if (m && m.content && m.isFromCustomer === false) {
              const aiText = (m.content || '').toLowerCase();
              return aiOffersImagesPatterns.some(p => aiText.includes(p));
            }
            // OLD FORMAT: aiResponse/userMessage
            if (m && m.aiResponse) {
              const aiText = (m.aiResponse || '').toLowerCase();
              return aiOffersImagesPatterns.some(p => aiText.includes(p));
            }
            return false;
          });

          if (aiRecentlyOfferedImages) {
            //console.log('⚡ [AI-IMAGE-DETECTION] Quick rule matched: user affirmed image offer');
            return true;
          }
        }
      } catch (quickRuleErr) {
        // Ignore and continue to AI detection
      }

      // Prompt متقدم للذكاء الاصطناعي
      const advancedImageRequestPrompt = `
أنت خبير في فهم نوايا العملاء. حلل الرسالة التالية بعمق لتحديد إذا كان العميل يريد رؤية صور للمنتجات.

الرسالة الحالية: "${message}"

${conversationContext ? `سياق المحادثة السابقة:\n${conversationContext}\n` : ''}

معايير التحليل:
1. الطلب المباشر للصور: "ممكن صورة"، "ابعتلي صور"، "عايز أشوف صور"
2. الطلب غير المباشر: "عايز أشوف"، "وريني"، "كيف شكله"، "شكله ايه"
3. السياق العام: هل يسأل عن منتج ويريد رؤيته؟
4. النية الضمنية: هل يبدو مهتم برؤية المنتج بصرياً؟

تجنب الإيجابيات الخاطئة:
- "أشوف المتاح" = يريد معرفة ما متوفر (ليس بالضرورة صور)
- "شوف لي" = قد يعني البحث وليس الصور
- "إيه اللي عندكم" = استفسار عام وليس طلب صور

حلل بعناية وأجب:
- "نعم" إذا كان يطلب صور بوضوح (مباشر أو غير مباشر)
- "لا" إذا كان مجرد استفسار عام أو لا يريد صور

التحليل والقرار:`;

      //console.log(`🤖 [AI-IMAGE-DETECTION] إرسال الطلب للذكاء الاصطناعي...`);
      const response = await this.generateAIResponse(advancedImageRequestPrompt, [], false, null, companyId);
      //console.log(`📥 [AI-IMAGE-DETECTION] رد الذكاء الاصطناعي: "${response}"`);

      const analysisText = response.trim().toLowerCase();
      //console.log(`🔤 [AI-IMAGE-DETECTION] النص بعد التطبيع: "${analysisText}"`);

      // تحليل أكثر دقة للرد
      const containsYes = analysisText.includes('نعم');
      const containsNoYes = analysisText.includes('لا نعم');
      const isRequesting = containsYes && !containsNoYes;

      //console.log(`🔍 [AI-IMAGE-DETECTION] تحليل الرد:`);
      //console.log(`   - يحتوي على "نعم": ${containsYes}`);
      //console.log(`   - يحتوي على "لا نعم": ${containsNoYes}`);
      //console.log(`   - القرار النهائي: ${isRequesting}`);

      // تسجيل مفصل للتحليل
      //console.log(`\n🎯 [AI-IMAGE-DETECTION] ===== النتيجة النهائية =====`);
      //console.log(`📝 الرسالة: "${message}"`);
      //console.log(`🤖 رد الـ AI: "${response}"`);
      //console.log(`${isRequesting ? '✅' : '❌'} القرار: ${isRequesting ? 'العميل يريد صور' : 'العميل لا يريد صور'}`);

      return isRequesting;

    } catch (error) {
      console.error(`❌ [AI-IMAGE-DETECTION] Error in AI analysis: ${error.message}`);

      // Fallback محدود جداً - فقط للطلبات الواضحة
      const explicitImageKeywords = [
        'ممكن صورة', 'ابعتلي صور', 'عايز صور', 'اريد صور',
        'صورة للمنتج', 'صور المنتج', 'وريني صور'
      ];

      const messageNormalized = message.toLowerCase();
      const hasExplicitRequest = explicitImageKeywords.some(keyword =>
        messageNormalized.includes(keyword)
      );

      //console.log(`🔄 [AI-IMAGE-DETECTION] Fallback (explicit only): ${hasExplicitRequest ? 'YES' : 'NO'}`);
      return hasExplicitRequest;
    }
  }

  /**
   * Use AI to find products from conversation context
   */
  async findProductsFromContext(message, conversationMemory ) {
    try {
      // Build context from recent conversation
      const recentMessages = conversationMemory.slice(-5);
      const conversationContext = recentMessages.map(memory =>
        `العميل: ${memory.userMessage}\nالرد: ${memory.aiResponse}`
      ).join('\n---\n');

      const contextPrompt = `
بناءً على سياق المحادثة التالية، هل تم ذكر أي منتجات؟

${conversationContext}

الرسالة الحالية: "${message}"

إذا تم ذكر منتجات في المحادثة، أجب بـ "نعم"
إذا لم يتم ذكر أي منتجات، أجب بـ "لا"
`;

      const response = await this.generateAIResponse(contextPrompt, [], false);
      const hasProductContext = response.trim().toLowerCase().includes('نعم');

      if (hasProductContext) {
        //console.log('🎯 AI detected product context, fetching all products...');
        return await this.ragService.retrieveData('منتج', 'product_inquiry', null); // companyId سيتم تمريره لاحقاً
      }

      return [];

    } catch (error) {
      //console.log(`❌ Error in AI context analysis: ${error.message}`);
      return [];
    }
  }

  /**
   * @deprecated ❌ هذه الدالة معطلة - استخدم getSmartResponse بدلاً منها
   */
  async getProductImages(customerMessage, ragData, intent, conversationMemory ) {
    //console.log('⚠️ [DEPRECATED] getProductImages is disabled - use getSmartResponse instead');
    return [];
  }

  /**
   * Extract product ID from RAG data
   */
  async extractProductIdFromRAG(ragItem) {
    try {
      // Search for product in database based on RAG content
      const products = await this.getSharedPrismaClient().product.findMany({
        where: {
          OR: [
            { name: { contains: 'كوتشي' } },
            { name: { contains: 'حذاء' } },
            { name: { contains: 'حريمي' } }
          ]
        }
      });

      return products.length > 0 ? products[0].id : null;
    } catch (error) {
      console.error('❌ Error extracting product ID:', error);
      return null;
    }
  }

  /**
   * Get product images from database
   */
  async getProductImagesFromDB(productId) {
    try {
      const product = await this.getSharedPrismaClient().product.findUnique({
        where: { id: productId },
        include: {
          variants: true
        }
      });

      if (!product) {
        //console.log('❌ Product not found, using default images');
        return this.getDefaultProductImages();
      }

      //console.log('🔍 Checking product for images:', {
      //   id: product.id,
      //   name: product.name,
      //   images: product.images,
      //   imageUrl: product.imageUrl
      // });

      const productImages = [];

      // Check for product images in JSON format - اخذ أول صورة فقط
      if (product.images) {
        try {
          const parsedImages = JSON.parse(product.images);
          if (Array.isArray(parsedImages) && parsedImages.length > 0) {
            //console.log(`📸 Found ${parsedImages.length} images in product.images - taking first one only`);

            // أخذ أول صورة فقط بدلاً من كل الصور
            const firstImageUrl = parsedImages[0];
            productImages.push({
              type: 'image',
              payload: {
                url: firstImageUrl,
                title: `${product.name}`
              }
            });
          }
        } catch (parseError) {
          //console.log('⚠️ Error parsing product.images:', parseError.message);
        }
      }

      // Check for single image URL
      if (product.imageUrl && productImages.length === 0) {
        //console.log('📸 Found single image in product.imageUrl');
        productImages.push({
          type: 'image',
          payload: {
            url: product.imageUrl,
            title: `${product.name} - صورة المنتج`
          }
        });
      }

      // Check variant images
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((variant, index) => {
          if (variant.imageUrl) { // ✅ إزالة الحد - إضافة كل variant images
            //console.log(`📸 Found variant image for ${variant.color || variant.name}`);
            productImages.push({
              type: 'image',
              payload: {
                url: variant.imageUrl,
                title: `${product.name} - ${variant.color || variant.name}`
              }
            });
          }
        });
      }

      if (productImages.length > 0) {
        //console.log(`✅ Found ${productImages.length} real product images`);
        return productImages; // ✅ إرجاع كل الصور بدون حد
      } else {
        //console.log('⚠️ No real images found, using customized images');
        return this.getCustomizedProductImages(product);
      }

    } catch (error) {
      console.error('❌ Error getting product images from DB:', error);
      return this.getDefaultProductImages();
    }
  }

  /**
   * Get customized product images based on product data
   */
  getCustomizedProductImages(product) {
    // Use real, accessible image URLs that Facebook can download
    return [
      {
        type: 'image',
        payload: {
          url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop',
          title: `${product.name} - صورة المنتج`
        }
      },
      {
        type: 'image',
        payload: {
          url: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400&h=400&fit=crop',
          title: `${product.name} - زاوية أخرى`
        }
      },
      {
        type: 'image',
        payload: {
          url: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=400&fit=crop',
          title: `${product.name} - التفاصيل`
        }
      }
    ];
  }

  /**
   * ❌ معطل - لا نرسل صور افتراضية بعد الآن
   */
  getDefaultProductImages() {
    //console.log(`⚠️ [DEFAULT-IMAGES] Default images disabled - only send real product images when requested`);
    return [];
  }

  /**
   * Get active Gemini API key using new multi-key system with company isolation
   */
  async getActiveGeminiKey(companyId) {
    try {
      //console.log('🔍 البحث عن مفتاح Gemini نشط (النظام الجديد مع دعم المفاتيح المركزية)...');

      // تحديد الشركة - بدون fallback للأمان
      let targetCompanyId = companyId;
      if (!targetCompanyId) {
        console.error('❌ [SECURITY] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      // 1. التحقق من إعدادات الشركة (useCentralKeys)
      const company = await this.getSharedPrismaClient().company.findUnique({
        where: { id: targetCompanyId },
        select: { useCentralKeys: true }
      });

      const useCentralKeys = company?.useCentralKeys || false;

      // 2. إذا كانت الشركة تستخدم المفاتيح المركزية، ابحث في المفاتيح المركزية أولاً
      if (useCentralKeys) {
        //console.log(`🔑 [CENTRAL] الشركة ${targetCompanyId} تستخدم المفاتيح المركزية`);
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
      const activeKey = await this.getSharedPrismaClient().geminiKey.findFirst({
        where: {
          isActive: true,
          companyId: targetCompanyId,
          keyType: 'COMPANY'
        },
        orderBy: { priority: 'asc' }
      });

      if (!activeKey) {
        console.log(`❌ لم يتم العثور على مفتاح نشط للشركة: ${targetCompanyId}`);
        console.log('🔄 محاولة تفعيل أول مفتاح متاح تلقائياً...');

        // البحث عن أول مفتاح متاح وتفعيله تلقائياً
        const autoActivatedKey = await this.findAndActivateFirstAvailableKey(targetCompanyId);
        if (autoActivatedKey) {
          console.log(`✅ تم تفعيل مفتاح تلقائياً: ${autoActivatedKey.keyName || autoActivatedKey.keyId}`);
          return autoActivatedKey;
        }

        console.log('⚠️ لم يتم العثور على مفاتيح شركة للتفعيل التلقائي');

        // 4. Fallback: إذا لم توجد مفاتيح شركة، جرب المفاتيح المركزية (بغض النظر عن useCentralKeys)
        console.log('🔄 [FALLBACK] محاولة استخدام المفاتيح المركزية كبديل...');
        const centralKey = await this.findActiveCentralKey();
        if (centralKey) {
          console.log(`✅ [FALLBACK] تم العثور على مفتاح مركزي: ${centralKey.name} (ID: ${centralKey.id})`);
          const bestModel = await this.findBestAvailableModelInActiveKey(centralKey.id);
          if (bestModel) {
            console.log(`✅ [FALLBACK] تم العثور على نموذج متاح: ${bestModel.model}`);
            await this.updateModelUsage(bestModel.id);
            return {
              apiKey: centralKey.apiKey,
              model: bestModel.model,
              keyId: centralKey.id,
              modelId: bestModel.id,
              keyType: 'CENTRAL'
            };
          } else {
            console.error(`❌ [FALLBACK] لم يتم العثور على نموذج متاح في المفتاح المركزي: ${centralKey.name}`);
          }
        } else {
          console.error('❌ [FALLBACK] لم يتم العثور على مفاتيح مركزية نشطة');
        }

        console.log(`❌ لا توجد مفاتيح متاحة للتفعيل للشركة: ${targetCompanyId}`);
        return null;
      }

      //console.log(`🔍 المفتاح النشط للشركة ${targetCompanyId}: ${activeKey.name}`);

      // البحث عن أفضل نموذج متاح في هذا المفتاح
      const bestModel = await this.findBestAvailableModelInActiveKey(activeKey.id);
      
      if (bestModel) {
        // تحديث عداد الاستخدام للنموذج
        await this.updateModelUsage(bestModel.id);
        
        //console.log(`✅ تم العثور على نموذج متاح: ${bestModel.model}`);

        // 🔍 لوج مفصل لتتبع المفتاح المستخدم
        //console.log('🔑 [KEY-TRACKING] ===== تتبع المفتاح المستخدم =====');
        //console.log('🏢 [KEY-TRACKING] Company ID:', targetCompanyId);
        //console.log('🔑 [KEY-TRACKING] Key ID:', activeKey.id);
        //console.log('🤖 [KEY-TRACKING] Model:', bestModel.model);
        //console.log('🔗 [KEY-TRACKING] API Key (first 20 chars):', activeKey.apiKey?.substring(0, 20) + '...');
        //console.log('📊 [KEY-TRACKING] Model Usage:', bestModel.currentUsage + '/' + bestModel.dailyLimit);
        //console.log('🔑 [KEY-TRACKING] ===== نهاية تتبع المفتاح =====');

        return {
          apiKey: activeKey.apiKey,
          model: bestModel.model,
          keyId: activeKey.id,
          modelId: bestModel.id
        };
      }

      //console.log('⚠️ لا توجد نماذج متاحة في المفتاح النشط، البحث عن بديل...');

      // البحث عن نموذج احتياطي للشركة
      const backupModel = await this.findNextAvailableModel(targetCompanyId);
      if (backupModel) {
        //console.log(`🔄 تم التبديل إلى نموذج احتياطي: ${backupModel.model}`);
        return {
          apiKey: backupModel.apiKey,
          model: backupModel.model,
          keyId: backupModel.keyId,
          switchType: backupModel.switchType
        };
      }

      //console.log('❌ لا توجد نماذج متاحة في أي مفتاح');
      return null;

    } catch (error) {
      console.error('❌ خطأ في الحصول على مفتاح Gemini:', error);
      return null;
    }
  }

  // فحص Rate Limit للـ window معين (دقيقة، ساعة، يوم)
  isRateLimitExceeded(windowData, windowType) {
    if (!windowData || !windowData.limit || windowData.limit === 0) {
      return false; // لا يوجد حد محدد
    }

    const now = new Date();
    let windowStart = windowData.windowStart ? new Date(windowData.windowStart) : null;
    let windowMs = 0;

    // تحديد حجم النافذة
    switch (windowType) {
      case 'minute':
        windowMs = 60 * 1000; // 1 دقيقة
        break;
      case 'hour':
        windowMs = 60 * 60 * 1000; // 1 ساعة
        break;
      case 'day':
        windowMs = 24 * 60 * 60 * 1000; // 1 يوم
        break;
      default:
        return false;
    }

    // إذا لم يكن هناك windowStart، أو انتهت النافذة، ابدأ نافذة جديدة
    if (!windowStart || (now - windowStart) >= windowMs) {
      return false; // النافذة جديدة أو انتهت، متاح للاستخدام
    }

    // التحقق من الحد
    const used = windowData.used || 0;
    return used >= windowData.limit;
  }

  // البحث عن أفضل نموذج متاح في المفتاح النشط
  async findBestAvailableModelInActiveKey(keyId, forceRefresh = false) {
    try {
      console.log(`🔍 [FIND-MODEL] البحث عن نموذج متاح في المفتاح: ${keyId}`);
      
      // FIXED: Use Prisma ORM instead of raw SQL for better security
      // ⚠️ قائمة النماذج المعطلة مؤقتاً (غير متوفرة في API)
      const disabledModels = [
        'gemini-3-pro' // ⚠️ معطل - غير متوفر في API (404 Not Found) - تم الاختبار والتأكد
      ];
      
      const availableModels = await this.getSharedPrismaClient().geminiKeyModel.findMany({
        where: {
          keyId: keyId,
          isEnabled: true,
          model: {
            notIn: disabledModels // تخطي النماذج المعطلة مباشرة من الاستعلام
          }
        },
        orderBy: {
          priority: 'asc' // الأذكى أولاً
        }
      });

      console.log(`📋 [FIND-MODEL] تم العثور على ${availableModels.length} نموذج مفعل (مرتبة حسب الأولوية)`);
      if (availableModels.length > 0) {
        console.log(`   الأولوية الأولى: ${availableModels[0].model} (Priority: ${availableModels[0].priority})`);
      }

      for (const modelRecord of availableModels) {
        console.log(`🔍 [FIND-MODEL] فحص النموذج: ${modelRecord.model} (Priority: ${modelRecord.priority})`);
        
        // فحص الذاكرة المؤقتة أولاً
        if (this.exhaustedModelsCache && this.exhaustedModelsCache.has(modelRecord.model)) {
          console.log(`⚠️ [FIND-MODEL] النموذج ${modelRecord.model} في قائمة المستنفدة المؤقتة - يتم تخطيه`);
          continue;
        }

        let usage;
        try {
          usage = JSON.parse(modelRecord.usage || '{}');
        } catch (e) {
          console.warn(`⚠️ خطأ في تحليل JSON للنموذج ${modelRecord.id}:`, e.message);
          continue;
        }

        // التحقق من RPM (Requests Per Minute) - فقط إذا كان limit > 0
        if (usage.rpm && usage.rpm.limit > 0 && this.isRateLimitExceeded(usage.rpm, 'minute')) {
          console.log(`⚠️ [FIND-MODEL] النموذج ${modelRecord.model} تجاوز RPM (${usage.rpm.used}/${usage.rpm.limit})`);
          continue;
        }

        // التحقق من RPH (Requests Per Hour) - فقط إذا كان limit > 0
        if (usage.rph && usage.rph.limit > 0 && this.isRateLimitExceeded(usage.rph, 'hour')) {
          console.log(`⚠️ [FIND-MODEL] النموذج ${modelRecord.model} تجاوز RPH (${usage.rph.used}/${usage.rph.limit})`);
          continue;
        }

        // التحقق من RPD (Requests Per Day) - فقط إذا كان limit > 0
        if (usage.rpd && usage.rpd.limit > 0 && this.isRateLimitExceeded(usage.rpd, 'day')) {
          console.log(`⚠️ [FIND-MODEL] النموذج ${modelRecord.model} تجاوز RPD (${usage.rpd.used}/${usage.rpd.limit})`);
          continue;
        }

        // فحص إضافي: إذا كان النموذج يبدو متاحاً لكن تم تحديثه مؤخراً كمستنفد
        if (forceRefresh && usage.exhaustedAt) {
          const exhaustedTime = new Date(usage.exhaustedAt);
          const now = new Date();
          const timeDiff = now - exhaustedTime;

          // إذا تم تحديد النموذج كمستنفد خلال آخر 5 دقائق، تجاهله
          if (timeDiff < 5 * 60 * 1000) {
            //console.log(`⚠️ النموذج ${modelRecord.model} تم تحديده كمستنفد مؤخراً`);
            continue;
          }
        }

        // التحقق من الحد العام (للتوافق العكسي)
        const currentUsage = usage.used || 0;
        const maxRequests = usage.limit || 1000000;
        if (currentUsage >= maxRequests) {
          console.log(`⚠️ [FIND-MODEL] النموذج ${modelRecord.model} تجاوز الحد العام (${currentUsage}/${maxRequests})`);
          continue;
        }

        console.log(`✅ [FIND-MODEL] نموذج متاح: ${modelRecord.model} (Key: ${keyId})`);
        return modelRecord;
      }

      console.log(`❌ [FIND-MODEL] لم يتم العثور على نموذج متاح في المفتاح: ${keyId}`);
      return null;
    } catch (error) {
      console.error('❌ [FIND-MODEL] خطأ في البحث عن نموذج متاح:', error);
      return null;
    }
  }

  // البحث عن مفتاح مركزي نشط
  async findActiveCentralKey() {
    try {
      //console.log('🔑 [CENTRAL] البحث عن مفتاح مركزي نشط...');

      const centralKey = await this.getSharedPrismaClient().geminiKey.findFirst({
        where: {
          keyType: 'CENTRAL',
          companyId: null,
          isActive: true
        },
        orderBy: { priority: 'asc' }
      });

      if (centralKey) {
        console.log(`✅ [CENTRAL] تم العثور على مفتاح مركزي نشط: ${centralKey.name} (ID: ${centralKey.id})`);
        return centralKey;
      }

      console.log('⚠️ [CENTRAL] لا يوجد مفتاح مركزي نشط');
      return null;
    } catch (error) {
      console.error('❌ خطأ في البحث عن مفتاح مركزي:', error);
      return null;
    }
  }

  // تحديد نموذج كمستنفد بناءً على خطأ 429
  async markModelAsExhaustedFrom429(modelName, quotaValue) {
    try {
      //console.log(`⚠️ تحديد النموذج ${modelName} كمستنفد بناءً على خطأ 429...`);

      // FIXED: Use Prisma ORM instead of raw SQL
      const modelRecord = await this.getSharedPrismaClient().geminiKeyModel.findMany({
        where: {
          model: modelName
        }
      });

      if (modelRecord && modelRecord.length > 0) {
        const model = modelRecord[0];
        const usage = JSON.parse(model.usage);

        // تحديث الاستخدام بناءً على الحد الحقيقي من Google
        const realLimit = parseInt(quotaValue) || usage.limit || 250;
        const exhaustedUsage = {
          ...usage,
          used: realLimit, // استخدام الحد الحقيقي من Google
          limit: realLimit, // تحديث الحد أيضاً
          lastReset: new Date().toISOString(),
          exhaustedAt: new Date().toISOString()
        };

        // FIXED: Use Prisma ORM instead of raw SQL
        await this.getSharedPrismaClient().geminiKeyModel.update({
          where: {
            id: model.id
          },
          data: {
            usage: JSON.stringify(exhaustedUsage)
          }
        });

        //console.log(`✅ تم تحديد النموذج ${modelName} كمستنفد (${realLimit}/${realLimit})`);

        // إضافة النموذج إلى قائمة النماذج المستنفدة المؤقتة لتجنب إعادة استخدامه
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
      }
    } catch (error) {
      console.error('❌ خطأ في تحديد النموذج كمستنفد:', error);
    }
  }

  // تحديد نموذج كمستنفد (تجاوز الحد)
  async markModelAsExhausted(modelId) {
    try {
      //console.log(`⚠️ تحديد النموذج ${modelId} كمستنفد...`);

      // FIXED: Use Prisma ORM instead of raw SQL
      const modelRecord = await this.getSharedPrismaClient().geminiKeyModel.findMany({
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
          used: usage.limit || 250, // استخدام الحد الأقصى
          lastReset: new Date().toISOString(),
          exhaustedAt: new Date().toISOString()
        };

        // FIXED: Use Prisma ORM instead of raw SQL
        await this.getSharedPrismaClient().geminiKeyModel.update({
          where: {
            id: modelId
          },
          data: {
            usage: JSON.stringify(exhaustedUsage)
          }
        });

        //console.log(`✅ تم تحديد النموذج ${model.model} كمستنفد`);
      }
    } catch (error) {
      console.error('❌ خطأ في تحديد النموذج كمستنفد:', error);
    }
  }

  // تحديث عداد الاستخدام لنموذج معين مع دعم RPM, RPH, RPD, TPM
  // ✅ استخدام modelManager بدلاً من النسخة المكررة
  async updateModelUsage(modelId, totalTokenCount = 0) {
    // ✅ استخدام modelManager للتحديث
    return await this.getModelManager().updateModelUsage(modelId, totalTokenCount);
  }
  
  // ✅ الاحتفاظ بالدالة القديمة للتوافق (deprecated)
  async _updateModelUsageLegacy(modelId) {
    try {
      // FIXED: Use Prisma ORM instead of raw SQL
      const modelRecord = await this.getSharedPrismaClient().geminiKeyModel.findMany({
        where: {
          id: modelId
        }
      });

      if (modelRecord && modelRecord.length > 0) {
        const model = modelRecord[0];
        let usage;
        try {
          usage = JSON.parse(model.usage || '{}');
        } catch (e) {
          console.warn(`⚠️ خطأ في تحليل JSON للنموذج ${modelId}:`, e.message);
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

        // FIXED: Use Prisma ORM instead of raw SQL
        await this.getSharedPrismaClient().geminiKeyModel.update({
          where: {
            id: modelId
          },
          data: {
            usage: JSON.stringify(newUsage),
            lastUsed: now,
            updatedAt: now
          }
        });

        //console.log(`📊 تم تحديث الاستخدام: ${model.model} (RPM: ${rpm.used}/${rpm.limit}, RPH: ${rph.used}/${rph.limit}, RPD: ${rpd.used}/${rpd.limit})`);
      }
    } catch (error) {
      console.error('❌ خطأ في تحديث عداد الاستخدام:', error);
    }
  }

  // فحص صحة نموذج معين
  async testModelHealth(apiKey, model) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const testModel = genAI.getGenerativeModel({ model: model });
      
      const testResponse = await testModel.generateContent('Hello');
      return testResponse && testResponse.response;
    } catch (error) {
      //console.log(`❌ Health check failed for ${model}: ${error.message}`);
      return false;
    }
  }

  async findNextAvailableModel(companyId ) {
    try {
      //console.log('🔄 البحث عن نموذج احتياطي متاح باستخدام النظام الجديد...');

      // تحديد الشركة - بدون fallback للأمان
      let targetCompanyId = companyId;
      if (!targetCompanyId) {
        console.error('❌ [SECURITY] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      if (!targetCompanyId) {
        //console.log('❌ لا توجد شركات في النظام');
        return null;
      }

      // التحقق من إعدادات الشركة
      const company = await this.getSharedPrismaClient().company.findUnique({
        where: { id: targetCompanyId },
        select: { useCentralKeys: true }
      });

      const useCentralKeys = company?.useCentralKeys || false;

      // الحصول على المفتاح النشط الحالي (شركة أو مركزي)
      let currentActiveKey;
      
      if (useCentralKeys) {
        // البحث في المفاتيح المركزية أولاً
        currentActiveKey = await this.getSharedPrismaClient().geminiKey.findFirst({
          where: {
            isActive: true,
            keyType: 'CENTRAL',
            companyId: null
          },
          orderBy: { priority: 'asc' }
        });
      }
      
      if (!currentActiveKey) {
        // البحث في مفاتيح الشركة
        currentActiveKey = await this.getSharedPrismaClient().geminiKey.findFirst({
          where: {
            isActive: true,
            companyId: targetCompanyId,
            keyType: 'COMPANY'
          },
          orderBy: { priority: 'asc' }
        });
      }

      if (currentActiveKey) {
        //console.log(`🔍 المفتاح النشط الحالي: ${currentActiveKey.name}`);

        // أولاً: البحث عن نموذج آخر في نفس المفتاح
        const nextModelInSameKey = await this.findNextModelInKey(currentActiveKey.id);
        if (nextModelInSameKey) {
          //console.log(`✅ تم العثور على نموذج آخر في نفس المفتاح: ${nextModelInSameKey.model}`);
          return {
            apiKey: currentActiveKey.apiKey,
            model: nextModelInSameKey.model,
            keyId: currentActiveKey.id,
            keyName: currentActiveKey.name,
            switchType: 'same_key_different_model'
          };
        }
      }

      // ثانياً: البحث في مفاتيح أخرى
      //console.log('🔄 البحث في مفاتيح أخرى...');
      const nextKeyWithModel = await this.findNextAvailableKey(targetCompanyId);
      
      if (nextKeyWithModel) {
        //console.log(`✅ تم العثور على مفتاح آخر متاح: ${nextKeyWithModel.keyName} - ${nextKeyWithModel.model}`);
        
        // تفعيل المفتاح الجديد
        await this.activateKey(nextKeyWithModel.keyId);
        
        return {
          apiKey: nextKeyWithModel.apiKey,
          model: nextKeyWithModel.model,
          keyId: nextKeyWithModel.keyId,
          keyName: nextKeyWithModel.keyName,
          switchType: 'different_key'
        };
      }

      // ثالثاً: Fallback إلى المفاتيح المركزية إذا لم تكن مستخدمة
      if (!useCentralKeys) {
        const centralKey = await this.findActiveCentralKey();
        if (centralKey) {
          const nextModelInCentral = await this.findNextModelInKey(centralKey.id);
          if (nextModelInCentral) {
            return {
              apiKey: centralKey.apiKey,
              model: nextModelInCentral.model,
              keyId: centralKey.id,
              keyName: centralKey.name,
              switchType: 'central_key_fallback'
            };
          }
        }
      }

      //console.log('❌ لا توجد نماذج متاحة في أي مفتاح');
      return null;

    } catch (error) {
      console.error('❌ خطأ في البحث عن نموذج احتياطي:', error);
      return null;
    }
  }

  // البحث عن نموذج آخر متاح في نفس المفتاح
  async findNextModelInKey(keyId) {
    try {
      //console.log(`🔍 البحث عن نموذج آخر في المفتاح: ${keyId}`);
      
      // FIXED: Use Prisma ORM instead of raw SQL for better security
      const availableModels = await this.getSharedPrismaClient().geminiKeyModel.findMany({
        where: {
          keyId: keyId,
          isEnabled: true
        },
        orderBy: {
          priority: 'asc'
        }
      });

      //console.log(`📋 تم العثور على ${availableModels.length} نموذج في هذا المفتاح`);

      for (const modelRecord of availableModels) {
        // فحص الذاكرة المؤقتة أولاً
        if (this.exhaustedModelsCache && this.exhaustedModelsCache.has(modelRecord.model)) {
          //console.log(`⚠️ النموذج ${modelRecord.model} في قائمة المستنفدة المؤقتة`);
          continue;
        }

        const usage = JSON.parse(modelRecord.usage);
        const currentUsage = usage.used || 0;
        const maxRequests = usage.limit || 1000000;

        //console.log(`🔍 فحص ${modelRecord.model}: ${currentUsage}/${maxRequests}`);

        // فحص إضافي: إذا كان النموذج تم تحديده كمستنفد مؤخراً، تجاهله
        if (usage.exhaustedAt) {
          const exhaustedTime = new Date(usage.exhaustedAt);
          const now = new Date();
          const timeDiff = now - exhaustedTime;

          // إذا تم تحديد النموذج كمستنفد خلال آخر 5 دقائق، تجاهله
          if (timeDiff < 5 * 60 * 1000) {
            //console.log(`⚠️ النموذج ${modelRecord.model} تم تحديده كمستنفد مؤخراً`);
            continue;
          }
        }

        if (currentUsage < maxRequests) {
          // اختبار صحة النموذج
          const keyRecord = await this.getSharedPrismaClient().geminiKey.findUnique({ where: { id: keyId } });
          const isHealthy = await this.testModelHealth(keyRecord.apiKey, modelRecord.model);
          
          if (isHealthy) {
            //console.log(`✅ نموذج متاح وصحي: ${modelRecord.model}`);
            
            // FIXED: Use Prisma ORM instead of raw SQL
            await this.getSharedPrismaClient().geminiKeyModel.update({
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
            //console.log(`❌ النموذج ${modelRecord.model} غير صحي`);
          }
        } else {
          //console.log(`⚠️ النموذج ${modelRecord.model} تجاوز الحد (${currentUsage}/${maxRequests})`);
        }
      }

      //console.log('❌ لا توجد نماذج متاحة في هذا المفتاح');
      return null;

    } catch (error) {
      console.error('❌ خطأ في البحث عن نموذج في المفتاح:', error);
      return null;
    }
  }

  // البحث عن مفتاح آخر متاح للشركة المحددة
  async findNextAvailableKey(companyId ) {
    try {
      //console.log('🔍 البحث عن مفتاح آخر متاح...');

      // تحديد الشركة - بدون fallback للأمان
      let targetCompanyId = companyId;
      if (!targetCompanyId) {
        console.error('❌ [SECURITY] لم يتم تمرير companyId - رفض الطلب للأمان');
        return null;
      }

      if (!targetCompanyId) {
        //console.log('❌ لا توجد شركات في النظام');
        return null;
      }

      //console.log(`🏢 البحث عن مفاتيح بديلة للشركة: ${targetCompanyId}`);

      // التحقق من إعدادات الشركة
      const company = await this.getSharedPrismaClient().company.findUnique({
        where: { id: targetCompanyId },
        select: { useCentralKeys: true }
      });

      const useCentralKeys = company?.useCentralKeys || false;

      // إذا كانت الشركة تستخدم المفاتيح المركزية، ابحث فيها أولاً
      if (useCentralKeys) {
        const centralKeys = await this.getSharedPrismaClient().geminiKey.findMany({
          where: {
            keyType: 'CENTRAL',
            companyId: null
          },
          orderBy: { priority: 'asc' }
        });

        for (const key of centralKeys) {
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
      }

      // الحصول على مفاتيح الشركة المحددة مرتبة حسب الأولوية
      const allKeys = await this.getSharedPrismaClient().geminiKey.findMany({
        where: {
          companyId: targetCompanyId,
          keyType: 'COMPANY'
        },
        orderBy: { priority: 'asc' }
      });

      //console.log(`📋 فحص ${allKeys.length} مفتاح متاح للشركة ${targetCompanyId}...`);

      for (const key of allKeys) {
        //console.log(`🔍 فحص المفتاح: ${key.name} (أولوية: ${key.priority})`);
        
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

      // Fallback: إذا لم توجد مفاتيح شركة، جرب المفاتيح المركزية
      if (!useCentralKeys) {
        const centralKeys = await this.getSharedPrismaClient().geminiKey.findMany({
          where: {
            keyType: 'CENTRAL',
            companyId: null
          },
          orderBy: { priority: 'asc' }
        });

        for (const key of centralKeys) {
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
      }

      //console.log('❌ لا توجد مفاتيح متاحة');
      return null;

    } catch (error) {
      console.error('❌ خطأ في البحث عن مفتاح متاح:', error);
      return null;
    }
  }

  // البحث عن أفضل نموذج في مفتاح معين
  async findBestModelInKey(keyId) {
    try {
      // FIXED: Use Prisma ORM instead of raw SQL for better security
      const availableModels = await this.getSharedPrismaClient().geminiKeyModel.findMany({
        where: {
          keyId: keyId,
          isEnabled: true
        },
        orderBy: {
          priority: 'asc'
        }
      });

      for (const modelRecord of availableModels) {
        const usage = JSON.parse(modelRecord.usage);
        const currentUsage = usage.used || 0;
        const maxRequests = usage.limit || 1000000;

        if (currentUsage < maxRequests) {
          // اختبار صحة النموذج
          const keyRecord = await this.getSharedPrismaClient().geminiKey.findUnique({ where: { id: keyId } });
          const isHealthy = await this.testModelHealth(keyRecord.apiKey, modelRecord.model);
          
          if (isHealthy) {
            //console.log(`✅ أفضل نموذج في المفتاح: ${modelRecord.model}`);
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

  // البحث عن أول مفتاح متاح وتفعيله تلقائياً
  async findAndActivateFirstAvailableKey(companyId) {
    try {
      console.log(`🔍 [AUTO-ACTIVATE] البحث عن أول مفتاح متاح للتفعيل التلقائي للشركة: ${companyId}`);

      // التحقق من إعدادات الشركة
      const company = await this.getSharedPrismaClient().company.findUnique({
        where: { id: companyId },
        select: { useCentralKeys: true }
      });

      const useCentralKeys = company?.useCentralKeys || false;
      console.log(`📋 [AUTO-ACTIVATE] الشركة useCentralKeys: ${useCentralKeys}`);

      // إذا كانت الشركة تستخدم المفاتيح المركزية، ابحث فيها أولاً
      if (useCentralKeys) {
        console.log('🔍 [AUTO-ACTIVATE] البحث في المفاتيح المركزية...');
        const centralKeys = await this.getSharedPrismaClient().geminiKey.findMany({
          where: {
            keyType: 'CENTRAL',
            companyId: null,
            isActive: true
          },
          orderBy: { priority: 'asc' }
        });

        console.log(`📋 [AUTO-ACTIVATE] تم العثور على ${centralKeys.length} مفتاح مركزي نشط`);

        for (const key of centralKeys) {
          const availableModel = await this.findBestModelInKey(key.id);
          if (availableModel) {
            console.log(`✅ [AUTO-ACTIVATE] تم العثور على نموذج متاح في المفتاح المركزي: ${key.name}`);
            await this.activateKey(key.id);
            const keyRecord = await this.getSharedPrismaClient().geminiKey.findUnique({ where: { id: key.id } });
            return {
              apiKey: keyRecord.apiKey,
              model: availableModel.model,
              keyId: key.id,
              modelId: availableModel.id,
              keyName: keyRecord.name
            };
          }
        }
      }

      // البحث عن جميع مفاتيح الشركة
      console.log(`🔍 [AUTO-ACTIVATE] البحث عن مفاتيح الشركة...`);
      const allKeys = await this.getSharedPrismaClient().geminiKey.findMany({
        where: {
          companyId: companyId,
          keyType: 'COMPANY'
        },
        orderBy: { priority: 'asc' }
      });

      console.log(`📋 [AUTO-ACTIVATE] تم العثور على ${allKeys.length} مفتاح شركة`);

      if (allKeys.length === 0 && !useCentralKeys) {
        console.log(`⚠️ [AUTO-ACTIVATE] لا توجد مفاتيح شركة، جرب المفاتيح المركزية كبديل...`);
        // Fallback: جرب المفاتيح المركزية - استخدم findBestAvailableModelInActiveKey (أسرع ولا يختبر الصحة)
        const centralKeys = await this.getSharedPrismaClient().geminiKey.findMany({
          where: {
            keyType: 'CENTRAL',
            companyId: null,
            isActive: true
          },
          orderBy: { priority: 'asc' }
        });

        console.log(`📋 [AUTO-ACTIVATE] تم العثور على ${centralKeys.length} مفتاح مركزي نشط للـ fallback`);

        for (const key of centralKeys) {
          // استخدم findBestAvailableModelInActiveKey بدلاً من findBestModelInKey (أسرع ولا يختبر الصحة)
          const availableModel = await this.findBestAvailableModelInActiveKey(key.id);
          if (availableModel) {
            console.log(`✅ [AUTO-ACTIVATE] تم العثور على نموذج متاح في المفتاح المركزي (fallback): ${key.name} - ${availableModel.model}`);
            // لا نحتاج لتفعيل المفاتيح المركزية - فهي مشتركة
            return {
              apiKey: key.apiKey,
              model: availableModel.model,
              keyId: key.id,
              modelId: availableModel.id,
              keyName: key.name,
              keyType: 'CENTRAL'
            };
          } else {
            console.log(`⚠️ [AUTO-ACTIVATE] لا توجد نماذج متاحة في المفتاح المركزي: ${key.name}`);
          }
        }
        console.log(`❌ [AUTO-ACTIVATE] لم يتم العثور على نماذج متاحة في المفاتيح المركزية`);
        return null;
      }

      console.log(`📋 [AUTO-ACTIVATE] فحص ${allKeys.length} مفتاح شركة للتفعيل التلقائي...`);

      // البحث عن أول مفتاح يحتوي على نماذج متاحة
      for (const key of allKeys) {
        console.log(`🔍 [AUTO-ACTIVATE] فحص المفتاح: ${key.name} (Active: ${key.isActive})`);

        // البحث عن نموذج متاح في هذا المفتاح
        const availableModel = await this.findBestModelInKey(key.id);

        if (availableModel) {
          console.log(`✅ [AUTO-ACTIVATE] تم العثور على نموذج متاح في المفتاح: ${key.name} - ${availableModel.model}`);

          // تفعيل هذا المفتاح
          const activated = await this.activateKey(key.id);
          if (activated) {
            console.log(`✅ [AUTO-ACTIVATE] تم تفعيل المفتاح: ${key.name}`);
            return {
              apiKey: key.apiKey,
              model: availableModel.model,
              keyId: key.id,
              keyName: key.name,
              modelId: availableModel.id,
              autoActivated: true
            };
          }
        } else {
          console.log(`⚠️ [AUTO-ACTIVATE] لا توجد نماذج متاحة في المفتاح: ${key.name}`);
        }
      }

      console.log(`❌ [AUTO-ACTIVATE] لا توجد مفاتيح تحتوي على نماذج متاحة للشركة: ${companyId}`);
      return null;

    } catch (error) {
      console.error('❌ خطأ في البحث عن مفتاح للتفعيل التلقائي:', error);
      return null;
    }
  }

  // تفعيل مفتاح معين
  async activateKey(keyId) {
    try {
      //console.log(`🔄 تفعيل المفتاح: ${keyId}`);
      
      // FIXED: Add company isolation to prevent affecting other companies
      // First get the company ID from the key
      const keyRecord = await this.getSharedPrismaClient().geminiKey.findUnique({
        where: { id: keyId },
        select: { companyId: true }
      });

      if (!keyRecord) {
        throw new Error('Key not found');
      }

      // إلغاء تفعيل جميع المفاتيح للشركة فقط
      // SECURITY WARNING: Ensure companyId filter is included
      await this.getSharedPrismaClient().geminiKey.updateMany({
        where: {
          companyId: keyRecord.companyId // Company isolation
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      // تفعيل المفتاح المطلوب
      await this.getSharedPrismaClient().geminiKey.update({
        where: {
          id: keyId
        },
        data: {
          isActive: true,
          updatedAt: new Date()
        }
      });
      
      //console.log(`✅ تم تفعيل المفتاح: ${keyId}`);
      return true;

    } catch (error) {
      console.error('❌ خطأ في تفعيل المفتاح:', error);
      return false;
    }
  }

  /**
   * Get AI settings
   */
  async getSettings(companyId) {
    try {
      //console.log('🔍 [aiAgentService] Loading settings from database...');

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

      const company = await this.getSharedPrismaClient().company.findUnique({ where: { id: companyId } });
      //console.log(`🏢 [aiAgentService] Using specific company: ${companyId}`);
      if (!company) {
        //console.log('❌ [aiAgentService] No company found');
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

      //console.log(`🏢 [aiAgentService] Company: ${company.id}`);

      // Get AI settings for the company
      const aiSettings = await this.getSharedPrismaClient().aiSettings.findFirst({
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
          responseRules: true // ✅ إضافة قواعد الاستجابة
        }
      });

      console.log(`⚙️ [aiAgentService] AI Settings found: ${!!aiSettings}`);
      console.log(`🔍 [aiAgentService] Raw aiSettings from DB:`, {
        id: aiSettings?.id,
        companyId: aiSettings?.companyId,
        replyMode: aiSettings?.replyMode,
        autoReplyEnabled: aiSettings?.autoReplyEnabled,
        allKeys: aiSettings ? Object.keys(aiSettings) : []
      });
      
      // ✅ Enhanced logging for replyMode debugging
      if (aiSettings) {
        console.log(`🔍 [aiAgentService] ReplyMode value from DB: "${aiSettings.replyMode}" (type: ${typeof aiSettings.replyMode})`);
        console.log(`🔍 [aiAgentService] ReplyMode === 'new_only': ${aiSettings.replyMode === 'new_only'}`);
        console.log(`🔍 [aiAgentService] ReplyMode === 'all': ${aiSettings.replyMode === 'all'}`);
      }

      if (!aiSettings) {
        //console.log('❌ [aiAgentService] No AI settings found, returning defaults');
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

      //console.log('🔍 [aiAgentService] Raw settings:', {
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
          //console.log('✅ [aiAgentService] Working hours parsed:', workingHours);
        }
      } catch (e) {
        //console.log('⚠️ [aiAgentService] Failed to parse working hours, using defaults');
      }

      // Check if working hours are enabled (for now, disable working hours check)
      const workingHoursEnabled = false; // aiSettings.workingHoursEnabled || false;
      //console.log(`🕐 [aiAgentService] Working hours check ${workingHoursEnabled ? 'ENABLED' : 'DISABLED'} - AI will work ${workingHoursEnabled ? 'within working hours only' : '24/7'}`);

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
        // Dynamic generation config (safe defaults)
        aiTemperature: aiSettings.aiTemperature ?? 0.7,
        aiTopP: aiSettings.aiTopP ?? 0.9,
        aiTopK: aiSettings.aiTopK ?? 40,
        aiMaxTokens: aiSettings.aiMaxTokens ?? DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS,
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
        enableLowQualityAlerts: aiSettings.enableLowQualityAlerts !== false,
        // ✅ قواعد الاستجابة
        responseRules: aiSettings.responseRules || null
      };

      // ✅ Enhanced logging: Show what we're returning
      console.log(`📤 [aiAgentService] Returning settings with replyMode: "${settings.replyMode}"`);
      console.log(`📤 [aiAgentService] Raw replyMode from DB: "${aiSettings.replyMode}" (type: ${typeof aiSettings.replyMode})`);
      
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
   * جمع بيانات التعلم من التفاعل
   */
  async collectLearningData(interactionData) {
    try {
      const {
        companyId,
        customerId,
        conversationId,
        userMessage,
        aiResponse,
        intent,
        sentiment,
        processingTime,
        ragDataUsed,
        memoryUsed,
        model,
        confidence
      } = interactionData;

      // تحضير بيانات التعلم
      const learningData = {
        companyId,
        customerId,
        conversationId,
        type: 'conversation',
        data: {
          userMessage,
          aiResponse,
          intent,
          sentiment,
          processingTime,
          ragDataUsed,
          memoryUsed,
          model,
          confidence,
          timestamp: new Date()
        },
        outcome: this.determineOutcome(userMessage, aiResponse, intent),
        feedback: null // سيتم تحديثه لاحقاً عند وجود تغذية راجعة
      };

      // إرسال البيانات لخدمة التعلم المستمر
      const result = await this.learningService.collectLearningData(learningData);

      if (result.success) {
        //console.log(`✅ [AIAgent] Learning data collected successfully: ${result.data.id}`);
      } else {
        console.error(`❌ [AIAgent] Failed to collect learning data: ${result.error}`);
      }

      return result;

    } catch (error) {
      console.error('❌ [AIAgent] Error in collectLearningData:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * تحديد نتيجة التفاعل
   */
  determineOutcome(userMessage, aiResponse, intent) {
    const userLower = userMessage.toLowerCase();
    const responseLower = aiResponse.toLowerCase();

    // مؤشرات النجاح
    if (userLower.includes('شكرا') || userLower.includes('ممتاز') || userLower.includes('تمام')) {
      return 'satisfied';
    }

    // مؤشرات الشراء
    if (intent === 'purchase' || userLower.includes('أريد أشتري') || userLower.includes('هاخد')) {
      return 'purchase_intent';
    }

    // مؤشرات الحل
    if (intent === 'support' && (responseLower.includes('حل') || responseLower.includes('إجابة'))) {
      return 'resolved';
    }

    // مؤشرات عدم الرضا
    if (userLower.includes('مش فاهم') || userLower.includes('مش واضح') || userLower.includes('غلط')) {
      return 'unsatisfied';
    }

    // افتراضي
    return 'ongoing';
  }

  /**
   * تحديث بيانات التعلم مع التغذية الراجعة
   */
  async updateLearningDataWithFeedback(conversationId, feedback) {
    try {
      //console.log(`📝 [AIAgent] Updating learning data with feedback for conversation: ${conversationId}`);

      // البحث عن بيانات التعلم للمحادثة
      const learningData = await this.learningService.getSharedPrismaClient().learningData.findFirst({
        where: {
          conversationId: conversationId,
          type: 'conversation'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (learningData) {
        // تحديث التغذية الراجعة
        await this.learningService.getSharedPrismaClient().learningData.update({
          where: { id: learningData.id },
          data: {
            feedback: JSON.stringify(feedback),
            outcome: feedback.satisfactionScore > 3 ? 'satisfied' : 'unsatisfied'
          }
        });

        //console.log(`✅ [AIAgent] Learning data updated with feedback`);
        return { success: true };
      } else {
        //console.log(`⚠️ [AIAgent] No learning data found for conversation: ${conversationId}`);
        return { success: false, error: 'No learning data found' };
      }

    } catch (error) {
      console.error('❌ [AIAgent] Error updating learning data with feedback:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * مراقبة أداء التحسينات
   */
  async monitorImprovementPerformance(companyId) {
    try {
      //console.log(`📊 [AIAgent] Monitoring improvement performance for company: ${companyId}`);

      // الحصول على التحسينات النشطة
      const activeImprovements = await this.learningService.getSharedPrismaClient().appliedImprovement.findMany({
        where: {
          companyId,
          status: 'active'
        }
      });

      // حساب مؤشرات الأداء لكل تحسين
      const performanceData = [];

      for (const improvement of activeImprovements) {
        const beforeMetrics = improvement.beforeMetrics ? JSON.parse(improvement.beforeMetrics) : {};
        const afterMetrics = improvement.afterMetrics ? JSON.parse(improvement.afterMetrics) : {};

        performanceData.push({
          improvementId: improvement.id,
          type: improvement.type,
          description: improvement.description,
          beforeMetrics,
          afterMetrics,
          improvement: this.calculateImprovement(beforeMetrics, afterMetrics),
          appliedAt: improvement.appliedAt,
          status: improvement.status
        });
      }

      return {
        success: true,
        data: performanceData,
        summary: {
          totalImprovements: activeImprovements.length,
          averageImprovement: this.calculateAverageImprovement(performanceData)
        }
      };

    } catch (error) {
      console.error('❌ [AIAgent] Error monitoring improvement performance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * حساب التحسن في المؤشرات
   */
  calculateImprovement(beforeMetrics, afterMetrics) {
    const improvements = {};

    // مقارنة المؤشرات المشتركة
    const commonMetrics = ['responseTime', 'satisfactionScore', 'resolutionRate'];

    commonMetrics.forEach(metric => {
      if (beforeMetrics[metric] && afterMetrics[metric]) {
        const before = parseFloat(beforeMetrics[metric]);
        const after = parseFloat(afterMetrics[metric]);

        if (metric === 'responseTime') {
          // للوقت، التحسن يعني انخفاض
          improvements[metric] = ((before - after) / before * 100).toFixed(2);
        } else {
          // للمؤشرات الأخرى، التحسن يعني زيادة
          improvements[metric] = ((after - before) / before * 100).toFixed(2);
        }
      }
    });

    return improvements;
  }

  /**
   * حساب متوسط التحسن
   */
  calculateAverageImprovement(performanceData) {
    if (performanceData.length === 0) return 0;

    let totalImprovement = 0;
    let count = 0;

    performanceData.forEach(data => {
      Object.values(data.improvement).forEach(value => {
        if (!isNaN(parseFloat(value))) {
          totalImprovement += parseFloat(value);
          count++;
        }
      });
    });

    return count > 0 ? (totalImprovement / count).toFixed(2) : 0;
  }

  // دالة موحدة ذكية للحصول على الرد والصور
  async getSmartResponse(customerMessage, intent, conversationMemory , customerId , companyId ) {
    try {
      //console.log(`\n🧠 [SMART-RESPONSE] ===== بدء معالجة الطلب الموحد =====`);
      //console.log(`📝 [SMART-RESPONSE] رسالة العميل: "${customerMessage}"`);
      //console.log(`👤 [SMART-RESPONSE] معرف العميل: ${customerId}`);
      //console.log(`🏢 [SMART-RESPONSE] معرف الشركة: ${companyId}`);

      // فحص إذا كان العميل يطلب صور
      //console.log(`\n🔍 [SMART-RESPONSE] فحص إذا كان العميل يطلب صور...`);
      const wantsImages = await this.isCustomerRequestingImages(customerMessage, conversationMemory, companyId);
      //console.log(`🎯 [SMART-RESPONSE] نتيجة الفحص: ${wantsImages ? '✅ يريد صور' : '❌ لا يريد صور'}`);

      // الحصول على RAG data أولاً (سنحتاجها في جميع الحالات)
      const ragService = require('./ragService');
      let ragData = [];
      let productImages = [];

      // 🆕 فحص خاص: لو العميل يطلب صور/معلومات بدون ذكر منتج محدد
      const msgLower = customerMessage.toLowerCase();
      const isVagueImageRequest = (msgLower.includes('صور') || msgLower.includes('ابعت') || 
                                   msgLower.includes('ارسل') || msgLower.includes('شوف')) &&
                                  customerMessage.length < 30; // رسالة قصيرة
      
      if (isVagueImageRequest && conversationMemory && conversationMemory.length > 0) {
        console.log('🔍 [CONTEXT-SEARCH] العميل يطلب صور بدون تحديد - البحث عن آخر منتج في المحادثة...');
        
        // استخراج آخر منتج من المحادثة
        const recentMessages = conversationMemory.slice(-15).reverse();
        let lastProductName = null;
        
        for (const msg of recentMessages) {
          const content = msg.content || '';
          
          // Pattern 1: اسم منتج بالإنجليزي (Capital letters)
          const englishMatch = content.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/);
          if (englishMatch && englishMatch[1]) {
            lastProductName = englishMatch[1];
            console.log('✅ [CONTEXT-SEARCH] تم العثور على آخر منتج (EN):', lastProductName);
            break;
          }
          
          // Pattern 2: اسم منتج بالعربي بعد كلمات مفتاحية
          const arabicPatterns = [
            /منتج\s+["']?([أ-ي\s]{2,40})["']?\s*(?:متوفر|متاح|سعره|ب|،|\.)/,
            /المنتج\s+["']?([أ-ي\s]{2,40})["']?\s*(?:متوفر|متاح|سعره|ب|،|\.)/,
            /سعر\s+["']?([أ-ي\s]{2,40})["']?\s*(?:هو|:|\d)/,
            /["']([أ-ي\s]{2,40})["']\s*(?:متوفر|متاح|سعره|ب)/,
            /(?:عندنا|لدينا)\s+["']?([أ-ي\s]{2,40})["']?\s*(?:متوفر|ب|سعر)/
          ];
          
          for (const pattern of arabicPatterns) {
            const arabicMatch = content.match(pattern);
            if (arabicMatch && arabicMatch[1]) {
              const productName = arabicMatch[1].trim();
              // تجاهل الكلمات العامة
              const ignoreWords = ['كل', 'جميع', 'أي', 'هذا', 'ذلك', 'التي', 'الذي'];
              if (!ignoreWords.some(word => productName === word)) {
                lastProductName = productName;
                console.log('✅ [CONTEXT-SEARCH] تم العثور على آخر منتج (AR):', lastProductName);
                break;
              }
            }
          }
          
          if (lastProductName) break;
        }
        
        if (lastProductName) {
          console.log('🔄 [CONTEXT-SEARCH] إعادة البحث باستخدام اسم المنتج:', lastProductName);
          // استبدال الرسالة بالمنتج المستخرج
          customerMessage = lastProductName;
        }
      }

      if (wantsImages) {
        //console.log(`\n📸 [SMART-RESPONSE] العميل يريد صور - استخدام البحث الذكي للمنتجات...`);

        // 🆕 PRIORITY 1: فحص إذا كان العميل يطلب category معينة أو كل المنتجات
        console.log(`\n🔍 [CATEGORY-CHECK] فحص إذا كان الطلب لـ category معينة...`);
        const categoryDetection = await ragService.detectCategoryFromMessage(customerMessage, companyId);
        
        if (categoryDetection && categoryDetection.categoryName && categoryDetection.confidence >= 0.6) {
          console.log(`✅ [CATEGORY-FOUND] تم اكتشاف category: "${categoryDetection.categoryName}"`);
          console.log(`🧠 [CATEGORY-REASONING] ${categoryDetection.reasoning}`);
          
          // جلب جميع المنتجات من هذا التصنيف
          const categoryResult = await ragService.retrieveProductsByCategory(
            categoryDetection.categoryName,
            companyId
          );
          
          if (categoryResult.images.length > 0) {
            console.log(`✅ [CATEGORY-RESPONSE] تم جلب ${categoryResult.totalProducts} منتج و ${categoryResult.totalImages} صورة من التصنيف`);
            
            return {
              images: categoryResult.images,
              ragData: categoryResult.products,
              hasSpecificProduct: false, // هذا category وليس منتج محدد
              categoryInfo: {
                categoryName: categoryDetection.categoryName,
                totalProducts: categoryResult.totalProducts,
                totalImages: categoryResult.totalImages
              }
            };
          } else {
            console.log(`⚠️ [CATEGORY-RESPONSE] التصنيف "${categoryDetection.categoryName}" لا يحتوي على منتجات بصور`);
            // استمر للبحث العادي
          }
        } else {
          console.log(`ℹ️ [CATEGORY-CHECK] لم يتم اكتشاف category (أو ثقة منخفضة) - سيتم البحث عن منتج محدد`);
        }

        // 🆕 فحص إذا كان العميل طلب أكتر من منتج
        // دعم: "و", "and", "،", "," أو newlines أو إشارة للمنتجات السابقة
        const hasMultipleProducts = /(\s+(و|and|،|,)\s+|\n)/gi.test(customerMessage);
        const refersToMultiple = /(الاتنين|الاثنين|التنين|كلهم|كلاهما|both|all)/gi.test(customerMessage);
        
        console.log(`🔍 [SMART-RESPONSE] فحص منتجات متعددة: ${hasMultipleProducts}, إشارة لمتعدد: ${refersToMultiple}`);
        
        // إذا كان العميل يشير لمنتجات متعددة من المحادثة السابقة
        if (refersToMultiple && conversationMemory && conversationMemory.length > 0) {
          console.log(`🔍 [SMART-RESPONSE] العميل يشير لمنتجات من المحادثة السابقة...`);
          
          // استخراج أسماء المنتجات من آخر رسالة للعميل
          const recentMessages = conversationMemory.slice(-5); // آخر 5 رسائل
          const productNames = [];
          
          for (const msg of recentMessages) {
            // البحث في رسائل العميل والـ AI لاستخراج أسماء المنتجات
            const content = msg.content || msg.userMessage || '';
            if (content) {
              // البحث عن أسماء منتجات بأنماط مختلفة
              // Pattern 1: اسم بالإنجليزي (مثل: Chelsea Boot, Swan Chunky)
              const englishMatches = content.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/g);
              if (englishMatches) {
                productNames.push(...englishMatches);
              }
              
              // Pattern 2: كوتشي + اسم (مثل: كوتشي سوان شانكي)
              const kotchiMatches = content.match(/كوتشي\s+([^\n.،,؛!?]+)/gi);
              if (kotchiMatches) {
                productNames.push(...kotchiMatches);
              }
              
              // Pattern 3: البحث عن أسماء منتجات مذكورة في ردود الـ AI
              if (msg.role === 'assistant' || msg.aiResponse) {
                const aiContent = msg.aiResponse || msg.content || '';
                const productMentions = aiContent.match(/(?:عندنا|متوفر|اسمه)\s+([^\n.،,؛!?]{5,30})/gi);
                if (productMentions) {
                  productNames.push(...productMentions.map(m => m.replace(/(?:عندنا|متوفر|اسمه)\s+/gi, '')));
                }
              }
            }
          }
          
          // إزالة التكرارات وتنظيف أسماء المنتجات
          const uniqueProductNames = [...new Set(productNames.map(name => name.trim()))].filter(name => name.length > 2);
          
          if (uniqueProductNames.length >= 2) {
            console.log(`📋 [SMART-RESPONSE] تم استخراج ${uniqueProductNames.length} منتج فريد من المحادثة:`, uniqueProductNames);
            
            // البحث عن كل منتج
            const allProducts = [];
            const allImages = [];
            const foundProductIds = new Set();
            
            for (const productName of uniqueProductNames) {
              console.log(`🔍 [SMART-RESPONSE] البحث عن: "${productName}"`);
              
              // ✅ استخدم اسم المنتج مباشرة بدون كلمات زائدة لدقة أعلى
              const specificResult = await ragService.retrieveSpecificProduct(productName, intent, customerId, conversationMemory, companyId);
              
              if (specificResult && specificResult.isSpecific && specificResult.product) {
                const productId = specificResult.product.metadata?.id || specificResult.product.metadata?.name;
                
                if (foundProductIds.has(productId)) {
                  console.log(`⚠️ [SMART-RESPONSE] المنتج "${specificResult.product.metadata?.name}" مكرر - تم تخطيه`);
                  continue;
                }
                
                console.log(`✅ [SMART-RESPONSE] تم العثور على: ${specificResult.product.metadata?.name}`);
                foundProductIds.add(productId);
                allProducts.push(specificResult);
                
                if (specificResult.product.metadata?.images && specificResult.product.metadata.images.length > 0) {
                  console.log(`📸 [SMART-RESPONSE] المنتج يحتوي على ${specificResult.product.metadata.images.length} صورة`);
                  const specificImages = specificResult.product.metadata.images.map((imageUrl, index) => ({
                    type: 'image',
                    payload: {
                      url: imageUrl,
                      title: `${specificResult.product.metadata.name} - صورة ${index + 1}`
                    }
                  }));
                  
                  // في حالة المنتجات المتعددة، نرسل كل الصور بدون فلترة لون
                  console.log(`✅ [SMART-RESPONSE] تمت إضافة ${specificImages.length} صورة للمنتج (بدون فلترة - منتجات متعددة)`);
                  allImages.push(...specificImages);
                }
              }
            }
            
            if (allProducts.length > 0) {
              console.log(`✅ [SMART-RESPONSE] تم العثور على ${allProducts.length} منتج من المحادثة`);
              console.log(`📸 [SMART-RESPONSE] إجمالي الصور المجمعة: ${allImages.length}`);
              
              ragData = allProducts.map(result => ({
                type: 'product',
                content: `منتج متاح: ${result.product.metadata.name}`,
                metadata: {
                  ...result.product.metadata,
                  hasImages: true,
                  confidence: result.confidence,
                  reasoning: result.reasoning
                }
              }));
              
              console.log(`🎯 [SMART-RESPONSE] سيتم إرجاع ${allImages.length} صورة للمنتجات`);
              
              return {
                images: allImages,
                ragData: ragData,
                hasSpecificProduct: true,
                productInfo: allProducts[0],
                multipleProducts: allProducts
              };
            }
          }
        }
        
        if (hasMultipleProducts) {
          console.log(`🔍 [SMART-RESPONSE] العميل طلب منتجات متعددة - تقسيم الطلب...`);
          console.log(`📝 [SMART-RESPONSE] الرسالة الأصلية: "${customerMessage}"`);
          
          // إزالة كلمات الطلب من البداية
          let cleanMessage = customerMessage
            .replace(/^(عايز|عايزه|عاوز|عاوزه|محتاج|محتاجه|ممكن|اشوف|ابعتلي|وريني|اعرف|اشتري|ابي|مهتم|مهتمه|اريد|ارى)\s+/gi, '')
            .trim();
          
          console.log(`🧹 [SMART-RESPONSE] الرسالة بعد التنظيف: "${cleanMessage}"`);
          
          // تقسيم الرسالة لمنتجات منفصلة (دعم newlines و separators)
          const productRequests = cleanMessage
            .split(/\s+(و|and|،|,)\s+|\n/gi)
            .map(part => part ? part.trim() : '') // تأكد من أن part موجود
            .filter(part => 
              part && // تأكد من أن part موجود
              part.length > 2 && 
              !['و', 'and', '،', ','].includes(part) &&
              !part.match(/^(عايز|عايزه|اشوف|ممكن|ابعتلي|وريني|اعرف)$/i) // تخطي كلمات الطلب
            );
          
          console.log(`📋 [SMART-RESPONSE] تم تقسيم الطلب إلى ${productRequests.length} منتج:`, productRequests);
          
          // البحث عن كل منتج على حدة
          const allProducts = [];
          const allImages = [];
          const foundProductIds = new Set(); // لتتبع المنتجات المكررة
          
          for (const productRequest of productRequests) {
            const trimmedRequest = productRequest.trim();
            if (trimmedRequest.length < 3) continue; // تخطي الكلمات القصيرة جداً
            
            console.log(`🔍 [SMART-RESPONSE] البحث عن: "${trimmedRequest}"`);
            
            // ✅ استخدم اسم المنتج مباشرة بدون كلمات زائدة لدقة أعلى
            const specificResult = await ragService.retrieveSpecificProduct(trimmedRequest, intent, customerId, conversationMemory, companyId);
            
            console.log(`🔍 [SMART-RESPONSE-DEBUG] RAG Result for "${trimmedRequest}":`, {
              isSpecific: specificResult?.isSpecific,
              productName: specificResult?.product?.metadata?.name,
              productId: specificResult?.product?.metadata?.id,
              confidence: specificResult?.confidence,
              reasoning: specificResult?.reasoning
            });
            
            if (specificResult && specificResult.isSpecific && specificResult.product) {
              const productId = specificResult.product.metadata?.id || specificResult.product.metadata?.name;
              const productName = specificResult.product.metadata?.name;
              
              // تحقق من عدم تكرار المنتج
              if (foundProductIds.has(productId)) {
                console.log(`⚠️ [SMART-RESPONSE] المنتج "${productName}" مكرر - تم تخطيه`);
                continue;
              }
              
              console.log(`✅ [SMART-RESPONSE] تم العثور على: ${productName}`);
              foundProductIds.add(productId);
              allProducts.push(specificResult);
              
              // جمع الصور
              if (specificResult.product.metadata?.images && specificResult.product.metadata.images.length > 0) {
                console.log(`📸 [SMART-RESPONSE] المنتج يحتوي على ${specificResult.product.metadata.images.length} صورة`);
                const specificImages = specificResult.product.metadata.images.map((imageUrl, index) => ({
                  type: 'image',
                  payload: {
                    url: imageUrl,
                    title: `${productName} - صورة ${index + 1}`
                  }
                }));
                
                // في حالة المنتجات المتعددة، نرسل كل الصور بدون فلترة لون
                console.log(`✅ [SMART-RESPONSE] تمت إضافة ${specificImages.length} صورة للمنتج (بدون فلترة - منتجات متعددة)`);
                allImages.push(...specificImages);
              } else {
                console.log(`⚠️ [SMART-RESPONSE] المنتج لا يحتوي على صور`);
              }
            } else {
              console.log(`⚠️ [SMART-RESPONSE] لم يتم العثور على: "${trimmedRequest}" (Confidence: ${specificResult?.confidence || 0})`);
            }
          }
          
          if (allProducts.length > 0) {
            console.log(`✅ [SMART-RESPONSE] تم العثور على ${allProducts.length} منتج من ${productRequests.length}`);
            
            // إنشاء RAG data لجميع المنتجات
            ragData = allProducts.map(result => ({
              type: 'product',
              content: `منتج متاح: ${result.product.metadata.name}`,
              metadata: {
                ...result.product.metadata,
                hasImages: true,
                confidence: result.confidence,
                reasoning: result.reasoning
              }
            }));
            
            return {
              images: allImages,
              ragData: ragData,
              hasSpecificProduct: true,
              productInfo: allProducts[0], // المنتج الأول للتوافق
              multipleProducts: allProducts
            };
          }
        }

        // محاولة ذكية: المستخدم أكد باقتضاب بعد عرض صور سابقاً -> اعتمد على آخر منتج مذكور في الذاكرة
        try {
          const msgLower = (customerMessage || '').toLowerCase();
          const shortYes = ['اه', 'ايوه', 'ايوة', 'نعم', 'تمام', 'ماشي', 'اوكي', 'اه تمام'];
          const isShortAffirm = shortYes.some(y => msgLower.includes(y)) && msgLower.length <= 12;
          if (isShortAffirm && Array.isArray(conversationMemory) && conversationMemory.length > 0) {
            const recent = conversationMemory.slice(-6);
            const candidateTexts = [];
            for (const m of recent) {
              if (!m) continue;
              if (m.content && m.isFromCustomer === false) candidateTexts.push(m.content);
              if (m.aiResponse) candidateTexts.push(m.aiResponse);
              if (m.userMessage && m.isFromCustomer) candidateTexts.push(m.userMessage);
            }
            // ابحث عن أسماء منتجات محتمَلة (نفس منطق استخراج الأسماء أعلاه بشكل مختصر)
            let lastProductName = null;
            for (const text of candidateTexts.reverse()) {
              const t = (text || '').trim();
              if (!t) continue;
              const englishMatches = t.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/g);
              if (englishMatches && englishMatches.length) {
                lastProductName = englishMatches[englishMatches.length - 1];
                break;
              }
              const kotchiMatches = t.match(/كوتشي\s+([^\n.،,؛!?]{2,30})/gi);
              if (kotchiMatches && kotchiMatches.length) {
                lastProductName = kotchiMatches[kotchiMatches.length - 1].replace(/كوتشي\s+/i, '').trim();
                break;
              }
            }
            if (lastProductName && lastProductName.length >= 2) {
              // ✅ استخدم اسم المنتج مباشرة بدون كلمات زائدة لدقة أعلى
              const specificResult = await ragService.retrieveSpecificProduct(lastProductName, intent, customerId, conversationMemory, companyId);
              if (specificResult && specificResult.isSpecific && specificResult.product) {
                const productName = specificResult.product.metadata?.name;
                let specificImages = [];
                if (specificResult.product.metadata?.images && specificResult.product.metadata.images.length > 0) {
                  specificImages = specificResult.product.metadata.images.map((imageUrl, index) => ({
                    type: 'image',
                    payload: { url: imageUrl, title: `${productName} - صورة ${index + 1}` }
                  }));
                }
                const filteredImages = await this.filterImagesByColor(specificImages, customerMessage);
                return {
                  images: filteredImages,
                  ragData: [{
                    type: 'product',
                    content: `منتج متاح: ${productName}`,
                    metadata: {
                      ...specificResult.product.metadata,
                      hasImages: filteredImages.length > 0,
                      confidence: specificResult.confidence,
                      reasoning: specificResult.reasoning
                    }
                  }],
                  hasSpecificProduct: true,
                  productInfo: specificResult
                };
              }
            }
          }
        } catch (_affirmCtxErr) {
          // تجاهل والفallback للمنطق التالي
        }

        // ⚡ محاولة ذكية 2: لو طلب صور عام بدون اسم منتج → استنتج من الذاكرة
        try {
          const msgLower = (customerMessage || '').toLowerCase().trim();
          
          // ✅ أولاً: كشف الطلبات العامة الصريحة (كل المنتجات)
          const isExplicitAllProductsRequest = (
            msgLower.includes('كل المنتجات') ||
            msgLower.includes('المنتجات كلها') ||
            msgLower.includes('كل الصور') ||
            msgLower.includes('الصور كلها') ||
            msgLower.includes('كل اللي عندك') ||
            (msgLower.includes('صور') && msgLower.includes('كل')) ||
            // General: any phrase like "كل ال <category>"
            msgLower.includes('كل ال')
          );
          
          // فحص لو الرسالة طلب صور عام بدون اسم منتج صريح
          const isGenericImageRequest = (
            (msgLower.includes('صور') || msgLower.includes('صورة') || msgLower.includes('اشوف')) &&
            msgLower.length < 30 && // رسالة قصيرة
            !/([A-Z][a-zA-Z]+|كوتشي\s+\w+)/.test(customerMessage) && // مفيش اسم منتج واضح
            !isExplicitAllProductsRequest // ✅ ومش طلب صريح لكل المنتجات
          );
          
          if (isGenericImageRequest && Array.isArray(conversationMemory) && conversationMemory.length > 0) {
            console.log(`🔍 [SMART-RESPONSE] طلب صور عام بدون اسم منتج - استنتاج من السياق...`);
            const recent = conversationMemory.slice(-8); // آخر 8 رسائل للسياق الأوسع
            const candidateTexts = [];
            
            for (const m of recent) {
              if (!m) continue;
              // جمع كل المحتوى من الرسائل
              if (m.content && m.isFromCustomer === false) candidateTexts.push(m.content);
              if (m.aiResponse) candidateTexts.push(m.aiResponse);
              if (m.content && m.isFromCustomer) candidateTexts.push(m.content);
              if (m.userMessage) candidateTexts.push(m.userMessage);
            }
            
            // ابحث عن آخر منتج مذكور باستخدام AI للدقة
            let lastProductName = null;
            
            // جمع آخر 3 رسائل من المحادثة
            const recentMessages = candidateTexts.slice(0, 3).join('\n');
            
            if (recentMessages && recentMessages.length > 5) {
              console.log(`🤖 [CONTEXT-AI] استخدام AI لاستخراج آخر منتج من السياق...`);
              
              try {
                const contextPrompt = `حلل المحادثة التالية واستخرج **آخر اسم منتج** تم ذكره:

المحادثة الأخيرة:
${recentMessages}

مهمتك:
- ابحث عن **آخر منتج** تم ذكره في المحادثة
- المنتج يمكن أن يكون:
  - اسم إنجليزي (مثل: GlamBoot, Chelsea Boot, Belle Boot)
  - اسم عربي (مثل: السابوه, البوتات, الكوتشي, الهاف, البالرينا)
  - اسم مع رقم موديل (مثل: هاف 90/420, سابوه 80/091)

⚠️ قواعد مهمة:
- لو فيه أكثر من منتج، اختار **الأحدث** (آخر واحد اتذكر)
- لو مفيش أي منتج واضح، أرجع null
- **احذف "ال" التعريف من البداية** (السابوه → سابوه)
- **تأكد من الإملاء الصحيح** - لا تكرر الأحرف (ساابوه ❌ → سابوه ✅)
- **انسخ الاسم بالضبط** كما ورد في المحادثة بدون إضافات

أمثلة:
- "السابوه" → أرجع: "سابوه" (بدون ال)
- "البوتات" → أرجع: "بوتات" (بدون ال)
- "GlamBoot" → أرجع: "GlamBoot" (كما هو)

أرجع JSON فقط:
{
  "productName": "اسم المنتج" أو null,
  "confidence": رقم من 0 إلى 1
}`;

                await ragService.initializeGemini(companyId);
                const model = ragService.genAI.getGenerativeModel({ 
                  model: "gemini-2.0-flash-exp",
                  generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 200
                  }
                });
                
                const result = await model.generateContent(contextPrompt);
                const responseText = result.response.text();
                console.log(`📨 [CONTEXT-AI] رد AI: ${responseText}`);
                
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const aiResult = JSON.parse(jsonMatch[0]);
                  if (aiResult.productName && aiResult.confidence > 0.5) {
                    lastProductName = aiResult.productName;
                    console.log(`✅ [CONTEXT-AI] استخرجت المنتج من السياق: "${lastProductName}" (ثقة: ${(aiResult.confidence * 100).toFixed(0)}%)`);
                  } else {
                    console.log(`⚠️ [CONTEXT-AI] ثقة منخفضة أو لا يوجد منتج (${aiResult.confidence})`);
                  }
                }
              } catch (aiError) {
                console.error(`❌ [CONTEXT-AI] خطأ في AI:`, aiError.message);
              }
            }
            
            // Fallback: إذا AI فشل، استخدم Patterns التقليدية
            if (!lastProductName) {
              console.log(`🔍 [CONTEXT-FALLBACK] AI لم يجد منتج، استخدام patterns تقليدية...`);
              
              for (const text of candidateTexts) {
                const t = (text || '').trim();
                if (!t) continue;
                
                // Pattern 1: اسم بالإنجليزي (GlamBoot, Chelsea Boot, etc.)
                const englishMatches = t.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/g);
                if (englishMatches && englishMatches.length) {
                  lastProductName = englishMatches[englishMatches.length - 1];
                  console.log(`✅ [CONTEXT-FALLBACK] وجدت منتج إنجليزي: "${lastProductName}"`);
                  break;
                }
                
                // Pattern 2: كوتشي + اسم
                const kotchiMatches = t.match(/كوتشي\s+([^\n.،,؛!?]{2,30})/gi);
                if (kotchiMatches && kotchiMatches.length) {
                  lastProductName = kotchiMatches[kotchiMatches.length - 1].replace(/كوتشي\s+/i, '').trim();
                  console.log(`✅ [CONTEXT-FALLBACK] وجدت كوتشي: "${lastProductName}"`);
                  break;
                }
                
                // Pattern 3: أسماء منتجات عربية شائعة
                const arabicProductMatches = t.match(/(السابوه|سابوه|البوتات|بوتات|الهاف|هاف|البالرينا|بالرينا|الكوتشي)/gi);
                if (arabicProductMatches && arabicProductMatches.length) {
                  lastProductName = arabicProductMatches[arabicProductMatches.length - 1].replace(/^ال/, '');
                  console.log(`✅ [CONTEXT-FALLBACK] وجدت منتج عربي: "${lastProductName}"`);
                  break;
                }
              }
            }
            
            if (lastProductName && lastProductName.length >= 2) {
              console.log(`🎯 [SMART-RESPONSE] استنتجت المنتج من السياق: "${lastProductName}" - سأبحث عنه`);
              // ✅ استخدم اسم المنتج مباشرة بدون كلمات زائدة لدقة أعلى
              const specificResult = await ragService.retrieveSpecificProduct(lastProductName, intent, customerId, conversationMemory, companyId);
              
              if (specificResult && specificResult.isSpecific && specificResult.product) {
                const foundProductName = specificResult.product.metadata?.name;
                console.log(`✅ [SMART-RESPONSE] تم العثور على المنتج: ${foundProductName}`);
                
                // ⚡ Validation: تأكد أن المنتج الراجع يطابق المنتج المستنتج
                console.log(`🔍 [SIMILARITY-DEBUG] Comparing: "${foundProductName}" vs "${lastProductName}"`);
                
                // 🔧 دالة تنظيف متقدمة - إزالة الأرقام والرموز والأحرف المكررة
                const normalizeForComparison = (text) => {
                  return text
                    .toLowerCase()
                    .replace(/^ال/, '') // إزالة "ال" التعريف
                    .replace(/[0-9]/g, '') // إزالة الأرقام
                    .replace(/[\/\-_]/g, ' ') // تحويل الرموز لمسافات
                    .replace(/(.)\1+/g, '$1') // إزالة الأحرف المكررة
                    .replace(/\s+/g, ' ') // توحيد المسافات
                    .trim();
                };
                
                const normalizedFound = normalizeForComparison(foundProductName);
                const normalizedExpected = normalizeForComparison(lastProductName);
                
                console.log(`🔍 [SIMILARITY-DEBUG] Normalized found: "${normalizedFound}"`);
                console.log(`🔍 [SIMILARITY-DEBUG] Normalized expected: "${normalizedExpected}"`);
                
                // Advanced similarity check - content-based word matching
                let similarity = 0;
                
                // Priority 1: Exact match after normalization = 100%
                if (normalizedFound === normalizedExpected) {
                  similarity = 1;
                  console.log(`✅ [SIMILARITY-DEBUG] Exact match after normalization! similarity = 100%`);
                }
                // Priority 2: Word-level similarity (أولوية أعلى من character matching)
                else {
                  // Extract significant words (length >= 3) بعد التنظيف
                  const getWords = (str) => {
                    return normalizeForComparison(str)
                      .split(/\s+/)  // Split by spaces
                      .filter(w => w.length >= 3 && !/^\d+$/.test(w)); // استبعاد الأرقام البحتة
                  };
                  
                  const wordsFound = getWords(foundProductName);
                  const wordsExpected = getWords(lastProductName);
                  
                  console.log(`🔍 [SIMILARITY-DEBUG] Words found: [${wordsFound.join(', ')}]`);
                  console.log(`🔍 [SIMILARITY-DEBUG] Words expected: [${wordsExpected.join(', ')}]`);
                  
                  if (wordsFound.length === 0 || wordsExpected.length === 0) {
                    similarity = 0;
                    console.log(`⚠️ [SIMILARITY-DEBUG] No significant words - similarity = 0%`);
                  } else {
                    // Count matching words
                    const matchingWords = wordsExpected.filter(expectedWord =>
                      wordsFound.some(foundWord => 
                        foundWord === expectedWord || 
                        foundWord.includes(expectedWord) || 
                        expectedWord.includes(foundWord)
                      )
                    );
                    
                    console.log(`🔍 [SIMILARITY-DEBUG] Matching words: [${matchingWords.join(', ')}]`);
                    
                    // Similarity = ratio of matching words
                    similarity = matchingWords.length / Math.max(wordsExpected.length, wordsFound.length);
                    console.log(`🔍 [SIMILARITY-DEBUG] Word-based similarity: ${matchingWords.length}/${Math.max(wordsExpected.length, wordsFound.length)} = ${(similarity * 100).toFixed(1)}%`);
                  }
                }
                
                console.log(`🔍 [SMART-RESPONSE] Similarity check: "${foundProductName}" vs "${lastProductName}" = ${(similarity * 100).toFixed(1)}%`);
                
                // إذا كان التشابه أقل من 40%، تجاهل النتيجة
                // خليناها 40% عشان تسمح بالمنتجات اللي فيها كلمات إضافية (مثل: "سابوه حريمي")
                if (similarity < 0.4) {
                  console.log(`⚠️ [SMART-RESPONSE] المنتج الراجع "${foundProductName}" لا يطابق المتوقع "${lastProductName}" (similarity: ${(similarity * 100).toFixed(1)}%) - تجاهل النتيجة`);
                  // لا ترجع شيء - استمر في البحث بالطريقة العادية
                } else {
                  console.log(`✅ [SMART-RESPONSE] تم التحقق من تطابق المنتج - similarity: ${(similarity * 100).toFixed(1)}%`);
                  const productName = foundProductName;
                  let specificImages = [];
                  
                  if (specificResult.product.metadata?.images && specificResult.product.metadata.images.length > 0) {
                    specificImages = specificResult.product.metadata.images.map((imageUrl, index) => ({
                      type: 'image',
                      payload: { url: imageUrl, title: `${productName} - صورة ${index + 1}` }
                    }));
                    console.log(`📸 [SMART-RESPONSE] المنتج المستنتج يحتوي على ${specificImages.length} صورة`);
                  }
                  
                  const filteredImages = await this.filterImagesByColor(specificImages, customerMessage);
                  return {
                    images: filteredImages,
                    ragData: [{
                      type: 'product',
                      content: `منتج متاح: ${productName}`,
                      metadata: {
                        ...specificResult.product.metadata,
                        hasImages: filteredImages.length > 0,
                        confidence: specificResult.confidence,
                        reasoning: specificResult.reasoning
                      }
                    }],
                    hasSpecificProduct: true,
                    productInfo: specificResult
                  };
                }
              }
            }
          }
        } catch (_genericImageErr) {
          console.log(`⚠️ [SMART-RESPONSE] خطأ في استنتاج المنتج:`, _genericImageErr.message);
          // تجاهل والاستمرار
        }

        // ✅ كشف الطلبات العامة قبل البحث عن منتج محدد
        const msgCheck = (customerMessage || '').toLowerCase().trim();
        const isAllProductsRequest = (
          msgCheck.includes('كل المنتجات') ||
          msgCheck.includes('المنتجات كلها') ||
          msgCheck.includes('كل الصور') ||
          msgCheck.includes('الصور كلها') ||
          msgCheck.includes('كل اللي عندك') ||
          (msgCheck.includes('صور') && msgCheck.includes('كل'))
        );

        // استخدام النظام الذكي للمنتجات (منتج واحد) - لكن skip لو طلب كل المنتجات
        let specificResult = null;
        
        if (!isAllProductsRequest) {
          console.log(`🔍 [SMART-RESPONSE] البحث عن منتج واحد محدد...`);
          specificResult = await ragService.retrieveSpecificProduct(customerMessage, intent, customerId, conversationMemory, companyId);
        } else {
          console.log(`⏭️ [SMART-RESPONSE] تخطي البحث عن منتج محدد - العميل يريد كل المنتجات`);
        }
        //console.log(`📊 [SMART-RESPONSE] نتيجة البحث:`, {
        //   isSpecific: specificResult?.isSpecific,
        //   hasProduct: !!specificResult?.product,
        //   confidence: specificResult?.confidence,
        //   productName: specificResult?.product?.metadata?.name
        // });

        if (specificResult && specificResult.isSpecific && specificResult.product) {
          console.log(`✅ [SMART-RESPONSE] تم العثور على منتج واحد: ${specificResult.product.metadata?.name} (${(specificResult.confidence * 100).toFixed(1)}%)`);

          // إنشاء الصور من المنتج المحدد
          if (specificResult.product.metadata?.images) {
            console.log(`📸 [SMART-RESPONSE] المنتج يحتوي على ${specificResult.product.metadata.images.length} صورة`);

            const specificImages = specificResult.product.metadata.images.map((imageUrl, index) => ({
              type: 'image',
              payload: {
                url: imageUrl,
                title: `${specificResult.product.metadata.name} - صورة ${index + 1}`
              }
            }));

            //console.log(`🔧 [SMART-RESPONSE] تم إنشاء ${specificImages.length} صورة، بدء الفلترة...`);

            // فلترة الصور بناءً على اللون
            const filteredImages = await this.filterImagesByColor(specificImages, customerMessage);
            //console.log(`✅ [SMART-RESPONSE] تم فلترة الصور: ${filteredImages.length} من ${specificImages.length}`);

            productImages.push(...filteredImages);
          } else {
            //console.log(`⚠️ [SMART-RESPONSE] المنتج المحدد لا يحتوي على صور`);
          }

          // إنشاء RAG data للرد النصي
          ragData = [{
            type: 'product',
            content: `منتج متاح: ${specificResult.product.metadata.name}`,
            metadata: {
              ...specificResult.product.metadata,
              hasImages: productImages.length > 0,
              confidence: specificResult.confidence,
              reasoning: specificResult.reasoning
            }
          }];

          //console.log(`\n🎉 [SMART-RESPONSE] ===== إرجاع النتيجة من المنتج المحدد =====`);
          //console.log(`📸 [SMART-RESPONSE] عدد الصور: ${productImages.length}`);
          productImages.forEach((img, index) => {
            //console.log(`   📸 ${index + 1}. ${img.payload?.title}`);
          });

          return {
            images: productImages,
            ragData: ragData,
            hasSpecificProduct: true,
            productInfo: specificResult
          };
        } else {
          //console.log(`⚠️ [SMART-RESPONSE] No specific product found, searching in general RAG data...`);

          // البحث في RAG data العامة عن منتجات بصور
          ragData = await ragService.retrieveRelevantData(customerMessage, intent, customerId, companyId);
          //console.log(`🔧 [SMART-RESPONSE] تمرير Company ID للاستخراج: ${companyId}`);
          productImages = await this.extractImagesFromRAGData(ragData, customerMessage, companyId);

          if (productImages.length > 0) {
            //console.log(`📸 [SMART-RESPONSE] Found ${productImages.length} images from general RAG data`);
            return {
              images: productImages,
              ragData: ragData,
              hasSpecificProduct: false,
              productInfo: null
            };
          } else {
            //console.log(`⚠️ [SMART-RESPONSE] No images found in RAG data`);

            // لا نرسل صور افتراضية أو احتياطية
            // بدلاً من ذلك، نضيف رسالة توضيحية في RAG data
            ragData.push({
              type: 'system_message',
              content: 'العميل طلب صور لكن لا توجد صور متاحة حالياً للمنتجات المطلوبة',
              metadata: {
                customerRequestedImages: true,
                noImagesAvailable: true,
                searchedProducts: true
              }
            });

            //console.log(`📝 [SMART-RESPONSE] Added explanation message - no images available`);
          }
        }
      } else {
        // العميل لا يطلب صور - رد نصي فقط
        //console.log(`📝 [SMART-RESPONSE] Customer does not want images, providing text-only response`);
        ragData = await ragService.retrieveRelevantData(customerMessage, intent, customerId, companyId);

        // لا نرسل صور إلا إذا طلبها العميل صراحة
        //console.log(`✅ [SMART-RESPONSE] Text-only response prepared with ${ragData.length} RAG items`);
      }

      // النتيجة النهائية: رد نصي فقط بدون صور
      //console.log(`📝 [SMART-RESPONSE] Returning text-only response with ${ragData.length} RAG items`);
      return {
        images: [],
        ragData: ragData,
        hasSpecificProduct: false,
        productInfo: null
      };

    } catch (error) {
      console.error(`❌ [SMART-RESPONSE] Error in unified response:`, error);

      // Fallback آمن
      try {
        const ragData = await this.ragService.retrieveRelevantData(customerMessage, intent, customerId, companyId);
        return {
          images: [],
          ragData: ragData,
          hasSpecificProduct: false,
          productInfo: null
        };
      } catch (fallbackError) {
        console.error(`❌ [SMART-RESPONSE] Fallback also failed:`, fallbackError);
        return {
          images: [],
          ragData: [],
          hasSpecificProduct: false,
          productInfo: null
        };
      }
    }
  }

  // 🧠 استخراج الصور من RAG data بذكاء
  async extractImagesFromRAGData(ragData, customerMessage, companyId ) {
    try {
      //console.log(`🧠 [SMART-IMAGE-EXTRACT] ===== بدء استخراج الصور الذكي =====`);
      //console.log(`📊 [SMART-IMAGE-EXTRACT] عدد عناصر RAG: ${ragData.length}`);
      //console.log(`📝 [SMART-IMAGE-EXTRACT] رسالة العميل: "${customerMessage}"`);
      //console.log(`🏢 [SMART-IMAGE-EXTRACT] معرف الشركة: ${companyId}`);

      if (ragData.length === 0) {
        //console.log(`⚠️ [SMART-IMAGE-EXTRACT] لا توجد بيانات RAG متاحة`);
        return [];
      }

      // ✅ كشف طلب "كل المنتجات" أو عدد محدد من المنتجات (مثلاً: منتجين/اتنين/٣ ...)
      const msgLc = (customerMessage || '').toLowerCase();
      const isAllProductsRequest = (
        msgLc.includes('كل المنتجات') ||
        msgLc.includes('المنتجات كلها') ||
        msgLc.includes('كل الصور') ||
        msgLc.includes('الصور كلها') ||
        (msgLc.includes('صور') && msgLc.includes('كل')) ||
        // General: any phrase like "كل ال <category>"
        msgLc.includes('كل ال')
      );

      // عدد المنتجات المطلوب إذا ذُكر رقم صراحة
      let requestedCount = 0;
      const numberPatterns = [
        { value: 2, words: ['منتجين','اتنين','اثنين','2','٢'] },
        { value: 3, words: ['ثلاث','ثلاثة','تلاتة','تلاته','3','٣'] },
        { value: 4, words: ['اربعه','أربعة','اربعة','4','٤'] },
        { value: 5, words: ['خمسه','خمسة','5','٥'] }
      ];
      for (const pat of numberPatterns) {
        if (pat.words.some(w => msgLc.includes(w))) { requestedCount = pat.value; break; }
      }

      if (isAllProductsRequest || requestedCount > 1) {
        const productItems = ragData.filter(item => item.type === 'product' && item.metadata);
        if (productItems.length === 0) {
          return [];
        }

        // Helper: بناء صور لمنتج واحد (متغيرات أولاً ثم العامة) + Fallback DB
        const buildImagesForProduct = async (prodItem) => {
          const out = [];
          if (prodItem.metadata.variants && prodItem.metadata.variants.length > 0) {
            for (const variant of prodItem.metadata.variants) {
              if (variant.images && variant.images.length > 0) {
                // أخذ أول صورة فقط من كل variant
                const firstVariantImage = variant.images[0];
                out.push({
                  type: 'image',
                  payload: {
                    url: firstVariantImage,
                    title: `${prodItem.metadata.name || 'منتج'} - اللون ${variant.name}`,
                    variantName: variant.name,
                    variantType: variant.type
                  }
                });
              }
            }
          }
          if (out.length === 0) {
            const general = prodItem.metadata.images || [];
            // أخذ أول صورة فقط من الصور العامة
            if (general.length > 0) {
              const firstGeneralImage = general[0];
              out.push({
                type: 'image',
                payload: {
                  url: firstGeneralImage,
                  title: `${prodItem.metadata.name || 'منتج'}`
                }
              });
            }
          }
          // Fallback: لو مفيش صور في RAG metadata، حاول تجيب من قاعدة البيانات
          if (out.length === 0 && prodItem.metadata?.id) {
            try {
              const dbImages = await this.getProductImagesFromDB(prodItem.metadata.id);
              if (Array.isArray(dbImages) && dbImages.length > 0) {
                out.push(...dbImages);
              }
            } catch (e) {
              // ignore DB fallback errors
            }
          }
          return out;
        };

        const selectedItems = (requestedCount > 1 && !isAllProductsRequest)
          ? productItems.slice(0, requestedCount)
          : productItems;

        let allImages = [];
        for (const item of selectedItems) {
          const imgs = await buildImagesForProduct(item);
          allImages.push(...imgs);
        }

        if (allImages.length === 0) {
          return [];
        }

        // فلترة حسب اللون إن وُجد
        const filteredAll = await this.filterImagesByColor(allImages, customerMessage);
        return filteredAll;
      }

      // استخدام AI لتحديد أفضل منتج مطابق للطلب
      const productAnalysisPrompt = `
أنت خبير في مطابقة طلبات العملاء مع المنتجات المتاحة.

طلب العميل: "${customerMessage}"

المنتجات المتاحة:
${ragData.filter(item => item.type === 'product' && item.metadata)
  .map((item, index) => `${index + 1}. ${item.metadata.name || 'منتج'} - ${item.content || 'لا يوجد وصف'}`)
  .join('\n')}

حدد أفضل منتج يطابق طلب العميل:
- إذا كان هناك منتج مطابق بوضوح، اذكر رقمه
- إذا لم يكن هناك مطابقة واضحة، قل "لا يوجد"

الرد:`;

      //console.log(`🤖 [SMART-IMAGE-EXTRACT] إرسال طلب للذكاء الاصطناعي لاختيار المنتج...`);
      //console.log(`🏢 [SMART-IMAGE-EXTRACT] Company ID المرسل: ${companyId}`);
      //console.log(`🔍 [SMART-IMAGE-EXTRACT] معاملات generateAIResponse:`, {
      //   hasPrompt: !!productAnalysisPrompt,
      //   promptLength: productAnalysisPrompt.length,
      //   companyId: companyId
      // });

      const aiResponse = await this.generateAIResponse(productAnalysisPrompt, [], false, null, companyId);
      //console.log(`📥 [SMART-IMAGE-EXTRACT] رد الذكاء الاصطناعي: "${aiResponse}"`);
      const responseText = aiResponse.trim().toLowerCase();

      let selectedProduct = null;

      // البحث عن رقم المنتج في الرد
      const numberMatch = responseText.match(/(\d+)/);
      if (numberMatch && !responseText.includes('لا يوجد')) {
        const productIndex = parseInt(numberMatch[1]) - 1;
        const productItems = ragData.filter(item => item.type === 'product' && item.metadata);

        if (productIndex >= 0 && productIndex < productItems.length) {
          selectedProduct = productItems[productIndex];
          //console.log(`🎯 [SMART-IMAGE-EXTRACT] AI selected product: ${selectedProduct.metadata.name || 'منتج'}`);
        }
      }

      // إذا لم يجد AI منتج مطابق، استخدم أول منتج بصور
      if (!selectedProduct) {
        //console.log(`🔍 [SMART-IMAGE-EXTRACT] No specific match, looking for first product with images...`);
        selectedProduct = ragData.find(item =>
          item.type === 'product' &&
          item.metadata &&
          (item.metadata.hasValidImages || (item.metadata.images?.length > 0))
        );
      }

      if (!selectedProduct) {
        //console.log(`⚠️ [SMART-IMAGE-EXTRACT] No products with images found`);
        return [];
      }

      // استخراج الصور من المنتج المختار
      let productImages = [];

      // أولاً: فحص صور المتغيرات (أولوية للألوان المحددة)
      if (selectedProduct.metadata.variants && selectedProduct.metadata.variants.length > 0) {
        //console.log(`🎨 [SMART-IMAGE-EXTRACT] Checking ${selectedProduct.metadata.variants.length} variants for images...`);

        for (const variant of selectedProduct.metadata.variants) {
          if (variant.images && variant.images.length > 0) {
            //console.log(`📸 [SMART-IMAGE-EXTRACT] Found ${variant.images.length} images for variant: ${variant.name} - taking first one only`);

            // أخذ أول صورة فقط من كل variant
            const firstVariantImage = variant.images[0];
            productImages.push({
              type: 'image',
              payload: {
                url: firstVariantImage,
                title: `${selectedProduct.metadata.name || 'منتج'} - اللون ${variant.name}`,
                variantName: variant.name,
                variantType: variant.type
              }
            });
          }
        }
      }

      // ثانياً: إذا لم نجد صور في المتغيرات، استخدم صور المنتج العامة
      if (productImages.length === 0) {
        const hasValidImages = selectedProduct.metadata.hasValidImages ?? (selectedProduct.metadata.images?.length > 0);
        const validImages = selectedProduct.metadata.images || [];

        if (hasValidImages && validImages.length > 0) {
          //console.log(`📸 [SMART-IMAGE-EXTRACT] Found ${validImages.length} general product images`);

          productImages = validImages.map((imageUrl, index) => ({ // ✅ إرجاع كل الصور
            type: 'image',
            payload: {
              url: imageUrl,
              title: `${selectedProduct.metadata.name || 'منتج'} - صورة ${index + 1}`
            }
          }));
        }
      }

      if (productImages.length === 0) {
        //console.log(`⚠️ [SMART-IMAGE-EXTRACT] No images found in variants or general product`);
        return [];
      }

      //console.log(`📸 [SMART-IMAGE-EXTRACT] Total images found: ${productImages.length}`);

      // فلترة الصور بناءً على اللون إذا طلب العميل لون محدد
      const filteredImages = await this.filterImagesByColor(productImages, customerMessage);

      //console.log(`✅ [SMART-IMAGE-EXTRACT] Returning ${filteredImages.length} relevant images`);
      return filteredImages;

    } catch (error) {
      console.error(`❌ [SMART-IMAGE-EXTRACT] Error in intelligent image extraction:`, error);
      //console.log(`🔍 [SMART-IMAGE-EXTRACT] Error details:`, {
      //   message: error.message,
      //   companyId: companyId,
      //   hasRagData: !!ragData,
      //   ragDataLength: ragData?.length || 0
      // });

      // في حالة الخطأ، نحاول إرجاع صور بديلة بسيطة
      try {
        //console.log(`🔄 [SMART-IMAGE-EXTRACT] Attempting fallback image extraction...`);
        const fallbackImages = ragData?.filter(item =>
          item.type === 'product' &&
          item.metadata?.images?.length > 0
        ).flatMap(item => // ✅ إرجاع كل المنتجات والصور
          item.metadata.images.map(imageUrl => ({
            type: 'image',
            payload: {
              url: imageUrl,
              title: item.metadata.name || 'منتج'
            }
          }))
        ) || [];

        //console.log(`🔄 [SMART-IMAGE-EXTRACT] Fallback returned ${fallbackImages.length} images`);
        return fallbackImages;
      } catch (fallbackError) {
        console.error(`❌ [SMART-IMAGE-EXTRACT] Fallback also failed:`, fallbackError);
        return [];
      }
    }
  }

  // ❌ معطل - لا نستخدم صور احتياطية بعد الآن
  async getFallbackProductImages(customerMessage, intent) {
    //console.log(`⚠️ [FALLBACK-IMAGES] Fallback images disabled - only send images when customer explicitly requests them`);
    return [];
  }

  // فلترة الصور بناءً على اللون المطلوب
  async filterImagesByColor(images, customerMessage) {
    try {
      //console.log(`🎨 [COLOR-FILTER] ===== بدء فلترة الصور =====`);
      //console.log(`📝 [COLOR-FILTER] رسالة العميل: "${customerMessage}"`);
      //console.log(`📸 [COLOR-FILTER] عدد الصور المدخلة: ${images.length}`);

      // طباعة تفاصيل الصور المدخلة
      images.forEach((img, index) => {
        //console.log(`📸 [COLOR-FILTER] صورة ${index + 1}:`, {
        //   title: img.payload?.title || 'لا يوجد عنوان',
        //   variantName: img.payload?.variantName || 'لا يوجد متغير',
        //   url: img.payload?.url?.substring(0, 50) + '...' || 'لا يوجد رابط'
        // });
      });

      // كشف الألوان المطلوبة (محدث ليشمل الألف واللام)
      const colorKeywords = {
        'ابيض': ['أبيض', 'ابيض', 'الابيض', 'الأبيض', 'white'],
        'اسود': ['أسود', 'اسود', 'الاسود', 'الأسود', 'black'],
        'احمر': ['أحمر', 'احمر', 'الاحمر', 'الأحمر', 'red'],
        'ازرق': ['أزرق', 'ازرق', 'الازرق', 'الأزرق', 'blue'],
        'اخضر': ['أخضر', 'اخضر', 'الاخضر', 'الأخضر', 'green'],
        'اصفر': ['أصفر', 'اصفر', 'الاصفر', 'الأصفر', 'yellow'],
        'بني': ['بني', 'البني', 'brown'],
        'رمادي': ['رمادي', 'الرمادي', 'gray', 'grey'],
        'بيج': ['بيج', 'البيج', 'beige']
      };

      const normalizedMessage = customerMessage.toLowerCase();
      //console.log(`🔤 [COLOR-FILTER] الرسالة بعد التطبيع: "${normalizedMessage}"`);

      let requestedColor = null;

      // البحث عن اللون المطلوب
      //console.log(`🔍 [COLOR-FILTER] البحث عن الألوان في الرسالة...`);
      for (const [color, variants] of Object.entries(colorKeywords)) {
        //console.log(`🔍 [COLOR-FILTER] فحص اللون: ${color} - الكلمات: [${variants.join(', ')}]`);

        const found = variants.some(variant => {
          const includes = normalizedMessage.includes(variant.toLowerCase());
          //console.log(`   - فحص "${variant}": ${includes}`);
          return includes;
        });

        if (found) {
          requestedColor = color;
          //console.log(`✅ [COLOR-FILTER] تم اكتشاف طلب اللون: ${color}`);
          break;
        }
      }

      // إذا لم يتم طلب لون محدد، أرجع جميع الصور
      if (!requestedColor) {
        //console.log(`⚠️ [COLOR-FILTER] لم يتم طلب لون محدد، إرجاع جميع الصور (${images.length})`);
        return images;
      }

      //console.log(`🎯 [COLOR-FILTER] اللون المطلوب: ${requestedColor}`);
      //console.log(`🔍 [COLOR-FILTER] بدء فلترة الصور بناءً على اللون...`);

      // 🔍 البحث عن صور تحتوي على اللون المطلوب
      let filteredImages = images.filter((image, index) => {
        //console.log(`\n🔍 [COLOR-FILTER] فحص الصورة ${index + 1}:`);

        const title = image.payload.title.toLowerCase();
        const url = image.payload.url.toLowerCase();
        const variantName = image.payload.variantName?.toLowerCase() || '';

        //console.log(`   📝 العنوان: "${title}"`);
        //console.log(`   🔗 الرابط: "${url.substring(0, 50)}..."`);
        //console.log(`   🎨 اسم المتغير: "${variantName}"`);

        // البحث عن اللون في العنوان، الرابط، أو اسم المتغير
        const colorVariants = colorKeywords[requestedColor];
        //console.log(`   🔍 البحث عن: [${colorVariants.join(', ')}]`);

        let matched = false;
        const matchResults = [];

        const foundMatch = colorVariants.some(variant => {
          const variantLower = variant.toLowerCase();
          const titleMatch = title.includes(variantLower);
          const urlMatch = url.includes(variantLower);
          const variantMatch = variantName.includes(variantLower) || variantName === variantLower;

          //console.log(`     - فحص "${variant}": العنوان=${titleMatch}, الرابط=${urlMatch}, المتغير=${variantMatch}`);

          if (titleMatch || urlMatch || variantMatch) {
            matched = true;
            matchResults.push(`${variant} (${titleMatch ? 'عنوان' : ''}${urlMatch ? 'رابط' : ''}${variantMatch ? 'متغير' : ''})`);
          }

          return titleMatch || urlMatch || variantMatch;
        });

        //console.log(`   ${matched ? '✅' : '❌'} النتيجة: ${matched ? 'مطابق' : 'غير مطابق'}`);
        if (matched) {
          //console.log(`   🎯 المطابقات: ${matchResults.join(', ')}`);
        }

        return foundMatch;
      });

      //console.log(`\n📊 [COLOR-FILTER] نتائج الفلترة الأولية:`);
      //console.log(`✅ [COLOR-FILTER] تم العثور على ${filteredImages.length} صورة مطابقة للون: ${requestedColor}`);

      filteredImages.forEach((img, index) => {
        //console.log(`   📸 ${index + 1}. ${img.payload?.title} (${img.payload?.variantName})`);
      });

      // إذا لم نجد صور بالون المطلوب، نبحث في قاعدة البيانات
      if (filteredImages.length === 0) {
        //console.log(`\n🔍 [COLOR-FILTER] لم يتم العثور على صور بالون ${requestedColor} في العناوين/الروابط`);
        //console.log(`🔍 [COLOR-FILTER] البحث في قاعدة البيانات...`);

        // محاولة البحث في قاعدة البيانات عن منتجات بالون المطلوب
        filteredImages = await this.searchImagesByColorInDatabase(requestedColor, images);

        //console.log(`📊 [COLOR-FILTER] نتائج البحث في قاعدة البيانات: ${filteredImages.length} صورة`);
      }

      // إذا لم نجد أي صور بالون المطلوب، نرجع رسالة توضيحية
      if (filteredImages.length === 0) {
        //console.log(`\n❌ [COLOR-FILTER] لم يتم العثور على أي صور للون: ${requestedColor}`);
        //console.log(`🤐 [SILENT-MODE] النظام الصامت - لن يتم إرسال رسالة خطأ للعميل`);
        //console.log(`🎨 [COLOR-FILTER] ===== انتهاء الفلترة - نتيجة فارغة =====`);
        return []; // إرجاع مصفوفة فارغة بدلاً من رسالة خطأ
      }

      // تحديث عناوين الصور المفلترة
      //console.log(`\n🔧 [COLOR-FILTER] تحديث عناوين الصور المفلترة...`);
      filteredImages.forEach((image, index) => {
        if (image.payload && image.payload.title) {
          const originalTitle = image.payload.title;
          // إضافة اللون للعنوان إذا لم يكن موجود
          if (!image.payload.title.toLowerCase().includes(requestedColor)) {
            image.payload.title += ` - اللون ${requestedColor}`;
            //console.log(`   📝 تحديث العنوان ${index + 1}: "${originalTitle}" → "${image.payload.title}"`);
          } else {
            //console.log(`   ✅ العنوان ${index + 1} يحتوي على اللون بالفعل: "${originalTitle}"`);
          }
        }
      });

      //console.log(`\n🎉 [COLOR-FILTER] ===== انتهاء الفلترة بنجاح =====`);
      //console.log(`✅ [COLOR-FILTER] النتيجة النهائية: ${filteredImages.length} صورة للون ${requestedColor}`);

      filteredImages.forEach((img, index) => {
        //console.log(`   📸 ${index + 1}. ${img.payload?.title}`);
        //console.log(`      🔗 ${img.payload?.url?.substring(0, 60)}...`);
      });

      return filteredImages;

    } catch (error) {
      console.error('❌ [COLOR-FILTER] Error filtering images by color:', error);
      return images; // في حالة الخطأ، أرجع جميع الصور
    }
  }

  /**
   * 🔍 البحث عن صور بلون محدد في قاعدة البيانات
   */
  async searchImagesByColorInDatabase(requestedColor, fallbackImages) {
    try {
      //console.log(`\n🔍 [DB-COLOR-SEARCH] ===== بدء البحث في قاعدة البيانات =====`);
      //console.log(`🎨 [DB-COLOR-SEARCH] البحث عن منتجات باللون: ${requestedColor}`);
      //console.log(`📦 [DB-COLOR-SEARCH] عدد الصور الاحتياطية: ${fallbackImages.length}`);

      // البحث في قاعدة البيانات عن منتجات بالون المطلوب
      const colorVariants = {
        'ابيض': ['أبيض', 'ابيض', 'الابيض', 'الأبيض', 'white', 'White'],
        'اسود': ['أسود', 'اسود', 'الاسود', 'الأسود', 'black', 'Black'],
        'احمر': ['أحمر', 'احمر', 'الاحمر', 'الأحمر', 'red', 'Red'],
        'ازرق': ['أزرق', 'ازرق', 'الازرق', 'الأزرق', 'blue', 'Blue'],
        'اخضر': ['أخضر', 'اخضر', 'الاخضر', 'الأخضر', 'green', 'Green'],
        'اصفر': ['أصفر', 'اصفر', 'الاصفر', 'الأصفر', 'yellow', 'Yellow'],
        'بني': ['بني', 'البني', 'brown', 'Brown'],
        'رمادي': ['رمادي', 'الرمادي', 'gray', 'grey', 'Gray', 'Grey'],
        'بيج': ['بيج', 'البيج', 'beige', 'Beige']
      };

      const searchTerms = colorVariants[requestedColor] || [requestedColor];

      // البحث في جدول المنتجات والمتغيرات
      const products = await this.getSharedPrismaClient().product.findMany({
        where: {
          OR: [
            { name: { contains: searchTerms[0] } },
            { name: { contains: searchTerms[1] } },
            { description: { contains: searchTerms[0] } },
            { description: { contains: searchTerms[1] } },
            // البحث في المتغيرات
            {
              variants: {
                some: {
                  type: 'color',
                  name: { in: searchTerms },
                  isActive: true
                }
              }
            }
          ],
          isActive: true
        },
        include: {
          variants: {
            where: {
              type: 'color',
              name: { in: searchTerms },
              isActive: true
            }
          }
        },
        take: 3
      });

      const colorImages = [];

      for (const product of products) {
        // فحص المتغيرات أولاً (أولوية للألوان المحددة) - أخذ أول صورة فقط
        if (product.variants && product.variants.length > 0) {
          for (const variant of product.variants) {
            if (variant.images) {
              try {
                const variantImages = JSON.parse(variant.images);
                if (Array.isArray(variantImages) && variantImages.length > 0) {
                  // أخذ أول صورة فقط من كل variant
                  const firstVariantImage = variantImages[0];
                  colorImages.push({
                    type: 'image',
                    payload: {
                      url: firstVariantImage,
                      title: `${product.name} - اللون ${variant.name}`
                    }
                  });
                }
              } catch (parseError) {
                //console.log(`⚠️ [DB-COLOR-SEARCH] Failed to parse variant images for ${product.name}`);
              }
            }
          }
        }

        // إذا لم نجد صور في المتغيرات، فحص صور المنتج العامة
        if (colorImages.length === 0) {
          if (product.images) {
            try {
              const parsedImages = JSON.parse(product.images);
              if (Array.isArray(parsedImages) && parsedImages.length > 0) {
                // أخذ أول صورة فقط من الصور العامة
                const firstGeneralImage = parsedImages[0];
                colorImages.push({
                  type: 'image',
                  payload: {
                    url: firstGeneralImage,
                    title: `${product.name} - اللون ${requestedColor}`
                  }
                });
              }
            } catch (parseError) {
              //console.log(`⚠️ [DB-COLOR-SEARCH] Failed to parse images for ${product.name}`);
            }
          }

          // فحص صورة واحدة
          if (product.imageUrl && colorImages.length < 3) {
            colorImages.push({
              type: 'image',
              payload: {
                url: product.imageUrl,
                title: `${product.name} - اللون ${requestedColor}`
              }
            });
          }
        }
      }

      if (colorImages.length > 0) {
        //console.log(`✅ [DB-COLOR-SEARCH] Found ${colorImages.length} images for color ${requestedColor}`);
        return colorImages.slice(0, 3); // أقصى 3 صور
      }

      //console.log(`❌ [DB-COLOR-SEARCH] No products found for color ${requestedColor}`);
      return [];

    } catch (error) {
      console.error('❌ [DB-COLOR-SEARCH] Database search failed:', error);
      return [];
    }
  }

  /**
   * Update AI settings in database
   */
  async updateSettings(settings, companyId) {
    try {
      //console.log('🔧 [AIAgent] Updating AI settings:', settings);

      // Require companyId for security
      if (!companyId) {
        throw new Error('Company ID is required for security');
      }

      const company = await this.getSharedPrismaClient().company.findUnique({ where: { id: companyId } });
      if (!company) {
        throw new Error(`Company ${companyId} not found`);
      }

      // Check if AI settings exist
      let aiSettings = await this.getSharedPrismaClient().aiSettings.findUnique({
        where: { companyId: company.id }
      });

      if (aiSettings) {
        // Update existing settings
        aiSettings = await this.getSharedPrismaClient().aiSettings.update({
          where: { companyId: company.id },
          data: {
            autoReplyEnabled: settings.isEnabled !== undefined ? settings.isEnabled : aiSettings.autoReplyEnabled,
            workingHours: settings.workingHours ? JSON.stringify(settings.workingHours) : aiSettings.workingHours,
            workingHoursEnabled: settings.workingHoursEnabled !== undefined ? settings.workingHoursEnabled : aiSettings.workingHoursEnabled,
            maxRepliesPerCustomer: settings.maxRepliesPerCustomer !== undefined ? settings.maxRepliesPerCustomer : aiSettings.maxRepliesPerCustomer,
            multimodalEnabled: settings.multimodalEnabled !== undefined ? settings.multimodalEnabled : aiSettings.multimodalEnabled,
            ragEnabled: settings.ragEnabled !== undefined ? settings.ragEnabled : aiSettings.ragEnabled,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new settings
        aiSettings = await this.getSharedPrismaClient().aiSettings.create({
          data: {
            companyId: company.id,
            autoReplyEnabled: settings.isEnabled || false,
            workingHours: settings.workingHours ? JSON.stringify(settings.workingHours) : JSON.stringify({ start: '09:00', end: '18:00' }),
            workingHoursEnabled: settings.workingHoursEnabled || false,
            maxRepliesPerCustomer: settings.maxRepliesPerCustomer || 5,
            multimodalEnabled: settings.multimodalEnabled !== undefined ? settings.multimodalEnabled : true,
            ragEnabled: settings.ragEnabled !== undefined ? settings.ragEnabled : true
          }
        });
      }

      //console.log('✅ [AIAgent] AI settings updated successfully');
      return aiSettings;

    } catch (error) {
      console.error('❌ [AIAgent] Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Get AI settings from database
   * ⚠️ DEPRECATED: This function was duplicated. Redirecting to the correct implementation at line 5760.
   */
  async getSettings(companyId) {
    // ⚠️ CRITICAL: This is a duplicate function! Redirecting to the correct implementation.
    console.warn('⚠️ [DEPRECATED] Duplicate getSettings() detected. Using correct implementation.');
    // Call the correct implementation by using the one defined earlier in the class
    // Note: We can't call it directly due to hoisting, so we'll use the first definition
    // This is a workaround - the duplicate should be removed
    try {
      if (!companyId) {
        console.error('❌ [SECURITY] companyId is required for getSettings');
        return {
          isEnabled: false,
          autoReplyEnabled: false,
          workingHours: { start: '09:00', end: '18:00' },
          workingHoursEnabled: false,
          maxRepliesPerCustomer: 5,
          multimodalEnabled: true,
          ragEnabled: true,
          learningEnabled: true,
          replyMode: 'all'
        };
      }

      const company = await this.getSharedPrismaClient().company.findUnique({ where: { id: companyId } });
      if (!company) {
        return {
          isEnabled: false,
          autoReplyEnabled: false,
          workingHours: { start: '09:00', end: '18:00' },
          workingHoursEnabled: false,
          maxRepliesPerCustomer: 5,
          multimodalEnabled: true,
          ragEnabled: true,
          learningEnabled: true,
          replyMode: 'all'
        };
      }

      const aiSettings = await this.getSharedPrismaClient().aiSettings.findFirst({
        where: { companyId: company.id },
        select: {
          id: true,
          companyId: true,
          replyMode: true, // ✅ CRITICAL: Include replyMode
          autoReplyEnabled: true,
          maxRepliesPerCustomer: true,
          multimodalEnabled: true,
          ragEnabled: true,
          workingHours: true,
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
          enableLowQualityAlerts: true
        }
      });

      console.log(`🔍 [DUPLICATE-getSettings] Raw replyMode from DB: "${aiSettings?.replyMode}" (type: ${typeof aiSettings?.replyMode})`);

      if (!aiSettings) {
        return {
          isEnabled: false,
          autoReplyEnabled: false,
          workingHours: { start: '09:00', end: '18:00' },
          workingHoursEnabled: false,
          maxRepliesPerCustomer: 5,
          multimodalEnabled: true,
          ragEnabled: true,
          learningEnabled: true,
          replyMode: 'all'
        };
      }

      let workingHours = { start: '09:00', end: '18:00' };
      try {
        if (aiSettings.workingHours) {
          workingHours = JSON.parse(aiSettings.workingHours);
        }
      } catch (e) {
        // Use defaults
      }

      const settings = {
        isEnabled: aiSettings.autoReplyEnabled || false,
        autoReplyEnabled: aiSettings.autoReplyEnabled || false,
        workingHours,
        workingHoursEnabled: false,
        maxRepliesPerCustomer: aiSettings.maxRepliesPerCustomer || 5,
        multimodalEnabled: aiSettings.multimodalEnabled || true,
        ragEnabled: aiSettings.ragEnabled || true,
        learningEnabled: true,
        replyMode: aiSettings.replyMode ?? 'all', // ✅ FIXED: Use nullish coalescing
        maxMessagesPerConversation: aiSettings.maxMessagesPerConversation || 50,
        memoryRetentionDays: aiSettings.memoryRetentionDays || 30,
        aiTemperature: aiSettings.aiTemperature ?? 0.7,
        aiTopP: aiSettings.aiTopP ?? 0.9,
        aiTopK: aiSettings.aiTopK ?? 40,
        aiMaxTokens: aiSettings.aiMaxTokens ?? DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS,
        aiResponseStyle: aiSettings.aiResponseStyle || 'balanced',
        enableDiversityCheck: aiSettings.enableDiversityCheck !== false,
        enableToneAdaptation: aiSettings.enableToneAdaptation !== false,
        enableEmotionalResponse: aiSettings.enableEmotionalResponse !== false,
        enableSmartSuggestions: aiSettings.enableSmartSuggestions || false,
        enableLongTermMemory: aiSettings.enableLongTermMemory || false,
        enablePatternApplication: aiSettings.enablePatternApplication !== false,
        patternPriority: aiSettings.patternPriority || 'balanced',
        minQualityScore: aiSettings.minQualityScore ?? 70,
        enableLowQualityAlerts: aiSettings.enableLowQualityAlerts !== false
      };

      console.log(`📤 [DUPLICATE-getSettings] Returning settings with replyMode: "${settings.replyMode}"`);
      return settings;

    } catch (error) {
      console.error('❌ [aiAgentService] Error loading settings:', error);
      return {
        isEnabled: false,
        autoReplyEnabled: false,
        workingHours: { start: '09:00', end: '18:00' },
        workingHoursEnabled: false,
        maxRepliesPerCustomer: 5,
        multimodalEnabled: true,
        ragEnabled: true,
        learningEnabled: true,
        replyMode: 'all'
      };
    }
  }

  /**
   * Get default AI settings
   * ⚠️ DEPRECATED: This function is not needed anymore
   */
  getDefaultSettings() {
    return {
      isEnabled: false,
      workingHours: { start: '09:00', end: '18:00' },
      workingHoursEnabled: false,
      maxRepliesPerCustomer: 5,
      multimodalEnabled: true,
      ragEnabled: true,
      learningEnabled: true
    };
  }

  /**
   * بناء prompt لتأكيد الطلب بشكل طبيعي
   */
  async buildOrderConfirmationPrompt(customerMessage, customerData, companyPrompts, order, orderDetails, conversationMemory, companyId) {
    try {
      console.log('📝 [ORDER-CONFIRMATION] بناء prompt لتأكيد الطلب:', order.orderNumber);
      
      let prompt = '';
      
      // إضافة personality prompt
      if (companyPrompts.personalityPrompt) {
        prompt += `${companyPrompts.personalityPrompt.trim()}\n\n`;
      }
      
      // سياق المحادثة
      if (conversationMemory && conversationMemory.length > 0) {
        prompt += `📚 سجل المحادثة السابقة:\n`;
        conversationMemory.slice(-5).forEach((interaction, index) => {
          prompt += `${index + 1}. العميل: ${interaction.userMessage}\n`;
          prompt += `   ردك: ${interaction.aiResponse}\n\n`;
        });
        prompt += `=====================================\n\n`;
      }
      
      // ✅ معلومات الطلب المؤكد - استخدام البيانات من الـ database
      const shippingCost = order.shipping || 50;
      const totalPrice = order.total || ((orderDetails.productPrice || 0) + shippingCost);
      
      // ✅ استخدام بيانات المنتج من order.items إذا كانت متوفرة
      const orderItem = order.items && order.items.length > 0 ? order.items[0] : null;
      const productName = orderItem?.productName || orderDetails.productName || 'المنتج';
      const productColor = orderItem?.productColor || orderDetails.productColor;
      const productSize = orderItem?.productSize || orderDetails.productSize;
      const productPrice = orderItem?.price || orderDetails.productPrice;
      
      // ✅ الحصول على مدة التوصيل من قاعدة البيانات
      let deliveryTime = '3-5 أيام'; // القيمة الافتراضية
      try {
        const ShippingService = require('./shippingService');
        const shippingInfo = await ShippingService.findShippingInfo(orderDetails.city, companyId);
        if (shippingInfo && shippingInfo.found && shippingInfo.deliveryTime) {
          deliveryTime = shippingInfo.deliveryTime;
          console.log(`⏰ [ORDER-CONFIRMATION] مدة التوصيل من DB: ${deliveryTime}`);
        } else {
          console.log(`⚠️ [ORDER-CONFIRMATION] لم يتم العثور على مدة التوصيل، استخدام القيمة الافتراضية`);
        }
      } catch (error) {
        console.error(`❌ [ORDER-CONFIRMATION] خطأ في جلب مدة التوصيل:`, error.message);
      }
      
      prompt += `🎉 تم إنشاء الطلب بنجاح!\n\n`;
      prompt += `📋 تفاصيل الطلب المؤكد:\n`;
      prompt += `- رقم الطلب: ${order.orderNumber}\n`;
      prompt += `- المنتج: ${productName}\n`;
      if (productColor) prompt += `- اللون: ${productColor}\n`;
      if (productSize) prompt += `- المقاس: ${productSize}\n`;
      if (productPrice) prompt += `- سعر المنتج: ${productPrice} جنيه\n`;
      prompt += `- الشحن: ${shippingCost} جنيه\n`;
      prompt += `- الإجمالي: ${totalPrice} جنيه\n\n`;
      
      prompt += `👤 بيانات العميل:\n`;
      prompt += `- الاسم: ${orderDetails.customerName}\n`;
      prompt += `- الموبايل: ${orderDetails.customerPhone}\n`;
      prompt += `- العنوان: ${orderDetails.customerAddress}\n`;
      if (orderDetails.city) prompt += `- المدينة: ${orderDetails.city}\n`;
      prompt += `\n`;
      
      prompt += `رسالة العميل الأخيرة: "${customerMessage}"\n\n`;
      
      prompt += `🎯 مهمتك الآن:\n`;
      prompt += `- أكدي للعميل إن طلبه تم بنجاح بطريقة طبيعية ومختصرة\n`;
      prompt += `- اذكري تفاصيل الطلب: ${productName}${productColor ? ` - ${productColor}` : ''}${productSize ? ` - مقاس ${productSize}` : ''}\n`;
      prompt += `- اذكري السعر الإجمالي: ${totalPrice} جنيه\n`;
      prompt += `- اذكري رقم الطلب: ${order.orderNumber}\n`;
      prompt += `- قوليله إن الطلب هيوصل في خلال ${deliveryTime}\n`;
      prompt += `- خليكي مختصرة ومباشرة - متطوليش الرد\n`;
      prompt += `- استخدمي emoji واحد أو اتنين بس\n`;
      prompt += `- ⚠️ ممنوع تماماً تذكري: "صورة"، "أرفق"، "[صورة]"، "ده شكله"، أو أي إشارة للصور\n`;
      prompt += `- ⚠️ لا تكرري بيانات العميل (الاسم، العنوان، الموبايل) في الرد - هو عارفها\n\n`;
      
      prompt += `مثال للرد المناسب:\n`;
      prompt += `"تمام يا ${orderDetails.customerName}! طلبك اتأكد بنجاح 🎉\n`;
      prompt += `${productName}${productColor ? ` - ${productColor}` : ''}${productSize ? ` - مقاس ${productSize}` : ''}\n`;
      prompt += `الإجمالي: ${totalPrice} جنيه شامل الشحن.\n`;
      prompt += `رقم الطلب: ${order.orderNumber}\n`;
      prompt += `هيوصلك خلال ${deliveryTime}. شكراً ليكي!"\n\n`;
      
      prompt += `⚠️ تحذير نهائي: لا تذكري أي شيء عن الصور أو إرفاق صور!`;
      
      return prompt;
      
    } catch (error) {
      console.error('❌ [ORDER-CONFIRMATION] خطأ في بناء prompt التأكيد:', error);
      throw error;
    }
  }

  /**
   * تحديد ما إذا كانت الرسالة عاجلة
   * @param {string} message - نص الرسالة
   * @returns {boolean} - هل الرسالة عاجلة
   */
  isUrgentMessage(message) {
    const urgentKeywords = [
      'عاجل', 'ضروري', 'مستعجل', 'فوري', 'سريع',
      'urgent', 'emergency', 'asap', 'critical',
      'مشكلة', 'خطأ', 'عطل', 'لا يعمل',
      'problem', 'error', 'issue', 'not working',
      'كسر', 'تلف', 'فشل', 'توقف',
      'broken', 'damaged', 'failed', 'stopped'
    ];

    const lowerMessage = message.toLowerCase();
    return urgentKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}

module.exports = new AIAgentService();


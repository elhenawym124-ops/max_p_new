/**
 * Message Processor Module
 * 
 * هذا الموديول مسؤول عن معالجة رسائل العملاء وإنشاء ردود AI
 * تم نقله من aiAgentService.js لتسهيل الصيانة
 */

const { getSharedPrismaClient, safeQuery } = require('../sharedDatabase');
const memoryService = require('../memoryService');
const aiResponseMonitor = require('../aiResponseMonitor');
const AIErrorHandler = require('../aiErrorHandler');

class MessageProcessor {
  constructor(aiAgentService) {
    this.prisma = getSharedPrismaClient();
    this.errorHandler = new AIErrorHandler();
    // ✅ حفظ reference لـ aiAgentService للوصول للدوال المساعدة
    this.aiAgentService = aiAgentService;
  }

  /**
   * Process customer message and generate AI response
   * 
   * نفس الدالة من aiAgentService.js لكن في module منفصل
   * يستخدم this.aiAgentService للدوال المساعدة
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
      
      // 🔍 Additional diagnostics for companyId tracking
      if (!finalCompanyId) {
        console.error('❌ [SECURITY] processCustomerMessage called without companyId - this is a critical security issue');
        console.error('❌ [SECURITY] Message data:', JSON.stringify(messageData, null, 2));
      }

      // 🔍 فحص حالة الذكاء الاصطناعي للمحادثة
      if (conversationId) {
        try {
          const conversation = await safeQuery(async () => {
            return await this.prisma.conversation.findUnique({
              where: { id: conversationId },
              select: { 
                id: true, 
                customerId: true, 
                metadata: true,
                createdAt: true 
              }
            });
          }, 8); // Priority 8 - عملية حرجة (معالجة رسالة)

          // التحقق من وجود حقل aiEnabled في metadata
          if (conversation && conversation.metadata) {
            try {
              const metadata = JSON.parse(conversation.metadata);
              if (metadata.aiEnabled === false) {
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
              // ✅ استخدام this.aiAgentService.getSettings
              const aiSettings = await this.aiAgentService.getSettings(companyId);
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
                
                // ✅ IMPROVED LOGIC: Check the LAST employee message with timestamp comparison
                const messageTimestamp = messageData.timestamp ? new Date(messageData.timestamp) : new Date();
                
                // Find the last employee message (not AI, not customer)
                const lastEmployeeMessage = await safeQuery(async () => {
                  return await this.prisma.message.findFirst({
                    where: {
                      conversationId,
                      isFromCustomer: false, // Not from customer
                      senderId: { not: null } // senderId exists = Employee (not AI)
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                      id: true,
                      createdAt: true,
                      content: true,
                      senderId: true
                    }
                  });
                }, 7); // Priority 7 - عملية مهمة (فحص Reply Mode)
                
                console.log(`🔍 [REPLY-MODE-DEBUG] Message timestamp: ${messageTimestamp.toISOString()}`);
                console.log(`🔍 [REPLY-MODE-DEBUG] Last employee message:`, lastEmployeeMessage ? {
                  id: lastEmployeeMessage.id,
                  createdAt: lastEmployeeMessage.createdAt.toISOString(),
                  contentPreview: (lastEmployeeMessage.content || '').substring(0, 50)
                } : 'None');
                
                // ✅ Check if employee replied
                const now = new Date();
                const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
                
                let shouldSkip = false;
                let skipReason = '';
                
                if (lastEmployeeMessage) {
                  const employeeMessageTime = new Date(lastEmployeeMessage.createdAt);
                  
                  // Check 1: Employee replied after current message
                  if (employeeMessageTime > messageTimestamp) {
                    shouldSkip = true;
                    skipReason = `Employee replied after current message (${employeeMessageTime.toISOString()} > ${messageTimestamp.toISOString()})`;
                  }
                  // Check 2: Employee replied in last 30 seconds (race condition protection)
                  else if (employeeMessageTime > thirtySecondsAgo) {
                    shouldSkip = true;
                    skipReason = `Employee recently replied (within last 30 seconds: ${employeeMessageTime.toISOString()})`;
                  }
                }
                
                // Get all messages for debugging
                const allMessages = await safeQuery(async () => {
                  return await this.prisma.message.findMany({
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
                }, 6); // Priority 6 - عملية عادية (جلب رسائل)
                
                console.log(`🔍 [REPLY-MODE-DEBUG] Total messages in conversation: ${allMessages.length}`);
                console.log(`🔍 [REPLY-MODE-DEBUG] Message breakdown:`);
                allMessages.forEach((msg, idx) => {
                  const msgType = msg.isFromCustomer ? '👤 Customer' : (msg.senderId ? '👨‍💼 Employee' : '🤖 AI');
                  console.log(`   ${idx + 1}. ${msgType} | senderId: ${msg.senderId || 'null'} | createdAt: ${msg.createdAt} | "${(msg.content || '').substring(0, 50)}..."`);
                });
                
                // ✅ If employee replied, skip AI response
                if (shouldSkip) {
                  console.log(`🚫 [REPLY-MODE-DEBUG] DECISION: SKIP - ${skipReason}`);
                  console.log(`🔍 [REPLY-MODE-DEBUG] Reason: Conversation is now under human supervision - AI should not interfere`);
                  console.log(`🔍 [REPLY-MODE-DEBUG] ==================== END (SKIPPED) ====================\n`);
                  return {
                    success: false,
                    content: null,
                    reason: 'EMPLOYEE_REPLIED',
                    message: 'الذكاء الاصطناعي يرد على المحادثات الجديدة فقط - تم تدخل موظف',
                    silent: true // Mark as silent to prevent any processing
                  };
                }
                
                console.log(`✅ [REPLY-MODE-DEBUG] DECISION: PROCEED - No recent employee messages found`);
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

      // 🖼️ معالجة الصور إذا كانت موجودة
      if (attachments && attachments.length > 0) {
        // التحقق من وجود صور
        const imageAttachments = attachments.filter(att =>
          att.type === 'image' ||
          (att.payload && att.payload.url && att.payload.url.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        );

        if (imageAttachments.length > 0) {
          try {
            // استدعاء خدمة معالجة الصور
            const multimodalService = require('../multimodalService');
            const imageResult = await multimodalService.processImage(messageData);

            if (imageResult && imageResult.type === 'image_analysis') {
              // تحديد نوع الاستعلام بناءً على نتيجة تحليل الصورة
              const intent = imageResult.productMatch?.found ? 'product_inquiry' : 'general_inquiry';

              // إنشاء رسالة للـ AI Agent
              const imageContext = imageResult.processedContent;
              const customerMessage = messageData.content || 'العميل أرسل صورة';

              // ✅ استخدام processImageWithAI من نفس الـ class
              const aiResponse = await this.processImageWithAI(
                imageContext,
                messageData,
                intent,
                imageResult.productMatch
              );

              // ✅ استخدام saveImageResponseToMemory من نفس الـ class
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
              // تحديد نوع الاستعلام بناءً على نوع الخطأ
              const intent = imageResult.errorType === 'general_error' ? 'product_inquiry' : 'general_inquiry';

              // إنشاء رسالة واضحة للـ AI Agent
              const imageContext = imageResult.processedContent;
              const customerMessage = messageData.content || 'العميل أرسل صورة';

              // ✅ استخدام processWithAI من نفس الـ class
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
      finalCompanyId = finalCompanyId || companyId || customerData?.companyId;
      
      // Enhanced diagnostics for companyId tracking
      if (!finalCompanyId) {
        console.error('❌ [SECURITY] No companyId available for AI processing - checking fallback options');
        console.error('❌ [SECURITY] companyId from messageData:', companyId);
        console.error('❌ [SECURITY] customerData.companyId:', customerData?.companyId);
      }
      
      // Fallback: Try to get company ID from database if not provided
      if (!finalCompanyId && customerData?.id) {
        try {
          const customerRecord = await safeQuery(async () => {
            return await this.prisma.customer.findUnique({
              where: { id: customerData.id },
              select: { companyId: true }
            });
          }, 7); // Priority 7 - عملية مهمة (تحديد الشركة)
          if (customerRecord?.companyId) {
            finalCompanyId = customerRecord.companyId;
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
          content: null,
          shouldEscalate: false,
          silent: true,
          errorType: 'security_error'
        };
      }

      // ✅ استخدام this.aiAgentService.getCurrentActiveModel
      const geminiConfig = await this.aiAgentService.getCurrentActiveModel(finalCompanyId);

      if (!geminiConfig) {
        console.error(`❌ No active Gemini key available for company: ${finalCompanyId}`);
        
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
          content: null,
          shouldEscalate: false,
          silent: true,
          errorType: 'no_api_key'
        };
      }

      // Initialize RAG service if not already done
      if (!this.aiAgentService.ragService) {
        this.aiAgentService.ragService = require('../ragService');
        await this.aiAgentService.ragService.ensureInitialized();
      }

      // ✅ استخدام this.aiAgentService.getCompanyPrompts
      const companyPrompts = await this.aiAgentService.getCompanyPrompts(finalCompanyId, customPrompt);

      // ✅ استخدام this.aiAgentService.getSettings
      const settings = await this.aiAgentService.getSettings(finalCompanyId);
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

      // ✅ استخدام this.aiAgentService.analyzeEnhancedConversationContext
      const enhancedContext = await this.aiAgentService.analyzeEnhancedConversationContext(content, conversationMemory, finalCompanyId);
      const intent = enhancedContext.intent;

      // ✅ استخدام this.aiAgentService.getSmartResponse
      console.log(`🔍 [DEBUG] About to call getSmartResponse for: "${content.substring(0, 50)}"`);
      let smartResponse;
      try {
        smartResponse = await this.aiAgentService.getSmartResponse(content, intent, conversationMemory, customerData?.id, finalCompanyId);
        console.log(`✅ [DEBUG] getSmartResponse completed. Images: ${smartResponse?.images?.length || 0}, RAG: ${smartResponse?.ragData?.length || 0}`);
      } catch (smartResponseError) {
        console.error('❌ [DEBUG] Error in getSmartResponse:', smartResponseError);
        smartResponse = { images: [], ragData: [], hasSpecificProduct: false, productInfo: null };
      }
      const images = smartResponse.images || [];
      const ragData = smartResponse.ragData || [];
      const hasImages = images && images.length > 0;

      // ✅ استخدام this.aiAgentService.buildAdvancedPrompt
      console.log(`🔍 [DEBUG] Building advanced prompt...`);
      console.log('📦 [DEBUG] Data being passed to buildAdvancedPrompt:');
      console.log('  - conversationMemory.length:', conversationMemory?.length || 0);
      console.log('  - ragData.length:', ragData?.length || 0);
      console.log('  - hasImages:', hasImages);
      console.log('  - customerData:', customerData?.name || 'No name');
      
      let advancedPrompt;
      try {
        advancedPrompt = await this.aiAgentService.buildAdvancedPrompt(
          content,
          customerData,
          companyPrompts,
          ragData,
          conversationMemory,
          hasImages,
          smartResponse,
          messageData
        );
        console.log(`✅ [DEBUG] Prompt built. Length: ${advancedPrompt?.length || 0} characters`);
      } catch (promptError) {
        console.error('❌ [DEBUG] Error building prompt:', promptError);
        throw promptError;
      }

      // ✅ استخدام this.aiAgentService.generateAIResponse
      console.log(`🔍 [DEBUG] Calling generateAIResponse...`);
      let aiContent;
      try {
        aiContent = await this.aiAgentService.generateAIResponse(
          advancedPrompt,
          conversationMemory,
          true, // useRAG
          null, // providedGeminiConfig
          finalCompanyId,
          conversationId,
          { 
            messageType: intent, 
            inquiryType: intent,
            conversationPhase: enhancedContext.conversationPhase,
            customerEngagement: enhancedContext.customerEngagement,
            topicContinuity: enhancedContext.topicContinuity,
            conversationMemory: conversationMemory // ✅ إضافة conversationMemory للتحقق من المحادثات الجديدة
          }
        );
        console.log(`✅ [DEBUG] AI response generated. Length: ${aiContent?.length || 0} characters`);
      } catch (aiError) {
        console.error('❌ [DEBUG] Error generating AI response:', aiError);
        throw aiError;
      }
      
      // 🤐 النظام الصامت - إذا كان aiContent null، النظام صامت
      if (aiContent === null || aiContent === undefined) {
        console.log('🤐 [SILENT-MODE] AI response is null - system will be silent with customer');
        
        await aiResponseMonitor.recordAIFailure({
          companyId: finalCompanyId,
          conversationId,
          customerId: senderId,
          errorType: 'null_response',
          errorMessage: 'AI returned null response',
          context: {
            intent: intent,
            userMessage: content.substring(0, 100)
          }
        });

        return {
          success: false,
          error: 'AI returned null response',
          content: null,
          shouldEscalate: false,
          processingTime: Date.now() - startTime,
          intent: intent,
          silent: true
        };
      }
      
      // ✅ استخدام this.aiAgentService.enhanceResponseWithConversationState
      let enhancedResponse = null;
      if (aiContent && typeof aiContent === 'string') {
        enhancedResponse = this.aiAgentService.enhanceResponseWithConversationState(
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
      }
      
      let finalResponse = enhancedResponse || aiContent;

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

      // ✅ FIX: Retry logic للردود الفارغة أو القصيرة جداً
      const responseLength = finalResponse ? finalResponse.trim().length : 0;
      const isResponseTooShort = responseLength > 0 && responseLength < 10;
      
      if (!finalResponse || (typeof finalResponse === 'string' && finalResponse.trim().length === 0) || isResponseTooShort) {
        const reason = !finalResponse ? 'empty' : isResponseTooShort ? 'too short' : 'invalid';
        console.log(`⚠️ [EMPTY-RESPONSE] AI response is ${reason} (length: ${responseLength}) - attempting retry with fallback`);
        
        // ✅ FIX: محاولة إعادة توليد الرد مع prompt محسن وRAG data
        try {
          // ✅ FIX: استخدام RAG data إذا كان متوفراً
          const ragService = require('../ragService');
          const ragData = await ragService.retrieveRelevantData(content, intent, messageData.customerData?.id, finalCompanyId, conversationMemory);
          
          let retryPrompt = `
أنت مساعد ذكي لخدمة العملاء. العميل قال: "${content}"

أجب على سؤاله بشكل مفيد ومهذب ومفصل. الرد يجب أن يكون واضحاً ومفيداً (على الأقل 20 حرف).

تعليمات مهمة:
- إذا كان السؤال غامضاً، اطلب توضيح بشكل واضح
- إذا كان يسأل عن منتج غير موجود، اعتذر وأقترح منتجات بديلة
- إذا كان يسأل عن سعر، اذكر السعر بوضوح مع اسم المنتج
- استخدم المعلومات المتاحة في المحادثة السابقة
- الرد يجب أن يكون مفيداً وواضحاً (لا تكتفي بكلمة واحدة مثل "لا" أو "نعم" إلا إذا كان السؤال نعم/لا مباشر)

الرد:`;

          // ✅ FIX: إضافة معلومات RAG إذا كانت متوفرة
          if (ragData && ragData.length > 0) {
            const productsInfo = ragData.filter(item => item.type === 'product').map(item => `- ${item.name}: ${item.price || 'غير متوفر'} جنيه`).join('\n');
            if (productsInfo) {
              retryPrompt = `
أنت مساعد ذكي لخدمة العملاء. العميل قال: "${content}"

المنتجات المتاحة:
${productsInfo}

أجب على سؤاله بشكل مفيد ومهذب ومفصل. الرد يجب أن يكون واضحاً ومفيداً (على الأقل 20 حرف).

تعليمات مهمة:
- استخدم المعلومات من المنتجات المتاحة أعلاه
- إذا كان يسأل عن منتج، اذكر اسم المنتج والسعر بوضوح
- إذا كان يسأل عن سعر، اذكر السعر بوضوح مع اسم المنتج
- الرد يجب أن يكون مفيداً وواضحاً

الرد:`;
            }
          }

          const retryResponse = await this.aiAgentService.generateAIResponse(
            retryPrompt,
            conversationMemory,
            false, // لا نستخدم RAG في retry (استخدمناه في prompt)
            null,
            finalCompanyId,
            conversationId,
            { messageType: intent, isRetry: true }
          );

          // ✅ FIX: التحقق من أن الرد الجديد أفضل من القديم
          if (retryResponse && retryResponse.trim().length > 0) {
            const retryLength = retryResponse.trim().length;
            if (retryLength >= 10 || (!finalResponse && retryLength > 0)) {
              finalResponse = retryResponse;
              console.log(`✅ [RETRY-SUCCESS] Got response after retry (length: ${retryLength})`);
            } else {
              console.warn(`⚠️ [RETRY-SHORT] Retry response is also too short (length: ${retryLength})`);
            }
          }
        } catch (retryError) {
          console.error('❌ [RETRY-FAILED] Retry also failed:', retryError.message);
        }

        // إذا فشل retry، استخدم fallback response
        if (!finalResponse || (typeof finalResponse === 'string' && finalResponse.trim().length === 0)) {
          console.log('🔄 [FALLBACK] Using fallback response');
          
          const fallbackResponses = {
            'product_inquiry': 'عذراً، لم أتمكن من العثور على المنتج. هل يمكنك توضيح اسم المنتج أو الوصف؟',
            'price_inquiry': 'عذراً، لم أتمكن من العثور على السعر. هل يمكنك تحديد المنتج الذي تريد معرفة سعره؟',
            'shipping_inquiry': 'عذراً، لم أتمكن من الحصول على معلومات الشحن. يرجى المحاولة مرة أخرى أو التواصل مع خدمة العملاء.',
            'order_inquiry': 'عذراً، حدث خطأ في معالجة طلبك. هل يمكنك إعادة المحاولة أو توضيح ما تريد طلبه؟',
            'greeting': 'أهلاً بك! كيف يمكنني مساعدتك اليوم؟',
            'general_inquiry': 'عذراً، لم أفهم سؤالك بشكل كامل. هل يمكنك إعادة صياغته أو توضيح ما تريد معرفته؟'
          };

          finalResponse = fallbackResponses[intent] || fallbackResponses['general_inquiry'];
          
          await aiResponseMonitor.recordAIFailure({
            companyId: finalCompanyId,
            conversationId,
            customerId: senderId,
            errorType: 'empty_response',
            errorMessage: 'AI generated empty response - used fallback',
            context: {
              intent: intent,
              userMessage: content.substring(0, 100),
              hasImages: images && images.length > 0
            }
          });
        }
      }

      const processingTime = Date.now() - startTime;

      // Save interaction to memory
      try {
        let memoryResponse = finalResponse;
        if (ragData && ragData.length > 0) {
          const productNames = ragData.map(p => p.name).filter(Boolean).join(', ');
          if (productNames) {
            memoryResponse = `${finalResponse}\n[المنتج: ${productNames}]`;
            console.log(`📝 [MEMORY-CONTEXT] Adding product context to memory: ${productNames}`);
          }
        }
        
        await memoryService.saveInteraction({
          conversationId,
          senderId,
          companyId: finalCompanyId,
          userMessage: content,
          aiResponse: memoryResponse,
          intent,
          sentiment: this.aiAgentService.analyzeSentiment(content),
          timestamp: new Date()
        });
      } catch (memoryError) {
        console.error('⚠️ Failed to save to memory:', memoryError.message);
      }

      // ✅ استخدام this.aiAgentService.collectLearningData
      try {
        const sentiment = this.aiAgentService.analyzeSentiment(content);
        await this.aiAgentService.collectLearningData({
          companyId,
          customerId: senderId,
          conversationId,
          userMessage: content,
          aiResponse: finalResponse,
          intent,
          sentiment,
          processingTime,
          ragDataUsed: ragData.length > 0,
          memoryUsed: conversationMemory.length > 0,
          model: this.aiAgentService.currentActiveModel?.model || geminiConfig.model,
          confidence: enhancedContext.confidence,
          conversationPhase: enhancedContext.conversationPhase,
          customerEngagement: enhancedContext.customerEngagement,
          topicContinuity: enhancedContext.topicContinuity,
          conversationDirection: enhancedContext.conversationFlow.direction,
          conversationMomentum: enhancedContext.conversationFlow.momentum,
          contextualCues: enhancedContext.contextualCues
        });
      } catch (learningError) {
        console.error('⚠️ [AIAgent] Failed to collect learning data:', learningError.message);
      }

      // فحص إذا كان العميل يرسل بيانات مطلوبة لطلب معلق
      const pendingOrderData = await this.aiAgentService.checkForPendingOrderData(content, conversationMemory);
      if (pendingOrderData.isProvidingData) {
        // محاولة إنشاء الطلب بالبيانات الجديدة
        const orderCreationResult = await this.aiAgentService.attemptOrderCreationWithNewData(pendingOrderData, messageData, conversationId);
        if (orderCreationResult) {
          return orderCreationResult;
        }
      }

      // Check if customer is confirming an order
      const orderConfirmation = await this.aiAgentService.detectOrderConfirmation(content, conversationMemory, messageData.customerData?.id, companyId);
      let orderCreated = null;

      if (orderConfirmation.isConfirming) {
        // محاولة استخراج تفاصيل الطلب إذا لم تكن موجودة
        if (!orderConfirmation.orderDetails) {
          orderConfirmation.orderDetails = await this.aiAgentService.extractOrderDetailsFromMemory(conversationMemory, finalCompanyId, content);
        }

        if (orderConfirmation.orderDetails) {
          // فحص اكتمال البيانات قبل إنشاء الطلب
          const dataCompleteness = await this.aiAgentService.checkDataCompleteness(orderConfirmation.orderDetails, conversationMemory, content);

          // ✅ استخدام البيانات المحدثة من checkDataCompleteness
          const finalOrderDetails = dataCompleteness.updatedOrderDetails || orderConfirmation.orderDetails;

          if (!dataCompleteness.isComplete) {
            // إنشاء رد لطلب البيانات المفقودة
            const dataRequestResponse = await this.aiAgentService.generateDataRequestResponse(dataCompleteness.missingData, finalOrderDetails, finalCompanyId);

            // إرجاع الرد لطلب البيانات بدلاً من إنشاء الطلب
            return {
              success: true,
              content: dataRequestResponse,
              model: geminiConfig?.model,
              keyId: geminiConfig?.id,
              processingTime: Date.now() - startTime,
              intent: 'data_collection',
              sentiment: this.aiAgentService.analyzeSentiment(content),
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

          try {
            // استخدام الخدمة المحسنة للطلبات
            const EnhancedOrderService = require('../enhancedOrderService');
            const enhancedOrderService = new EnhancedOrderService();

            // الحصول على companyId الصحيح
            const orderCompanyId = finalCompanyId || customerData?.companyId;

            // التأكد من وجود companyId قبل إنشاء الأوردر
            if (!orderCompanyId) {
              console.error('❌ [SECURITY] لا يمكن إنشاء أوردر بدون companyId - رفض الطلب');
              throw new Error('Company ID is required for order creation');
            }

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
              
              // ✅ استخدام this.aiAgentService.buildOrderConfirmationPrompt
              const orderConfirmationPrompt = await this.aiAgentService.buildOrderConfirmationPrompt(
                content,
                customerData,
                companyPrompts,
                order,
                finalOrderDetails,
                conversationMemory,
                finalCompanyId
              );
              
              // ✅ استخدام this.aiAgentService.generateAIResponse
              const naturalConfirmation = await this.aiAgentService.generateAIResponse(
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
              
              // ✅ تأخير صغير لتجنب الضغط على قاعدة البيانات بعد إنشاء الطلب
              await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
              
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

              // ✅ تأخير إضافي قبل إنشاء النسخة الاحتياطية
              await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
              
              // ✅ إنشاء نسخة احتياطية بنفس رقم الطلب من الـ database
              try {
                const simpleOrderService = require('../simpleOrderService');
                
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
                  orderNumber: order.orderNumber,
                  confidence: finalOrderDetails.confidence || 0.7,
                  validation: finalOrderDetails.validation,
                  shipping: order.shipping,
                  subtotal: order.subtotal,
                  total: order.total
                });

                if (backupOrder.success) {
                  await simpleOrderService.saveOrderToFile(backupOrder.order);
                }
              } catch (backupError) {
                console.warn('⚠️ [AI-AGENT] فشل في إنشاء النسخة الاحتياطية:', backupError.message);
              }
            }

            // إغلاق الاتصال
            await enhancedOrderService.disconnect();
          } catch (error) {
            console.error('❌ Error creating automatic order:', error);
          }
        }
      }

      // 🤖 تقييم جودة الرد بالذكاء الاصطناعي
      try {
        const messageId = `msg_${conversationId}_${Date.now()}`;
        const evaluationData = {
          messageId,
          conversationId,
          userMessage: content,
          botResponse: finalResponse,
          ragData: {
            used: ragData.length > 0,
            sources: ragData
          },
          confidence: enhancedContext.confidence,
          model: this.aiAgentService.currentActiveModel?.model || geminiConfig.model,
          timestamp: new Date(),
          companyId: finalCompanyId,
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
        this.aiAgentService.qualityMonitor.evaluateResponse(evaluationData).catch(error => {
          console.error('⚠️ [QUALITY-MONITOR] Error evaluating response:', error);
        });
      } catch (evaluationError) {
        console.error('❌ [QUALITY-MONITOR] Failed to queue evaluation:', evaluationError);
      }

      // تسجيل النجاح في نظام المراقبة
      aiResponseMonitor.recordAISuccess(finalCompanyId);
      
      // 📊 تسجيل في Simple Monitor أيضاً
      const { simpleMonitor } = require('../simpleMonitor');
      const isEmpty = !finalResponse || finalResponse.trim().length === 0;
      simpleMonitor.logResponse(processingTime, isEmpty, true);

      console.log(`✅ [DEBUG] ===== Returning final response =====`);
      console.log(`📝 [DEBUG] Response length: ${finalResponse?.length || 0}, Images: ${images?.length || 0}`);
      
      return {
        success: true,
        content: finalResponse,
        model: this.aiAgentService.currentActiveModel?.model || geminiConfig.model,
        keyId: this.aiAgentService.currentActiveModel?.keyId || geminiConfig.keyId,
        processingTime,
        intent,
        sentiment: this.aiAgentService.analyzeSentiment(content),
        confidence: enhancedContext.confidence,
        shouldEscalate: enhancedContext.needsRedirection && enhancedContext.customerEngagement === 'low',
        switchType: this.aiAgentService.currentActiveModel?.switchType || geminiConfig.switchType || 'normal',
        ragDataUsed: ragData.length > 0,
        memoryUsed: conversationMemory.length > 0,
        images: images,
        orderCreated: orderCreated,
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
        isUrgent: this.aiAgentService.isUrgentMessage(content),
        consecutiveFailures: messageData.consecutiveFailures || 1
      };

      // تسجيل الفشل في نظام المراقبة
      const errorType = this.errorHandler.classifyError(error);
      await aiResponseMonitor.recordAIFailure({
        companyId: errorContext.companyId,
        conversationId,
        customerId: senderId,
        errorType: errorType,
        errorMessage: error.message,
        context: {
          intent: errorContext.intent,
          userMessage: content.substring(0, 100),
          isUrgent: errorContext.isUrgent
        }
      });
      
      // 📊 تسجيل الخطأ في Simple Monitor أيضاً
      const { simpleMonitor } = require('../simpleMonitor');
      await simpleMonitor.logError(error, {
        companyId: errorContext.companyId,
        conversationId,
        customerId: senderId,
        intent: errorContext.intent,
        silent: true
      });

      // 🤐 النظام الصامت - إرسال إشعار فوري لكل فشل حرج
      const criticalErrorTypes = ['auth_error', 'service_unavailable', 'api_quota_exceeded'];
      if (criticalErrorTypes.includes(errorType)) {
        await aiResponseMonitor.sendNotification({
          companyId: errorContext.companyId,
          type: 'ai_critical_failure',
          severity: 'high',
          title: `🚨 فشل حرج في الذكاء الاصطناعي: ${errorType}`,
          message: `فشل النظام في معالجة رسالة العميل. نوع الخطأ: ${errorType}. رسالة الخطأ: ${error.message.substring(0, 200)}`,
          metadata: {
            errorType,
            errorMessage: error.message,
            conversationId,
            customerId: senderId,
            intent: errorContext.intent,
            userMessage: content.substring(0, 100)
          }
        });
      }

      // 🤐 النظام الصامت - لا نرسل أي رد للعميل
      console.log('🤐 [SILENT-MODE] System is silent with customer - no response sent');
      
      return {
        success: false,
        error: error.message,
        content: null,
        shouldEscalate: false,
        processingTime,
        intent: errorContext.intent || 'general_inquiry',
        sentiment: this.aiAgentService.analyzeSentiment(content),
        switchType: 'error_silent',
        ragDataUsed: false,
        memoryUsed: false,
        images: [],
        orderCreated: null,
        errorType: errorType,
        silent: true
      };
    }
  }

  /**
   * Helper Methods for Image Processing
   * These methods are used internally by processCustomerMessage
   */

  /**
   * معالجة الصور مع الـ AI بدون استخدام الذاكرة لضمان الاستقلالية
   */
  async processImageWithAI(imageAnalysis, messageData, intent = 'general_inquiry', productMatch ) {
    try {
      //console.log('🖼️ [IMAGE-AI] Processing image with AI (memory-independent)...');

      // الحصول على معلومات الشركة والـ prompts
      const finalCompanyId = messageData.companyId || messageData.customerData?.companyId;
      //console.log('🏢 [IMAGE-AI] Using companyId:', finalCompanyId);
      const companyPrompts = await this.aiAgentService.getCompanyPrompts(finalCompanyId);

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
        timeOfDay: this.aiAgentService.getTimeOfDay(),
        customerHistory: {
          isReturning: false, // نعتبر كل صورة كتفاعل جديد
          previousPurchases: 0
        }
      };

      // إنشاء الرد مع الـ AI بدون ذاكرة
      const aiContent = await this.aiAgentService.generateAIResponse(
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
      const companyPrompts = await this.aiAgentService.getCompanyPrompts(finalCompanyId);

      // جلب الذاكرة والتفاعلات السابقة
      // الحصول على إعدادات الذاكرة من قاعدة البيانات
      const settings = await this.aiAgentService.getSettings(finalCompanyId);
      const memoryLimit = settings.maxMessagesPerConversation || 50;
      const conversationMemory = await memoryService.getConversationMemory(messageData.conversationId, messageData.senderId, memoryLimit, finalCompanyId);

      // معالجة الرد مع الـ RAG إذا كان مطلوباً
      let ragData = [];
      if (intent === 'product_inquiry' || intent === 'price_inquiry') {
        try {
          const ragService = require('../ragService');
          if (!this.aiAgentService.ragService) {
            this.aiAgentService.ragService = ragService;
            await ragService.ensureInitialized();
          }
          ragData = await ragService.retrieveRelevantData(content, intent, messageData.customerData?.id, finalCompanyId, conversationMemory);
        } catch (error) {
          console.error('❌ Error getting RAG data:', error);
          ragData = [];
        }
      }

      // إنشاء الـ prompt المتقدم
      const prompt = this.aiAgentService.buildPrompt(content, companyPrompts, conversationMemory, ragData, messageData.customerData, messageData);

      // تحضير سياق الرسالة للأنماط
      const messageContext = {
        messageType: intent,
        inquiryType: intent,
        timeOfDay: this.aiAgentService.getTimeOfDay(),
        customerHistory: {
          isReturning: conversationMemory.length > 0,
          previousPurchases: 0 // يمكن تحسينه لاحقاً
        },
        conversationMemory: conversationMemory // ✅ إضافة conversationMemory للتحقق من المحادثات الجديدة
      };

      // إنشاء الرد مع الـ AI مع تطبيق الأنماط
      const aiContent = await this.aiAgentService.generateAIResponse(
        prompt,
        conversationMemory,
        true,
        null, // geminiConfig
        finalCompanyId,
        messageData.conversationId,
        messageContext
      );

      // الحصول على معلومات النموذج المستخدم للشركة
      const currentModel = await this.aiAgentService.getCurrentActiveModel(finalCompanyId);

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
}

module.exports = MessageProcessor;


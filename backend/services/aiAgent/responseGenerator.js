/**
 * Response Generator Module
 * 
 * هذا الموديول مسؤول عن توليد ردود AI وبناء الـ prompts
 * تم نقله من aiAgentService.js لتسهيل الصيانة
 */

const aiResponseMonitor = require('../aiResponseMonitor');
const productExtractor = require('./productExtractor');
// ✅ استخدام الـ constants المركزي
const {
  DEFAULT_AI_SETTINGS,
  TOKEN_LIMITS_BY_TYPE,
  RETRY_TOKEN_MULTIPLIERS,
  TEMPERATURE_BY_TYPE,
  SAMPLING_BY_TYPE,
} = require('./aiConstants');
// ✅ استخدام قواعد الاستجابة
const { buildPromptFromRules, getDefaultRules } = require('./responseRulesConfig');

class ResponseGenerator {
  constructor(aiAgentService) {
    // ✅ حفظ reference لـ aiAgentService للوصول للدوال المساعدة
    this.aiAgentService = aiAgentService;
    
    // ✅ FIX 1: نظام تتبع عالمي للنماذج المجربة
    // Map: sessionId → Set<modelNames>
    this.globalTriedModels = new Map();
    
    // تنظيف تلقائي للجلسات القديمة كل 5 دقائق
    setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      for (const [sessionId, data] of this.globalTriedModels.entries()) {
        if (data.timestamp < fiveMinutesAgo) {
          this.globalTriedModels.delete(sessionId);
          console.log(`🧹 [CLEANUP] Removed old session: ${sessionId}`);
        }
      }
    }, 5 * 60 * 1000); // كل 5 دقائق
  }

  /**
   * ✨ بناء إعدادات التوليد الديناميكية بناءً على السياق
   */
  async buildGenerationConfig(companyId, messageContext = {}) {
    try {
      // الحصول على إعدادات AI من قاعدة البيانات
      const settings = await this.aiAgentService.getSettings(companyId);
      
      // ✅ استخدام القيم من قاعدة البيانات (التي تأتي من الواجهة)
      // ⚠️ القيمة الافتراضية موجودة في الواجهة فقط (AIManagement.tsx)
      const messageType = messageContext?.messageType || 'general';
      
      // ✅ FIX: استخدام ?? بدلاً من || لتجنب مشاكل القيم الصفرية
      // القيمة تأتي من قاعدة البيانات (التي حفظتها الواجهة)
      const baseConfig = {
        temperature: settings.aiTemperature ?? DEFAULT_AI_SETTINGS.TEMPERATURE,
        topK: settings.aiTopK ?? DEFAULT_AI_SETTINGS.TOP_K,
        topP: settings.aiTopP ?? DEFAULT_AI_SETTINGS.TOP_P,
        // ⚠️ القيمة من قاعدة البيانات (مصدرها الواجهة) - fallback من constants فقط
        maxOutputTokens: settings.aiMaxTokens ?? DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS,
      };
      
      // ✅ Logging للتحقق من القيمة المستخدمة
      if (settings.aiMaxTokens !== null && settings.aiMaxTokens !== undefined) {
        console.log(`🔍 [AI-CONFIG] Using aiMaxTokens from database: ${settings.aiMaxTokens} (companyId: ${companyId})`);
      } else {
        console.log(`🔍 [AI-CONFIG] Using default aiMaxTokens: ${DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS} (companyId: ${companyId})`);
      }

      // ✅ Allow overriding temperature and maxOutputTokens from messageContext
      if (messageContext?.temperature !== undefined) {
        baseConfig.temperature = messageContext.temperature;
      }
      if (messageContext?.maxTokens !== undefined) {
        baseConfig.maxOutputTokens = messageContext.maxTokens;
      }
      
      // ✅ تطبيق إعدادات حسب نوع الرسالة من constants
      const typeTemperature = TEMPERATURE_BY_TYPE[messageType];
      if (typeTemperature !== null && typeTemperature !== undefined && messageContext?.temperature === undefined) {
        baseConfig.temperature = typeTemperature;
      } else if ((messageType === 'greeting' || messageType === 'casual_chat') && messageContext?.temperature === undefined) {
        // للتحيات والدردشة: إبداع أعلى قليلاً
        baseConfig.temperature = Math.min(baseConfig.temperature + 0.1, 0.9);
      }
      
      // ✅ تطبيق Token Limits حسب نوع الرسالة (فقط إذا لم تكن القيمة موجودة في قاعدة البيانات)
      // ⚠️ لا نستبدل القيمة المخصصة من الواجهة (مثل 1280) بقيمة من TOKEN_LIMITS_BY_TYPE
      // نستخدم TOKEN_LIMITS_BY_TYPE فقط إذا كانت القيمة من قاعدة البيانات هي الافتراضية (2048) أو null
      if (messageContext?.maxTokens === undefined) {
        // ✅ فقط إذا كانت القيمة من قاعدة البيانات هي نفس القيمة الافتراضية أو null
        // هذا يعني أن المستخدم لم يغير القيمة في الواجهة
        const isDefaultValue = settings.aiMaxTokens === null || 
                               settings.aiMaxTokens === undefined || 
                               settings.aiMaxTokens === DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS;
        
        if (isDefaultValue) {
          // ✅ فقط في هذه الحالة نستخدم TOKEN_LIMITS_BY_TYPE
          const typeTokenLimit = TOKEN_LIMITS_BY_TYPE[messageType];
          if (typeTokenLimit) {
            baseConfig.maxOutputTokens = typeTokenLimit;
          }
        }
        // ✅ إذا كانت القيمة من قاعدة البيانات مختلفة (مثل 1280 أو 512)، نستخدمها كما هي
        // لا نغير baseConfig.maxOutputTokens في هذه الحالة
      }
      
      // ✅ تطبيق Sampling Settings حسب نوع الرسالة
      const typeSampling = SAMPLING_BY_TYPE[messageType];
      if (typeSampling) {
        baseConfig.topK = typeSampling.topK;
        baseConfig.topP = typeSampling.topP;
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
   * بناء الـ prompt للذكاء الاصطناعي (النسخة الأساسية)
   */
  buildPrompt(customerMessage, companyPrompts, conversationMemory, ragData, customerData, messageData) {
    let prompt = '';

    // التحقق من وجود personality prompt مخصص
    if (!companyPrompts.personalityPrompt || companyPrompts.personalityPrompt.trim() === '') {
      throw new Error('MISSING_PERSONALITY_PROMPT: يجب إعداد شخصية المساعد الذكي من لوحة التحكم أولاً');
    }

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
    if (companyPrompts.responsePrompt) {
      prompt += `${companyPrompts.responsePrompt}\n\n`;
    } else {
      prompt += `قواعد الرد المهمة:
1. ⚠️ استخدمي فقط المعلومات الموجودة في قاعدة البيانات المذكورة أدناه
2. 🚫 لا تذكري أي منتجات أو معلومات غير موجودة في قاعدة البيانات
3. ✅ قدمي أسعار ومواصفات دقيقة من قاعدة البيانات فقط
4. ❓ إذا لم تجدي معلومات، اطلبي توضيحاً أو قولي أن المنتج غير متوفر\n\n`;
    }

    // Add customer information
    prompt += `معلومات العميل:
- الاسم: ${customerData?.name || 'عميل جديد'}
- الهاتف: ${customerData?.phone || 'غير محدد'}
- عدد الطلبات السابقة: ${customerData?.orderCount || 0}\n\n`;

    // 🔄 إضافة معلومات الرد إذا كان العميل يرد على رسالة سابقة
    if (messageData?.replyContext?.isReply) {
      prompt += `🔄 سياق الرد - العميل يرد على رسالة سابقة:\n`;
      prompt += `=====================================\n`;

      if (messageData.replyContext.originalMessage?.content) {
        prompt += `📝 الرسالة الأصلية التي يرد عليها العميل:\n`;
        prompt += `"${messageData.replyContext.originalMessage.content}"\n\n`;

        const originalDate = new Date(messageData.replyContext.originalMessage.createdAt);
        const timeAgo = this.aiAgentService.getTimeAgo(originalDate);
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
        const timeAgo = this.aiAgentService.getTimeAgo(new Date(interaction.createdAt || interaction.timestamp));
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

    // ✅ FIX: التحقق من وجود منتجات في RAG
    const hasProductsInRAG = ragData && ragData.some(item => item.type === 'product');
    
    // إذا لم تكن هناك منتجات في RAG، أضف تحذير صارم
    if (!hasProductsInRAG) {
      prompt += `🚨 تحذير مهم جداً:\n`;
      prompt += `=====================================\n`;
      prompt += `⚠️ لا توجد منتجات متاحة في قاعدة البيانات حالياً.\n`;
      prompt += `🚫 ممنوع منعاً باتاً ذكر أي منتجات أو معلومات عن منتجات غير موجودة في قاعدة البيانات.\n`;
      prompt += `❌ لا تذكري منتجات مثل: تي شيرت، هودي، بنطلون، جينز، كاب، محفظة جلدية، أو أي منتجات أخرى غير موجودة في قاعدة البيانات.\n`;
      prompt += `✅ إذا سأل العميل عن المنتجات، قولي فقط: "عذراً، لا توجد منتجات متوفرة حالياً. يمكنك الاستفسار عن أي شيء آخر."\n`;
      prompt += `🔐 لا تستخدمي معلومات من شخصيتك أو من تدريبك الأساسي عن المنتجات - استخدمي فقط قاعدة البيانات.\n`;
      prompt += `=====================================\n\n`;
    }

    // Add customer message
    prompt += `رسالة العميل: "${customerMessage}"\n\n`;

    // Add final instructions
    if (ragData && ragData.length > 0 && hasProductsInRAG) {
      prompt += `🎯 تعليمات الرد النهائية:
1. ✅ استخدمي فقط المعلومات الموجودة في قاعدة البيانات أعلاه
2. 🚫 لا تذكري أي منتجات أو معلومات غير موجودة في القائمة
3. 💰 اذكري الأسعار والتفاصيل الدقيقة كما هي مكتوبة
4. 📝 إذا سأل عن منتجات، اعرضي المنتجات المتاحة بالتفصيل
5. ❌ إذا لم يكن المنتج في القائمة، قولي أنه غير متوفر حالياً
6. 🔥 مهم جداً: إذا كانت هناك محادثة سابقة (موجودة أعلاه)، استخدميها في ردك
7. 🔥 أشاري للمنتجات/الأسعار المذكورة سابقاً باستخدام عبارات مثل: "زي ما ذكرتلك قبل كده"، "كما وضحتلك سابقاً"
8. 💬 ردّي بشكل طبيعي وودود باستخدام شخصيتك المحددة أعلاه\n\n`;
    } else if (!hasProductsInRAG) {
      // ✅ FIX: تعليمات خاصة عندما لا توجد منتجات في RAG
      prompt += `🎯 تعليمات الرد النهائية (لا توجد منتجات في قاعدة البيانات):
1. 🚫 ممنوع منعاً باتاً ذكر أي منتجات غير موجودة في قاعدة البيانات
2. ❌ لا تذكري منتجات مثل: تي شيرت صيفي، هودي، بنطلون جينز، كاب، محفظة جلدية، أو أي منتجات أخرى
3. ✅ إذا سأل العميل عن المنتجات، قولي فقط: "عذراً، لا توجد منتجات متوفرة حالياً"
4. 🔥 مهم جداً: إذا كانت هناك محادثة سابقة (موجودة أعلاه)، استخدميها في ردك
5. 🔥 أشاري للمعلومات المذكورة سابقاً باستخدام عبارات مثل: "زي ما ذكرتلك قبل كده"، "كما وضحتلك سابقاً"
6. 💬 ركزي على الترحيب والمساعدة العامة بدون ذكر منتجات
7. 🗣️ استخدمي اللغة العربية الطبيعية والودودة
8. 🔐 لا تستخدمي معلومات من شخصيتك أو تدريبك الأساسي عن المنتجات

مثال للرد الصحيح عند الترحيب (بدون منتجات):
"السلام عليكم ورحمة الله وبركاته! أهلاً وسهلاً بك. كيف يمكنني مساعدتك اليوم؟"

❌ مثال خاطئ (لا تفعلي هذا):
"السلام عليكم! نحن متخصصون في الملابس الرياضية ولدينا تي شيرت صيفي وهودي وبنطلون جينز..."
`;
    }

    return prompt;
  }

  /**
   * Build advanced prompt with RAG data, company settings, and conversation memory
   */
  async buildAdvancedPrompt(customerMessage, customerData, companyPrompts, ragData, conversationMemory, hasImages = false, smartResponseInfo, messageData) {
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
      throw new Error('MISSING_PERSONALITY_PROMPT: يجب إعداد شخصية المساعد الذكي من لوحة التحكم أولاً');
    }

    prompt += `${companyPrompts.personalityPrompt.trim()}\n\n`;

    // ✅ FIX: إضافة قواعد الاستجابة (Response Rules Checkpoints) - مهم جداً!
    console.log('🔍 [RESPONSE-RULES] Checking for response rules...');
    if (companyPrompts.responseRules) {
      try {
        const rules = typeof companyPrompts.responseRules === 'string' 
          ? JSON.parse(companyPrompts.responseRules) 
          : companyPrompts.responseRules;
        console.log('✅ [RESPONSE-RULES] Using custom response rules:', {
          responseLength: rules.responseLength,
          speakingStyle: rules.speakingStyle,
          dialect: rules.dialect,
          rulesCount: rules.rules?.length || 0
        });
        const rulesPrompt = buildPromptFromRules(rules);
        prompt += rulesPrompt;
        console.log('✅ [RESPONSE-RULES] Response rules added to prompt, length:', rulesPrompt.length);
      } catch (e) {
        console.warn('⚠️ [RESPONSE-RULES] Failed to parse responseRules:', e.message);
        // استخدام القواعد الافتراضية في حالة الخطأ
        const defaultRulesPrompt = buildPromptFromRules(getDefaultRules());
        prompt += defaultRulesPrompt;
        console.log('⚠️ [RESPONSE-RULES] Using default rules instead');
      }
    } else {
      // استخدام القواعد الافتراضية إذا لم تكن موجودة
      console.log('⚠️ [RESPONSE-RULES] No response rules found, using defaults');
      const defaultRulesPrompt = buildPromptFromRules(getDefaultRules());
      prompt += defaultRulesPrompt;
    }

    // 🆕 Check if this is a post product response - سيتم إضافة معلومات المنتج في الـ prompt العادي
    console.log(`🔍 [POST-PRODUCT-RESPONSE-CHECK] Checking for post product response:`);
    console.log(`   - isPostProductResponse: ${messageData?.isPostProductResponse}`);
    console.log(`   - ragData length: ${ragData?.length || 0}`);
    
    let postProductInfo = null;
    if (messageData?.isPostProductResponse && ragData && ragData.length > 0) {
      const product = ragData[0];
      const productName = product.metadata?.name || product.name || 'المنتج';
      const productPrice = product.metadata?.price || product.price || 'غير متوفر';
      
      postProductInfo = {
        name: productName,
        price: productPrice
      };
      
      console.log(`📌 [POST-PRODUCT-RESPONSE] Product found: ${productName} - ${productPrice}`);
      console.log(`   ✅ سيتم إضافة معلومات المنتج في الـ prompt العادي`);
    }

    // ✅ FIX: تم نقل تحذير عدم الترحيب إلى قسم سجل المحادثة لتجنب التكرار

    // ✨ تحليل ذكي مختصر للسياق
    try {
      const dynamicBuilder = require('../dynamicPromptBuilder');
      
      const emotionalState = dynamicBuilder.detectEmotionalState(customerMessage);
      const customerTone = dynamicBuilder.detectCustomerTone(customerMessage);
      const urgencyLevel = dynamicBuilder.detectUrgencyLevel(customerMessage);
      
      // إضافة ملاحظات مختصرة فقط عند الضرورة
      let contextNotes = [];
      if (emotionalState === 'frustrated') contextNotes.push('⚠️ العميل منزعج - تعاطفي معاه');
      if (urgencyLevel === 'high') contextNotes.push('⚡ رد سريع ومباشر');
      if (customerTone === 'formal' && emotionalState !== 'frustrated') contextNotes.push('📝 حافظي على الرسمية');
      
      if (contextNotes.length > 0) {
        prompt += `💡 ملاحظات: ${contextNotes.join(' • ')}\n\n`;
      }
    } catch (dynamicError) {
      // المتابعة بدون التحليل إذا فشل
    }

    // 🚚 إضافة معلومات الشحن إذا كان العميل يسأل عنها أو ذكر محافظة
    try {
      const shippingService = require('../shippingService');
      const companyId = messageData?.companyId || customerData?.companyId;
      
      if (companyId) {
        // فحص إذا كان العميل يسأل عن الشحن
        const isAskingAboutShipping = shippingService.isAskingAboutShipping(customerMessage);
        
        // ✅ FIX: محاولة استخراج المحافظة من الرسالة والمحادثة السابقة
        const extractedGov = await shippingService.extractGovernorateFromMessage(customerMessage, companyId, conversationMemory);
        
        if (isAskingAboutShipping || extractedGov.found) {
          // ✅ FIX: إضافة تحذير صريح للرد على سؤال الشحن مباشرة
          prompt += `🚨🚨🚨 تنبيه مهم جداً - العميل يسأل عن الشحن:\n`;
          prompt += `=====================================\n`;
          prompt += `⚠️ يجب الرد على سؤال العميل مباشرة: "${customerMessage}"\n`;
          prompt += `❌ ممنوع: الخروج من السياق أو السؤال عن شيء آخر (مثل: "تحبي أكملك الأوردر؟")\n`;
          prompt += `❌ ممنوع: تجاهل سؤال العميل والانتقال لموضوع آخر\n`;
          prompt += `✅ يجب: الرد على السؤال المطروح مباشرة أولاً\n`;
          prompt += `=====================================\n\n`;
          
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
              prompt += `⚠️ مهم جداً - استخدام معلومات الشحن:\n`;
              prompt += `   ❌ ممنوع منعاً باتاً اختراع أو تغيير سعر الشحن!\n`;
              prompt += `   ✅ يجب استخدام السعر المذكور أعلاه بالضبط: ${shippingInfo.price} جنيه\n`;
              prompt += `   ✅ يجب استخدام مدة التوصيل المذكورة أعلاه بالضبط: ${shippingInfo.deliveryTime}\n`;
              prompt += `   ❌ لا تقولي "75 جنيه" أو أي سعر آخر - استخدمي ${shippingInfo.price} جنيه فقط!\n`;
              prompt += `   💡 استخدمي هذه المعلومات للرد على العميل بشكل طبيعي وودود.\n`;
              prompt += `   🚨🚨🚨 مهم جداً: يجب الرد على سؤال العميل مباشرة: "الشحن ${shippingInfo.price} جنيه"\n\n`;
            } else {
              prompt += `🚚 معلومات الشحن:\n`;
              prompt += `=====================================\n`;
              prompt += `❌ للأسف، لا يوجد شحن متاح لمحافظة "${extractedGov.governorate}" حالياً.\n`;
              prompt += `💡 اعتذري للعميل بشكل لطيف واقترحي عليه التواصل للبحث عن حل بديل.\n`;
              prompt += `🚨🚨🚨 مهم جداً: يجب الرد على سؤال العميل مباشرة أولاً\n`;
              prompt += `=====================================\n\n`;
            }
          } else {
            // ✅ FIX: العميل يسأل عن الشحن لكن لم يذكر المحافظة في الرسالة الحالية
            // ✅ FIX: فحص المحادثة السابقة أولاً قبل السؤال
            const extractedFromMemory = await shippingService.extractGovernorateFromMessage('', companyId, conversationMemory);
            
            if (extractedFromMemory.found) {
              // ✅ تم العثور على محافظة في المحادثة السابقة
              const shippingInfo = await shippingService.findShippingInfo(extractedFromMemory.governorate, companyId);
              
              if (shippingInfo && shippingInfo.found) {
                prompt += `🚚 معلومات الشحن (من المحادثة السابقة):\n`;
                prompt += `=====================================\n`;
                prompt += `📍 المحافظة: ${shippingInfo.governorate} (مذكورة سابقاً في المحادثة)\n`;
                prompt += `💰 سعر الشحن: ${shippingInfo.price} جنيه\n`;
                prompt += `⏰ مدة التوصيل: ${shippingInfo.deliveryTime}\n`;
                prompt += `=====================================\n`;
                prompt += `🚨🚨🚨 مهم جداً:\n`;
                prompt += `   ✅ المحافظة مذكورة سابقاً في المحادثة: "${shippingInfo.governorate}"\n`;
                prompt += `   ✅ يجب الرد مباشرة: "الشحن ${shippingInfo.price} جنيه"\n`;
                prompt += `   ❌ ممنوع: السؤال عن المحافظة مرة أخرى - العميل ذكرها سابقاً!\n`;
                prompt += `   ❌ ممنوع: تجاهل المعلومات المذكورة سابقاً\n`;
                prompt += `   ❌ ممنوع: الاعتذار أو القول "لخبطت" - استخدمي المعلومات مباشرة\n\n`;
              } else {
                // المحافظة موجودة لكن لا يوجد شحن متاح
                prompt += `🚚 معلومات الشحن:\n`;
                prompt += `=====================================\n`;
                prompt += `❌ للأسف، لا يوجد شحن متاح لمحافظة "${extractedFromMemory.governorate}" (المذكورة سابقاً) حالياً.\n`;
                prompt += `💡 اعتذري للعميل بشكل لطيف واقترحي عليه التواصل للبحث عن حل بديل.\n`;
                prompt += `🚨🚨🚨 مهم جداً: لا تسألي عن المحافظة مرة أخرى - العميل ذكرها سابقاً!\n`;
                prompt += `=====================================\n\n`;
              }
            } else {
              // لم يتم العثور على محافظة في المحادثة - اطلبي من العميل
              const availableGovernorates = await shippingService.getAvailableGovernorates(companyId);
              
              if (availableGovernorates.length > 0) {
                prompt += `🚚 معلومات الشحن المتاحة:\n`;
                prompt += `=====================================\n`;
                prompt += `💡 العميل يسأل عن الشحن لكن لم يحدد المحافظة في الرسالة الحالية أو المحادثة السابقة.\n`;
                prompt += `📋 المحافظات المتاحة للشحن:\n`;
                availableGovernorates.slice(0, 10).forEach((gov, index) => {
                  prompt += `   ${index + 1}. ${gov.name} - ${gov.price} جنيه (${gov.deliveryTime})\n`;
                });
                if (availableGovernorates.length > 10) {
                  prompt += `   ... و ${availableGovernorates.length - 10} محافظة أخرى\n`;
                }
                prompt += `=====================================\n`;
                prompt += `🚨🚨🚨 مهم جداً - الرد على سؤال الشحن:\n`;
                prompt += `   ✅ يجب الرد على سؤال العميل مباشرة: "الشحن كام؟"\n`;
                prompt += `   ✅ اسألي العميل عن محافظته بشكل ودود لتعطيه السعر الدقيق\n`;
                prompt += `   ❌ ممنوع: الخروج من السياق أو السؤال عن شيء آخر (مثل: "تحبي أكملك الأوردر؟")\n`;
                prompt += `   ❌ ممنوع: تجاهل سؤال العميل والانتقال لموضوع آخر\n`;
                prompt += `   ✅ يجب: الرد على السؤال المطروح مباشرة أولاً، ثم يمكنك السؤال عن المحافظة\n\n`;
              }
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

    // Add customer information with dynamic context
    const isNewCustomer = !customerData?.orderCount || customerData.orderCount === 0;
    const conversationLength = conversationMemory?.length || 0;

    prompt += `معلومات العميل:
- الاسم: ${customerData?.name || 'عميل جديد'}
- الهاتف: ${customerData?.phone || 'غير محدد'}
- ${isNewCustomer ? '🆕 عميل جديد (أول مرة يتواصل معانا)' : `عميل راجع (عنده ${customerData.orderCount} طلب سابق)`}
- مرحلة المحادثة: ${conversationLength === 0 ? 'بداية المحادثة' : conversationLength < 3 ? 'في بداية التفاعل' : 'محادثة متقدمة'}\n`;

    // ✅ FIX: تم نقل تعليمات قراءة المحادثة إلى قسم سجل المحادثة لتجنب التكرار

    // 🆕 إضافة معلومات المنتج المميز من البوست إذا كان موجوداً
    if (postProductInfo) {
      prompt += `🎯🎯🎯 معلومات مهمة جداً - العميل جاء من بوست 🎯🎯🎯\n`;
      prompt += `=====================================\n`;
      prompt += `📌 العميل جاء من منشور على Facebook.\n`;
      prompt += `🛍️ المنتج المميز المرتبط بهذا المنشور:\n`;
      prompt += `   - الاسم: ${postProductInfo.name}\n`;
      prompt += `   - السعر: ${postProductInfo.price} جنيه\n\n`;
      prompt += `⚠️ تعليمات مهمة جداً:\n`;
      prompt += `1. ✅ عندما يسأل العميل عن السعر أو المنتج، اذكري اسم المنتج وسعره بوضوح\n`;
      prompt += `2. ✅ استخدمي الصيغة: "${postProductInfo.name} - ${postProductInfo.price} جنيه"\n`;
      prompt += `3. ✅ ردّي بشكل طبيعي وودود كما تفعلين عادة\n`;
      prompt += `4. ✅ يمكنك إضافة كلام طبيعي قبل أو بعد ذكر المنتج والسعر\n`;
      prompt += `5. ✅ مثال على رد جيد: "أهلاً بيك! ${postProductInfo.name} - ${postProductInfo.price} جنيه. عايز تفاصيل أكتر عن المنتج؟"\n`;
      prompt += `6. ❌ لا تنسي ذكر اسم المنتج والسعر في ردك\n`;
      prompt += `=====================================\n\n`;
      
      console.log(`📌 [POST-PRODUCT-INFO] Added post product info to prompt: ${postProductInfo.name} - ${postProductInfo.price}`);
    }
    
    // 🆕 إضافة معلومات المنشور إذا كانت متوفرة
    if (messageData?.postDetails) {
      const postDetails = messageData.postDetails;
      prompt += `📌 معلومات المنشور الذي جاء منه العميل:\n`;
      prompt += `=====================================\n`;
      
      if (postDetails.message) {
        prompt += `📝 نص المنشور:\n"${postDetails.message}"\n\n`;
      }
      
      if (postDetails.hasImages && postDetails.imageUrls && postDetails.imageUrls.length > 0) {
        prompt += `🖼️ المنشور يحتوي على ${postDetails.imageUrls.length} صورة\n`;
        prompt += `💡 استخدمي هذه المعلومات لفهم المنتج/الخدمة التي يسأل عنها العميل\n\n`;
      }
      
      if (postDetails.permalinkUrl) {
        prompt += `🔗 رابط المنشور: ${postDetails.permalinkUrl}\n\n`;
      }
      
      prompt += `💡 مهم: العميل جاء من هذا المنشور - استخدمي محتوى المنشور لفهم السياق ومساعدة العميل بشكل أفضل\n`;
      if (!postProductInfo) {
        prompt += `💡 إذا سأل العميل عن السعر أو المنتج بدون تحديد، فالمقصود هو المنتج المذكور في المنشور أعلاه\n`;
      }
      prompt += `=====================================\n\n`;
      
      console.log(`📌 [POST-CONTEXT] Added post details to prompt`);
    }

    // 🔄 إضافة معلومات الرد إذا كان العميل يرد على رسالة سابقة
    if (messageData?.replyContext?.isReply) {
      prompt += `🔄 سياق الرد - العميل يرد على رسالة سابقة:\n`;
      prompt += `=====================================\n`;

      if (messageData.replyContext.originalMessage?.content) {
        prompt += `📝 الرسالة الأصلية التي يرد عليها العميل:\n`;
        prompt += `"${messageData.replyContext.originalMessage.content}"\n\n`;

        const originalDate = new Date(messageData.replyContext.originalMessage.createdAt);
        const timeAgo = this.aiAgentService.getTimeAgo(originalDate);
        prompt += `⏰ تم إرسال الرسالة الأصلية منذ: ${timeAgo}\n\n`;
      } else {
        prompt += `📝 العميل يرد على رسالة سابقة (المحتوى غير متوفر)\n\n`;
      }

      prompt += `💬 رد العميل الحالي: "${customerMessage}"\n`;
      prompt += `=====================================\n`;
      prompt += `💡 مهم: اربطي ردك بالرسالة الأصلية وتأكدي من الاستمرارية في السياق.\n\n`;
    }

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
    
    // Add conversation memory if available
    console.log('📚 [MEMORY-CHECK] فحص سجل المحادثة:');
    console.log('  - conversationMemory موجود؟', !!conversationMemory);
    console.log('  - عدد الرسائل:', conversationMemory?.length || 0);
    
    // 🔍 استخراج آخر منتج تم السؤال عنه من المحادثة
    let lastMentionedProduct = null;
    let lastProductContext = null;
    
    // ✅ استخدام productExtractor module لاستخراج المنتج
    const productInfo = productExtractor.extractProduct(customerMessage, conversationMemory, ragData);
    if (productInfo) {
      lastMentionedProduct = productInfo.productName;
      lastProductContext = productInfo.context;
    }
    
    if (conversationMemory && conversationMemory.length > 0) {
      console.log('✅ [MEMORY] تم العثور على سجل محادثة:', conversationMemory.length, 'رسالة');
      
      conversationMemory.slice(0, 3).forEach((interaction, index) => {
        console.log(`  ${index + 1}. ${interaction.isFromCustomer ? 'العميل' : 'AI'}: ${interaction.content?.substring(0, 50)}...`);
      });
      
      // ✅ FIX: تعليمات موحدة ومختصرة لتجنب التكرار
      const aiMessagesCount = conversationMemory.filter(msg => !msg.isFromCustomer).length;
      prompt += `📚 سجل المحادثة:\n`;
      prompt += `=====================================\n`;
      if (aiMessagesCount > 0) {
        prompt += `🚫 ممنوع الترحيب - المحادثة مستمرة (${aiMessagesCount} رد سابق)\n`;
      }
      prompt += `⚠️ اقرأي المحادثة قبل السؤال عن أي معلومات - استخدمي المعلومات المذكورة سابقاً مباشرة\n`;
      prompt += `✅ اربطي ردك بالمحادثة السابقة باستخدام: "زي ما ذكرتلك قبل كده"، "كما وضحتلك سابقاً"\n`;
      prompt += `🚨🚨🚨 مهم جداً جداً - قواعد تجنب التكرار:\n`;
      prompt += `1. ❌ لا تذكري معلومات لم يطلبها المستخدم في الرسالة الحالية\n`;
      prompt += `2. ❌ لا تذكري منتج محدد إذا لم يذكره المستخدم في الرسالة الحالية (مثل: "كوتشي سوان سكوتشي")\n`;
      prompt += `3. ❌ لا تذكري محافظة أو مدينة إذا لم يذكرها المستخدم في الرسالة الحالية (مثل: "بما إنك ذكرتي القاهرة")\n`;
      prompt += `4. ❌ لا تذكري معلومات الشحن إذا لم يطلبها المستخدم في الرسالة الحالية\n`;
      prompt += `5. ✅ ركزي على ما طلبه المستخدم في الرسالة الحالية فقط\n`;
      prompt += `6. ✅ إذا كان المستخدم يسأل عن شيء عام (مثل: "عايزه اعمل اوردر")، اسأليه عن المعلومات المطلوبة فقط بدون ذكر معلومات إضافية\n`;
      prompt += `=====================================\n\n`;
      
      // ✅ تحسين: تقليل عدد الرسائل من 10 إلى 5 لتوفير tokens
      const recentMessages = conversationMemory.slice(-5);
      
      // ✅ FIX: إضافة عنوان أوضح للمحادثة السابقة
      prompt += `📋 تفاصيل المحادثة السابقة (آخر ${recentMessages.length} رسالة):\n`;
      prompt += `=====================================\n`;
      
      recentMessages.forEach((interaction, index) => {
        const sender = interaction.isFromCustomer ? 'العميل' : 'أنتِ (النظام)';
        const content = interaction.content || '[رسالة فارغة]';
        const intent = interaction.intent || 'غير محدد';
        const position = conversationMemory.length - recentMessages.length + index + 1;
        
        // ✅ FIX: تحسين عرض كل رسالة مع معلومات أكثر وضوحاً
        prompt += `[${position}] ${sender}:\n`;
        prompt += `   "${content}"\n`;
        if (interaction.isFromCustomer && intent !== 'غير محدد') {
          prompt += `   → النية: ${intent}\n`;
        }
        
        // ✅ FIX: إضافة معلومات أكثر وضوحاً عن المنتجات/الأسعار المذكورة
        if (interaction.isFromCustomer && content) {
          const contentLower = content.toLowerCase();
          if (contentLower.includes('منتج') || contentLower.includes('كوتشي') || 
              contentLower.includes('حذاء') || contentLower.includes('بوت') ||
              contentLower.includes('هاف') || contentLower.includes('ugg')) {
            prompt += `   → 💡 ذكر منتج في هذه الرسالة - استخدمي هذه المعلومات!\n`;
          }
          if (contentLower.includes('سعر') || contentLower.includes('كام') || 
              contentLower.includes('بكام') || contentLower.includes('بكم') ||
              contentLower.includes('جنيه')) {
            prompt += `   → 💰 ذكر سعر في هذه الرسالة - استخدمي هذه المعلومات!\n`;
          }
          if (contentLower.includes('مقاس') || contentLower.includes('لون') || 
              contentLower.includes('الوان') || contentLower.includes('أسود') ||
              contentLower.includes('أبيض')) {
            prompt += `   → 📏 ذكر مواصفات (مقاس/لون) في هذه الرسالة - استخدمي هذه المعلومات!\n`;
          }
          if (contentLower.includes('عنوان') || contentLower.includes('محافظة') || 
              contentLower.includes('هاتف') || contentLower.includes('اسم') ||
              contentLower.includes('القاهرة') || contentLower.includes('الإسكندرية')) {
            prompt += `   → 📍 ذكر بيانات (عنوان/محافظة/هاتف/اسم) في هذه الرسالة - استخدمي هذه المعلومات!\n`;
          }
        }
        
        prompt += `\n`;
        
        if (!interaction.content || interaction.content.trim() === '') {
          console.warn(`⚠️ [MEMORY-EMPTY] رسالة ${position} فارغة في سجل المحادثة`);
        }
      });
      
      prompt += `=====================================\n`;
      // ✅ FIX: تم إزالة التكرار - التعليمات موجودة في البداية
      
      // ✅ إضافة سياق آخر منتج مذكور (محسّن)
      if (lastMentionedProduct) {
        const isAskingForImages = msgLower.includes('صور') || msgLower.includes('صوره') || 
                                  msgLower.includes('الصور') || msgLower.includes('ابعت') ||
                                  msgLower.includes('ارسل') || msgLower.includes('شوف') ||
                                  msgLower.includes('ممكن أشوف') || msgLower.includes('عايز أشوف');
        const isAskingForInfo = msgLower.includes('معلومات') || msgLower.includes('تفاصيل') ||
                               msgLower.includes('مواصفات') || msgLower.includes('وصف');
        const isAskingForOrder = msgLower.includes('اوردر') || msgLower.includes('أوردر') || 
                                msgLower.includes('اطلب') || msgLower.includes('أطلب') ||
                                msgLower.includes('اشتري') || msgLower.includes('أشتري') ||
                                msgLower.includes('عايز أطلب') || msgLower.includes('عايز اشتري');
        const isAskingForPrice = msgLower.includes('سعر') || msgLower.includes('سعره') || 
                                msgLower.includes('بكام') || msgLower.includes('بكم') ||
                                msgLower.includes('كام') || msgLower.includes('ثمن') ||
                                msgLower.includes('كم') || msgLower.includes('شحال');
        
        const hasNoProductInCurrentMessage = !ragData || ragData.length === 0;
        
        if ((isAskingForImages || isAskingForInfo || isAskingForOrder || isAskingForPrice) && hasNoProductInCurrentMessage) {
          let requestType = 'صور';
          if (isAskingForOrder) requestType = 'طلب/أوردر';
          else if (isAskingForInfo) requestType = 'معلومات/تفاصيل';
          else if (isAskingForPrice) requestType = 'السعر';
          
          prompt += `\n🎯🎯🔴 مهم جداً - سياق المحادثة الحالي:\n`;
          prompt += `=====================================\n`;
          prompt += `📌 آخر منتج تم السؤال عنه في المحادثة: "${lastMentionedProduct}"\n`;
          if (lastProductContext) {
            prompt += `💬 السياق من المحادثة السابقة: ${lastProductContext.substring(0, 150)}...\n\n`;
          }
          prompt += `⚠️⚠️⚠️ العميل يطلب ${requestType} بدون تحديد منتج في الرسالة الحالية!\n\n`;
          prompt += `✅✅✅ المقصود هو المنتج: "${lastMentionedProduct}"\n\n`;
          
          if (isAskingForPrice) {
            prompt += `💰 تعليمات للإجابة على سؤال السعر:\n`;
            prompt += `   - اذكري اسم المنتج "${lastMentionedProduct}" بوضوح\n`;
            prompt += `   - اذكري السعر من قاعدة البيانات\n`;
            prompt += `   - إذا كان هناك خصومات، اذكريها\n`;
            prompt += `   - اسألي عن المحافظة لحساب تكلفة الشحن\n`;
            prompt += `   - استخدمي عبارات مثل "سعر ${lastMentionedProduct} هو..." أو "بخصوص ${lastMentionedProduct}..."\n\n`;
          } else if (isAskingForOrder) {
            prompt += `🛒 تعليمات لإتمام الطلب:\n`;
            prompt += `   - تأكدي أن المنتج "${lastMentionedProduct}" متوفر\n`;
            prompt += `   - اسألي عن المقاس (إذا كان مطلوباً)\n`;
            prompt += `   - اسألي عن اللون (إذا كان مطلوباً)\n`;
            prompt += `   - اسألي عن المحافظة للشحن\n`;
            prompt += `   - اسألي عن العنوان والهاتف (إذا لم يتم ذكرهما سابقاً)\n`;
            prompt += `   - استخدمي عبارات مثل "بخصوص طلب ${lastMentionedProduct}..."\n\n`;
          } else if (isAskingForImages) {
            prompt += `📸 الصور ستُرسل تلقائياً - اذكري المنتج فقط بدون ذكر الصور\n\n`;
          } else if (isAskingForInfo) {
            prompt += `📋 تعليمات لإعطاء المعلومات:\n`;
            prompt += `   - اذكري معلومات شاملة عن "${lastMentionedProduct}"\n`;
            prompt += `   - اذكري المواصفات والأسعار من قاعدة البيانات\n`;
            prompt += `   - استخدمي عبارات مثل "بخصوص ${lastMentionedProduct}..."\n\n`;
          }
          
          prompt += `💡💡💡 مهم جداً:\n`;
          prompt += `   - استخدمي اسم المنتج "${lastMentionedProduct}" في ردك\n`;
          prompt += `   - اربطي ردك بالسياق من المحادثة السابقة\n`;
          prompt += `   - لا تسألي عن المنتج مرة أخرى (تم ذكره سابقاً)\n`;
          prompt += `=====================================\n\n`;
          
          console.log('🚨 [CONTEXT-AWARE] العميل يطلب', requestType, 'عن آخر منتج:', lastMentionedProduct);
        } else {
          prompt += `\n🎯 معلومات عن المحادثة السابقة:\n`;
          prompt += `=====================================\n`;
          prompt += `📌 آخر منتج تم السؤال عنه: "${lastMentionedProduct}"\n`;
          if (lastProductContext) {
            prompt += `💬 السياق: ${lastProductContext.substring(0, 100)}...\n`;
          }
          prompt += `💡 إذا طلب العميل صور/معلومات/أوردر/سعر بدون تحديد منتج، المقصود هو "${lastMentionedProduct}"\n`;
          prompt += `💡 استخدمي هذه المعلومات عند الحاجة في ردك\n`;
          prompt += `=====================================\n\n`;
        }
      }
      prompt += `\n`;
      
      console.log('✅ [MEMORY] تم إضافة سجل المحادثة للـ prompt');
    } else {
      console.log('⚠️ [MEMORY] لا يوجد سجل محادثة - هذا أول تفاعل');
      prompt += `💡 أول تفاعل - رحبي بالعميل.\n\n`;
    }

    // ✅ استخدام متغير محلي لـ ragData لإمكانية التعديل
    let filteredRagData = ragData;
    
    // ✅ إذا كان هناك lastMentionedProduct وسؤال عن السعر، البحث عن المنتج الصحيح في ragData
    if (isPriceQuestion && lastMentionedProduct && filteredRagData && filteredRagData.length > 0) {
      const matchingProduct = filteredRagData.find(item => {
        const productName = item.metadata?.name || item.name || '';
        return productName.toLowerCase().includes(lastMentionedProduct.toLowerCase()) ||
               lastMentionedProduct.toLowerCase().includes(productName.toLowerCase());
      });
      
      if (matchingProduct) {
        console.log('✅ [PRICE-QUESTION] تم العثور على منتج مطابق في ragData:', matchingProduct.metadata?.name || matchingProduct.name);
        filteredRagData = [matchingProduct];
      } else {
        console.log('⚠️ [PRICE-QUESTION] المنتج المذكور آخر مرة غير موجود في ragData - سيتم استخدام ragData الحالي');
      }
    }
    
    // 🎯 إضافة قسم خاص لأول رسالة سؤال عن السعر مع المنتجات الممولة
    if (messageData?.isFirstPriceInquiry && filteredRagData && filteredRagData.length > 0) {
      const hasPostProduct = messageData?.hasPostProduct;
      const promotedCount = messageData?.promotedProductsCount || filteredRagData.length;
      
      prompt += `🎯🎯🎯 حالة خاصة: أول رسالة سؤال عن السعر - منتجات ممولة 🎯🎯🎯\n`;
      prompt += `=====================================\n`;
      
      if (hasPostProduct) {
        prompt += `📌 تم العثور على منتج مرتبط بالإعلان الذي دخل منه العميل.\n`;
        prompt += `✅ يجب الرد على العميل باسم المنتج وسعره مباشرة بناءً على محتوى المنشور.\n\n`;
      } else {
        prompt += `📢 العميل يسأل عن السعر لأول مرة من إعلان ممول.\n`;
        prompt += `✅ يجب الرد بالمنتجات الممولة المتاحة (${promotedCount} منتج).\n\n`;
      }
      
      prompt += `🗃️ المنتجات الممولة المتاحة (يجب استخدامها في الرد):\n`;
      prompt += `=====================================\n`;

      filteredRagData.forEach((item, index) => {
        if (item.type === 'product') {
          const productName = item.metadata?.name || 'منتج';
          const productPrice = item.metadata?.price;
          prompt += `🛍️ منتج ${index + 1}: ${productName}\n`;
          
          // ✅ IMPROVED: Only show price if it exists and is valid
          if (productPrice && typeof productPrice === 'number' && productPrice > 0) {
            prompt += `   💰 السعر: ${productPrice} جنيه\n`;
          } else if (productPrice && typeof productPrice === 'string' && productPrice !== 'غير متوفر') {
            const numericPrice = parseFloat(productPrice);
            if (!isNaN(numericPrice) && numericPrice > 0) {
              prompt += `   💰 السعر: ${numericPrice} جنيه\n`;
            } else {
              prompt += `   💰 السعر: غير متوفر حالياً\n`;
            }
          } else {
            prompt += `   💰 السعر: غير متوفر حالياً\n`;
          }
          
          // ✅ FIX: استخراج معلومات الألوان والمقاسات من metadata.variants بشكل صريح
          if (item.metadata?.variants && Array.isArray(item.metadata.variants) && item.metadata.variants.length > 0) {
            const colorVariants = item.metadata.variants.filter(v => v.type === 'color');
            const sizeVariants = item.metadata.variants.filter(v => v.type === 'size');
            
            if (colorVariants.length > 0) {
              const availableColors = colorVariants.map(v => v.name).filter(Boolean);
              if (availableColors.length > 0) {
                prompt += `   🎨 الألوان المتاحة: ${availableColors.join('، ')}\n`;
              }
            }
            
            if (sizeVariants.length > 0) {
              const availableSizes = sizeVariants.map(v => v.name).filter(Boolean);
              if (availableSizes.length > 0) {
                prompt += `   📏 المقاسات المتاحة: ${availableSizes.join('، ')}\n`;
              }
            }
          }
          
          prompt += `   ${item.content}\n\n`;
        }
      });

      prompt += `=====================================\n\n`;
      prompt += `⚠️ تعليمات مهمة جداً:\n`;
      prompt += `1. ✅ اذكري اسم المنتج/المنتجات وسعرها/أسعارها بوضوح\n`;
      prompt += `2. ✅ إذا كان هناك منتج واحد، اذكري اسمه وسعره مباشرة\n`;
      prompt += `3. ✅ إذا كان هناك أكثر من منتج، اذكري جميع المنتجات مع أسعارها\n`;
      prompt += `4. ✅ استخدمي لغة ودودة ومهذبة\n`;
      prompt += `5. ✅ استخدمي معلومات المنشور (postDetails) إذا كانت متوفرة لفهم السياق\n`;
      prompt += `6. ❌ لا تذكري أي منتجات غير موجودة في القائمة أعلاه\n`;
      prompt += `7. ❌ لا تذكري منتجات بدون إعلان ممول\n\n`;
    } else if (filteredRagData && filteredRagData.length > 0) {
      // Add RAG data if available (استخدام filteredRagData)
      const isCategoryRequest = smartResponseInfo?.categoryInfo;
      
      if (isCategoryRequest) {
        // طلب category - عرض جميع المنتجات من التصنيف
        prompt += `📦 المنتجات المتاحة من التصنيف "${smartResponseInfo.categoryInfo.categoryName}":\n`;
        prompt += `=====================================\n`;
        prompt += `📊 إجمالي المنتجات: ${smartResponseInfo.categoryInfo.totalProducts}\n`;
        prompt += `📸 إجمالي الصور: ${smartResponseInfo.categoryInfo.totalImages}\n\n`;
        
        filteredRagData.forEach((item, index) => {
          if (item.type === 'product' && item.metadata) {
            prompt += `${index + 1}. ${item.metadata.name}\n`;
            prompt += `   💰 السعر: ${item.metadata.price} جنيه\n`;
            prompt += `   📦 المخزون: ${item.metadata.stock > 0 ? 'متوفر' : 'غير متوفر'}\n`;
            prompt += `   📸 الصور: ${item.metadata.images?.length || 0} صورة\n\n`;
          }
        });
        
        prompt += `=====================================\n`;
        // ✅ FIX: تم نقل معلومات الصور إلى قسم تعليمات الجودة لتجنب التكرار
      } else {
        // طلب منتج محدد أو منتجات متعددة - العرض العادي
        prompt += `🗃️ المعلومات المتاحة من قاعدة البيانات (استخدميها فقط):\n`;
        prompt += `=====================================\n`;

        const imageInfo = [];

        filteredRagData.forEach((item, index) => {
          if (item.type === 'product') {
            const productName = item.metadata?.name || 'منتج';
            prompt += `🛍️ منتج ${index + 1}: ${productName}\n`;
            
            // ✅ FIX: استخراج معلومات الألوان والمقاسات من metadata.variants بشكل صريح
            if (item.metadata?.variants && Array.isArray(item.metadata.variants) && item.metadata.variants.length > 0) {
              const colorVariants = item.metadata.variants.filter(v => v.type === 'color');
              const sizeVariants = item.metadata.variants.filter(v => v.type === 'size');
              
              if (colorVariants.length > 0) {
                const availableColors = colorVariants.map(v => v.name).filter(Boolean);
                if (availableColors.length > 0) {
                  prompt += `   🎨 الألوان المتاحة: ${availableColors.join('، ')}\n`;
                }
              }
              
              if (sizeVariants.length > 0) {
                const availableSizes = sizeVariants.map(v => v.name).filter(Boolean);
                if (availableSizes.length > 0) {
                  prompt += `   📏 المقاسات المتاحة: ${availableSizes.join('، ')}\n`;
                }
              }
            }
            
            prompt += `   ${item.content}\n`;

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

        // ✅ FIX: تم نقل معلومات الصور إلى قسم تعليمات الجودة لتجنب التكرار
      }
    }

    // ✅ Add comprehensive response quality guidelines with image/price validation
    prompt += `🔴 تعليمات جودة الرد (مهمة جداً):\n`;
    prompt += `=====================================\n`;
    prompt += `1. ✅ الرد يجب أن يكون شاملاً ومفيداً:\n`;
    prompt += `   - الرد المثالي: 50-300 كلمة (ليست قصيرة جداً وليست طويلة جداً)\n`;
    prompt += `   - يجب أن يحتوي على المعلومات المطلوبة من قاعدة البيانات\n`;
    prompt += `   - يجب أن يكون واضحاً ومباشراً لكن مهذباً\n`;
    prompt += `   - استخدمي شخصيتك المحددة في الـ personality prompt أعلاه\n\n`;
    prompt += `2. ✅ عند الأسئلة الغامضة، اطلبي توضيح:\n`;
    prompt += `   - إذا كان السؤال غامضاً (مثل: "ممكن" أو "عايز حاجة")، اسألي عن التفاصيل\n`;
    prompt += `   - اسألي عن نوع المنتج، الاستخدام، الميزانية، إلخ\n`;
    prompt += `   - قدمي اقتراحات مفيدة بناءً على المعلومات المتاحة\n\n`;
    prompt += `3. ✅ استخدمي المعلومات من قاعدة البيانات:\n`;
    prompt += `   - استخدمي فقط المعلومات الموجودة في قاعدة البيانات المذكورة أعلاه\n`;
    prompt += `   - لا تذكري منتجات غير موجودة في قاعدة البيانات\n`;
    prompt += `   - اذكري الأسعار والمواصفات بدقة من قاعدة البيانات\n`;
    prompt += `   - إذا لم تجدي معلومات، اطلبي توضيحاً أو قولي أن المنتج غير متوفر\n\n`;
    prompt += `4. ✅ استخدمي السياق من المحادثة السابقة:\n`;
    prompt += `   - اربطي ردك بالرسائل السابقة في المحادثة\n`;
    prompt += `   - استخدمي المعلومات المذكورة سابقاً (المنتج، السعر، المقاس، إلخ)\n`;
    prompt += `   - أشرتي إلى المحادثة السابقة عند الحاجة (مثل: "زي ما وضحتلك قبل كده")\n\n`;
    prompt += `5. ✅ توجيه المحادثة بشكل صحيح:\n`;
    prompt += `   - في نهاية الرد، اسألي سؤالاً أو قدمي اقتراحاً لتوجيه المحادثة\n`;
    prompt += `   - اسألي عن المزيد من المعلومات إذا لزم الأمر\n`;
    prompt += `   - قدمي خطوات واضحة للعميل (مثل: "لو عايز تطلب، محتاج منك...")\n\n`;
    
    // ✅ FIX: قواعد الصور والأسعار - موحدة ومختصرة
    prompt += `🚨 قواعد مهمة:\n`;
    prompt += `=====================================\n`;
    if (hasImages) {
      prompt += `📸 الصور ستُرسل تلقائياً - لا تذكريها في النص | ❌ ممنوع: "[صورة]" أو "هبعتلك الصور"\n`;
    } else {
      prompt += `📸 لا توجد صور - لا تذكري الصور أو تطلبيها من العميل\n`;
    }
    prompt += `💰 الأسعار: استخدمي الرقم الدقيق من قاعدة البيانات فقط | ❌ ممنوع: "السعر مناسب" بدون رقم\n`;
    prompt += `=====================================\n\n`;

    // Add customer message
    prompt += `رسالة العميل: "${customerMessage}"\n\n`;
    
    // ✅ Add response requirements based on message type
    const isAmbiguousMessage = customerMessage.length < 10 || 
                                msgLower === 'ممكن' || 
                                msgLower === 'ماشي' ||
                                msgLower.includes('حاجة حلوة') ||
                                msgLower.includes('حاجة') && !msgLower.includes('منتج') && !msgLower.includes('كوتشي');
    
    if (isAmbiguousMessage) {
      prompt += `⚠️ تنبيه: هذه رسالة غامضة!\n`;
      prompt += `=====================================\n`;
      prompt += `- الرسالة قصيرة أو غامضة ولا تحتوي على معلومات كافية\n`;
      prompt += `- يجب أن تطلبي توضيحاً من العميل\n`;
      prompt += `- اسألي عن نوع المنتج، الاستخدام، الميزانية، أو أي معلومات أخرى مفيدة\n`;
      prompt += `- قدمي اقتراحات بناءً على المنتجات المتاحة في قاعدة البيانات\n`;
      prompt += `=====================================\n\n`;
    }
    
    // Add concise contextual guidance
    if (filteredRagData && filteredRagData.length > 0) {
      const multipleProductsFound = smartResponseInfo?.multipleProducts && smartResponseInfo.multipleProducts.length > 1;
      
      const hasPromotedProduct = filteredRagData.some(item => 
        item.type === 'product' && 
        item.metadata && 
        item.metadata.hasPromotedAd === true
      );
      
      const promotedProducts = filteredRagData.filter(item => 
        item.type === 'product' && 
        item.metadata && 
        item.metadata.hasPromotedAd === true
      );
      
      let finalNotes = [];
      if (isPriceQuestion) {
        if (isNewCustomer && hasPromotedProduct && promotedProducts.length > 0) {
          const productsInfo = promotedProducts.map((product, index) => {
            const productName = product.metadata?.name || 'المنتج';
            let productPrice = '';
            if (product.metadata?.price) {
              productPrice = product.metadata.price.toString();
            } else if (product.content) {
              const priceMatch = product.content.match(/السعر[^:]*:\s*(\d+(?:\.\d+)?)/);
              if (priceMatch) {
                productPrice = priceMatch[1];
              }
            }
            return {
              name: productName,
              price: productPrice
            };
          }).filter(p => p.name && p.price);
          
          if (productsInfo.length > 0) {
            prompt += `\n⚠️ مهم جداً - حالة خاصة:\n`;
            prompt += `=====================================\n`;
            prompt += `🆕 العميل جديد (أول مرة يتواصل مع الشركة)\n`;
            prompt += `💰 يسأل عن السعر\n`;
            prompt += `📢 يوجد ${productsInfo.length} منتج${productsInfo.length > 1 ? 'ات' : ''} له${productsInfo.length > 1 ? 'م' : ''} إعلان${productsInfo.length > 1 ? 'ات' : ''} ممول${productsInfo.length > 1 ? 'ة' : ''} على Facebook\n`;
            prompt += `\n📋 المعلومات المطلوبة في الرد:\n`;
            
            productsInfo.forEach((product, index) => {
              prompt += `${index + 1}. اسم المنتج: "${product.name}" - السعر: ${product.price} جنيه\n`;
            });
            
            prompt += `\n- يجب أن تسألي العميل عن المحافظة (من أي محافظة أنت؟ / في أي محافظة بتسكن؟)\n`;
            prompt += `\n💡 ملاحظات مهمة:\n`;
            prompt += `- استخدمي شخصيتك وطريقة كلامك الطبيعية من الـ personality prompt أعلاه\n`;
            prompt += `- الرد يكون مختصر ومباشر لكن باسلوبك المميز\n`;
            prompt += `- لا تستخدمي كلام ثابت، بل ردّي بطريقتك بناءً على شخصيتك\n`;
            if (productsInfo.length > 1) {
              prompt += `- يجب أن تذكري جميع المنتجات الممولة وأسعارهم في الرد\n`;
              prompt += `- يمكنك تنظيم الرد بطريقة واضحة (مثلاً: قائمة أو نقاط)\n`;
            } else {
              prompt += `- تأكدي من ذكر اسم المنتج والسعر وسؤال عن المحافظة بطريقة طبيعية\n`;
            }
            prompt += `=====================================\n\n`;
          }
        } else {
          finalNotes.push('💰 السؤال عن السعر فقط');
        }
      }
      // ✅ FIX: تم نقل معلومات الصور إلى قسم تعليمات الجودة لتجنب التكرار
      
      if (multipleProductsFound) {
        finalNotes.push(`🎯 ${smartResponseInfo.multipleProducts.length} منتجات متاحة`);
      }
      
      if (finalNotes.length > 0) {
        prompt += `\n💡 ${finalNotes.join(' • ')}\n\n`;
      }
    }

    // ✅ Add final response quality check instructions
    prompt += `\n🔴 تعليمات نهائية لجودة الرد:\n`;
    prompt += `=====================================\n`;
    
    // ✅ قواعد منع المبالغة والحماس الزائد
    prompt += `🚫🚫🚫 ممنوع منعاً باتاً - عبارات مبالغ فيها:\n`;
    prompt += `❌ "مبسوطين جداً" أو "فرحانين" أو "يا هلا بيك"\n`;
    prompt += `❌ "اختيار رائع" أو "أحلى حاجة" أو "ولا في الأحلام"\n`;
    prompt += `❌ "في لمح البصر" أو "على طول" أو "مستنينك"\n`;
    prompt += `❌ "حاجة تحفة" أو "روعة" أو "جامدة جداً"\n`;
    prompt += `❌ أكثر من emoji واحد في الرد\n`;
    prompt += `❌ جمل طويلة أو فقرات متعددة غير ضرورية\n`;
    prompt += `✅ استخدمي لغة طبيعية بسيطة بدون حماس زائد\n\n`;
    
    prompt += `✅ قبل إرسال الرد، تأكدي من:\n`;
    prompt += `1. الرد قصير ومباشر (2-4 جمل max)\n`;
    prompt += `2. الرد يحتوي على المعلومات المطلوبة من قاعدة البيانات\n`;
    prompt += `3. الرد مرتبط بالسياق من المحادثة السابقة\n`;
    prompt += `4. الرد طبيعي وبسيط بدون مبالغة أو حماس زائد\n`;
    prompt += `5. الرد يوجه المحادثة بشكل صحيح (سؤال أو اقتراح في النهاية)\n`;
    prompt += `6. إذا كان السؤال غامضاً، تم طلب التوضيح\n`;
    prompt += `7. لم يتم تكرار المعلومات المطلوبة (إذا كانت موجودة في المحادثة السابقة)\n`;
    prompt += `8. 🚨🚨🚨 مهم جداً - الالتزام بالسياق:\n`;
    prompt += `   - ✅ يجب الرد على السؤال المطروح مباشرة أولاً\n`;
    prompt += `   - ❌ ممنوع: الخروج من السياق أو تجاهل السؤال\n`;
    prompt += `   - ❌ ممنوع: السؤال عن شيء آخر قبل الرد على السؤال الحالي\n`;
    prompt += `   - ✅ مثال: إذا سأل العميل "الشحن كام؟" يجب الرد على السؤال أولاً، ثم يمكنك السؤال عن المحافظة\n`;
    prompt += `9. 🚨🚨🚨 تجنب التكرار - قواعد صارمة:\n`;
    prompt += `   - ❌ لا تذكري معلومات لم يطلبها المستخدم في الرسالة الحالية\n`;
    prompt += `   - ❌ لا تذكري منتج محدد إذا لم يذكره المستخدم (مثل: "كوتشي سوان سكوتشي")\n`;
    prompt += `   - ❌ لا تذكري محافظة أو مدينة إذا لم يذكرها المستخدم (مثل: "بما إنك ذكرتي القاهرة")\n`;
    prompt += `   - ❌ لا تذكري معلومات الشحن إذا لم يطلبها المستخدم\n`;
    prompt += `   - ✅ ركزي على ما طلبه المستخدم في الرسالة الحالية فقط\n`;
    if (conversationMemory && conversationMemory.length > 0) {
      prompt += `9. 🚫 مهم جداً: إذا كانت هناك محادثة سابقة (${conversationMemory.length} رسالة)، لا تبدأي الرد بأي تحية!\n`;
      prompt += `   - ابدأي الرد مباشرة بالإجابة على سؤال العميل\n`;
      prompt += `   - لا تستخدمي: "أهلاً بيك"، "مرحباً"، "السلام عليكم"، أو أي تحية أخرى\n`;
    }
    prompt += `=====================================\n\n`;

    console.log('\n✅ [BUILD-PROMPT] تم بناء الـ Prompt بنجاح');
    console.log('📏 [BUILD-PROMPT] طول الـ Prompt النهائي:', prompt.length, 'حرف');
    console.log('📝 [BUILD-PROMPT] أول 200 حرف من الـ Prompt:');
    console.log(prompt.substring(0, 200) + '...');
    console.log('📝 [BUILD-PROMPT] آخر 200 حرف من الـ Prompt:');
    console.log('...' + prompt.substring(prompt.length - 200));
    
    return prompt;
  }

  /**
   * Build order confirmation prompt
   */
  async buildOrderConfirmationPrompt(customerMessage, customerData, companyPrompts, order, orderDetails, conversationMemory, companyId) {
    try {
      console.log('📝 [ORDER-CONFIRMATION] بناء prompt لتأكيد الطلب:', order.orderNumber);
      
      let prompt = '';
      
      // إضافة personality prompt
      if (companyPrompts.personalityPrompt) {
        prompt += `${companyPrompts.personalityPrompt.trim()}\n\n`;
      }
      
      // ✅ FIX: إضافة قواعد الاستجابة (Response Rules Checkpoints) - مهم جداً!
      console.log('🔍 [ORDER-CONFIRMATION-RULES] Checking for response rules...');
      if (companyPrompts.responseRules) {
        try {
          const rules = typeof companyPrompts.responseRules === 'string' 
            ? JSON.parse(companyPrompts.responseRules) 
            : companyPrompts.responseRules;
          console.log('✅ [ORDER-CONFIRMATION-RULES] Using custom response rules');
          const rulesPrompt = buildPromptFromRules(rules);
          prompt += rulesPrompt;
        } catch (e) {
          console.warn('⚠️ [ORDER-CONFIRMATION-RULES] Failed to parse responseRules:', e.message);
          const defaultRulesPrompt = buildPromptFromRules(getDefaultRules());
          prompt += defaultRulesPrompt;
        }
      } else {
        console.log('⚠️ [ORDER-CONFIRMATION-RULES] No response rules found, using defaults');
        const defaultRulesPrompt = buildPromptFromRules(getDefaultRules());
        prompt += defaultRulesPrompt;
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
        const ShippingService = require('../shippingService');
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
   * ✨ Helper function to try different API versions for new models
   * 
   * بناءً على الوثائق الرسمية: https://ai.google.dev/api
   * - النماذج الجديدة (2.5, 2.0, 3) تستخدم v1beta في الـ endpoint
   * - الـ endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
   * - SDK @google/generative-ai يتعامل مع هذه التفاصيل تلقائياً عند تحديد apiVersion
   * 
   * بعض النماذج الجديدة مثل gemini-3-pro قد تحتاج v1beta أو v1alpha
   */
  async tryGenerateWithApiVersions(genAI, modelName, generationConfig, prompt, maxRetries = 2) {
    // ✅ تحديد إصدارات API للاختبار حسب نوع النموذج
    const isNewModel = modelName.includes('3') || modelName.includes('2.5') || modelName.includes('2.0');
    const apiVersions = isNewModel ? ['v1beta', 'v1alpha', 'v1'] : ['v1', 'v1beta', 'v1alpha'];
    
    let lastError = null;
    
    for (const apiVersion of apiVersions) {
      try {
        // ✅ إعداد thinkingConfig لتقليل استهلاك التوكنز في نماذج 2.5
        const isThinkingModel = modelName.includes('2.5') || modelName.includes('thinking');
        const thinkingConfig = isThinkingModel ? {
          thinkingConfig: {
            thinkingBudget: 0 // ✅ تعطيل التفكير لتوفير التوكنز
          }
        } : {};
        
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          ...(apiVersion !== 'v1' ? { apiVersion } : {}), // v1 هو الافتراضي
          generationConfig,
          ...thinkingConfig
        });
        
        // 🔄 Retry logic for 503 errors
        const retryDelays = [1000, 2000];
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await model.generateContent(prompt);
            return {
              success: true,
              response: result.response,
              apiVersion: apiVersion === 'v1' ? 'v1 (default)' : apiVersion
            };
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
      } catch (error) {
        lastError = error;
        // ✅ إذا كان الخطأ 404 أو 400، قد يعني أن النموذج غير متوفر في هذا الإصدار
        const is404or400 = error.status === 404 || error.status === 400 || 
                          error.message?.includes('404') || error.message?.includes('400') ||
                          error.message?.includes('not found') || error.message?.includes('invalid');
        
        if (is404or400) {
          console.log(`⚠️ [API-VERSION] Model ${modelName} not available with ${apiVersion}, trying next version...`);
          continue; // Try next API version
        }
        
        // ✅ للأخطاء الأخرى، نستمر في المحاولة مع إصدار API التالي
        continue;
      }
    }
    
    // ✅ إذا فشلت جميع المحاولات
    throw lastError || new Error(`Failed to generate content with all API versions for model: ${modelName}`);
  }

  /**
   * Generate AI response using Gemini API with Pattern Enhancement
   */
  async generateAIResponse(prompt, conversationMemory, useRAG, providedGeminiConfig, companyId, conversationId, messageContext) {
    const startTime = Date.now();
    
    // ✅ FIX: إعلان geminiConfig خارج try block ليكون متاحاً في catch block
    let geminiConfig = null;
    
    // ✅ FIX 1: إنشاء session ID لتتبع النماذج المجربة
    const sessionId = `${companyId}_${conversationId}_${Date.now()}`;
    this.globalTriedModels.set(sessionId, {
      models: new Set(),
      timestamp: Date.now()
    });
    
    try {
      console.log(`🔍 [AI-RESPONSE] بدء توليد رد للشركة ${companyId}, المحادثة ${conversationId} - Session: ${sessionId}`);
      
      // Get active Gemini configuration (use provided one if available, otherwise use session model with company isolation)
      const modelSelectionStart = Date.now();
      geminiConfig = providedGeminiConfig || await this.aiAgentService.getCurrentActiveModel(companyId);
      const modelSelectionDuration = Date.now() - modelSelectionStart;
      
      if (!geminiConfig) {
        const totalDuration = Date.now() - startTime;
        console.error(`❌ [AI-RESPONSE] لم يتم العثور على نموذج نشط للشركة ${companyId} - وقت اختيار النموذج: ${modelSelectionDuration}ms, الوقت الإجمالي: ${totalDuration}ms`);
        throw new Error(`No active Gemini key found for company: ${companyId}`);
      }
      
      console.log(`✅ [AI-RESPONSE] تم اختيار النموذج: ${geminiConfig.model} (Key: ${geminiConfig.keyName || geminiConfig.keyId}) - وقت الاختيار: ${modelSelectionDuration}ms`);

      // Step 1: Enhance prompt with approved patterns (if companyId provided)
      let enhancedPrompt = prompt;
      let approvedPatterns = [];

      if (companyId) {
        try {
          approvedPatterns = await this.aiAgentService.patternApplication.getApprovedPatterns(companyId);
          if (approvedPatterns.length > 0 && messageContext && messageContext.messageType) {
            enhancedPrompt = await this.aiAgentService.promptEnhancement.enhancePromptWithPatterns(
              prompt,
              approvedPatterns,
              messageContext.messageType || 'general',
              companyId
            );
          }
        } catch (patternError) {
          console.error('⚠️ [AIAgent] Error applying patterns to prompt:', patternError);
          // Continue with original prompt if pattern enhancement fails
        }
      }

      // ✨ الحصول على إعدادات التوليد الديناميكية
      const generationConfig = await this.buildGenerationConfig(companyId, messageContext);
      
      // ⚠️ Warning for thinking models
      if (geminiConfig.model.includes('2.5') || geminiConfig.model.includes('thinking')) {
        // Thinking models use tokens for internal reasoning
      }

      // Step 2: Generate AI response using enhanced prompt with API version fallback
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      
      // 🔍 DEBUG: فحص الـ apiKey
      const apiKeyPreview = geminiConfig.apiKey ? 
        `${geminiConfig.apiKey.substring(0, 10)}...${geminiConfig.apiKey.slice(-4)} (length: ${geminiConfig.apiKey.length})` : 
        'NULL/UNDEFINED';
      console.log(`🔑 [API-KEY-DEBUG] Key preview: ${apiKeyPreview}, Model: ${geminiConfig.model}, KeyName: ${geminiConfig.keyName}`);
      
      const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
      
      // ✅ استخدام الدالة المساعدة لتجربة إصدارات API متعددة
      const { response, apiVersion } = await this.tryGenerateWithApiVersions(
        genAI,
        geminiConfig.model,
        generationConfig,
        enhancedPrompt,
        2 // maxRetries
      );
      
      if (apiVersion && apiVersion !== 'v1 (default)') {
        console.log(`✅ [API-VERSION] Using ${apiVersion} for model ${geminiConfig.model}`);
      }
      
      // 🔍 Debug full response object
      console.log(`🔍 [AI-RESPONSE-DEBUG] Full response object:`, {
        hasResponse: !!response,
        hasCandidates: !!response?.candidates,
        candidatesLength: response?.candidates?.length || 0,
        promptFeedback: response?.promptFeedback,
        usageMetadata: response?.usageMetadata
      });
      
      // ✅ تحسين: إضافة logging لتتبع استهلاك tokens
      let totalTokenCount = 0;
      if (response?.usageMetadata) {
        const tokenUsage = {
          promptTokenCount: response.usageMetadata.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata.totalTokenCount || 0
        };
        totalTokenCount = tokenUsage.totalTokenCount;
        console.log(`📊 [TOKEN-USAGE] Tokens consumed:`, {
          prompt: tokenUsage.promptTokenCount,
          response: tokenUsage.candidatesTokenCount,
          total: tokenUsage.totalTokenCount,
          model: geminiConfig.model,
          companyId: companyId
        });
      }
      
      // ✅ تحديث الاستخدام فقط بعد نجاح الطلب - مع تتبع TPM
      const usedModelId = geminiConfig.modelId;
      if (usedModelId) {
        console.log(`✅ [USAGE-UPDATE] Updating usage for modelId: ${usedModelId}, model: ${geminiConfig.model}, tokens: ${totalTokenCount}`);
        // ✅ تمرير totalTokenCount لتتبع TPM
        await this.aiAgentService.updateModelUsage(usedModelId, totalTokenCount);
      } else {
        console.warn(`⚠️ [USAGE-UPDATE] modelId is missing! geminiConfig:`, {
          model: geminiConfig.model,
          keyId: geminiConfig.keyId,
          modelId: geminiConfig.modelId
        });
      }
      
      // Check if response was blocked
      if (response.promptFeedback?.blockReason) {
        console.error(`🚫 [AI-BLOCKED] Response was blocked! Reason: ${response.promptFeedback.blockReason}`);
        console.error(`🚫 [AI-BLOCKED] Safety ratings:`, response.promptFeedback.safetyRatings);
        
        // 🤐 النظام الصامت - إرسال إشعار فوري عند حظر الرد
        await aiResponseMonitor.recordAIFailure({
          companyId: companyId,
          conversationId: conversationId,
          customerId: null,
          errorType: 'response_blocked',
          errorMessage: `Response blocked: ${response.promptFeedback.blockReason}`,
          context: {
            blockReason: response.promptFeedback.blockReason,
            safetyRatings: response.promptFeedback.safetyRatings
          }
        });

        await aiResponseMonitor.sendNotification({
          companyId: companyId,
          type: 'ai_response_blocked',
          severity: 'high',
          title: '🚫 تم حظر رد الذكاء الاصطناعي',
          message: `تم حظر رد الذكاء الاصطناعي بسبب: ${response.promptFeedback.blockReason}. المحادثة: ${conversationId}`,
          metadata: {
            blockReason: response.promptFeedback.blockReason,
            safetyRatings: response.promptFeedback.safetyRatings,
            conversationId
          }
        });

        // 🤐 النظام الصامت - إرجاع كائن يحتوي على السبب
        return { content: null, silentReason: `تم حظر الرد بسبب: ${response.promptFeedback.blockReason}` };
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
        // Check if response was truncated due to MAX_TOKENS
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          const finishReason = candidate.finishReason;
          
          // 🤐 النظام الصامت - معالجة finishReason SAFETY و RECITATION
          if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
            console.error(`🚫 [AI-BLOCKED] Response blocked by finishReason: ${finishReason}`);
            
            // إرسال إشعار فوري
            await aiResponseMonitor.recordAIFailure({
              companyId: companyId,
              conversationId: conversationId,
              customerId: null,
              errorType: 'response_blocked',
              errorMessage: `Response blocked by finishReason: ${finishReason}`,
              context: {
                finishReason,
                safetyRatings: candidate.safetyRatings
              }
            });

            await aiResponseMonitor.sendNotification({
              companyId: companyId,
              type: 'ai_response_blocked',
              severity: 'high',
              title: `🚫 تم حظر رد الذكاء الاصطناعي: ${finishReason}`,
              message: `تم حظر رد الذكاء الاصطناعي بسبب: ${finishReason}. المحادثة: ${conversationId}`,
              metadata: {
                finishReason,
                safetyRatings: candidate.safetyRatings,
                conversationId
              }
            });

            // 🤐 النظام الصامت - إرجاع كائن يحتوي على السبب
            return { content: null, silentReason: `تم حظر الرد بسبب: ${finishReason}` };
          }
          
          // If MAX_TOKENS, try to extract partial content
          if (finishReason === 'MAX_TOKENS') {
            console.warn(`⚠️ [AI-MAX-TOKENS] Response truncated due to token limit`);
            
            // Try to extract text from parts manually first
            if (candidate.content?.parts && candidate.content.parts.length > 0) {
              aiContent = candidate.content.parts.map(part => part.text || '').join('');
              if (aiContent && aiContent.trim().length > 0) {
                console.log(`✅ [AI-MAX-TOKENS] Extracted partial content (${aiContent.length} chars) from truncated response`);
              }
            }
            
            // If still empty, try response.text() as fallback
            if (!aiContent || aiContent.trim().length === 0) {
              try {
                aiContent = response.text();
              } catch (textError) {
                console.error(`❌ [AI-TEXT-ERROR] Error calling response.text() after MAX_TOKENS:`, textError.message);
              }
            }
            
            // ✅ FIX: إذا كان الرد فارغاً بعد MAX_TOKENS، إعادة المحاولة بإعدادات أفضل
            if (!aiContent || aiContent.trim().length === 0) {
              console.warn(`⚠️ [AI-MAX-TOKENS] Response is empty after MAX_TOKENS - retrying with better config`);
              
              // ✅ استخدام retry count من messageContext أو 0
              const retryCount = messageContext?._retry_count || 0;
              
              // ✅ التحقق من حد أقصى لعدد المحاولات
              if (retryCount < DEFAULT_AI_SETTINGS.MAX_RETRIES) {
                // ✅ حساب القيمة الجديدة باستخدام multipliers من constants
                const currentMaxTokens = generationConfig.maxOutputTokens || DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS;
                const multiplier = retryCount === 0 
                  ? RETRY_TOKEN_MULTIPLIERS.second 
                  : RETRY_TOKEN_MULTIPLIERS.third;
                const newMaxTokens = currentMaxTokens * multiplier;
                
                console.log(`🔄 [AI-MAX-TOKENS] Retry ${retryCount + 1}/${DEFAULT_AI_SETTINGS.MAX_RETRIES} with maxOutputTokens: ${newMaxTokens}, temperature: 0.3`);
                
                // إنشاء messageContext جديد مع إعدادات محسنة
                const retryContext = {
                  ...messageContext,
                  maxTokens: newMaxTokens, // ✅ استخدام القيمة المحسوبة من constants
                  temperature: 0.3, // ✅ تقليل التفكير الزائد
                  _retry_count: retryCount + 1, // ✅ زيادة عداد المحاولات
                };
                
                // ✅ إعادة المحاولة (iterative - لا recursive)
                return await this.generateAIResponse(
                  prompt,
                  conversationMemory,
                  useRAG,
                  providedGeminiConfig,
                  companyId,
                  conversationId,
                  retryContext
                );
              }
              
              // ✅ إذا فشلت جميع المحاولات، إرسال إشعار
              const finalMaxTokens = generationConfig.maxOutputTokens || DEFAULT_AI_SETTINGS.MAX_OUTPUT_TOKENS;
              console.error(`❌ [AI-MAX-TOKENS] All retries failed (${retryCount + 1} attempts) - response still empty`);
              if (companyId && conversationId) {
                await aiResponseMonitor.recordAIFailure({
                  companyId: companyId,
                  conversationId: conversationId,
                  customerId: null,
                  errorType: 'max_tokens_empty_after_retry',
                  errorMessage: 'Response truncated due to MAX_TOKENS even after retry',
                  context: {
                    finishReason: 'MAX_TOKENS',
                    partsLength: candidate.content?.parts?.length || 0,
                    retriedWithMaxTokens: finalMaxTokens, // ✅ FIX: استخدام القيمة الفعلية بدلاً من 32768
                    retryCount: retryCount + 1,
                  }
                });
              }
              
              // إرجاع كائن يحتوي على السبب للسماح بـ fallback في messageProcessor
              return { content: null, silentReason: 'تم قطع الرد بسبب تجاوز حد الرموز (MAX_TOKENS) حتى بعد إعادة المحاولة' };
            }
          } else if (finishReason === 'STOP') {
            // Normal case - use response.text()
            aiContent = response.text();
          } else {
            // Other finish reasons (OTHER, etc.) - try to extract content
            console.warn(`⚠️ [AI-FINISH-REASON] Unexpected finishReason: ${finishReason}`);
            try {
              aiContent = response.text();
            } catch (textError) {
              console.error(`❌ [AI-TEXT-ERROR] Error calling response.text() with finishReason ${finishReason}:`, textError.message);
              // Try manual extraction
              if (candidate.content?.parts?.length > 0) {
                aiContent = candidate.content.parts.map(part => part.text || '').join('');
              }
            }
          }
        } else {
          // No candidates - try response.text() anyway
          aiContent = response.text();
        }
      } catch (textError) {
        console.error(`❌ [AI-TEXT-ERROR] Error calling response.text():`, textError.message);
        // Try to extract text from candidates manually
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          // 🤐 التحقق من finishReason قبل محاولة استخراج النص
          if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
            console.error(`🚫 [AI-BLOCKED] Cannot extract text - response blocked by finishReason: ${candidate.finishReason}`);
            return { content: null, silentReason: `تم حظر الرد بسبب: ${candidate.finishReason}` };
          }
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
          // إضافة conversationMemory و conversationId إلى messageContext للتحقق من المحادثات الجديدة
          const enhancedMessageContext = {
            ...messageContext,
            conversationMemory: conversationMemory || [],
            conversationId: conversationId, // ✅ إضافة conversationId للتحقق من قاعدة البيانات
            companyId: companyId // ✅ إضافة companyId للعزل الأمني
          };
          
          const optimizedResponse = await this.aiAgentService.responseOptimizer.optimizeResponse(
            aiContent,
            approvedPatterns,
            enhancedMessageContext,
            companyId,
            prompt // تمرير البرونت الأساسي للمحسن
          );

          if (optimizedResponse !== aiContent) {
            aiContent = optimizedResponse;
          }
        } catch (optimizationError) {
          console.error('⚠️ [AIAgent] Error optimizing response:', optimizationError);
          // Continue with original response if optimization fails
        }
      }
      
      // Step 3: Response diversity check (OPTIONAL - skip after order creation to avoid DB pressure)
      try {
        const settings2 = await this.aiAgentService.getSettings(companyId);
        
        // ✅ Skip diversity check immediately after order creation to avoid DB pressure
        const isOrderConfirmation = messageContext?.messageType === 'order_confirmation';
        if (settings2.enableDiversityCheck && !isOrderConfirmation) {
          const diversityService = require('../responseDiversityService');
          aiContent = await diversityService.diversifyResponse(
            aiContent,
            conversationId,
            conversationMemory
          );
        }
      } catch (diversityError) {
        // ✅ Silent error handling - diversity is optional
        if (diversityError.message?.includes('not yet connected') || 
            diversityError.message?.includes('Engine') ||
            diversityError.message?.includes('toLowerCase') ||
            diversityError.message?.includes('messageData is not defined')) {
          // Ignore connection errors and scope errors - they're expected
        } else {
          console.error('⚠️ [ResponseDiversity] Non-critical error:', diversityError.message);
        }
      }

      try {
        const settings3 = await this.aiAgentService.getSettings(companyId);
        if (settings3.enableToneAdaptation && conversationMemory && conversationMemory.length > 0) {
          const toneService = require('../toneAdaptationService');
          const customerMessages = conversationMemory
            .filter(m => m.isFromCustomer)
            .map(m => m.content);
          const toneAnalysis = toneService.analyzeTone(customerMessages);
          if (toneAnalysis.confidence > 0.3) {
            aiContent = toneService.adaptResponseToTone(aiContent, toneAnalysis);
          }
        }
      } catch (toneError) {
        // Silent error handling
      }
      
      // Step 4: Record pattern usage for performance tracking (BATCH OPTIMIZED)
      if (conversationId && approvedPatterns.length > 0) {
        try {
          const patternIds = approvedPatterns.map(p => p.id);
          await this.aiAgentService.patternApplication.recordPatternUsageBatch(patternIds, conversationId, companyId);
        } catch (recordError) {
          console.error('⚠️ [AIAgent] Error recording batch pattern usage:', recordError);
        }
      }

      // ✅ VALIDATION: Check if response is valid before returning
      if (!aiContent || typeof aiContent !== 'string') {
        console.warn('⚠️ [AI-VALIDATION] Response is null or not a string');
        
        // 🤐 النظام الصامت - إرسال إشعار عند فشل validation
        if (companyId && conversationId) {
          await aiResponseMonitor.recordAIFailure({
            companyId: companyId,
            conversationId: conversationId,
            customerId: null,
            errorType: 'invalid_response',
            errorMessage: 'Response is null or not a string',
            context: {}
          });
        }
        
        return { content: null, silentReason: 'الرد غير صالح (ليس نصاً)' }; // 🤐 إرجاع كائن يحتوي على السبب
      }

      const trimmedContent = aiContent.trim();
      
      // ✅ FIX: Check if response is too short
      // نسمح بردود قصيرة فقط في حالات خاصة (مثل detectConfirmationWithAI)
      const isConfirmationCheck = messageContext?.messageType === 'order_confirmation' || 
                                  messageContext?.inquiryType === 'order_confirmation';
      
      // ✅ FIX: الردود أقل من 3 أحرف مرفوضة تماماً (حتى في confirmation checks)
      if (trimmedContent.length < 3) {
        console.warn(`⚠️ [AI-VALIDATION] Response too short (${trimmedContent.length} chars): "${trimmedContent}"`);
        
        // 🤐 النظام الصامت - إرسال إشعار
        if (companyId && conversationId) {
          await aiResponseMonitor.recordAIFailure({
            companyId: companyId,
            conversationId: conversationId,
            customerId: null,
            errorType: 'invalid_response',
            errorMessage: `Response too short: ${trimmedContent.length} chars`,
            context: { responsePreview: trimmedContent, isConfirmationCheck }
          });
        }
        
        return { content: null, silentReason: 'الرد غير صالح (ليس نصاً)' }; // 🤐 إرجاع كائن يحتوي على السبب
      }
      
      // ✅ FIX: الردود من 3-9 أحرف قد تكون صحيحة لكن قصيرة - نتحقق من المحتوى
      if (trimmedContent.length >= 3 && trimmedContent.length < 10 && !isConfirmationCheck) {
        // كلمات مفيدة مقبولة حتى لو كانت قصيرة
        const usefulShortWords = ['شكراً', 'شكرا', 'شكر', 'تمام', 'حاضر', 'نعم', 'موافق', 'ممتاز', 'أوكي', 'ok', 'yes'];
        const hasUsefulWord = usefulShortWords.some(word => trimmedContent.toLowerCase().includes(word.toLowerCase()));
        
        // ✅ FIX: إذا كان الرد قصيراً ولا يحتوي على كلمات مفيدة، نحاول إعادة التوليد
        if (!hasUsefulWord) {
          console.warn(`⚠️ [AI-VALIDATION] Response is short (${trimmedContent.length} chars) and doesn't contain useful words: "${trimmedContent}"`);
          
          // ✅ FIX: إرجاع كائن يحتوي على السبب لإعادة المحاولة في messageProcessor
          return { content: null, silentReason: `الرد قصير جداً (${trimmedContent.length} حرف) ولا يحتوي على كلمات مفيدة` };
        }
      }

      // Check if response contains only symbols
      const withoutSymbols = trimmedContent.replace(/[✓✗×✓✔✕✖✓✓✓✓\s]+/g, '').trim();
      if (withoutSymbols.length < 2) {
        console.warn(`⚠️ [AI-VALIDATION] Response contains only symbols: "${trimmedContent}"`);
        
        // 🤐 النظام الصامت - إرسال إشعار
        if (companyId && conversationId) {
          await aiResponseMonitor.recordAIFailure({
            companyId: companyId,
            conversationId: conversationId,
            customerId: null,
            errorType: 'invalid_response',
            errorMessage: 'Response contains only symbols',
            context: { responsePreview: trimmedContent }
          });
        }
        
        return { content: null, silentReason: 'الرد غير صالح (ليس نصاً)' }; // 🤐 إرجاع كائن يحتوي على السبب
      }

      // Check if response is just repeated characters or single character
      const uniqueChars = new Set(trimmedContent.replace(/\s/g, ''));
      if (uniqueChars.size <= 2 && trimmedContent.length < 10) {
        console.warn(`⚠️ [AI-VALIDATION] Response appears to be noise (repeated chars): "${trimmedContent}"`);
        
        // 🤐 النظام الصامت - إرسال إشعار
        if (companyId && conversationId) {
          await aiResponseMonitor.recordAIFailure({
            companyId: companyId,
            conversationId: conversationId,
            customerId: null,
            errorType: 'invalid_response',
            errorMessage: 'Response appears to be noise',
            context: { responsePreview: trimmedContent }
          });
        }
        
        return { content: null, silentReason: 'الرد غير صالح (ليس نصاً)' }; // 🤐 إرجاع كائن يحتوي على السبب
      }

      const totalDuration = Date.now() - startTime;
      console.log(`✅ [AI-RESPONSE] تم توليد رد بنجاح - الطول: ${trimmedContent.length} حرف - الوقت الإجمالي: ${totalDuration}ms`);
      
      // ✅ FIX 1: تنظيف session بعد النجاح
      this.globalTriedModels.delete(sessionId);
      
      return trimmedContent;

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`❌ [AI-RESPONSE] خطأ في توليد الرد - الوقت الإجمالي: ${totalDuration}ms - الخطأ: ${error.message}`);

      // ✅ FIX 1: استخدام النظام العالمي لتتبع النماذج المجربة
      const sessionData = this.globalTriedModels.get(sessionId);
      const triedModels = sessionData ? sessionData.models : new Set();
      
      if (geminiConfig?.model) {
        triedModels.add(geminiConfig.model); // النموذج الأساسي الذي فشل
        console.log(`📝 [TRIED-MODELS] Added ${geminiConfig.model} to tried list. Total tried: ${triedModels.size}`);
      }

      // ✅ FIX 7: حد أقصى للمحاولات
      const MAX_FALLBACK_ATTEMPTS = 5;
      
      // فحص إذا كان خطأ 503 (Service Unavailable - Model Overloaded)
      const is503Error = error.status === 503 || 
                        error.message?.includes('503') || 
                        error.message?.includes('Service Unavailable') ||
                        error.message?.includes('overloaded');
      
      // ✅ FIX 7: استخدام while loop مع حد أقصى للمحاولات
      if (is503Error && triedModels.size < MAX_FALLBACK_ATTEMPTS) {
        console.log(`🔄 [503-ERROR] Model is overloaded. Attempting to switch to backup model (attempt ${triedModels.size + 1}/${MAX_FALLBACK_ATTEMPTS})...`);
        
        // ✅ FIX 2: محاولة الحصول على نموذج بديل مع استثناء النماذج المجربة
        const excludeModelsArray = Array.from(triedModels);
        const backupModel = await this.aiAgentService.findNextAvailableModel(companyId, excludeModelsArray);
        if (backupModel) {
          console.log(`🔄 [503-FALLBACK] Switching to backup model: ${backupModel.model}`);
          
          // ✅ FIX 1: إضافة النموذج البديل إلى قائمة النماذج التي تم تجربتها
          triedModels.add(backupModel.model);
          console.log(`📝 [TRIED-MODELS] Added backup model ${backupModel.model} to tried list. Total tried: ${triedModels.size}`);
          
          // إعادة المحاولة مع النموذج البديل (مع retry logic أيضاً)
          try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(backupModel.apiKey);
            
            // ✅ إعداد thinkingConfig لتقليل استهلاك التوكنز
            const isThinkingModel = backupModel.model.includes('2.5') || backupModel.model.includes('thinking');
            const thinkingConfig = isThinkingModel ? {
              thinkingConfig: { thinkingBudget: 0 }
            } : {};
            
            const model = genAI.getGenerativeModel({ 
              model: backupModel.model,
              generationConfig: await this.buildGenerationConfig(companyId, messageContext),
              ...thinkingConfig
            });

            // 🔄 Retry logic مع exponential backoff للنموذج البديل أيضاً
            // ✅ تحسين: تقليل عدد المحاولات من 3 إلى 2 لتوفير tokens
            let result;
            let response;
            const maxRetries = 2; // ✅ تحسين: تقليل من 3 إلى 2
            const retryDelays = [1000, 2000]; // ✅ تحسين: تقليل من 3 إلى 2
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
              await this.aiAgentService.updateModelUsage(backupModel.modelId);
            }

            // تحديث النموذج النشط للجلسة
            this.aiAgentService.updateCurrentActiveModel(backupModel);

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
              
              // ✅ FIX: استخراج معلومات 429 من الخطأ
              let quotaValue = null;
              let modelName = backupModel.model; // استخدام النموذج البديل الذي فشل
              
              try {
                const errorDetails = retryError.errorDetails || [];
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
                console.warn('⚠️ [503-FALLBACK-429] Could not parse error details:', parseError);
              }
              
              // ✅ FIX: تحديد النموذج البديل كمستنفد قبل البحث عن نموذج ثانٍ
              // ✅ FIX: تمرير modelId لتحديث فقط المفتاح المحدد الذي فشل
              if (modelName) {
                const modelId = backupModel?.modelId || null;
                await this.aiAgentService.markModelAsExhaustedFrom429(modelName, quotaValue, companyId, modelId);
                if (modelId) {
                  console.log(`⚠️ [QUOTA-EXHAUSTED] Marked backup model ${modelName} (modelId: ${modelId}) as exhausted (quota: ${quotaValue || 'unknown'})`);
                } else {
                  console.log(`⚠️ [QUOTA-EXHAUSTED] Marked backup model ${modelName} as exhausted (quota: ${quotaValue || 'unknown'}) - No modelId provided`);
                }
              }
              
              // ✅ FIX: إضافة النموذج البديل إلى قائمة النماذج التي تم تجربتها (triedModels تم تعريفه في بداية catch block)
              // triedModels تم تعريفه في بداية catch block
              if (!triedModels.has(backupModel.model)) {
                triedModels.add(backupModel.model); // النموذج البديل الذي فشل بـ 429
              }
              
              // ✅ FIX: محاولة البحث عن نموذج بديل آخر (نموذج ثالث) مع استثناء النماذج التي تم تجربتها
              const excludeModelsArray = Array.from(triedModels);
              console.log(`🔍 [503-FALLBACK-429] Searching for second backup model. Excluding: ${excludeModelsArray.join(', ')} (${excludeModelsArray.length} models)`);
              console.log(`🔍 [503-FALLBACK-429] Tried models count: ${triedModels.size}, Max attempts: ${MAX_FALLBACK_ATTEMPTS}`);
              
              const secondBackupModel = await this.aiAgentService.findNextAvailableModel(companyId, excludeModelsArray);
              if (secondBackupModel && 
                  secondBackupModel.model !== backupModel.model && 
                  !triedModels.has(secondBackupModel.model)) {
                console.log(`✅ [503-FALLBACK-429] Found second backup model: ${secondBackupModel.model} (Key: ${secondBackupModel.keyName || 'N/A'})`);
                
                try {
                  const { GoogleGenerativeAI } = require('@google/generative-ai');
                  const genAI = new GoogleGenerativeAI(secondBackupModel.apiKey);
                  
                  // ✅ إعداد thinkingConfig لتقليل استهلاك التوكنز
                  const isThinkingModel = secondBackupModel.model.includes('2.5') || secondBackupModel.model.includes('thinking');
                  const thinkingConfig = isThinkingModel ? {
                    thinkingConfig: { thinkingBudget: 0 }
                  } : {};
                  
                  const model = genAI.getGenerativeModel({ 
                    model: secondBackupModel.model,
                    generationConfig: await this.buildGenerationConfig(companyId, messageContext),
                    ...thinkingConfig
                  });

                  // 🔄 Retry logic مع exponential backoff للنموذج البديل الثاني
                  let result;
                  let response;
                  const maxRetries = 2;
                  const retryDelays = [1000, 2000];
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
                      
                      const is429Error = secondRetryError.status === 429 || 
                                       secondRetryError.message?.includes('429') || 
                                       secondRetryError.message?.includes('Too Many Requests') ||
                                       secondRetryError.message?.includes('quota');
                      
                      // ✅ FIX: إذا كان 429، لا نعيد المحاولة - نبحث عن نموذج آخر مباشرة
                      if (is429Error) {
                        throw secondRetryError; // ارمي الخطأ للبحث عن نموذج آخر
                      }
                      
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
                    await this.aiAgentService.updateModelUsage(secondBackupModel.modelId);
                  }

                  // تحديث النموذج النشط للجلسة
                  this.aiAgentService.updateCurrentActiveModel(secondBackupModel);

                  console.log(`✅ [503-FALLBACK-429] Successfully got response from second backup model: ${secondBackupModel.model}`);
                  return aiContent;
                } catch (secondBackupError) {
                  console.error('❌ [503-FALLBACK-429] Second backup model also failed:', secondBackupError.message);
                  
                  // ✅ FIX: التحقق من نوع الخطأ - إذا كان 429، حاول البحث عن نموذج بديل ثالث
                  const isSecond429Error = secondBackupError.status === 429 || 
                                          secondBackupError.message?.includes('429') || 
                                          secondBackupError.message?.includes('Too Many Requests') ||
                                          secondBackupError.message?.includes('quota');
                  
                  if (isSecond429Error && triedModels.size < MAX_FALLBACK_ATTEMPTS) {
                    console.log('🔄 [503-FALLBACK-429-429] Second backup model also failed with 429. Attempting to find third backup model...');
                    
                    // ✅ FIX: استخراج معلومات 429 من الخطأ
                    let secondQuotaValue = null;
                    let secondModelName = secondBackupModel.model;
                    
                    try {
                      const errorDetails = secondBackupError.errorDetails || [];
                      for (const detail of errorDetails) {
                        if (detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure') {
                          const violations = detail.violations || [];
                          for (const violation of violations) {
                            if (violation.quotaValue) {
                              secondQuotaValue = violation.quotaValue;
                            }
                            if (violation.quotaDimensions && violation.quotaDimensions.model) {
                              secondModelName = violation.quotaDimensions.model;
                            }
                          }
                        }
                      }
                    } catch (parseError) {
                      console.warn('⚠️ [503-FALLBACK-429-429] Could not parse error details:', parseError);
                    }
                    
                    // ✅ FIX: تحديد النموذج البديل الثاني كمستنفد
                    if (secondModelName) {
                      const secondModelId = secondBackupModel?.modelId || null;
                      await this.aiAgentService.markModelAsExhaustedFrom429(secondModelName, secondQuotaValue, companyId, secondModelId);
                      console.log(`⚠️ [QUOTA-EXHAUSTED] Marked second backup model ${secondModelName} (modelId: ${secondModelId || 'N/A'}) as exhausted`);
                    }
                    
                    // ✅ FIX: إضافة النموذج البديل الثاني إلى قائمة النماذج التي تم تجربتها
                    if (!triedModels.has(secondBackupModel.model)) {
                      triedModels.add(secondBackupModel.model);
                    }
                    
                    // ✅ FIX: محاولة البحث عن نموذج بديل ثالث
                    const excludeModelsArray = Array.from(triedModels);
                    const thirdBackupModel = await this.aiAgentService.findNextAvailableModel(companyId, excludeModelsArray);
                    if (thirdBackupModel && 
                        thirdBackupModel.model !== secondBackupModel.model && 
                        thirdBackupModel.model !== backupModel.model &&
                        !triedModels.has(thirdBackupModel.model)) {
                      console.log(`🔄 [503-FALLBACK-429-429] Found third backup model: ${thirdBackupModel.model}`);
                      
                      try {
                        const { GoogleGenerativeAI } = require('@google/generative-ai');
                        const genAI = new GoogleGenerativeAI(thirdBackupModel.apiKey);
                        
                        const isThinkingModel = thirdBackupModel.model.includes('2.5') || thirdBackupModel.model.includes('thinking');
                        const thinkingConfig = isThinkingModel ? {
                          thinkingConfig: { thinkingBudget: 0 }
                        } : {};
                        
                        const model = genAI.getGenerativeModel({ 
                          model: thirdBackupModel.model,
                          generationConfig: await this.buildGenerationConfig(companyId, messageContext),
                          ...thinkingConfig
                        });

                        const result = await model.generateContent(prompt);
                        const response = result.response;
                        
                        if (!response || !response.candidates || response.candidates.length === 0) {
                          throw new Error('Empty response from third backup model');
                        }
                        
                        const aiContent = response.text();
                        if (!aiContent || aiContent.trim().length === 0) {
                          throw new Error('Empty content from third backup model');
                        }
                        
                        if (thirdBackupModel.modelId) {
                          await this.aiAgentService.updateModelUsage(thirdBackupModel.modelId);
                        }
                        
                        this.aiAgentService.updateCurrentActiveModel(thirdBackupModel);
                        
                        console.log(`✅ [503-FALLBACK-429-429] Successfully got response from third backup model: ${thirdBackupModel.model}`);
                        return aiContent;
                      } catch (thirdBackupError) {
                        console.error('❌ [503-FALLBACK-429-429] Third backup model also failed:', thirdBackupError.message);
                        
                        // ✅ FIX: التحقق من نوع الخطأ - إذا كان 429، حاول البحث عن نموذج بديل رابع
                        const isThird429Error = thirdBackupError.status === 429 || 
                                              thirdBackupError.message?.includes('429') || 
                                              thirdBackupError.message?.includes('Too Many Requests') ||
                                              thirdBackupError.message?.includes('quota');
                        
                        if (isThird429Error && triedModels.size < MAX_FALLBACK_ATTEMPTS) {
                          console.log('🔄 [503-FALLBACK-429-429-429] Third backup model also failed with 429. Attempting to find fourth backup model...');
                          
                          // ✅ FIX: استخراج معلومات 429 من الخطأ
                          let thirdQuotaValue = null;
                          let thirdModelName = thirdBackupModel.model;
                          
                          try {
                            const errorDetails = thirdBackupError.errorDetails || [];
                            for (const detail of errorDetails) {
                              if (detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure') {
                                const violations = detail.violations || [];
                                for (const violation of violations) {
                                  if (violation.quotaValue) {
                                    thirdQuotaValue = violation.quotaValue;
                                  }
                                  if (violation.quotaDimensions && violation.quotaDimensions.model) {
                                    thirdModelName = violation.quotaDimensions.model;
                                  }
                                }
                              }
                            }
                          } catch (parseError) {
                            console.warn('⚠️ [503-FALLBACK-429-429-429] Could not parse error details:', parseError);
                          }
                          
                          // ✅ FIX: تحديد النموذج البديل الثالث كمستنفد
                          if (thirdModelName) {
                            const thirdModelId = thirdBackupModel?.modelId || null;
                            await this.aiAgentService.markModelAsExhaustedFrom429(thirdModelName, thirdQuotaValue, companyId, thirdModelId);
                            console.log(`⚠️ [QUOTA-EXHAUSTED] Marked third backup model ${thirdModelName} (modelId: ${thirdModelId || 'N/A'}) as exhausted`);
                          }
                          
                          // ✅ FIX: إضافة النموذج البديل الثالث إلى قائمة النماذج التي تم تجربتها
                          if (!triedModels.has(thirdBackupModel.model)) {
                            triedModels.add(thirdBackupModel.model);
                          }
                          
                          // ✅ FIX: محاولة البحث عن نموذج بديل رابع
                          const excludeModelsArray = Array.from(triedModels);
                          const fourthBackupModel = await this.aiAgentService.findNextAvailableModel(companyId, excludeModelsArray);
                          if (fourthBackupModel && 
                              fourthBackupModel.model !== thirdBackupModel.model && 
                              fourthBackupModel.model !== secondBackupModel.model &&
                              fourthBackupModel.model !== backupModel.model &&
                              !triedModels.has(fourthBackupModel.model)) {
                            console.log(`🔄 [503-FALLBACK-429-429-429] Found fourth backup model: ${fourthBackupModel.model}`);
                            
                            try {
                              const { GoogleGenerativeAI } = require('@google/generative-ai');
                              const genAI = new GoogleGenerativeAI(fourthBackupModel.apiKey);
                              
                              const isThinkingModel = fourthBackupModel.model.includes('2.5') || fourthBackupModel.model.includes('thinking');
                              const thinkingConfig = isThinkingModel ? {
                                thinkingConfig: { thinkingBudget: 0 }
                              } : {};
                              
                              const model = genAI.getGenerativeModel({ 
                                model: fourthBackupModel.model,
                                generationConfig: await this.buildGenerationConfig(companyId, messageContext),
                                ...thinkingConfig
                              });

                              const result = await model.generateContent(prompt);
                              const response = result.response;
                              
                              if (!response || !response.candidates || response.candidates.length === 0) {
                                throw new Error('Empty response from fourth backup model');
                              }
                              
                              const aiContent = response.text();
                              if (!aiContent || aiContent.trim().length === 0) {
                                throw new Error('Empty content from fourth backup model');
                              }
                              
                              if (fourthBackupModel.modelId) {
                                await this.aiAgentService.updateModelUsage(fourthBackupModel.modelId);
                              }
                              
                              this.aiAgentService.updateCurrentActiveModel(fourthBackupModel);
                              
                              console.log(`✅ [503-FALLBACK-429-429-429] Successfully got response from fourth backup model: ${fourthBackupModel.model}`);
                              return aiContent;
                            } catch (fourthBackupError) {
                              console.error('❌ [503-FALLBACK-429-429-429] Fourth backup model also failed:', fourthBackupError.message);
                              
                              // ✅ FIX: التحقق من نوع الخطأ - إذا كان 429، حاول البحث عن نموذج بديل خامس
                              const isFourth429Error = fourthBackupError.status === 429 || 
                                                    fourthBackupError.message?.includes('429') || 
                                                    fourthBackupError.message?.includes('Too Many Requests') ||
                                                    fourthBackupError.message?.includes('quota');
                              
                              if (isFourth429Error && triedModels.size < MAX_FALLBACK_ATTEMPTS) {
                                console.log('🔄 [503-FALLBACK-429-429-429-429] Fourth backup model also failed with 429. Attempting to find fifth backup model...');
                                
                                // ✅ FIX: استخراج معلومات 429 من الخطأ
                                let fourthQuotaValue = null;
                                let fourthModelName = fourthBackupModel.model;
                                
                                try {
                                  const errorDetails = fourthBackupError.errorDetails || [];
                                  for (const detail of errorDetails) {
                                    if (detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure') {
                                      const violations = detail.violations || [];
                                      for (const violation of violations) {
                                        if (violation.quotaValue) {
                                          fourthQuotaValue = violation.quotaValue;
                                        }
                                        if (violation.quotaDimensions && violation.quotaDimensions.model) {
                                          fourthModelName = violation.quotaDimensions.model;
                                        }
                                      }
                                    }
                                  }
                                } catch (parseError) {
                                  console.warn('⚠️ [503-FALLBACK-429-429-429-429] Could not parse error details:', parseError);
                                }
                                
                                // ✅ FIX: تحديد النموذج البديل الرابع كمستنفد
                                if (fourthModelName) {
                                  const fourthModelId = fourthBackupModel?.modelId || null;
                                  await this.aiAgentService.markModelAsExhaustedFrom429(fourthModelName, fourthQuotaValue, companyId, fourthModelId);
                                  console.log(`⚠️ [QUOTA-EXHAUSTED] Marked fourth backup model ${fourthModelName} (modelId: ${fourthModelId || 'N/A'}) as exhausted`);
                                }
                                
                                // ✅ FIX: إضافة النموذج البديل الرابع إلى قائمة النماذج التي تم تجربتها
                                if (!triedModels.has(fourthBackupModel.model)) {
                                  triedModels.add(fourthBackupModel.model);
                                }
                                
                                // ✅ FIX: محاولة البحث عن نموذج بديل خامس
                                const excludeModelsArray = Array.from(triedModels);
                                const fifthBackupModel = await this.aiAgentService.findNextAvailableModel(companyId, excludeModelsArray);
                                if (fifthBackupModel && 
                                    fifthBackupModel.model !== fourthBackupModel.model && 
                                    fifthBackupModel.model !== thirdBackupModel.model &&
                                    fifthBackupModel.model !== secondBackupModel.model &&
                                    fifthBackupModel.model !== backupModel.model &&
                                    !triedModels.has(fifthBackupModel.model)) {
                                  console.log(`🔄 [503-FALLBACK-429-429-429-429] Found fifth backup model: ${fifthBackupModel.model}`);
                                  
                                  try {
                                    const { GoogleGenerativeAI } = require('@google/generative-ai');
                                    const genAI = new GoogleGenerativeAI(fifthBackupModel.apiKey);
                                    
                                    const isThinkingModel = fifthBackupModel.model.includes('2.5') || fifthBackupModel.model.includes('thinking');
                                    const thinkingConfig = isThinkingModel ? {
                                      thinkingConfig: { thinkingBudget: 0 }
                                    } : {};
                                    
                                    const model = genAI.getGenerativeModel({ 
                                      model: fifthBackupModel.model,
                                      generationConfig: await this.buildGenerationConfig(companyId, messageContext),
                                      ...thinkingConfig
                                    });

                                    const result = await model.generateContent(prompt);
                                    const response = result.response;
                                    
                                    if (!response || !response.candidates || response.candidates.length === 0) {
                                      throw new Error('Empty response from fifth backup model');
                                    }
                                    
                                    const aiContent = response.text();
                                    if (!aiContent || aiContent.trim().length === 0) {
                                      throw new Error('Empty content from fifth backup model');
                                    }
                                    
                                    if (fifthBackupModel.modelId) {
                                      await this.aiAgentService.updateModelUsage(fifthBackupModel.modelId);
                                    }
                                    
                                    this.aiAgentService.updateCurrentActiveModel(fifthBackupModel);
                                    
                                    console.log(`✅ [503-FALLBACK-429-429-429-429] Successfully got response from fifth backup model: ${fifthBackupModel.model}`);
                                    return aiContent;
                                  } catch (fifthBackupError) {
                                    console.error('❌ [503-FALLBACK-429-429-429-429] Fifth backup model also failed:', fifthBackupError.message);
                                    // سقوط إلى الكود الأصلي لإرسال الإشعار
                                  }
                                } else {
                                  console.error('❌ [503-FALLBACK-429-429-429-429] No fifth backup model available or all models exhausted');
                                }
                              }
                              // سقوط إلى الكود الأصلي لإرسال الإشعار
                            }
                          } else {
                            console.error('❌ [503-FALLBACK-429-429-429] No fourth backup model available or all models exhausted');
                          }
                        }
                        // سقوط إلى الكود الأصلي لإرسال الإشعار
                      }
                    } else {
                      console.error('❌ [503-FALLBACK-429-429] No third backup model available or all models exhausted');
                    }
                  }
                  // سقوط إلى الكود الأصلي لإرسال الإشعار
                }
              } else {
                console.error(`❌ [503-FALLBACK-429] No second backup model available. Tried: ${Array.from(triedModels).join(', ')} (${triedModels.size} models)`);
                console.error(`❌ [503-FALLBACK-429] Excluded models: ${excludeModelsArray.join(', ')}`);
                console.error(`❌ [503-FALLBACK-429] Attempts: ${triedModels.size}/${MAX_FALLBACK_ATTEMPTS}`);
                
                // ✅ FIX: محاولة البحث مرة أخرى بدون استثناءات (fallback) للتأكد من عدم وجود نماذج متاحة
                console.log(`🔄 [503-FALLBACK-429] Attempting fallback search without exclusions...`);
                const fallbackModel = await this.aiAgentService.findNextAvailableModel(companyId, []);
                if (fallbackModel) {
                  console.log(`✅ [503-FALLBACK-429] Found fallback model: ${fallbackModel.model} (Key: ${fallbackModel.keyName || 'N/A'})`);
                  // إذا كان النموذج مختلف عن النماذج المجربة، استخدمه
                  if (!triedModels.has(fallbackModel.model)) {
                    console.log(`✅ [503-FALLBACK-429] Using fallback model: ${fallbackModel.model}`);
                    // إعادة المحاولة مع النموذج الجديد
                    try {
                      const { GoogleGenerativeAI } = require('@google/generative-ai');
                      const genAI = new GoogleGenerativeAI(fallbackModel.apiKey);
                      
                      const isThinkingModel = fallbackModel.model.includes('2.5') || fallbackModel.model.includes('thinking');
                      const thinkingConfig = isThinkingModel ? {
                        thinkingConfig: { thinkingBudget: 0 }
                      } : {};
                      
                      const model = genAI.getGenerativeModel({ 
                        model: fallbackModel.model,
                        generationConfig: await this.buildGenerationConfig(companyId, messageContext),
                        ...thinkingConfig
                      });

                      const result = await model.generateContent(prompt);
                      const response = result.response;
                      
                      if (!response || !response.candidates || response.candidates.length === 0) {
                        throw new Error('Empty response from fallback model');
                      }
                      
                      const aiContent = response.text();
                      if (!aiContent || aiContent.trim().length === 0) {
                        throw new Error('Empty content from fallback model');
                      }
                      
                      if (fallbackModel.modelId) {
                        await this.aiAgentService.updateModelUsage(fallbackModel.modelId);
                      }
                      
                      this.aiAgentService.updateCurrentActiveModel(fallbackModel);
                      
                      console.log(`✅ [503-FALLBACK-429] Successfully got response from fallback model: ${fallbackModel.model}`);
                      return aiContent;
                    } catch (fallbackError) {
                      console.error('❌ [503-FALLBACK-429] Fallback model also failed:', fallbackError.message);
                    }
                  } else {
                    console.log(`⚠️ [503-FALLBACK-429] Fallback model ${fallbackModel.model} was already tried`);
                  }
                } else {
                  console.error(`❌ [503-FALLBACK-429] No fallback model available - all models exhausted`);
                }
              }
            }
            
            // 🤐 النظام الصامت - إرسال إشعار فوري عند فشل النموذج البديل
            if (companyId && conversationId) {
              await aiResponseMonitor.recordAIFailure({
                companyId: companyId,
                conversationId: conversationId,
                customerId: null,
                errorType: 'backup_model_failed',
                errorMessage: `Backup model failed: ${retryError.message}`,
                context: {
                  originalError: '503 Service Unavailable',
                  backupModel: backupModel.model,
                  is429Error: is429Error
                }
              });

              await aiResponseMonitor.sendNotification({
                companyId: companyId,
                type: 'ai_backup_model_failed',
                severity: 'high',
                title: '🚨 فشل النموذج البديل أيضاً',
                message: `فشل النموذج البديل (${backupModel.model}) بعد فشل النموذج الأساسي. المحادثة: ${conversationId}`,
                metadata: {
                  originalError: '503 Service Unavailable',
                  backupModel: backupModel.model,
                  errorMessage: retryError.message,
                  is429Error: is429Error,
                  conversationId
                }
              });
            }
            
            // 🤐 النظام الصامت - إرجاع كائن يحتوي على السبب
            return { content: null, silentReason: `فشل النموذج البديل بعد خطأ 503: ${retryError.message}` };
          }
        } else {
          // ✅ FIX 7: رسالة مختلفة حسب السبب
          const reason = triedModels.size >= MAX_FALLBACK_ATTEMPTS 
            ? `استنفدت جميع المحاولات (${triedModels.size}/${MAX_FALLBACK_ATTEMPTS})`
            : 'لا يوجد نماذج بديلة متاحة';
          
          console.error(`❌ [503-FALLBACK] ${reason}. Tried models: ${Array.from(triedModels).join(', ')}`);
          
          // 🤐 النظام الصامت - إرسال إشعار فوري
          if (companyId && conversationId) {
            await aiResponseMonitor.recordAIFailure({
              companyId: companyId,
              conversationId: conversationId,
              customerId: null,
              errorType: triedModels.size >= MAX_FALLBACK_ATTEMPTS ? 'max_attempts_exceeded' : 'no_backup_model',
              errorMessage: `Model is overloaded. ${reason}. Tried: ${Array.from(triedModels).join(', ')}`,
              context: {
                originalError: '503 Service Unavailable'
              }
            });

            await aiResponseMonitor.sendNotification({
              companyId: companyId,
              type: 'ai_no_backup_model',
              severity: 'critical',
              title: '🚨 لا يوجد نموذج بديل متاح',
              message: `النموذج الأساسي معطل ولا يوجد نموذج بديل متاح. المحادثة: ${conversationId}`,
              metadata: {
                originalError: '503 Service Unavailable',
                conversationId
              }
            });
          }
          
          // 🤐 النظام الصامت - إرجاع كائن يحتوي على السبب
          return { content: null, silentReason: 'النموذج الأساسي معطل ولا يوجد نموذج بديل متاح (503 Service Unavailable)' };
        }
      }

      // فحص إذا كان خطأ 429 (تجاوز الحد)
      if (error.status === 429 || error.message.includes('429') || error.message.includes('Too Many Requests')) {
        // ✅ FIX: استخراج معلومات الحد من رسالة الخطأ بشكل أفضل
        let quotaValue = null;
        // ✅ FIX: الحصول على geminiConfig إذا لم يكن متوفراً في هذا النطاق (catch block)
        let currentGeminiConfig = geminiConfig;
        if (!currentGeminiConfig && companyId) {
          try {
            currentGeminiConfig = await this.aiAgentService.getCurrentActiveModel(companyId);
          } catch (configError) {
            console.warn('⚠️ [429-ERROR] Could not get geminiConfig:', configError.message);
          }
        }
        let modelName = currentGeminiConfig?.model || null; // استخدام النموذج الحالي كبديل
        
        try {
          // محاولة استخراج من errorDetails
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
          
          // ✅ FIX: إذا لم نجد modelName في errorDetails، نستخدم النموذج من currentGeminiConfig
          if (!modelName && currentGeminiConfig?.model) {
            modelName = currentGeminiConfig.model;
          }
          
          // ✅ FIX: محاولة استخراج quotaValue من رسالة الخطأ مباشرة
          if (!quotaValue) {
            const quotaMatch = error.message.match(/limit:\s*(\d+)/i);
            if (quotaMatch) {
              quotaValue = quotaMatch[1];
            }
          }
          
          // ✅ FIX: إذا لم نجد quotaValue، نستخدم القيمة الافتراضية من قاعدة البيانات
          if (!quotaValue && currentGeminiConfig?.modelId) {
            try {
              const modelRecord = await this.aiAgentService.getModelManager().prisma.geminiKeyModel.findUnique({
                where: { id: currentGeminiConfig.modelId }
              });
              if (modelRecord) {
                const usage = JSON.parse(modelRecord.usage);
                quotaValue = usage.limit || 250;
              }
            } catch (dbError) {
              console.error('❌ Error fetching model usage from DB:', dbError);
            }
          }
          
        } catch (parseError) {
          console.error('❌ Error parsing 429 error details:', parseError);
        }

        // ✅ FIX: تحديث النموذج كمستنفد بناءً على المعلومات الحقيقية
        // ✅ FIX: تمرير modelId لتحديث فقط المفتاح المحدد الذي فشل، وليس جميع المفاتيح
        if (modelName) {
          const modelId = currentGeminiConfig?.modelId || null;
          await this.aiAgentService.markModelAsExhaustedFrom429(modelName, quotaValue, companyId, modelId);
          if (modelId) {
            console.log(`⚠️ [QUOTA-EXHAUSTED] Marked model ${modelName} (modelId: ${modelId}) as exhausted (quota: ${quotaValue || 'unknown'})`);
          } else {
            console.log(`⚠️ [QUOTA-EXHAUSTED] Marked model ${modelName} as exhausted (quota: ${quotaValue || 'unknown'}) - No modelId provided, updating all models`);
          }
        } else {
          console.warn('⚠️ [QUOTA-EXHAUSTED] Cannot mark model as exhausted - modelName not found');
        }

        // ✅ FIX 2: محاولة الحصول على نموذج بديل مع استثناء النماذج المجربة
        const excludeModelsArray = Array.from(triedModels);
        const backupModel = await this.aiAgentService.findNextAvailableModel(companyId, excludeModelsArray);
        if (backupModel) {
          // إعادة المحاولة مع النموذج الجديد
          try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(backupModel.apiKey);
            
            // ✅ إعداد thinkingConfig لتقليل استهلاك التوكنز
            const isThinkingModel = backupModel.model.includes('2.5') || backupModel.model.includes('thinking');
            const thinkingConfig = isThinkingModel ? {
              thinkingConfig: { thinkingBudget: 0 }
            } : {};
            
            const model = genAI.getGenerativeModel({ 
              model: backupModel.model,
              ...thinkingConfig
            });

            const result = await model.generateContent(prompt);
            const response = result.response;
            const aiContent = response.text();

            // ✅ FIX: تحديث عداد الاستخدام للنموذج الجديد فقط بعد نجاح الطلب
            if (backupModel.modelId) {
              await this.aiAgentService.updateModelUsage(backupModel.modelId);
            }

            // تحديث النموذج النشط للجلسة
            this.aiAgentService.updateCurrentActiveModel(backupModel);

            return aiContent;
          } catch (retryError) {
            console.error('❌ فشل النموذج البديل أيضاً:', retryError.message);
            
            // 🤐 النظام الصامت - إرسال إشعار فوري عند فشل النموذج البديل
            if (companyId && conversationId) {
              await aiResponseMonitor.recordAIFailure({
                companyId: companyId,
                conversationId: conversationId,
                customerId: null,
                errorType: 'backup_model_failed',
                errorMessage: `Backup model failed: ${retryError.message}`,
                context: {
                  originalError: '429 Quota Exceeded',
                  backupModel: backupModel.model
                }
              });

              await aiResponseMonitor.sendNotification({
                companyId: companyId,
                type: 'ai_backup_model_failed',
                severity: 'high',
                title: '🚨 فشل النموذج البديل أيضاً',
                message: `فشل النموذج البديل (${backupModel.model}) بعد تجاوز حد النموذج الأساسي. المحادثة: ${conversationId}`,
                metadata: {
                  originalError: '429 Quota Exceeded',
                  backupModel: backupModel.model,
                  errorMessage: retryError.message,
                  conversationId
                }
              });
            }
            
            // 🤐 النظام الصامت - إرجاع كائن يحتوي على السبب
            return { content: null, silentReason: `فشل النموذج البديل بعد خطأ 503: ${retryError.message}` };
          }
        } else {
          console.error('❌ لا توجد نماذج بديلة متاحة');
          
          // 🤐 النظام الصامت - إرسال إشعار فوري
          if (companyId && conversationId) {
            await aiResponseMonitor.recordAIFailure({
              companyId: companyId,
              conversationId: conversationId,
              customerId: null,
              errorType: 'no_backup_model',
              errorMessage: 'جميع النماذج المتاحة تجاوزت الحد المسموح',
              context: {
                originalError: '429 Quota Exceeded'
              }
            });

            await aiResponseMonitor.sendNotification({
              companyId: companyId,
              type: 'ai_no_backup_model',
              severity: 'critical',
              title: '🚨 جميع النماذج تجاوزت الحد',
              message: `جميع النماذج المتاحة تجاوزت الحد المسموح. المحادثة: ${conversationId}`,
              metadata: {
                originalError: '429 Quota Exceeded',
                conversationId
              }
            });
          }
          
          // 🤐 النظام الصامت - إرجاع كائن يحتوي على السبب
          return { content: null, silentReason: 'النموذج الأساسي معطل ولا يوجد نموذج بديل متاح (503 Service Unavailable)' };
        }
      }

      // 🤐 النظام الصامت - إرسال إشعار فوري للأخطاء الأخرى
      if (companyId && conversationId) {
        await aiResponseMonitor.recordAIFailure({
          companyId: companyId,
          conversationId: conversationId,
          customerId: null,
          errorType: this.aiAgentService.errorHandler.classifyError(error),
          errorMessage: error.message,
          context: {
            errorName: error.name,
            errorStack: error.stack?.substring(0, 500)
          }
        });
      }
      
      // 🤐 النظام الصامت - إرجاع كائن يحتوي على السبب
      const errorType = this.aiAgentService.errorHandler?.classifyError?.(error) || 'unknown_error';
      
      // ✅ FIX 1: تنظيف session بعد الفشل
      this.globalTriedModels.delete(sessionId);
      
      return { content: null, silentReason: `خطأ في توليد الرد: ${error.message} (نوع الخطأ: ${errorType})` };
    }
  }
}

module.exports = ResponseGenerator;


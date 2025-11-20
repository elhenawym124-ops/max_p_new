/**
 * Response Generator Module
 * 
 * هذا الموديول مسؤول عن توليد ردود AI وبناء الـ prompts
 * تم نقله من aiAgentService.js لتسهيل الصيانة
 */

const aiResponseMonitor = require('../aiResponseMonitor');
const productExtractor = require('./productExtractor');

class ResponseGenerator {
  constructor(aiAgentService) {
    // ✅ حفظ reference لـ aiAgentService للوصول للدوال المساعدة
    this.aiAgentService = aiAgentService;
  }

  /**
   * ✨ بناء إعدادات التوليد الديناميكية بناءً على السياق
   */
  async buildGenerationConfig(companyId, messageContext = {}) {
    try {
      // الحصول على إعدادات AI من قاعدة البيانات
      const settings = await this.aiAgentService.getSettings(companyId);
      
      // الإعدادات الأساسية
      const baseConfig = {
        temperature: settings.aiTemperature || 0.65, // ✅ تقليل قليلاً لتقليل التفكير الزائد
        topK: settings.aiTopK || 40,
        topP: settings.aiTopP || 0.9,
        maxOutputTokens: settings.aiMaxTokens || 4096, // ✅ تحسين: تقليل من 16384 إلى 4096 لتوفير tokens
      };

      // تعديل الإعدادات حسب نوع الرسالة
      const messageType = messageContext?.messageType || 'general';
      
      // ✅ Allow overriding temperature and maxOutputTokens from messageContext
      if (messageContext?.temperature !== undefined) {
        baseConfig.temperature = messageContext.temperature;
      }
      if (messageContext?.maxTokens !== undefined) {
        baseConfig.maxOutputTokens = messageContext.maxTokens;
      }
      
      if (messageType === 'greeting' || messageType === 'casual_chat') {
        // للتحيات والدردشة: إبداع أعلى قليلاً (فقط إذا لم يتم تحديد temperature في messageContext)
        if (messageContext?.temperature === undefined) {
          baseConfig.temperature = Math.min(baseConfig.temperature + 0.1, 0.9);
        }
      } else if (messageType === 'order_confirmation' || messageType === 'order_details') {
        // لتأكيد الطلبات: دقة عالية (temperature منخفض) (فقط إذا لم يتم تحديد temperature في messageContext)
        if (messageContext?.temperature === undefined) {
          baseConfig.temperature = 0.3;
        }
        baseConfig.topK = 10;
        baseConfig.topP = 0.8;
      } else if (messageType === 'product_inquiry' || messageType === 'price_inquiry') {
        // للاستفسارات: توازن بين الدقة والإبداع (فقط إذا لم يتم تحديد temperature في messageContext)
        if (messageContext?.temperature === undefined) {
          baseConfig.temperature = 0.6;
        }
      } else if (messageType === 'complaint' || messageType === 'problem') {
        // للشكاوى: دقة عالية وتعاطف (فقط إذا لم يتم تحديد temperature في messageContext)
        if (messageContext?.temperature === undefined) {
          baseConfig.temperature = 0.4;
        }
        baseConfig.topK = 20;
      } else if (messageType === 'context_extraction') {
        // لاستخراج السياق: دقة عالية جداً (temperature منخفض جداً)
        if (messageContext?.temperature === undefined) {
          baseConfig.temperature = 0.1;
        }
        if (messageContext?.maxTokens === undefined) {
          baseConfig.maxOutputTokens = 200;
        }
      }

      //console.log(`🎛️ [AI-CONFIG] Using generation config:`, baseConfig);
      return baseConfig;
      
    } catch (error) {
      console.error('❌ [AI-CONFIG] Error building generation config:', error);
      // إرجاع الإعدادات الافتراضية عند حدوث خطأ
      return {
        temperature: 0.65,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 4096, // ✅ تحسين: تقليل من 16384 إلى 4096 لتوفير tokens
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

    // Add response guidelines
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

    // ✅ FIX: إضافة تحذير صارم بعدم الترحيب إذا كانت هناك محادثة سابقة
    if (conversationMemory && conversationMemory.length > 0) {
      // حساب عدد رسائل AI في المحادثة
      const aiMessagesCount = conversationMemory.filter(msg => !msg.isFromCustomer).length;
      if (aiMessagesCount > 0) {
        prompt += `🚫🚫🚫 تحذير مهم جداً - ممنوع الترحيب!\n`;
        prompt += `=====================================\n`;
        prompt += `⚠️ هذه ليست أول رسالة في المحادثة!\n`;
        prompt += `⚠️ يوجد ${aiMessagesCount} رد${aiMessagesCount > 1 ? 'ود' : ''} سابق${aiMessagesCount > 1 ? 'ة' : ''} منك في هذه المحادثة!\n`;
        prompt += `🚫 ممنوع تماماً استخدام أي تحية في بداية ردك!\n`;
        prompt += `🚫 ممنوع استخدام: "أهلاً بيك"، "مرحباً"، "السلام عليكم"، "أهلاً وسهلاً"، "مرحباً بك مرة أخرى"\n`;
        prompt += `✅ ابدأي ردك مباشرة بالإجابة على سؤال العميل أو متابعة المحادثة!\n`;
        prompt += `=====================================\n\n`;
      }
    }

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
        
        // محاولة استخراج المحافظة من الرسالة
        const extractedGov = await shippingService.extractGovernorateFromMessage(customerMessage, companyId);
        
        if (isAskingAboutShipping || extractedGov.found) {
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

    // Add customer information with dynamic context
    const isNewCustomer = !customerData?.orderCount || customerData.orderCount === 0;
    const conversationLength = conversationMemory?.length || 0;

    prompt += `معلومات العميل:
- الاسم: ${customerData?.name || 'عميل جديد'}
- الهاتف: ${customerData?.phone || 'غير محدد'}
- ${isNewCustomer ? '🆕 عميل جديد (أول مرة يتواصل معانا)' : `عميل راجع (عنده ${customerData.orderCount} طلب سابق)`}
- مرحلة المحادثة: ${conversationLength === 0 ? 'بداية المحادثة' : conversationLength < 3 ? 'في بداية التفاعل' : 'محادثة متقدمة'}\n`;

    // ✅ IMPORTANT: Instructions to read conversation before asking for information
    prompt += `⚠️ مهم جداً - تعليمات قراءة المحادثة:
=====================================
قبل السؤال عن أي معلومات (الاسم، العنوان، رقم الموبايل، المحافظة، المقاس، إلخ)، اقرأي المحادثة بالكامل أولاً.

📋 القواعد المهمة:
1. ✅ إذا كان العميل قد أرسل العنوان/الاسم/رقم الموبايل في رسالة سابقة، استخدميها مباشرة ولا تسألي عنه مرة أخرى
2. ✅ إذا كان العميل قد ذكر المحافظة في رسالة سابقة، استخدميها مباشرة
3. ✅ إذا كان العميل قد ذكر المقاس/اللون/المنتج في رسالة سابقة، استخدميها مباشرة
4. ❌ لا تسألي عن معلومات موجودة بالفعل في المحادثة
5. ✅ اقرأي سجل المحادثة أدناه بعناية قبل الرد

💡 مثال: إذا كتب العميل "15 شارع محمد حسين..." - هذا عنوان كامل، لا تسألي عن "العنوان بالتفصيل" مرة أخرى.
=====================================\n\n`;

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
      
      // ✅ FIX: تحسين تعليمات استخدام الذاكرة بشكل أقوى وأوضح
      prompt += `📚 سجل المحادثة (⚠️ اقرأيه بعناية فائقة واستخدميه في ردك):\n`;
      prompt += `=====================================\n`;
      prompt += `🔥🔥🔥 تحذير مهم جداً - يجب استخدام الذاكرة:\n`;
      prompt += `=====================================\n`;
      prompt += `📋 هذا السياق يحتوي على معلومات مهمة جداً عن المحادثة السابقة.\n`;
      prompt += `✅ يجب أن تستخدمي هذه المعلومات في ردك وتربطيها بالرسالة الحالية.\n`;
      prompt += `✅ يجب أن تشيري للمنتجات/الأسعار/المعلومات المذكورة سابقاً إذا كانت مرتبطة بالرسالة الحالية.\n`;
      prompt += `✅ استخدمي عبارات مثل: "زي ما ذكرتلك قبل كده"، "كما وضحتلك سابقاً"، "المحادثة السابقة"، "قبل كده"، "سابقاً"\n`;
      prompt += `🚫 مهم جداً: هذه ليست أول رسالة - لا ترحبي بالعميل مرة أخرى!\n`;
      prompt += `🚫 ممنوع استخدام أي تحية في بداية ردك (أهلاً، مرحباً، السلام عليكم، إلخ)\n`;
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
      prompt += `🔥 تعليمات مهمة جداً:\n`;
      prompt += `=====================================\n`;
      prompt += `1. ✅ اقرأي المحادثة السابقة بعناية فائقة\n`;
      prompt += `2. ✅ استخدمي المعلومات المذكورة سابقاً في ردك\n`;
      prompt += `3. ✅ أشاري للمنتجات/الأسعار/المعلومات المذكورة سابقاً باستخدام عبارات مثل: "زي ما ذكرتلك قبل كده"، "كما وضحتلك سابقاً"\n`;
      prompt += `4. ✅ ربطي ردك بالمحادثة السابقة - لا تعاملي كل رسالة كأنها جديدة\n`;
      prompt += `5. ✅ إذا سأل العميل عن منتج أو سعر مذكور سابقاً، استخدمي المعلومات من المحادثة السابقة\n`;
      prompt += `6. ❌ لا تسألي عن معلومات موجودة بالفعل في المحادثة (العنوان، المحافظة، الهاتف، الاسم، المنتج، المقاس، اللون)\n`;
      prompt += `7. 🚫 إذا كانت المحادثة متقدمة (أكثر من 3 رسائل)، ممنوع تماماً الترحيب مرة أخرى\n`;
      prompt += `=====================================\n\n`;
      
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
            prompt += `📸 تعليمات لإرسال الصور:\n`;
            prompt += `   - اذكري أنك سترسلين صور ${lastMentionedProduct}\n`;
            prompt += `   - الصور ستُرسل تلقائياً إذا كانت متوفرة\n`;
            prompt += `   - استخدمي عبارات مثل "صور ${lastMentionedProduct}..."\n\n`;
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
          const productPrice = item.metadata?.price || 'غير متوفر';
          prompt += `🛍️ منتج ${index + 1}: ${productName}\n`;
          prompt += `   السعر: ${productPrice} جنيه\n`;
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
        prompt += `💡 الصور ستُرسل تلقائياً (${smartResponseInfo.categoryInfo.totalImages} صورة) - اذكري المنتجات بشكل طبيعي.\n\n`;
      } else {
        // طلب منتج محدد أو منتجات متعددة - العرض العادي
        prompt += `🗃️ المعلومات المتاحة من قاعدة البيانات (استخدميها فقط):\n`;
        prompt += `=====================================\n`;

        const imageInfo = [];

        filteredRagData.forEach((item, index) => {
          if (item.type === 'product') {
            prompt += `🛍️ منتج ${index + 1}: ${item.content}\n`;

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

    // ✅ Add comprehensive response quality guidelines
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

    // ✅ Add final response quality check instructions
    prompt += `\n🔴 تعليمات نهائية لجودة الرد:\n`;
    prompt += `=====================================\n`;
    prompt += `✅ قبل إرسال الرد، تأكدي من:\n`;
    prompt += `1. الرد واضح ومفيد (50-300 كلمة)\n`;
    prompt += `2. الرد يحتوي على المعلومات المطلوبة من قاعدة البيانات\n`;
    prompt += `3. الرد مرتبط بالسياق من المحادثة السابقة\n`;
    prompt += `4. الرد مهذب ومحترف ويستخدم شخصيتك المحددة\n`;
    prompt += `5. الرد يوجه المحادثة بشكل صحيح (سؤال أو اقتراح في النهاية)\n`;
    prompt += `6. إذا كان السؤال غامضاً، تم طلب التوضيح\n`;
    prompt += `7. لم يتم تكرار المعلومات المطلوبة (إذا كانت موجودة في المحادثة السابقة)\n`;
    if (conversationMemory && conversationMemory.length > 0) {
      prompt += `8. 🚫 مهم جداً: إذا كانت هناك محادثة سابقة (${conversationMemory.length} رسالة)، لا تبدأي الرد بأي تحية!\n`;
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
   * Generate AI response using Gemini API with Pattern Enhancement
   */
  async generateAIResponse(prompt, conversationMemory, useRAG, providedGeminiConfig, companyId, conversationId, messageContext) {
    // ✅ FIX: إعلان geminiConfig خارج try block ليكون متاحاً في catch block
    let geminiConfig = null;
    
    try {
      // Get active Gemini configuration (use provided one if available, otherwise use session model with company isolation)
      geminiConfig = providedGeminiConfig || await this.aiAgentService.getCurrentActiveModel(companyId);
      if (!geminiConfig) {
        throw new Error(`No active Gemini key found for company: ${companyId}`);
      }

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

      // Step 2: Generate AI response using enhanced prompt with retry logic for 503 errors
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
      const model = genAI.getGenerativeModel({ 
        model: geminiConfig.model, 
        generationConfig
      });

      // 🔄 Retry logic with exponential backoff for 503 Service Unavailable errors
      // ✅ تحسين: تقليل عدد المحاولات من 3 إلى 2 لتوفير tokens
      let result;
      let response;
      const maxRetries = 2; // ✅ تحسين: تقليل من 3 إلى 2
      const retryDelays = [1000, 2000]; // ✅ تحسين: تقليل من 3 إلى 2
      let lastError;
      let usedModelId = geminiConfig.modelId; // حفظ modelId للاستخدام بعد النجاح
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          result = await model.generateContent(enhancedPrompt);
          response = result.response;
          
          // ✅ FIX: تحديث الاستخدام فقط بعد نجاح الطلب
          if (usedModelId) {
            console.log(`✅ [USAGE-UPDATE] Updating usage for modelId: ${usedModelId}, model: ${geminiConfig.model}`);
            await this.aiAgentService.updateModelUsage(usedModelId);
          } else {
            console.warn(`⚠️ [USAGE-UPDATE] modelId is missing! geminiConfig:`, {
              model: geminiConfig.model,
              keyId: geminiConfig.keyId,
              modelId: geminiConfig.modelId
            });
          }
          
          break; // Success, exit retry loop
        } catch (retryError) {
          lastError = retryError;
          
          // Check if it's a 503 Service Unavailable error
          const is503Error = retryError.status === 503 || 
                           retryError.message?.includes('503') || 
                           retryError.message?.includes('Service Unavailable') ||
                           retryError.message?.includes('overloaded');
          
          if (is503Error && attempt < maxRetries) {
            const delay = retryDelays[attempt];
            console.log(`🔄 [RETRY-503] Attempt ${attempt + 1}/${maxRetries + 1} failed with 503. Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Retry
          } else {
            // Not a 503 error or max retries exceeded, throw the error
            throw retryError;
          }
        }
      }
      
      if (!response) {
        throw lastError || new Error('Failed to generate content after retries');
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
      if (response?.usageMetadata) {
        const tokenUsage = {
          promptTokenCount: response.usageMetadata.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata.totalTokenCount || 0
        };
        console.log(`📊 [TOKEN-USAGE] Tokens consumed:`, {
          prompt: tokenUsage.promptTokenCount,
          response: tokenUsage.candidatesTokenCount,
          total: tokenUsage.totalTokenCount,
          model: geminiConfig.model,
          companyId: companyId
        });
      }
      
      // ✅ FIX: تحديث الاستخدام بناءً على usageMetadata الفعلي من Google (إذا كان متوفراً)
      // هذا يعطي دقة أكبر من العد اليدوي
      if (response?.usageMetadata && usedModelId) {
        try {
          const totalTokens = response.usageMetadata.totalTokenCount || 0;
          // يمكن استخدام totalTokens لتحديث الاستخدام بشكل أكثر دقة
          // لكن حالياً نستخدم العد اليدوي (طلب واحد = استخدام واحد)
          // يمكن تحسين هذا لاحقاً إذا كان هناك حاجة لتتبع الـ tokens
        } catch (usageError) {
          console.warn('⚠️ [USAGE-METADATA] Error processing usage metadata:', usageError);
        }
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

        // 🤐 النظام الصامت - إرجاع null بدلاً من محاولة استخراج نص
        return null;
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

            // 🤐 النظام الصامت - إرجاع null
            return null;
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
              
              // ✅ إعادة المحاولة مرة واحدة فقط بإعدادات محسنة
              if (!messageContext?._retried_max_tokens) {
                console.log(`🔄 [AI-MAX-TOKENS] Retrying with maxOutputTokens: 8192, temperature: 0.3`);
                
                // إنشاء messageContext جديد مع إعدادات محسنة
                const retryContext = {
                  ...messageContext,
                  maxTokens: 8192, // ✅ تحسين: تقليل من 32768 إلى 8192 لتوفير tokens
                  temperature: 0.3, // ✅ تقليل التفكير الزائد
                  _retried_max_tokens: true // ✅ علامة لمنع التكرار اللانهائي
                };
                
                // إعادة المحاولة
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
              
              // إذا فشلت المحاولة الثانية، إرسال إشعار
              console.error(`❌ [AI-MAX-TOKENS] Retry failed - response still empty`);
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
                    retriedWithMaxTokens: 32768
                  }
                });
              }
              
              // إرجاع null للسماح بـ fallback في messageProcessor
              return null;
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
            return null;
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
        
        return null; // 🤐 إرجاع null بدلاً من string فارغ
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
        
        return null; // 🤐 إرجاع null بدلاً من string فارغ
      }
      
      // ✅ FIX: الردود من 3-9 أحرف قد تكون صحيحة لكن قصيرة - نتحقق من المحتوى
      if (trimmedContent.length >= 3 && trimmedContent.length < 10 && !isConfirmationCheck) {
        // كلمات مفيدة مقبولة حتى لو كانت قصيرة
        const usefulShortWords = ['شكراً', 'شكرا', 'شكر', 'تمام', 'حاضر', 'نعم', 'موافق', 'ممتاز', 'أوكي', 'ok', 'yes'];
        const hasUsefulWord = usefulShortWords.some(word => trimmedContent.toLowerCase().includes(word.toLowerCase()));
        
        // ✅ FIX: إذا كان الرد قصيراً ولا يحتوي على كلمات مفيدة، نحاول إعادة التوليد
        if (!hasUsefulWord) {
          console.warn(`⚠️ [AI-VALIDATION] Response is short (${trimmedContent.length} chars) and doesn't contain useful words: "${trimmedContent}"`);
          
          // ✅ FIX: إرجاع null لإعادة المحاولة في messageProcessor
          return null;
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
        
        return null; // 🤐 إرجاع null بدلاً من string فارغ
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
        
        return null; // 🤐 إرجاع null بدلاً من string فارغ
      }

      return trimmedContent;

    } catch (error) {
      console.error('❌ Error in generateAIResponse:', error.message);

      // فحص إذا كان خطأ 503 (Service Unavailable - Model Overloaded)
      const is503Error = error.status === 503 || 
                        error.message?.includes('503') || 
                        error.message?.includes('Service Unavailable') ||
                        error.message?.includes('overloaded');
      
      if (is503Error) {
        console.log('🔄 [503-ERROR] Model is overloaded. Attempting to switch to backup model...');
        
        // محاولة الحصول على نموذج بديل للشركة
        const backupModel = await this.aiAgentService.findNextAvailableModel(companyId);
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
                  backupModel: backupModel.model
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
                  conversationId
                }
              });
            }
            
            // 🤐 النظام الصامت - إرجاع null بدلاً من رمي error
            return null;
          }
        } else {
          console.error('❌ [503-FALLBACK] No backup model available');
          
          // 🤐 النظام الصامت - إرسال إشعار فوري
          if (companyId && conversationId) {
            await aiResponseMonitor.recordAIFailure({
              companyId: companyId,
              conversationId: conversationId,
              customerId: null,
              errorType: 'no_backup_model',
              errorMessage: 'Model is overloaded and no backup models are available',
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
          
          // 🤐 النظام الصامت - إرجاع null بدلاً من رمي error
          return null;
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
        // إذا كان modelName موجوداً، نحدث جميع النماذج بهذا الاسم
        if (modelName) {
          await this.aiAgentService.markModelAsExhaustedFrom429(modelName, quotaValue, companyId);
          console.log(`⚠️ [QUOTA-EXHAUSTED] Marked model ${modelName} as exhausted (quota: ${quotaValue || 'unknown'})`);
        } else {
          console.warn('⚠️ [QUOTA-EXHAUSTED] Cannot mark model as exhausted - modelName not found');
        }

        // محاولة الحصول على نموذج بديل للشركة
        const backupModel = await this.aiAgentService.findNextAvailableModel(companyId);
        if (backupModel) {
          // إعادة المحاولة مع النموذج الجديد
          try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(backupModel.apiKey);
            const model = genAI.getGenerativeModel({ model: backupModel.model });

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
            
            // 🤐 النظام الصامت - إرجاع null بدلاً من رمي error
            return null;
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
          
          // 🤐 النظام الصامت - إرجاع null بدلاً من رمي error
          return null;
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
      
      // 🤐 النظام الصامت - إرجاع null بدلاً من رمي error
      return null;
    }
  }
}

module.exports = ResponseGenerator;


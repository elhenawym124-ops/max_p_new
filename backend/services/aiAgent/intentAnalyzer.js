/**
 * Intent Analyzer Module
 * 
 * هذا الـ module يحتوي على منطق تحليل الـ intent:
 * 1. analyzeIntent - تحليل الـ intent الأساسي
 * 2. analyzeIntentWithEnhancedContext - تحليل الـ intent مع سياق محسن
 * 3. وظائف تحليل السياق
 * 
 * ملاحظة: هذا الـ module للرجوع فقط - لا يتم استخدامه في الملف الرئيسي حالياً
 */

class IntentAnalyzer {
  /**
   * تحليل الـ intent من الرسالة
   * ✅ محسّن: إضافة فحص أولي للتحيات وتحسين أولوية الكلمات المفتاحية
   * @param {string} message - رسالة العميل
   * @param {Array} conversationMemory - سجل المحادثة
   * @param {string} companyId - معرف الشركة
   * @param {Function} generateAIResponse - دالة توليد رد AI (يتم تمريرها من الملف الرئيسي)
   * @param {Function} fallbackIntentAnalysis - دالة تحليل الـ intent الاحتياطية (async، AI-based، يتم تمريرها من الملف الرئيسي)
   * @returns {Promise<string>} - الـ intent المكتشف
   */
  async analyzeIntent(message, conversationMemory, companyId, generateAIResponse, fallbackIntentAnalysis) {
    try {
      // ✅ AI-FIRST APPROACH: استخدام AI مباشرة بدون keyword matching
      // تم إزالة keyword checks للاعتماد الكامل على AI

      // ✅ STEP 3: بناء السياق من المحادثة السابقة (محسّن)
      let conversationContext = '';
      let recentProductMentions = [];
      let recentPriceMentions = [];
      
      if (conversationMemory && conversationMemory.length > 0) {
        const recentMessages = conversationMemory.slice(-5); // زيادة من 3 إلى 5
        
        conversationContext = recentMessages.map((memory, index) => {
          const userMsg = memory.userMessage || memory.content || '';
          const aiMsg = memory.aiResponse || '';
          
          // استخراج المنتجات والأسعار المذكورة
          if (this.hasProductMention(userMsg)) {
            recentProductMentions.push(userMsg);
          }
          if (this.hasPriceMention(userMsg)) {
            recentPriceMentions.push(userMsg);
          }
          
          return `العميل: ${userMsg}\nالرد: ${aiMsg}`;
        }).join('\n---\n');
      }

      // ✅ STEP 4: AI-powered intent analysis prompt (محسّن)
      const intentPrompt = `
أنت خبير متقدم في تحليل نوايا العملاء. حلل الرسالة التالية وحدد النية بدقة عالية:

الرسالة الحالية: "${message}"

${conversationContext ? `سياق المحادثة السابقة (آخر 5 رسائل):\n${conversationContext}\n` : '⚠️ هذه أول رسالة في المحادثة.\n'}

${recentProductMentions.length > 0 ? `📦 المنتجات المذكورة سابقاً:\n${recentProductMentions.join('\n')}\n` : ''}
${recentPriceMentions.length > 0 ? `💰 الأسعار المذكورة سابقاً:\n${recentPriceMentions.join('\n')}\n` : ''}

حدد النية من الخيارات التالية فقط:
- greeting: إذا كان يحيي أو يبدأ المحادثة (حتى لو كان معه سؤال)
- price_inquiry: إذا كان يسأل عن الأسعار أو التكلفة (الأولوية العليا للكلمات: كام، بكام، سعر، ثمن)
- product_inquiry: إذا كان يسأل عن المنتجات أو يريد معلومات أو صور عن المنتجات
- shipping_inquiry: إذا كان يسأل عن الشحن أو التوصيل
- order_inquiry: إذا كان يريد طلب أو شراء شيء
- general_inquiry: لأي استفسار عام آخر

🔴 قواعد الأولوية (يجب تطبيقها بالترتيب):

1. ✅ التحيات (أولوية قصوى):
   - إذا كانت الرسالة تبدأ بـ: "السلام"، "أهلاً"، "مرحبا"، "ازيك"، "هلو" = greeting
   - حتى لو كان بعد التحية سؤال = greeting (التحية هي النية الأساسية)
   - إذا كانت أول رسالة في المحادثة = greeting (حتى لو معه سؤال)
   - مثال: "أهلاً، عندك إيه من المنتجات؟" = greeting (وليس product_inquiry)

2. ✅ الأسعار (أولوية عالية):
   - إذا كان السؤال يحتوي على: "كام"، "بكام"، "بكم"، "سعر"، "سعره"، "ثمن"، "تمن" = price_inquiry
   - حتى لو كان في السياق منتج = price_inquiry (السؤال عن السعر أولوية)
   - مثال: "كام سعر الكوتشي ده؟" = price_inquiry (وليس product_inquiry)
   - مثال: "كام السعر؟" = price_inquiry (حتى بدون ذكر منتج)

3. ✅ المنتجات:
   - إذا طلب "صور" أو "صورة" أو "ممكن أشوف" أو "صورته" = product_inquiry
   - إذا كان السياق يتحدث عن منتج وطلب شيء غامض مثل "ممكن صورته" = product_inquiry
   - إذا سأل "عندك" أو "في" + اسم منتج = product_inquiry

4. ✅ الطلبات:
   - إذا قال "أطلب" أو "أشتري" أو "أوردر" = order_inquiry

5. ✅ الشحن:
   - إذا سأل عن "شحن" أو "توصيل" = shipping_inquiry

⚠️ ملاحظات مهمة جداً:
- ركز على السياق والمعنى وليس فقط الكلمات
- إذا كانت الرسالة تحتوي على تحية + سؤال، النية الأساسية هي greeting
- إذا كان السؤال عن السعر (حتى مع ذكر منتج)، النية هي price_inquiry
- استخدم السياق من المحادثة السابقة لتحديد النية بدقة

أجب بكلمة واحدة فقط من الخيارات أعلاه (بدون شرح أو نص إضافي).
`;

      // ✅ STEP 5: Use AI to analyze intent
      const aiResponse = await generateAIResponse(intentPrompt, [], false, null, companyId);
      if (!aiResponse || typeof aiResponse !== 'string') {
        console.warn('⚠️ [INTENT-ANALYZER] AI response is invalid, using AI fallback');
        return fallbackIntentAnalysis ? await fallbackIntentAnalysis(message) : 'general_inquiry';
      }

      // ✅ تحسين استخراج الـ intent من الرد
      let detectedIntent = aiResponse.trim().toLowerCase();
      
      // تنظيف الرد (إزالة أي نص إضافي)
      detectedIntent = detectedIntent.replace(/^(النية|intent|النوع):\s*/i, '');
      detectedIntent = detectedIntent.split('\n')[0].trim();
      detectedIntent = detectedIntent.replace(/[^a-z_]/g, ''); // إزالة أي أحرف غير صالحة

      // Validate the response and fallback to AI-based analysis if needed
      const validIntents = ['product_inquiry', 'price_inquiry', 'shipping_inquiry', 'order_inquiry', 'greeting', 'general_inquiry'];

      if (validIntents.includes(detectedIntent)) {
        console.log('✅ [INTENT-ANALYZER] AI detected intent:', detectedIntent);
        return detectedIntent;
      } else {
        console.warn('⚠️ [INTENT-ANALYZER] AI returned invalid intent:', detectedIntent, '- using AI fallback');
        // ✅ Fallback to AI-based analysis (بدون keywords)
        if (fallbackIntentAnalysis) {
          const fallbackIntent = await fallbackIntentAnalysis(message);
          console.log('✅ [INTENT-ANALYZER] AI fallback detected intent:', fallbackIntent);
          return fallbackIntent;
        }
        return 'general_inquiry';
      }

    } catch (error) {
      console.error('❌ [INTENT-ANALYZER] Error in AI intent analysis:', error);
      // ✅ Fallback to AI-based analysis (بدون keywords)
      if (fallbackIntentAnalysis) {
        return await fallbackIntentAnalysis(message);
      }
      return 'general_inquiry';
    }
  }

  /**
   * تحليل الـ intent مع سياق محسن
   * @param {string} message - رسالة العميل
   * @param {Array} conversationMemory - سجل المحادثة
   * @param {string} companyId - معرف الشركة
   * @param {Function} generateAIResponse - دالة توليد رد AI
   * @returns {Promise<Object>} - {intent, confidence, context}
   */
  async analyzeIntentWithEnhancedContext(message, conversationMemory, companyId, generateAIResponse) {
    try {
      const intent = await this.analyzeIntent(message, conversationMemory, companyId, generateAIResponse);
      
      // تحليل إضافي للسياق
      const context = {
        hasProductMention: this.hasProductMention(message),
        hasPriceMention: this.hasPriceMention(message),
        hasOrderMention: this.hasOrderMention(message),
        conversationLength: conversationMemory.length
      };

      return {
        intent: intent,
        confidence: 0.8, // مثال
        context: context
      };

    } catch (error) {
      console.error('❌ [INTENT-ANALYZER] Error in enhanced intent analysis:', error);
      return {
        intent: 'general_inquiry',
        confidence: 0.5,
        context: {}
      };
    }
  }


  /**
   * فحص إذا كانت الرسالة تحتوي على ذكر طلب
   * @param {string} message - رسالة العميل
   * @returns {boolean}
   */
  hasOrderMention(message) {
    const orderKeywords = ['أوردر', 'اوردر', 'اطلب', 'أطلب', 'اشتري', 'أشتري', 'طلب'];
    const lowerMsg = message.toLowerCase();
    return orderKeywords.some(keyword => lowerMsg.includes(keyword));
  }

  /**
   * ✅ فحص أولي للتحيات (أولوية قصوى)
   * @param {string} message - رسالة العميل
   * @param {boolean} isFirstMessage - هل هذه أول رسالة في المحادثة
   * @returns {string|null} - greeting إذا كانت تحية، null وإلا
   */
  checkGreetingIntent(message, isFirstMessage) {
    if (!message || typeof message !== 'string') return null;
    
    const lowerMsg = message.toLowerCase().trim();
    const greetingPatterns = [
      'السلام عليكم',
      'السلام',
      'أهلاً',
      'أهلا',
      'مرحبا',
      'مرحباً',
      'ازيك',
      'ازي',
      'هلو',
      'هلا',
      'صباح الخير',
      'مساء الخير',
      'صباح النور',
      'مساء النور'
    ];

    // فحص إذا كانت الرسالة تبدأ بتحية
    for (const pattern of greetingPatterns) {
      if (lowerMsg.startsWith(pattern) || lowerMsg === pattern) {
        return 'greeting';
      }
    }

    // فحص إذا كانت أول رسالة وتحتوي على تحية
    if (isFirstMessage) {
      for (const pattern of greetingPatterns) {
        if (lowerMsg.includes(pattern)) {
          return 'greeting';
        }
      }
    }

    // فحص إذا كانت الرسالة تحتوي على تحية في البداية (حتى لو معه سؤال)
    const firstWords = lowerMsg.split(/\s+/).slice(0, 3).join(' ');
    for (const pattern of greetingPatterns) {
      if (firstWords.includes(pattern)) {
        return 'greeting';
      }
    }

    return null;
  }

  /**
   * ✅ فحص أولي للكلمات المفتاحية ذات الأولوية العالية
   * @param {string} message - رسالة العميل
   * @param {Array} conversationMemory - سجل المحادثة
   * @returns {string|null} - النية المكتشفة أو null
   */
  checkPriorityKeywords(message, conversationMemory) {
    if (!message || typeof message !== 'string') return null;
    
    const lowerMsg = message.toLowerCase().trim();
    
    // ✅ الأولوية 1: السعر (أولوية عالية جداً)
    const priceKeywords = [
      'كام', 'بكام', 'بكم', 'ب كام', 'ب كم',
      'سعر', 'سعره', 'سعرها', 'سعر ال', 'السعر',
      'ثمن', 'ثمنه', 'ثمنها', 'ثمن ال', 'الثمن',
      'تمن', 'تمنه', 'تمنها', 'تمن ال', 'التمن',
      'كام السعر', 'كام الثمن', 'كام التمن',
      'شحال', 'شحال ثمن', 'شحال السعر'
    ];
    
    for (const keyword of priceKeywords) {
      if (lowerMsg.includes(keyword)) {
        // حتى لو كان في السياق منتج، السؤال عن السعر له أولوية
        return 'price_inquiry';
      }
    }

    // ✅ الأولوية 2: الشحن
    const shippingKeywords = ['شحن', 'توصيل', 'شحنت', 'توصل', 'delivery', 'shipping'];
    for (const keyword of shippingKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'shipping_inquiry';
      }
    }

    // ✅ الأولوية 3: الطلب
    const orderKeywords = ['أوردر', 'اوردر', 'اطلب', 'أطلب', 'اشتري', 'أشتري', 'طلب', 'احجز'];
    for (const keyword of orderKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'order_inquiry';
      }
    }

    // ✅ الأولوية 4: المنتجات (فقط إذا لم يكن سؤال عن السعر)
    const productKeywords = ['صور', 'صورة', 'صوره', 'صورتها', 'ممكن أشوف', 'عايز أشوف', 'عاوز أشوف'];
    for (const keyword of productKeywords) {
      if (lowerMsg.includes(keyword)) {
        return 'product_inquiry';
      }
    }

    return null;
  }

  /**
   * ✅ تحسين hasPriceMention - إضافة كلمات مفتاحية أكثر
   * @param {string} message - رسالة العميل
   * @returns {boolean}
   */
  hasPriceMention(message) {
    if (!message || typeof message !== 'string') return false;
    const priceKeywords = [
      'سعر', 'سعره', 'سعرها', 'سعر ال', 'السعر',
      'بكام', 'بكم', 'ب كام', 'ب كم',
      'كام', 'كآم', 'كم',
      'ثمن', 'ثمنه', 'ثمنها', 'ثمن ال', 'الثمن',
      'تمن', 'تمنه', 'تمنها', 'تمن ال', 'التمن',
      'شحال', 'شحال ثمن', 'شحال السعر',
      'كم سعره', 'كام سعره', 'كم السعر', 'كام السعر'
    ];
    const lowerMsg = message.toLowerCase();
    return priceKeywords.some(keyword => lowerMsg.includes(keyword));
  }

  /**
   * ✅ تحسين hasProductMention - إضافة كلمات مفتاحية أكثر
   * @param {string} message - رسالة العميل
   * @returns {boolean}
   */
  hasProductMention(message) {
    if (!message || typeof message !== 'string') return false;
    const productKeywords = [
      'منتج', 'منتجات',
      'كوتشي', 'كوتشيات', 'كوتشاي', 'كوتشايات',
      'حذاء', 'أحذية', 'حذاية',
      'شوز', 'شوزات',
      'حقيبة', 'حقائب',
      'جزمة', 'جزم',
      'صندل', 'صنادل',
      'بوت', 'بوتات', 'boot', 'boots',
      'هاف', 'هافات',
      'سابوه', 'سابوهات'
    ];
    const lowerMsg = message.toLowerCase();
    return productKeywords.some(keyword => lowerMsg.includes(keyword));
  }
}

module.exports = new IntentAnalyzer();


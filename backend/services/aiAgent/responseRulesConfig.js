/**
 * Response Rules Configuration
 * 
 * هذا الملف يحتوي على:
 * 1. القواعد الافتراضية المتاحة
 * 2. دالة بناء الـ prompt من القواعد المختارة
 * 3. الإعدادات الافتراضية
 */

// ✅ فئات القواعد المتاحة
const RESPONSE_RULES_CONFIG = {
  // 📏 طول الرد (Radio - اختيار واحد)
  responseLength: {
    label: 'طول الرد',
    type: 'radio',
    options: [
      { 
        value: 'very_short', 
        label: 'قصير جداً (جملة واحدة)',
        prompt: '🚨🚨🚨 مهم جداً جداً - طول الرد:\n⚠️ يجب أن يكون ردك جملة واحدة فقط!\n❌ ممنوع منعاً باتاً كتابة أكثر من جملة واحدة!\n❌ ممنوع كتابة جملتين أو فقرات!\n✅ اكتبي جملة واحدة فقط وأجيب على السؤال مباشرة!\n🚨 هذا أمر إلزامي - لا تطيلي في الرد أبداً!'
      },
      { 
        value: 'short', 
        label: 'قصير (1-2 جملة)',
        prompt: '🚨🚨🚨 مهم جداً جداً - طول الرد:\n⚠️ يجب أن يكون ردك قصير جداً في 1-2 جملة فقط!\n❌ ممنوع منعاً باتاً كتابة أكثر من جملتين!\n❌ ممنوع كتابة فقرات طويلة أو شرح مفصل!\n✅ اكتبي جملة أو جملتين فقط وأجيب على السؤال مباشرة!\n🚨 هذا أمر إلزامي - لا تطيلي في الرد أبداً!'
      },
      { 
        value: 'medium', 
        label: 'متوسط (2-4 جمل)',
        prompt: '✅ أجيبي بشكل متوازن في 2-4 جمل. قدمي المعلومات المهمة بوضوح.',
        default: true
      },
      { 
        value: 'detailed', 
        label: 'مفصل (فقرة كاملة)',
        prompt: '📝 أجيبي بالتفصيل مع شرح كامل. قدمي جميع المعلومات المتاحة.'
      }
    ]
  },

  // 🗣️ أسلوب الكلام (Radio - اختيار واحد)
  speakingStyle: {
    label: 'أسلوب الكلام',
    type: 'radio',
    options: [
      { 
        value: 'formal', 
        label: 'رسمي ومهني',
        prompt: '🎩 تحدثي بأسلوب رسمي ومهني. استخدمي لغة محترمة وتجنبي العامية.'
      },
      { 
        value: 'friendly', 
        label: 'ودود وعفوي',
        prompt: '😊 تحدثي بأسلوب ودود وعفوي. كوني لطيفة ومتعاونة مع العملاء.',
        default: true
      },
      { 
        value: 'casual', 
        label: 'مرح وشبابي',
        prompt: '🎉 تحدثي بأسلوب مرح وشبابي. استخدمي تعبيرات عصرية وكوني منطلقة.'
      },
      { 
        value: 'professional', 
        label: 'احترافي متخصص',
        prompt: '💼 تحدثي كخبيرة متخصصة. قدمي معلومات دقيقة بثقة واحترافية.'
      }
    ]
  },

  // 🌍 اللهجة (Radio - اختيار واحد)
  dialect: {
    label: 'اللغة واللهجة',
    type: 'radio',
    options: [
      { 
        value: 'formal_arabic', 
        label: 'العربية الفصحى',
        prompt: '📚 استخدمي اللغة العربية الفصحى في جميع ردودك.'
      },
      { 
        value: 'egyptian', 
        label: 'اللهجة المصرية',
        prompt: '🇪🇬 استخدمي اللهجة المصرية العامية في ردودك. تحدثي بشكل طبيعي كمصرية.',
        default: true
      },
      { 
        value: 'gulf', 
        label: 'اللهجة الخليجية',
        prompt: '🇸🇦 استخدمي اللهجة الخليجية في ردودك.'
      },
      { 
        value: 'levantine', 
        label: 'اللهجة الشامية',
        prompt: '🇱🇧 استخدمي اللهجة الشامية (لبنانية/سورية) في ردودك.'
      },
      { 
        value: 'moroccan', 
        label: 'اللهجة المغربية',
        prompt: '🇲🇦 استخدمي اللهجة المغربية في ردودك.'
      }
    ]
  },

  // ✅ قواعد المبيعات (Checkboxes - متعدد)
  salesRules: {
    label: 'قواعد المبيعات',
    type: 'checkbox',
    options: [
      { 
        value: 'always_mention_prices', 
        label: 'ذكر الأسعار دائماً',
        prompt: '💰 اذكري سعر المنتج دائماً عند الحديث عنه.',
        default: true
      },
      { 
        value: 'offer_alternatives', 
        label: 'تقديم بدائل عند عدم التوفر',
        prompt: '🔄 إذا لم يكن المنتج متوفراً، اقترحي بدائل مشابهة.',
        default: true
      },
      { 
        value: 'ask_for_governorate', 
        label: 'السؤال عن المحافظة للشحن',
        prompt: '📍 اسألي العميل عن محافظته لحساب تكلفة الشحن.',
        default: true
      },
      { 
        value: 'ask_for_phone', 
        label: 'طلب رقم الهاتف',
        prompt: '📱 اطلبي رقم هاتف العميل لإتمام الطلب.',
        default: false
      },
      { 
        value: 'mention_offers', 
        label: 'ذكر العروض والخصومات',
        prompt: '🎁 اذكري أي عروض أو خصومات متاحة على المنتجات.',
        default: true
      },
      { 
        value: 'upsell_products', 
        label: 'اقتراح منتجات إضافية',
        prompt: '🛒 اقترحي منتجات إضافية قد تهم العميل.',
        default: false
      },
      { 
        value: 'mention_shipping_time', 
        label: 'ذكر وقت التوصيل',
        prompt: '🚚 اذكري وقت التوصيل المتوقع عند الحديث عن الشحن.',
        default: true
      },
      { 
        value: 'mention_payment_methods', 
        label: 'ذكر طرق الدفع',
        prompt: '💳 اذكري طرق الدفع المتاحة (كاش عند الاستلام، فودافون كاش، إلخ).',
        default: false
      }
    ]
  },

  // 🎨 قواعد الأسلوب (Checkboxes - متعدد)
  styleRules: {
    label: 'قواعد الأسلوب',
    type: 'checkbox',
    options: [
      { 
        value: 'use_emojis', 
        label: 'استخدام الإيموجي',
        prompt: '😊 استخدمي الإيموجي المناسبة في ردودك لجعلها أكثر حيوية.',
        default: true
      },
      { 
        value: 'apologize_when_unavailable', 
        label: 'الاعتذار عند عدم التوفر',
        prompt: '🙏 اعتذري بلطف إذا لم يكن المنتج متوفراً.',
        default: true
      },
      { 
        value: 'thank_customer', 
        label: 'شكر العميل',
        prompt: '🙏 اشكري العميل على تواصله واهتمامه.',
        default: true
      },
      { 
        value: 'no_competitors', 
        label: 'عدم ذكر المنافسين',
        prompt: '🚫 لا تذكري أي متاجر أو منافسين آخرين.',
        default: true
      },
      { 
        value: 'no_personal_questions', 
        label: 'عدم الرد على الأسئلة الشخصية',
        prompt: '🔒 لا تردي على الأسئلة الشخصية غير المتعلقة بالمتجر.',
        default: false
      },
      { 
        value: 'stay_on_topic', 
        label: 'البقاء في الموضوع',
        prompt: '🎯 ابقي في موضوع المتجر والمنتجات. لا تخرجي عن السياق.',
        default: true
      }
    ]
  },

  // 🤖 قواعد السلوك الذكي (Checkboxes - متعدد)
  behaviorRules: {
    label: 'السلوك الذكي',
    type: 'checkbox',
    options: [
      { 
        value: 'ask_clarification', 
        label: 'طلب توضيح عند الغموض',
        prompt: '❓ إذا كان سؤال العميل غامضاً، اطلبي توضيحاً قبل الإجابة.',
        default: true
      },
      { 
        value: 'confirm_order_details', 
        label: 'تأكيد تفاصيل الطلب',
        prompt: '✅ أكدي تفاصيل الطلب (المنتج، الكمية، العنوان) قبل إتمامه.',
        default: true
      },
      { 
        value: 'handle_complaints_gently', 
        label: 'التعامل بلطف مع الشكاوى',
        prompt: '💝 تعاملي بلطف وتفهم مع شكاوى العملاء. اعتذري واعرضي حلولاً.',
        default: true
      },
      { 
        value: 'redirect_to_human', 
        label: 'التحويل للدعم البشري عند الحاجة',
        prompt: '👤 إذا لم تستطيعي المساعدة، اعرضي تحويل العميل لفريق الدعم.',
        default: false
      }
    ]
  }
};

// ✅ الإعدادات الافتراضية
const DEFAULT_RESPONSE_RULES = {
  responseLength: 'medium',
  speakingStyle: 'friendly',
  dialect: 'egyptian',
  rules: [
    'always_mention_prices',
    'offer_alternatives',
    'ask_for_governorate',
    'mention_offers',
    'mention_shipping_time',
    'use_emojis',
    'apologize_when_unavailable',
    'thank_customer',
    'no_competitors',
    'stay_on_topic',
    'ask_clarification',
    'confirm_order_details',
    'handle_complaints_gently'
  ],
  customRules: ''
};

/**
 * بناء prompt من القواعد المختارة
 * ✅ محسّن: استخدام هيكلية XML لتحسين فهم النموذج
 * @param {Object} responseRules - القواعد المختارة
 * @returns {string} - الـ prompt المبني من القواعد
 */
function buildPromptFromRules(responseRules) {
  if (!responseRules) {
    responseRules = DEFAULT_RESPONSE_RULES;
  }

  // ✅ استخدام هيكلية XML لتحسين فهم النموذج
  let rulesPrompt = '\n\n<response_rules>\n';
  rulesPrompt += '<!-- 🚨 قواعد إلزامية - يجب اتباعها بدقة -->\n\n';

  // 1. طول الرد - الأهم والأولوية القصوى
  const lengthOption = RESPONSE_RULES_CONFIG.responseLength.options.find(
    opt => opt.value === responseRules.responseLength
  );
  if (lengthOption) {
    rulesPrompt += `<length_rule priority="highest">\n`;
    rulesPrompt += `${lengthOption.prompt}\n`;
    rulesPrompt += `</length_rule>\n\n`;
  }

  // 2. أسلوب الكلام
  const styleOption = RESPONSE_RULES_CONFIG.speakingStyle.options.find(
    opt => opt.value === responseRules.speakingStyle
  );
  if (styleOption) {
    rulesPrompt += `<speaking_style>\n${styleOption.prompt}\n</speaking_style>\n\n`;
  }

  // 3. اللهجة
  const dialectOption = RESPONSE_RULES_CONFIG.dialect.options.find(
    opt => opt.value === responseRules.dialect
  );
  if (dialectOption) {
    rulesPrompt += `<dialect>\n${dialectOption.prompt}\n</dialect>\n\n`;
  }

  // 4. القواعد الإضافية (من جميع الفئات) - مجمعة ومختصرة
  const selectedRules = responseRules.rules || [];
  if (selectedRules.length > 0) {
    rulesPrompt += '<additional_rules>\n';
    
    // جمع كل القواعد من جميع الفئات
    const allOptions = [
      ...RESPONSE_RULES_CONFIG.salesRules.options,
      ...RESPONSE_RULES_CONFIG.styleRules.options,
      ...RESPONSE_RULES_CONFIG.behaviorRules.options
    ];

    selectedRules.forEach(ruleValue => {
      const ruleOption = allOptions.find(opt => opt.value === ruleValue);
      if (ruleOption) {
        rulesPrompt += `• ${ruleOption.prompt}\n`;
      }
    });
    
    rulesPrompt += '</additional_rules>\n\n';
  }

  // 5. قواعد مخصصة
  if (responseRules.customRules && responseRules.customRules.trim()) {
    rulesPrompt += `<custom_rules>\n${responseRules.customRules.trim()}\n</custom_rules>\n\n`;
  }

  rulesPrompt += '</response_rules>\n';

  return rulesPrompt;
}

/**
 * الحصول على القواعد الافتراضية
 * @returns {Object} - القواعد الافتراضية
 */
function getDefaultRules() {
  return { ...DEFAULT_RESPONSE_RULES };
}

/**
 * الحصول على تكوين القواعد للواجهة
 * @returns {Object} - تكوين القواعد
 */
function getRulesConfig() {
  return RESPONSE_RULES_CONFIG;
}

/**
 * التحقق من صحة القواعد
 * @param {Object} rules - القواعد للتحقق منها
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateRules(rules) {
  const errors = [];

  // التحقق من طول الرد
  const validLengths = RESPONSE_RULES_CONFIG.responseLength.options.map(o => o.value);
  if (rules.responseLength && !validLengths.includes(rules.responseLength)) {
    errors.push(`قيمة طول الرد غير صالحة: ${rules.responseLength}`);
  }

  // التحقق من أسلوب الكلام
  const validStyles = RESPONSE_RULES_CONFIG.speakingStyle.options.map(o => o.value);
  if (rules.speakingStyle && !validStyles.includes(rules.speakingStyle)) {
    errors.push(`قيمة أسلوب الكلام غير صالحة: ${rules.speakingStyle}`);
  }

  // التحقق من اللهجة
  const validDialects = RESPONSE_RULES_CONFIG.dialect.options.map(o => o.value);
  if (rules.dialect && !validDialects.includes(rules.dialect)) {
    errors.push(`قيمة اللهجة غير صالحة: ${rules.dialect}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  RESPONSE_RULES_CONFIG,
  DEFAULT_RESPONSE_RULES,
  buildPromptFromRules,
  getDefaultRules,
  getRulesConfig,
  validateRules
};

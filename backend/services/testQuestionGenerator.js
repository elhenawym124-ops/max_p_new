/**
 * خدمة إنشاء أسئلة الاختبار للذكاء الاصطناعي
 * تنشئ أسئلة اختبار شاملة لجميع وظائف AI
 */

const { getSharedPrismaClient } = require('./sharedDatabase');

class TestQuestionGenerator {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء أسئلة اختبار شاملة لجميع وظائف AI
   * @param {string} companyId - معرف الشركة
   * @param {Array} products - قائمة المنتجات (اختياري)
   * @returns {Promise<Object>} - كائن يحتوي على جميع أسئلة الاختبار
   */
  async generateTestQuestions(companyId, products = null) {
    try {
      // جلب المنتجات إذا لم يتم توفيرها
      if (!products) {
        products = await this.getCompanyProducts(companyId);
      }

      // جلب الفئات
      const categories = await this.getCompanyCategories(companyId);

      // إنشاء أسئلة لكل نوع من أنواع الـ intents
      const testQuestions = {
        greeting: this.generateGreetingQuestions(),
        product_inquiry: this.generateProductInquiryQuestions(products, categories),
        price_inquiry: this.generatePriceInquiryQuestions(products),
        shipping_inquiry: this.generateShippingInquiryQuestions(),
        order_inquiry: this.generateOrderInquiryQuestions(products),
        general_inquiry: this.generateGeneralInquiryQuestions(),
        image_processing: this.generateImageProcessingQuestions(products),
        rag_retrieval: this.generateRAGRetrievalQuestions(products, categories),
        order_detection: this.generateOrderDetectionQuestions(products),
        sentiment_analysis: this.generateSentimentAnalysisQuestions(),
        context_management: this.generateContextManagementQuestions(products),
        edge_cases: this.generateEdgeCaseQuestions(products)
      };

      // إضافة ملخص
      const summary = {
        totalQuestions: Object.values(testQuestions).reduce((sum, questions) => sum + questions.length, 0),
        byIntent: Object.keys(testQuestions).reduce((acc, key) => {
          acc[key] = testQuestions[key].length;
          return acc;
        }, {}),
        byDifficulty: {
          easy: this.countQuestionsByDifficulty(testQuestions, 'easy'),
          medium: this.countQuestionsByDifficulty(testQuestions, 'medium'),
          hard: this.countQuestionsByDifficulty(testQuestions, 'hard')
        },
        generatedAt: new Date().toISOString(),
        companyId: companyId,
        productsCount: products.length,
        categoriesCount: categories.length
      };

      return {
        questions: testQuestions,
        summary: summary,
        metadata: {
          companyId: companyId,
          productsSample: products.slice(0, 5).map(p => ({ id: p.id, name: p.name })),
          categories: categories.map(c => ({ id: c.id, name: c.name }))
        }
      };

    } catch (error) {
      console.error('❌ Error generating test questions:', error);
      throw error;
    }
  }

  /**
   * جلب منتجات الشركة
   */
  async getCompanyProducts(companyId) {
    const products = await this.prisma.product.findMany({
      where: {
        companyId: companyId,
        isActive: true
      },
      include: {
        category: true,
        variants: {
          where: { isActive: true }
        }
      },
      take: 50 // حد أقصى 50 منتج للأسئلة
    });

    return products.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price),
      description: p.description,
      category: p.category?.name,
      hasImages: !!p.images,
      stock: p.stock,
      sku: p.sku
    }));
  }

  /**
   * جلب فئات الشركة
   */
  async getCompanyCategories(companyId) {
    const categories = await this.prisma.category.findMany({
      where: {
        companyId: companyId
      },
      take: 20
    });

    return categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description
    }));
  }

  /**
   * إنشاء أسئلة التحية
   */
  generateGreetingQuestions() {
    return [
      {
        question: 'السلام عليكم',
        intent: 'greeting',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يرد AI بتحية مناسبة',
        description: 'تحية أساسية'
      },
      {
        question: 'أهلاً وسهلاً',
        intent: 'greeting',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يرد AI بتحية ترحيبية',
        description: 'تحية ترحيبية'
      },
      {
        question: 'مرحبا',
        intent: 'greeting',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يرد AI بتحية بسيطة',
        description: 'تحية بسيطة'
      },
      {
        question: 'صباح الخير',
        intent: 'greeting',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يرد AI بتحية صباحية',
        description: 'تحية صباحية'
      },
      {
        question: 'مساء الخير',
        intent: 'greeting',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يرد AI بتحية مسائية',
        description: 'تحية مسائية'
      },
      {
        question: 'أهلاً، كيف الحال؟',
        intent: 'greeting',
        difficulty: 'medium',
        expectedBehavior: 'يجب أن يرد AI بتحية ويستفسر كيف يمكنه المساعدة',
        description: 'تحية مع سؤال'
      }
    ];
  }

  /**
   * إنشاء أسئلة استفسار المنتجات
   */
  generateProductInquiryQuestions(products, categories) {
    const questions = [
      {
        question: 'عايز أشوف المنتجات',
        intent: 'product_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI قائمة بالمنتجات المتاحة',
        description: 'طلب عرض جميع المنتجات'
      },
      {
        question: 'ممكن صور المنتجات؟',
        intent: 'product_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI منتجات مع صور',
        description: 'طلب صور المنتجات'
      },
      {
        question: 'عندكم إيه من المنتجات؟',
        intent: 'product_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI قائمة بالمنتجات',
        description: 'استفسار عام عن المنتجات'
      }
    ];

    // إضافة أسئلة مخصصة للمنتجات الفعلية
    if (products.length > 0) {
      const product = products[0];
      questions.push({
        question: `ممكن معلومات عن ${product.name}؟`,
        intent: 'product_inquiry',
        difficulty: 'medium',
        expectedBehavior: `يجب أن يعرض AI معلومات عن المنتج ${product.name}`,
        description: `استفسار عن منتج محدد: ${product.name}`,
        productId: product.id
      });

      questions.push({
        question: `عايز أشوف ${product.name}`,
        intent: 'product_inquiry',
        difficulty: 'medium',
        expectedBehavior: `يجب أن يعرض AI معلومات وصور المنتج ${product.name}`,
        description: `طلب عرض منتج محدد: ${product.name}`,
        productId: product.id
      });
    }

    // إضافة أسئلة عن الفئات
    if (categories.length > 0) {
      const category = categories[0];
      questions.push({
        question: `عندكم إيه في فئة ${category.name}؟`,
        intent: 'product_inquiry',
        difficulty: 'medium',
        expectedBehavior: `يجب أن يعرض AI المنتجات في فئة ${category.name}`,
        description: `استفسار عن فئة: ${category.name}`,
        categoryId: category.id
      });
    }

    return questions;
  }

  /**
   * إنشاء أسئلة استفسار الأسعار
   */
  generatePriceInquiryQuestions(products) {
    const questions = [
      {
        question: 'بكام المنتجات؟',
        intent: 'price_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI أسعار المنتجات',
        description: 'استفسار عام عن الأسعار'
      },
      {
        question: 'كم السعر؟',
        intent: 'price_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يطلب AI توضيح المنتج المطلوب',
        description: 'استفسار غير محدد عن السعر'
      },
      {
        question: 'عايز أعرف الأسعار',
        intent: 'price_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI أسعار المنتجات',
        description: 'طلب عرض الأسعار'
      }
    ];

    // إضافة أسئلة مخصصة للمنتجات الفعلية
    if (products.length > 0) {
      const product = products[0];
      questions.push({
        question: `بكام ${product.name}؟`,
        intent: 'price_inquiry',
        difficulty: 'medium',
        expectedBehavior: `يجب أن يعرض AI سعر المنتج ${product.name}`,
        description: `استفسار عن سعر منتج محدد: ${product.name}`,
        productId: product.id,
        expectedPrice: product.price
      });
    }

    return questions;
  }

  /**
   * إنشاء أسئلة استفسار الشحن
   */
  generateShippingInquiryQuestions() {
    return [
      {
        question: 'ممكن تفاصيل الشحن؟',
        intent: 'shipping_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI معلومات عن الشحن والتوصيل',
        description: 'استفسار عن تفاصيل الشحن'
      },
      {
        question: 'كم وقت التوصيل؟',
        intent: 'shipping_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI معلومات عن وقت التوصيل',
        description: 'استفسار عن وقت التوصيل'
      },
      {
        question: 'الشحن بكام؟',
        intent: 'shipping_inquiry',
        difficulty: 'medium',
        expectedBehavior: 'يجب أن يعرض AI تكلفة الشحن',
        description: 'استفسار عن تكلفة الشحن'
      },
      {
        question: 'بيوصل فين؟',
        intent: 'shipping_inquiry',
        difficulty: 'medium',
        expectedBehavior: 'يجب أن يعرض AI مناطق التوصيل المتاحة',
        description: 'استفسار عن مناطق التوصيل'
      },
      {
        question: 'عايز أعرف طرق الشحن المتاحة',
        intent: 'shipping_inquiry',
        difficulty: 'medium',
        expectedBehavior: 'يجب أن يعرض AI طرق الشحن المتاحة',
        description: 'استفسار عن طرق الشحن'
      }
    ];
  }

  /**
   * إنشاء أسئلة استفسار الطلبات
   */
  generateOrderInquiryQuestions(products) {
    const questions = [
      {
        question: 'عايز أطلب منتج',
        intent: 'order_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يسأل AI عن المنتج المطلوب',
        description: 'طلب عام لشراء منتج'
      },
      {
        question: 'كيف أطلب؟',
        intent: 'order_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يشرح AI كيفية الطلب',
        description: 'استفسار عن طريقة الطلب'
      },
      {
        question: 'عايز أشتري',
        intent: 'order_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يسأل AI عن المنتج المطلوب',
        description: 'تعبير عن رغبة الشراء'
      }
    ];

    // إضافة أسئلة مخصصة للمنتجات الفعلية
    if (products.length > 0) {
      const product = products[0];
      questions.push({
        question: `عايز أطلب ${product.name}`,
        intent: 'order_inquiry',
        difficulty: 'medium',
        expectedBehavior: `يجب أن يبدأ AI عملية الطلب للمنتج ${product.name}`,
        description: `طلب منتج محدد: ${product.name}`,
        productId: product.id
      });
    }

    return questions;
  }

  /**
   * إنشاء أسئلة استفسار عامة
   */
  generateGeneralInquiryQuestions() {
    return [
      {
        question: 'ممكن معلومات عن الشركة؟',
        intent: 'general_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI معلومات عن الشركة',
        description: 'استفسار عن معلومات الشركة'
      },
      {
        question: 'عندكم إيه جديد؟',
        intent: 'general_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI المنتجات الجديدة أو المميزة',
        description: 'استفسار عن العروض الجديدة'
      },
      {
        question: 'إزاي أتواصل معاكم؟',
        intent: 'general_inquiry',
        difficulty: 'easy',
        expectedBehavior: 'يجب أن يعرض AI معلومات الاتصال',
        description: 'استفسار عن معلومات الاتصال'
      }
    ];
  }

  /**
   * إنشاء أسئلة معالجة الصور
   */
  generateImageProcessingQuestions(products) {
    const questions = [];

    if (products.length > 0) {
      const productWithImage = products.find(p => p.hasImages) || products[0];
      questions.push({
        question: `ممكن صور ${productWithImage.name}؟`,
        intent: 'product_inquiry',
        difficulty: 'medium',
        expectedBehavior: `يجب أن يعرض AI صور المنتج ${productWithImage.name}`,
        description: `طلب صور منتج محدد: ${productWithImage.name}`,
        productId: productWithImage.id,
        requiresImageProcessing: true
      });
    }

    questions.push({
      question: 'ممكن أشوف صور المنتجات؟',
      intent: 'product_inquiry',
      difficulty: 'medium',
      expectedBehavior: 'يجب أن يعرض AI منتجات مع صور',
      description: 'طلب عام لصور المنتجات',
      requiresImageProcessing: true
    });

    return questions;
  }

  /**
   * إنشاء أسئلة استرجاع RAG
   */
  generateRAGRetrievalQuestions(products, categories) {
    const questions = [];

    if (products.length > 0) {
      const product = products[0];
      questions.push({
        question: `ممكن تفاصيل كاملة عن ${product.name}؟`,
        intent: 'product_inquiry',
        difficulty: 'hard',
        expectedBehavior: `يجب أن يسترجع AI معلومات كاملة عن ${product.name} من RAG`,
        description: `استفسار تفصيلي عن منتج: ${product.name}`,
        productId: product.id,
        requiresRAG: true
      });
    }

    if (categories.length > 0) {
      const category = categories[0];
      questions.push({
        question: `إيه المنتجات اللي في ${category.name}؟`,
        intent: 'product_inquiry',
        difficulty: 'medium',
        expectedBehavior: `يجب أن يسترجع AI المنتجات في فئة ${category.name} من RAG`,
        description: `استفسار عن فئة معينة: ${category.name}`,
        categoryId: category.id,
        requiresRAG: true
      });
    }

    return questions;
  }

  /**
   * إنشاء أسئلة اكتشاف الطلبات
   */
  generateOrderDetectionQuestions(products) {
    const questions = [];

    if (products.length > 0) {
      const product = products[0];
      questions.push({
        question: `عايز ${product.name} واحد`,
        intent: 'order_inquiry',
        difficulty: 'hard',
        expectedBehavior: `يجب أن يكتشف AI رغبة العميل في طلب ${product.name}`,
        description: `اكتشاف طلب منتج: ${product.name}`,
        productId: product.id,
        requiresOrderDetection: true
      });

      questions.push({
        question: `أريد شراء ${product.name}`,
        intent: 'order_inquiry',
        difficulty: 'hard',
        expectedBehavior: `يجب أن يبدأ AI عملية الطلب للمنتج ${product.name}`,
        description: `تعبير صريح عن الشراء: ${product.name}`,
        productId: product.id,
        requiresOrderDetection: true
      });
    }

    return questions;
  }

  /**
   * إنشاء أسئلة تحليل المشاعر
   */
  generateSentimentAnalysisQuestions() {
    return [
      {
        question: 'المنتج جميل جداً، شكراً ليكم',
        intent: 'general_inquiry',
        difficulty: 'medium',
        expectedBehavior: 'يجب أن يكتشف AI المشاعر الإيجابية ويرد بشكل مناسب',
        description: 'مشاعر إيجابية',
        requiresSentimentAnalysis: true,
        expectedSentiment: 'positive'
      },
      {
        question: 'مش عاجبني المنتج خالص',
        intent: 'general_inquiry',
        difficulty: 'medium',
        expectedBehavior: 'يجب أن يكتشف AI المشاعر السلبية ويحاول حل المشكلة',
        description: 'مشاعر سلبية',
        requiresSentimentAnalysis: true,
        expectedSentiment: 'negative'
      },
      {
        question: 'الخدمة كانت متوسطة',
        intent: 'general_inquiry',
        difficulty: 'hard',
        expectedBehavior: 'يجب أن يكتشف AI المشاعر المحايدة ويستفسر أكثر',
        description: 'مشاعر محايدة',
        requiresSentimentAnalysis: true,
        expectedSentiment: 'neutral'
      }
    ];
  }

  /**
   * إنشاء أسئلة إدارة السياق
   */
  generateContextManagementQuestions(products) {
    const questions = [];

    if (products.length >= 2) {
      const product1 = products[0];
      const product2 = products[1];

      questions.push({
        question: `عايز ${product1.name} وبعدين ${product2.name}`,
        intent: 'order_inquiry',
        difficulty: 'hard',
        expectedBehavior: 'يجب أن يحفظ AI السياق ويتذكر كلا المنتجين',
        description: 'طلب متعدد المنتجات',
        requiresContextManagement: true,
        productIds: [product1.id, product2.id]
      });

      questions.push({
        question: `بكام ${product1.name}؟\nبكام ${product2.name}؟`,
        intent: 'price_inquiry',
        difficulty: 'hard',
        expectedBehavior: 'يجب أن يجيب AI على كلا السؤالين مع الحفاظ على السياق',
        description: 'أسئلة متعددة في نفس المحادثة',
        requiresContextManagement: true,
        productIds: [product1.id, product2.id]
      });
    }

    return questions;
  }

  /**
   * إنشاء أسئلة الحالات الحدية
   */
  generateEdgeCaseQuestions(products) {
    return [
      {
        question: '',
        intent: 'general_inquiry',
        difficulty: 'hard',
        expectedBehavior: 'يجب أن يتعامل AI مع الرسالة الفارغة بشكل مناسب',
        description: 'رسالة فارغة',
        isEdgeCase: true
      },
      {
        question: '؟؟؟',
        intent: 'general_inquiry',
        difficulty: 'medium',
        expectedBehavior: 'يجب أن يسأل AI عن التوضيح',
        description: 'رسالة غير واضحة',
        isEdgeCase: true
      },
      {
        question: 'asdfghjkl',
        intent: 'general_inquiry',
        difficulty: 'hard',
        expectedBehavior: 'يجب أن يتعامل AI مع النص غير المفهوم بشكل مناسب',
        description: 'نص غير مفهوم',
        isEdgeCase: true
      },
      {
        question: 'منتج غير موجود 123456',
        intent: 'product_inquiry',
        difficulty: 'medium',
        expectedBehavior: 'يجب أن يوضح AI أن المنتج غير موجود',
        description: 'استفسار عن منتج غير موجود',
        isEdgeCase: true
      }
    ];
  }

  /**
   * عد الأسئلة حسب الصعوبة
   */
  countQuestionsByDifficulty(questionsObject, difficulty) {
    let count = 0;
    Object.values(questionsObject).forEach(questions => {
      count += questions.filter(q => q.difficulty === difficulty).length;
    });
    return count;
  }
}

module.exports = new TestQuestionGenerator();


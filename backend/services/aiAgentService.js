const { getSharedPrismaClient } = require('./sharedDatabase');
const ContinuousLearningServiceV2 = require('./continuousLearningServiceV2');
const QualityMonitorService = require('./qualityMonitorService');
const PatternApplicationService = require('./patternApplicationService');
const PromptEnhancementService = require('./promptEnhancementService');
const ResponseOptimizer = require('./responseOptimizer');
const AIErrorHandler = require('./aiErrorHandler'); // نظام معالجة أخطاء الذكاء الاصطناعي

// Import AI Agent Modules
const intentAnalyzer = require('./aiAgent/intentAnalyzer');
// Note: modelManager is now loaded lazily via getModelManager()
// Note: imageExtractor has been merged into imageProcessor

// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues // Use shared database connection

class AIAgentService {
  constructor() {
    // this.prisma = prisma; // ❌ Removed
    this.ragService = null;
    this.isInitialized = false;
    this.learningService = new ContinuousLearningServiceV2();
    this.qualityMonitor = new QualityMonitorService(); // نظام التقييم الذكي
    this.patternApplication = new PatternApplicationService(); // خدمة تطبيق الأنماط
    this.promptEnhancement = new PromptEnhancementService(); // خدمة تحسين الـ prompts
    this.responseOptimizer = new ResponseOptimizer(); // محسن الردود
    this.errorHandler = new AIErrorHandler(); // نظام معالجة أخطاء الذكاء الاصطناعي

    // ✅ Message Processor - Lazy initialization
    this._messageProcessor = null;
    // ✅ Context Manager - Lazy initialization
    this._contextManager = null;
    // ✅ Response Generator - Lazy initialization
    this._responseGenerator = null;
    // ✅ Order Processor - Lazy initialization
    this._orderProcessor = null;
    // ✅ Image Processor - Lazy initialization
    this._imageProcessor = null;
    // ✅ Settings Manager - Lazy initialization
    this._settingsManager = null;
    // ✅ Model Manager - Lazy initialization
    this._modelManager = null;
    // ✅ Learning Monitor - Lazy initialization
    this._learningMonitor = null;
  }

  get prisma() {
    return getSharedPrismaClient();
  }

  /**
   * Get message processor instance (lazy initialization)
   */
  getMessageProcessor() {
    if (!this._messageProcessor) {
      const MessageProcessor = require('./aiAgent/messageProcessor');
      this._messageProcessor = new MessageProcessor(this);
    }
    return this._messageProcessor;
  }

  /**
   * Get context manager instance (lazy initialization)
   */
  getContextManager() {
    if (!this._contextManager) {
      const ContextManager = require('./aiAgent/contextManager');
      this._contextManager = new ContextManager(this);
    }
    return this._contextManager;
  }

  /**
   * Get response generator instance (lazy initialization)
   */
  getResponseGenerator() {
    if (!this._responseGenerator) {
      const ResponseGenerator = require('./aiAgent/responseGenerator');
      this._responseGenerator = new ResponseGenerator(this);
    }
    return this._responseGenerator;
  }

  /**
   * Get order processor instance (lazy initialization)
   */
  getOrderProcessor() {
    if (!this._orderProcessor) {
      const OrderProcessor = require('./aiAgent/orderProcessor');
      this._orderProcessor = new OrderProcessor(this);
    }
    return this._orderProcessor;
  }

  /**
   * Get image processor instance (lazy initialization)
   */
  getImageProcessor() {
    if (!this._imageProcessor) {
      const ImageProcessor = require('./aiAgent/imageProcessor');
      this._imageProcessor = new ImageProcessor(this);
    }
    return this._imageProcessor;
  }

  /**
   * Get settings manager instance (lazy initialization)
   */
  getSettingsManager() {
    if (!this._settingsManager) {
      const SettingsManager = require('./aiAgent/settingsManager');
      this._settingsManager = new SettingsManager(this);
    }
    return this._settingsManager;
  }

  /**
   * Get model manager instance (lazy initialization)
   */
  getModelManager() {
    if (!this._modelManager) {
      const ModelManager = require('./aiAgent/modelManager');
      this._modelManager = new ModelManager(this);
    }
    return this._modelManager;
  }

  /**
   * Get learning monitor instance (lazy initialization)
   */
  getLearningMonitor() {
    if (!this._learningMonitor) {
      const LearningMonitor = require('./aiAgent/learningMonitor');
      this._learningMonitor = new LearningMonitor(this);
    }
    return this._learningMonitor;
  }

  /**
   * Get current active model
   * ✅ Delegation to modelManager for better code organization
   */
  async getCurrentActiveModel(companyId) {
    return this.getModelManager().getCurrentActiveModel(companyId);
  }

  /**
   * Update current active model (used when switching)
   * ✅ Delegation to modelManager for better code organization
   */
  updateCurrentActiveModel(newModel) {
    return this.getModelManager().updateCurrentActiveModel(newModel);
  }

  /**
   * Get current time of day for pattern context
   * ✅ Delegation to contextManager for better code organization
   */
  getTimeOfDay() {
    return this.getContextManager().getTimeOfDay();
  }

  /**
   * Process customer message and generate AI response
   * 
   * ✅ Delegation to messageProcessor for better code organization
   */
  async processCustomerMessage(messageData) {
    // ✅ Use messageProcessor for processing
    const messageProcessor = this.getMessageProcessor();
    return messageProcessor.processCustomerMessage(messageData);
  }

  /**
   * معالجة الصور مع الـ AI بدون استخدام الذاكرة لضمان الاستقلالية
   * ✅ Delegation to messageProcessor for better code organization
   */
  async processImageWithAI(imageAnalysis, messageData, intent = 'general_inquiry', productMatch) {
    return this.getMessageProcessor().processImageWithAI(imageAnalysis, messageData, intent, productMatch);
  }

  /**
   * دالة معالجة منفصلة مع الـ AI Agent للصور
   * ✅ Delegation to messageProcessor for better code organization
   */
  async processWithAI(content, messageData, intent = 'general_inquiry') {
    return this.getMessageProcessor().processWithAI(content, messageData, intent);
  }

  /**
   * حفظ الرد النهائي للصورة في الذاكرة
   * ✅ Delegation to messageProcessor for better code organization
   */
  async saveImageResponseToMemory(messageData, finalResponse, productMatch) {
    return this.getMessageProcessor().saveImageResponseToMemory(messageData, finalResponse, productMatch);
  }

  /**
   * بناء prompt خاص بالصور بدون استخدام الذاكرة
   * ✅ Delegation to messageProcessor for better code organization
   */
  buildImageResponsePrompt(imageAnalysis, companyPrompts, productMatch, customerData) {
    return this.getMessageProcessor().buildImageResponsePrompt(imageAnalysis, companyPrompts, productMatch, customerData);
  }

  /**
   * بناء الـ prompt للذكاء الاصطناعي
   * ✅ Delegation to responseGenerator for better code organization
   */
  buildPrompt(customerMessage, companyPrompts, conversationMemory, ragData, customerData, messageData) {
    return this.getResponseGenerator().buildPrompt(customerMessage, companyPrompts, conversationMemory, ragData, customerData, messageData);
  }

  /**
   * Get company prompts and settings
   * ✅ Delegation to settingsManager for better code organization
   */
  async getCompanyPrompts(companyId, customPrompt = null) {
    return this.getSettingsManager().getCompanyPrompts(companyId, customPrompt);
  }

  /**
   * Reload system prompt (called when prompt is activated)
   * ✅ Delegation to settingsManager for better code organization
   */
  async reloadSystemPrompt() {
    return this.getSettingsManager().reloadSystemPrompt();
  }

  /**
   * Build advanced prompt with RAG data, company settings, and conversation memory
   * ✅ Delegation to responseGenerator for better code organization
   */
  async buildAdvancedPrompt(customerMessage, customerData, companyPrompts, ragData, conversationMemory, hasImages = false, smartResponseInfo, messageData) {
    return this.getResponseGenerator().buildAdvancedPrompt(customerMessage, customerData, companyPrompts, ragData, conversationMemory, hasImages, smartResponseInfo, messageData);
  }

  /**
   * ✨ بناء إعدادات التوليد الديناميكية بناءً على السياق
   * ✅ Delegation to responseGenerator for better code organization
   */
  async buildGenerationConfig(companyId, messageContext = {}) {
    return this.getResponseGenerator().buildGenerationConfig(companyId, messageContext);
  }

  /**
   * Generate AI response using Gemini API with Pattern Enhancement
   * ✅ Delegation to responseGenerator for better code organization
   */
  async generateAIResponse(prompt, conversationMemory, useRAG, providedGeminiConfig, companyId, conversationId, messageContext) {
    return this.getResponseGenerator().generateAIResponse(prompt, conversationMemory, useRAG, providedGeminiConfig, companyId, conversationId, messageContext);
  }

  /**
   * Analyze enhanced conversation context with flow tracking
   * ✅ Delegation to contextManager for better code organization
   */
  async analyzeEnhancedConversationContext(message, conversationMemory, companyId) {
    return this.getContextManager().analyzeEnhancedConversationContext(message, conversationMemory, companyId);
  }

  /**
   * Build enhanced conversation context with flow analysis
   * ✅ Delegation to contextManager for better code organization
   */
  buildEnhancedConversationContext(conversationMemory) {
    return this.getContextManager().buildEnhancedConversationContext(conversationMemory);
  }

  /**
   * Analyze current conversation state and flow
   * ✅ Delegation to contextManager for better code organization
   */
  analyzeConversationState(conversationMemory) {
    return this.getContextManager().analyzeConversationState(conversationMemory);
  }

  /**
   * Enhanced intent analysis with contextual understanding
   * ✅ Delegation to contextManager for better code organization
   */
  async analyzeIntentWithEnhancedContext(message, conversationContext, conversationState, companyId) {
    return this.getContextManager().analyzeIntentWithEnhancedContext(message, conversationContext, conversationState, companyId);
  }

  /**
   * Analyze customer intent using AI-powered understanding (Original function - kept for compatibility)
   * ✅ UPDATED: الآن يعتمد على AI بالكامل بدون keywords
   */
  async analyzeIntent(message, conversationMemory, companyId) {
    try {
      // استخدام intentAnalyzer module
      return await intentAnalyzer.analyzeIntent(
        message,
        conversationMemory,
        companyId,
        this.generateAIResponse.bind(this),
        async (msg) => {
          // ✅ استخدام AI-based fallback بدلاً من keywords
          const result = await this.getContextManager().fallbackIntentAnalysis(msg, companyId);
          return result;
        }
      );
    } catch (error) {
      console.error(`❌ Error in intent analysis: ${error.message}, falling back to AI analysis`);
      // ✅ استخدام AI fallback بدلاً من keywords
      return await this.getContextManager().fallbackIntentAnalysis(message, companyId);
    }
  }

  /**
   * Fallback intent analysis - AI-Based
   * ✅ UPDATED: الآن يعتمد على AI بالكامل بدون keywords
   * ✅ Delegation to contextManager for better code organization
   */
  async fallbackIntentAnalysis(message, companyId = null) {
    return await this.getContextManager().fallbackIntentAnalysis(message, companyId);
  }

  /**
   * Get time ago string in Arabic
   * ✅ Delegation to contextManager for better code organization
   */
  getTimeAgo(date) {
    return this.getContextManager().getTimeAgo(date);
  }

  /**
   * Extract conversation topics from memory
   * ✅ Delegation to contextManager for better code organization
   */
  extractConversationTopics(conversationMemory) {
    return this.getContextManager().extractConversationTopics(conversationMemory);
  }

  /**
   * Analyze customer behavior patterns
   * ✅ Delegation to contextManager for better code organization
   */
  analyzeCustomerBehavior(conversationMemory) {
    return this.getContextManager().analyzeCustomerBehavior(conversationMemory);
  }

  /**
   * Calculate message frequency (messages per hour)
   * ✅ Delegation to contextManager for better code organization
   */
  calculateMessageFrequency(conversationMemory) {
    return this.getContextManager().calculateMessageFrequency(conversationMemory);
  }

  /**
   * Analyze topic consistency across conversation
   * ✅ Delegation to contextManager for better code organization
   */
  analyzeTopicConsistency(conversationMemory) {
    return this.getContextManager().analyzeTopicConsistency(conversationMemory);
  }

  /**
   * Analyze sentiment trend across conversation
   * ✅ Delegation to contextManager for better code organization
   */
  analyzeSentimentTrend(conversationMemory) {
    return this.getContextManager().analyzeSentimentTrend(conversationMemory);
  }

  /**
   * Extract intent from unstructured AI response
   * ✅ Delegation to contextManager for better code organization
   */
  extractIntentFromResponse(response) {
    return this.getContextManager().extractIntentFromResponse(response);
  }

  /**
   * Enhanced conversation state management for response generation
   * ✅ Delegation to contextManager for better code organization
   */
  enhanceResponseWithConversationState(baseResponse, conversationState, enhancedContext) {
    return this.getContextManager().enhanceResponseWithConversationState(baseResponse, conversationState, enhancedContext);
  }

  /**
   * Conversation context memory optimization
   * ✅ Delegation to contextManager for better code organization
   */
  optimizeConversationMemoryForContext(conversationMemory, currentIntent, maxContextSize = 5) {
    return this.getContextManager().optimizeConversationMemoryForContext(conversationMemory, currentIntent, maxContextSize);
  }

  /**
   * Quick intent check using pattern matching (optimization)
   * ✅ Delegation to contextManager for better code organization
   */
  quickIntentCheck(message) {
    return this.getContextManager().quickIntentCheck(message);
  }

  /**
   * Analyze customer sentiment
   * ✅ Delegation to contextManager for better code organization
   */
  analyzeSentiment(message) {
    return this.getContextManager().analyzeSentiment(message);
  }

  /**
   * Calculate similarity between two strings (0 = completely different, 1 = identical)
   * Uses Levenshtein distance algorithm
   * ✅ Delegation to contextManager for better code organization
   */
  calculateStringSimilarity(str1, str2) {
    return this.getContextManager().calculateStringSimilarity(str1, str2);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * ✅ Delegation to contextManager for better code organization
   */
  levenshteinDistance(str1, str2) {
    return this.getContextManager().levenshteinDistance(str1, str2);
  }

  /**
   * Detect if customer is confirming an order using AI only (Pure AI Version)
   * ✅ Delegation to orderProcessor for better code organization
   */
  async detectOrderConfirmation(message, conversationMemory, customerId, companyId) {
    try {
      // استخدام orderProcessor module
      const result = await this.getOrderProcessor().detectOrderConfirmation(
        message,
        conversationMemory,
        customerId,
        companyId
      );

      // إذا كان هناك تأكيد، استخراج تفاصيل الطلب
      if (result.isConfirming) {
        const orderDetails = await this.getOrderProcessor().extractOrderDetailsFromMemory(
          conversationMemory,
          companyId,
          message
        );

        return {
          isConfirming: true,
          orderDetails: orderDetails,
          detectionMethod: 'pure_ai'
        };
      }

      return result;
    } catch (error) {
      console.error('❌ AI confirmation detection failed:', error);
      return { isConfirming: false, orderDetails: null };
    }
  }

  /**
   * فحص وجود طلب حديث للعميل (خلال آخر 5 دقائق)
   * ✅ Delegation to orderProcessor for better code organization
   */
  async checkRecentOrderForCustomer(customerId) {
    return this.getOrderProcessor().checkRecentOrderForCustomer(customerId);
  }

  /**
   * فحص اكتمال البيانات المطلوبة لإنشاء الطلب
   * ✅ Delegation to orderProcessor for better code organization
   */
  async checkDataCompleteness(orderDetails, conversationMemory, messageContent) {
    return this.getOrderProcessor().checkDataCompleteness(orderDetails, conversationMemory, messageContent);
  }

  /**
   * إنشاء رد لطلب البيانات المفقودة باستخدام الذكاء الاصطناعي
   * ✅ Delegation to orderProcessor for better code organization
   */
  async generateDataRequestResponse(missingData, orderDetails, companyId) {
    return this.getOrderProcessor().generateDataRequestResponse(missingData, orderDetails, companyId);
  }

  /**
   * فحص إذا كان العميل يرسل بيانات لطلب معلق
   * ✅ Delegation to orderProcessor for better code organization
   */
  async checkForPendingOrderData(message, conversationMemory, companyId) {
    return this.getOrderProcessor().checkForPendingOrderData(message, conversationMemory, companyId);
  }

  /**
   * استخراج بيانات العميل من الرسالة
   * ✅ Delegation to orderProcessor for better code organization
   */
  async extractCustomerDataFromMessage(message) {
    return this.getOrderProcessor().extractCustomerDataFromMessage(message);
  }

  /**
   * محاولة إنشاء الطلب بالبيانات الجديدة
   * ✅ Delegation to orderProcessor for better code organization
   */
  async attemptOrderCreationWithNewData(pendingOrderData, messageData, conversationId) {
    return this.getOrderProcessor().attemptOrderCreationWithNewData(pendingOrderData, messageData, conversationId);
  }

  /**
   * Use AI to detect if customer is confirming an order
   * ✅ Delegation to orderProcessor for better code organization
   */
  async detectConfirmationWithAI(message, conversationMemory, companyId) {
    return this.getOrderProcessor().detectConfirmationWithAI(message, conversationMemory, companyId);
  }

  /**
   * Extract order details from conversation memory using AI
   * ✅ Delegation to orderProcessor for better code organization
   */
  async extractOrderDetailsFromMemory(conversationMemory, companyId, currentMessage) {
    return this.getOrderProcessor().extractOrderDetailsFromMemory(conversationMemory, companyId, currentMessage);
  }

  /**
   * Build conversation context for AI analysis
   * ✅ Delegation to orderProcessor for better code organization
   */
  buildConversationContext(conversationMemory) {
    return this.getOrderProcessor().buildConversationContext(conversationMemory);
  }

  /**
   * Extract details using AI
   * ✅ Delegation to orderProcessor for better code organization
   */
  async extractDetailsWithAI(conversationText, companyId) {
    return this.getOrderProcessor().extractDetailsWithAI(conversationText, companyId);
  }

  /**
   * Clean and validate extracted order details
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanAndValidateOrderDetails(extractedDetails) {
    return this.getOrderProcessor().cleanAndValidateOrderDetails(extractedDetails);
  }

  /**
   * Clean product name
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanProductName(name) {
    return this.getOrderProcessor().cleanProductName(name);
  }

  /**
   * Clean product color
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanProductColor(color) {
    return this.getOrderProcessor().cleanProductColor(color);
  }

  /**
   * Clean product size
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanProductSize(size) {
    return this.getOrderProcessor().cleanProductSize(size);
  }

  /**
   * Clean product price
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanProductPrice(price) {
    return this.getOrderProcessor().cleanProductPrice(price);
  }

  /**
   * Transliterate English name to Arabic
   * ✅ Delegation to orderProcessor for better code organization
   */
  transliterateToArabic(name) {
    return this.getOrderProcessor().transliterateToArabic(name);
  }

  /**
   * Clean customer name
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanCustomerName(name) {
    return this.getOrderProcessor().cleanCustomerName(name);
  }

  /**
   * Clean phone number
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanPhoneNumber(phone) {
    return this.getOrderProcessor().cleanPhoneNumber(phone);
  }

  /**
   * Clean address
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanAddress(address) {
    return this.getOrderProcessor().cleanAddress(address);
  }

  /**
   * Clean city name
   * ✅ Delegation to orderProcessor for better code organization
   */
  cleanCity(city) {
    return this.getOrderProcessor().cleanCity(city);
  }

  /**
   * Advanced validation for extracted order details
   * ✅ Delegation to orderProcessor for better code organization
   */
  validateOrderDetails(details) {
    return this.getOrderProcessor().validateOrderDetails(details);
  }

  /**
   * Get default order details
   * ✅ Delegation to orderProcessor for better code organization
   */
  getDefaultOrderDetails() {
    return this.getOrderProcessor().getDefaultOrderDetails();
  }

  /**
   * 🧠 استخدام الذكاء الاصطناعي المتقدم لتحديد طلب الصور
   * ✅ Delegation to imageProcessor for better code organization
   */
  async isCustomerRequestingImages(message, conversationMemory, companyId) {
    return this.getImageProcessor().isCustomerRequestingImages(message, conversationMemory, companyId);
  }

  /**
   * Use AI to find products from conversation context
   * ✅ Delegation to imageProcessor for better code organization
   */
  async findProductsFromContext(message, conversationMemory) {
    return this.getImageProcessor().findProductsFromContext(message, conversationMemory);
  }

  /**
   * Extract product ID from RAG data
   * ✅ Delegation to imageProcessor for better code organization
   */
  async extractProductIdFromRAG(ragItem) {
    return this.getImageProcessor().extractProductIdFromRAG(ragItem);
  }

  /**
   * Get product images from database
   * ✅ Delegation to imageProcessor for better code organization
   */
  async getProductImagesFromDB(productId) {
    return this.getImageProcessor().getProductImagesFromDB(productId);
  }

  /**
   * Get customized product images based on product data
   * ✅ Delegation to imageProcessor for better code organization
   */
  getCustomizedProductImages(product) {
    return this.getImageProcessor().getCustomizedProductImages(product);
  }

  /**
   * ❌ معطل - لا نرسل صور افتراضية بعد الآن
   * ✅ Delegation to imageProcessor for better code organization
   */
  getDefaultProductImages() {
    return this.getImageProcessor().getDefaultProductImages();
  }

  /**
   * Get active Gemini API key using new multi-key system with company isolation
   * ✅ Delegation to modelManager for better code organization
   */
  async getActiveGeminiKey(companyId) {
    return this.getModelManager().getActiveGeminiKeyWithModel(companyId);
  }

  /**
   * البحث عن أفضل نموذج متاح في المفتاح النشط
   * ✅ Delegation to modelManager for better code organization
   */
  async findBestAvailableModelInActiveKey(keyId, forceRefresh = false) {
    return this.getModelManager().findBestAvailableModelInActiveKey(keyId, forceRefresh);
  }

  /**
   * تحديد نموذج كمستنفد بناءً على خطأ 429
   * ✅ Delegation to modelManager for better code organization
   */
  async markModelAsExhaustedFrom429(modelName, quotaValue, companyId = null) {
    return this.getModelManager().markModelAsExhaustedFrom429(modelName, quotaValue, companyId);
  }

  /**
   * تحديد نموذج كمستنفد (تجاوز الحد)
   * ✅ Delegation to modelManager for better code organization
   */
  async markModelAsExhausted(modelId) {
    return this.getModelManager().markModelAsExhausted(modelId);
  }

  /**
   * تحديث عداد الاستخدام لنموذج معين
   * ✅ Delegation to modelManager for better code organization
   */
  async updateModelUsage(modelId) {
    return this.getModelManager().updateModelUsage(modelId);
  }

  /**
   * فحص صحة نموذج معين
   * ✅ Delegation to modelManager for better code organization
   */
  async testModelHealth(apiKey, model) {
    return this.getModelManager().testModelHealth(apiKey, model);
  }

  /**
   * البحث عن نموذج احتياطي متاح
   * ✅ Delegation to modelManager for better code organization
   */
  async findNextAvailableModel(companyId) {
    return this.getModelManager().findNextAvailableModel(companyId);
  }

  /**
   * البحث عن نموذج آخر متاح في نفس المفتاح
   * ✅ Delegation to modelManager for better code organization
   */
  async findNextModelInKey(keyId) {
    return this.getModelManager().findNextModelInKey(keyId);
  }

  /**
   * البحث عن مفتاح آخر متاح للشركة المحددة
   * ✅ Delegation to modelManager for better code organization
   */
  async findNextAvailableKey(companyId) {
    return this.getModelManager().findNextAvailableKey(companyId);
  }

  /**
   * البحث عن أفضل نموذج في مفتاح معين
   * ✅ Delegation to modelManager for better code organization
   */
  async findBestModelInKey(keyId) {
    return this.getModelManager().findBestModelInKey(keyId);
  }

  /**
   * البحث عن أول مفتاح متاح وتفعيله تلقائياً
   * ✅ Delegation to modelManager for better code organization
   */
  async findAndActivateFirstAvailableKey(companyId) {
    return this.getModelManager().findAndActivateFirstAvailableKey(companyId);
  }

  /**
   * تفعيل مفتاح معين
   * ✅ Delegation to modelManager for better code organization
   */
  async activateKey(keyId) {
    return this.getModelManager().activateKey(keyId);
  }

  /**
   * Get AI settings
   * ✅ Delegation to settingsManager for better code organization
   */
  async getSettings(companyId) {
    return this.getSettingsManager().getSettings(companyId);
  }

  /**
   * جمع بيانات التعلم من التفاعل
   * ✅ Delegation to learningMonitor for better code organization
   */
  async collectLearningData(interactionData) {
    return this.getLearningMonitor().collectLearningData(interactionData);
  }

  /**
   * تحديد نتيجة التفاعل
   * ✅ Delegation to learningMonitor for better code organization
   */
  determineOutcome(userMessage, aiResponse, intent) {
    return this.getLearningMonitor().determineOutcome(userMessage, aiResponse, intent);
  }

  /**
   * تحديث بيانات التعلم مع التغذية الراجعة
   * ✅ Delegation to learningMonitor for better code organization
   */
  async updateLearningDataWithFeedback(conversationId, feedback) {
    return this.getLearningMonitor().updateLearningDataWithFeedback(conversationId, feedback);
  }

  /**
   * مراقبة أداء التحسينات
   * ✅ Delegation to learningMonitor for better code organization
   */
  async monitorImprovementPerformance(companyId) {
    return this.getLearningMonitor().monitorImprovementPerformance(companyId);
  }

  /**
   * حساب التحسن في المؤشرات
   * ✅ Delegation to learningMonitor for better code organization
   */
  calculateImprovement(beforeMetrics, afterMetrics) {
    return this.getLearningMonitor().calculateImprovement(beforeMetrics, afterMetrics);
  }

  /**
   * حساب متوسط التحسن
   * ✅ Delegation to learningMonitor for better code organization
   */
  calculateAverageImprovement(performanceData) {
    return this.getLearningMonitor().calculateAverageImprovement(performanceData);
  }

  /**
   * دالة موحدة ذكية للحصول على الرد والصور
   * ✅ Delegation to imageProcessor for better code organization
   */
  async getSmartResponse(customerMessage, intent, conversationMemory, customerId, companyId) {
    return this.getImageProcessor().getSmartResponse(customerMessage, intent, conversationMemory, customerId, companyId);
  }

  // 🧠 استخراج الصور من RAG data بذكاء
  // ✅ Delegation to imageProcessor (imageExtractor has been merged into imageProcessor)
  async extractImagesFromRAGData(ragData, customerMessage, companyId) {
    try {
      return await this.getImageProcessor().extractImagesFromRAGData(
        ragData,
        customerMessage,
        companyId
      );
    } catch (error) {
      console.error(`❌ [SMART-IMAGE-EXTRACT] Error in image extraction:`, error);
      return [];
    }
  }

  /**
   * تحديد ما إذا كانت الرسالة عاجلة
   * @param {string} message - نص الرسالة
   * @returns {boolean} - هل الرسالة عاجلة
   */
  isUrgentMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

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


/**
 * سكريبت اختبار شامل لنظام الـAI
 * بيختبر كل جزء من النظام بالتفصيل
 * 
 * الاستخدام:
 * node backend/test_ai_complete.js [companyId] [conversationId]
 */

require('dotenv').config();
const { getSharedPrismaClient } = require('./services/sharedDatabase');
const aiAgentService = require('./services/aiAgentService');
const memoryService = require('./services/memoryService');
const ragService = require('./services/ragService');

const prisma = getSharedPrismaClient();

// ألوان للـconsole (للتنسيق)
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(`  ${title}`, 'blue');
  console.log('='.repeat(60) + '\n');
}

function logTest(testName, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${testName}`, color);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function testMemorySystem(conversationId, senderId, companyId) {
  logSection('🧠 اختبار نظام الذاكرة');
  
  let allPassed = true;
  
  try {
    // اختبار 1: جلب الذاكرة
    log('📖 جاري جلب الذاكرة...', 'yellow');
    const memory = await memoryService.getConversationMemory(conversationId, senderId, 50, companyId);
    const passed1 = Array.isArray(memory);
    logTest('جلب الذاكرة', passed1, `عدد الرسائل: ${memory.length}`);
    if (!passed1) allPassed = false;
    
    // اختبار 2: فحص format البيانات
    if (memory.length > 0) {
      const firstMsg = memory[0];
      const hasContent = !!firstMsg.content;
      const hasIsFromCustomer = typeof firstMsg.isFromCustomer === 'boolean';
      const passed2 = hasContent && hasIsFromCustomer;
      logTest('Format البيانات صحيح', passed2, 
        `content: ${hasContent ? '✅' : '❌'}, isFromCustomer: ${hasIsFromCustomer ? '✅' : '❌'}`);
      if (!passed2) allPassed = false;
      
      // عرض أول 3 رسائل
      log('\n📋 أول 3 رسائل من الذاكرة:', 'yellow');
      memory.slice(0, 3).forEach((msg, i) => {
        const sender = msg.isFromCustomer ? '👤 العميل' : '🤖 AI';
        const preview = (msg.content || '').substring(0, 60);
        console.log(`   ${i + 1}. ${sender}: ${preview}...`);
      });
    } else {
      log('⚠️  لا توجد رسائل في الذاكرة - محادثة جديدة', 'yellow');
    }
    
    // اختبار 3: حفظ تفاعل جديد
    log('\n💾 جاري اختبار حفظ تفاعل جديد...', 'yellow');
    try {
      const saved = await memoryService.saveInteraction({
        conversationId,
        senderId,
        companyId,
        userMessage: 'رسالة اختبار من العميل',
        aiResponse: 'رد اختبار من الـAI',
        intent: 'test',
        sentiment: 'neutral',
        timestamp: new Date()
      });
      const passed3 = !!saved;
      logTest('حفظ التفاعل', passed3, saved ? `تم الحفظ: ${saved.id}` : 'فشل الحفظ');
      if (!passed3) allPassed = false;
    } catch (saveError) {
      logTest('حفظ التفاعل', false, `خطأ: ${saveError.message}`);
      allPassed = false;
    }
    
  } catch (error) {
    logTest('نظام الذاكرة', false, `خطأ: ${error.message}`);
    allPassed = false;
  }
  
  return allPassed;
}

async function testProductSearch(companyId, testQueries) {
  logSection('🔍 اختبار البحث عن المنتجات');
  
  let allPassed = true;
  
  try {
    // تهيئة RAG service
    log('🔧 جاري تهيئة RAG service...', 'yellow');
    await ragService.ensureInitialized();
    await ragService.loadProductsForCompany(companyId);
    logTest('تهيئة RAG service', true);
    
    // اختبار البحث عن منتجات مختلفة
    for (const query of testQueries) {
      log(`\n🔍 البحث عن: "${query}"`, 'yellow');
      
      try {
        const result = await ragService.retrieveSpecificProduct(query, 'product_inquiry', null, [], companyId);
        
        if (result && result.isSpecific && result.product) {
          const productName = result.product.metadata?.name || 'غير محدد';
          const confidence = (result.confidence * 100).toFixed(1);
          logTest(`البحث عن "${query}"`, true, 
            `تم العثور على: ${productName} (ثقة: ${confidence}%)`);
        } else {
          logTest(`البحث عن "${query}"`, false, 'لم يتم العثور على منتج');
          allPassed = false;
        }
      } catch (searchError) {
        logTest(`البحث عن "${query}"`, false, `خطأ: ${searchError.message}`);
        allPassed = false;
      }
    }
    
    // اختبار Fuzzy Matching
    log('\n🎯 اختبار Fuzzy Matching...', 'yellow');
    const testCases = [
      { name1: 'Belle Boot', name2: 'بيل بوت', shouldMatch: true },
      { name1: 'Belle', name2: 'بيل', shouldMatch: true },
      { name1: 'UGG Boot', name2: 'UGG', shouldMatch: true },
      { name1: 'Belle Boot', name2: 'Chelsea Boot', shouldMatch: false }
    ];
    
    for (const testCase of testCases) {
      const matches = aiAgentService.fuzzyMatchProduct(testCase.name1, testCase.name2);
      const passed = matches === testCase.shouldMatch;
      logTest(`Fuzzy Match: "${testCase.name1}" vs "${testCase.name2}"`, 
        passed, `النتيجة: ${matches ? 'مطابق' : 'غير مطابق'}`);
      if (!passed) allPassed = false;
    }
    
  } catch (error) {
    logTest('البحث عن المنتجات', false, `خطأ: ${error.message}`);
    allPassed = false;
  }
  
  return allPassed;
}

async function testAIPromptBuilding(companyId, conversationId, senderId, customerData) {
  logSection('📝 اختبار بناء الـPrompt');
  
  let allPassed = true;
  
  try {
    // جلب البيانات المطلوبة
    log('📦 جاري جلب البيانات...', 'yellow');
    const settings = await aiAgentService.getSettings(companyId);
    const memoryLimit = settings.maxMessagesPerConversation || 50;
    const conversationMemory = await memoryService.getConversationMemory(conversationId, senderId, memoryLimit, companyId);
    const companyPrompts = await aiAgentService.getCompanyPrompts(companyId);
    
    logTest('جلب البيانات', true, 
      `Memory: ${conversationMemory.length} رسالة, Prompts: ${companyPrompts.source}`);
    
    // اختبار بناء الـprompt
    log('\n🔧 جاري بناء الـprompt...', 'yellow');
    const testMessage = 'عايز اشوف منتج';
    const smartResponse = { images: [], ragData: [], hasSpecificProduct: false };
    
    try {
      const prompt = await aiAgentService.buildAdvancedPrompt(
        testMessage,
        customerData,
        companyPrompts,
        [],
        conversationMemory,
        false,
        smartResponse,
        { companyId, conversationId }
      );
      
      const hasMemory = prompt.includes('سجل المحادثة') || prompt.includes('المحادثة');
      const hasPersonality = prompt.includes(companyPrompts.personalityPrompt?.substring(0, 50) || '');
      const promptLength = prompt.length;
      
      logTest('بناء الـPrompt', true, `الطول: ${promptLength} حرف`);
      logTest('  - يحتوي على الذاكرة', hasMemory, 
        hasMemory ? '✅' : '❌');
      logTest('  - يحتوي على Personality Prompt', hasPersonality, 
        hasPersonality ? '✅' : '❌');
      
      if (!hasMemory && conversationMemory.length > 0) {
        allPassed = false;
      }
      if (!hasPersonality) {
        allPassed = false;
      }
      
      // عرض جزء من الـprompt
      log('\n📄 جزء من الـPrompt (أول 300 حرف):', 'yellow');
      console.log(`   ${prompt.substring(0, 300)}...`);
      
    } catch (promptError) {
      logTest('بناء الـPrompt', false, `خطأ: ${promptError.message}`);
      allPassed = false;
    }
    
  } catch (error) {
    logTest('بناء الـPrompt', false, `خطأ: ${error.message}`);
    allPassed = false;
  }
  
  return allPassed;
}

async function testAIResponseGeneration(companyId, conversationId, senderId, customerData) {
  logSection('🤖 اختبار توليد رد الـAI');
  
  let allPassed = true;
  
  try {
    // اختبار 1: معالجة رسالة بسيطة
    log('💬 اختبار معالجة رسالة بسيطة...', 'yellow');
    const simpleMessage = {
      conversationId,
      senderId,
      content: 'السلام عليكم',
      attachments: [],
      customerData,
      companyId
    };
    
    try {
      const response = await aiAgentService.processCustomerMessage(simpleMessage);
      
      const hasContent = !!response.content && response.content.length > 0;
      const isSilent = response.silent === true;
      const hasError = !!response.error;
      
      logTest('معالجة رسالة بسيطة', hasContent && !isSilent && !hasError, 
        hasContent ? `الرد: ${response.content.substring(0, 60)}...` : 'لا يوجد رد');
      
      if (!hasContent || isSilent || hasError) {
        allPassed = false;
      }
    } catch (responseError) {
      logTest('معالجة رسالة بسيطة', false, `خطأ: ${responseError.message}`);
      allPassed = false;
    }
    
    // اختبار 2: معالجة سؤال عن منتج
    log('\n🛍️  اختبار سؤال عن منتج...', 'yellow');
    const productMessage = {
      conversationId,
      senderId,
      content: 'عايز اشوف منتج',
      attachments: [],
      customerData,
      companyId
    };
    
    try {
      const response = await aiAgentService.processCustomerMessage(productMessage);
      
      const hasContent = !!response.content && response.content.length > 0;
      const hasImages = response.images && response.images.length > 0;
      const isSilent = response.silent === true;
      
      logTest('سؤال عن منتج', hasContent && !isSilent, 
        `الرد: ${hasContent ? '✅' : '❌'}, الصور: ${hasImages ? response.images.length : 0}`);
      
      if (!hasContent || isSilent) {
        allPassed = false;
      }
    } catch (responseError) {
      logTest('سؤال عن منتج', false, `خطأ: ${responseError.message}`);
      allPassed = false;
    }
    
    // اختبار 3: اختبار Timeout
    log('\n⏱️  اختبار Timeout (30s)...', 'yellow');
    const timeoutMessage = {
      conversationId,
      senderId,
      content: 'رسالة اختبار timeout',
      attachments: [],
      customerData,
      companyId
    };
    
    // محاكاة timeout قصير للاختبار
    const originalWithTimeout = aiAgentService.withTimeout.bind(aiAgentService);
    aiAgentService.withTimeout = async function(promise, timeoutMs, errorMessage) {
      // استخدام timeout قصير جداً للاختبار (100ms)
      return Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI response timeout: تم تجاوز الوقت المسموح (30 ثانية)')), 100)
        )
      ]);
    };
    
    try {
      const response = await aiAgentService.processCustomerMessage(timeoutMessage);
      // في حالة timeout، يجب أن يكون silent
      const isSilent = response.silent === true;
      logTest('Timeout', isSilent, isSilent ? 'النظام صامت ✅' : 'النظام لم يكن صامت ❌');
      if (!isSilent) allPassed = false;
    } catch (timeoutError) {
      // Timeout متوقع
      logTest('Timeout', true, 'تم إحداث timeout بنجاح ✅');
    } finally {
      // استعادة الدالة الأصلية
      aiAgentService.withTimeout = originalWithTimeout;
    }
    
  } catch (error) {
    logTest('توليد رد الـAI', false, `خطأ: ${error.message}`);
    allPassed = false;
  }
  
  return allPassed;
}

async function testImageProcessing(companyId, conversationId, senderId, customerData) {
  logSection('📸 اختبار معالجة الصور');
  
  let allPassed = true;
  
  try {
    // اختبار معالجة صورة (محاكاة خطأ)
    log('🖼️  اختبار معالجة صورة مع خطأ...', 'yellow');
    const imageMessage = {
      conversationId,
      senderId,
      content: 'صورة',
      attachments: [{ type: 'image', url: 'https://invalid-url-for-testing.com/image.jpg' }],
      customerData,
      companyId
    };
    
    try {
      const response = await aiAgentService.processCustomerMessage(imageMessage);
      
      // عند فشل معالجة الصورة، يجب أن يكون النظام صامت
      const isSilent = response.silent === true;
      const hasErrorContent = response.content && response.content.includes('خطأ');
      
      logTest('معالجة الصورة (مع خطأ)', isSilent, 
        isSilent ? 'النظام صامت ✅ (لا يرسل رسالة خطأ)' : 
        hasErrorContent ? '❌ تم إرسال رسالة خطأ للعميل' : '⚠️  غير واضح');
      
      if (!isSilent && hasErrorContent) {
        allPassed = false;
      }
    } catch (imageError) {
      // خطأ متوقع في معالجة الصورة
      logTest('معالجة الصورة (مع خطأ)', true, 'تم التعامل مع الخطأ بشكل صحيح ✅');
    }
    
  } catch (error) {
    logTest('معالجة الصور', false, `خطأ: ${error.message}`);
    allPassed = false;
  }
  
  return allPassed;
}

async function testContextAwareness(companyId, conversationId, senderId, customerData) {
  logSection('🧠 اختبار الوعي بالسياق');
  
  let allPassed = true;
  
  try {
    // اختبار 1: حفظ منتج في الذاكرة ثم السؤال عنه بدون ذكر الاسم
    log('💾 حفظ منتج في الذاكرة...', 'yellow');
    
    // حفظ تفاعل يحتوي على منتج
    await memoryService.saveInteraction({
      conversationId,
      senderId,
      companyId,
      userMessage: 'عايز اشوف Belle Boot',
      aiResponse: 'تفضل [المنتج: Belle Boot] - هذا المنتج متاح بسعر 500 جنيه',
      intent: 'product_inquiry',
      sentiment: 'neutral',
      timestamp: new Date()
    });
    
    logTest('حفظ منتج في الذاكرة', true);
    
    // اختبار 2: السؤال عن المنتج بدون ذكر الاسم
    log('\n❓ السؤال عن المنتج بدون ذكر الاسم...', 'yellow');
    const contextMessage = {
      conversationId,
      senderId,
      content: 'صور',
      attachments: [],
      customerData,
      companyId
    };
    
    try {
      const response = await aiAgentService.processCustomerMessage(contextMessage);
      
      // يجب أن يربط "صور" بـ "Belle Boot" من الذاكرة
      const hasContent = !!response.content && response.content.length > 0;
      const mentionsProduct = response.content && (
        response.content.includes('Belle') || 
        response.content.includes('بيل') ||
        response.ragData?.some(item => 
          item.metadata?.name?.toLowerCase().includes('belle') ||
          item.metadata?.name?.toLowerCase().includes('بيل')
        )
      );
      
      logTest('ربط "صور" بالمنتج من الذاكرة', mentionsProduct, 
        mentionsProduct ? '✅ تم الربط بنجاح' : '❌ لم يتم الربط');
      
      if (!mentionsProduct) {
        allPassed = false;
      }
    } catch (contextError) {
      logTest('ربط السياق', false, `خطأ: ${contextError.message}`);
      allPassed = false;
    }
    
  } catch (error) {
    logTest('الوعي بالسياق', false, `خطأ: ${error.message}`);
    allPassed = false;
  }
  
  return allPassed;
}

async function runCompleteTest(companyId = null, conversationId = null) {
  try {
    log('\n' + '='.repeat(60), 'magenta');
    log('🧪 اختبار شامل لنظام الـAI', 'magenta');
    log('='.repeat(60) + '\n', 'magenta');
    
    // جلب محادثة للاختبار
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyId: true
            }
          }
        }
      });
    } else {
      const where = companyId ? { companyId } : {};
      conversation = await prisma.conversation.findFirst({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyId: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    
    if (!conversation) {
      log('❌ لم يتم العثور على محادثة للاختبار', 'red');
      log('💡 نصيحة: تأكد من وجود محادثات في قاعدة البيانات', 'yellow');
      process.exit(1);
    }
    
    const finalCompanyId = companyId || conversation.customer?.companyId;
    if (!finalCompanyId) {
      log('❌ Company ID مطلوب', 'red');
      process.exit(1);
    }
    
    log('✅ تم العثور على محادثة:', 'green');
    console.log(`   - ID: ${conversation.id}`);
    console.log(`   - العميل: ${conversation.customer ? `${conversation.customer.firstName} ${conversation.customer.lastName}` : 'N/A'}`);
    console.log(`   - Company ID: ${finalCompanyId}\n`);
    
    const customerData = {
      id: conversation.customerId,
      name: conversation.customer ? `${conversation.customer.firstName} ${conversation.customer.lastName}` : 'عميل',
      companyId: finalCompanyId
    };
    
    // قائمة اختبارات
    const testResults = {};
    
    // اختبار 1: نظام الذاكرة
    testResults.memory = await testMemorySystem(
      conversation.id,
      conversation.customerId,
      finalCompanyId
    );
    
    // اختبار 2: البحث عن المنتجات
    const testQueries = ['Belle', 'بيل', 'UGG', 'كوتشي'];
    testResults.products = await testProductSearch(finalCompanyId, testQueries);
    
    // اختبار 3: بناء الـPrompt
    testResults.prompt = await testAIPromptBuilding(
      finalCompanyId,
      conversation.id,
      conversation.customerId,
      customerData
    );
    
    // اختبار 4: توليد رد الـAI
    testResults.aiResponse = await testAIResponseGeneration(
      finalCompanyId,
      conversation.id,
      conversation.customerId,
      customerData
    );
    
    // اختبار 5: معالجة الصور
    testResults.images = await testImageProcessing(
      finalCompanyId,
      conversation.id,
      conversation.customerId,
      customerData
    );
    
    // اختبار 6: الوعي بالسياق
    testResults.context = await testContextAwareness(
      finalCompanyId,
      conversation.id,
      conversation.customerId,
      customerData
    );
    
    // ملخص النتائج
    logSection('📊 ملخص النتائج');
    
    const allTests = [
      { name: 'نظام الذاكرة', result: testResults.memory },
      { name: 'البحث عن المنتجات', result: testResults.products },
      { name: 'بناء الـPrompt', result: testResults.prompt },
      { name: 'توليد رد الـAI', result: testResults.aiResponse },
      { name: 'معالجة الصور', result: testResults.images },
      { name: 'الوعي بالسياق', result: testResults.context }
    ];
    
    allTests.forEach(test => {
      logTest(test.name, test.result);
    });
    
    const totalPassed = allTests.filter(t => t.result).length;
    const totalTests = allTests.length;
    const allPassed = totalPassed === totalTests;
    
    console.log('\n' + '='.repeat(60));
    log(`النتيجة النهائية: ${totalPassed}/${totalTests} اختبار نجح`, 
      allPassed ? 'green' : 'yellow');
    console.log('='.repeat(60) + '\n');
    
    if (allPassed) {
      log('🎉 كل الاختبارات نجحت! النظام يعمل بشكل ممتاز ✅', 'green');
    } else {
      log('⚠️  بعض الاختبارات فشلت - راجع النتائج أعلاه', 'yellow');
    }
    
    // تنظيف
    await prisma.$disconnect();
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    log('\n❌ خطأ في الاختبار:', 'red');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// تشغيل الاختبار
const args = process.argv.slice(2);
const companyId = args[0] || null;
const conversationId = args[1] || null;

runCompleteTest(companyId, conversationId);


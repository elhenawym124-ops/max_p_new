/**
 * سكريبت اختبار الذكاء الصناعي مع السيناريو الكامل
 * يرسل الأسئلة واحد تلو الآخر ويسجل الردود
 */

// استخدام المسار الصحيح
const path = require('path');
const rootPath = path.join(__dirname, '..');
process.chdir(rootPath);

const { getSharedPrismaClient } = require('../services/sharedDatabase');
const aiAgentService = require('../aiAgentService');

// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

// معلومات الشركة
const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97'; // شركة التسويق

// السيناريو الكامل (15 سؤال)
const SCENARIO = [
  'اهلا',
  'عندك ايه من الكوتشيات؟',
  'عايز اعرف عن الكوتشي بتاعك',
  'الكوتشي بكام؟',
  'في مقاس 40؟',
  'في ألوان إيه؟',
  'الشحن كام لو أنا في القاهرة؟',
  'عايز أطلب كوتشي مقاس 40 لون أسود',
  'الدفع إزاي؟',
  'هيوصل إمتى لو طلبت النهاردة؟',
  'اسمي أحمد محمد',
  'العنوان: 15 شارع التحرير، وسط البلد، القاهرة',
  'رقمي: 01234567890',
  'تمام، اعمل الطلب',
  'شكراً، هيوصل إمتى بالظبط؟'
];

// معلومات الطلب المتوقعة
const EXPECTED_ORDER_INFO = {
  product: 'كوتشي',
  price: 100,
  shipping: 50,
  total: 150,
  deliveryTime: '3-5 أيام',
  name: 'أحمد محمد',
  address: '15 شارع التحرير، وسط البلد، القاهرة',
  phone: '01234567890',
  governorate: 'القاهرة'
};

class AIScenarioTester {
  constructor() {
    this.companyId = COMPANY_ID;
    this.conversationId = null;
    this.customerId = null;
    this.results = [];
    this.orderCreated = false;
  }

  async initialize() {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('🧪 بدء اختبار الذكاء الصناعي - السيناريو الكامل');
      console.log('='.repeat(80) + '\n');

      // البحث عن أو إنشاء customer اختبار
      let testCustomer = await getSharedPrismaClient().customer.findFirst({
        where: {
          companyId: this.companyId,
          firstName: 'أحمد',
          lastName: 'محمد'
        }
      });

      if (!testCustomer) {
        testCustomer = await getSharedPrismaClient().customer.create({
          data: {
            companyId: this.companyId,
            firstName: 'أحمد',
            lastName: 'محمد',
            phone: '01234567890',
            email: `test-${this.companyId}@test.com`
          }
        });
        console.log(`✅ تم إنشاء customer جديد: ${testCustomer.id}`);
      } else {
        console.log(`✅ تم العثور على customer: ${testCustomer.id}`);
      }

      this.customerId = testCustomer.id;

      // إنشاء محادثة جديدة
      const conversation = await getSharedPrismaClient().conversation.create({
        data: {
          companyId: this.companyId,
          customerId: testCustomer.id,
          channel: 'TEST',
          status: 'ACTIVE',
          lastMessageAt: new Date(),
          lastMessagePreview: 'اختبار السيناريو الكامل'
        }
      });

      this.conversationId = conversation.id;
      console.log(`✅ تم إنشاء محادثة: ${conversation.id}\n`);

    } catch (error) {
      console.error('❌ خطأ في التهيئة:', error);
      throw error;
    }
  }

  async sendQuestion(question, questionNumber) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📤 السؤال ${questionNumber}: "${question}"`);
      console.log('='.repeat(80));

      const messageData = {
        conversationId: this.conversationId,
        senderId: this.customerId,
        content: question,
        attachments: [],
        companyId: this.companyId,
        customerData: {
          id: this.customerId,
          name: 'أحمد محمد',
          phone: '01234567890',
          email: `test-${this.companyId}@test.com`,
          orderCount: 0,
          companyId: this.companyId
        }
      };

      const startTime = Date.now();
      const response = await aiAgentService.processCustomerMessage(messageData);
      const processingTime = Date.now() - startTime;

      // حفظ رسالة المستخدم
      await getSharedPrismaClient().message.create({
        data: {
          conversationId: this.conversationId,
          content: question,
          type: 'TEXT',
          isFromCustomer: true,
          createdAt: new Date()
        }
      });

      let responseContent = null;
      let responseAnalysis = {
        hasResponse: false,
        isAppropriate: false,
        issues: [],
        suggestions: []
      };

      if (response) {
        if (typeof response === 'string') {
          responseContent = response;
        } else if (response.content) {
          responseContent = response.content;
        } else if (response.response) {
          responseContent = response.response;
        }

        // حفظ رد AI
        if (responseContent) {
          await getSharedPrismaClient().message.create({
            data: {
              conversationId: this.conversationId,
              content: responseContent,
              type: 'TEXT',
              isFromCustomer: false,
              createdAt: new Date()
            }
          });
        }

        // تحليل الرد
        responseAnalysis = this.analyzeResponse(question, responseContent, questionNumber);
      } else {
        responseAnalysis.issues.push('❌ لم يتم الحصول على رد من الذكاء الصناعي');
      }

      // التحقق من إنشاء الطلب (بعد السؤال 14)
      if (questionNumber === 14 && !this.orderCreated) {
        const order = await getSharedPrismaClient().order.findFirst({
          where: {
            conversationId: this.conversationId,
            companyId: this.companyId
          },
          orderBy: { createdAt: 'desc' }
        });

        if (order) {
          this.orderCreated = true;
          responseAnalysis.orderCreated = true;
          responseAnalysis.orderNumber = order.orderNumber;
          console.log(`\n✅ تم إنشاء الطلب: ${order.orderNumber}`);
        } else {
          responseAnalysis.issues.push('⚠️ لم يتم إنشاء الطلب بعد السؤال 14');
        }
      }

      const result = {
        questionNumber,
        question,
        response: responseContent,
        processingTime,
        analysis: responseAnalysis
      };

      this.results.push(result);

      // عرض النتيجة
      console.log(`\n📥 الرد (${processingTime}ms):`);
      console.log(responseContent || '(لا يوجد رد)');
      console.log(`\n📊 التحليل:`);
      console.log(`   - لديه رد: ${responseAnalysis.hasResponse ? '✅' : '❌'}`);
      console.log(`   - مناسب: ${responseAnalysis.isAppropriate ? '✅' : '❌'}`);
      if (responseAnalysis.issues.length > 0) {
        console.log(`   - المشاكل:`);
        responseAnalysis.issues.forEach(issue => console.log(`     ${issue}`));
      }
      if (responseAnalysis.suggestions.length > 0) {
        console.log(`   - التوصيات:`);
        responseAnalysis.suggestions.forEach(suggestion => console.log(`     ${suggestion}`));
      }

      // انتظار قصير بين الأسئلة
      await new Promise(resolve => setTimeout(resolve, 2000));

      return result;

    } catch (error) {
      console.error(`❌ خطأ في السؤال ${questionNumber}:`, error.message);
      this.results.push({
        questionNumber,
        question,
        error: error.message,
        analysis: {
          hasResponse: false,
          isAppropriate: false,
          issues: [`❌ خطأ: ${error.message}`]
        }
      });
      return null;
    }
  }

  analyzeResponse(question, response, questionNumber) {
    const analysis = {
      hasResponse: !!response,
      isAppropriate: false,
      issues: [],
      suggestions: []
    };

    if (!response) {
      return analysis;
    }

    const responseLower = response.toLowerCase();
    const questionLower = question.toLowerCase();

    // تحليل حسب نوع السؤال
    switch (questionNumber) {
      case 1: // اهلا
        if (!responseLower.includes('اهلا') && !responseLower.includes('مرحبا') && !responseLower.includes('أهلا')) {
          analysis.issues.push('⚠️ لم يرد بالتحية المناسبة');
        } else {
          analysis.isAppropriate = true;
        }
        break;

      case 2: // عندك ايه من الكوتشيات؟
        if (!responseLower.includes('كوتشي') && !responseLower.includes('حذاء')) {
          analysis.issues.push('⚠️ لم يذكر المنتجات المتاحة');
        } else {
          analysis.isAppropriate = true;
        }
        break;

      case 4: // الكوتشي بكام؟
        if (!responseLower.includes('100') && !responseLower.includes('مائة')) {
          analysis.issues.push('⚠️ لم يذكر السعر الصحيح (100 جنيه)');
        } else {
          analysis.isAppropriate = true;
        }
        break;

      case 7: // الشحن كام لو أنا في القاهرة؟
        if (!responseLower.includes('50') && !responseLower.includes('خمسين')) {
          analysis.issues.push('⚠️ لم يذكر سعر الشحن الصحيح (50 جنيه)');
        } else {
          analysis.isAppropriate = true;
        }
        break;

      case 8: // عايز أطلب
        if (!responseLower.includes('طلب') && !responseLower.includes('بيانات') && !responseLower.includes('اسم')) {
          analysis.issues.push('⚠️ لم يطلب بيانات الطلب');
        } else {
          analysis.isAppropriate = true;
        }
        break;

      case 14: // تمام، اعمل الطلب
        if (!responseLower.includes('طلب') && !responseLower.includes('تم') && !responseLower.includes('رقم')) {
          analysis.issues.push('⚠️ لم يؤكد إنشاء الطلب أو يعطي رقم الطلب');
        } else {
          analysis.isAppropriate = true;
        }
        break;
    }

    // فحوصات عامة
    if (response.length < 10) {
      analysis.issues.push('⚠️ الرد قصير جداً');
    }

    if (response.length > 1000) {
      analysis.issues.push('⚠️ الرد طويل جداً');
    }

    return analysis;
  }

  async generateReport() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 تقرير الاختبار النهائي');
    console.log('='.repeat(80) + '\n');

    const totalQuestions = this.results.length;
    const successfulResponses = this.results.filter(r => r.analysis?.hasResponse).length;
    const appropriateResponses = this.results.filter(r => r.analysis?.isAppropriate).length;
    const totalIssues = this.results.reduce((sum, r) => sum + (r.analysis?.issues?.length || 0), 0);
    const avgProcessingTime = this.results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / totalQuestions;

    console.log(`📈 الإحصائيات:`);
    console.log(`   - إجمالي الأسئلة: ${totalQuestions}`);
    console.log(`   - الردود الناجحة: ${successfulResponses}/${totalQuestions} (${Math.round(successfulResponses/totalQuestions*100)}%)`);
    console.log(`   - الردود المناسبة: ${appropriateResponses}/${totalQuestions} (${Math.round(appropriateResponses/totalQuestions*100)}%)`);
    console.log(`   - إجمالي المشاكل: ${totalIssues}`);
    console.log(`   - متوسط وقت المعالجة: ${Math.round(avgProcessingTime)}ms`);
    console.log(`   - تم إنشاء الطلب: ${this.orderCreated ? '✅ نعم' : '❌ لا'}`);

    console.log(`\n📋 تفاصيل المشاكل:`);
    this.results.forEach((result, index) => {
      if (result.analysis?.issues?.length > 0) {
        console.log(`\n   السؤال ${result.questionNumber}: "${result.question}"`);
        result.analysis.issues.forEach(issue => console.log(`     ${issue}`));
      }
    });

    // حفظ التقرير في ملف
    const report = {
      timestamp: new Date().toISOString(),
      companyId: this.companyId,
      conversationId: this.conversationId,
      summary: {
        totalQuestions,
        successfulResponses,
        appropriateResponses,
        totalIssues,
        avgProcessingTime,
        orderCreated: this.orderCreated
      },
      results: this.results
    };

    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 تم حفظ التقرير في: ${reportPath}`);
  }

  async run() {
    try {
      await this.initialize();

      for (let i = 0; i < SCENARIO.length; i++) {
        await this.sendQuestion(SCENARIO[i], i + 1);
      }

      await this.generateReport();

    } catch (error) {
      console.error('❌ خطأ في الاختبار:', error);
    } finally {
      await getSharedPrismaClient().$disconnect();
    }
  }
}

// تشغيل الاختبار
if (require.main === module) {
  const tester = new AIScenarioTester();
  tester.run();
}

module.exports = AIScenarioTester;



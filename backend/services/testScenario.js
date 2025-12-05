/**
 * سكريبت اختبار مبسط للذكاء الصناعي
 * يعمل من services directory لاستخدام نفس المسارات
 */

const { getSharedPrismaClient } = require('./sharedDatabase');
const aiAgentService = require('../aiAgentService');

// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97'; // شركة التسويق

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

async function testScenario() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 اختبار الذكاء الصناعي - السيناريو الكامل');
    console.log('='.repeat(80) + '\n');

    // إنشاء customer
    let customer = await getSharedPrismaClient().customer.findFirst({
      where: { companyId: COMPANY_ID, firstName: 'أحمد', lastName: 'محمد' }
    });

    if (!customer) {
      customer = await getSharedPrismaClient().customer.create({
        data: {
          companyId: COMPANY_ID,
          firstName: 'أحمد',
          lastName: 'محمد',
          phone: '01234567890',
          email: `test-${COMPANY_ID}@test.com`
        }
      });
      console.log(`✅ تم إنشاء customer جديد: ${customer.id}`);
    } else {
      console.log(`✅ تم العثور على customer: ${customer.id}`);
    }

    // إنشاء محادثة
    const conversation = await getSharedPrismaClient().conversation.create({
      data: {
        companyId: COMPANY_ID,
        customerId: customer.id,
        channel: 'TEST',
        status: 'ACTIVE',
        lastMessageAt: new Date(),
        lastMessagePreview: 'اختبار السيناريو'
      }
    });

    console.log(`✅ تم إنشاء المحادثة: ${conversation.id}\n`);

    const results = [];

    // إرسال الأسئلة
    for (let i = 0; i < SCENARIO.length; i++) {
      const question = SCENARIO[i];
      const questionNum = i + 1;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📤 السؤال ${questionNum}/15: "${question}"`);
      console.log('='.repeat(80));

      const messageData = {
        conversationId: conversation.id,
        senderId: customer.id,
        content: question,
        attachments: [],
        companyId: COMPANY_ID,
        customerData: {
          id: customer.id,
          name: 'أحمد محمد',
          phone: '01234567890',
          email: customer.email,
          orderCount: 0,
          companyId: COMPANY_ID
        }
      };

      // حفظ رسالة المستخدم
      await getSharedPrismaClient().message.create({
        data: {
          conversationId: conversation.id,
          content: question,
          type: 'TEXT',
          isFromCustomer: true,
          createdAt: new Date()
        }
      });

      const startTime = Date.now();
      let response;
      let error = null;
      
      try {
        response = await aiAgentService.processCustomerMessage(messageData);
      } catch (err) {
        error = err.message;
        console.error(`❌ خطأ في معالجة الرسالة: ${err.message}`);
      }
      
      const processingTime = Date.now() - startTime;

      let responseContent = null;
      if (response) {
        if (typeof response === 'string') {
          responseContent = response;
        } else if (response.content) {
          responseContent = response.content;
        }
      }

      // حفظ رد AI
      if (responseContent) {
        await getSharedPrismaClient().message.create({
          data: {
            conversationId: conversation.id,
            content: responseContent,
            type: 'TEXT',
            isFromCustomer: false,
            createdAt: new Date()
          }
        });
      }

      // تحليل الرد
      const analysis = analyzeResponse(question, responseContent, questionNum, error);

      // عرض النتيجة
      console.log(`\n📥 الرد (${processingTime}ms):`);
      if (responseContent) {
        const preview = responseContent.substring(0, 500);
        console.log(preview + (responseContent.length > 500 ? '...' : ''));
      } else {
        console.log('❌ لا يوجد رد');
      }

      console.log(`\n📊 التحليل:`);
      console.log(`   - لديه رد: ${analysis.hasResponse ? '✅' : '❌'}`);
      console.log(`   - مناسب: ${analysis.isAppropriate ? '✅' : '❌'}`);
      if (analysis.issues.length > 0) {
        console.log(`   - المشاكل:`);
        analysis.issues.forEach(issue => console.log(`     ${issue}`));
      }

      // التحقق من إنشاء الطلب
      if (questionNum === 14) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // انتظار 3 ثواني
        const order = await getSharedPrismaClient().order.findFirst({
          where: { conversationId: conversation.id, companyId: COMPANY_ID },
          orderBy: { createdAt: 'desc' }
        });
        if (order) {
          console.log(`\n✅ تم إنشاء الطلب: ${order.orderNumber}`);
          analysis.orderCreated = true;
          analysis.orderNumber = order.orderNumber;
        } else {
          console.log(`\n⚠️ لم يتم إنشاء الطلب`);
          analysis.issues.push('⚠️ لم يتم إنشاء الطلب بعد السؤال 14');
        }
      }

      results.push({
        questionNum,
        question,
        response: responseContent,
        processingTime,
        analysis,
        error
      });

      // انتظار قصير
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // تقرير نهائي
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 تقرير الاختبار النهائي');
    console.log('='.repeat(80) + '\n');

    const successful = results.filter(r => r.analysis?.hasResponse).length;
    const appropriate = results.filter(r => r.analysis?.isAppropriate).length;
    const totalIssues = results.reduce((sum, r) => sum + (r.analysis?.issues?.length || 0), 0);
    const avgTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / results.length;
    const orderCreated = results.find(r => r.analysis?.orderCreated) ? true : false;

    console.log(`📈 الإحصائيات:`);
    console.log(`   - إجمالي الأسئلة: ${results.length}`);
    console.log(`   - الردود الناجحة: ${successful}/${results.length} (${Math.round(successful/results.length*100)}%)`);
    console.log(`   - الردود المناسبة: ${appropriate}/${results.length} (${Math.round(appropriate/results.length*100)}%)`);
    console.log(`   - إجمالي المشاكل: ${totalIssues}`);
    console.log(`   - متوسط وقت المعالجة: ${Math.round(avgTime)}ms`);
    console.log(`   - تم إنشاء الطلب: ${orderCreated ? '✅ نعم' : '❌ لا'}`);

    console.log(`\n📋 تفاصيل المشاكل:`);
    results.forEach((result) => {
      if (result.analysis?.issues?.length > 0) {
        console.log(`\n   السؤال ${result.questionNum}: "${result.question}"`);
        result.analysis.issues.forEach(issue => console.log(`     ${issue}`));
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ انتهى الاختبار');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await getSharedPrismaClient().$disconnect();
  }
}

function analyzeResponse(question, response, questionNum, error) {
  const analysis = {
    hasResponse: !!response && !error,
    isAppropriate: false,
    issues: [],
    suggestions: []
  };

  if (error) {
    analysis.issues.push(`❌ خطأ: ${error}`);
    return analysis;
  }

  if (!response) {
    analysis.issues.push('❌ لا يوجد رد');
    return analysis;
  }

  const responseLower = response.toLowerCase();
  const questionLower = question.toLowerCase();

  // تحليل حسب نوع السؤال
  switch (questionNum) {
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

testScenario();



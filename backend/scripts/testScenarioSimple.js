/**
 * سكريبت اختبار مبسط للذكاء الصناعي
 */

// استخدام المسار المطلق
const path = require('path');
const backendPath = path.join(__dirname, '..');

// استيراد من services directory (نسبي من scripts)
const { getSharedPrismaClient } = require(path.join(backendPath, 'services', 'sharedDatabase'));
const aiAgentService = require(path.join(backendPath, 'aiAgentService'));

const prisma = getSharedPrismaClient();

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
    let customer = await prisma.customer.findFirst({
      where: { companyId: COMPANY_ID, firstName: 'أحمد', lastName: 'محمد' }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId: COMPANY_ID,
          firstName: 'أحمد',
          lastName: 'محمد',
          phone: '01234567890',
          email: `test-${COMPANY_ID}@test.com`
        }
      });
    }

    // إنشاء محادثة
    const conversation = await prisma.conversation.create({
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
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: question,
          type: 'TEXT',
          isFromCustomer: true,
          createdAt: new Date()
        }
      });

      const startTime = Date.now();
      const response = await aiAgentService.processCustomerMessage(messageData);
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
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            content: responseContent,
            type: 'TEXT',
            isFromCustomer: false,
            createdAt: new Date()
          }
        });
      }

      // عرض النتيجة
      console.log(`\n📥 الرد (${processingTime}ms):`);
      if (responseContent) {
        console.log(responseContent.substring(0, 500) + (responseContent.length > 500 ? '...' : ''));
      } else {
        console.log('❌ لا يوجد رد');
      }

      // التحقق من إنشاء الطلب
      if (questionNum === 14) {
        const order = await prisma.order.findFirst({
          where: { conversationId: conversation.id, companyId: COMPANY_ID },
          orderBy: { createdAt: 'desc' }
        });
        if (order) {
          console.log(`\n✅ تم إنشاء الطلب: ${order.orderNumber}`);
        } else {
          console.log(`\n⚠️ لم يتم إنشاء الطلب`);
        }
      }

      // انتظار قصير
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ انتهى الاختبار');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testScenario();


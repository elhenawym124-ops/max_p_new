/**
 * سكريبت اختبار لحفظ رسالة في قاعدة البيانات
 */

const { getSharedPrismaClient } = require('./sharedDatabase');
const prisma = getSharedPrismaClient();

const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97'; // شركة التسويق

async function testSaveMessage() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 اختبار حفظ رسالة في قاعدة البيانات');
    console.log('='.repeat(60) + '\n');

    // البحث عن customer اختبار
    let testCustomer = await prisma.customer.findFirst({
      where: {
        companyId: COMPANY_ID,
        firstName: 'عميل اختبار',
        lastName: 'Test Customer'
      }
    });

    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          companyId: COMPANY_ID,
          firstName: 'عميل اختبار',
          lastName: 'Test Customer',
          phone: '0000000000',
          email: `test-${COMPANY_ID}@test.com`
        }
      });
      console.log(`✅ تم إنشاء customer جديد: ${testCustomer.id}`);
    } else {
      console.log(`✅ تم العثور على customer: ${testCustomer.id}`);
    }

    // إنشاء محادثة TEST
    const conversation = await prisma.conversation.create({
      data: {
        companyId: COMPANY_ID,
        customerId: testCustomer.id,
        channel: 'TEST',
        status: 'ACTIVE',
        lastMessageAt: new Date(),
        lastMessagePreview: 'اختبار حفظ الرسائل'
      }
    });

    console.log(`✅ تم إنشاء محادثة: ${conversation.id}`);
    console.log(`   Channel: ${conversation.channel}`);
    console.log(`   Company ID: ${conversation.companyId}`);
    console.log(`   Customer ID: ${conversation.customerId}\n`);

    // حفظ رسالة من المستخدم
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: 'رسالة اختبار من المستخدم',
        type: 'TEXT',
        isFromCustomer: true,
        createdAt: new Date()
      }
    });

    console.log(`✅ تم حفظ رسالة المستخدم: ${userMessage.id}`);
    console.log(`   Content: ${userMessage.content}`);
    console.log(`   Is From Customer: ${userMessage.isFromCustomer}\n`);

    // حفظ رسالة من AI
    const aiMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: 'رد اختبار من الذكاء الاصطناعي',
        type: 'TEXT',
        isFromCustomer: false,
        createdAt: new Date()
      }
    });

    console.log(`✅ تم حفظ رسالة AI: ${aiMessage.id}`);
    console.log(`   Content: ${aiMessage.content}`);
    console.log(`   Is From Customer: ${aiMessage.isFromCustomer}\n`);

    // التحقق من الرسائل
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📊 عدد الرسائل في المحادثة: ${messages.length}`);
    messages.forEach((msg, idx) => {
      const sender = msg.isFromCustomer ? '👤 المستخدم' : '🤖 AI';
      console.log(`   ${idx + 1}. ${sender}: ${msg.content}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ الاختبار نجح!');
    console.log(`💬 المحادثة: ${conversation.id}`);
    console.log(`📝 يمكنك رؤية المحادثة في /test-chat?conversationId=${conversation.id}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ خطأ في الاختبار:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testSaveMessage();


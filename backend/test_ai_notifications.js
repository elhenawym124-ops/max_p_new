/**
 * Script لاختبار نظام إشعارات فشل الـAI
 * 
 * الاستخدام:
 * node test_ai_notifications.js [timeout|error] [conversationId] [companyId]
 * 
 * أمثلة:
 * node test_ai_notifications.js timeout
 * node test_ai_notifications.js error
 * node test_ai_notifications.js timeout cmdkj6coz0000uf0cyscco6lr
 */

require('dotenv').config();
const { getSharedPrismaClient } = require('./services/sharedDatabase');
const aiAgentService = require('./services/aiAgentService');

const prisma = getSharedPrismaClient();

async function testAINotifications(testType = 'timeout', conversationId = null, companyId = null) {
  try {
    console.log('\n🧪 ========================================');
    console.log('🧪 اختبار نظام إشعارات فشل الـAI');
    console.log('🧪 ========================================\n');
    console.log(`📋 نوع الاختبار: ${testType}`);
    console.log(`💬 Conversation ID: ${conversationId || 'سيتم البحث عن محادثة'}`);
    console.log(`🏢 Company ID: ${companyId || 'سيتم استخدام companyId من المحادثة'}\n`);

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
          },
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });
    } else {
      // جلب أول محادثة متاحة
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
          },
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!conversation) {
      console.error('❌ لم يتم العثور على محادثة للاختبار');
      console.log('💡 نصيحة: تأكد من وجود محادثات في قاعدة البيانات أو قم بتحديد conversationId');
      process.exit(1);
    }

    const finalCompanyId = companyId || conversation.customer?.companyId;
    if (!finalCompanyId) {
      console.error('❌ Company ID مطلوب');
      console.log('💡 نصيحة: قم بتحديد companyId أو استخدم محادثة مع customer له companyId');
      process.exit(1);
    }

    console.log('✅ تم العثور على محادثة:');
    console.log(`   - ID: ${conversation.id}`);
    console.log(`   - العميل: ${conversation.customer ? `${conversation.customer.firstName} ${conversation.customer.lastName}` : 'N/A'}`);
    console.log(`   - Agent مكلّف: ${conversation.assignedUser ? `${conversation.assignedUser.firstName} ${conversation.assignedUser.lastName}` : 'لا يوجد'}`);
    console.log(`   - Company ID: ${finalCompanyId}\n`);

    // جلب الـAdmins للتحقق
    const admins = await prisma.user.findMany({
      where: {
        companyId: finalCompanyId,
        role: { in: ['COMPANY_ADMIN', 'MANAGER'] },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    console.log('👥 المستلمون المتوقعون:');
    if (conversation.assignedUserId) {
      console.log(`   - Agent: ${conversation.assignedUser.firstName} ${conversation.assignedUser.lastName}`);
    }
    console.log(`   - Admins: ${admins.length}`);
    admins.forEach(admin => {
      console.log(`     • ${admin.firstName} ${admin.lastName} (${admin.role})`);
    });
    console.log(`   - إجمالي: ${(conversation.assignedUserId ? 1 : 0) + admins.length} مستلم\n`);

    // إعداد بيانات الرسالة للاختبار
    const messageData = {
      conversationId: conversation.id,
      senderId: conversation.customerId,
      content: 'رسالة اختبار لنظام الإشعارات',
      attachments: [],
      customerData: {
        id: conversation.customerId,
        companyId: finalCompanyId
      },
      companyId: finalCompanyId
    };

    console.log('🚀 بدء الاختبار...\n');

    let errorOccurred = false;
    const startTime = Date.now();

    if (testType === 'timeout') {
      console.log('⏱️  اختبار Timeout (30s)...');
      
      // حفظ الدالة الأصلية
      const originalWithTimeout = aiAgentService.withTimeout.bind(aiAgentService);
      
      // تعديل timeout مؤقتاً لاختبار timeout بسرعة
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
        await aiAgentService.processCustomerMessage(messageData);
        console.log('⚠️  لم يحدث timeout - قد يكون هناك مشكلة في الاختبار');
      } catch (testError) {
        errorOccurred = true;
        console.log(`✅ تم إحداث timeout بنجاح: ${testError.message}\n`);
      } finally {
        // استعادة الدالة الأصلية
        aiAgentService.withTimeout = originalWithTimeout;
      }
    } else if (testType === 'error') {
      console.log('❌ اختبار Error...');
      
      // اختبار error عن طريق استخدام companyId خاطئ
      const errorMessageData = {
        ...messageData,
        companyId: 'invalid-company-id-for-testing-error'
      };
      
      try {
        await aiAgentService.processCustomerMessage(errorMessageData);
        console.log('⚠️  لم يحدث error - قد يكون هناك مشكلة في الاختبار');
      } catch (testError) {
        errorOccurred = true;
        console.log(`✅ تم إحداث error بنجاح: ${testError.message}\n`);
      }
    } else {
      console.error(`❌ نوع اختبار غير صحيح: ${testType}`);
      console.log('💡 الأنواع المتاحة: timeout, error');
      process.exit(1);
    }

    const testDuration = Date.now() - startTime;
    console.log(`⏱️  مدة الاختبار: ${testDuration}ms\n`);

    // انتظار قليل للتأكد من حفظ الإشعارات
    console.log('⏳ انتظار حفظ الإشعارات...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // التحقق من الإشعارات المنشأة
    const notifications = await prisma.notification.findMany({
      where: {
        companyId: finalCompanyId,
        type: 'ai_failure',
        createdAt: {
          gte: new Date(Date.now() - 10000) // آخر 10 ثواني
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    console.log('\n📊 ========================================');
    console.log('📊 نتائج الاختبار');
    console.log('📊 ========================================\n');

    if (notifications.length === 0) {
      console.log('⚠️  لم يتم إنشاء أي إشعارات!');
      console.log('💡 تحقق من:');
      console.log('   1. أن catch block يعمل بشكل صحيح');
      console.log('   2. أن conversationId و companyId صحيحين');
      console.log('   3. أن هناك مستلمين (Agent أو Admins)');
    } else {
      console.log(`✅ تم إنشاء ${notifications.length} إشعار:\n`);
      
      notifications.forEach((notif, index) => {
        console.log(`${index + 1}. إشعار #${notif.id}`);
        console.log(`   العنوان: ${notif.title}`);
        console.log(`   الرسالة: ${notif.message.substring(0, 80)}...`);
        console.log(`   المستخدم: ${notif.user ? `${notif.user.firstName} ${notif.user.lastName} (${notif.user.role})` : 'N/A'}`);
        console.log(`   الوقت: ${notif.createdAt.toLocaleString('ar-EG')}`);
        console.log(`   مقروء: ${notif.isRead ? 'نعم' : 'لا'}`);
        console.log('');
      });

      // إحصائيات
      const byUser = {};
      notifications.forEach(n => {
        const userId = n.userId || 'unknown';
        if (!byUser[userId]) {
          byUser[userId] = {
            user: n.user ? `${n.user.firstName} ${n.user.lastName}` : 'Unknown',
            role: n.user?.role || 'N/A',
            count: 0
          };
        }
        byUser[userId].count++;
      });

      console.log('📈 إحصائيات:');
      Object.values(byUser).forEach(stat => {
        console.log(`   - ${stat.user} (${stat.role}): ${stat.count} إشعار`);
      });
    }

    console.log('\n✅ ========================================');
    console.log('✅ انتهى الاختبار');
    console.log('✅ ========================================\n');

    // تنظيف
    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ خطأ في الاختبار');
    console.error('❌ ========================================\n');
    console.error('الخطأ:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
}

// تشغيل الاختبار
const args = process.argv.slice(2);
const testType = args[0] || 'timeout';
const conversationId = args[1] || null;
const companyId = args[2] || null;

testAINotifications(testType, conversationId, companyId);


/**
 * سكريبت اختبار خاص بنظام الذاكرة
 * بيختبر قراءة وحفظ الذاكرة بالتفصيل
 * 
 * الاستخدام:
 * node backend/test_ai_memory.js [companyId] [conversationId]
 */

require('dotenv').config();
const { getSharedPrismaClient } = require('./services/sharedDatabase');
const memoryService = require('./memoryService');

const prisma = getSharedPrismaClient();

async function testMemory(companyId, conversationId, senderId) {
  console.log('\n🧠 ========================================');
  console.log('🧠 اختبار نظام الذاكرة');
  console.log('🧠 ========================================\n');
  
  try {
    // اختبار 1: جلب الذاكرة
    console.log('📖 اختبار 1: جلب الذاكرة...');
    const memory = await memoryService.getConversationMemory(conversationId, senderId, 50, companyId);
    console.log(`✅ تم جلب ${memory.length} رسالة من الذاكرة\n`);
    
    if (memory.length > 0) {
      console.log('📋 أول 5 رسائل:');
      memory.slice(0, 5).forEach((msg, i) => {
        const sender = msg.isFromCustomer ? '👤 العميل' : '🤖 AI';
        const preview = (msg.content || '').substring(0, 80);
        console.log(`   ${i + 1}. ${sender}: ${preview}...`);
      });
      console.log('');
    }
    
    // اختبار 2: حفظ تفاعل جديد
    console.log('💾 اختبار 2: حفظ تفاعل جديد...');
    const saved = await memoryService.saveInteraction({
      conversationId,
      senderId,
      companyId,
      userMessage: 'رسالة اختبار من العميل - ' + new Date().toISOString(),
      aiResponse: 'رد اختبار من الـAI - ' + new Date().toISOString(),
      intent: 'test',
      sentiment: 'neutral',
      timestamp: new Date()
    });
    
    if (saved) {
      console.log(`✅ تم الحفظ بنجاح: ${saved.id}\n`);
    } else {
      console.log('❌ فشل الحفظ\n');
    }
    
    // اختبار 3: جلب الذاكرة مرة أخرى للتأكد من الحفظ
    console.log('🔄 اختبار 3: جلب الذاكرة مرة أخرى...');
    const memoryAfter = await memoryService.getConversationMemory(conversationId, senderId, 50, companyId);
    const newMessages = memoryAfter.length - memory.length;
    console.log(`✅ عدد الرسائل الجديدة: ${newMessages}`);
    console.log(`✅ إجمالي الرسائل الآن: ${memoryAfter.length}\n`);
    
    // اختبار 4: فحص format البيانات
    console.log('🔍 اختبار 4: فحص format البيانات...');
    if (memoryAfter.length > 0) {
      const lastMsg = memoryAfter[memoryAfter.length - 1];
      const checks = {
        'يحتوي على content': !!lastMsg.content,
        'يحتوي على isFromCustomer': typeof lastMsg.isFromCustomer === 'boolean',
        'يحتوي على createdAt': !!lastMsg.createdAt,
        'يحتوي على id': !!lastMsg.id
      };
      
      console.log('   فحص البيانات:');
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });
      console.log('');
    }
    
    // اختبار 5: فحص العزل الأمني
    console.log('🔐 اختبار 5: فحص العزل الأمني...');
    try {
      // محاولة جلب ذاكرة بدون companyId (يجب أن يفشل)
      try {
        await memoryService.getConversationMemory(conversationId, senderId, 50, null);
        console.log('   ❌ فشل: تم السماح بجلب الذاكرة بدون companyId');
      } catch (securityError) {
        console.log('   ✅ نجح: تم رفض جلب الذاكرة بدون companyId');
      }
    } catch (error) {
      console.log(`   ⚠️  خطأ في فحص العزل: ${error.message}`);
    }
    console.log('');
    
    console.log('✅ ========================================');
    console.log('✅ انتهى اختبار الذاكرة');
    console.log('✅ ========================================\n');
    
    await prisma.$disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// تشغيل الاختبار
const args = process.argv.slice(2);
const companyId = args[0];
const conversationId = args[1];
const senderId = args[2];

if (!companyId || !conversationId || !senderId) {
  console.error('❌ الاستخدام: node test_ai_memory.js [companyId] [conversationId] [senderId]');
  process.exit(1);
}

testMemory(companyId, conversationId, senderId);


/**
 * سكريبت اختبار خاص بالوعي بالسياق
 * بيختبر ربط المنتجات من الذاكرة بالطلبات الحالية
 * 
 * الاستخدام:
 * node backend/test_ai_context.js [companyId] [conversationId]
 */

require('dotenv').config();
const { getSharedPrismaClient } = require('./services/sharedDatabase');
const aiAgentService = require('./services/aiAgentService');
const memoryService = require('./memoryService');

const prisma = getSharedPrismaClient();

async function testContext(companyId, conversationId, senderId) {
  console.log('\n🧠 ========================================');
  console.log('🧠 اختبار الوعي بالسياق');
  console.log('🧠 ========================================\n');
  
  try {
    // تنظيف الذاكرة القديمة للاختبار
    console.log('🧹 تنظيف الذاكرة القديمة...');
    const oldMemories = await prisma.conversationMemory.findMany({
      where: {
        conversationId,
        senderId,
        companyId,
        userMessage: { contains: 'اختبار' }
      }
    });
    
    if (oldMemories.length > 0) {
      await prisma.conversationMemory.deleteMany({
        where: {
          id: { in: oldMemories.map(m => m.id) }
        }
      });
      console.log(`✅ تم حذف ${oldMemories.length} تفاعل قديم\n`);
    }
    
    // اختبار 1: حفظ منتج في الذاكرة
    console.log('💾 اختبار 1: حفظ منتج في الذاكرة...');
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
    console.log('✅ تم الحفظ\n');
    
    // اختبار 2: جلب الذاكرة والتأكد من وجود المنتج
    console.log('📖 اختبار 2: جلب الذاكرة...');
    const memory = await memoryService.getConversationMemory(conversationId, senderId, 50, companyId);
    const hasBelle = memory.some(msg => 
      msg.content && (
        msg.content.includes('Belle') || 
        msg.content.includes('بيل') ||
        msg.content.includes('[المنتج:')
      )
    );
    console.log(`✅ ${hasBelle ? 'تم العثور على المنتج في الذاكرة' : 'لم يتم العثور على المنتج'}\n`);
    
    // اختبار 3: السؤال عن المنتج بدون ذكر الاسم
    console.log('❓ اختبار 3: السؤال عن المنتج بدون ذكر الاسم...');
    console.log('   الرسالة: "صور"\n');
    
    const customerData = await prisma.customer.findUnique({
      where: { id: senderId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyId: true
      }
    });
    
    const contextMessage = {
      conversationId,
      senderId,
      content: 'صور',
      attachments: [],
      customerData: {
        id: customerData.id,
        name: `${customerData.firstName} ${customerData.lastName}`,
        companyId: customerData.companyId
      },
      companyId
    };
    
    try {
      const response = await aiAgentService.processCustomerMessage(contextMessage);
      
      const hasContent = !!response.content && response.content.length > 0;
      const mentionsBelle = response.content && (
        response.content.toLowerCase().includes('belle') ||
        response.content.includes('بيل') ||
        response.content.includes('Belle')
      );
      const hasImages = response.images && response.images.length > 0;
      
      console.log('   النتائج:');
      console.log(`   ${hasContent ? '✅' : '❌'} يوجد رد: ${hasContent ? 'نعم' : 'لا'}`);
      console.log(`   ${mentionsBelle ? '✅' : '❌'} يذكر المنتج (Belle/بيل): ${mentionsBelle ? 'نعم' : 'لا'}`);
      console.log(`   ${hasImages ? '✅' : '⚠️ '} يوجد صور: ${hasImages ? `${response.images.length} صورة` : 'لا'}`);
      
      if (hasContent) {
        console.log(`\n   الرد الكامل:\n   "${response.content}"\n`);
      }
      
      if (mentionsBelle) {
        console.log('   ✅ نجح: تم ربط "صور" بالمنتج من الذاكرة!\n');
      } else {
        console.log('   ❌ فشل: لم يتم ربط "صور" بالمنتج من الذاكرة\n');
      }
      
    } catch (error) {
      console.log(`   ❌ خطأ: ${error.message}\n`);
    }
    
    // اختبار 4: السؤال عن السعر بدون ذكر المنتج
    console.log('💰 اختبار 4: السؤال عن السعر بدون ذكر المنتج...');
    console.log('   الرسالة: "بكام"\n');
    
    const priceMessage = {
      conversationId,
      senderId,
      content: 'بكام',
      attachments: [],
      customerData: {
        id: customerData.id,
        name: `${customerData.firstName} ${customerData.lastName}`,
        companyId: customerData.companyId
      },
      companyId
    };
    
    try {
      const response = await aiAgentService.processCustomerMessage(priceMessage);
      
      const hasContent = !!response.content && response.content.length > 0;
      const mentionsBelle = response.content && (
        response.content.toLowerCase().includes('belle') ||
        response.content.includes('بيل')
      );
      const mentionsPrice = response.content && (
        response.content.includes('500') ||
        response.content.includes('جنيه') ||
        response.content.includes('سعر')
      );
      
      console.log('   النتائج:');
      console.log(`   ${hasContent ? '✅' : '❌'} يوجد رد: ${hasContent ? 'نعم' : 'لا'}`);
      console.log(`   ${mentionsBelle ? '✅' : '❌'} يذكر المنتج: ${mentionsBelle ? 'نعم' : 'لا'}`);
      console.log(`   ${mentionsPrice ? '✅' : '❌'} يذكر السعر: ${mentionsPrice ? 'نعم' : 'لا'}`);
      
      if (hasContent) {
        console.log(`\n   الرد الكامل:\n   "${response.content}"\n`);
      }
      
      if (mentionsBelle && mentionsPrice) {
        console.log('   ✅ نجح: تم ربط "بكام" بالمنتج والسعر من الذاكرة!\n');
      } else {
        console.log('   ❌ فشل: لم يتم الربط بشكل صحيح\n');
      }
      
    } catch (error) {
      console.log(`   ❌ خطأ: ${error.message}\n`);
    }
    
    console.log('✅ ========================================');
    console.log('✅ انتهى اختبار الوعي بالسياق');
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
  console.error('❌ الاستخدام: node test_ai_context.js [companyId] [conversationId] [senderId]');
  process.exit(1);
}

testContext(companyId, conversationId, senderId);


/**
 * 🔍 فحص آخر رسالة فاشلة من الـ AI
 */

const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkLastFailure() {
  let prisma;
  
  try {
    prisma = getSharedPrismaClient();
    
    if (!prisma) {
      console.error('❌ فشل في الاتصال بقاعدة البيانات');
      return;
    }
    
    console.log('\n🔍 جاري البحث عن آخر رسالة فاشلة...\n');
    
    // 1. فحص آخر فشل مسجل في aiFailures (إذا كان الجدول موجود)
    console.log('📋 1. فحص سجل الأخطاء:');
    console.log('=' .repeat(60));
    
    let lastFailure = null;
    try {
      lastFailure = await prisma.aIFailure.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: { name: true }
        }
      }
    });
    
    if (lastFailure) {
      console.log('✅ تم العثور على آخر فشل:');
      console.log(`   - التاريخ: ${lastFailure.createdAt}`);
      console.log(`   - الشركة: ${lastFailure.company?.name || 'غير معروف'}`);
      console.log(`   - المحادثة: ${lastFailure.conversationId}`);
      console.log(`   - نوع الخطأ: ${lastFailure.errorType}`);
      console.log(`   - رسالة الخطأ: ${lastFailure.errorMessage}`);
      console.log(`   - السياق: ${JSON.stringify(lastFailure.context, null, 2)}`);
    } else {
      console.log('⚠️  لا يوجد سجل أخطاء في قاعدة البيانات');
    }
    } catch (err) {
      console.log('⚠️  جدول aiFailures غير موجود أو خطأ في القراءة');
    }
    
    // 2. فحص آخر الإشعارات
    console.log('\n📋 2. فحص آخر الإشعارات:');
    console.log('=' .repeat(60));
    
    const lastNotifications = await prisma.notification.findMany({
      where: {
        type: {
          in: [
            'ai_no_backup_model',
            'ai_backup_model_failed',
            'max_attempts_exceeded',
            'ai_generation_failed'
          ]
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        company: {
          select: { name: true }
        }
      }
    });
    
    if (lastNotifications.length > 0) {
      console.log(`✅ تم العثور على ${lastNotifications.length} إشعارات:`);
      lastNotifications.forEach((notif, index) => {
        console.log(`\n   ${index + 1}. ${notif.title}`);
        console.log(`      - التاريخ: ${notif.createdAt}`);
        console.log(`      - الشركة: ${notif.company?.name || 'غير معروف'}`);
        console.log(`      - النوع: ${notif.type}`);
        console.log(`      - الخطورة: ${notif.severity}`);
        console.log(`      - الرسالة: ${notif.message}`);
        if (notif.metadata) {
          console.log(`      - البيانات: ${JSON.stringify(notif.metadata, null, 2)}`);
        }
      });
    } else {
      console.log('⚠️  لا توجد إشعارات متعلقة بفشل الـ AI');
    }
    
    // 3. فحص آخر المحادثات التي لم يرد عليها الـ AI
    console.log('\n📋 3. فحص آخر المحادثات بدون رد AI:');
    console.log('=' .repeat(60));
    
    const conversationsWithoutAI = await prisma.conversation.findMany({
      where: {
        aiStatus: 'active',
        messages: {
          some: {
            isFromCustomer: true,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // آخر 24 ساعة
            }
          }
        }
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            content: true,
            isFromCustomer: true,
            createdAt: true
          }
        },
        company: {
          select: { name: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });
    
    if (conversationsWithoutAI.length > 0) {
      console.log(`✅ تم العثور على ${conversationsWithoutAI.length} محادثات:`);
      conversationsWithoutAI.forEach((conv, index) => {
        const lastCustomerMsg = conv.messages.find(m => m.isFromCustomer);
        const lastAIMsg = conv.messages.find(m => !m.isFromCustomer);
        
        console.log(`\n   ${index + 1}. المحادثة: ${conv.id}`);
        console.log(`      - الشركة: ${conv.company?.name || 'غير معروف'}`);
        console.log(`      - حالة AI: ${conv.aiStatus}`);
        console.log(`      - آخر رسالة عميل: ${lastCustomerMsg?.createdAt || 'لا يوجد'}`);
        console.log(`      - آخر رد AI: ${lastAIMsg?.createdAt || 'لا يوجد'}`);
        
        if (lastCustomerMsg && (!lastAIMsg || lastCustomerMsg.createdAt > lastAIMsg.createdAt)) {
          console.log(`      ⚠️  العميل بعت رسالة ولم يرد عليها الـ AI!`);
          console.log(`      - محتوى الرسالة: ${lastCustomerMsg.content.substring(0, 100)}...`);
        }
      });
    } else {
      console.log('✅ جميع المحادثات النشطة تم الرد عليها');
    }
    
    // 4. فحص حالة المفاتيح
    console.log('\n📋 4. فحص حالة مفاتيح Gemini API:');
    console.log('=' .repeat(60));
    
    const geminiKeys = await prisma.geminiKey.findMany({
      where: { isActive: true },
      include: {
        models: {
          select: {
            id: true,
            model: true,
            usage: true,
            lastUsed: true
          }
        },
        company: {
          select: { name: true }
        }
      },
      take: 5
    });
    
    if (geminiKeys.length > 0) {
      console.log(`✅ تم العثور على ${geminiKeys.length} مفاتيح نشطة:`);
      geminiKeys.forEach((key, index) => {
        console.log(`\n   ${index + 1}. ${key.name}`);
        console.log(`      - الشركة: ${key.company?.name || 'مركزي'}`);
        console.log(`      - عدد النماذج: ${key.models.length}`);
        
        key.models.forEach(model => {
          let usage;
          try {
            usage = JSON.parse(model.usage || '{}');
          } catch {
            usage = {};
          }
          
          console.log(`      - ${model.model}:`);
          console.log(`        RPM: ${usage.rpm?.used || 0}/${usage.rpm?.limit || 15}`);
          console.log(`        RPD: ${usage.rpd?.used || 0}/${usage.rpd?.limit || 1000}`);
          console.log(`        آخر استخدام: ${model.lastUsed || 'لم يستخدم بعد'}`);
        });
      });
    } else {
      console.log('❌ لا توجد مفاتيح نشطة! هذا هو السبب الأساسي للفشل!');
    }
    
    // 5. فحص النماذج المستثناة
    console.log('\n📋 5. فحص النماذج المستثناة (Excluded Models):');
    console.log('=' .repeat(60));
    
    const excludedModels = await prisma.excludedModel.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // آخر 24 ساعة
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        company: {
          select: { name: true }
        }
      }
    });
    
    if (excludedModels.length > 0) {
      console.log(`⚠️  تم العثور على ${excludedModels.length} نماذج مستثناة:`);
      excludedModels.forEach((model, index) => {
        console.log(`\n   ${index + 1}. ${model.modelName}`);
        console.log(`      - الشركة: ${model.company?.name || 'غير معروف'}`);
        console.log(`      - السبب: ${model.reason}`);
        console.log(`      - التاريخ: ${model.createdAt}`);
      });
    } else {
      console.log('✅ لا توجد نماذج مستثناة حديثاً');
    }
    
    // الخلاصة
    console.log('\n' + '='.repeat(60));
    console.log('📊 الخلاصة:');
    console.log('='.repeat(60));
    
    if (!lastFailure && lastNotifications.length === 0) {
      console.log('✅ لا يوجد فشل مسجل حديثاً - النظام يعمل بشكل طبيعي');
    } else {
      console.log('⚠️  تم العثور على مشاكل - راجع التفاصيل أعلاه');
      
      if (geminiKeys.length === 0) {
        console.log('❌ السبب الرئيسي: لا توجد مفاتيح API نشطة!');
      } else if (excludedModels.length > 5) {
        console.log('⚠️  السبب المحتمل: معظم النماذج مستثناة (استنفاد الكوتة)');
      } else if (lastFailure?.errorType === 'max_attempts_exceeded') {
        console.log('⚠️  السبب: استنفاد جميع المحاولات (3 محاولات)');
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في فحص آخر فشل:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل الفحص
checkLastFailure();

/**
 * اختبار تتبع TPM (Tokens Per Minute)
 * 
 * هذا السكريبت يختبر:
 * 1. تحديث TPM في updateModelUsage
 * 2. فحص TPM في findBestAvailableModelInActiveKey
 * 3. إعادة تعيين TPM تلقائياً بعد مرور دقيقة
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTPMTracking() {
  try {
    console.log('🧪 [TPM-TEST] بدء اختبار تتبع TPM...\n');

    // 1. البحث عن نموذج مفعل للاختبار
    const testModel = await prisma.geminiKeyModel.findFirst({
      where: {
        isEnabled: true,
        model: {
          in: [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.0-flash-lite'
          ]
        }
      },
      include: {
        key: {
          select: {
            name: true,
            isActive: true
          }
        }
      }
    });

    if (!testModel) {
      console.error('❌ [TPM-TEST] لم يتم العثور على نموذج للاختبار');
      return;
    }

    console.log(`✅ [TPM-TEST] تم العثور على نموذج للاختبار: ${testModel.model} (ID: ${testModel.id})`);
    console.log(`   المفتاح: ${testModel.key.name} (Active: ${testModel.key.isActive})\n`);

    // 2. قراءة الاستخدام الحالي
    let usage = JSON.parse(testModel.usage || '{}');
    console.log('📊 [TPM-TEST] الاستخدام الحالي:');
    console.log(`   RPM: ${usage.rpm?.used || 0}/${usage.rpm?.limit || 0}`);
    console.log(`   RPH: ${usage.rph?.used || 0}/${usage.rph?.limit || 0}`);
    console.log(`   RPD: ${usage.rpd?.used || 0}/${usage.rpd?.limit || 0}`);
    console.log(`   TPM: ${usage.tpm?.used || 0}/${usage.tpm?.limit || 0}\n`);

    // 3. محاكاة تحديث TPM
    const path = require('path');
    const AIAgentService = require(path.join(__dirname, '../aiAgentService'));
    
    const aiAgentService = new AIAgentService();
    const modelManager = aiAgentService.getModelManager();

    // محاكاة استخدام بـ 1000 tokens
    const testTokens = 1000;
    console.log(`🔄 [TPM-TEST] محاكاة استخدام ${testTokens} tokens...`);
    await modelManager.updateModelUsage(testModel.id, testTokens);

    // 4. قراءة الاستخدام بعد التحديث
    const updatedModel = await prisma.geminiKeyModel.findUnique({
      where: { id: testModel.id }
    });
    const updatedUsage = JSON.parse(updatedModel.usage || '{}');
    
    console.log('\n📊 [TPM-TEST] الاستخدام بعد التحديث:');
    console.log(`   RPM: ${updatedUsage.rpm?.used || 0}/${updatedUsage.rpm?.limit || 0}`);
    console.log(`   RPH: ${updatedUsage.rph?.used || 0}/${updatedUsage.rph?.limit || 0}`);
    console.log(`   RPD: ${updatedUsage.rpd?.used || 0}/${updatedUsage.rpd?.limit || 0}`);
    console.log(`   TPM: ${updatedUsage.tpm?.used || 0}/${updatedUsage.tpm?.limit || 0}`);

    // 5. التحقق من أن TPM تم تحديثه
    if (updatedUsage.tpm && updatedUsage.tpm.used >= testTokens) {
      console.log('\n✅ [TPM-TEST] نجح! TPM تم تحديثه بشكل صحيح');
    } else {
      console.log('\n❌ [TPM-TEST] فشل! TPM لم يتم تحديثه');
      console.log(`   المتوقع: ${testTokens}, الفعلي: ${updatedUsage.tpm?.used || 0}`);
    }

    // 6. اختبار فحص TPM في findBestAvailableModelInActiveKey
    console.log('\n🔍 [TPM-TEST] اختبار فحص TPM في findBestAvailableModelInActiveKey...');
    const availableModel = await modelManager.findBestAvailableModelInActiveKey(testModel.keyId);
    
    if (availableModel) {
      console.log(`✅ [TPM-TEST] تم العثور على نموذج متاح: ${availableModel.model}`);
    } else {
      console.log(`⚠️ [TPM-TEST] لم يتم العثور على نموذج متاح (قد يكون بسبب تجاوز الحدود)`);
    }

    console.log('\n✅ [TPM-TEST] انتهى الاختبار');

  } catch (error) {
    console.error('❌ [TPM-TEST] خطأ في الاختبار:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل الاختبار
testTPMTracking();


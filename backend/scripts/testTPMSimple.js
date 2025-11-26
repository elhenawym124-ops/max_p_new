/**
 * اختبار بسيط لتتبع TPM
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTPM() {
  try {
    console.log('🧪 [TPM-TEST] بدء اختبار تتبع TPM...\n');

    // 1. البحث عن نموذج مفعل
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
      }
    });

    if (!testModel) {
      console.error('❌ [TPM-TEST] لم يتم العثور على نموذج للاختبار');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ [TPM-TEST] تم العثور على نموذج: ${testModel.model} (ID: ${testModel.id})\n`);

    // 2. قراءة الاستخدام الحالي
    let usage = {};
    try {
      usage = JSON.parse(testModel.usage || '{}');
    } catch (e) {
      console.warn('⚠️ [TPM-TEST] خطأ في تحليل JSON:', e.message);
      usage = {};
    }

    console.log('📊 [TPM-TEST] الاستخدام الحالي:');
    console.log(`   RPM: ${usage.rpm?.used || 0}/${usage.rpm?.limit || 0}`);
    console.log(`   RPH: ${usage.rph?.used || 0}/${usage.rph?.limit || 0}`);
    console.log(`   RPD: ${usage.rpd?.used || 0}/${usage.rpd?.limit || 0}`);
    console.log(`   TPM: ${usage.tpm?.used || 0}/${usage.tpm?.limit || 0}\n`);

    // 3. محاكاة تحديث TPM يدوياً
    const now = new Date();
    const testTokens = 1000;
    
    // تحديث TPM
    const tpmWindowMs = 60 * 1000; // 1 دقيقة
    let tpm = usage.tpm || { used: 0, limit: 125000, windowStart: null };
    
    if (!tpm.windowStart || (now - new Date(tpm.windowStart)) >= tpmWindowMs) {
      tpm = { 
        used: testTokens, 
        limit: tpm.limit || 125000, 
        windowStart: now.toISOString() 
      };
    } else {
      tpm.used = (tpm.used || 0) + testTokens;
    }

    // تحديث في قاعدة البيانات
    const newUsage = {
      ...usage,
      tpm
    };

    await prisma.geminiKeyModel.update({
      where: { id: testModel.id },
      data: {
        usage: JSON.stringify(newUsage),
        updatedAt: now
      }
    });

    console.log(`🔄 [TPM-TEST] تم تحديث TPM بـ ${testTokens} tokens\n`);

    // 4. قراءة الاستخدام بعد التحديث
    const updatedModel = await prisma.geminiKeyModel.findUnique({
      where: { id: testModel.id }
    });
    const updatedUsage = JSON.parse(updatedModel.usage || '{}');
    
    console.log('📊 [TPM-TEST] الاستخدام بعد التحديث:');
    console.log(`   RPM: ${updatedUsage.rpm?.used || 0}/${updatedUsage.rpm?.limit || 0}`);
    console.log(`   RPH: ${updatedUsage.rph?.used || 0}/${updatedUsage.rph?.limit || 0}`);
    console.log(`   RPD: ${updatedUsage.rpd?.used || 0}/${updatedUsage.rpd?.limit || 0}`);
    console.log(`   TPM: ${updatedUsage.tpm?.used || 0}/${updatedUsage.tpm?.limit || 0}`);

    // 5. التحقق
    if (updatedUsage.tpm && updatedUsage.tpm.used >= testTokens) {
      console.log('\n✅ [TPM-TEST] نجح! TPM تم تحديثه بشكل صحيح');
      console.log(`   ✅ TPM: ${updatedUsage.tpm.used}/${updatedUsage.tpm.limit}`);
      console.log(`   ✅ Window Start: ${updatedUsage.tpm.windowStart}`);
    } else {
      console.log('\n❌ [TPM-TEST] فشل! TPM لم يتم تحديثه');
      console.log(`   المتوقع: ${testTokens}, الفعلي: ${updatedUsage.tpm?.used || 0}`);
    }

    console.log('\n✅ [TPM-TEST] انتهى الاختبار');

  } catch (error) {
    console.error('❌ [TPM-TEST] خطأ:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testTPM();


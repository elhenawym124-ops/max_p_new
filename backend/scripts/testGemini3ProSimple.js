/**
 * اختبار بسيط وسريع لنموذج gemini-3-pro
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

async function testGemini3Pro() {
    const prisma = getSharedPrismaClient();
    
    try {
        console.log('\n🧪 اختبار gemini-3-pro...\n');

        // الحصول على مفتاح مركزي
        const key = await prisma.geminiKey.findFirst({
            where: { keyType: 'CENTRAL', isActive: true },
            orderBy: { priority: 'asc' }
        });

        if (!key) {
            console.error('❌ لا يوجد مفتاح مركزي');
            return;
        }

        console.log(`✅ المفتاح: ${key.name.substring(0, 20)}...`);

        const genAI = new GoogleGenerativeAI(key.apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-pro' });

        console.log('📤 إرسال طلب...');
        const result = await model.generateContent('Say "OK"');
        const response = result.response.text();

        console.log('\n✅ ✅ ✅ النموذج يعمل!\n');
        console.log(`📥 الرد: ${response.substring(0, 50)}...\n`);

    } catch (error) {
        console.error('\n❌ ❌ ❌ فشل الاختبار\n');
        console.error(`الخطأ: ${error.message}\n`);

        if (error.message?.includes('404') || error.message?.includes('not found')) {
            console.error('⚠️ النموذج غير متوفر (404) - يجب إبقاؤه معطلاً\n');
        }
    } finally {
        await prisma.$disconnect();
    }
}

testGemini3Pro();


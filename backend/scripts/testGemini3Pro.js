/**
 * اختبار نموذج gemini-3-pro للتأكد من أنه متوفر في API
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini3Pro() {
    try {
        console.log('\n🔍 ========== اختبار نموذج gemini-3-pro ==========\n');

        // الحصول على مفتاح مركزي للاختبار
        const { getSharedPrismaClient } = require('../services/sharedDatabase');
        const prisma = getSharedPrismaClient();

        const centralKey = await prisma.geminiKey.findFirst({
            where: {
                keyType: 'CENTRAL',
                companyId: null,
                isActive: true
            },
            orderBy: { priority: 'asc' }
        });

        if (!centralKey) {
            console.error('❌ لا يوجد مفتاح مركزي نشط للاختبار');
            await prisma.$disconnect();
            return;
        }

        console.log(`✅ تم العثور على مفتاح مركزي: ${centralKey.name}`);
        console.log(`🔑 API Key: ${centralKey.apiKey.substring(0, 20)}...\n`);

        // اختبار نموذج gemini-3-pro
        console.log('🧪 اختبار نموذج: gemini-3-pro\n');

        const genAI = new GoogleGenerativeAI(centralKey.apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-3-pro'
        });

        console.log('📤 إرسال طلب اختبار بسيط...\n');

        const prompt = 'Hello! Please respond with just "OK" to confirm you are working.';
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ النموذج يعمل بشكل صحيح!');
        console.log(`📥 الرد: ${text.substring(0, 100)}...\n`);

        console.log('✅ ========== النموذج متوفر ويعمل ==========\n');

    } catch (error) {
        console.error('\n❌ ========== فشل الاختبار ==========\n');
        console.error(`❌ الخطأ: ${error.message}\n`);

        // فحص نوع الخطأ
        if (error.message?.includes('404') || error.message?.includes('not found')) {
            console.error('⚠️ النموذج غير متوفر في API (404 Not Found)');
            console.error('💡 يجب إبقاء النموذج في قائمة المعطلة\n');
        } else if (error.message?.includes('403') || error.message?.includes('permission')) {
            console.error('⚠️ خطأ في الصلاحيات (403) - قد يكون المفتاح لا يدعم هذا النموذج\n');
        } else if (error.message?.includes('429') || error.message?.includes('quota')) {
            console.error('⚠️ تجاوز الحد المسموح (429) - المشكلة في المفتاح وليس النموذج\n');
        } else {
            console.error('⚠️ خطأ غير معروف\n');
        }
    } finally {
        const { getSharedPrismaClient } = require('../services/sharedDatabase');
        const prisma = getSharedPrismaClient();
        await prisma.$disconnect();
    }
}

testGemini3Pro();


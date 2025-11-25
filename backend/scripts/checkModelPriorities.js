/**
 * فحص أولويات النماذج في المفاتيح المركزية
 */

const { getSharedPrismaClient } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();

async function checkPriorities() {
    try {
        console.log('\n🔍 ========== فحص أولويات النماذج ==========\n');

        // جلب المفاتيح المركزية النشطة
        const centralKeys = await prisma.geminiKey.findMany({
            where: {
                keyType: 'CENTRAL',
                companyId: null,
                isActive: true
            },
            include: {
                models: {
                    where: {
                        isEnabled: true
                    },
                    orderBy: {
                        priority: 'asc'
                    }
                }
            },
            orderBy: { priority: 'asc' },
            take: 3
        });

        console.log(`📋 تم العثور على ${centralKeys.length} مفتاح مركزي نشط\n`);

        for (const key of centralKeys) {
            console.log(`🔑 المفتاح: ${key.name} (Priority: ${key.priority})`);
            console.log(`   النماذج المفعلة (مرتبة حسب الأولوية):\n`);
            
            key.models.forEach((model, index) => {
                try {
                    const usage = JSON.parse(model.usage || '{}');
                    const currentUsage = usage.used || 0;
                    const limit = usage.limit || 1000000;
                    const available = currentUsage < limit;
                    const status = available ? '✅ متاح' : '❌ مستنفد';
                    
                    console.log(`   ${index + 1}. ${model.model}`);
                    console.log(`      - Priority: ${model.priority}`);
                    console.log(`      - Status: ${status} (${currentUsage}/${limit})`);
                    console.log(`      - Enabled: ${model.isEnabled ? '✅' : '❌'}`);
                    console.log('');
                } catch (e) {
                    console.log(`   ${index + 1}. ${model.model} (Error: ${e.message})`);
                }
            });
            
            console.log(`   ✅ النموذج الذي سيُستخدم: ${key.models[0]?.model || 'لا يوجد'}`);
            console.log('');
        }

        // فحص أولويات النماذج من الكود
        console.log('📋 أولويات النماذج من الكود (adminGeminiKeysController.js):\n');
        const expectedPriorities = [
            { model: 'gemini-3-pro', priority: 1 },
            { model: 'gemini-2.5-pro', priority: 2 },
            { model: 'gemini-2.5-flash', priority: 3 },
            { model: 'gemini-2.5-flash-lite', priority: 4 },
            { model: 'gemini-2.5-flash-tts', priority: 5 },
            { model: 'gemini-2.0-flash', priority: 6 },
            { model: 'gemini-2.0-flash-lite', priority: 7 },
            { model: 'gemini-2.5-flash-live', priority: 8 },
            { model: 'gemini-2.0-flash-live', priority: 9 },
            { model: 'gemini-2.5-flash-native-audio-dialog', priority: 10 },
            { model: 'gemini-1.5-pro', priority: 11 },
            { model: 'gemini-1.5-flash', priority: 12 }
        ];

        expectedPriorities.forEach(({ model, priority }) => {
            console.log(`   ${priority}. ${model}`);
        });

        console.log('\n✅ ========== انتهى الفحص ==========\n');

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkPriorities();


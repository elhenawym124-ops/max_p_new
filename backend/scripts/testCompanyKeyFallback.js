/**
 * اختبار fallback للمفاتيح المركزية لشركة "شركة التسويق"
 */

const { getSharedPrismaClient } = require('../services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

async function testFallback() {
    try {
        console.log('\n🔍 ========== اختبار Fallback للمفاتيح المركزية ==========\n');

        // 1. البحث عن الشركة
        const company = await getSharedPrismaClient().company.findFirst({
            where: {
                OR: [
                    { name: { contains: 'التسويق' } },
                    { name: { contains: 'تسويق' } }
                ]
            }
        });

        if (!company) {
            console.log('❌ لم يتم العثور على الشركة');
            return;
        }

        console.log(`✅ الشركة: ${company.name}`);
        console.log(`   ID: ${company.id}`);
        console.log(`   useCentralKeys: ${company.useCentralKeys}\n`);

        // 2. محاكاة المنطق الموجود في getActiveGeminiKey
        console.log('📋 الخطوة 1: البحث عن مفاتيح الشركة...');
        const companyKeys = await getSharedPrismaClient().geminiKey.findMany({
            where: {
                isActive: true,
                companyId: company.id,
                keyType: 'COMPANY'
            }
        });
        console.log(`   النتيجة: ${companyKeys.length} مفتاح\n`);

        // 3. إذا لم توجد مفاتيح شركة، جرب المفاتيح المركزية
        if (companyKeys.length === 0) {
            console.log('📋 الخطوة 2: البحث عن المفاتيح المركزية (Fallback)...');
            
            const centralKeys = await getSharedPrismaClient().geminiKey.findMany({
                where: {
                    keyType: 'CENTRAL',
                    companyId: null,
                    isActive: true
                },
                orderBy: { priority: 'asc' }
            });

            console.log(`   النتيجة: ${centralKeys.length} مفتاح مركزي نشط\n`);

            if (centralKeys.length > 0) {
                console.log('📋 الخطوة 3: البحث عن نموذج متاح في المفاتيح المركزية...');
                
                for (const centralKey of centralKeys) {
                    const models = await getSharedPrismaClient().geminiKeyModel.findMany({
                        where: {
                            keyId: centralKey.id,
                            isEnabled: true
                        },
                        orderBy: { priority: 'asc' },
                        take: 5
                    });

                    console.log(`   المفتاح: ${centralKey.name} - ${models.length} نموذج مفعل`);
                    
                    for (const model of models) {
                        try {
                            const usage = JSON.parse(model.usage || '{}');
                            const rpm = usage.rpm || {};
                            const rph = usage.rph || {};
                            const rpd = usage.rpd || {};
                            
                            console.log(`      - ${model.model}`);
                            console.log(`        RPM: ${rpm.used || 0}/${rpm.limit || 0} (windowStart: ${rpm.windowStart || 'null'})`);
                            console.log(`        RPH: ${rph.used || 0}/${rph.limit || 0} (windowStart: ${rph.windowStart || 'null'})`);
                            console.log(`        RPD: ${rpd.used || 0}/${rpd.limit || 0} (windowStart: ${rpd.windowStart || 'null'})`);
                            console.log(`        Total: ${usage.used || 0}/${usage.limit || 0}`);
                            
                            // التحقق من Rate Limits
                            const now = new Date();
                            let available = true;
                            
                            // RPM Check
                            if (rpm.limit > 0 && rpm.windowStart) {
                                const windowStart = new Date(rpm.windowStart);
                                const elapsed = now - windowStart;
                                if (elapsed < 60000 && (rpm.used || 0) >= rpm.limit) {
                                    console.log(`        ❌ RPM متجاوز`);
                                    available = false;
                                }
                            }
                            
                            // RPH Check
                            if (rph.limit > 0 && rph.windowStart) {
                                const windowStart = new Date(rph.windowStart);
                                const elapsed = now - windowStart;
                                if (elapsed < 3600000 && (rph.used || 0) >= rph.limit) {
                                    console.log(`        ❌ RPH متجاوز`);
                                    available = false;
                                }
                            }
                            
                            // RPD Check
                            if (rpd.limit > 0 && rpd.windowStart) {
                                const windowStart = new Date(rpd.windowStart);
                                const elapsed = now - windowStart;
                                if (elapsed < 86400000 && (rpd.used || 0) >= rpd.limit) {
                                    console.log(`        ❌ RPD متجاوز`);
                                    available = false;
                                }
                            }
                            
                            if (available) {
                                console.log(`        ✅ النموذج متاح للاستخدام`);
                                console.log('');
                                console.log(`✅ ✅ ✅ SUCCESS: يمكن استخدام المفتاح المركزي "${centralKey.name}" مع النموذج "${model.model}"`);
                                return;
                            }
                            
                        } catch (e) {
                            console.log(`      - ${model.model} (Error: ${e.message})`);
                        }
                        console.log('');
                    }
                }
            }
        }

        console.log('\n❌ ❌ ❌ FAILED: لم يتم العثور على نموذج متاح\n');

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await getSharedPrismaClient().$disconnect();
    }
}

testFallback();



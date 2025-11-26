/**
 * اختبار جميع النماذج المفعلة
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

// النماذج التي تم تفعيلها مؤخراً
const modelsToTest = [
    'gemini-3-pro-preview',
    'gemini-2.0-flash-exp',
    'gemma-3-27b',
    'gemma-3-12b',
    'gemma-3-4b',
    'gemma-3-2b',
    'gemma-3-1b'
];

async function testModel(apiKey, modelName) {
    const apiVersions = ['v1beta', 'v1alpha', 'v1'];
    const isNewModel = modelName.includes('3') || modelName.includes('2.5') || modelName.includes('2.0') || modelName.includes('gemma');
    const versionsToTry = isNewModel ? ['v1beta', 'v1alpha', 'v1'] : ['v1', 'v1beta', 'v1alpha'];
    
    let lastError = null;
    
    for (const apiVersion of versionsToTry) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                ...(apiVersion !== 'v1' ? { apiVersion } : {})
            });
            
            const prompt = 'Say "Hello" in one word only.';
            const startTime = Date.now();
            const result = await model.generateContent(prompt, {
                timeout: 20000
            });
            const endTime = Date.now();
            
            const response = await result.response;
            const text = response.text();
            
            return {
                success: true,
                message: '✅ يعمل',
                response: text.trim().substring(0, 50),
                apiVersion: apiVersion === 'v1' ? 'v1 (افتراضي)' : apiVersion,
                responseTime: endTime - startTime,
                tokens: response.usageMetadata?.totalTokenCount || 0
            };
        } catch (error) {
            lastError = error;
            const statusCode = error.response?.status || error.status;
            
            // إذا كان 429، لا نحاول إصدارات أخرى
            if (statusCode === 429) {
                return {
                    success: false,
                    message: '❌ تجاوز الحد (429)',
                    statusCode: 429,
                    details: 'Rate limit exceeded - المفتاح تجاوز الحد المسموح',
                    apiVersion: apiVersion === 'v1' ? 'v1 (افتراضي)' : apiVersion
                };
            }
            
            // إذا كان 404، جرب إصدار API التالي
            if (statusCode === 404) {
                continue;
            }
            
            // للأخطاء الأخرى، جرب إصدار API التالي
            continue;
        }
    }
    
    return {
        success: false,
        message: '❌ خطأ',
        errorCode: lastError?.code,
        statusCode: lastError?.response?.status || lastError?.status,
        details: lastError?.message || 'Unknown error',
        triedVersions: versionsToTry
    };
}

async function testAllModels() {
    const prisma = getSharedPrismaClient();
    
    try {
        console.log('\n🧪 اختبار النماذج المفعلة...\n');
        
        // جلب أول مفتاح مركزي نشط
        const centralKey = await prisma.geminiKey.findFirst({
            where: {
                keyType: 'CENTRAL',
                isActive: true
            },
            orderBy: {
                priority: 'asc'
            }
        });
        
        if (!centralKey) {
            console.log('❌ لم يتم العثور على مفتاح مركزي نشط');
            return;
        }
        
        console.log(`🔑 استخدام المفتاح: ${centralKey.name} (ID: ${centralKey.id})\n`);
        console.log('='.repeat(100));
        console.log(`${'النموذج'.padEnd(35)} | ${'الحالة'.padEnd(25)} | ${'API Version'.padEnd(15)} | ${'الوقت'.padEnd(10)} | ${'Tokens'}`);
        console.log('='.repeat(100));
        
        const results = [];
        
        for (const modelName of modelsToTest) {
            process.stdout.write(`🔍 اختبار ${modelName.padEnd(30)}... `);
            
            const result = await testModel(centralKey.apiKey, modelName);
            
            const status = result.success ? result.message : result.message;
            const apiVersion = result.apiVersion || 'N/A';
            const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
            const tokens = result.tokens || 'N/A';
            
            console.log(status);
            if (result.success) {
                console.log(`   ${apiVersion.padEnd(15)} | ${responseTime.padEnd(10)} | ${tokens}`);
                console.log(`   Response: ${result.response}`);
            } else {
                console.log(`   ${apiVersion.padEnd(15)} | ${result.statusCode || 'N/A'}`);
                if (result.details) {
                    console.log(`   ${result.details.substring(0, 80)}`);
                }
            }
            console.log('');
            
            results.push({
                model: modelName,
                ...result
            });
            
            // انتظار قليل بين الاختبارات
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        console.log('='.repeat(100));
        console.log('\n📊 ملخص النتائج:\n');
        
        const working = results.filter(r => r.success);
        const rateLimited = results.filter(r => !r.success && r.statusCode === 429);
        const notWorking = results.filter(r => !r.success && r.statusCode !== 429);
        
        console.log(`✅ نماذج تعمل: ${working.length}/${modelsToTest.length}`);
        working.forEach(r => {
            console.log(`   - ${r.model} (${r.apiVersion}) - ${r.responseTime}ms`);
        });
        
        if (rateLimited.length > 0) {
            console.log(`\n⚠️ نماذج متوفرة لكن تجاوزت الحد (429): ${rateLimited.length}`);
            rateLimited.forEach(r => {
                console.log(`   - ${r.model} (متوفر لكن المفتاح تجاوز الحد)`);
            });
        }
        
        if (notWorking.length > 0) {
            console.log(`\n❌ نماذج لا تعمل: ${notWorking.length}`);
            notWorking.forEach(r => {
                console.log(`   - ${r.model}: ${r.statusCode || r.errorCode || r.details}`);
            });
        }
        
        console.log('\n');
        
        // عرض إحصائيات
        if (working.length > 0) {
            const avgTime = working.reduce((sum, r) => sum + (r.responseTime || 0), 0) / working.length;
            const totalTokens = working.reduce((sum, r) => sum + (r.tokens || 0), 0);
            console.log('📈 إحصائيات:');
            console.log(`   - متوسط وقت الاستجابة: ${Math.round(avgTime)}ms`);
            console.log(`   - إجمالي Tokens المستخدمة: ${totalTokens}`);
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ خطأ عام:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testAllModels();


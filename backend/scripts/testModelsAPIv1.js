/**
 * اختبار النماذج مع v1 API (ليس v1beta فقط)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

const modelsToTest = [
    'gemini-3-pro',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-tts',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-live',
    'gemini-2.0-flash-live',
    'gemini-2.5-flash-native-audio-dialog',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-robotics-er-1.5-preview',
    'learnlm-2.0-flash-experimental',
    'gemma-3-27b',
    'gemma-3-12b',
    'gemma-3-4b',
    'gemma-3-2b'
];

async function testModel(apiKey, modelName, apiVersion = 'v1') {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // محاولة استخدام API version المحدد
        const model = genAI.getGenerativeModel({ 
            model: modelName
            // لا نحدد apiVersion - سيستخدم v1 افتراضياً
        });
        
        // محاولة استدعاء بسيط
        const prompt = 'Say "Hello" in one word only.';
        const result = await model.generateContent(prompt, {
            timeout: 10000 // 10 ثواني
        });
        
        const response = await result.response;
        const text = response.text();
        
        return {
            success: true,
            message: '✅ يعمل',
            response: text.trim().substring(0, 50),
            apiVersion: apiVersion
        };
    } catch (error) {
        return {
            success: false,
            message: `❌ خطأ: ${error.message}`,
            errorCode: error.code,
            statusCode: error.response?.status,
            details: error.message
        };
    }
}

async function testAllModels() {
    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
    
    try {
        console.log('\n🧪 اختبار جميع النماذج مع v1 API (الافتراضي)...\n');
        
        // جلب أول مفتاح مركزي نشط
        const centralKey = await getSharedPrismaClient().geminiKey.findFirst({
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
        console.log(`${'النموذج'.padEnd(40)} | ${'v1 API'.padEnd(30)} | ${'التفاصيل'.padEnd(40)}`);
        console.log('='.repeat(100));
        
        const results = [];
        
        for (const modelName of modelsToTest) {
            process.stdout.write(`🔍 اختبار ${modelName}... `);
            
            const result = await testModel(centralKey.apiKey, modelName, 'v1');
            
            const status = result.success ? result.message : result.message;
            const details = result.success 
                ? `${result.apiVersion || 'v1'}` 
                : `${result.statusCode || ''} - ${result.errorCode || result.details?.substring(0, 30) || 'unknown'}`;
            
            console.log(status);
            console.log(`   ${details}`);
            
            results.push({
                model: modelName,
                ...result
            });
            
            // انتظار قليل بين الاختبارات
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('\n' + '='.repeat(100));
        console.log('\n📊 ملخص النتائج:\n');
        
        const working = results.filter(r => r.success);
        const notWorking = results.filter(r => !r.success);
        
        console.log(`✅ نماذج تعمل مع v1 API: ${working.length}`);
        working.forEach(r => {
            console.log(`   - ${r.model}`);
        });
        
        console.log(`\n❌ نماذج لا تعمل مع v1 API: ${notWorking.length}`);
        notWorking.forEach(r => {
            console.log(`   - ${r.model}: ${r.statusCode || r.errorCode || r.details?.substring(0, 50)}`);
        });
        
        // تحليل الأخطاء
        const error404 = notWorking.filter(r => r.statusCode === 404);
        const error403 = notWorking.filter(r => r.statusCode === 403);
        const error400 = notWorking.filter(r => r.statusCode === 400);
        const otherErrors = notWorking.filter(r => 
            r.statusCode !== 404 && r.statusCode !== 403 && r.statusCode !== 400
        );
        
        if (error404.length > 0) {
            console.log(`\n⚠️ نماذج غير متوفرة (404): ${error404.length}`);
            error404.forEach(r => console.log(`   - ${r.model}`));
        }
        
        if (error403.length > 0) {
            console.log(`\n⚠️ نماذج محظورة (403): ${error403.length}`);
            error403.forEach(r => console.log(`   - ${r.model}`));
        }
        
        if (error400.length > 0) {
            console.log(`\n⚠️ نماذج بخطأ في الطلب (400): ${error400.length}`);
            error400.forEach(r => console.log(`   - ${r.model}`));
        }
        
        if (otherErrors.length > 0) {
            console.log(`\n⚠️ أخطاء أخرى: ${otherErrors.length}`);
            otherErrors.forEach(r => {
                console.log(`   - ${r.model}: ${r.statusCode || r.errorCode || r.details?.substring(0, 50)}`);
            });
        }
        
        console.log('\n💡 ملاحظة: هذا الاختبار يستخدم v1 API (الافتراضي)');
        console.log('   إذا كانت النماذج تعمل هنا ولكن لا تعمل مع v1beta، يجب استخدام v1 بدلاً منها\n');
        
    } catch (error) {
        console.error('❌ خطأ عام:', error.message);
        console.error(error.stack);
    } finally {
        await getSharedPrismaClient().$disconnect();
    }
}

testAllModels();




















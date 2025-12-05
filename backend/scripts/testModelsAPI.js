/**
 * اختبار النماذج فعلياً من خلال API
 * 
 * بناءً على الوثائق الرسمية:
 * - API Reference: https://ai.google.dev/api
 * - Gemini 3 Guide: https://ai.google.dev/gemini-api/docs/gemini-3
 * 
 * ملاحظات مهمة:
 * - النماذج الجديدة (2.5, 2.0, 3) تستخدم v1beta في الـ endpoint
 * - الـ endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * - gemini-3-pro-preview هو النموذج الصحيح لـ Gemini 3 (وليس gemini-3-pro)
 * - SDK @google/generative-ai يتعامل مع هذه التفاصيل تلقائياً
 * - Gemini 3 يستخدم thinking_level (low/high) بدلاً من thinking_budget
 * - Temperature يجب أن يكون 1.0 (الافتراضي) لـ Gemini 3
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

const modelsToTest = [
    // ✅ Gemini 3 (النماذج الجديدة - تستخدم v1beta)
    'gemini-3-pro-preview',            // ✅ الاسم الفعلي في API (من الوثائق الرسمية)
    'gemini-3-pro',                     // ✅ قد يكون متوفر في بعض المناطق
    
    // ✅ Gemini 2.5 & 2.0 (تستخدم v1beta)
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-tts',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash-live',
    'gemini-2.0-flash-live',
    'gemini-2.5-flash-native-audio-dialog',
    
    // ✅ نماذج أخرى
    'gemini-robotics-er-1.5-preview',
    'learnlm-2.0-flash-experimental',
    
    // ✅ Gemma 3 Models
    'gemma-3-27b',
    'gemma-3-12b',
    'gemma-3-4b',
    'gemma-3-2b',
    'gemma-3-1b'
];

async function testModel(apiKey, modelName) {
    // ✅ قائمة بإصدارات API للاختبار (من الأحدث للأقدم)
    const apiVersions = ['v1beta', 'v1alpha', 'v1'];
    
    // ✅ للنماذج الجديدة (Gemini 3, 2.5, 2.0)، نبدأ بـ v1beta أولاً
    // بناءً على الوثائق: https://ai.google.dev/gemini-api/docs/gemini-3
    // - gemini-3-pro-preview يستخدم v1beta
    // - media_resolution يحتاج v1alpha (لكن نحن نختبر v1beta أولاً)
    const isNewModel = modelName.includes('3') || modelName.includes('2.5') || modelName.includes('2.0');
    const versionsToTry = isNewModel ? ['v1beta', 'v1alpha', 'v1'] : ['v1', 'v1beta', 'v1alpha'];
    
    let lastError = null;
    
    for (const apiVersion of versionsToTry) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            
            // ✅ محاولة مع apiVersion محدد
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                ...(apiVersion !== 'v1' ? { apiVersion } : {}) // v1 هو الافتراضي، لا حاجة لتحديده
            });
            
            const prompt = 'Say "Hello" in one word only.';
            const result = await model.generateContent(prompt, {
                timeout: 10000
            });
            
            const response = await result.response;
            const text = response.text();
            
            return {
                success: true,
                message: '✅ يعمل',
                response: text.trim().substring(0, 50),
                apiVersion: apiVersion === 'v1' ? 'v1 (افتراضي)' : apiVersion
            };
        } catch (error) {
            lastError = error;
            // ✅ الاستمرار في المحاولة مع إصدار API التالي
            continue;
        }
    }
    
    // ✅ إذا فشلت جميع المحاولات
    return {
        success: false,
        message: `❌ خطأ`,
        errorCode: lastError?.code,
        statusCode: lastError?.response?.status || lastError?.status,
        details: lastError?.message || 'Unknown error',
        triedVersions: versionsToTry
    };
}

async function testAllModels() {
    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
    
    try {
        console.log('\n🧪 اختبار جميع النماذج...\n');
        
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
        console.log(`${'النموذج'.padEnd(40)} | ${'الحالة'.padEnd(30)} | ${'التفاصيل'.padEnd(40)}`);
        console.log('='.repeat(100));
        
        const results = [];
        
        for (const modelName of modelsToTest) {
            process.stdout.write(`🔍 اختبار ${modelName}... `);
            
            const result = await testModel(centralKey.apiKey, modelName);
            
            const status = result.success ? result.message : result.message;
            const details = result.success 
                ? `${result.apiVersion || 'unknown'}` 
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
        
        console.log(`✅ نماذج تعمل: ${working.length}`);
        working.forEach(r => {
            console.log(`   - ${r.model}`);
        });
        
        console.log(`\n❌ نماذج لا تعمل: ${notWorking.length}`);
        notWorking.forEach(r => {
            console.log(`   - ${r.model}: ${r.statusCode || r.errorCode || r.details}`);
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
                console.log(`   - ${r.model}: ${r.statusCode || r.errorCode || r.details}`);
            });
        }
        
        console.log('\n');
        
    } catch (error) {
        console.error('❌ خطأ عام:', error.message);
        console.error(error.stack);
    } finally {
        await getSharedPrismaClient().$disconnect();
    }
}

testAllModels();



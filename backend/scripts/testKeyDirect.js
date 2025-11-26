/**
 * اختبار مباشر لمفتاح API مع النماذج الجديدة
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ✅ المفتاح الجديد للاختبار
const API_KEY = 'AIzaSyABpe0IADxKZ_2AGsJU9NfQavFUnBXlijQ';

const modelsToTest = [
    // ✅ Gemini 3 (بناءً على القائمة الرسمية والوثائق)
    'gemini-3-pro-preview',            // ✅ الاسم الفعلي في API (من الوثائق الرسمية)
    'gemini-3-pro',                     // ✅ قد يكون متوفر في بعض المناطق
    
    // ✅ Gemini 2.5 & 2.0
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-tts',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-exp',
    
    // ✅ Live API Models
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
    const apiVersions = ['v1beta', 'v1alpha', 'v1'];
    const isNewModel = modelName.includes('3') || modelName.includes('2.5') || modelName.includes('2.0');
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
            const result = await model.generateContent(prompt, {
                timeout: 15000
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
            const statusCode = error.response?.status || error.status;
            const errorMessage = error.message || 'Unknown error';
            
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
    try {
        console.log('\n🧪 اختبار المفتاح المباشر مع النماذج الجديدة...\n');
        console.log(`🔑 المفتاح: ${API_KEY.substring(0, 20)}...\n`);
        console.log('='.repeat(100));
        console.log(`${'النموذج'.padEnd(45)} | ${'الحالة'.padEnd(25)} | ${'التفاصيل'.padEnd(40)}`);
        console.log('='.repeat(100));
        
        const results = [];
        
        for (const modelName of modelsToTest) {
            process.stdout.write(`🔍 اختبار ${modelName.padEnd(40)}... `);
            
            const result = await testModel(API_KEY, modelName);
            
            const status = result.success ? result.message : result.message;
            const details = result.success 
                ? `${result.apiVersion || 'unknown'}` 
                : `${result.statusCode || ''} - ${result.details?.substring(0, 35) || 'unknown'}`;
            
            console.log(status);
            console.log(`   ${details}`);
            
            results.push({
                model: modelName,
                ...result
            });
            
            // انتظار قليل بين الاختبارات
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n' + '='.repeat(100));
        console.log('\n📊 ملخص النتائج:\n');
        
        const working = results.filter(r => r.success);
        const rateLimited = results.filter(r => r.statusCode === 429);
        const notWorking = results.filter(r => !r.success && r.statusCode !== 429);
        
        console.log(`✅ نماذج تعمل: ${working.length}`);
        working.forEach(r => {
            console.log(`   - ${r.model} (${r.apiVersion})`);
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
        
    } catch (error) {
        console.error('❌ خطأ عام:', error.message);
        console.error(error.stack);
    }
}

testAllModels();


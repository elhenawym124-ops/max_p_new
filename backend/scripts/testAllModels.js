/**
 * اختبار جميع نماذج Gemini للتحقق من توفرها
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = 'AIzaSyABpe0IADxKZ_2AGsJU9NfQavFUnBXlijQ';

// جميع النماذج المحتملة
const allModels = [
    // نماذج Pro
    'gemini-3-pro',
    'gemini-2.5-pro',
    'gemini-2.5-pro-preview-05-06',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-pro',
    
    // نماذج Flash
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-flash',
    
    // نماذج Live API
    'gemini-2.5-flash-live',
    'gemini-2.0-flash-live',
    'gemini-2.5-flash-native-audio-dialog',
    
    // نماذج الصوت
    'gemini-2.5-flash-tts',
    
    // نماذج متخصصة
    'gemini-robotics-er-1.5-preview',
    'learnlm-2.0-flash-experimental',
    
    // نماذج Gemma
    'gemma-3-27b',
    'gemma-3-12b',
    'gemma-3-4b',
    'gemma-3-2b',
    'gemma-2-27b-it',
    'gemma-2-9b-it',
    
    // نماذج أخرى
    'gemini-exp-1206',
    'gemini-2.0-flash-thinking-exp',
    'gemini-2.0-flash-exp'
];

async function testModel(modelName) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('قل مرحبا');
        const response = result.response;
        const text = response.text();
        
        return {
            model: modelName,
            status: '✅ يعمل',
            response: text.substring(0, 50) + '...'
        };
    } catch (error) {
        let errorType = 'خطأ غير معروف';
        
        if (error.message.includes('404') || error.message.includes('not found')) {
            errorType = '❌ 404 - النموذج غير موجود';
        } else if (error.message.includes('429') || error.message.includes('quota')) {
            errorType = '⚠️ 429 - تجاوز الحد';
        } else if (error.message.includes('403') || error.message.includes('permission')) {
            errorType = '🚫 403 - غير مصرح';
        } else if (error.message.includes('400')) {
            errorType = '❌ 400 - طلب غير صالح';
        } else if (error.message.includes('503')) {
            errorType = '⚠️ 503 - الخدمة غير متاحة مؤقتاً';
        }
        
        return {
            model: modelName,
            status: errorType,
            error: error.message.substring(0, 100)
        };
    }
}

async function testAllModels() {
    console.log('🔍 بدء اختبار جميع النماذج...\n');
    console.log('='.repeat(80));
    
    const results = {
        working: [],
        notFound: [],
        quotaExceeded: [],
        forbidden: [],
        other: []
    };
    
    for (const modelName of allModels) {
        console.log(`\n🧪 اختبار: ${modelName}`);
        const result = await testModel(modelName);
        
        console.log(`   النتيجة: ${result.status}`);
        if (result.response) {
            console.log(`   الرد: ${result.response}`);
        }
        
        // تصنيف النتائج
        if (result.status.includes('✅')) {
            results.working.push(modelName);
        } else if (result.status.includes('404')) {
            results.notFound.push(modelName);
        } else if (result.status.includes('429')) {
            results.quotaExceeded.push(modelName);
        } else if (result.status.includes('403')) {
            results.forbidden.push(modelName);
        } else {
            results.other.push({ model: modelName, error: result.error });
        }
        
        // انتظار قليل بين الطلبات لتجنب rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // طباعة الملخص
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 ملخص النتائج:\n');
    
    console.log('✅ النماذج التي تعمل:');
    if (results.working.length > 0) {
        results.working.forEach(m => console.log(`   - ${m}`));
    } else {
        console.log('   لا يوجد');
    }
    
    console.log('\n❌ النماذج غير الموجودة (404):');
    if (results.notFound.length > 0) {
        results.notFound.forEach(m => console.log(`   - ${m}`));
    } else {
        console.log('   لا يوجد');
    }
    
    console.log('\n⚠️ النماذج التي تجاوزت الحد (429):');
    if (results.quotaExceeded.length > 0) {
        results.quotaExceeded.forEach(m => console.log(`   - ${m}`));
    } else {
        console.log('   لا يوجد');
    }
    
    console.log('\n🚫 النماذج غير المصرح بها (403):');
    if (results.forbidden.length > 0) {
        results.forbidden.forEach(m => console.log(`   - ${m}`));
    } else {
        console.log('   لا يوجد');
    }
    
    console.log('\n❓ أخطاء أخرى:');
    if (results.other.length > 0) {
        results.other.forEach(r => console.log(`   - ${r.model}: ${r.error}`));
    } else {
        console.log('   لا يوجد');
    }
    
    // طباعة القائمة النهائية للنماذج المدعومة
    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 القائمة النهائية للنماذج المدعومة (للاستخدام في modelManager.js):');
    console.log('\ngetSupportedModels() {');
    console.log('  return [');
    results.working.forEach(m => console.log(`    '${m}',`));
    console.log('  ];');
    console.log('}');
    
    return results;
}

// تشغيل الاختبار
testAllModels()
    .then(() => {
        console.log('\n✅ انتهى الاختبار');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ خطأ:', err);
        process.exit(1);
    });

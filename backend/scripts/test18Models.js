/**
 * اختبار الـ 18 نموذج المُعرّفة في النظام
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = 'AIzaSyABpe0IADxKZ_2AGsJU9NfQavFUnBXlijQ';

// الـ 18 نموذج المُعرّفة في adminGeminiKeysController.js
const systemModels = [
    // 🧠 نماذج Pro (الأذكى)
    { model: 'gemini-3-pro', priority: 1, category: 'Pro' },
    { model: 'gemini-2.5-pro', priority: 2, category: 'Pro' },
    { model: 'gemini-1.5-pro', priority: 3, category: 'Pro' },
    
    // ⚡ نماذج Flash (سريعة وذكية)
    { model: 'gemini-2.5-flash', priority: 4, category: 'Flash' },
    { model: 'gemini-2.5-flash-lite', priority: 5, category: 'Flash' },
    { model: 'gemini-1.5-flash', priority: 6, category: 'Flash' },
    { model: 'gemini-2.0-flash', priority: 7, category: 'Flash' },
    { model: 'gemini-2.0-flash-lite', priority: 8, category: 'Flash' },
    
    // 🔴 نماذج Live API
    { model: 'gemini-2.5-flash-live', priority: 9, category: 'Live' },
    { model: 'gemini-2.0-flash-live', priority: 10, category: 'Live' },
    { model: 'gemini-2.5-flash-native-audio-dialog', priority: 11, category: 'Live' },
    
    // 🎤 نماذج الصوت
    { model: 'gemini-2.5-flash-tts', priority: 12, category: 'Audio' },
    
    // 🔬 نماذج متخصصة
    { model: 'learnlm-2.0-flash-experimental', priority: 13, category: 'Specialized' },
    { model: 'gemini-robotics-er-1.5-preview', priority: 14, category: 'Specialized' },
    
    // 💎 نماذج Gemma
    { model: 'gemma-3-27b', priority: 15, category: 'Gemma' },
    { model: 'gemma-3-12b', priority: 16, category: 'Gemma' },
    { model: 'gemma-3-4b', priority: 17, category: 'Gemma' },
    { model: 'gemma-3-2b', priority: 18, category: 'Gemma' }
];

// إضافة نماذج preview للاختبار
const additionalModels = [
    { model: 'gemini-3-pro-preview', priority: 0, category: 'Pro Preview' },
    { model: 'gemini-2.5-pro-preview-05-06', priority: 0, category: 'Pro Preview' },
];

const allModels = [...additionalModels, ...systemModels];

async function testModel(modelInfo) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    try {
        const model = genAI.getGenerativeModel({ model: modelInfo.model });
        const result = await model.generateContent('Hi');
        const text = result.response.text();
        
        return {
            ...modelInfo,
            status: 'FREE_TIER_WORKS',
            statusIcon: '✅',
            statusText: 'يعمل مجاناً',
            response: text.substring(0, 30)
        };
    } catch (error) {
        const errorMsg = error.message || '';
        
        // تحليل نوع الخطأ
        if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('is not found')) {
            return {
                ...modelInfo,
                status: 'NOT_FOUND',
                statusIcon: '❌',
                statusText: 'غير موجود (404)',
                error: 'Model not found'
            };
        }
        
        if (errorMsg.includes('429')) {
            // تحليل إذا كان بسبب عدم وجود free tier أو تجاوز الحد
            if (errorMsg.includes('limit: 0') || errorMsg.includes('FreeTier')) {
                return {
                    ...modelInfo,
                    status: 'NO_FREE_TIER',
                    statusIcon: '💰',
                    statusText: 'مدفوع فقط (لا يوجد Free Tier)',
                    error: 'No free tier - requires billing'
                };
            }
            return {
                ...modelInfo,
                status: 'QUOTA_EXCEEDED',
                statusIcon: '⚠️',
                statusText: 'تجاوز الحد (قد يعمل لاحقاً)',
                error: 'Quota exceeded'
            };
        }
        
        if (errorMsg.includes('403')) {
            return {
                ...modelInfo,
                status: 'FORBIDDEN',
                statusIcon: '🚫',
                statusText: 'غير مصرح',
                error: 'Access forbidden'
            };
        }
        
        if (errorMsg.includes('400')) {
            return {
                ...modelInfo,
                status: 'BAD_REQUEST',
                statusIcon: '❓',
                statusText: 'طلب غير صالح',
                error: errorMsg.substring(0, 100)
            };
        }
        
        return {
            ...modelInfo,
            status: 'OTHER_ERROR',
            statusIcon: '❓',
            statusText: 'خطأ آخر',
            error: errorMsg.substring(0, 100)
        };
    }
}

async function testAllModels() {
    console.log('🔍 اختبار الـ 18 نموذج + نماذج Preview...\n');
    console.log('='.repeat(100));
    
    const results = [];
    
    for (const modelInfo of allModels) {
        process.stdout.write(`\n🧪 [${modelInfo.priority}] ${modelInfo.model.padEnd(40)} `);
        const result = await testModel(modelInfo);
        results.push(result);
        console.log(`${result.statusIcon} ${result.statusText}`);
        
        // انتظار قليل بين الطلبات
        await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // تصنيف النتائج
    const categories = {
        FREE_TIER_WORKS: { title: '✅ يعمل مجاناً (Free Tier)', items: [] },
        NO_FREE_TIER: { title: '💰 مدفوع فقط (لا يوجد Free Tier)', items: [] },
        QUOTA_EXCEEDED: { title: '⚠️ تجاوز الحد (قد يعمل)', items: [] },
        NOT_FOUND: { title: '❌ غير موجود (404)', items: [] },
        FORBIDDEN: { title: '🚫 غير مصرح (403)', items: [] },
        OTHER_ERROR: { title: '❓ أخطاء أخرى', items: [] }
    };
    
    results.forEach(r => {
        if (categories[r.status]) {
            categories[r.status].items.push(r);
        }
    });
    
    // طباعة الملخص
    console.log('\n\n' + '='.repeat(100));
    console.log('\n📊 ملخص النتائج:\n');
    
    Object.values(categories).forEach(cat => {
        if (cat.items.length > 0) {
            console.log(`\n${cat.title}:`);
            cat.items.forEach(item => {
                console.log(`   [${item.priority}] ${item.model} (${item.category})`);
            });
        }
    });
    
    // طباعة التوصيات
    console.log('\n\n' + '='.repeat(100));
    console.log('\n🎯 التوصيات:\n');
    
    const workingModels = categories.FREE_TIER_WORKS.items;
    if (workingModels.length > 0) {
        console.log('النماذج التي يجب استخدامها في getSupportedModels():');
        console.log('\ngetSupportedModels() {');
        console.log('  return [');
        workingModels.forEach(m => console.log(`    '${m.model}', // ${m.category}`));
        console.log('  ];');
        console.log('}');
    }
    
    const paidModels = categories.NO_FREE_TIER.items;
    if (paidModels.length > 0) {
        console.log('\n\n⚠️ النماذج المدفوعة (يجب إضافتها لـ getDisabledModels أو تفعيل Billing):');
        paidModels.forEach(m => console.log(`   - ${m.model}`));
    }
    
    const notFoundModels = categories.NOT_FOUND.items;
    if (notFoundModels.length > 0) {
        console.log('\n\n❌ النماذج غير الموجودة (يجب إزالتها من النظام):');
        notFoundModels.forEach(m => console.log(`   - ${m.model}`));
    }
    
    return results;
}

// تشغيل الاختبار
testAllModels()
    .then(() => {
        console.log('\n\n✅ انتهى الاختبار');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ خطأ:', err);
        process.exit(1);
    });

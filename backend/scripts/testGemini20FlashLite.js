/**
 * اختبار نموذج Gemini 2.0 Flash Lite
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

const MODEL_NAME = 'gemini-2.0-flash-lite';

async function testGemini20FlashLite() {
    const prisma = getSharedPrismaClient();
    
    try {
        console.log('\n🧪 اختبار Gemini 2.0 Flash Lite...\n');
        
        // استخدام المفتاح الجديد مباشرة
        const API_KEY = 'AIzaSyABpe0IADxKZ_2AGsJU9NfQavFUnBXlijQ';
        
        console.log(`🔑 استخدام المفتاح: ${API_KEY.substring(0, 20)}...\n`);
        console.log('='.repeat(80));
        
        // ✅ تجربة إصدارات API المختلفة
        const apiVersions = ['v1beta', 'v1alpha', 'v1'];
        let success = false;
        let lastError = null;
        let usedApiVersion = null;
        
        for (const apiVersion of apiVersions) {
            try {
                console.log(`\n🔍 محاولة مع ${apiVersion}...`);
                
                const genAI = new GoogleGenerativeAI(API_KEY);
                const model = genAI.getGenerativeModel({ 
                    model: MODEL_NAME,
                    ...(apiVersion !== 'v1' ? { apiVersion } : {})
                });
                
                // اختبار بسيط
                const prompt = 'Say "Hello from Gemini 2.0 Flash Lite" in one sentence.';
                console.log(`📝 Prompt: "${prompt}"`);
                
                const startTime = Date.now();
                const result = await model.generateContent(prompt, {
                    timeout: 20000
                });
                const endTime = Date.now();
                
                const response = await result.response;
                const text = response.text();
                
                console.log(`\n✅ نجح مع ${apiVersion}!`);
                console.log(`⏱️  الوقت المستغرق: ${endTime - startTime}ms`);
                console.log(`📤 Response: ${text.trim()}`);
                console.log(`\n📊 معلومات الاستجابة:`);
                console.log(`   - Finish Reason: ${response.candidates?.[0]?.finishReason || 'N/A'}`);
                if (response.usageMetadata) {
                    console.log(`   - Prompt Tokens: ${response.usageMetadata.promptTokenCount || 0}`);
                    console.log(`   - Candidates Tokens: ${response.usageMetadata.candidatesTokenCount || 0}`);
                    console.log(`   - Total Tokens: ${response.usageMetadata.totalTokenCount || 0}`);
                }
                
                success = true;
                usedApiVersion = apiVersion;
                break;
                
            } catch (error) {
                lastError = error;
                const statusCode = error.response?.status || error.status;
                const errorMessage = error.message || 'Unknown error';
                
                console.log(`\n❌ فشل مع ${apiVersion}`);
                console.log(`   Status: ${statusCode || 'N/A'}`);
                console.log(`   Error: ${errorMessage.substring(0, 150)}`);
                
                if (statusCode === 429) {
                    console.log(`\n⚠️ Rate Limit Exceeded - المفتاح تجاوز الحد المسموح`);
                    console.log(`   الحل: استخدام مفتاح آخر أو الانتظار حتى يتم إعادة تعيين الحد`);
                    break; // لا نحاول إصدارات أخرى عند 429
                }
                
                if (statusCode === 404) {
                    console.log(`   ⚠️ النموذج غير متوفر في ${apiVersion}، جرب إصدار آخر...`);
                    continue; // جرب إصدار API التالي
                }
                
                if (statusCode === 400) {
                    console.log(`   ⚠️ خطأ في الطلب (400) - قد يكون النموذج يحتاج parameters خاصة`);
                    continue; // جرب إصدار API التالي
                }
                
                // للأخطاء الأخرى، جرب إصدار API التالي
                continue;
            }
        }
        
        console.log('\n' + '='.repeat(80));
        
        if (success) {
            console.log(`\n✅ النتيجة: Gemini 2.0 Flash Lite يعمل بنجاح!`);
            console.log(`   API Version المستخدم: ${usedApiVersion}`);
            console.log(`\n💡 ملاحظة: هذا نموذج خفيف وسريع - مناسب للمهام البسيطة`);
        } else {
            console.log('\n❌ النتيجة: فشل الاختبار');
            if (lastError) {
                const statusCode = lastError.response?.status || lastError.status;
                if (statusCode === 429) {
                    console.log('   السبب: تجاوز حد الاستخدام (Rate Limit)');
                    console.log('   الحل: استخدام مفتاح آخر أو الانتظار');
                } else if (statusCode === 404) {
                    console.log('   السبب: النموذج غير متوفر في API');
                    console.log('   ملاحظة: قد يكون متوفر فقط في مناطق معينة');
                } else if (statusCode === 400) {
                    console.log('   السبب: خطأ في الطلب (400)');
                } else {
                    console.log(`   السبب: ${lastError.message || 'Unknown error'}`);
                }
            }
        }
        
        console.log('\n');
        
    } catch (error) {
        console.error('❌ خطأ عام:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testGemini20FlashLite();


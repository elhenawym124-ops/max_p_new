/**
 * اختبار نموذج Gemini 3 Pro Preview
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

const MODEL_NAME = 'gemini-3-pro-preview';

async function testGemini3Pro() {
    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
    
    try {
        console.log('\n🧪 اختبار Gemini 3 Pro Preview...\n');
        
        // استخدام المفتاح الجديد مباشرة
        const API_KEY = 'AIzaSyABpe0IADxKZ_2AGsJU9NfQavFUnBXlijQ';
        
        console.log(`🔑 استخدام المفتاح الجديد: ${API_KEY.substring(0, 20)}...\n`);
        console.log('='.repeat(80));
        
        // ✅ تجربة إصدارات API المختلفة
        const apiVersions = ['v1beta', 'v1alpha', 'v1'];
        let success = false;
        let lastError = null;
        
        for (const apiVersion of apiVersions) {
            try {
                console.log(`\n🔍 محاولة مع ${apiVersion}...`);
                
                const genAI = new GoogleGenerativeAI(API_KEY);
                const model = genAI.getGenerativeModel({ 
                    model: MODEL_NAME,
                    ...(apiVersion !== 'v1' ? { apiVersion } : {})
                });
                
                // اختبار بسيط
                const prompt = 'Say "Hello from Gemini 3" in one sentence.';
                console.log(`📝 Prompt: "${prompt}"`);
                
                const result = await model.generateContent(prompt, {
                    timeout: 20000
                });
                
                const response = await result.response;
                const text = response.text();
                
                console.log(`\n✅ نجح مع ${apiVersion}!`);
                console.log(`📤 Response: ${text.trim()}`);
                console.log(`\n📊 معلومات الاستجابة:`);
                console.log(`   - Finish Reason: ${response.candidates?.[0]?.finishReason || 'N/A'}`);
                console.log(`   - Usage Metadata:`, JSON.stringify(response.usageMetadata || {}, null, 2));
                
                success = true;
                break;
                
            } catch (error) {
                lastError = error;
                const statusCode = error.response?.status || error.status;
                const errorMessage = error.message || 'Unknown error';
                
                console.log(`\n❌ فشل مع ${apiVersion}`);
                console.log(`   Status: ${statusCode || 'N/A'}`);
                console.log(`   Error: ${errorMessage.substring(0, 100)}`);
                
                if (statusCode === 429) {
                    console.log(`\n⚠️ Rate Limit Exceeded - المفتاح تجاوز الحد المسموح`);
                    console.log(`   الحل: استخدام مفتاح آخر أو الانتظار حتى يتم إعادة تعيين الحد`);
                    break; // لا نحاول إصدارات أخرى عند 429
                }
                
                if (statusCode === 404) {
                    console.log(`   ⚠️ النموذج غير متوفر في ${apiVersion}، جرب إصدار آخر...`);
                    continue; // جرب إصدار API التالي
                }
                
                // للأخطاء الأخرى، جرب إصدار API التالي
                continue;
            }
        }
        
        console.log('\n' + '='.repeat(80));
        
        if (success) {
            console.log('\n✅ النتيجة: Gemini 3 Pro Preview يعمل!');
        } else {
            console.log('\n❌ النتيجة: فشل الاختبار');
            if (lastError) {
                const statusCode = lastError.response?.status || lastError.status;
                if (statusCode === 429) {
                    console.log('   السبب: تجاوز حد الاستخدام (Rate Limit)');
                    console.log('   الحل: استخدام مفتاح آخر أو الانتظار');
                } else if (statusCode === 404) {
                    console.log('   السبب: النموذج غير متوفر');
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
        await getSharedPrismaClient().$disconnect();
    }
}

testGemini3Pro();


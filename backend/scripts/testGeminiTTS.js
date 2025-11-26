/**
 * اختبار نموذج Gemini 2.5 Flash TTS
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

const MODEL_NAME = 'gemini-2.5-flash-tts';

async function testGeminiTTS() {
    const prisma = getSharedPrismaClient();
    
    try {
        console.log('\n🧪 اختبار Gemini 2.5 Flash TTS...\n');
        
        // استخدام المفتاح الجديد مباشرة
        const API_KEY = 'AIzaSyABpe0IADxKZ_2AGsJU9NfQavFUnBXlijQ';
        
        console.log(`🔑 استخدام المفتاح: ${API_KEY.substring(0, 20)}...\n`);
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
                const prompt = 'Say "Hello from Gemini TTS" in one sentence.';
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
                if (response.usageMetadata) {
                    console.log(`   - Prompt Tokens: ${response.usageMetadata.promptTokenCount || 0}`);
                    console.log(`   - Candidates Tokens: ${response.usageMetadata.candidatesTokenCount || 0}`);
                    console.log(`   - Total Tokens: ${response.usageMetadata.totalTokenCount || 0}`);
                }
                
                // ✅ فحص إذا كان هناك audio data في الاستجابة
                if (response.candidates?.[0]?.content?.parts) {
                    const parts = response.candidates[0].content.parts;
                    const audioParts = parts.filter(p => p.inlineData && p.inlineData.mimeType?.includes('audio'));
                    if (audioParts.length > 0) {
                        console.log(`\n🎵 Audio Data Found: ${audioParts.length} audio part(s)`);
                        audioParts.forEach((part, idx) => {
                            console.log(`   - Audio ${idx + 1}: ${part.inlineData.mimeType}, Size: ${part.inlineData.data?.length || 0} bytes`);
                        });
                    }
                }
                
                success = true;
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
            console.log('\n✅ النتيجة: Gemini 2.5 Flash TTS يعمل!');
            console.log('\n💡 ملاحظة: هذا النموذج مخصص لـ Text-to-Speech');
            console.log('   قد يحتاج parameters خاصة لإنشاء audio output');
        } else {
            console.log('\n❌ النتيجة: فشل الاختبار');
            if (lastError) {
                const statusCode = lastError.response?.status || lastError.status;
                if (statusCode === 429) {
                    console.log('   السبب: تجاوز حد الاستخدام (Rate Limit)');
                    console.log('   الحل: استخدام مفتاح آخر أو الانتظار');
                } else if (statusCode === 404) {
                    console.log('   السبب: النموذج غير متوفر في API');
                    console.log('   ملاحظة: قد يحتاج إعدادات خاصة أو قد يكون متوفر فقط في مناطق معينة');
                } else if (statusCode === 400) {
                    console.log('   السبب: خطأ في الطلب (400)');
                    console.log('   ملاحظة: قد يحتاج النموذج parameters خاصة لـ TTS');
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

testGeminiTTS();


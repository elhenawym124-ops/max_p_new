/**
 * اسكربت اختبار قواعد الاستجابة
 * يرسل رسالة تجريبية ويتحقق من استخدام القواعد
 */

const https = require('https');
const http = require('http');

// إعدادات الاختبار
const TEST_CONFIG = {
  baseURL: 'http://localhost:3000',
  conversationId: 'cmij92o3q0051ufgkiwkdqu7z', // من الـ logs السابقة
  senderId: 'cmhs6dvdj0009ufi8qp4szj1z',
  companyId: 'cmem8ayyr004cufakqkcsyn97',
  testMessage: 'مرحبا، عايز أعرف أسعار المنتجات المتاحة'
};

async function testResponseRules() {
  console.log('🧪 [TEST] بدء اختبار قواعد الاستجابة...');
  console.log('📝 [TEST] الرسالة التجريبية:', TEST_CONFIG.testMessage);
  console.log('🏢 [TEST] معرف الشركة:', TEST_CONFIG.companyId);
  console.log('💬 [TEST] معرف المحادثة:', TEST_CONFIG.conversationId);
  
  try {
    // بيانات الرسالة
    const postData = JSON.stringify({
      content: TEST_CONFIG.testMessage,
      senderId: TEST_CONFIG.senderId,
      attachments: [],
      companyId: TEST_CONFIG.companyId,
      customerData: {
        id: TEST_CONFIG.senderId,
        name: 'مختبر قواعد الاستجابة',
        phone: '01000000000',
        email: 'test@test.com',
        orderCount: 0,
        companyId: TEST_CONFIG.companyId
      }
    });

    // إعدادات الطلب
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1/conversations/${TEST_CONFIG.conversationId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    // إرسال الرسالة
    const response = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({ status: res.statusCode, data: jsonData });
          } catch (e) {
            resolve({ status: res.statusCode, data: { content: data } });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    });

    console.log('✅ [TEST] تم إرسال الرسالة بنجاح');
    console.log('📊 [TEST] حالة الاستجابة:', response.status);
    
    if (response.data) {
      console.log('📝 [TEST] محتوى الرد:', response.data.content?.substring(0, 200) + '...');
      console.log('📏 [TEST] طول الرد:', response.data.content?.length || 0, 'حرف');
      
      // تحليل الرد للبحث عن علامات قواعد الاستجابة
      const content = response.data.content || '';
      
      console.log('\n🔍 [TEST] تحليل الرد:');
      
      // فحص اللهجة المصرية (القاعدة الافتراضية)
      const egyptianWords = ['ازيك', 'ايه', 'كده', 'بقى', 'عايز', 'عاوز', 'حضرتك', 'يا فندم'];
      const hasEgyptian = egyptianWords.some(word => content.includes(word));
      console.log('🇪🇬 [TEST] اللهجة المصرية:', hasEgyptian ? '✅ موجودة' : '❌ غير موجودة');
      
      // فحص الإيموجي (القاعدة الافتراضية)
      const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(content);
      console.log('😊 [TEST] استخدام الإيموجي:', hasEmojis ? '✅ موجود' : '❌ غير موجود');
      
      // فحص الأسلوب الودود (القاعدة الافتراضية)
      const friendlyWords = ['أهلا', 'مرحبا', 'شكرا', 'يسعدني', 'بكل سرور', 'تسلم'];
      const hasFriendly = friendlyWords.some(word => content.includes(word));
      console.log('😊 [TEST] الأسلوب الودود:', hasFriendly ? '✅ موجود' : '❌ غير موجود');
      
      // فحص ذكر الأسعار (القاعدة الافتراضية)
      const hasPrices = /\d+\s*(جنيه|ريال|درهم|دينار|ج\.م|ر\.س)/i.test(content);
      console.log('💰 [TEST] ذكر الأسعار:', hasPrices ? '✅ موجود' : '❌ غير موجود');
      
      console.log('\n📊 [TEST] النتيجة النهائية:');
      const rulesApplied = [hasEgyptian, hasEmojis, hasFriendly].filter(Boolean).length;
      console.log(`✅ [TEST] تم تطبيق ${rulesApplied}/3 من القواعد الأساسية`);
      
      if (rulesApplied >= 2) {
        console.log('🎉 [TEST] النجاح: قواعد الاستجابة تعمل بشكل جيد!');
      } else {
        console.log('⚠️ [TEST] تحذير: قواعد الاستجابة قد لا تعمل بشكل صحيح');
      }
    }
    
  } catch (error) {
    console.error('❌ [TEST] خطأ في الاختبار:', error.message);
    console.error('🌐 [TEST] تفاصيل الخطأ:', error);
  }
}

// تشغيل الاختبار
console.log('🚀 [TEST] بدء اختبار قواعد الاستجابة...\n');
testResponseRules()
  .then(() => {
    console.log('\n✅ [TEST] انتهى الاختبار');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [TEST] فشل الاختبار:', error);
    process.exit(1);
  });

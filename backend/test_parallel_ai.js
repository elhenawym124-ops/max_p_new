/**
 * 🧪 اختبار النظام المتوازي للذكاء الصناعي
 * اختبار إرسال عدة رسائل متوازية لشركة التسويق
 */

const { getSharedPrismaClient } = require('./services/sharedDatabase');
const fetch = require('node-fetch');

const prisma = getSharedPrismaClient();
const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97'; // شركة التسويق

// رسائل الاختبار المتوازي
const TEST_MESSAGES = [
  'مرحبا، أريد معرفة المنتجات المتاحة',
  'كم سعر الكوتشي؟',
  'هل يوجد خصم على الملابس؟',
  'أريد طلب حذاء رياضي',
  'ما هي طرق الدفع المتاحة؟',
  'كم مدة التوصيل للقاهرة؟',
  'هل يمكنني إرجاع المنتج؟',
  'أريد معرفة المقاسات المتاحة'
];

async function getAuthToken() {
  try {
    // البحث عن مستخدم لشركة التسويق
    const company = await prisma.company.findFirst({
      where: {
        OR: [
          { name: { contains: 'شركة التسويق' } },
          { id: COMPANY_ID }
        ]
      },
      include: {
        users: {
          where: { isActive: true },
          take: 1
        }
      }
    });

    if (!company || !company.users || company.users.length === 0) {
      console.log('❌ لم يتم العثور على مستخدم لشركة التسويق');
      return null;
    }

    const user = company.users[0];
    console.log(`✅ تم العثور على المستخدم: ${user.email} للشركة: ${company.name}`);

    // تسجيل الدخول
    const loginResponse = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email,
        password: 'admin123' // كلمة المرور الافتراضية
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ فشل تسجيل الدخول');
      return null;
    }

    const loginData = await loginResponse.json();
    return loginData.data.token;

  } catch (error) {
    console.error('❌ خطأ في الحصول على التوكن:', error.message);
    return null;
  }
}

async function sendMessage(message, messageIndex, token) {
  const startTime = Date.now();
  
  try {
    console.log(`📤 [${messageIndex + 1}] إرسال: "${message}"`);
    
    const response = await fetch('http://localhost:3001/api/v1/test-chat/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: message,
        companyId: COMPANY_ID
      })
    });

    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const errorData = await response.text();
      console.log(`❌ [${messageIndex + 1}] فشل (${duration}ms): ${errorData}`);
      return { success: false, duration, error: errorData };
    }

    const data = await response.json();
    const responseLength = data.data?.response?.length || 0;
    
    console.log(`✅ [${messageIndex + 1}] نجح (${duration}ms): ${responseLength} حرف`);
    return { success: true, duration, responseLength, data };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ [${messageIndex + 1}] خطأ (${duration}ms): ${error.message}`);
    return { success: false, duration, error: error.message };
  }
}

async function runParallelTest() {
  console.log('🧪 بدء اختبار النظام المتوازي للذكاء الصناعي\n');
  
  // 1. الحصول على التوكن
  console.log('🔑 الحصول على توكن المصادقة...');
  const token = await getAuthToken();
  
  if (!token) {
    console.log('❌ فشل في الحصول على التوكن');
    return;
  }
  
  console.log('✅ تم الحصول على التوكن بنجاح\n');
  
  // 2. إرسال الرسائل بشكل متوازي
  console.log(`🚀 إرسال ${TEST_MESSAGES.length} رسائل بشكل متوازي...\n`);
  
  const testStartTime = Date.now();
  
  // إرسال جميع الرسائل في نفس الوقت
  const promises = TEST_MESSAGES.map((message, index) => 
    sendMessage(message, index, token)
  );
  
  // انتظار جميع النتائج
  const results = await Promise.all(promises);
  
  const totalDuration = Date.now() - testStartTime;
  
  // 3. تحليل النتائج
  console.log('\n📊 تحليل النتائج:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const maxDuration = Math.max(...results.map(r => r.duration));
  const minDuration = Math.min(...results.map(r => r.duration));
  
  console.log(`✅ نجح: ${successful}/${TEST_MESSAGES.length} رسائل`);
  console.log(`❌ فشل: ${failed}/${TEST_MESSAGES.length} رسائل`);
  console.log(`⏱️  الوقت الإجمالي: ${totalDuration}ms`);
  console.log(`📈 متوسط وقت الرد: ${avgDuration.toFixed(0)}ms`);
  console.log(`🔺 أطول رد: ${maxDuration}ms`);
  console.log(`🔻 أسرع رد: ${minDuration}ms`);
  
  // 4. تفاصيل كل رسالة
  console.log('\n📝 تفاصيل كل رسالة:');
  console.log('='.repeat(50));
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const message = TEST_MESSAGES[index].substring(0, 30) + '...';
    console.log(`${status} [${index + 1}] ${message} (${result.duration}ms)`);
  });
  
  // 5. اختبار التوازي
  console.log('\n🎯 تقييم التوازي:');
  console.log('='.repeat(50));
  
  if (successful > 0) {
    const parallelEfficiency = (TEST_MESSAGES.length * minDuration) / totalDuration;
    console.log(`🚀 كفاءة التوازي: ${(parallelEfficiency * 100).toFixed(1)}%`);
    
    if (parallelEfficiency > 0.7) {
      console.log('🎉 النظام يعمل بتوازي ممتاز!');
    } else if (parallelEfficiency > 0.4) {
      console.log('👍 النظام يعمل بتوازي جيد');
    } else {
      console.log('⚠️  النظام يعمل بتوازي محدود');
    }
  }
  
  console.log('\n🏁 انتهى الاختبار');
}

// تشغيل الاختبار
runParallelTest().catch(console.error);

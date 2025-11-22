/**
 * 🧪 اختبار الـ route مباشرة (بدون تسجيل دخول)
 * يختبر فقط أن الـ route موجود ويعيد 401 (مطلوب مصادقة) وليس 404
 */

const axios = require('axios');

const API_URL = 'http://localhost:3007/api/v1';

console.log('\n🧪 اختبار route /reviews مباشرة\n');
console.log('='.repeat(50));

// Test: Try to access /reviews without authentication
async function testRoute() {
  console.log('🔍 اختبار: GET /api/v1/reviews (بدون مصادقة)...\n');
  
  try {
    const response = await axios.get(`${API_URL}/reviews`, {
      params: { page: 1, limit: 10 },
      validateStatus: () => true // Accept any status code
    });

    console.log(`📊 Status Code: ${response.status}`);
    console.log(`📊 Response: ${JSON.stringify(response.data, null, 2)}\n`);

    if (response.status === 404) {
      console.log('❌ المشكلة: الـ route غير موجود (404)');
      console.log('\n🔧 الحلول:');
      console.log('1. تحقق من server.js - يجب أن يحتوي على:');
      console.log('   app.use("/api/v1/reviews", productReviewRoutes)');
      console.log('\n2. تحقق من productReviewRoutes.js - يجب أن يحتوي على:');
      console.log('   router.get("/", productReviewController.getAllReviews)');
      console.log('\n3. تأكد من أن الـ route موجود بعد globalSecurity middleware\n');
      return false;
    } else if (response.status === 401) {
      console.log('✅ الـ route موجود ويعمل!');
      console.log('   (401 = مطلوب مصادقة - هذا صحيح)\n');
      return true;
    } else if (response.status === 500) {
      console.log('⚠️  الـ route موجود لكن هناك خطأ في الخادم (500)');
      console.log('\n🔧 الحلول:');
      console.log('1. تحقق من productReviewController.js');
      console.log('2. تحقق من console الخادم لمعرفة الخطأ');
      console.log('3. تحقق من أن req.user.companyId موجود\n');
      return false;
    } else if (response.status === 200) {
      console.log('✅ الـ route موجود ويعمل بدون مصادقة!');
      console.log('   (هذا قد يكون مشكلة أمنية - يجب أن يكون محمياً)\n');
      return true;
    } else {
      console.log(`⚠️  Status غير متوقع: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data)}\n`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ الخادم غير متصل');
      console.log('   تأكد من تشغيل الخادم: npm start\n');
    } else {
      console.log(`❌ خطأ: ${error.message}\n`);
    }
    return false;
  }
}

// Run test
testRoute().then(result => {
  console.log('='.repeat(50));
  if (result) {
    console.log('✅ الـ route موجود ويعمل بشكل صحيح!\n');
  } else {
    console.log('❌ هناك مشكلة في الـ route\n');
  }
  console.log('='.repeat(50) + '\n');
}).catch(error => {
  console.error(`\n❌ خطأ غير متوقع: ${error.message}`);
  process.exit(1);
});


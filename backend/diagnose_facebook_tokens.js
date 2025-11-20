const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * سكريبت شامل لفحص وتشخيص مشكلة صلاحيات Facebook API
 * يقوم بفحص جميع page access tokens في قاعدة البيانات واختبار صلاحيتها
 */

console.log('🔍 بدء فحص وتشخيص Facebook page access tokens...\n');

/**
 * فحص حالة page access tokens في قاعدة البيانات
 */
async function checkDatabaseTokens() {
  try {
    console.log('📊 المرحلة الأولى: فحص حالة page access tokens في قاعدة البيانات');
    console.log('=' .repeat(70));

    // جلب جميع Facebook pages من قاعدة البيانات
    const facebookPages = await prisma.facebookPage.findMany({
      select: {
        id: true,
        pageId: true,
        pageName: true,
        pageAccessToken: true,
        status: true,
        connectedAt: true,
        disconnectedAt: true,
        companyId: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`📈 إجمالي عدد الصفحات في قاعدة البيانات: ${facebookPages.length}`);
    
    if (facebookPages.length === 0) {
      console.log('⚠️  لا توجد صفحات Facebook في قاعدة البيانات');
      return [];
    }

    // تحليل حالة الصفحات
    const connectedPages = facebookPages.filter(page => page.status === 'connected');
    const disconnectedPages = facebookPages.filter(page => page.status === 'disconnected');
    const pagesWithTokens = facebookPages.filter(page => page.pageAccessToken && page.pageAccessToken.trim() !== '');
    const pagesWithoutTokens = facebookPages.filter(page => !page.pageAccessToken || page.pageAccessToken.trim() === '');

    console.log('\n📊 إحصائيات الصفحات:');
    console.log(`   ✅ صفحات متصلة: ${connectedPages.length}`);
    console.log(`   ❌ صفحات منقطعة: ${disconnectedPages.length}`);
    console.log(`   🔑 صفحات لديها tokens: ${pagesWithTokens.length}`);
    console.log(`   🚫 صفحات بدون tokens: ${pagesWithoutTokens.length}`);

    // عرض تفاصيل كل صفحة
    console.log('\n📋 تفاصيل الصفحات:');
    console.log('-'.repeat(120));
    console.log('| ID | اسم الصفحة | الحالة | لديها Token | تاريخ الاتصال | شركة |');
    console.log('-'.repeat(120));

    facebookPages.forEach((page, index) => {
      const hasToken = page.pageAccessToken && page.pageAccessToken.trim() !== '' ? '✅' : '❌';
      const status = page.status === 'connected' ? '🟢 متصلة' : '🔴 منقطعة';
      const connectedDate = page.connectedAt ? 
        new Date(page.connectedAt).toLocaleDateString('ar-EG') : 'غير محدد';
      const pageName = page.pageName || 'غير محدد';
      
      console.log(`| ${(index + 1).toString().padEnd(2)} | ${pageName.padEnd(15)} | ${status.padEnd(8)} | ${hasToken.padEnd(10)} | ${connectedDate.padEnd(12)} | ${page.companyId.padEnd(8)} |`);
    });

    console.log('-'.repeat(120));

    // عرض الصفحات التي تحتاج انتباه
    const problemPages = facebookPages.filter(page => 
      page.status === 'connected' && (!page.pageAccessToken || page.pageAccessToken.trim() === '')
    );

    if (problemPages.length > 0) {
      console.log('\n⚠️  صفحات تحتاج انتباه (متصلة لكن بدون token):');
      problemPages.forEach(page => {
        console.log(`   - ${page.pageName} (${page.pageId}) - شركة: ${page.companyId}`);
      });
    }

    return facebookPages;

  } catch (error) {
    console.error('❌ خطأ في فحص قاعدة البيانات:', error.message);
    throw error;
  }
}

/**
 * اختبار صلاحية token واحد مع Facebook Graph API
 */
async function testSingleToken(pageId, pageAccessToken, pageName) {
  try {
    // اختبار صلاحية الـ token بجلب معلومات الصفحة
    const pageInfoResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
      params: {
        access_token: pageAccessToken,
        fields: 'name,id,category'
      },
      timeout: 10000
    });

    // فحص الصلاحيات المتاحة
    const permissionsResponse = await axios.get(`https://graph.facebook.com/v18.0/me/permissions`, {
      params: {
        access_token: pageAccessToken
      },
      timeout: 10000
    });

    const permissions = {};
    const requiredPermissions = [
      'pages_messaging', 
      'pages_read_engagement', 
      'pages_manage_metadata', 
      'pages_read_user_content',
      'pages_show_list'
    ];

    permissionsResponse.data.data.forEach(perm => {
      permissions[perm.permission] = perm.status;
    });

    const grantedPermissions = Object.keys(permissions).filter(perm => permissions[perm] === 'granted');
    const missingRequiredPermissions = requiredPermissions.filter(perm => permissions[perm] !== 'granted');

    return {
      success: true,
      pageInfo: pageInfoResponse.data,
      permissions: permissions,
      grantedPermissions: grantedPermissions,
      missingRequiredPermissions: missingRequiredPermissions,
      hasAllRequired: missingRequiredPermissions.length === 0
    };

  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      errorCode: error.response?.status || 'UNKNOWN'
    };
  }
}

/**
 * اختبار صلاحية جميع الـ tokens
 */
async function testAllTokens(facebookPages) {
  console.log('\n🧪 المرحلة الثانية: اختبار صلاحية الـ tokens وفحص الصلاحيات');
  console.log('=' .repeat(70));

  const pagesWithTokens = facebookPages.filter(page => 
    page.pageAccessToken && page.pageAccessToken.trim() !== ''
  );

  if (pagesWithTokens.length === 0) {
    console.log('⚠️  لا توجد صفحات لديها tokens للاختبار');
    return;
  }

  console.log(`🔍 اختبار ${pagesWithTokens.length} صفحة لديها tokens...\n`);

  const results = [];

  for (let i = 0; i < pagesWithTokens.length; i++) {
    const page = pagesWithTokens[i];
    console.log(`[${i + 1}/${pagesWithTokens.length}] اختبار: ${page.pageName} (${page.pageId})`);

    const result = await testSingleToken(page.pageId, page.pageAccessToken, page.pageName);
    result.pageData = page;
    results.push(result);

    if (result.success) {
      console.log(`   ✅ Token صالح`);
      console.log(`   📊 الصلاحيات الممنوحة: ${result.grantedPermissions.length}`);
      
      if (result.missingRequiredPermissions.length > 0) {
        console.log(`   ⚠️  صلاحيات مطلوبة مفقودة: ${result.missingRequiredPermissions.join(', ')}`);
      } else {
        console.log(`   ✅ جميع الصلاحيات المطلوبة متوفرة`);
      }
    } else {
      console.log(`   ❌ Token غير صالح: ${result.error}`);
    }

    console.log(''); // سطر فارغ للتنسيق

    // تأخير قصير لتجنب rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * إنشاء تقرير شامل
 */
function generateReport(facebookPages, testResults) {
  console.log('\n📋 التقرير الشامل');
  console.log('=' .repeat(70));

  const validTokens = testResults?.filter(r => r.success) || [];
  const invalidTokens = testResults?.filter(r => !r.success) || [];
  const tokensWithMissingPermissions = validTokens.filter(r => r.missingRequiredPermissions.length > 0);

  console.log('\n📊 ملخص النتائج:');
  console.log(`   📈 إجمالي الصفحات: ${facebookPages.length}`);
  console.log(`   🔑 صفحات لديها tokens: ${testResults?.length || 0}`);
  console.log(`   ✅ tokens صالحة: ${validTokens.length}`);
  console.log(`   ❌ tokens غير صالحة: ${invalidTokens.length}`);
  console.log(`   ⚠️  tokens صالحة لكن تفتقر صلاحيات: ${tokensWithMissingPermissions.length}`);

  if (invalidTokens.length > 0) {
    console.log('\n❌ الصفحات ذات الـ tokens غير الصالحة:');
    invalidTokens.forEach(result => {
      console.log(`   - ${result.pageData.pageName} (${result.pageData.pageId})`);
      console.log(`     خطأ: ${result.error}`);
      console.log(`     شركة: ${result.pageData.companyId}`);
    });
  }

  if (tokensWithMissingPermissions.length > 0) {
    console.log('\n⚠️  الصفحات التي تفتقر صلاحيات مطلوبة:');
    tokensWithMissingPermissions.forEach(result => {
      console.log(`   - ${result.pageData.pageName} (${result.pageData.pageId})`);
      console.log(`     صلاحيات مفقودة: ${result.missingRequiredPermissions.join(', ')}`);
      console.log(`     شركة: ${result.pageData.companyId}`);
    });
  }

  // توصيات
  console.log('\n💡 التوصيات:');
  
  if (invalidTokens.length > 0) {
    console.log('   1. إعادة مصادقة الصفحات ذات الـ tokens غير الصالحة');
  }
  
  if (tokensWithMissingPermissions.length > 0) {
    console.log('   2. إعادة مصادقة الصفحات التي تفتقر الصلاحيات المطلوبة');
  }
  
  if (validTokens.length === testResults?.length && tokensWithMissingPermissions.length === 0) {
    console.log('   ✅ جميع الـ tokens صالحة ولديها الصلاحيات المطلوبة');
    console.log('   🔍 المشكلة قد تكون في مكان آخر - تحقق من الكود أو Facebook API changes');
  }
}

/**
 * الدالة الرئيسية
 */
async function main() {
  try {
    // المرحلة الأولى: فحص قاعدة البيانات
    const facebookPages = await checkDatabaseTokens();
    
    // المرحلة الثانية: اختبار الـ tokens
    const testResults = await testAllTokens(facebookPages);
    
    // إنشاء التقرير
    generateReport(facebookPages, testResults);
    
    console.log('\n✅ انتهى الفحص والتشخيص بنجاح');
    
  } catch (error) {
    console.error('\n❌ خطأ في تشغيل السكريبت:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// تشغيل السكريبت
if (require.main === module) {
  main();
}

module.exports = {
  checkDatabaseTokens,
  testSingleToken,
  testAllTokens,
  generateReport
};

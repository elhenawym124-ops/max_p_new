/**
 * سكريبت اختبار خاص بالبحث عن المنتجات
 * بيختبر البحث و Fuzzy Matching
 * 
 * الاستخدام:
 * node backend/test_ai_products.js [companyId]
 */

require('dotenv').config();
const { getSharedPrismaClient } = require('./services/sharedDatabase');
const aiAgentService = require('./services/aiAgentService');
const ragService = require('./services/ragService');

const prisma = getSharedPrismaClient();

async function testProducts(companyId) {
  console.log('\n🛍️  ========================================');
  console.log('🛍️  اختبار البحث عن المنتجات');
  console.log('🛍️  ========================================\n');
  
  try {
    // تهيئة RAG service
    console.log('🔧 جاري تهيئة RAG service...');
    await ragService.ensureInitialized();
    await ragService.loadProductsForCompany(companyId);
    console.log('✅ تم التهيئة\n');
    
    // اختبار 1: Fuzzy Matching
    console.log('🎯 اختبار 1: Fuzzy Matching...\n');
    const fuzzyTests = [
      { name1: 'Belle Boot', name2: 'بيل بوت', expected: true, desc: 'إنجليزي -> عربي' },
      { name1: 'Belle', name2: 'بيل', expected: true, desc: 'اسم قصير' },
      { name1: 'UGG Boot', name2: 'UGG', expected: true, desc: 'جزء من الاسم' },
      { name1: 'Belle Boot', name2: 'Chelsea Boot', expected: false, desc: 'منتجات مختلفة' },
      { name1: 'بيل بوت', name2: 'بيل', expected: true, desc: 'عربي -> جزء' }
    ];
    
    fuzzyTests.forEach((test, i) => {
      const result = aiAgentService.fuzzyMatchProduct(test.name1, test.name2);
      const passed = result === test.expected;
      console.log(`   ${passed ? '✅' : '❌'} ${i + 1}. "${test.name1}" vs "${test.name2}" (${test.desc})`);
      if (!passed) {
        console.log(`      متوقع: ${test.expected ? 'مطابق' : 'غير مطابق'}, النتيجة: ${result ? 'مطابق' : 'غير مطابق'}`);
      }
    });
    console.log('');
    
    // اختبار 2: البحث عن منتجات بأسماء مختلفة
    console.log('🔍 اختبار 2: البحث عن منتجات...\n');
    const searchQueries = [
      { query: 'Belle', desc: 'اسم إنجليزي' },
      { query: 'بيل', desc: 'اسم عربي' },
      { query: 'UGG', desc: 'اسم مختصر' },
      { query: 'كوتشي', desc: 'نوع منتج' }
    ];
    
    for (const test of searchQueries) {
      console.log(`   البحث عن: "${test.query}" (${test.desc})`);
      try {
        const result = await ragService.retrieveSpecificProduct(test.query, 'product_inquiry', null, [], companyId);
        
        if (result && result.isSpecific && result.product) {
          const productName = result.product.metadata?.name || 'غير محدد';
          const confidence = (result.confidence * 100).toFixed(1);
          console.log(`   ✅ تم العثور على: ${productName} (ثقة: ${confidence}%)`);
        } else {
          console.log(`   ⚠️  لم يتم العثور على منتج (ثقة: ${(result?.confidence || 0) * 100}%)`);
        }
      } catch (error) {
        console.log(`   ❌ خطأ: ${error.message}`);
      }
      console.log('');
    }
    
    // اختبار 3: جلب المنتجات من قاعدة البيانات
    console.log('📦 اختبار 3: جلب المنتجات من قاعدة البيانات...\n');
    const products = await prisma.product.findMany({
      where: { companyId },
      take: 5,
      select: {
        id: true,
        name: true,
        price: true
      }
    });
    
    console.log(`   تم العثور على ${products.length} منتج:`);
    products.forEach((product, i) => {
      console.log(`   ${i + 1}. ${product.name} - ${product.price} جنيه`);
    });
    console.log('');
    
    console.log('✅ ========================================');
    console.log('✅ انتهى اختبار المنتجات');
    console.log('✅ ========================================\n');
    
    await prisma.$disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// تشغيل الاختبار
const args = process.argv.slice(2);
const companyId = args[0];

if (!companyId) {
  console.error('❌ الاستخدام: node test_ai_products.js [companyId]');
  process.exit(1);
}

testProducts(companyId);


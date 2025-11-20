/**
 * سكريبت اختبار بسيط لتشغيل نظام التحليل
 * يمكن استخدامه للاختبار المباشر
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { AIAnalyzerAndFixer } = require('./analyzeAndFixAITest');

async function testAnalyzeAndFix() {
  try {
    console.log('🚀 بدء اختبار نظام التحليل...\n');
    
    const analyzer = new AIAnalyzerAndFixer();
    
    // تشغيل التحليل الكامل
    const results = await analyzer.runFullAnalysis();
    
    console.log('\n✅ تم إكمال الاختبار بنجاح!');
    console.log(`📊 النتائج:`);
    console.log(`   إجمالي الأسئلة: ${results.totalQuestions}`);
    console.log(`   تم التحليل: ${results.analyzed}`);
    console.log(`   المشاكل: ${results.problems.length}`);
    console.log(`   الحلول: ${results.fixes.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ فشل الاختبار:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// تشغيل الاختبار
testAnalyzeAndFix();


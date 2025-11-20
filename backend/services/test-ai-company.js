/**
 * اختبار ذكاء الذكاء الاصطناعي لشركة mo-test (شركة التسويق)
 */

const AITestRunner = require('./run-ai-intelligence-test');

// ID الشركة mo-test
const COMPANY_ID = 'cmhnzbjl50000ufus81imj8wq';

async function main() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 اختبار ذكاء الذكاء الاصطناعي');
    console.log('🏢 الشركة: mo-test (شركة التسويق)');
    console.log('📊 عدد الأسئلة: 50');
    console.log('='.repeat(60) + '\n');

    const runner = new AITestRunner(COMPANY_ID);
    const report = await runner.runAllTests();

    console.log('\n' + '='.repeat(60));
    console.log('✅ اكتمل الاختبار بنجاح!');
    console.log('='.repeat(60));

    // طباعة ملخص المشاكل
    if (report.issues && report.issues.length > 0) {
      console.log('\n⚠️ المشاكل المكتشفة:\n');
      report.issues.forEach(issue => {
        console.log(`  - ${issue.type} (${issue.severity}): ${issue.count} سؤال`);
        if (issue.questions && issue.questions.length > 0) {
          console.log(`    الأسئلة: ${issue.questions.slice(0, 10).join(', ')}${issue.questions.length > 10 ? '...' : ''}`);
        }
      });
    }

    console.log(`\n📄 راجع التقرير المفصل في الملف المحفوظ\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ خطأ في تشغيل الاختبار:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();


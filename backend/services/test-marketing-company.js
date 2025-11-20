/**
 * اختبار ذكاء الذكاء الاصطناعي لشركة "شركة التسويق"
 */

const AITestRunner = require('./run-ai-intelligence-test');

// ID شركة "شركة التسويق"
const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97';

async function main() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 اختبار ذكاء الذكاء الاصطناعي');
    console.log('🏢 الشركة: شركة التسويق');
    console.log('📊 عدد الأسئلة: 50');
    console.log('='.repeat(60) + '\n');

    const runner = new AITestRunner(COMPANY_ID);
    const report = await runner.runAllTests();

    console.log('\n' + '='.repeat(60));
    console.log('✅ اكتمل الاختبار بنجاح!');
    console.log('='.repeat(60));

    // طباعة ملخص النتائج
    console.log(`\n📊 النتائج:`);
    console.log(`   - إجمالي الأسئلة: ${report.metadata.totalQuestions}`);
    console.log(`   - الناجحة: ${report.metadata.successfulTests}`);
    console.log(`   - الفاشلة: ${report.metadata.failedTests}`);
    console.log(`   - المتوسط: ${report.summary.averageScore}/100 (${report.summary.averagePercentage})`);
    console.log(`   - الوقت: ${report.metadata.totalTime}`);

    // طباعة ملخص المشاكل
    if (report.issues && report.issues.length > 0) {
      console.log('\n⚠️ المشاكل المكتشفة:\n');
      report.issues.forEach(issue => {
        console.log(`  - ${issue.type} (${issue.severity}): ${issue.count} سؤال`);
        if (issue.questions && issue.questions.length > 0) {
          const questionsList = issue.questions.slice(0, 10).join(', ');
          console.log(`    الأسئلة: ${questionsList}${issue.questions.length > 10 ? '...' : ''}`);
        }
        if (issue.errors && issue.errors.length > 0) {
          console.log(`    الأخطاء: ${issue.errors.slice(0, 3).join(', ')}${issue.errors.length > 3 ? '...' : ''}`);
        }
      });
    } else {
      console.log('\n✅ لا توجد مشاكل مكتشفة!');
    }

    // طباعة النتائج حسب الفئة
    if (report.statsByCategory && Object.keys(report.statsByCategory).length > 0) {
      console.log('\n📊 النتائج حسب الفئة:\n');
      for (const categoryKey in report.statsByCategory) {
        const stats = report.statsByCategory[categoryKey];
        const percentage = ((stats.averageScore / 100) * 100).toFixed(1);
        console.log(`   ${stats.name}:`);
        console.log(`      - المتوسط: ${stats.averageScore.toFixed(1)}/100 (${percentage}%)`);
        console.log(`      - الناجحة: ${stats.passed}/${stats.total}`);
      }
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


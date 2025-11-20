/**
 * اختبار ذكاء الذكاء الاصطناعي باستخدام الأسئلة المستخرجة من الشركة
 */

const AITestRunner = require('./run-ai-intelligence-test');
const fs = require('fs');
const path = require('path');

const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97'; // شركة التسويق

async function main() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 اختبار ذكاء الذكاء الاصطناعي');
    console.log('🏢 الشركة: شركة التسويق');
    console.log('📊 استخدام الأسئلة المستخرجة من بيانات الشركة');
    console.log('='.repeat(60) + '\n');

    // البحث عن ملف الأسئلة المستخرجة
    const servicesDir = __dirname;
    const questionFiles = fs.readdirSync(servicesDir)
      .filter(file => file.startsWith('company-questions-') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(servicesDir, file),
        time: fs.statSync(path.join(servicesDir, file)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    if (questionFiles.length === 0) {
      console.error('❌ لم يتم العثور على ملف الأسئلة المستخرجة من الشركة');
      console.log('💡 قم بتشغيل: node generate-questions-from-company.js');
      process.exit(1);
    }

    const questionsFile = questionFiles[0];
    console.log(`📄 استخدام ملف الأسئلة: ${questionsFile.name}\n`);

    const questionsData = JSON.parse(fs.readFileSync(questionsFile.path, 'utf8'));
    console.log(`✅ تم تحميل ${questionsData.questions.length} سؤال\n`);

    // إنشاء runner
    const runner = new AITestRunner(COMPANY_ID);
    
    // تحديث الأسئلة في runner
    runner.questions = questionsData.questions;

    // ✅ إنشاء المحادثة في قاعدة البيانات قبل البدء في الاختبارات
    console.log('💬 إنشاء محادثة في قاعدة البيانات...');
    await runner.initializeConversation();
    console.log(`✅ تم إنشاء المحادثة: ${runner.dbConversationId}`);
    console.log(`📝 يمكنك رؤية المحادثة في /test-chat?conversationId=${runner.dbConversationId}\n`);

    // تشغيل الاختبارات
    const results = [];
    for (const question of questionsData.questions) {
      const result = await runner.runTest(question);
      results.push(result);
    }

    // إنشاء التقرير
    const totalQuestions = results.length;
    const successfulTests = results.filter(r => r.success !== false).length;
    const failedTests = totalQuestions - successfulTests;
    const averageScore = results.reduce((sum, r) => sum + (r.totalScore || 0), 0) / totalQuestions;

    // الإحصائيات حسب الفئة
    const statsByCategory = {};
    questionsData.questions.forEach(q => {
      if (!statsByCategory[q.category]) {
        statsByCategory[q.category] = {
          name: q.category,
          total: 0,
          averageScore: 0,
          passed: 0,
          questions: []
        };
      }
      statsByCategory[q.category].total++;
      const result = results.find(r => r.questionId === q.id);
      if (result) {
        statsByCategory[q.category].averageScore += result.totalScore || 0;
        statsByCategory[q.category].questions.push(result);
        if ((result.totalScore || 0) >= 70) {
          statsByCategory[q.category].passed++;
        }
      }
    });

    for (const category in statsByCategory) {
      if (statsByCategory[category].total > 0) {
        statsByCategory[category].averageScore /= statsByCategory[category].total;
      }
    }

    const report = {
      metadata: {
        testDate: new Date().toISOString(),
        totalQuestions,
        successfulTests,
        failedTests,
        totalTime: `${((Date.now() - runner.startTime) / 1000).toFixed(2)}s`,
        companyId: COMPANY_ID,
        customerId: runner.customerId,
        conversationId: runner.conversationId,
        dbConversationId: runner.dbConversationId,
        testChatUrl: `/test-chat?conversationId=${runner.dbConversationId}`,
        source: 'company_data'
      },
      summary: {
        averageScore: averageScore.toFixed(2),
        averagePercentage: ((averageScore / 100) * 100).toFixed(1) + '%'
      },
      statsByCategory,
      results,
      issues: runner.identifyIssues ? runner.identifyIssues() : []
    };

    // حفظ التقرير
    const reportPath = path.join(__dirname, `company-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n📄 تم حفظ التقرير في: ${reportPath}`);

    // طباعة الملخص
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الاختبار');
    console.log('='.repeat(60));
    console.log(`✅ الناجحة: ${successfulTests}/${totalQuestions}`);
    console.log(`❌ الفاشلة: ${failedTests}/${totalQuestions}`);
    console.log(`📈 المتوسط: ${averageScore.toFixed(1)}/100 (${((averageScore / 100) * 100).toFixed(1)}%)`);
    console.log(`💬 المحادثة: /test-chat?conversationId=${runner.dbConversationId}`);
    console.log('\n📊 النتائج حسب الفئة:');
    for (const categoryKey in statsByCategory) {
      const stats = statsByCategory[categoryKey];
      console.log(`   - ${stats.name}: ${stats.averageScore.toFixed(1)}/100 (${stats.passed}/${stats.total} نجح)`);
    }
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ خطأ في تشغيل الاختبار:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();


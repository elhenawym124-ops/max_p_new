/**
 * اختبار سريع للتأكد من أن النظام يعمل
 */

const AITestRunner = require('./run-ai-intelligence-test');
const fs = require('fs');
const path = require('path');

const COMPANY_ID = 'cmem8ayyr004cufakqkcsyn97';

async function quickTest() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 اختبار سريع للنظام');
    console.log('='.repeat(60) + '\n');

    // 1. التحقق من ملف الأسئلة
    console.log('1️⃣ التحقق من ملف الأسئلة...');
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
      console.error('❌ لم يتم العثور على ملف الأسئلة');
      process.exit(1);
    }

    console.log(`✅ تم العثور على ملف: ${questionFiles[0].name}`);
    const questionsData = JSON.parse(fs.readFileSync(questionFiles[0].path, 'utf8'));
    console.log(`✅ عدد الأسئلة: ${questionsData.questions.length}\n`);

    // 2. إنشاء runner
    console.log('2️⃣ إنشاء AITestRunner...');
    const runner = new AITestRunner(COMPANY_ID);
    console.log('✅ تم إنشاء runner بنجاح\n');

    // 3. إنشاء المحادثة
    console.log('3️⃣ إنشاء المحادثة في قاعدة البيانات...');
    await runner.initializeConversation();
    console.log(`✅ تم إنشاء المحادثة: ${runner.dbConversationId}\n`);

    // 4. اختبار سؤال واحد فقط
    console.log('4️⃣ اختبار سؤال واحد...');
    const firstQuestion = questionsData.questions[0];
    console.log(`📝 السؤال: "${firstQuestion.question}"`);
    
    const result = await runner.runTest(firstQuestion);
    
    if (result.success !== false) {
      console.log(`✅ الاختبار نجح!`);
      console.log(`📊 النتيجة: ${result.totalScore}/100`);
      console.log(`💬 الرد: "${result.content?.substring(0, 100)}..."`);
    } else {
      console.log(`❌ الاختبار فشل: ${result.error}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ الاختبار السريع اكتمل!');
    console.log(`💬 المحادثة: /test-chat?conversationId=${runner.dbConversationId}`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار السريع:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

quickTest();



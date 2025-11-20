/**
 * خدمة إنشاء تقارير شاملة عن نتائج اختبار الذكاء الاصطناعي
 * تحلل أداء كل وظيفة من وظائف AI وتنشئ تقارير مفصلة
 */

const fs = require('fs').promises;
const path = require('path');

class TestReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '..', 'reports');
  }

  /**
   * إنشاء تقرير شامل عن نتائج الاختبار
   * @param {Object} testResults - نتائج الاختبار
   * @param {Object} options - خيارات التقرير
   * @returns {Promise<string>} - مسار ملف التقرير
   */
  async generateReport(testResults, options = {}) {
    try {
      // إنشاء مجلد التقارير إذا لم يكن موجوداً
      await fs.mkdir(this.reportsDir, { recursive: true });

      // تحليل النتائج
      const analysis = this.analyzeResults(testResults);

      // إنشاء التقرير
      const report = this.buildReport(testResults, analysis, options);

      // حفظ التقرير
      const fileName = `test-report-${testResults.conversationId}-${Date.now()}.md`;
      const filePath = path.join(this.reportsDir, fileName);
      await fs.writeFile(filePath, report, 'utf8');

      console.log(`✅ Test report generated: ${filePath}`);

      return filePath;
    } catch (error) {
      console.error('❌ Error generating test report:', error);
      throw error;
    }
  }

  /**
   * تحليل نتائج الاختبار
   * @param {Object} testResults - نتائج الاختبار
   * @returns {Object} - تحليل النتائج
   */
  analyzeResults(testResults) {
    const analysis = {
      overall: {
        totalQuestions: testResults.totalQuestions,
        sent: testResults.sent,
        succeeded: testResults.succeeded,
        failed: testResults.failed,
        silent: testResults.silent,
        successRate: testResults.totalQuestions > 0
          ? (testResults.succeeded / testResults.totalQuestions) * 100
          : 0,
        averageProcessingTime: 0,
        totalDuration: testResults.duration
      },
      byIntent: {},
      byDifficulty: {
        easy: { total: 0, succeeded: 0, failed: 0, silent: 0 },
        medium: { total: 0, succeeded: 0, failed: 0, silent: 0 },
        hard: { total: 0, succeeded: 0, failed: 0, silent: 0 }
      },
      processingTimes: [],
      errors: testResults.errors || [],
      intents: {},
      sentiments: {},
      models: {}
    };

    // تحليل كل رسالة
    testResults.messages.forEach((message, index) => {
      // تحليل حسب الـ intent
      if (message.aiResponse?.intent) {
        const intent = message.aiResponse.intent;
        if (!analysis.byIntent[intent]) {
          analysis.byIntent[intent] = {
            total: 0,
            succeeded: 0,
            failed: 0,
            silent: 0,
            averageProcessingTime: 0,
            processingTimes: []
          };
        }
        analysis.byIntent[intent].total++;
        if (message.success) {
          if (message.aiResponse.silent) {
            analysis.byIntent[intent].silent++;
          } else {
            analysis.byIntent[intent].succeeded++;
          }
        } else {
          analysis.byIntent[intent].failed++;
        }
        if (message.processingTime) {
          analysis.byIntent[intent].processingTimes.push(message.processingTime);
        }
      }

      // تحليل حسب الصعوبة
      if (message.questionData?.difficulty) {
        const difficulty = message.questionData.difficulty;
        analysis.byDifficulty[difficulty].total++;
        if (message.success) {
          if (message.aiResponse?.silent) {
            analysis.byDifficulty[difficulty].silent++;
          } else {
            analysis.byDifficulty[difficulty].succeeded++;
          }
        } else {
          analysis.byDifficulty[difficulty].failed++;
        }
      }

      // جمع أوقات المعالجة
      if (message.processingTime) {
        analysis.processingTimes.push(message.processingTime);
      }
      if (message.aiResponse?.processingTime) {
        analysis.processingTimes.push(message.aiResponse.processingTime);
      }

      // تحليل الـ intents
      if (message.aiResponse?.intent) {
        if (!analysis.intents[message.aiResponse.intent]) {
          analysis.intents[message.aiResponse.intent] = 0;
        }
        analysis.intents[message.aiResponse.intent]++;
      }

      // تحليل المشاعر
      if (message.aiResponse?.sentiment) {
        if (!analysis.sentiments[message.aiResponse.sentiment]) {
          analysis.sentiments[message.aiResponse.sentiment] = 0;
        }
        analysis.sentiments[message.aiResponse.sentiment]++;
      }

      // تحليل النماذج المستخدمة
      if (message.aiResponse?.model) {
        if (!analysis.models[message.aiResponse.model]) {
          analysis.models[message.aiResponse.model] = {
            count: 0,
            averageProcessingTime: 0,
            processingTimes: []
          };
        }
        analysis.models[message.aiResponse.model].count++;
        if (message.aiResponse.processingTime) {
          analysis.models[message.aiResponse.model].processingTimes.push(
            message.aiResponse.processingTime
          );
        }
      }
    });

    // حساب المتوسطات
    if (analysis.processingTimes.length > 0) {
      analysis.overall.averageProcessingTime =
        analysis.processingTimes.reduce((a, b) => a + b, 0) / analysis.processingTimes.length;
    }

    // حساب متوسطات الـ intents
    Object.keys(analysis.byIntent).forEach(intent => {
      const intentData = analysis.byIntent[intent];
      if (intentData.processingTimes.length > 0) {
        intentData.averageProcessingTime =
          intentData.processingTimes.reduce((a, b) => a + b, 0) / intentData.processingTimes.length;
      }
    });

    // حساب متوسطات النماذج
    Object.keys(analysis.models).forEach(model => {
      const modelData = analysis.models[model];
      if (modelData.processingTimes.length > 0) {
        modelData.averageProcessingTime =
          modelData.processingTimes.reduce((a, b) => a + b, 0) / modelData.processingTimes.length;
      }
    });

    return analysis;
  }

  /**
   * بناء التقرير
   * @param {Object} testResults - نتائج الاختبار
   * @param {Object} analysis - تحليل النتائج
   * @param {Object} options - خيارات التقرير
   * @returns {string} - نص التقرير
   */
  buildReport(testResults, analysis, options) {
    const timestamp = new Date().toLocaleString('ar-EG');
    const startTime = new Date(testResults.startTime).toLocaleString('ar-EG');
    const endTime = new Date(testResults.endTime).toLocaleString('ar-EG');
    const duration = this.formatDuration(testResults.duration);

    let report = `# تقرير اختبار الذكاء الاصطناعي

**تاريخ الإنشاء:** ${timestamp}
**معرف المحادثة:** ${testResults.conversationId}
**وقت البدء:** ${startTime}
**وقت الانتهاء:** ${endTime}
**المدة الإجمالية:** ${duration}

---

## 📊 الملخص التنفيذي

| المقياس | القيمة |
|---------|--------|
| إجمالي الأسئلة | ${analysis.overall.totalQuestions} |
| تم الإرسال | ${analysis.overall.sent} |
| نجح | ${analysis.overall.succeeded} |
| فشل | ${analysis.overall.failed} |
| صامت | ${analysis.overall.silent} |
| **نسبة النجاح** | **${analysis.overall.successRate.toFixed(2)}%** |
| متوسط وقت المعالجة | ${this.formatDuration(analysis.overall.averageProcessingTime)} |

---

## 📈 التحليل حسب الـ Intent

`;

    // إضافة تحليل كل intent
    Object.keys(analysis.byIntent).forEach(intent => {
      const intentData = analysis.byIntent[intent];
      const successRate = intentData.total > 0
        ? ((intentData.succeeded / intentData.total) * 100).toFixed(2)
        : '0.00';

      report += `### ${this.getIntentLabel(intent)}

| المقياس | القيمة |
|---------|--------|
| الإجمالي | ${intentData.total} |
| نجح | ${intentData.succeeded} |
| فشل | ${intentData.failed} |
| صامت | ${intentData.silent} |
| نسبة النجاح | ${successRate}% |
| متوسط وقت المعالجة | ${this.formatDuration(intentData.averageProcessingTime)} |

`;
    });

    report += `---

## 🎯 التحليل حسب مستوى الصعوبة

### سهلة
- الإجمالي: ${analysis.byDifficulty.easy.total}
- نجح: ${analysis.byDifficulty.easy.succeeded}
- فشل: ${analysis.byDifficulty.easy.failed}
- صامت: ${analysis.byDifficulty.easy.silent}

### متوسطة
- الإجمالي: ${analysis.byDifficulty.medium.total}
- نجح: ${analysis.byDifficulty.medium.succeeded}
- فشل: ${analysis.byDifficulty.medium.failed}
- صامت: ${analysis.byDifficulty.medium.silent}

### صعبة
- الإجمالي: ${analysis.byDifficulty.hard.total}
- نجح: ${analysis.byDifficulty.hard.succeeded}
- فشل: ${analysis.byDifficulty.hard.failed}
- صامت: ${analysis.byDifficulty.hard.silent}

---

## 🤖 النماذج المستخدمة

`;

    Object.keys(analysis.models).forEach(model => {
      const modelData = analysis.models[model];
      report += `### ${model}
- عدد الاستخدامات: ${modelData.count}
- متوسط وقت المعالجة: ${this.formatDuration(modelData.averageProcessingTime)}

`;
    });

    report += `---

## 😊 تحليل المشاعر

`;

    Object.keys(analysis.sentiments).forEach(sentiment => {
      report += `- ${sentiment}: ${analysis.sentiments[sentiment]}\n`;
    });

    report += `---

## ❌ الأخطاء

`;

    if (analysis.errors.length > 0) {
      analysis.errors.forEach((error, index) => {
        report += `### خطأ #${index + 1}
- السؤال: ${error.question}
- الرسالة: ${error.error}

`;
      });
    } else {
      report += `لا توجد أخطاء.\n\n`;
    }

    report += `---

## 📝 تفاصيل الرسائل

`;

    testResults.messages.forEach((message, index) => {
      report += `### رسالة #${message.questionNumber}

**السؤال:** ${message.question}

**النتيجة:** ${message.success ? '✅ نجح' : '❌ فشل'}
${message.aiResponse?.silent ? '**الحالة:** 🤐 صامت\n' : ''}

`;

      if (message.aiResponse) {
        if (message.aiResponse.content) {
          report += `**رد AI:** ${message.aiResponse.content.substring(0, 200)}...\n\n`;
        }
        if (message.aiResponse.intent) {
          report += `- **النية:** ${message.aiResponse.intent}\n`;
        }
        if (message.aiResponse.sentiment) {
          report += `- **المشاعر:** ${message.aiResponse.sentiment}\n`;
        }
        if (message.aiResponse.model) {
          report += `- **النموذج:** ${message.aiResponse.model}\n`;
        }
        if (message.aiResponse.processingTime) {
          report += `- **وقت المعالجة:** ${this.formatDuration(message.aiResponse.processingTime)}\n`;
        }
      }

      if (message.error) {
        report += `- **خطأ:** ${message.error}\n`;
      }

      report += `\n---\n\n`;
    });

    report += `---

## 📊 التوصيات

`;

    // إضافة توصيات بناءً على النتائج
    if (analysis.overall.successRate < 70) {
      report += `- ⚠️ نسبة النجاح منخفضة (${analysis.overall.successRate.toFixed(2)}%). يوصى بمراجعة إعدادات AI.\n`;
    }

    if (analysis.overall.averageProcessingTime > 5000) {
      report += `- ⚠️ وقت المعالجة طويل (${this.formatDuration(analysis.overall.averageProcessingTime)}). يوصى بتحسين الأداء.\n`;
    }

    if (analysis.errors.length > analysis.overall.totalQuestions * 0.1) {
      report += `- ⚠️ عدد الأخطاء مرتفع (${analysis.errors.length}). يوصى بمراجعة النظام.\n`;
    }

    Object.keys(analysis.byIntent).forEach(intent => {
      const intentData = analysis.byIntent[intent];
      const successRate = intentData.total > 0
        ? (intentData.succeeded / intentData.total) * 100
        : 0;
      
      if (successRate < 70) {
        report += `- ⚠️ أداء ${this.getIntentLabel(intent)} ضعيف (${successRate.toFixed(2)}%).\n`;
      }
    });

    report += `\n---

**نهاية التقرير**
`;

    return report;
  }

  /**
   * تنسيق المدة
   */
  formatDuration(ms) {
    if (!ms || ms === 0) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  /**
   * الحصول على تسمية الـ intent
   */
  getIntentLabel(intent) {
    const labels = {
      greeting: 'تحية',
      product_inquiry: 'استفسار عن المنتجات',
      price_inquiry: 'استفسار عن الأسعار',
      shipping_inquiry: 'استفسار عن الشحن',
      order_inquiry: 'استفسار عن الطلبات',
      general_inquiry: 'استفسار عام',
      image_processing: 'معالجة الصور',
      rag_retrieval: 'استرجاع RAG',
      order_detection: 'اكتشاف الطلبات',
      sentiment_analysis: 'تحليل المشاعر',
      context_management: 'إدارة السياق',
      edge_cases: 'حالات حدية'
    };
    return labels[intent] || intent;
  }
}

module.exports = new TestReportGenerator();


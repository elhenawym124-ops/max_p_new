/**
 * خدمة إرسال رسائل الاختبار تلقائياً إلى AI
 * ترسل رسائل اختبار وتحفظ الردود في قاعدة البيانات
 */

const { getSharedPrismaClient } = require('./sharedDatabase');
const aiAgentService = require('./aiAgentService');

class TestMessageSender {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إرسال رسائل اختبار تلقائياً
   * @param {string} conversationId - معرف المحادثة
   * @param {Array} questions - قائمة أسئلة الاختبار
   * @param {Object} options - خيارات الإرسال
   * @returns {Promise<Object>} - نتائج الاختبار
   */
  async sendTestMessages(conversationId, questions, options = {}) {
    const {
      delayBetweenMessages = 1000, // تأخير بين الرسائل بالمللي ثانية
      stopOnError = false, // التوقف عند حدوث خطأ
      maxConcurrent = 1 // عدد الرسائل المتزامنة
    } = options;

    try {
      // التحقق من وجود المحادثة
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          customer: true
        }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const results = {
        conversationId: conversationId,
        totalQuestions: questions.length,
        sent: 0,
        succeeded: 0,
        failed: 0,
        silent: 0,
        messages: [],
        startTime: new Date(),
        endTime: null,
        duration: null,
        errors: []
      };

      // إرسال الرسائل بالتسلسل
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        try {
          console.log(`📤 Sending test message ${i + 1}/${questions.length}: "${question.question || question}"`);

          const result = await this.sendTestMessage(
            conversationId,
            conversation,
            question,
            i + 1
          );

          results.messages.push(result);
          results.sent++;

          if (result.success) {
            if (result.aiResponse?.silent) {
              results.silent++;
            } else {
              results.succeeded++;
            }
          } else {
            results.failed++;
            results.errors.push({
              questionIndex: i + 1,
              question: question.question || question,
              error: result.error
            });

            if (stopOnError) {
              console.log(`⏸️ Stopping due to error in question ${i + 1}`);
              break;
            }
          }

          // تأخير بين الرسائل
          if (i < questions.length - 1 && delayBetweenMessages > 0) {
            await this.sleep(delayBetweenMessages);
          }

        } catch (error) {
          console.error(`❌ Error sending question ${i + 1}:`, error);
          results.failed++;
          results.errors.push({
            questionIndex: i + 1,
            question: question.question || question,
            error: error.message
          });

          if (stopOnError) {
            break;
          }
        }
      }

      results.endTime = new Date();
      results.duration = results.endTime - results.startTime;

      // حفظ نتائج الاختبار في قاعدة البيانات
      await this.saveTestResults(conversationId, results);

      console.log(`✅ Test completed: ${results.succeeded} succeeded, ${results.failed} failed, ${results.silent} silent`);

      return results;

    } catch (error) {
      console.error('❌ Error in sendTestMessages:', error);
      throw error;
    }
  }

  /**
   * إرسال رسالة اختبار واحدة
   * @param {string} conversationId - معرف المحادثة
   * @param {Object} conversation - بيانات المحادثة
   * @param {Object|string} question - سؤال الاختبار
   * @param {number} questionNumber - رقم السؤال
   * @returns {Promise<Object>} - نتيجة الإرسال
   */
  async sendTestMessage(conversationId, conversation, question, questionNumber) {
    const startTime = Date.now();
    
    try {
      // الحصول على نص السؤال
      const questionText = typeof question === 'string' ? question : question.question;

      if (!questionText || !questionText.trim()) {
        throw new Error('Question text is required');
      }

      // حفظ رسالة المستخدم
      const userMessage = await this.prisma.message.create({
        data: {
          conversationId: conversationId,
          content: questionText.trim(),
          type: 'TEXT',
          isFromCustomer: true,
          createdAt: new Date()
        }
      });

      // تحديث المحادثة
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: questionText.trim().length > 100 
            ? questionText.trim().substring(0, 100) + '...' 
            : questionText.trim()
        }
      });

      // استدعاء AI Agent
      const messageData = {
        conversationId: conversationId,
        senderId: conversation.customerId,
        content: questionText.trim(),
        attachments: [],
        companyId: conversation.companyId,
        customerData: {
          id: conversation.customerId,
          name: `${conversation.customer.firstName} ${conversation.customer.lastName}`,
          phone: conversation.customer.phone || '0000000000',
          email: conversation.customer.email || `test-${conversation.companyId}@test.com`,
          orderCount: 0,
          companyId: conversation.companyId
        }
      };

      let aiResponse = null;
      let aiMessage = null;
      let error = null;

      try {
        aiResponse = await aiAgentService.processCustomerMessage(messageData);

        // حفظ رد AI إذا كان موجوداً
        if (aiResponse && aiResponse.content) {
          aiMessage = await this.prisma.message.create({
            data: {
              conversationId: conversationId,
              content: aiResponse.content,
              type: 'TEXT',
              isFromCustomer: false,
              createdAt: new Date()
            }
          });

          // تحديث المحادثة برد AI
          await this.prisma.conversation.update({
            where: { id: conversationId },
            data: {
              lastMessageAt: new Date(),
              lastMessagePreview: aiResponse.content.length > 100 
                ? aiResponse.content.substring(0, 100) + '...' 
                : aiResponse.content
            }
          });
        } else if (aiResponse && aiResponse.silent) {
          console.log(`🤐 AI is silent for question ${questionNumber}`);
        }
      } catch (aiError) {
        console.error(`❌ Error processing AI response for question ${questionNumber}:`, aiError);
        error = aiError.message;
      }

      const processingTime = Date.now() - startTime;

      return {
        questionNumber: questionNumber,
        question: questionText,
        questionData: typeof question === 'object' ? question : null,
        success: !error,
        userMessage: {
          id: userMessage.id,
          content: userMessage.content,
          timestamp: userMessage.createdAt
        },
        aiMessage: aiMessage ? {
          id: aiMessage.id,
          content: aiMessage.content,
          timestamp: aiMessage.createdAt
        } : null,
        aiResponse: aiResponse ? {
          content: aiResponse.content,
          intent: aiResponse.intent,
          sentiment: aiResponse.sentiment,
          confidence: aiResponse.confidence,
          processingTime: aiResponse.processingTime,
          model: aiResponse.model,
          keyId: aiResponse.keyId,
          silent: aiResponse.silent,
          error: aiResponse.error
        } : null,
        processingTime: processingTime,
        error: error,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`❌ Error in sendTestMessage for question ${questionNumber}:`, error);
      return {
        questionNumber: questionNumber,
        question: typeof question === 'string' ? question : question?.question || 'Unknown',
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * حفظ نتائج الاختبار في قاعدة البيانات
   * @param {string} conversationId - معرف المحادثة
   * @param {Object} results - نتائج الاختبار
   */
  async saveTestResults(conversationId, results) {
    try {
      // يمكن حفظ النتائج في جدول خاص أو في metadata المحادثة
      // حالياً سنحفظها في metadata المحادثة
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId }
      });

      const metadata = conversation.metadata ? JSON.parse(conversation.metadata) : {};
      metadata.testResults = {
        ...results,
        startTime: results.startTime.toISOString(),
        endTime: results.endTime.toISOString()
      };

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          metadata: JSON.stringify(metadata)
        }
      });

      console.log('✅ Test results saved to conversation metadata');

    } catch (error) {
      console.error('❌ Error saving test results:', error);
      // لا نرمي الخطأ لأن حفظ النتائج ليس ضرورياً لعمل الاختبار
    }
  }

  /**
   * جلب نتائج الاختبار من المحادثة
   * @param {string} conversationId - معرف المحادثة
   * @returns {Promise<Object|null>} - نتائج الاختبار
   */
  async getTestResults(conversationId) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId }
      });

      if (!conversation) {
        return null;
      }

      if (conversation.metadata) {
        const metadata = JSON.parse(conversation.metadata);
        if (metadata.testResults) {
          return metadata.testResults;
        }
      }

      return null;

    } catch (error) {
      console.error('❌ Error getting test results:', error);
      return null;
    }
  }

  /**
   * تأخير
   * @param {number} ms - عدد المللي ثانية
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * إرسال مجموعة محددة من الأسئلة
   * @param {string} conversationId - معرف المحادثة
   * @param {string} intent - نوع الـ intent (اختياري)
   * @param {string} difficulty - مستوى الصعوبة (اختياري)
   * @param {Object} options - خيارات الإرسال
   * @returns {Promise<Object>} - نتائج الاختبار
   */
  async sendTestQuestionsByFilter(conversationId, intent = null, difficulty = null, options = {}) {
    try {
      // جلب أسئلة الاختبار
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const testQuestionGenerator = require('./testQuestionGenerator');
      const testQuestionsData = await testQuestionGenerator.generateTestQuestions(conversation.companyId);

      // فلترة الأسئلة
      let questions = [];
      
      if (intent) {
        questions = testQuestionsData.questions[intent] || [];
      } else {
        // جمع جميع الأسئلة
        Object.values(testQuestionsData.questions).forEach(intentQuestions => {
          questions = questions.concat(intentQuestions);
        });
      }

      // فلترة حسب الصعوبة
      if (difficulty) {
        questions = questions.filter(q => q.difficulty === difficulty);
      }

      // إرسال الأسئلة
      return await this.sendTestMessages(conversationId, questions, options);

    } catch (error) {
      console.error('❌ Error in sendTestQuestionsByFilter:', error);
      throw error;
    }
  }
}

module.exports = new TestMessageSender();


import React, { useState, useEffect, useRef } from 'react';
import {
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  CpuChipIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
  Squares2X2Icon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { testChatService, TestConversation, TestMessage, AITestResponse } from '../../services/testChatService';
import CompanyProtectedRoute from '../../components/protection/CompanyProtectedRoute';

// إضافة معلومات الرد إلى TestMessage
interface ExtendedTestMessage extends TestMessage {
  aiResponseInfo?: AITestResponse;
}

// واجهة للدردشة المفتوحة
interface OpenChat {
  conversation: TestConversation;
  messages: ExtendedTestMessage[];
  newMessage: string;
  sending: boolean;
  isAiTyping: boolean;
  error: string | null;
}

const AITestChatContent: React.FC = () => {
  const [conversations, setConversations] = useState<TestConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<TestConversation | null>(null);
  const [messages, setMessages] = useState<ExtendedTestMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<TestConversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  
  // ✅ NEW: حالة الدردشات المتعددة
  const [openChats, setOpenChats] = useState<Map<string, OpenChat>>(new Map());
  const [multiChatMode, setMultiChatMode] = useState(false);
  const [sendingToAll, setSendingToAll] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // تحميل المحادثات
  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Loading test conversations...');
      const result = await testChatService.getConversations();
      console.log('✅ Test conversations loaded:', result.data.length);
      setConversations(result.data);
    } catch (error: any) {
      console.error('❌ Error loading conversations:', error);
      setError(error.message || 'فشل في تحميل المحادثات');
    } finally {
      setLoading(false);
    }
  };

  // تحميل الرسائل
  const loadMessages = async (conversationId: string) => {
    try {
      console.log('🔄 Loading messages for conversation:', conversationId);
      const messagesData = await testChatService.getMessages(conversationId);
      console.log('✅ Messages loaded:', messagesData.length);
      console.log('🔍 [FRONTEND] Messages with aiResponseInfo:', messagesData.filter(msg => msg.aiResponseInfo));
      setMessages(messagesData.map(msg => {
        const mappedMsg = {
          ...msg,
          timestamp: new Date(msg.timestamp)
        };
        if (msg.aiResponseInfo) {
          console.log('✅ [FRONTEND] Message has aiResponseInfo:', msg.id, msg.aiResponseInfo);
        }
        return mappedMsg;
      }));
      
      // التمرير للأسفل
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error('❌ Error loading messages:', error);
    }
  };

  // إرسال رسالة
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);
    setIsAiTyping(true);

    // إضافة رسالة المستخدم مؤقتاً
    const tempUserMessage: ExtendedTestMessage = {
      id: `temp_user_${Date.now()}`,
      content: messageContent,
      senderId: 'user',
      senderName: 'أنت',
      timestamp: new Date(),
      type: 'text',
      isFromCustomer: true,
      status: 'sending',
      conversationId: selectedConversation.id
    };

    setMessages(prev => [...prev, tempUserMessage]);

    // التمرير للأسفل
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      console.log('📤 Sending message to test chat:', messageContent);
      const result = await testChatService.sendMessage(selectedConversation.id, messageContent);
      console.log('✅ Message sent, AI response:', result);

      // تحديث رسالة المستخدم
      setMessages(prev => prev.map(msg => 
        msg.id === tempUserMessage.id 
          ? { ...result.userMessage, timestamp: new Date(result.userMessage.timestamp) }
          : msg
      ));

      // إضافة رد AI إذا كان موجوداً
      if (result.aiMessage) {
        // ✅ FIX: استخدام aiResponseInfo من aiMessage أولاً، ثم من aiResponse
        const aiMessageWithInfo: ExtendedTestMessage = {
          ...result.aiMessage,
          timestamp: new Date(result.aiMessage.timestamp),
          aiResponseInfo: result.aiMessage.aiResponseInfo || result.aiResponse || undefined
        };
        console.log('✅ [FRONTEND] Adding AI message with aiResponseInfo:', aiMessageWithInfo.aiResponseInfo);
        setMessages(prev => [...prev, aiMessageWithInfo]);

        // تحديث آخر رسالة في المحادثة
        setConversations(prev => prev.map(conv =>
          conv.id === selectedConversation.id
            ? {
                ...conv,
                lastMessage: result.aiMessage?.content || messageContent,
                lastMessageTime: new Date()
              }
            : conv
        ));
      } else if (result.aiResponse?.silent) {
        // النظام صامت - إضافة رسالة إعلامية
        const silentMessage: ExtendedTestMessage = {
          id: `silent_${Date.now()}`,
          content: '🤐 النظام صامت - لم يتم إرسال رد للعميل',
          senderId: 'system',
          senderName: 'النظام',
          timestamp: new Date(),
          type: 'text',
          isFromCustomer: false,
          status: 'sent',
          conversationId: selectedConversation.id,
          aiResponseInfo: result.aiResponse
        };
        setMessages(prev => [...prev, silentMessage]);
      }

      // التمرير للأسفل بعد إضافة الرد
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      
      // تحديث حالة الرسالة إلى خطأ
      setMessages(prev => prev.map(msg =>
        msg.id === tempUserMessage.id
          ? { ...msg, status: 'error' }
          : msg
      ));
      
      alert(`❌ فشل في إرسال الرسالة:\n\n${error.message}`);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
      setIsAiTyping(false);
    }
  };

  // اختيار محادثة
  const selectConversation = async (conversation: TestConversation) => {
    console.log('🎯 Selecting conversation:', conversation.id);
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);
  };

  // ✅ NEW: فتح دردشة جديدة في نافذة منفصلة
  const openChatInNewWindow = async (conversation: TestConversation) => {
    const messagesData = await testChatService.getMessages(conversation.id);
    const chatData: OpenChat = {
      conversation,
      messages: messagesData.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })),
      newMessage: '',
      sending: false,
      isAiTyping: false,
      error: null
    };
    
    setOpenChats(prev => {
      const newMap = new Map(prev);
      newMap.set(conversation.id, chatData);
      return newMap;
    });
    
    if (!multiChatMode) {
      setMultiChatMode(true);
    }
  };

  // ✅ NEW: إغلاق دردشة من النوافذ المتعددة
  const closeChatWindow = (conversationId: string) => {
    setOpenChats(prev => {
      const newMap = new Map(prev);
      newMap.delete(conversationId);
      return newMap;
    });
    
    // إذا لم يعد هناك دردشات مفتوحة، إيقاف وضع الدردشات المتعددة
    if (openChats.size === 1) {
      setMultiChatMode(false);
    }
  };

  // ✅ NEW: إرسال رسالة لدردشة محددة في وضع الدردشات المتعددة
  const sendMessageToChat = async (conversationId: string, messageContent: string) => {
    const chat = openChats.get(conversationId);
    if (!chat || !messageContent.trim()) return;

    // تحديث حالة الإرسال
    setOpenChats(prev => {
      const newMap = new Map(prev);
      const updatedChat = { ...chat, sending: true, isAiTyping: true, newMessage: '' };
      newMap.set(conversationId, updatedChat);
      return newMap;
    });

    // إضافة رسالة المستخدم مؤقتاً
    const tempUserMessage: ExtendedTestMessage = {
      id: `temp_user_${Date.now()}_${conversationId}`,
      content: messageContent,
      senderId: 'user',
      senderName: 'أنت',
      timestamp: new Date(),
      type: 'text',
      isFromCustomer: true,
      status: 'sending',
      conversationId
    };

    setOpenChats(prev => {
      const newMap = new Map(prev);
      const chat = newMap.get(conversationId);
      if (chat) {
        newMap.set(conversationId, {
          ...chat,
          messages: [...chat.messages, tempUserMessage]
        });
      }
      return newMap;
    });

    try {
      const result = await testChatService.sendMessage(conversationId, messageContent);
      
      // تحديث رسالة المستخدم
      setOpenChats(prev => {
        const newMap = new Map(prev);
        const chat = newMap.get(conversationId);
        if (chat) {
          const updatedMessages = chat.messages.map(msg =>
            msg.id === tempUserMessage.id
              ? { ...result.userMessage, timestamp: new Date(result.userMessage.timestamp) }
              : msg
          );

          // إضافة رد AI إذا كان موجوداً
          if (result.aiMessage) {
            const aiMessageWithInfo: ExtendedTestMessage = {
              ...result.aiMessage,
              timestamp: new Date(result.aiMessage.timestamp),
              aiResponseInfo: result.aiResponse || undefined
            };
            updatedMessages.push(aiMessageWithInfo);
          } else if (result.aiResponse?.silent) {
            const silentMessage: ExtendedTestMessage = {
              id: `silent_${Date.now()}_${conversationId}`,
              content: '🤐 النظام صامت - لم يتم إرسال رد للعميل',
              senderId: 'system',
              senderName: 'النظام',
              timestamp: new Date(),
              type: 'text',
              isFromCustomer: false,
              status: 'sent',
              conversationId,
              aiResponseInfo: result.aiResponse
            };
            updatedMessages.push(silentMessage);
          }

          newMap.set(conversationId, {
            ...chat,
            messages: updatedMessages,
            sending: false,
            isAiTyping: false
          });
        }
        return newMap;
      });

      // تحديث آخر رسالة في قائمة المحادثات
      setConversations(prev => prev.map(conv =>
        conv.id === conversationId
          ? {
              ...conv,
              lastMessage: result.aiMessage?.content || messageContent,
              lastMessageTime: new Date()
            }
          : conv
      ));
    } catch (error: any) {
      console.error('❌ Error sending message to chat:', error);
      
      setOpenChats(prev => {
        const newMap = new Map(prev);
        const chat = newMap.get(conversationId);
        if (chat) {
          const updatedMessages = chat.messages.map(msg =>
            msg.id === tempUserMessage.id
              ? { ...msg, status: 'error' as const }
              : msg
          );
          newMap.set(conversationId, {
            ...chat,
            messages: updatedMessages,
            sending: false,
            isAiTyping: false,
            error: error.message,
            newMessage: messageContent
          });
        }
        return newMap;
      });
    }
  };

  // ✅ NEW: إرسال رسالة لجميع الدردشات المفتوحة
  const sendMessageToAllChats = async (messageContent: string) => {
    if (!messageContent.trim() || openChats.size === 0 || sendingToAll) return;

    setSendingToAll(true);
    const promises = Array.from(openChats.keys()).map(conversationId =>
      sendMessageToChat(conversationId, messageContent)
    );

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('❌ Error sending messages to all chats:', error);
    } finally {
      setSendingToAll(false);
    }
  };

  // إنشاء محادثة جديدة
  const createNewConversation = async () => {
    try {
      console.log('➕ Creating new test conversation...');
      const newConv = await testChatService.createConversation();
      console.log('✅ New conversation created:', newConv.id);
      await loadConversations();
      await selectConversation(newConv);
    } catch (error: any) {
      console.error('❌ Error creating conversation:', error);
      alert(`❌ فشل في إنشاء محادثة جديدة:\n\n${error.message}`);
    }
  };

  // فتح modal الحذف
  const openDeleteModal = (conversation: TestConversation) => {
    setConversationToDelete(conversation);
    setShowDeleteModal(true);
  };

  // إغلاق modal الحذف
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setConversationToDelete(null);
  };

  // حذف محادثة
  const deleteConversation = async () => {
    if (!conversationToDelete) return;

    setDeleting(true);
    try {
      await testChatService.deleteConversation(conversationToDelete.id);
      console.log('✅ Conversation deleted:', conversationToDelete.id);
      
      // إزالة المحادثة من القائمة
      setConversations(prev => prev.filter(conv => conv.id !== conversationToDelete.id));
      
      // إذا كانت المحادثة المحذوفة هي المختارة، اختر الأولى أو امسح الاختيار
      if (selectedConversation?.id === conversationToDelete.id) {
        if (conversations.length > 1) {
          const remaining = conversations.filter(conv => conv.id !== conversationToDelete.id);
          if (remaining.length > 0) {
            await selectConversation(remaining[0]);
          } else {
            setSelectedConversation(null);
            setMessages([]);
          }
        } else {
          setSelectedConversation(null);
          setMessages([]);
        }
      }
      
      closeDeleteModal();
    } catch (error: any) {
      console.error('❌ Error deleting conversation:', error);
      alert(`❌ فشل في حذف المحادثة:\n\n${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // تشغيل تحليل شامل
  const runAnalysisAndFix = async () => {
    try {
      setRunningTest(true);
      setError(null);
      
      console.log('🔍 بدء تحليل شامل...');
      
      // تشغيل التحليل
      const analysisData = await testChatService.analyzeAndFix();
      
      console.log('✅ تم إكمال التحليل:', analysisData);
      setTestResults(analysisData);
      
      // تحميل المحادثات
      await loadConversations();
      
      // فتح المحادثة
      if (analysisData.conversationId) {
        const conversations = await testChatService.getConversations();
        const conversation = conversations.data.find(
          conv => conv.id === analysisData.conversationId
        );
        
        if (conversation) {
          await selectConversation(conversation);
          await loadMessages(analysisData.conversationId);
        }
      }
      
      // عرض النتائج
      const summary = analysisData.summary;
      const problemsCount = analysisData.problems.length;
      const fixesCount = analysisData.fixes.length;
      
      alert(`✅ تم إكمال التحليل الشامل!\n\n` +
            `📊 النتائج:\n` +
            `   إجمالي الأسئلة: ${analysisData.totalQuestions}\n` +
            `   تم التحليل: ${analysisData.analyzed}\n` +
            `   المشاكل المكتشفة: ${problemsCount}\n` +
            `   الحلول المقترحة: ${fixesCount}\n\n` +
            `📈 الإحصائيات:\n` +
            `   نسبة النجاح: ${summary.successRate}%\n` +
            `   نسبة المشاكل: ${summary.problemRate}%\n\n` +
            `💡 التحسينات: ${analysisData.improvements.length}`);
      
    } catch (error: any) {
      console.error('❌ خطأ في التحليل:', error);
      setError(error.message || 'فشل في التحليل');
      alert(`❌ فشل في التحليل:\n\n${error.message}`);
    } finally {
      setRunningTest(false);
    }
  };

  // تشغيل اختبار سريع
  const runQuickTest = async () => {
    try {
      setRunningTest(true);
      setError(null);
      
      console.log('🚀 بدء اختبار سريع...');
      
      // تشغيل الاختبار (الـ API سينشئ المحادثة تلقائياً)
      const testData = await testChatService.runQuickTest({
        questionCount: 8
      });
      
      console.log('✅ تم إكمال الاختبار:', testData);
      setTestResults(testData);
      
      // تحميل المحادثات لتحديث القائمة
      await loadConversations();
      
      // البحث عن المحادثة الجديدة وفتحها
      const conversations = await testChatService.getConversations();
      const newConversation = conversations.data.find(
        conv => conv.id === testData.conversationId
      );
      
      if (newConversation) {
        await selectConversation(newConversation);
        await loadMessages(testData.conversationId);
      }
      
      // عرض النتائج
      const results = testData.results;
      const quality = testData.qualityCheck;
      const successRate = ((results.succeeded / results.totalQuestions) * 100).toFixed(1);
      const qualityRate = quality.withResponse > 0 
        ? ((quality.appropriate / quality.withResponse) * 100).toFixed(1)
        : '0';
      
      alert(`✅ تم إكمال الاختبار!\n\n` +
            `📊 النتائج:\n` +
            `   إجمالي الأسئلة: ${results.totalQuestions}\n` +
            `   ✅ نجح: ${results.succeeded}\n` +
            `   ❌ فشل: ${results.failed}\n` +
            `   🤐 صامت: ${results.silent}\n` +
            `   📈 نسبة النجاح: ${successRate}%\n\n` +
            `🎯 الجودة:\n` +
            `   ✅ ردود مناسبة: ${quality.appropriate}\n` +
            `   ⚠️  ردود غير مناسبة: ${quality.inappropriate}\n` +
            `   📊 نسبة الجودة: ${qualityRate}%\n` +
            `   ⏱️  متوسط وقت المعالجة: ${quality.averageProcessingTime}ms`);
      
    } catch (error: any) {
      console.error('❌ خطأ في تشغيل الاختبار:', error);
      setError(error.message || 'فشل في تشغيل الاختبار');
      alert(`❌ فشل في تشغيل الاختبار:\n\n${error.message}`);
    } finally {
      setRunningTest(false);
    }
  };

  // تحميل المحادثات عند بدء التطبيق
  useEffect(() => {
    loadConversations();
  }, []);

  // فلترة المحادثات
  const filteredConversations = conversations.filter(conv =>
    conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // تنسيق الوقت
  const formatTime = (date: Date | string) => {
    // تحويل string إلى Date إذا لزم الأمر
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // التحقق من صحة التاريخ
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '--:--';
    }
    
    return dateObj.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // تنسيق التاريخ
  const formatDate = (date: Date | string) => {
    // تحويل string إلى Date إذا لزم الأمر
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // التحقق من صحة التاريخ
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '--';
    }
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateObj.toDateString() === today.toDateString()) {
      return 'اليوم';
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      return 'أمس';
    } else {
      return dateObj.toLocaleDateString('ar-SA');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل محادثات الاختبار...</p>
        </div>
      </div>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">❌</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadConversations}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* قائمة المحادثات */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* رأس قائمة المحادثات */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <SparklesIcon className="w-6 h-6 text-blue-600" />
              اختبار الرد
            </h2>
          </div>

          {/* زر إنشاء محادثة جديدة */}
          <button
            onClick={createNewConversation}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-2 flex items-center justify-center gap-2"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
            محادثة جديدة
          </button>

          {/* ✅ NEW: زر تفعيل وضع الدردشات المتعددة */}
          <button
            onClick={() => {
              if (multiChatMode) {
                setMultiChatMode(false);
                setOpenChats(new Map());
              } else {
                setMultiChatMode(true);
              }
            }}
            className={`w-full px-4 py-2 rounded-lg transition-colors mb-2 flex items-center justify-center gap-2 ${
              multiChatMode
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            <Squares2X2Icon className="w-5 h-5" />
            {multiChatMode ? 'إغلاق وضع الدردشات المتعددة' : 'فتح عدة دردشات'}
          </button>

          {/* زر تشغيل اختبار سريع */}
          <button
            onClick={runQuickTest}
            disabled={runningTest}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mb-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runningTest ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                جاري الاختبار...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                اختبار سريع
              </>
            )}
          </button>

          {/* زر تحليل شامل */}
          <button
            onClick={runAnalysisAndFix}
            disabled={runningTest}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mb-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runningTest ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                جاري التحليل...
              </>
            ) : (
              <>
                <CpuChipIcon className="w-5 h-5" />
                تحليل شامل وإصلاح
              </>
            )}
          </button>

          {/* شريط البحث */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث في المحادثات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* قائمة المحادثات */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'لا توجد نتائج' : 'لا توجد محادثات'}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => multiChatMode ? openChatInNewWindow(conversation) : selectConversation(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConversation?.id === conversation.id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''
                } ${openChats.has(conversation.id) ? 'bg-orange-50 border-r-4 border-r-orange-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {conversation.customerName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        {conversation.customerName}
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          اختبار
                        </span>
                        {openChats.has(conversation.id) && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            مفتوحة
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {formatDate(conversation.lastMessageTime)} • {formatTime(conversation.lastMessageTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {multiChatMode && openChats.has(conversation.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeChatWindow(conversation.id);
                        }}
                        className="p-1 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded transition-colors"
                        title="إغلاق النافذة"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(conversation);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="حذف المحادثة"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 truncate">
                  {conversation.lastMessage}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* منطقة المحادثة */}
      <div className="flex-1 flex flex-col">
        {multiChatMode && openChats.size > 0 ? (
          /* ✅ NEW: عرض الدردشات المتعددة */
          <div className="flex-1 flex flex-col bg-gray-50">
            {/* رأس الدردشات المتعددة */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Squares2X2Icon className="w-6 h-6 text-orange-600" />
                  <h3 className="font-bold text-gray-900">
                    الدردشات المتعددة ({openChats.size})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {sendingToAll && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      <span className="text-sm">جاري الإرسال لجميع الدردشات...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* شبكة الدردشات */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className={`grid gap-4 ${openChats.size === 1 ? 'grid-cols-1' : openChats.size === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {Array.from(openChats.values()).map((chat) => (
                  <div key={chat.conversation.id} className="bg-white rounded-lg border border-gray-200 flex flex-col h-[600px]">
                    {/* رأس الدردشة */}
                    <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {chat.conversation.customerName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-gray-900">{chat.conversation.customerName}</h4>
                          {chat.sending && (
                            <p className="text-xs text-blue-600">جاري الإرسال...</p>
                          )}
                          {chat.isAiTyping && (
                            <p className="text-xs text-green-600">AI يكتب...</p>
                          )}
                          {chat.error && (
                            <p className="text-xs text-red-600">❌ {chat.error}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => closeChatWindow(chat.conversation.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="إغلاق"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* الرسائل */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {chat.messages.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm mt-4">
                          لا توجد رسائل
                        </div>
                      ) : (
                        chat.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.isFromCustomer ? 'justify-start' : 'justify-end'}`}
                          >
                            <div
                              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                                message.isFromCustomer
                                  ? 'bg-gray-100 text-gray-800'
                                  : message.content.includes('النظام صامت')
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-blue-500 text-white'
                              }`}
                            >
                              <p>{message.content}</p>
                              {message.aiResponseInfo && (
                                <div className="mt-1 pt-1 border-t border-white/20 text-xs opacity-90">
                                  {message.aiResponseInfo.model && (
                                    <div>🤖 {message.aiResponseInfo.model}</div>
                                  )}
                                  {message.aiResponseInfo.processingTime && (
                                    <div>⏱️ {message.aiResponseInfo.processingTime}ms</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      {chat.isAiTyping && (
                        <div className="flex justify-end">
                          <div className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm">
                            <div className="flex items-center gap-2">
                              <CpuChipIcon className="w-4 h-4" />
                              <span>AI يكتب...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* إدخال الرسالة */}
                    <div className="border-t border-gray-200 p-3">
                      <div className="flex items-center gap-2">
                        <textarea
                          value={chat.newMessage}
                          onChange={(e) => {
                            setOpenChats(prev => {
                              const newMap = new Map(prev);
                              const updatedChat = { ...chat, newMessage: e.target.value };
                              newMap.set(chat.conversation.id, updatedChat);
                              return newMap;
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendMessageToChat(chat.conversation.id, chat.newMessage);
                            }
                          }}
                          placeholder="اكتب رسالتك..."
                          rows={1}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          disabled={chat.sending}
                        />
                        <button
                          onClick={() => sendMessageToChat(chat.conversation.id, chat.newMessage)}
                          disabled={!chat.newMessage.trim() || chat.sending}
                          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {chat.sending ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <PaperAirplaneIcon className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ✅ NEW: إرسال لجميع الدردشات */}
            {openChats.size > 1 && (
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-center gap-2">
                  <textarea
                    placeholder={`إرسال رسالة لجميع الدردشات (${openChats.size})...`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const textarea = e.target as HTMLTextAreaElement;
                        sendMessageToAllChats(textarea.value);
                        textarea.value = '';
                      }
                    }}
                    rows={1}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    disabled={sendingToAll}
                  />
                  <button
                    onClick={(e) => {
                      const textarea = (e.target as HTMLElement).parentElement?.querySelector('textarea') as HTMLTextAreaElement;
                      if (textarea) {
                        sendMessageToAllChats(textarea.value);
                        textarea.value = '';
                      }
                    }}
                    disabled={sendingToAll}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {sendingToAll ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="w-5 h-5" />
                        إرسال للجميع
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : selectedConversation ? (
          <>
            {/* رأس المحادثة */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedConversation.customerName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      {selectedConversation.customerName}
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        اختبار
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500">محادثة اختبار مع الذكاء الاصطناعي</p>
                  </div>
                </div>
              </div>
            </div>

            {/* منطقة الرسائل */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>لا توجد رسائل في هذه المحادثة</p>
                  <p className="text-sm mt-2">ابدأ بإرسال رسالة لاختبار الذكاء الاصطناعي</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isFromCustomer ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.isFromCustomer
                          ? 'bg-white border border-gray-200 text-gray-800'
                          : message.content.includes('النظام صامت')
                          ? 'bg-yellow-100 border border-yellow-300 text-yellow-800'
                          : message.isAiGenerated
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      
                      {/* عرض معلومات الرد AI */}
                      {message.aiResponseInfo && (
                        <div className="mt-2 pt-2 border-t border-white/20">
                          <div className="text-xs opacity-90 space-y-1">
                            {message.aiResponseInfo.model && (
                              <div className="flex items-center gap-1">
                                <CpuChipIcon className="w-3 h-3" />
                                <span>النموذج: {message.aiResponseInfo.model}</span>
                              </div>
                            )}
                            {message.aiResponseInfo.processingTime && (
                              <div>⏱️ الوقت: {message.aiResponseInfo.processingTime}ms</div>
                            )}
                            {message.aiResponseInfo.intent && (
                              <div>🎯 النية: {message.aiResponseInfo.intent}</div>
                            )}
                            {message.aiResponseInfo.sentiment && (
                              <div>😊 المشاعر: {message.aiResponseInfo.sentiment}</div>
                            )}
                            {message.aiResponseInfo.confidence && (
                              <div>📊 الثقة: {(message.aiResponseInfo.confidence * 100).toFixed(0)}%</div>
                            )}
                            {message.aiResponseInfo.silent && (
                              <div className="text-yellow-300 font-semibold">🤐 النظام صامت</div>
                            )}
                            {message.aiResponseInfo.error && (
                              <div className="text-red-300 font-semibold">❌ خطأ: {message.aiResponseInfo.error}</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-xs mt-1 opacity-70">
                        <div className="flex items-center gap-1">
                          {!message.isFromCustomer && (
                            message.isAiGenerated ? (
                              <CpuChipIcon className="w-3 h-3" title="رد من الذكاء الاصطناعي" />
                            ) : (
                              <UserIcon className="w-3 h-3" title="رد يدوي" />
                            )
                          )}
                          <span>{message.senderName}</span>
                          {!message.isFromCustomer && message.isAiGenerated && (
                            <span> • 🤖 AI</span>
                          )}
                          <span> • {formatTime(message.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* مؤشر كتابة AI */}
              {isAiTyping && (
                <div className="flex justify-end">
                  <div className="bg-green-500 text-white px-4 py-2 rounded-lg max-w-xs">
                    <div className="flex items-center gap-2">
                      <CpuChipIcon className="w-4 h-4" />
                      <span className="text-xs">الذكاء الاصطناعي يكتب...</span>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* منطقة إدخال الرسالة */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="اكتب رسالتك هنا... (Enter للإرسال)"
                  rows={1}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  style={{ minHeight: '42px', maxHeight: '120px' }}
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <PaperAirplaneIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <SparklesIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2 text-gray-700">اختر محادثة للبدء</h3>
              <p className="text-gray-500">أو أنشئ محادثة جديدة لاختبار الذكاء الاصطناعي</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && conversationToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600 ml-2" />
              <h3 className="text-lg font-semibold text-gray-900">تأكيد حذف المحادثة</h3>
            </div>

            <p className="text-gray-600 mb-6">
              هل أنت متأكد من حذف محادثة الاختبار؟
              <br />
              <span className="text-red-600 text-sm">
                ⚠️ سيتم حذف جميع الرسائل نهائياً ولا يمكن استرجاعها.
              </span>
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={deleteConversation}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4 ml-2" />
                    حذف نهائياً
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// المكون الرئيسي مع الحماية
const AITestChat: React.FC = () => {
  return (
    <CompanyProtectedRoute>
      <AITestChatContent />
    </CompanyProtectedRoute>
  );
};

export default AITestChat;


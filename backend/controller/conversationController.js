const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('../services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
const socketService = require('../services/socketService');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const MessageHealthChecker = require('../utils/messageHealthChecker');
// Import production Facebook fix functions
const { sendProductionFacebookMessage } = require('../utils/production-facebook-fix');
// Import cache invalidation utility
const { conversationCache } = require('../utils/cachingUtils');
const telegramBotService = require('../services/TelegramBotService');

// Add this cache for page tokens (same as backend)
const pageTokenCache = require('../utils/pageTokenCache');

// Track messages that have been processed to prevent duplicates
const processedMessages = new Set();

// دالة للتحقق من صحة محتوى الرسالة
function isValidMessageContent(content) {
  if (!content) return false;
  const trimmed = content.trim();
  // تجاهل الرسائل الفارغة أو التي تحتوي فقط على علامات التوصيل أو مسافات
  if (trimmed.length === 0) return false;
  // تجاهل الرسائل التي تحتوي فقط على علامات ✓✗×
  if (/^[✓✗×\s]+$/.test(trimmed)) return false;
  return true;
}

function updatePageTokenCache(pageId, pageAccessToken, pageName, companyId) {
  pageTokenCache.set(pageId, {
    pageAccessToken: pageAccessToken,
    pageName: pageName,
    companyId: companyId,
    lastUsed: Date.now()
  });

  //console.log(`💾 [PAGE-CACHE] تم تحديث cache للصفحة: ${pageName} (${pageId}) - شركة: ${companyId}`);
}

async function getPageToken(pageId) {
  // 🔒 CRITICAL FIX: Always check database for status, even if cached
  // This ensures disconnected pages are not used
  try {
    const page = await getSharedPrismaClient().facebookPage.findUnique({
      where: { pageId: pageId }
    });

    // Check if page exists and is connected
    if (!page) {
      //console.log(`⚠️ [PAGE-CACHE] Page ${pageId} not found in database`);
      // Remove from cache if exists
      if (pageTokenCache.has(pageId)) {
        pageTokenCache.delete(pageId);
        //console.log(`🗑️ [PAGE-CACHE] Removed ${pageId} from cache`);
      }
      return null;
    }

    // 🔒 CRITICAL: Check if page is disconnected
    if (page.status === 'disconnected') {
      //console.log(`❌ [PAGE-CACHE] Page ${page.pageName} (${pageId}) is DISCONNECTED - cannot use`);
      //console.log(`   Disconnected at: ${page.disconnectedAt}`);
      // Remove from cache if exists
      if (pageTokenCache.has(pageId)) {
        pageTokenCache.delete(pageId);
        //console.log(`🗑️ [PAGE-CACHE] Removed disconnected page from cache`);
      }
      return null;
    }

    // Page is connected - update cache and return
    if (page.pageAccessToken) {
      updatePageTokenCache(pageId, page.pageAccessToken, page.pageName, page.companyId);
      ////console.log(`✅ [PAGE-CACHE] Using connected page: ${page.pageName}`);
      return {
        pageAccessToken: page.pageAccessToken,
        pageName: page.pageName,
        companyId: page.companyId,
        status: page.status,
        lastUsed: Date.now()
      };
    }
  } catch (error) {
    console.error(`❌ [PAGE-CACHE] خطأ في البحث عن الصفحة ${pageId}:`, error);
  }

  return null;
}

// Global variable to store last webhook page ID (same as backend)
let lastWebhookPageId = null;

const deleteConverstation = async (req, res) => {
  try {
    const { id } = req.params;

    //console.log(`🗑️ Attempting to delete conversation: ${id}`);

    // Check if conversation exists
    const conversation = await getSharedPrismaClient().conversation.findUnique({
      where: { id },
      include: {
        customer: true,
        _count: {
          select: { messages: true }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة'
      });
    }

    // Delete all messages first (due to foreign key constraints)
    const deletedMessages = await getSharedPrismaClient().message.deleteMany({
      where: { conversationId: id }
    });

    // Delete conversation memory
    await getSharedPrismaClient().conversationMemory.deleteMany({
      where: { conversationId: id }
    });

    // Delete the conversation
    await getSharedPrismaClient().conversation.delete({
      where: { id }
    });

    //console.log(`✅ Deleted conversation ${id} with ${deletedMessages.count} messages`);

    res.json({
      success: true,
      message: 'تم حذف المحادثة بنجاح',
      data: {
        deletedConversation: {
          id: conversation.id,
          customerName: conversation.customer?.firstName || 'عميل غير معروف'
        },
        deletedMessagesCount: deletedMessages.count
      }
    });

  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ في الخادم',
      message: error.message
    });
  }
};

const postMessageConverstation = async (req, res) => {
  const startTime = Date.now(); // ⚡ Track performance
  try {
    //console.log(`🔥 POST /api/v1/conversations/${req.params.id}/messages received`);
    //console.log(`📦 Request body:`, req.body);

    const { id } = req.params;
    const { message, replyTo } = req.body;

    if (!message) {
      //console.log(`❌ No message content provided`);
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // التحقق من صحة محتوى الرسالة
    if (!isValidMessageContent(message)) {
      //console.log(`⚠️ [VALIDATION] رسالة فارغة أو غير صالحة تم رفضها: "${message}"`);
      return res.status(400).json({
        success: false,
        error: 'رسالة فارغة أو غير صالحة',
        message: 'لا يمكن إرسال رسائل فارغة أو تحتوي فقط على علامات'
      });
    }

    // Prevent duplicate processing of the same message
    const messageKey = `${id}_${message}_${Date.now()}`;
    if (processedMessages.has(messageKey)) {
      //console.log(`⚠️ Message already processed, skipping duplicate: ${messageKey}`);
      return res.status(200).json({
        success: true,
        message: 'Message already processed'
      });
    }

    // Add to processed messages set and clean up after 1 minute
    processedMessages.add(messageKey);
    setTimeout(() => {
      processedMessages.delete(messageKey);
    }, 60000);

    //console.log(`📤 Sending message to conversation ${id}: ${message}`);

    // ⚡ OPTIMIZATION: Parallel DB queries to reduce latency
    const senderId = req.user?.userId || req.user?.id;

    // 🔧 FIX: Get Prisma client early
    const prisma = getSharedPrismaClient();
    if (!prisma) {
      throw new Error('Prisma client is not initialized');
    }

    const [conversation, user] = await Promise.all([
      executeWithRetry(async () => {
        return await prisma.conversation.findUnique({
          where: { id },
          include: {
            customer: true
          }
        });
      }, 3),
      // جلب معلومات المستخدم فقط إذا كان موجود
      senderId ? executeWithRetry(async () => {
        return await prisma.user.findUnique({
          where: { id: senderId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        });
      }, 3) : Promise.resolve(null)
    ]);

    // ⚡ Parse metadata once and reuse
    let conversationMetadata = {};
    if (conversation.metadata) {
      try {
        conversationMetadata = JSON.parse(conversation.metadata);
      } catch (e) {
        console.warn('⚠️ Error parsing conversation metadata');
      }
    }

    // 🔧 FIX: استخدام userId من JWT token
    let senderName = 'موظف';

    if (req.user && senderId && user) {
      senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'موظف';

      conversationMetadata.lastSenderId = senderId; // معرف الموظف اللي بعت الرسالة
      conversationMetadata.lastSenderName = senderName; // اسم الموظف
    } else {
      console.warn(`⚠️ [SENDER-INFO] req.user or senderId is missing!`, req.user);
    }

    // ⚡ OPTIMIZATION: Combine all conversation updates into one query
    const conversationUpdateData = {
      metadata: JSON.stringify(conversationMetadata),
      updatedAt: new Date(),
      // 🆕 FIX: Mark as replied (not from customer) so it disappears from "unreplied" tab
      lastMessageIsFromCustomer: false
    };

    // 🔧 FIX: Calculate actual unread count instead of resetting to 0
    const actualUnreadCount = await executeWithRetry(async () => {
      return await prisma.message.count({
        where: {
          conversationId: id,
          isFromCustomer: true,
          isRead: false
        }
      });
    }, 3);
    conversationUpdateData.unreadCount = actualUnreadCount;

    // Add lastMessage fields if message is not empty
    if (message && message.trim() !== '') {
      conversationUpdateData.lastMessageAt = new Date();
      conversationUpdateData.lastMessagePreview = message.length > 100 ? message.substring(0, 100) + '...' : message;
    }

    // Single update query instead of 2-3 separate ones
    // 🔧 FIX: Use executeWithRetry to handle connection errors
    const updatedConversation = await executeWithRetry(async () => {
      return await prisma.conversation.update({
        where: { id },
        data: conversationUpdateData
      });
    }, 3);

    // ⚡ OPTIMIZATION: Cache invalidation moved after update
    if (conversation && conversation.companyId) {
      // Non-blocking cache invalidation
      conversationCache.invalidateConversation(id, conversation.companyId);
    }

    // 💾 حفظ الرسالة فوراً في قاعدة البيانات (INSTANT SAVE)
    let savedMessage = null;
    try {
      // 🔧 FIX: Use executeWithRetry to handle connection errors
      savedMessage = await executeWithRetry(async () => {
        return await prisma.message.create({
          data: {
            content: message,
            type: 'TEXT',
            conversationId: id,
            isFromCustomer: false,
            senderId: senderId, // معرف الموظف
            metadata: JSON.stringify({
              platform: conversation.channel ? conversation.channel.toLowerCase() : 'facebook',
              source: 'manual_reply',
              employeeId: senderId,
              employeeName: senderName,
              isFacebookReply: conversation.channel !== 'TELEGRAM',
              isTelegramReply: conversation.channel === 'TELEGRAM',
              timestamp: new Date(),
              instantSave: true, // علامة لتحديد أن هذه الرسالة تم حفظها فوراً
              ...(replyTo ? { replyTo } : {}) // Add replyTo logic
            }),
            createdAt: new Date()
          }
        });
      }, 3);

      console.log(`💾 [INSTANT-SAVE] Message saved immediately: ${savedMessage.id}`);

      // إرسال الرسالة فوراً للـ socket
      const io = socketService.getIO();
      if (io) {
        const socketData = {
          id: savedMessage.id,
          conversationId: savedMessage.conversationId,
          content: savedMessage.content,
          type: savedMessage.type.toLowerCase(),
          isFromCustomer: savedMessage.isFromCustomer,
          timestamp: savedMessage.createdAt,
          metadata: JSON.parse(savedMessage.metadata),
          senderId: senderId,
          senderName: senderName,
          lastMessageIsFromCustomer: false,
          lastCustomerMessageIsUnread: false,
          // 🏢 Company Isolation
          companyId: conversation.companyId,
          // 📱 Platform identification for filtering
          platform: conversation.channel === 'TELEGRAM' ? 'telegram' : (conversation.channel ? conversation.channel.toLowerCase() : 'facebook'),
          channel: conversation.channel || 'FACEBOOK'
        };

        // ✅ إرسال للشركة فقط - Company Isolation
        io.to(`company_${conversation.companyId}`).emit('new_message', socketData);
        console.log(`⚡ [SOCKET] Message emitted to company ${conversation.companyId}`, {
          messageId: socketData.id,
          conversationId: socketData.conversationId,
          platform: socketData.platform,
          channel: socketData.channel,
          content: socketData.content?.substring(0, 50)
        });
      }
    } catch (saveError) {
      console.error('❌ [INSTANT-SAVE] Error saving message:', saveError.message);
      // استمر في المحاولة للإرسال لفيسبوك حتى لو فشل الحفظ
    }

    // 📤 إرسال الرسالة إلى Facebook فعلياً
    let facebookSent = false;
    let facebookMessageId = null; // Store Facebook message ID
    let facebookErrorDetails = null; // Store error details for frontend
    try {
      if (conversation && conversation.customer) {
        const recipientId = conversation.customer.facebookId;

        //console.log(`🔍 [FACEBOOK-SEND] Attempting to send to recipient: ${recipientId}`);

        if (!recipientId) {
          //console.log('⚠️ No Facebook ID found for customer');
          facebookSent = false;
        } else {
          // ⚡ OPTIMIZATION: Use cached metadata (already parsed above)
          let pageData = null;
          let actualPageId = null;

          // NEW: First try to get the page ID from the conversation metadata (already parsed)
          // This ensures we reply using the same page that received the original message
          if (conversationMetadata.pageId) {
            //console.log(`🎯 [FACEBOOK-SEND] Using page ID from conversation metadata: ${conversationMetadata.pageId}`);
            const pageTokenData = await getPageToken(conversationMetadata.pageId);
            if (pageTokenData) {
              pageData = pageTokenData;
              actualPageId = conversationMetadata.pageId;
            } else {
              //console.log('⚠️ [FACEBOOK-SEND] Page token not found for metadata page ID');
            }
          }

          // أولاً: البحث عن صفحة Facebook متصلة
          if (!pageData) {
            const facebookPage = await getSharedPrismaClient().facebookPage.findFirst({
              where: {
                status: 'connected',
                companyId: conversation.companyId // 🔐 عزل الشركات
              },
              orderBy: { connectedAt: 'desc' }
            });

            if (facebookPage) {
              pageData = {
                pageAccessToken: facebookPage.pageAccessToken,
                pageName: facebookPage.pageName,
                companyId: facebookPage.companyId
              };
              actualPageId = facebookPage.pageId;
              //console.log(`✅ [FACEBOOK-SEND] Found Facebook page: ${facebookPage.pageName} (${actualPageId})`);
            } else {
              //console.log('⚠️ No connected Facebook page found for company');
            }
          }

          // ثانياً: استخدام lastWebhookPageId كبديل
          if (!pageData && lastWebhookPageId) {
            const pageTokenData = await getPageToken(lastWebhookPageId);
            if (pageTokenData) {
              pageData = pageTokenData;
              actualPageId = lastWebhookPageId;
              //console.log(`🔄 [FACEBOOK-SEND] Using last webhook page: ${lastWebhookPageId}`);
            }
          }

          if (pageData && pageData.pageAccessToken && actualPageId) {
            // GUARD: PSID/Page mismatch — if conversation metadata contains pageId and it's different from selected page
            if (conversationMetadata.pageId && conversationMetadata.pageId !== actualPageId) {
              console.warn(`⚠️ [GUARD] PSID/Page mismatch: metadata.pageId=${conversationMetadata.pageId} actualPageId=${actualPageId}`);
              facebookSent = false;
              facebookErrorDetails = {
                success: false,
                error: 'PSID_PAGE_MISMATCH',
                message: 'PSID لا يخص هذه الصفحة. استخدم نفس الصفحة التي استقبلت رسالة العميل.'
              };
            } else {
              //console.log(`📤 [FACEBOOK-SEND] Sending message via Facebook API...`);

              // استخدام دالة الإرسال المحسنة
              // 🔧 FIX: استخدم نفس الطريقة التي تستخدمها الصور للإرسال
              const { sendProductionFacebookMessage } = require('../utils/production-facebook-fix');
              const response = await sendProductionFacebookMessage(
                recipientId,
                message,
                'TEXT',
                actualPageId,
                pageData.pageAccessToken
              );

              facebookSent = response.success;
              facebookMessageId = response.messageId; // Store Facebook message ID
              facebookErrorDetails = response; // Store full error details
              //console.log(`📤 [FACEBOOK-SEND] Facebook message sent: ${facebookSent}`);

              // 🔄 تحديث الرسالة المحفوظة بـ Facebook Message ID
              if (facebookSent && facebookMessageId && savedMessage) {
                try {
                  await getSharedPrismaClient().message.update({
                    where: { id: savedMessage.id },
                    data: {
                      metadata: JSON.stringify({
                        ...JSON.parse(savedMessage.metadata),
                        facebookMessageId: facebookMessageId,
                        sentToFacebook: true
                      })
                    }
                  });
                  console.log(`✅ [UPDATE] Message ${savedMessage.id} updated with Facebook ID: ${facebookMessageId}`);
                } catch (updateError) {
                  console.error('⚠️ [UPDATE] Failed to update message with Facebook ID:', updateError.message);
                }
              }

              // NEW: Handle Facebook errors more gracefully
              if (!facebookSent && response.error === 'RECIPIENT_NOT_AVAILABLE') {
                await getSharedPrismaClient().conversation.update({
                  where: { id },
                  data: {
                    metadata: JSON.stringify({
                      ...conversation.metadata ? JSON.parse(conversation.metadata) : {},
                      facebookSendError: 'RECIPIENT_NOT_AVAILABLE',
                      facebookErrorMessage: 'هذا الشخص غير متاح حاليًا. اطلب من العميل إرسال رسالة جديدة أو تأكد أنه لم يحظر الصفحة.',
                      lastFacebookErrorAt: new Date().toISOString(),
                      notMessageable: true,
                      unmessageableReason: 'fb_551_1545041'
                    })
                  }
                });
              }
              // NEW: Handle the specific Facebook error 2018001 more gracefully
              if (!facebookSent && response.error === 'NO_MATCHING_USER') {
                //console.log(`⚠️ [FACEBOOK-SEND] User hasn't started conversation with page`);

                // Update the conversation to indicate this issue
                await getSharedPrismaClient().conversation.update({
                  where: { id },
                  data: {
                    metadata: JSON.stringify({
                      ...conversation.metadata ? JSON.parse(conversation.metadata) : {},
                      facebookSendError: 'USER_NOT_STARTED_CONVERSATION',
                      facebookErrorMessage: 'العميل لم يبدأ محادثة مع الصفحة',
                      lastFacebookErrorAt: new Date().toISOString()
                    })
                  }
                });
              } else if (!facebookSent) {
                console.error(`❌ [FACEBOOK-SEND] Failed to send: ${response.message}`);
                if (response.solutions) {
                  //console.log('🔧 [FACEBOOK-SEND] Solutions:');
                  response.solutions.forEach(solution => {
                    //console.log(`   - ${solution}`);
                  });
                }
              } else {
                //console.log(`✅ [FACEBOOK-SEND] Message sent successfully - will be saved via echo`);
              }
            }
          } else {
            //console.log('⚠️ [FACEBOOK-SEND] No valid page access token or page ID available');
            //console.log(`   - Page Data: ${!!pageData}`);
            //console.log(`   - Page Access Token: ${!!pageData?.pageAccessToken}`);
            //console.log(`   - Actual Page ID: ${actualPageId}`);
            //console.log(`   - Last Webhook Page ID: ${lastWebhookPageId}`);
          }
        }
      } else {
        //console.log('⚠️ [FACEBOOK-SEND] Conversation or customer not found');
      }
    } catch (fbError) {
      console.error('❌ [FACEBOOK-SEND] Error sending Facebook message:', fbError);
      facebookErrorDetails = {
        success: false,
        error: 'FACEBOOK_SEND_ERROR',
        message: fbError.message,
        details: 'حدث خطأ أثناء إرسال الرسالة إلى فيسبوك'
      };
      // Don't fail the whole operation if Facebook sending fails
    }

    // 🚀 TELEGRAM SENDING LOGIC
    let telegramSent = false;
    if (conversation && conversation.channel === 'TELEGRAM') {
      const telegramResult = await telegramBotService.sendReply(id, message);
      telegramSent = telegramResult.success;
      if (!telegramSent) {
        console.error('❌ [TELEGRAM-SEND] Failed:', telegramResult.error);
      } else {
        // Update message metadata with sent=true?
        // Not strictly needed as current impl assumes sent if no error
        console.log(`✅ [TELEGRAM-SEND] Message sent via Telegram`);
      }
    }

    //console.log(`✅ Manual reply sent to Facebook - waiting for echo to save`);


    // ⚡ Track total execution time
    const totalTime = Date.now() - startTime;
    if (totalTime > 500) {
      console.log(`⚠️ [PERF-WARN] Message send took ${totalTime}ms (target: <500ms)`);
    } else {
      console.log(`⚡ [PERF] Message send completed in ${totalTime}ms`);
    }

    res.json({
      success: true,
      data: {
        conversationId: id,
        content: message,
        type: 'TEXT',
        isFromCustomer: false,
        isFacebookReply: true,
        facebookMessageId: facebookMessageId,
        sentAt: new Date()
      },
      message: facebookSent ? 'Reply sent successfully - message will appear when echo is received' : 'Failed to send to Facebook',
      facebookSent: facebookSent,
      facebookError: facebookErrorDetails,
      debug: {
        hasCustomer: !!conversation?.customer,
        hasFacebookId: !!conversation?.customer?.facebookId,
        facebookSent: facebookSent,
        executionTime: `${totalTime}ms` // ⚡ Add performance metric
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [ERROR] Message send failed after ${totalTime}ms:`, error.message);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

const uploadFile = async (req, res) => {
  try {
    const { id } = req.params;

    // Handle both single file (req.file) and multiple files (req.files)
    const files = req.files || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    //console.log(`📎 ${files.length} file(s) uploaded for conversation ${id}`);

    // 🔧 FIX: Get Prisma client early
    const prisma = getSharedPrismaClient();
    if (!prisma) {
      throw new Error('Prisma client is not initialized');
    }

    const uploadedFiles = [];

    // Process each file
    for (const file of files) {
      const fileUrl = `/uploads/conversations/${file.filename}`;

      // 🔧 FIX: Use environment config to determine correct URL
      // In production, use production domain. In development, Facebook can't access localhost,
      // so we need to use production domain even in dev (files must be synced to production)
      const envConfig = require('../config/environment');
      let fullUrl;
      
      if (envConfig.isProduction) {
        // Production: Use production domain
        fullUrl = `${envConfig.backendUrl}${fileUrl}`;
      } else {
        // Development: Use production domain for Facebook API access
        // Note: Files must be accessible from production domain for Facebook to access them
        // In development, you may need to sync files or use a tunnel (ngrok) for testing
        const productionDomain = 'https://www.mokhtarelhenawy.online';
        fullUrl = `${productionDomain}${fileUrl}`;
        
        // ⚠️ WARNING: In development, files uploaded locally won't be accessible from production domain
        // For testing images in development, you need to either:
        // 1. Sync files to production server
        // 2. Use ngrok or similar tunnel to expose local files
        // 3. Upload files directly to production storage (S3, etc.)
        console.warn('⚠️ [DEV-UPLOAD] File uploaded in development mode. Facebook API will try to access:', fullUrl);
        console.warn('⚠️ [DEV-UPLOAD] Make sure this file is accessible from production domain for Facebook to access it.');
      }

      // Determine message type
      let messageType = 'FILE';
      if (file.mimetype.startsWith('image/')) {
        messageType = 'IMAGE';
      } else if (file.mimetype.startsWith('video/')) {
        messageType = 'VIDEO';
      } else if (file.mimetype.startsWith('audio/')) {
        messageType = 'AUDIO';
      }

      // Create attachment object
      const attachment = {
        url: fullUrl,
        name: file.originalname,
        size: file.size,
        type: messageType.toLowerCase(),
        mimeType: file.mimetype
      };

      // Get user info for sender
      const senderId = req.user?.userId || req.user?.id;
      let senderName = 'موظف';

      if (senderId) {
        const user = await executeWithRetry(async () => {
          return await prisma.user.findUnique({
            where: { id: senderId },
            select: { firstName: true, lastName: true, email: true }
          });
        }, 3);
        if (user) {
          senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'موظف';
        }
      }

      // 💾 حفظ الملف فوراً في قاعدة البيانات (INSTANT SAVE)
      let savedFileMessage = null;
      try {
        // 🔧 FIX: Use executeWithRetry to handle connection errors
        savedFileMessage = await executeWithRetry(async () => {
          return await prisma.message.create({
          data: {
            content: fullUrl,
            type: messageType,
            conversationId: id,
            isFromCustomer: false,
            senderId: senderId,
            attachments: JSON.stringify([attachment]),
            metadata: JSON.stringify({
              platform: 'facebook',
              source: 'file_upload',
              employeeId: senderId,
              employeeName: senderName,
              isFacebookReply: true,
              timestamp: new Date(),
              instantSave: true,
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype
            }),
            createdAt: new Date()
          }
        });
      }, 3);

        console.log(`💾 [INSTANT-SAVE-FILE] ${messageType} saved immediately: ${savedFileMessage.id}`);

        // إرسال الملف فوراً للـ socket
        const io = socketService.getIO();
        if (io) {
          const socketData = {
            id: savedFileMessage.id,
            conversationId: savedFileMessage.conversationId,
            content: savedFileMessage.content,
            type: savedFileMessage.type.toLowerCase(),
            isFromCustomer: savedFileMessage.isFromCustomer,
            timestamp: savedFileMessage.createdAt,
            metadata: JSON.parse(savedFileMessage.metadata),
            attachments: savedFileMessage.attachments,
            isFacebookReply: true,
            senderId: senderId,
            senderName: senderName,
            lastMessageIsFromCustomer: false,
            lastCustomerMessageIsUnread: false,
            // 🏢 Company Isolation
            companyId: conversation.companyId,
            // 📱 Platform identification for filtering
            platform: conversation.channel ? conversation.channel.toLowerCase() : 'facebook',
            channel: conversation.channel || 'FACEBOOK'
          };

          // ✅ إرسال للشركة فقط - Company Isolation
          io.to(`company_${conversation.companyId}`).emit('new_message', socketData);
          console.log(`⚡ [SOCKET-FILE] ${messageType} emitted to company ${conversation.companyId}`);
        }
      } catch (saveError) {
        console.error(`❌ [INSTANT-SAVE-FILE] Error saving ${messageType}:`, saveError.message);
      }

      // Update conversation last message
      // 🔧 FIX: Use executeWithRetry to handle connection errors
      await executeWithRetry(async () => {
        return await prisma.conversation.update({
          where: { id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: messageType === 'IMAGE' ? '📷 صورة' : `📎 ${file.originalname}`,
            updatedAt: new Date(),
            // 🆕 FIX: Mark as replied
            lastMessageIsFromCustomer: false,
            unreadCount: 0
          }
        });
      }, 3);

      // Add to uploaded files array with message ID
      uploadedFiles.push({
        messageId: savedFileMessage?.id,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        url: fileUrl,
        fullUrl: fullUrl,
        type: messageType
      });

      // Send file to customer via Facebook if conversation is from Facebook
      let facebookSent = false;
      let facebookMessageId = null; // Store Facebook message ID
      try {
        //console.log(`🔍 [FACEBOOK-FILE] Checking conversation ${id} for Facebook integration...`);
        const conversation = await executeWithRetry(async () => {
          return await prisma.conversation.findUnique({
            where: { id },
            include: { customer: true }
          });
        }, 3);

        // التحقق من وجود Facebook ID للعميل
        const facebookUserId = conversation?.customer?.facebookId;

        if (conversation && conversation.customer && facebookUserId) {
          //console.log(`📤 [FACEBOOK-FILE] Sending ${messageType} to customer:`, facebookUserId);

          // Get Facebook page info - NEW: First try to get from conversation metadata
          let facebookPage = null;
          let actualPageId = null;

          // NEW: First try to get the page ID from the conversation metadata
          // This ensures we reply using the same page that received the original message
          if (conversation.metadata) {
            try {
              const metadata = JSON.parse(conversation.metadata);
              if (metadata.pageId) {
                //console.log(`🎯 [FACEBOOK-FILE] Using page ID from conversation metadata: ${metadata.pageId}`);
                const pageTokenData = await getPageToken(metadata.pageId);
                if (pageTokenData) {
                  facebookPage = {
                    pageId: metadata.pageId,
                    pageAccessToken: pageTokenData.pageAccessToken,
                    pageName: pageTokenData.pageName,
                    companyId: pageTokenData.companyId
                  };
                  actualPageId = metadata.pageId;
                } else {
                  //console.log('⚠️ [FACEBOOK-FILE] Page token not found for metadata page ID');
                }
              }
            } catch (parseError) {
              //console.log('⚠️ [FACEBOOK-FILE] Error parsing conversation metadata:', parseError.message);
            }
          }

          // If we still don't have a page, find the default connected page
          if (!facebookPage) {
            facebookPage = await getSharedPrismaClient().facebookPage.findFirst({
              where: {
                companyId: conversation.companyId,
                status: 'connected'
              }
            });

            if (facebookPage) {
              actualPageId = facebookPage.pageId;
              //console.log(`✅ [FACEBOOK-FILE] Found Facebook page: ${facebookPage.pageName} (${actualPageId})`);
            }
          }

          if (facebookPage && facebookPage.pageAccessToken) {
            try {
              //console.log(`📤 [FACEBOOK-FILE] Using production Facebook sending for ${messageType}`);

              // 🔧 PRODUCTION: Use strict validation for file sending
              const result = await sendProductionFacebookMessage(
                facebookUserId,
                fullUrl,
                messageType,
                actualPageId || facebookPage.pageId,
                facebookPage.pageAccessToken
              );

              if (result.success) {
                //console.log(`✅ [FACEBOOK-FILE] ${messageType} sent successfully`);
                facebookSent = true;
                facebookMessageId = result.messageId;

                // 🔄 تحديث الملف المحفوظ بـ Facebook Message ID
                if (facebookMessageId && savedFileMessage) {
                  try {
                    // 🔧 FIX: Use executeWithRetry to handle connection errors
                    await executeWithRetry(async () => {
                      return await prisma.message.update({
                        where: { id: savedFileMessage.id },
                        data: {
                          metadata: JSON.stringify({
                            ...JSON.parse(savedFileMessage.metadata),
                            facebookMessageId: facebookMessageId,
                            sentToFacebook: true
                          })
                        }
                      });
                    }, 3);
                    console.log(`✅ [UPDATE-FILE] ${messageType} ${savedFileMessage.id} updated with Facebook ID: ${facebookMessageId}`);
                  } catch (updateError) {
                    console.error(`⚠️ [UPDATE-FILE] Failed to update ${messageType} with Facebook ID:`, updateError.message);
                  }
                }
              } else if (result.blocked) {
                console.warn(`🚫 [FACEBOOK-FILE] ${messageType} blocked: ${result.message}`);
                if (result.solutions) {
                  //console.log('🔧 [FACEBOOK-FILE] Suggested solutions:');
                  result.solutions.forEach(solution => {
                    //console.log(`   - ${solution}`);
                  });
                }
              } else {
                console.error(`❌ [FACEBOOK-FILE] Failed to send ${messageType}: ${result.message}`);
                if (result.solutions) {
                  //console.log('🔧 [FACEBOOK-FILE] Suggested solutions:');
                  result.solutions.forEach(solution => {
                    //console.log(`   - ${solution}`);
                  });
                }

                // Update conversation with error info for user experience
                if (result.error === 'NO_MATCHING_USER') {
                  await executeWithRetry(async () => {
                    return await prisma.conversation.update({
                      where: { id: conversation.id },
                      data: {
                        metadata: JSON.stringify({
                          facebookSendError: 'FACEBOOK_INTEGRATION_ERROR',
                          facebookErrorMessage: 'حدث خطأ في التكامل مع فيسبوك',
                          lastFacebookErrorAt: new Date().toISOString()
                        })
                      }
                    });
                  }, 3);
                }


              }
            } catch (error) {
              console.error('Error uploading file to Facebook:', error);
              // Don't fail the request if Facebook upload fails, just log it
            }
          }
        }
      } catch (facebookCheckError) {
        console.error('Error checking Facebook integration:', facebookCheckError);
      }

      // Return success response with all uploaded files
      // This is now outside the Facebook logic ensuring it always runs
      if (!res.headersSent) {
        res.json({
          success: true,
          message: `${files.length} file(s) uploaded successfully`,
          data: uploadedFiles
        });
      }
    }
  } catch (error) {
    console.error('Error processing uploadFile:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to populate file upload'
      });
    }
  }
};

const postReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, quickReplyId, imageUrls } = req.body; // ✅ إضافة دعم الصور

    if (!message && (!imageUrls || imageUrls.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Message content or images are required'
      });
    }

    // Prevent duplicate processing of the same message
    const messageKey = `${id}_${message}_${Date.now()}`;
    if (processedMessages.has(messageKey)) {
      //console.log(`⚠️ Message already processed, skipping duplicate: ${messageKey}`);
      return res.status(200).json({
        success: true,
        message: 'Message already processed'
      });
    }

    // Add to processed messages set and clean up after 1 minute
    processedMessages.add(messageKey);
    setTimeout(() => {
      processedMessages.delete(messageKey);
    }, 60000);

    //console.log(`📤 Sending reply to conversation ${id}: ${message}`);

    // Get conversation and user info
    const senderId = req.user?.userId || req.user?.id;

    const [conversation, user] = await Promise.all([
      getSharedPrismaClient().conversation.findUnique({
        where: { id },
        include: { customer: true }
      }),
      senderId ? getSharedPrismaClient().user.findUnique({
        where: { id: senderId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }) : Promise.resolve(null)
    ]);

    let senderName = 'موظف';
    if (req.user && senderId && user) {
      senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'موظف';
    }

    // ✅ FIX: دعم إرسال الصور مع النص
    const hasImages = imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0;
    const messageType = hasImages ? 'IMAGE' : 'TEXT';
    const attachmentsData = hasImages ? imageUrls.map(url => ({
      type: 'image',
      payload: { url: url },
      url: url
    })) : null;

    // 💾 حفظ الرسالة فوراً في قاعدة البيانات (INSTANT SAVE)
    let savedMessage = null;
    try {
      savedMessage = await getSharedPrismaClient().message.create({
        data: {
          content: message || (hasImages ? `${imageUrls.length} صورة` : ''),
          type: messageType,
          conversationId: id,
          isFromCustomer: false,
          senderId: senderId,
          attachments: attachmentsData ? JSON.stringify(attachmentsData) : null,
          metadata: JSON.stringify({
            platform: conversation?.channel?.toLowerCase() || 'facebook',
            source: 'quick_reply',
            employeeId: senderId,
            employeeName: senderName,
            isFacebookReply: conversation?.channel !== 'TELEGRAM',
            isTelegramReply: conversation?.channel === 'TELEGRAM',
            timestamp: new Date(),
            instantSave: true,
            quickReplyId: quickReplyId,
            hasImages: hasImages,
            imageCount: hasImages ? imageUrls.length : 0
          }),
          createdAt: new Date()
        }
      });

      console.log(`💾 [INSTANT-SAVE-REPLY] Message saved immediately: ${savedMessage.id}`);

      // إرسال الرسالة فوراً للـ socket
      const io = socketService.getIO();
      if (io) {
        const socketData = {
          id: savedMessage.id,
          conversationId: savedMessage.conversationId,
          content: savedMessage.content,
          type: savedMessage.type.toLowerCase(),
          isFromCustomer: savedMessage.isFromCustomer,
          timestamp: savedMessage.createdAt,
          metadata: JSON.parse(savedMessage.metadata),
          isFacebookReply: conversation?.channel !== 'TELEGRAM',
          senderId: senderId,
          senderName: senderName,
          lastMessageIsFromCustomer: false,
          lastCustomerMessageIsUnread: false,
          // 🏢 Company Isolation
          companyId: conversation.companyId,
          // 📱 Platform identification for filtering
          platform: conversation.channel ? conversation.channel.toLowerCase() : 'facebook',
          channel: conversation.channel || 'FACEBOOK'
        };

        // ✅ إرسال للشركة فقط - Company Isolation
        io.to(`company_${conversation.companyId}`).emit('new_message', socketData);
        console.log(`⚡ [SOCKET-REPLY] Message emitted to company ${conversation.companyId}`);
      }

      // Update conversation last message
      await getSharedPrismaClient().conversation.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: message.length > 100 ? message.substring(0, 100) + '...' : message,
          updatedAt: new Date(),
          // 🆕 FIX: Mark as replied
          lastMessageIsFromCustomer: false,
          unreadCount: 0
        }
      });
    } catch (saveError) {
      console.error('❌ [INSTANT-SAVE-REPLY] Error saving message:', saveError.message);
    }

    // TELEGRAM SENDING LOGIC
    if (conversation && conversation.channel === 'TELEGRAM') {
      //console.log(`📤 [TELEGRAM-REPLY] Sending reply to conversation ${id}`);
      const result = await telegramBotService.sendReply(id, message, imageUrls);

      if (result.success) {
        if (savedMessage) {
          await getSharedPrismaClient().message.update({
            where: { id: savedMessage.id },
            data: {
              metadata: JSON.stringify({
                ...JSON.parse(savedMessage.metadata),
                sentToTelegram: true
              })
            }
          });
        }

        return res.json({
          success: true,
          message: 'Reply sent to Telegram',
          debug: { sentToTelegram: true }
        });
      } else {
        // Even if failed to send, it is saved in DB.
        // We return success: false to notify user.
        return res.status(500).json({
          success: false,
          message: 'Failed to send to Telegram: ' + result.error,
          debug: { error: result.error }
        });
      }
    }



    // NEW: Send message to Facebook Messenger if conversation is from Facebook
    if (conversation && conversation.channel !== 'TELEGRAM') {
      let facebookSent = false;
      let facebookMessageId = null; // Store Facebook message ID
      let facebookErrorDetails = null; // Store error details for frontend
      try {
        //console.log(`🔍 [FACEBOOK-REPLY] Checking conversation ${id} for Facebook integration...`);

        // التحقق من وجود Facebook ID للعميل
        const facebookUserId = conversation?.customer?.facebookId;

        if (conversation && conversation.customer && facebookUserId) {
          //console.log(`📤 [FACEBOOK-REPLY] Sending reply to customer:`, facebookUserId);

          // Get Facebook page info - NEW: First try to get from conversation metadata
          let facebookPage = null;
          let actualPageId = null;

          // NEW: First try to get the page ID from the conversation metadata
          // This ensures we reply using the same page that received the original message
          if (conversation.metadata) {
            try {
              const metadata = JSON.parse(conversation.metadata);
              if (metadata.pageId) {
                //console.log(`🎯 [FACEBOOK-REPLY] Using page ID from conversation metadata: ${metadata.pageId}`);
                const pageTokenData = await getPageToken(metadata.pageId);
                if (pageTokenData) {
                  facebookPage = {
                    pageId: metadata.pageId,
                    pageAccessToken: pageTokenData.pageAccessToken,
                    pageName: pageTokenData.pageName,
                    companyId: pageTokenData.companyId
                  };
                  actualPageId = metadata.pageId;
                } else {
                  //console.log('⚠️ [FACEBOOK-REPLY] Page token not found for metadata page ID');
                }
              }
            } catch (parseError) {
              //console.log('⚠️ [FACEBOOK-REPLY] Error parsing conversation metadata:', parseError.message);
            }
          }

          // If we still don't have a page, find the default connected page
          if (!facebookPage) {
            facebookPage = await getSharedPrismaClient().facebookPage.findFirst({
              where: {
                companyId: conversation.companyId,
                status: 'connected'
              }
            });

            if (facebookPage) {
              actualPageId = facebookPage.pageId;
              //console.log(`✅ [FACEBOOK-REPLY] Found Facebook page: ${facebookPage.pageName} (${actualPageId})`);
            }
          }

          if (facebookPage && facebookPage.pageAccessToken) {
            try {
              // ✅ FIX: إرسال النص أولاً إذا كان موجوداً
              if (message && message.trim().length > 0) {
                //console.log(`📤 [FACEBOOK-REPLY] Using production Facebook sending for TEXT message`);

                // 🔧 PRODUCTION: Use strict validation for sending
                // GUARD: PSID/Page mismatch — if conversation metadata contains pageId and it's different from selected page
                if (conversation.metadata) {
                  try {
                    const metadata = JSON.parse(conversation.metadata);
                    if (metadata.pageId && (metadata.pageId !== (actualPageId || facebookPage.pageId))) {
                      console.warn(`⚠️ [GUARD] PSID/Page mismatch (reply): metadata.pageId=${metadata.pageId} actualPageId=${actualPageId || facebookPage.pageId}`);
                      facebookSent = false;
                      facebookErrorDetails = {
                        success: false,
                        error: 'PSID_PAGE_MISMATCH',
                        message: 'PSID لا يخص هذه الصفحة. استخدم نفس الصفحة التي استقبلت رسالة العميل.'
                      };
                      throw new Error('PSID_PAGE_MISMATCH');
                    }
                  } catch (_) { }
                }
                const textResponse = await sendProductionFacebookMessage(
                  facebookUserId,
                  message,
                  'TEXT',
                  actualPageId || facebookPage.pageId,
                  facebookPage.pageAccessToken
                );

                facebookSent = textResponse.success;
                facebookMessageId = textResponse.messageId;
                facebookErrorDetails = textResponse;
              }

              // ✅ FIX: إرسال الصور بعد النص
              if (hasImages && facebookSent) {
                for (let i = 0; i < imageUrls.length; i++) {
                  const imageUrl = imageUrls[i];
                  const imageResponse = await sendProductionFacebookMessage(
                    facebookUserId,
                    imageUrl,
                    'IMAGE',
                    actualPageId || facebookPage.pageId,
                    facebookPage.pageAccessToken
                  );

                  if (!imageResponse.success) {
                    facebookSent = false;
                    facebookErrorDetails = imageResponse;
                    break;
                  }
                  // استخدام آخر messageId كـ Facebook message ID
                  facebookMessageId = imageResponse.messageId;
                }
              }
              //console.log(`📤 [FACEBOOK-REPLY] Facebook message sent: ${facebookSent}`);

              // 🔄 تحديث الرسالة المحفوظة بـ Facebook Message ID
              if (facebookSent && facebookMessageId && savedMessage) {
                try {
                  await getSharedPrismaClient().message.update({
                    where: { id: savedMessage.id },
                    data: {
                      metadata: JSON.stringify({
                        ...JSON.parse(savedMessage.metadata),
                        facebookMessageId: facebookMessageId,
                        sentToFacebook: true
                      })
                    }
                  });
                  console.log(`✅ [UPDATE-REPLY] Message ${savedMessage.id} updated with Facebook ID: ${facebookMessageId}`);
                } catch (updateError) {
                  console.error('⚠️ [UPDATE-REPLY] Failed to update message with Facebook ID:', updateError.message);
                }
              }

              // NEW: Handle Facebook errors more gracefully
              if (!facebookSent && response.error === 'RECIPIENT_NOT_AVAILABLE') {
                await getSharedPrismaClient().conversation.update({
                  where: { id },
                  data: {
                    metadata: JSON.stringify({
                      ...conversation.metadata ? JSON.parse(conversation.metadata) : {},
                      facebookSendError: 'RECIPIENT_NOT_AVAILABLE',
                      facebookErrorMessage: 'هذا الشخص غير متاح حاليًا. اطلب من العميل إرسال رسالة جديدة أو تأكد أنه لم يحظر الصفحة.',
                      lastFacebookErrorAt: new Date().toISOString(),
                      notMessageable: true,
                      unmessageableReason: 'fb_551_1545041'
                    })
                  }
                });
              }
              // NEW: Handle the specific Facebook error 2018001 more gracefully
              if (!facebookSent && response.error === 'NO_MATCHING_USER') {
                //console.log(`⚠️ [FACEBOOK-REPLY] User hasn't started conversation with page`);

                // Update the conversation to indicate this issue
                await getSharedPrismaClient().conversation.update({
                  where: { id },
                  data: {
                    metadata: JSON.stringify({
                      ...conversation.metadata ? JSON.parse(conversation.metadata) : {},
                      facebookSendError: 'USER_NOT_STARTED_CONVERSATION',
                      facebookErrorMessage: 'العميل لم يبدأ محادثة مع الصفحة',
                      lastFacebookErrorAt: new Date().toISOString()
                    })
                  }
                });
              } else if (!facebookSent) {
                console.error(`❌ [FACEBOOK-REPLY] Failed to send: ${response.message}`);
                if (response.solutions) {
                  //console.log('🔧 [FACEBOOK-REPLY] Solutions:');
                  response.solutions.forEach(solution => {
                    //console.log(`   - ${solution}`);
                  });
                }
              } else {
                //console.log(`✅ [FACEBOOK-REPLY] Message sent successfully - will be saved via echo`);
              }
            } catch (sendError) {
              console.error(`❌ [FACEBOOK-REPLY] Error in production sending:`, sendError);
              facebookSent = false;
              facebookErrorDetails = {
                success: false,
                error: 'FACEBOOK_SEND_ERROR',
                message: sendError.message,
                details: 'حدث خطأ أثناء إرسال الرسالة إلى فيسبوك'
              };
            }
          } else {
            //console.log('⚠️ [FACEBOOK-REPLY] No valid Facebook page or access token found');
            facebookErrorDetails = {
              success: false,
              error: 'NO_FACEBOOK_PAGE',
              message: 'لم يتم العثور على صفحة فيسبوك متصلة',
              details: 'تأكد من ربط الصفحة بشكل صحيح في إعدادات النظام'
            };
          }
        } else {
          //console.log(`🔍 [FACEBOOK-REPLY] Conversation is not from Facebook or customer has no Facebook ID`);
          if (facebookUserId) {
            facebookErrorDetails = {
              success: false,
              error: 'NO_FACEBOOK_ID',
              message: 'العميل ليس لديه معرف فيسبوك',
              details: 'هذا العميل لم يبدأ محادثة عبر فيسبوك'
            };
          }
        }
      } catch (facebookError) {
        console.error('❌ [FACEBOOK-REPLY] Error processing Facebook reply:', facebookError);
        facebookErrorDetails = {
          success: false,
          error: 'FACEBOOK_PROCESSING_ERROR',
          message: facebookError.message,
          details: 'حدث خطأ أثناء معالجة إرسال الرسالة إلى فيسبوك'
        };
        // Don't fail the whole operation if Facebook sending fails
      }

      // ⚡ OPTIMIZATION: لا نرسل Socket event هنا - سيتم إرساله تلقائياً عند استقبال echo من Facebook
      // هذا يمنع ظهور الرسالة مرتين في الفرونت إند
      //console.log(`⏳ [REPLY] Message will appear in frontend when echo is received`);

      // 🔧 FIX: Update conversation (only if message is not empty)
      if (message && message.trim() !== '') {
        await getSharedPrismaClient().conversation.update({
          where: { id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: message.length > 100 ?
              message.substring(0, 100) + '...' : message
          }
        });
      }

      //console.log(`✅ Manual reply sent to Facebook - waiting for echo`);

      res.json({
        success: true,
        data: {
          conversationId: id,
          content: message,
          type: 'TEXT',
          isFromCustomer: false,
          isFacebookReply: true,
          facebookMessageId: facebookMessageId,
          sentAt: new Date()
        },
        message: facebookSent ? 'Reply sent successfully - message will appear when echo is received' : 'Failed to send to Facebook',
        facebookSent: facebookSent,
        facebookError: facebookErrorDetails
      });

    } // End of Facebook specific logic check

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 🔧 FIX: Mark all messages in a conversation as read
const markConversationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    // التحقق من المصادقة والشركة
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    //console.log(`📖 [MARK-READ] Marking conversation ${id} as read for company ${companyId}`);

    // 🔧 FIX: Get Prisma client early
    const prisma = getSharedPrismaClient();
    if (!prisma) {
      throw new Error('Prisma client is not initialized');
    }

    // Verify conversation belongs to this company
    const conversation = await executeWithRetry(async () => {
      return await prisma.conversation.findFirst({
        where: {
          id,
          companyId
        }
      });
    }, 3);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة أو غير مصرح بالوصول'
      });
    }

    // 🔧 FIX: First check how many unread messages exist before updating
    const unreadMessagesBefore = await executeWithRetry(async () => {
      return await prisma.message.findMany({
        where: {
          conversationId: id,
          isFromCustomer: true,
          isRead: false
        },
        select: { id: true, content: true, createdAt: true }
      });
    }, 3);

    // Update all unread messages from customer to read
    const result = await executeWithRetry(async () => {
      return await prisma.message.updateMany({
        where: {
          conversationId: id,
          isFromCustomer: true,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
    }, 3);

    // 🔧 FIX: Always update unreadCount based on actual unread messages count
    // This ensures unreadCount is always in sync with actual message state
    const unreadCount = await executeWithRetry(async () => {
      return await prisma.message.count({
        where: {
          conversationId: id,
          isFromCustomer: true,
          isRead: false
        }
      });
    }, 3);

    // 🔧 FIX: If conversation.unreadCount > 0 but no unread messages found,
    // it means unreadCount is out of sync - force update to actual count
    const actualUnreadCount = unreadCount;

    // Also update lastMessageIsFromCustomer if all messages are read
    // 🔧 FIX: Handle case where conversation has no messages
    let lastMessage = null;
    try {
      lastMessage = await executeWithRetry(async () => {
        return await prisma.message.findFirst({
          where: { conversationId: id },
          orderBy: { createdAt: 'desc' },
          select: { isFromCustomer: true }
        });
      }, 3);
    } catch (msgError) {
      console.error('⚠️ [MARK-READ] Error fetching last message:', msgError.message);
      // Continue without lastMessage - it's optional
    }

    // 🔧 FIX: Always update unreadCount and lastMessageIsFromCustomer to match actual state
    // Update lastMessageIsFromCustomer based on the actual last message
    const updateData = {
      unreadCount: actualUnreadCount
    };
    
    // Always update lastMessageIsFromCustomer based on the last message
    if (lastMessage) {
      updateData.lastMessageIsFromCustomer = lastMessage.isFromCustomer;
    }
    // If no messages exist, keep the current value (don't change it)
    
    await executeWithRetry(async () => {
      return await prisma.conversation.update({
        where: { id },
        data: updateData
      });
    }, 3);

    //console.log(`✅ [MARK-READ] Marked ${result.count} messages as read in conversation ${id}, unreadCount=${unreadCount}`);

    res.json({
      success: true,
      message: `تم تحديد ${result.count} رسالة كمقروءة`,
      markedCount: result.count,
      unreadCount: actualUnreadCount,
      // 🔧 FIX: Also return conversation data for frontend sync
      conversation: {
        id,
        unreadCount: actualUnreadCount,
        lastMessageIsFromCustomer: lastMessage ? lastMessage.isFromCustomer : null
      }
    });

  } catch (error) {
    console.error('❌ [MARK-READ] Error marking conversation as read:', error);
    
    res.status(500).json({
      success: false,
      error: 'خطأ في الخادم',
      message: error.message
    });
  }
};

// 🔧 NEW: Mark conversation as unread/read (toggle)
const markConversationAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const { unreadCount } = req.body;

    // التحقق من المصادقة والشركة
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    console.log(`📧 [MARK-UNREAD] Setting conversation ${id} to ${unreadCount > 0 ? 'unread' : 'read'} for company ${companyId}`);

    // Verify conversation belongs to this company
    const conversation = await getSharedPrismaClient().conversation.findFirst({
      where: {
        id,
        companyId
      },
      include: {
        messages: {
          where: {
            isFromCustomer: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة أو غير مصرح بالوصول'
      });
    }

    const isMarkAsUnread = unreadCount > 0;

    // Update conversation isRead field
    await getSharedPrismaClient().conversation.update({
      where: { id },
      data: {
        isRead: !isMarkAsUnread, // عكس unreadCount
        updatedAt: new Date()
      }
    });

    // Update last customer message if exists
    if (conversation.messages && conversation.messages.length > 0) {
      const lastMessage = conversation.messages[0];
      await getSharedPrismaClient().message.update({
        where: { id: lastMessage.id },
        data: {
          isRead: !isMarkAsUnread,
          readAt: isMarkAsUnread ? null : new Date()
        }
      });
      console.log(`✅ [MARK-UNREAD] Updated last message ${lastMessage.id}`);
    }

    console.log(`✅ [MARK-UNREAD] Updated conversation ${id} to ${isMarkAsUnread ? 'unread' : 'read'}`);

    // Invalidate cache for this conversation
    if (conversation && conversation.companyId) {
      conversationCache.invalidateConversation(id, conversation.companyId);
      console.log(`🧹 [CACHE] Invalidated cache for conversation ${id} in company ${conversation.companyId}`);
    }

    res.json({
      success: true,
      message: isMarkAsUnread ? 'تم وضع علامة غير مقروءة' : 'تم وضع علامة مقروءة',
      data: {
        id: conversation.id,
        isRead: !isMarkAsUnread,
        unreadCount: isMarkAsUnread ? 1 : 0 // للتوافق مع الفرونت
      }
    });

  } catch (error) {
    console.error('❌ [MARK-UNREAD] Error marking conversation:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ في الخادم',
      message: error.message
    });
  }
};

const checkHealth = async (req, res) => {
  try {
    const { id } = req.params;
    //console.log(`🔍 [HEALTH-CHECK] Manual check for conversation: ${id}`);

    // ✅ إضافة companyId للعزل الأمني
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const checker = new MessageHealthChecker();

    // ✅ تمرير companyId لل_checker
    const results = await checker.checkConversation(id, companyId);
    await checker.disconnect();

    const summary = {
      conversationId: id,
      totalChecked: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      fixed: results.filter(r => r.status === 'fixed').length,
      unfixable: results.filter(r => r.status === 'unfixable').length,
      details: results
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('❌ [HEALTH-CHECK] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 🖼️ إرسال صورة موجودة من الحافظة مباشرة (بدون upload جديد)
 * POST /conversations/:id/send-existing-image
 */
const sendExistingImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, filename } = req.body;

    if (!imageUrl || !filename) {
      return res.status(400).json({
        success: false,
        error: 'Image URL and filename are required'
      });
    }

    console.log(`🖼️ [SEND-EXISTING-IMAGE] Sending image from gallery: ${filename}`);

    const senderId = req.user?.userId || req.user?.id;
    let senderName = 'موظف';

    if (senderId) {
      const user = await getSharedPrismaClient().user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true, email: true }
      });
      if (user) {
        senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'موظف';
      }
    }

    // Create attachment object
    const attachment = {
      url: imageUrl,
      name: filename,
      type: 'image',
      mimeType: 'image/jpeg'
    };

    // 💾 حفظ الصورة في قاعدة البيانات
    const savedMessage = await getSharedPrismaClient().message.create({
      data: {
        content: imageUrl,
        type: 'IMAGE',
        conversationId: id,
        isFromCustomer: false,
        senderId: senderId,
        attachments: JSON.stringify([attachment]),
        metadata: JSON.stringify({
          platform: 'facebook',
          source: 'image_gallery',
          employeeId: senderId,
          employeeName: senderName,
          isFacebookReply: true,
          timestamp: new Date(),
          instantSave: true,
          fileName: filename,
          fromGallery: true
        }),
        createdAt: new Date()
      }
    });

    console.log(`💾 [SEND-EXISTING-IMAGE] Message saved: ${savedMessage.id}`);

    // جلب معلومات المحادثة للحصول على companyId و channel
    const conversation = await getSharedPrismaClient().conversation.findUnique({
      where: { id },
      select: { companyId: true, channel: true, customer: true }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // إرسال الرسالة للـ socket
    const io = socketService.getIO();
    if (io) {
      const socketData = {
        id: savedMessage.id,
        conversationId: savedMessage.conversationId,
        content: savedMessage.content,
        type: 'image',
        isFromCustomer: savedMessage.isFromCustomer,
        timestamp: savedMessage.createdAt,
        metadata: JSON.parse(savedMessage.metadata),
        attachments: savedMessage.attachments,
        isFacebookReply: conversation.channel !== 'TELEGRAM',
        senderId: senderId,
        senderName: senderName,
        lastMessageIsFromCustomer: false,
        lastCustomerMessageIsUnread: false,
        // 🏢 Company Isolation
        companyId: conversation.companyId,
        // 📱 Platform identification for filtering
        platform: conversation.channel ? conversation.channel.toLowerCase() : 'facebook',
        channel: conversation.channel || 'FACEBOOK'
      };

      // ✅ إرسال للشركة فقط - Company Isolation
      io.to(`company_${conversation.companyId}`).emit('new_message', socketData);
      console.log(`⚡ [SEND-EXISTING-IMAGE] Message emitted to company ${conversation.companyId}`);
    }

    // Update conversation last message
    await getSharedPrismaClient().conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: '📷 صورة من الحافظة',
        updatedAt: new Date()
      }
    });

    // محاولة إرسال للـ Facebook (نفس طريقة uploadFile)
    try {
      const conversation = await getSharedPrismaClient().conversation.findUnique({
        where: { id },
        include: { customer: true }
      });

      const facebookUserId = conversation?.customer?.facebookId;

      if (conversation && conversation.customer && facebookUserId) {
        console.log(`📤 [SEND-EXISTING-IMAGE] Sending to Facebook customer: ${facebookUserId}`);

        // Get Facebook page info - نفس طريقة uploadFile
        let facebookPage = null;
        let actualPageId = null;

        // جرب تجيب الـ page ID من الـ conversation metadata
        if (conversation.metadata) {
          try {
            const metadata = JSON.parse(conversation.metadata);
            if (metadata.pageId) {
              console.log(`🎯 [SEND-EXISTING-IMAGE] Using page ID from conversation metadata: ${metadata.pageId}`);
              const pageTokenData = await getPageToken(metadata.pageId);
              if (pageTokenData) {
                facebookPage = {
                  pageId: metadata.pageId,
                  pageAccessToken: pageTokenData.pageAccessToken,
                  pageName: pageTokenData.pageName,
                  companyId: pageTokenData.companyId
                };
                actualPageId = metadata.pageId;
              }
            }
          } catch (parseError) {
            console.log('⚠️ [SEND-EXISTING-IMAGE] Error parsing conversation metadata:', parseError.message);
          }
        }

        // لو مفيش page، جيب الـ default connected page
        if (!facebookPage) {
          facebookPage = await getSharedPrismaClient().facebookPage.findFirst({
            where: {
              companyId: conversation.companyId,
              status: 'connected'
            }
          });

          if (facebookPage) {
            actualPageId = facebookPage.pageId;
            console.log(`✅ [SEND-EXISTING-IMAGE] Found Facebook page: ${facebookPage.pageName} (${actualPageId})`);
          }
        }

        if (facebookPage && facebookPage.pageAccessToken) {
          try {
            console.log(`📤 [SEND-EXISTING-IMAGE] Using production Facebook sending for IMAGE`);

            // 🔧 استخدام sendProductionFacebookMessage (نفس uploadFile)
            const result = await sendProductionFacebookMessage(
              facebookUserId,
              imageUrl,
              'IMAGE',
              actualPageId || facebookPage.pageId,
              facebookPage.pageAccessToken
            );

            if (result.success && result.messageId) {
              await getSharedPrismaClient().message.update({
                where: { id: savedMessage.id },
                data: {
                  metadata: JSON.stringify({
                    ...JSON.parse(savedMessage.metadata),
                    facebookMessageId: result.messageId,
                    sentToFacebook: true
                  })
                }
              });
              console.log(`✅ [SEND-EXISTING-IMAGE] Image sent to Facebook successfully: ${result.messageId}`);
            } else if (result.blocked) {
              console.warn(`🚫 [SEND-EXISTING-IMAGE] Image blocked: ${result.message}`);
            } else {
              console.error(`❌ [SEND-EXISTING-IMAGE] Failed to send image: ${result.message}`);
            }
          } catch (fbError) {
            console.error(`❌ [SEND-EXISTING-IMAGE] Facebook send error:`, fbError.message);
          }
        } else {
          console.warn('⚠️ [SEND-EXISTING-IMAGE] No Facebook page found or missing access token');
        }
      } else {
        console.log('ℹ️ [SEND-EXISTING-IMAGE] Conversation has no Facebook customer ID');
      }
    } catch (facebookError) {
      console.error(`❌ [SEND-EXISTING-IMAGE] Facebook integration error:`, facebookError.message);
    }

    res.json({
      success: true,
      message: 'Image sent successfully',
      data: {
        messageId: savedMessage.id
      }
    });

  } catch (error) {
    console.error('❌ [SEND-EXISTING-IMAGE] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send image'
    });
  }
};

// 🆕 Get post details for a conversation (lazy loading)
const getConversationPostDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    // Get conversation with metadata
    const conversation = await getSharedPrismaClient().conversation.findFirst({
      where: {
        id: id,
        companyId: companyId
      },
      select: {
        id: true,
        metadata: true
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة'
      });
    }

    // Parse metadata to get postId
    let postId = null;
    let pageId = null;

    if (conversation.metadata) {
      try {
        const metadata = JSON.parse(conversation.metadata);
        postId = metadata.postId;
        pageId = metadata.pageId;
      } catch (e) {
        // Metadata parsing failed
      }
    }

    if (!postId) {
      return res.status(404).json({
        success: false,
        message: 'لا يوجد postId مرتبط بهذه المحادثة'
      });
    }

    if (!pageId) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد pageId مرتبط بهذه المحادثة'
      });
    }

    // Get page access token
    const facebookPage = await getSharedPrismaClient().facebookPage.findFirst({
      where: {
        pageId: pageId,
        companyId: companyId,
        status: 'connected'
      },
      select: {
        pageAccessToken: true,
        pageName: true
      }
    });

    if (!facebookPage || !facebookPage.pageAccessToken) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على صفحة Facebook أو لا يوجد access token'
      });
    }

    // Fetch post details using postDetailsService
    const postDetailsService = require('../utils/postDetailsService');
    const postDetails = await postDetailsService.getFacebookPostDetails(
      postId,
      facebookPage.pageAccessToken,
      pageId // Pass pageId to use proper format
    );

    if (!postDetails) {
      return res.status(404).json({
        success: false,
        message: 'فشل في جلب تفاصيل المنشور من Facebook'
      });
    }

    res.json({
      success: true,
      data: {
        postId: postDetails.postId,
        message: postDetails.message,
        permalinkUrl: postDetails.permalinkUrl,
        fullPicture: postDetails.fullPicture,
        hasImages: postDetails.hasImages,
        imageUrls: postDetails.imageUrls,
        pageId: pageId,
        pageName: facebookPage.pageName
      }
    });

  } catch (error) {
    console.error('❌ Error fetching conversation post details:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ في الخادم',
      message: error.message
    });
  }
};

// 🆕 Get posts with AI identification tracking
const getPostsAITracking = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    // 🆕 جلب البوستات من PostTracking مباشرة (التي تم تسجيلها عند وصول العملاء)
    const postTrackingData = await getSharedPrismaClient().postTracking.findMany({
      where: {
        companyId: companyId
      },
      orderBy: {
        lastVisitAt: 'desc'
      }
    });

    if (postTrackingData.length === 0) {
      return res.json({
        success: true,
        data: {
          posts: []
        }
      });
    }

    // استخراج postIds من PostTracking
    const postIds = postTrackingData.map(tracking => tracking.postId);

    // جلب المحادثات فقط لاستخراج pageId (بدون حساب إحصائيات)
    const conversations = await getSharedPrismaClient().conversation.findMany({
      where: {
        companyId: companyId,
        metadata: {
          not: null
        }
      },
      select: {
        metadata: true
      },
      take: 1000 // Limit to avoid performance issues
    });

    // تجميع pageId لكل postId
    const postPageIdMap = new Map();

    // استخراج pageId من المحادثات
    for (const conversation of conversations) {
      try {
        const metadata = conversation.metadata ? JSON.parse(conversation.metadata) : {};
        const postId = metadata.postId;
        const pageId = metadata.pageId;

        if (postId && pageId && !postPageIdMap.has(postId)) {
          postPageIdMap.set(postId, pageId);
        }
      } catch (e) {
        continue;
      }
    }

    // Get PostResponseSettings for featured products
    const postSettings = await getSharedPrismaClient().postResponseSettings.findMany({
      where: {
        postId: { in: postIds },
        companyId: companyId
      },
      include: {
        featuredProduct: {
          select: {
            id: true,
            name: true,
            price: true
          }
        }
      }
    });

    // Create a map for quick lookup
    const settingsMap = new Map();
    postSettings.forEach(setting => {
      settingsMap.set(setting.postId, setting);
    });

    // بناء بيانات البوستات بدون حساب إحصائيات المحادثات
    const postsData = postTrackingData.map(tracking => {
      const postId = tracking.postId;

      // Add featured product data
      const settings = settingsMap.get(postId);
      const featuredProduct = settings && settings.featuredProduct ? {
        id: settings.featuredProduct.id,
        name: settings.featuredProduct.name,
        price: settings.featuredProduct.price
      } : null;

      return {
        postId: tracking.postId,
        visitCount: tracking.visitCount,
        firstVisitAt: tracking.firstVisitAt,
        lastVisitAt: tracking.lastVisitAt,
        pageId: postPageIdMap.get(postId) || null,
        featuredProduct: featuredProduct,
        featuredProductId: settings?.featuredProductId || null
      };
    });

    res.json({
      success: true,
      data: {
        posts: postsData
      }
    });

  } catch (error) {
    console.error('❌ Error fetching posts AI tracking:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ في الخادم',
      message: error.message
    });
  }
};

// 🆕 Get post details from Facebook
const getPostDetails = async (req, res) => {
  try {
    const { postId } = req.params;
    const { pageId } = req.query; // Optional - will try to find it if not provided
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: 'معرف البوست مطلوب'
      });
    }

    let foundPageId = pageId;

    // إذا لم يتم توفير pageId، حاول العثور عليه من المحادثات المرتبطة بهذا البوست
    if (!foundPageId) {
      const conversations = await getSharedPrismaClient().conversation.findMany({
        where: {
          companyId: companyId,
          metadata: {
            not: null
          }
        },
        select: {
          metadata: true
        },
        take: 1000
      });

      // البحث عن محادثة مرتبطة بهذا البوست
      for (const conversation of conversations) {
        if (conversation.metadata) {
          try {
            const metadata = JSON.parse(conversation.metadata);
            if (metadata.postId === postId && metadata.pageId) {
              foundPageId = metadata.pageId;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      // إذا لم يتم العثور عليه من المحادثات، جرب جميع صفحات الشركة
      if (!foundPageId) {
        const allPages = await getSharedPrismaClient().facebookPage.findMany({
          where: {
            companyId: companyId,
            status: 'connected'
          },
          select: {
            pageId: true,
            pageAccessToken: true,
            pageName: true
          }
        });

        // جرب كل صفحة حتى نجد الصفحة الصحيحة
        const postDetailsService = require('../utils/postDetailsService');
        for (const page of allPages) {
          try {
            const postDetails = await postDetailsService.getFacebookPostDetails(
              postId,
              page.pageAccessToken,
              page.pageId
            );
            if (postDetails) {
              foundPageId = page.pageId;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    }

    if (!foundPageId) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على صفحة Facebook مرتبطة بهذا البوست'
      });
    }

    // Get page access token
    const facebookPage = await getSharedPrismaClient().facebookPage.findFirst({
      where: {
        pageId: foundPageId,
        companyId: companyId,
        status: 'connected'
      },
      select: {
        pageAccessToken: true,
        pageName: true
      }
    });

    if (!facebookPage || !facebookPage.pageAccessToken) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على صفحة Facebook أو لا يوجد access token'
      });
    }

    // Fetch post details using postDetailsService
    const postDetailsService = require('../utils/postDetailsService');
    const postDetails = await postDetailsService.getFacebookPostDetails(
      postId,
      facebookPage.pageAccessToken,
      foundPageId
    );

    if (!postDetails) {
      return res.status(404).json({
        success: false,
        message: 'فشل في جلب تفاصيل المنشور من Facebook'
      });
    }

    res.json({
      success: true,
      data: {
        postId: postDetails.postId,
        message: postDetails.message,
        permalinkUrl: postDetails.permalinkUrl,
        fullPicture: postDetails.fullPicture,
        hasImages: postDetails.hasImages,
        imageUrls: postDetails.imageUrls,
        pageId: foundPageId,
        pageName: facebookPage.pageName
      }
    });

  } catch (error) {
    console.error('❌ Error fetching post details:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ في الخادم',
      message: error.message
    });
  }
};

// 🆕 Update featured product for a post
const updatePostFeaturedProduct = async (req, res) => {
  try {
    const { postId } = req.params;
    const { featuredProductId } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: 'معرف البوست مطلوب'
      });
    }

    // Validate product if provided
    if (featuredProductId) {
      const product = await getSharedPrismaClient().product.findFirst({
        where: {
          id: featuredProductId,
          companyId: companyId,
          isActive: true
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'المنتج غير موجود أو غير نشط'
        });
      }
    }

    // Find or create PostResponseSettings
    let postSettings = await getSharedPrismaClient().postResponseSettings.findUnique({
      where: {
        postId_companyId: {
          postId: postId,
          companyId: companyId
        }
      }
    });

    if (postSettings) {
      // Update existing settings
      postSettings = await getSharedPrismaClient().postResponseSettings.update({
        where: {
          postId_companyId: {
            postId: postId,
            companyId: companyId
          }
        },
        data: {
          featuredProductId: featuredProductId || null
        },
        include: {
          featuredProduct: {
            select: {
              id: true,
              name: true,
              price: true
            }
          }
        }
      });
    } else {
      // Create new settings with featured product
      postSettings = await getSharedPrismaClient().postResponseSettings.create({
        data: {
          postId: postId,
          companyId: companyId,
          responseMethod: 'ai',
          featuredProductId: featuredProductId || null
        },
        include: {
          featuredProduct: {
            select: {
              id: true,
              name: true,
              price: true
            }
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        postId: postId,
        featuredProduct: postSettings.featuredProduct,
        featuredProductId: postSettings.featuredProductId
      }
    });

  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ في الخادم',
      message: error.message
    });
  }
};

// 🆕 Get all conversations with pagination and filtering
const getConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, platform, unread, tab } = req.query;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build filter criteria
    const where = {
      companyId: companyId,
      // Hide deleted/archived if needed
      // isArchived: false 
    };

    console.log('🔍 [GET-CONV] Request received:', { companyId, platform, page, limit });
    console.log('🔍 [GET-CONV] Initial where clause:', JSON.stringify(where));

    if (status) {
      where.status = status;
    }

    if (platform) {
      const validWebPlatforms = ['FACEBOOK', 'WHATSAPP', 'TELEGRAM', 'EMAIL', 'SMS', 'PHONE', 'WEBSITE', 'TEST'];
      const pStr = Array.isArray(platform) ? platform[0] : platform;
      const normalizedPlatform = String(pStr).toUpperCase();
      console.log(`🔍 [GET-CONV] Platform check: input=${platform}, normalized=${normalizedPlatform}`);

      if (validWebPlatforms.includes(normalizedPlatform)) {
        where.channel = normalizedPlatform;
        console.log('✅ [GET-CONV] Filter applied: channel=' + normalizedPlatform);
      } else {
        console.log('⚠️ [GET-CONV] Invalid platform ignored:', normalizedPlatform);
      }
    }

    console.log('🔍 [GET-CONV] Final WHERE clause:', JSON.stringify(where, null, 2));

    // 🔧 FIX: Get Prisma client early and use executeWithRetry
    const prisma = getSharedPrismaClient();
    if (!prisma) {
      throw new Error('Prisma client is not initialized');
    }

    // Execute query
    console.log('🚀 [GET-CONV] Executing DB query (findMany + count)...');

    // Split promise for better error isolation
    let conversations, total;

    // 🆕 For unreplied tab, we now use the database column directly!
    // Extended logic for ALL tabs to ensure server-side filtering works
    let tabWhere = { ...where };

    if (tab === 'unreplied') {
      tabWhere = {
        ...where,
        status: { in: ['ACTIVE', 'PENDING'] },
        lastMessageIsFromCustomer: true
      };
    } else if (tab === 'done' || tab === 'resolved') {
      // 🆕 FIX: Use valid enum values - RESOLVED and CLOSED
      tabWhere = {
        ...where,
        status: { in: ['RESOLVED', 'CLOSED'] }
      };
    } else if (tab === 'spam') {
      // SPAM is not a valid status enum, so we filter by metadata or skip
      // For now, just use CLOSED as fallback
      tabWhere = {
        ...where,
        status: 'CLOSED'
      };
    } else if (['main', 'general', 'requests'].includes(tab)) {
      // These are likely mapped to specific internal logic or metadata
      // For now, treat them as ACTIVE but ideally we filter by metadata.tab if that Schema exists
      // or simple fallback to all active
      tabWhere = {
        ...where,
        status: { in: ['ACTIVE', 'PENDING'] }
      };
      // Note: strict metadata filtering might require raw query or JsonFilter (if enabled)
    } else {
      // 'all' or undefined - usually excludes RESOLVED/CLOSED
      // But user might want literally ALL. Usually 'Inbox' implies active.
      // Let's default to Active/Pending for 'all' tab in inbox view, exclude Resolved/Closed.
      // 🆕 FIX: Use valid enum values: ACTIVE, PENDING, RESOLVED, CLOSED
      tabWhere = {
        ...where,
        status: { in: ['ACTIVE', 'PENDING'] }
      };
    }

    // For unreplied, filter directly from database using the new column
    const queryWhere = tabWhere;

    try {
      // 🔧 FIX: Use executeWithRetry to handle connection errors
      conversations = await executeWithRetry(async () => {
        return await prisma.conversation.findMany({
          where: queryWhere,
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                facebookId: true,
                phone: true,
                avatar: true
              }
            },
            assignedUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true
              }
            },
            // 🆕 Include last message to check if from customer
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                isFromCustomer: true,
                isRead: true,
                content: true,
                type: true
              }
            }
          },
          orderBy: {
            lastMessageAt: 'desc'
          },
          skip: skip,
          take: take
        });
      }, 3);
      console.log(`✅ [GET-CONV] findMany success. Got ${conversations.length} records.`);
    } catch (dbErr) {
      console.error('❌ [GET-CONV] findMany FAILED:', dbErr);
      throw dbErr;
    }

    // 🆕 Count for unreplied should use the same filter
    let unrepliedCount = 0;
    try {
      // 🔧 FIX: Use executeWithRetry to handle connection errors
      total = await executeWithRetry(async () => {
        return await prisma.conversation.count({ where: queryWhere });
      }, 3);

      // Also get total unreplied count for stats
      const unrepliedWhere = {
        ...where,
        status: { in: ['ACTIVE', 'PENDING'] },
        lastMessageIsFromCustomer: true
      };
      
      unrepliedCount = await executeWithRetry(async () => {
        return await prisma.conversation.count({
          where: unrepliedWhere
        });
      }, 3);

      console.log(`✅ [GET-CONV] count success. Total: ${total}, Unreplied: ${unrepliedCount}`);
    } catch (cntErr) {
      console.error('❌ [GET-CONV] count FAILED:', cntErr);
      throw cntErr;
    }

      // Format response
      console.log('🔄 [GET-CONV] Formatting response...');
      const formattedConversations = await Promise.all(conversations.map(async (conv, index) => {
      // Extract pageName and pageId
      let pageName = null;
      let pageId = null;

      if (conv.metadata) {
        try {
          const metadata = JSON.parse(conv.metadata);
          pageName = metadata.pageName || null;
          pageId = metadata.pageId || null;
        } catch (e) {
          // ignore parse errors
        }
      }

      // ⚡ PERFORMANCE FIX: Skip expensive queries - just use default for FACEBOOK
      // The pageId/pageName should already be in conversation metadata from when message was saved
      if (!pageName && conv.channel === 'FACEBOOK') {
        pageName = 'Facebook';
      }

      // 🔧 FIX: Use included messages instead of fetching separately (much faster!)
      let lastMessageIsFromCustomer = false;
      let lastCustomerMessageIsUnread = false;

      // Use the included messages array (already fetched with the conversation)
      if (conv.messages && conv.messages.length > 0) {
        const lastMsg = conv.messages[0]; // Already ordered by createdAt desc
        lastMessageIsFromCustomer = Boolean(lastMsg.isFromCustomer);
        lastCustomerMessageIsUnread = lastMsg.isFromCustomer === true && lastMsg.isRead === false;
      } else {
        // 🔧 FIX: Fallback to database column if messages not included
        lastMessageIsFromCustomer = Boolean(conv.lastMessageIsFromCustomer);
      }

      // Safety check for enum mapping
      const platformStr = conv.channel ? String(conv.channel).toLowerCase() : 'unknown';

      // Map status from database enum to frontend format
      const statusMap = {
        'ACTIVE': 'open',
        'PENDING': 'pending',
        'RESOLVED': 'resolved',
        'DONE': 'done'
      };
      const frontendStatus = statusMap[conv.status] || conv.status?.toLowerCase() || 'open';

      return {
        id: conv.id,
        customerId: conv.customerId,
        customerName: conv.customer ? `${conv.customer.firstName || ''} ${conv.customer.lastName || ''}`.trim() : 'Unknown',
        customerAvatar: conv.customer?.avatar || null,
        lastMessage: conv.lastMessagePreview || 'No messages',
        lastMessageTime: conv.lastMessageAt || conv.updatedAt,
        unreadCount: conv.unreadCount || 0,
        platform: platformStr,
        isOnline: false, // Socket will update
        lastMessageIsFromCustomer: lastMessageIsFromCustomer,
        lastCustomerMessageIsUnread: lastCustomerMessageIsUnread,
        status: frontendStatus,
        assignedTo: conv.assignedUserId || null,
        assignedToName: conv.assignedUser ? `${conv.assignedUser.firstName || ''} ${conv.assignedUser.lastName || ''}`.trim() : null,
        priority: conv.priority > 1,
        metadata: conv.metadata,
        pageName: pageName,
        pageId: pageId
      };
    }));

    // 🆕 Now filtering is done directly in database query - no need for local filtering!
    res.json({
      success: true,
      data: formattedConversations,
      pagination: {
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNextPage: (skip + take) < total
      },
      counts: {
        total: total,
        unreplied: unrepliedCount // 🆕 From database count
      }
    });

  } catch (error) {
    console.error('❌ Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 🆕 Get single conversation details
const getConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ success: false, message: 'Company ID required' });
    }

    const conversation = await getSharedPrismaClient().conversation.findFirst({
      where: { id, companyId }, // Ensure company isolation
      include: {
        customer: true
      }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Helper to parse metadata
    let metadata = {};
    try {
      metadata = conversation.metadata ? JSON.parse(conversation.metadata) : {};
    } catch (e) { }

    res.json({
      success: true,
      data: {
        ...conversation,
        // Add derived fields for frontend compatibility
        platform: conversation.channel?.toLowerCase(),
        lastMessage: conversation.lastMessagePreview,
        lastMessageTime: conversation.lastMessageAt,
        customerId: conversation.customerId,
        customerName: conversation.customer ? `${conversation.customer.firstName || ''} ${conversation.customer.lastName || ''}`.trim() : 'Unknown',
        pageId: metadata.pageId,
        postId: metadata.postId
      }
    });

  } catch (error) {
    console.error('❌ Error getting conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 🆕 Update conversation (status, assignment, etc.)
const updateConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, priority, tab } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ success: false, message: 'Company ID required' });
    }

    const prisma = getSharedPrismaClient();

    // Verify conversation exists and belongs to company
    const conversation = await prisma.conversation.findFirst({
      where: { id, companyId }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Build update data
    const updateData = {};

    // Update status
    if (status !== undefined) {
      // Map frontend status to database status
      const statusMap = {
        'open': 'ACTIVE',
        'pending': 'PENDING',
        'resolved': 'RESOLVED',
        'done': 'RESOLVED'
      };
      updateData.status = statusMap[status] || status.toUpperCase();
    }

    // Update assignment
    if (assignedTo !== undefined) {
      updateData.assignedUserId = assignedTo || null;
    }

    // Update priority
    if (priority !== undefined) {
      updateData.priority = priority ? 2 : 1; // 2 = high, 1 = normal
    }

    // Update metadata if tab is provided
    if (tab !== undefined) {
      let metadata = {};
      try {
        metadata = conversation.metadata ? JSON.parse(conversation.metadata) : {};
      } catch (e) { }

      metadata.tab = tab;
      updateData.metadata = JSON.stringify(metadata);
    }

    // Update conversation
    const updated = await prisma.conversation.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    // Helper to parse metadata
    let metadata = {};
    try {
      metadata = updated.metadata ? JSON.parse(updated.metadata) : {};
    } catch (e) { }

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status?.toLowerCase(),
        assignedTo: updated.assignedUserId,
        assignedToName: updated.assignedUser ? `${updated.assignedUser.firstName} ${updated.assignedUser.lastName}`.trim() : null,
        priority: updated.priority > 1,
        tab: metadata.tab || null,
        customerId: updated.customerId,
        customerName: updated.customer ? `${updated.customer.firstName || ''} ${updated.customer.lastName || ''}`.trim() : 'Unknown'
      }
    });

  } catch (error) {
    console.error('❌ Error updating conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 🆕 Get messages for a conversation
const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ success: false, message: 'Company ID required' });
    }

    // Verify conversation access first
    const conversation = await getSharedPrismaClient().conversation.findFirst({
      where: { id, companyId }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch messages
    // 🔧 FIX: Use executeWithRetry to handle connection errors
    const prisma = getSharedPrismaClient();
    const [messages, total] = await Promise.all([
      executeWithRetry(async () => {
        return await prisma.message.findMany({
          where: { conversationId: id },
          orderBy: { createdAt: 'desc' }, // Get newest first
          skip,
          take: parseInt(limit),
          include: {
            sender: { // Include sender info (Employee)
              select: { id: true, firstName: true, lastName: true }
            }
          }
        });
      }, 3),
      executeWithRetry(async () => {
        return await prisma.message.count({ where: { conversationId: id } });
      }, 3)
    ]);

    res.json({
      success: true,
      data: messages.reverse().map(msg => {
        // Parse metadata to get employeeName
        let employeeName = null;
        if (msg.metadata) {
          try {
            const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
            employeeName = metadata.employeeName;
          } catch (e) {
            // Ignore parse errors
          }
        }

        return {
          ...msg,
          // Ensure frontend compatibility fields
          // Priority: metadata.employeeName > sender relation > fallback
          senderName: employeeName ||
            (msg.sender ? `${msg.sender.firstName} ${msg.sender.lastName}` :
              (msg.isFromCustomer ? 'Customer' : 'موظف'))
        };
      }),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: (skip + messages.length) < total
      }
    });

  } catch (error) {
    console.error('❌ Error getting messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Send media message (image, video, audio, document)
const sendMediaMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    const senderId = req.user?.userId || req.user?.id;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID required'
      });
    }

    const conversation = await getSharedPrismaClient().conversation.findFirst({
      where: { id, companyId },
      include: { customer: true }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'File is required'
      });
    }

    const fileType = req.body.type || 'image';
    const caption = req.body.caption || '';
    const fileUrl = req.file.location || req.file.path || `/uploads/${req.file.filename}`;

    let senderName = 'Agent';
    if (senderId) {
      const user = await getSharedPrismaClient().user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true, email: true }
      });
      if (user) {
        senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Agent';
      }
    }

    // Save message to database
    const message = await getSharedPrismaClient().message.create({
      data: {
        conversationId: id,
        content: caption || `[${fileType}]`,
        type: fileType.toUpperCase(),
        isFromCustomer: false,
        senderId: senderId,
        metadata: JSON.stringify({
          fileUrl: fileUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          platform: conversation.channel === 'TELEGRAM' ? 'telegram' : (conversation.channel ? conversation.channel.toLowerCase() : 'facebook'),
          source: 'media_upload'
        })
      }
    });

    // Send via Telegram if it's a Telegram conversation
    if (conversation.channel === 'TELEGRAM') {
      const result = await telegramBotService.sendReply(id, caption, {
        type: fileType,
        fileUrl: fileUrl
      });
      if (!result.success) {
        console.error('Failed to send via Telegram:', result.error);
      }
    }

    // Update conversation
    await getSharedPrismaClient().conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: caption || `[${fileType}]`,
        isRead: false,
        // 🆕 FIX: Mark as replied (not from customer) so it disappears from "unreplied" tab
        lastMessageIsFromCustomer: false,
        unreadCount: 0
      }
    });

    // Emit socket event
    const io = socketService.getIO();
    if (io) {
      const socketData = {
        id: message.id,
        conversationId: message.conversationId,
        content: message.content,
        type: message.type.toLowerCase(),
        isFromCustomer: message.isFromCustomer,
        timestamp: message.createdAt,
        senderId: senderId,
        senderName: senderName,
        fileUrl: fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        metadata: JSON.parse(message.metadata),
        companyId: companyId,
        platform: conversation.channel === 'TELEGRAM' ? 'telegram' : (conversation.channel ? conversation.channel.toLowerCase() : 'facebook'),
        channel: conversation.channel || 'FACEBOOK'
      };
      io.to(`company_${companyId}`).emit('new_message', socketData);
      console.log(`⚡ [SOCKET] Media message emitted to company ${companyId}`);
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error sending media message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Edit message
const editMessage = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const { content } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID required'
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    const conversation = await getSharedPrismaClient().conversation.findFirst({
      where: { id, companyId }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    const message = await getSharedPrismaClient().message.findFirst({
      where: { id: messageId, conversationId: id }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Update message in database
    const updatedMessage = await getSharedPrismaClient().message.update({
      where: { id: messageId },
      data: { content: content.trim() }
    });

    // Edit in Telegram if it's a Telegram conversation
    if (conversation.channel === 'TELEGRAM') {
      const result = await telegramBotService.editMessage(id, messageId, content.trim());
      if (!result.success) {
        console.error('Failed to edit message in Telegram:', result.error);
      }
    }

    // Emit socket event
    socketService.sendToConversationSecure(id, companyId, 'message_edited', {
      ...updatedMessage,
      companyId: companyId
    });

    res.json({
      success: true,
      data: updatedMessage
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID required'
      });
    }

    const conversation = await getSharedPrismaClient().conversation.findFirst({
      where: { id, companyId }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    const message = await getSharedPrismaClient().message.findFirst({
      where: { id: messageId, conversationId: id }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Delete from Telegram if it's a Telegram conversation
    if (conversation.channel === 'TELEGRAM') {
      const result = await telegramBotService.deleteMessage(id, messageId);
      if (!result.success) {
        console.error('Failed to delete message in Telegram:', result.error);
      }
    }

    // Delete message from database
    await getSharedPrismaClient().message.delete({
      where: { id: messageId }
    });

    // Emit socket event
    socketService.sendToConversationSecure(id, companyId, 'message_deleted', {
      messageId: messageId,
      companyId: companyId
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * ⭐ Toggle message star status
 * PUT /conversations/:id/messages/:messageId/star
 */
const toggleMessageStar = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const companyId = req.user?.companyId;

    const message = await getSharedPrismaClient().message.findFirst({
      where: { id: messageId, conversationId: id }
    });

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    let metadata = {};
    try {
      metadata = message.metadata ? JSON.parse(message.metadata) : {};
    } catch (e) {
      metadata = {};
    }

    // Toggle star status
    const isStarred = !metadata.isStarred;
    metadata.isStarred = isStarred;

    await getSharedPrismaClient().message.update({
      where: { id: messageId },
      data: {
        metadata: JSON.stringify(metadata)
      }
    });

    // Option: Emit socket event if needed for real-time update
    // socketService.sendToConversationSecure(...)

    res.json({
      success: true,
      data: { isStarred },
      message: isStarred ? 'Message starred' : 'Message unstarred'
    });

  } catch (error) {
    console.error('Error toggling message star:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 😄 Toggle message reaction
 * PUT /conversations/:id/messages/:messageId/reaction
 */
const toggleMessageReaction = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const { reaction } = req.body; // e.g., '👍', '❤️', '😂'
    const companyId = req.user?.companyId;
    const userId = req.user?.userId || req.user?.id;

    if (!reaction) {
      return res.status(400).json({ success: false, error: 'Reaction is required' });
    }

    const message = await getSharedPrismaClient().message.findFirst({
      where: { id: messageId, conversationId: id }
    });

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    let metadata = {};
    try {
      metadata = message.metadata ? JSON.parse(message.metadata) : {};
    } catch (e) {
      metadata = {};
    }

    // Initialize reactions object if not exists: { userId: reaction }
    if (!metadata.reactions) {
      metadata.reactions = {};
    }

    const currentReaction = metadata.reactions[userId];

    if (currentReaction === reaction) {
      // Remove reaction if same
      delete metadata.reactions[userId];
    } else {
      // Add/Update reaction
      metadata.reactions[userId] = reaction;
    }

    await getSharedPrismaClient().message.update({
      where: { id: messageId },
      data: {
        metadata: JSON.stringify(metadata)
      }
    });

    // Socket emit would happen here in a real deployment

    res.json({
      success: true,
      data: { reactions: metadata.reactions },
      message: 'Reaction updated'
    });

  } catch (error) {
    console.error('Error toggling message reaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Send location message
const sendLocationMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID required'
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const conversation = await getSharedPrismaClient().conversation.findFirst({
      where: { id, companyId },
      include: { customer: true }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    const senderId = req.user?.userId || req.user?.id;
    let senderName = 'Agent';
    if (senderId) {
      const user = await getSharedPrismaClient().user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true, email: true }
      });
      if (user) {
        senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Agent';
      }
    }

    // Save message to database
    const message = await getSharedPrismaClient().message.create({
      data: {
        conversationId: id,
        content: `[Location] ${latitude}, ${longitude}`,
        type: 'TEXT',
        isFromCustomer: false,
        senderId: senderId,
        metadata: JSON.stringify({
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          type: 'location',
          platform: conversation.channel === 'TELEGRAM' ? 'telegram' : (conversation.channel ? conversation.channel.toLowerCase() : 'facebook'),
          source: 'location_share'
        })
      }
    });

    // Send via Telegram if it's a Telegram conversation
    if (conversation.channel === 'TELEGRAM') {
      const result = await telegramBotService.sendReply(id, '', {
        type: 'location',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      });
      if (!result.success) {
        console.error('Failed to send location via Telegram:', result.error);
      }
    }

    // Update conversation
    await getSharedPrismaClient().conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: '[Location]',
        isRead: false,
        // 🆕 FIX: Mark as replied
        lastMessageIsFromCustomer: false,
        unreadCount: 0
      }
    });

    // Emit socket event
    const io = socketService.getIO();
    if (io) {
      const socketData = {
        id: message.id,
        conversationId: message.conversationId,
        content: message.content,
        type: message.type.toLowerCase(),
        isFromCustomer: message.isFromCustomer,
        timestamp: message.createdAt,
        senderId: senderId,
        senderName: senderName,
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        },
        metadata: JSON.parse(message.metadata),
        companyId: companyId,
        platform: conversation.channel === 'TELEGRAM' ? 'telegram' : (conversation.channel ? conversation.channel.toLowerCase() : 'facebook'),
        channel: conversation.channel || 'FACEBOOK'
      };
      io.to(`company_${companyId}`).emit('new_message', socketData);
      console.log(`⚡ [SOCKET] Location message emitted to company ${companyId}`);
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error sending location message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 📦 تحديث محادثات متعددة دفعة واحدة
const bulkUpdateConversations = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const { conversationIds, updates } = req.body;

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'معرفات المحادثات مطلوبة'
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'بيانات التحديث مطلوبة'
      });
    }

    // التحقق من أن جميع المحادثات تنتمي للشركة
    const conversations = await getSharedPrismaClient().conversation.findMany({
      where: {
        id: { in: conversationIds },
        companyId: companyId
      },
      select: { id: true }
    });

    if (conversations.length !== conversationIds.length) {
      return res.status(403).json({
        success: false,
        message: 'بعض المحادثات غير موجودة أو لا تنتمي لشركتك'
      });
    }

    // 🔧 FIX: Map frontend fields to backend fields
    const prismaUpdates = { ...updates };
    
    console.log(`🔧 [BULK-UPDATE] Original updates:`, JSON.stringify(updates));
    
    // Handle mark_done action (maps to status: RESOLVED)
    // Frontend sends { mark_done: null } to mark conversations as done
    if (prismaUpdates.hasOwnProperty('mark_done')) {
      console.log(`🔧 [BULK-UPDATE] Converting mark_done to status: RESOLVED`);
      prismaUpdates.status = 'RESOLVED';
      delete prismaUpdates.mark_done;
    }
    
    // Map frontend status values to backend enum values
    if (prismaUpdates.status) {
      const statusMap = {
        'open': 'ACTIVE',
        'pending': 'PENDING',
        'resolved': 'RESOLVED',
        'done': 'RESOLVED'
      };
      if (statusMap[prismaUpdates.status]) {
        const originalStatus = prismaUpdates.status;
        prismaUpdates.status = statusMap[prismaUpdates.status];
        console.log(`🔧 [BULK-UPDATE] Mapped status ${originalStatus} to ${prismaUpdates.status}`);
      } else {
        // If it's already in uppercase format, keep it, otherwise try to uppercase
        prismaUpdates.status = prismaUpdates.status.toUpperCase();
      }
    }
    
    // Map frontend field names to backend field names
    if ('assignedTo' in prismaUpdates) {
      prismaUpdates.assignedUserId = prismaUpdates.assignedTo;
      delete prismaUpdates.assignedTo;
    }
    
    // Map priority boolean to integer (2 = high, 1 = normal)
    if ('priority' in prismaUpdates && typeof prismaUpdates.priority === 'boolean') {
      prismaUpdates.priority = prismaUpdates.priority ? 2 : 1;
    }

    console.log(`🔧 [BULK-UPDATE] Final Prisma updates:`, JSON.stringify(prismaUpdates));

    // تحديث المحادثات
    const result = await getSharedPrismaClient().conversation.updateMany({
      where: {
        id: { in: conversationIds },
        companyId: companyId
      },
      data: prismaUpdates
    });

    // Invalidate cache for updated conversations
    conversationIds.forEach(id => {
      conversationCache.invalidate(id);
    });

    console.log(`📦 [BULK-UPDATE] Updated ${result.count} conversations for company ${companyId}`);

    res.json({
      success: true,
      data: {
        updatedCount: result.count
      },
      message: `تم تحديث ${result.count} محادثة بنجاح`
    });
  } catch (error) {
    console.error('❌ Error bulk updating conversations:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث المحادثات',
      error: error.message
    });
  }
};

// Snooze conversation
const snoozeConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { snoozeUntil } = req.body;
    const companyId = req.user.companyId;

    if (!snoozeUntil) {
      return res.status(400).json({ error: 'Snooze date is required' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: id },
      select: { metadata: true, companyId: true }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.companyId !== companyId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let metadata = {};
    try {
      metadata = JSON.parse(conversation.metadata || '{}');
    } catch (e) {
      metadata = {};
    }

    metadata.snoozedUntil = snoozeUntil;

    const updated = await prisma.conversation.update({
      where: { id: id },
      data: {
        metadata: JSON.stringify(metadata),
        // Optionally update status? Maybe not.
        // status: 'snoozed' // Only if we had this status enum.
      }
    });

    res.json({ message: 'Conversation snoozed', snoozedUntil });
  } catch (error) {
    console.error('Error snoozing conversation:', error);
    res.status(500).json({ error: 'Failed to snooze conversation' });
  }
};

// Get conversation statistics
const getConversationStats = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    const prisma = getSharedPrismaClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. عدد المحادثات الجديدة (التي لم يتم الرد عليها)
    const newConversations = await prisma.conversation.count({
      where: {
        companyId: companyId,
        status: { not: 'RESOLVED' },
        // المحادثات التي آخر رسالة فيها من العميل
        // سنستخدم metadata أو نفحص lastMessage
        // للبساطة، سنستخدم unreadCount > 0 أو نفحص الرسائل
        unreadCount: { gt: 0 }
      }
    });

    // طريقة أخرى: عد المحادثات التي آخر رسالة فيها من العميل
    // سنحتاج إلى فحص الرسائل الأخيرة
    const allActiveConversations = await prisma.conversation.findMany({
      where: {
        companyId: companyId,
        status: { not: 'RESOLVED' }
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            isFromCustomer: true,
            createdAt: true
          }
        }
      }
    });

    // عد المحادثات التي آخر رسالة فيها من العميل (جديدة)
    let newConversationsCount = 0;
    allActiveConversations.forEach(conv => {
      if (conv.messages.length > 0 && conv.messages[0].isFromCustomer) {
        newConversationsCount++;
      }
    });

    // 2. عدد المحادثات التي رد عليها كل موظف اليوم
    const todayMessages = await prisma.message.findMany({
      where: {
        conversation: {
          companyId: companyId
        },
        isFromCustomer: false,
        senderId: { not: null }, // فقط الرسائل من الموظفين (ليست من AI)
        createdAt: {
          gte: today
        }
      },
      select: {
        conversationId: true,
        senderId: true,
        metadata: true,
        createdAt: true
      }
    });

    // تجميع المحادثات الفريدة لكل موظف
    const employeeReplies = {};

    for (const msg of todayMessages) {
      let employeeId = msg.senderId;
      let employeeName = 'غير معروف';

      // محاولة استخراج اسم الموظف من metadata
      if (msg.metadata) {
        try {
          const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
          if (metadata.employeeId) employeeId = metadata.employeeId;
          if (metadata.employeeName) employeeName = metadata.employeeName;
        } catch (e) {
          // ignore
        }
      }

      // جلب اسم الموظف من قاعدة البيانات إذا لم يكن موجوداً في metadata
      if (!employeeReplies[employeeId]) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: employeeId },
            select: { firstName: true, lastName: true, email: true }
          });
          if (user) {
            employeeName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'غير معروف';
          }
        } catch (e) {
          // ignore
        }
        employeeReplies[employeeId] = {
          name: employeeName,
          count: 0,
          conversationIds: new Set()
        };
      }

      // إضافة المحادثة إلى مجموعة الموظف (فقط مرة واحدة لكل محادثة)
      employeeReplies[employeeId].conversationIds.add(msg.conversationId);
    }

    // حساب العدد النهائي لكل موظف
    const employeeStats = Object.entries(employeeReplies).map(([id, data]) => ({
      employeeId: id,
      employeeName: data.name,
      conversationsRepliedTo: data.conversationIds.size
    })).sort((a, b) => b.conversationsRepliedTo - a.conversationsRepliedTo);

    res.json({
      success: true,
      data: {
        newConversationsCount,
        employeeRepliesToday: employeeStats,
        totalEmployeesReplied: employeeStats.length,
        date: today.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Error getting conversation stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'فشل في جلب الإحصائيات'
    });
  }
};

// Sync Facebook messages from Facebook Graph API
const syncFacebookMessages = async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const prisma = getSharedPrismaClient();

    // Get conversation with customer info
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        companyId: companyId,
        channel: 'FACEBOOK'
      },
      include: {
        customer: {
          select: {
            id: true,
            facebookId: true
          }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة أو ليست محادثة Facebook'
      });
    }

    if (!conversation.customer?.facebookId) {
      return res.status(400).json({
        success: false,
        message: 'العميل لا يملك معرف Facebook'
      });
    }

    // Get pageId from conversation metadata or pageId field
    let pageId = null;
    if (conversation.metadata) {
      try {
        const metadata = JSON.parse(conversation.metadata);
        pageId = metadata.pageId;
      } catch (e) {
        // ignore parse error
      }
    }

    if (!pageId) {
      // Try to get pageId from conversation.pageId if exists
      // Or find first connected Facebook page for the company
      const defaultPage = await prisma.facebookPage.findFirst({
        where: {
          companyId: companyId,
          status: 'connected'
        },
        orderBy: { connectedAt: 'desc' }
      });
      if (defaultPage) {
        pageId = defaultPage.pageId;
      }
    }

    if (!pageId) {
      return res.status(400).json({
        success: false,
        message: 'لا توجد صفحة Facebook متصلة'
      });
    }

    // Get page access token
    const pageData = await getPageToken(pageId);
    if (!pageData || !pageData.pageAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن الوصول إلى صفحة Facebook'
      });
    }

    const psid = conversation.customer.facebookId;
    const accessToken = pageData.pageAccessToken;

    // Fetch messages from Facebook Graph API
    // Steps: 1) Get conversation ID using PSID, 2) Fetch messages from conversation
    let allMessages = [];

    try {
      // Step 1: Get conversation ID using page conversations endpoint with user_id filter
      const conversationsUrl = `https://graph.facebook.com/v18.0/${pageId}/conversations?user_id=${psid}&fields=id&access_token=${accessToken}`;

      const conversationsResponse = await axios.get(conversationsUrl);

      if (!conversationsResponse.data?.data || conversationsResponse.data.data.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'لم يتم العثور على محادثة في Facebook لهذا العميل',
          info: 'تأكد من أن المحادثة موجودة في صفحة Facebook'
        });
      }

      const conversationId = conversationsResponse.data.data[0].id;

      // Step 2: Fetch messages from the conversation
      // Increase limit to reduce number of API calls
      // Include attachments with full details, and shares for interactive messages
      let messagesUrl = `https://graph.facebook.com/v18.0/${conversationId}/messages?fields=id,message,from,to,created_time,attachments{id,type,file_url,url,mime_type,name,image_data{url},payload{template_type,text,buttons{type,title,url,payload}}},sticker,shares&limit=50&access_token=${accessToken}`;

      let pageCount = 0;
      const maxPages = 3; // Limit to 3 pages (150 messages max) to prevent timeout

      while (messagesUrl && pageCount < maxPages) {
        const messagesResponse = await axios.get(messagesUrl, {
          timeout: 30000 // 30 seconds timeout per request
        });
        const messagesData = messagesResponse.data;

        if (messagesData.data && Array.isArray(messagesData.data)) {
          console.log(`📥 [SYNC-FB-MESSAGES] Fetched ${messagesData.data.length} messages from page ${pageCount + 1}`);

          // Count messages with attachments in this batch
          const messagesWithAttachments = messagesData.data.filter(m => m.attachments?.data?.length > 0);
          const messagesWithButtons = messagesData.data.filter(m =>
            m.attachments?.data?.[0]?.payload?.buttons?.length > 0
          );
          console.log(`   📎 Messages with attachments: ${messagesWithAttachments.length}`);
          console.log(`   🔘 Messages with buttons: ${messagesWithButtons.length}`);

          // Log first message with attachments for debugging
          if (messagesWithAttachments.length > 0 && pageCount === 0) {
            const sampleMsg = messagesWithAttachments[0];
            console.log(`   🔍 [SAMPLE-ATTACHMENT] First message with attachment:`, {
              messageId: sampleMsg.id,
              attachmentType: sampleMsg.attachments.data[0].type,
              hasFileUrl: !!sampleMsg.attachments.data[0].file_url,
              hasUrl: !!sampleMsg.attachments.data[0].url,
              hasPayload: !!sampleMsg.attachments.data[0].payload,
              payloadKeys: sampleMsg.attachments.data[0].payload ? Object.keys(sampleMsg.attachments.data[0].payload) : [],
              fullAttachment: JSON.stringify(sampleMsg.attachments.data[0], null, 2).substring(0, 500)
            });
          }

          allMessages = allMessages.concat(messagesData.data);
        }

        // Check for next page
        if (messagesData.paging && messagesData.paging.next) {
          messagesUrl = messagesData.paging.next;
          pageCount++;
        } else {
          messagesUrl = null;
        }
      }

      if (allMessages.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'لا توجد رسائل في هذه المحادثة',
          info: 'المحادثة موجودة ولكن لا تحتوي على رسائل'
        });
      }

    } catch (facebookError) {
      console.error('❌ [SYNC-FB-MESSAGES] Error fetching messages from Facebook:', facebookError.response?.data || facebookError.message);
      console.error('❌ [SYNC-FB-MESSAGES] Error details:', {
        status: facebookError.response?.status,
        statusText: facebookError.response?.statusText,
        data: facebookError.response?.data,
        message: facebookError.message
      });

      // Provide helpful error message based on error type
      const errorData = facebookError.response?.data?.error;

      if (errorData) {
        // Permission errors
        if (errorData.code === 100 || errorData.type === 'OAuthException') {
          return res.status(403).json({
            success: false,
            message: 'لا توجد صلاحيات كافية لجلب الرسائل من Facebook',
            error: errorData.message || 'Facebook API permissions required',
            info: 'تأكد من أن الصفحة لديها صلاحيات pages_messaging'
          });
        }

        // Not found errors
        if (errorData.code === 803 || facebookError.response.status === 404) {
          return res.status(404).json({
            success: false,
            message: 'لم يتم العثور على المحادثة أو الرسائل',
            error: errorData.message
          });
        }
      }

      // Return error with details
      const errorMessage = errorData?.message || facebookError.message || 'فشل في جلب الرسائل من Facebook';
      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: errorMessage,
        code: errorData?.code || facebookError.response?.status || 500,
        type: errorData?.type || 'UNKNOWN_ERROR'
      });
    }

    // Process and save messages to database
    // First, get all existing Facebook message IDs to avoid duplicate checks in loop
    const existingMessages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        metadata: {
          contains: 'facebookMessageId'
        }
      },
      select: {
        id: true,
        metadata: true
      }
    });

    // Extract existing Facebook message IDs
    const existingFacebookIds = new Set();
    existingMessages.forEach(msg => {
      try {
        const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
        if (metadata.facebookMessageId) {
          existingFacebookIds.add(metadata.facebookMessageId);
        }
      } catch (e) {
        // ignore
      }
    });

    let skippedCount = 0;
    let errorCount = 0;
    const messagesToSave = [];

    for (const fbMessage of allMessages) {
      try {
        // Calculate message index early for logging
        const messageIndex = allMessages.indexOf(fbMessage);

        // Check if message already exists using the Set (much faster)
        if (existingFacebookIds.has(fbMessage.id)) {
          skippedCount++;
          continue;
        }

        // Determine message type and content
        let messageType = 'TEXT';
        let content = fbMessage.message || '';

        // Check for attachments first (includes images, files, and template messages with buttons)
        if (fbMessage.attachments && fbMessage.attachments.data && fbMessage.attachments.data.length > 0) {
          const attachment = fbMessage.attachments.data[0];

          // Determine attachment type - Facebook API may not always include 'type' field
          // Infer type from available fields: type, mime_type, or presence of image_data
          let attachmentType = attachment.type;
          if (!attachmentType) {
            // Infer from mime_type
            if (attachment.mime_type) {
              if (attachment.mime_type.startsWith('image/')) {
                attachmentType = 'image';
              } else if (attachment.mime_type.startsWith('video/')) {
                attachmentType = 'video';
              } else if (attachment.mime_type.startsWith('audio/')) {
                attachmentType = 'audio';
              } else {
                attachmentType = 'file';
              }
            } else if (attachment.image_data) {
              // Has image_data but no type - assume image
              attachmentType = 'image';
            } else if (attachment.payload) {
              // Has payload - could be template
              attachmentType = attachment.payload.template_type ? 'template' : 'file';
            } else {
              attachmentType = 'file'; // Default
            }
          }

          // CRITICAL: If image_data.url exists, treat as image regardless of attachmentType
          // Facebook API sometimes doesn't set 'type' correctly but provides image_data
          if (attachment.image_data?.url && attachmentType !== 'template') {
            attachmentType = 'image';
          }

          // Handle template messages (e.g., messages with buttons)
          if (attachmentType === 'template' && attachment.payload) {
            messageType = 'TEXT'; // Keep as TEXT to show the message content
            const templatePayload = attachment.payload;

            // Extract template text
            let templateText = templatePayload.text || fbMessage.message || '';

            // Extract buttons if they exist
            if (templatePayload.buttons && Array.isArray(templatePayload.buttons) && templatePayload.buttons.length > 0) {
              const buttonsText = templatePayload.buttons.map((btn, idx) => {
                return `${idx + 1}. ${btn.title || btn.text || 'زر'}`;
              }).join('\n');
              templateText += '\n\n' + '🔘 الأزرار:\n' + buttonsText;
            }

            content = templateText || 'رسالة تفاعلية';

          } else if (attachmentType === 'image' || attachmentType === 'animated_image') {
            messageType = 'IMAGE';
            // Try multiple possible URL fields (Facebook API may use different field names)
            // Priority: image_data.url (most reliable), then file_url, then url
            const imageUrl = attachment.image_data?.url ||
              attachment.file_url ||
              attachment.url ||
              attachment.payload?.url ||
              attachment.image?.url ||
              '';
            content = imageUrl;
            // Keep message text if exists (for captions)
            if (fbMessage.message && fbMessage.message.trim()) {
              content = fbMessage.message + ' |IMAGE_URL|' + imageUrl;
            }

            // If URL is missing, try to fetch attachment separately
            if (!imageUrl) {
              // Try fetching attachment by ID if we have it
              if (attachment.id) {
                try {
                  const attachmentUrl = `https://graph.facebook.com/v18.0/${attachment.id}?fields=url,image_data{url}&access_token=${accessToken}`;
                  const attachmentResponse = await axios.get(attachmentUrl, { timeout: 5000 });
                  const fetchedUrl = attachmentResponse.data?.image_data?.url || attachmentResponse.data?.url;
                  if (fetchedUrl) {
                    content = fetchedUrl;
                    if (fbMessage.message && fbMessage.message.trim()) {
                      content = fbMessage.message + ' |IMAGE_URL|' + fetchedUrl;
                    }
                  }
                } catch (fetchError) {
                  // Try fetching the message separately as fallback
                  try {
                    const messageDetailsUrl = `https://graph.facebook.com/v18.0/${fbMessage.id}?fields=attachments{id,image_data{url},file_url,url}&access_token=${accessToken}`;
                    const messageDetailsResponse = await axios.get(messageDetailsUrl, { timeout: 5000 });
                    if (messageDetailsResponse.data?.attachments?.data?.[0]) {
                      const detailedAttachment = messageDetailsResponse.data.attachments.data[0];
                      const detailedImageUrl = detailedAttachment.image_data?.url || detailedAttachment.file_url || detailedAttachment.url;
                      if (detailedImageUrl) {
                        content = detailedImageUrl;
                        if (fbMessage.message && fbMessage.message.trim()) {
                          content = fbMessage.message + ' |IMAGE_URL|' + detailedImageUrl;
                        }
                      }
                    }
                  } catch (messageFetchError) {
                  }
                }
              } else {
                // No attachment ID, try message fetch
                try {
                  const messageDetailsUrl = `https://graph.facebook.com/v18.0/${fbMessage.id}?fields=attachments{id,image_data{url},file_url,url}&access_token=${accessToken}`;
                  const messageDetailsResponse = await axios.get(messageDetailsUrl, { timeout: 5000 });
                  if (messageDetailsResponse.data?.attachments?.data?.[0]) {
                    const detailedAttachment = messageDetailsResponse.data.attachments.data[0];
                    const detailedImageUrl = detailedAttachment.image_data?.url || detailedAttachment.file_url || detailedAttachment.url;
                    if (detailedImageUrl) {
                      content = detailedImageUrl;
                      if (fbMessage.message && fbMessage.message.trim()) {
                        content = fbMessage.message + ' |IMAGE_URL|' + detailedImageUrl;
                      }
                    }
                  }
                } catch (messageFetchError) {
                  // Failed to fetch message details, continue
                }
              }
            }
          } else if (attachmentType === 'file') {
            messageType = 'FILE';
            const fileUrl = attachment.file_url || attachment.url || attachment.payload?.url || attachment.name || '';
            content = fileUrl;
            if (fbMessage.message && fbMessage.message.trim()) {
              content = fbMessage.message + ' |FILE_URL|' + fileUrl;
            }
          } else if (attachmentType === 'video') {
            messageType = 'FILE'; // Treat video as file
            const videoUrl = attachment.file_url || attachment.url || attachment.payload?.url || '';
            content = videoUrl;
            if (fbMessage.message && fbMessage.message.trim()) {
              content = fbMessage.message + ' |VIDEO_URL|' + videoUrl;
            }
          } else if (attachmentType === 'audio') {
            messageType = 'FILE'; // Treat audio as file
            const audioUrl = attachment.file_url || attachment.url || attachment.payload?.url || '';
            content = audioUrl;
            if (fbMessage.message && fbMessage.message.trim()) {
              content = fbMessage.message + ' |AUDIO_URL|' + audioUrl;
            }
          } else if (attachmentType === 'sticker') {
            messageType = 'IMAGE';
            content = attachment.url || attachment.file_url || attachment.payload?.url || '';
          } else {
            // Unknown attachment type - check if it has image_data, treat as image
            if (attachment.image_data?.url) {
              messageType = 'IMAGE';
              const imageUrl = attachment.image_data.url;
              content = imageUrl;
              if (fbMessage.message && fbMessage.message.trim()) {
                content = fbMessage.message + ' |IMAGE_URL|' + imageUrl;
              }
            } else {
              // Unknown attachment type - try to extract URL or use message text
              const url = attachment.file_url || attachment.url || attachment.payload?.url || '';
              content = url || fbMessage.message || 'مرفق';
            }
          }
        } else if (fbMessage.sticker) {
          messageType = 'IMAGE';
          content = fbMessage.sticker.url || fbMessage.sticker.file_url || '';
        } else if (fbMessage.shares) {
          // Handle shared content (links, posts, etc.)
          messageType = 'TEXT';
          if (fbMessage.message && fbMessage.message.trim()) {
            content = fbMessage.message;
          } else {
            content = 'محتوى مشترك';
          }
        }

        // If no content and no attachments, check if it's a system message or empty
        // For sent messages from page, Facebook might not include message field in some cases
        // Check if there's any text content in the message object
        if (!content || content.trim() === '') {
          // Try to extract from message field if it exists but wasn't captured
          if (fbMessage.message && fbMessage.message.trim()) {
            content = fbMessage.message.trim();
          } else if (messageType === 'TEXT') {
            // For text messages without content, check if it's a system message
            // Facebook sometimes sends empty messages for system events
            content = 'رسالة بدون نص';
          }
        }

        // Determine if message is from customer
        // In Facebook API:
        // - When customer sends: from.id = PSID (customer's page-scoped ID), to.data[0].id = pageId
        // - When page sends: from.id = pageId, to.data[0].id = PSID
        // So: message is from customer if from.id === psid (and NOT pageId)
        let finalIsFromCustomer = false;
        let decisionReason = '';

        if (fbMessage.from && fbMessage.from.id) {
          const fromId = fbMessage.from.id;

          // Primary check: if from.id equals PSID, it's from customer
          if (fromId === psid) {
            finalIsFromCustomer = true;
            decisionReason = 'fromId === psid';
          } else if (fromId === pageId) {
            // If from.id equals pageId, it's definitely from page (not customer)
            finalIsFromCustomer = false;
            decisionReason = 'fromId === pageId';
          } else {
            // Fallback: check 'to' field
            // If message is sent TO PSID, then it's FROM page (because page sends TO customer)
            // If message is sent TO pageId, then it's FROM customer (because customer sends TO page)
            if (fbMessage.to && fbMessage.to.data && fbMessage.to.data.length > 0) {
              const toIds = fbMessage.to.data.map(t => t.id);
              const isSentToPsid = toIds.includes(psid);
              const isSentToPageId = toIds.includes(pageId);

              if (isSentToPsid && !isSentToPageId) {
                // Sent to PSID only → from page
                finalIsFromCustomer = false;
                decisionReason = 'to.includes(psid) only';
              } else if (isSentToPageId && !isSentToPsid) {
                // Sent to pageId only → from customer
                finalIsFromCustomer = true;
                decisionReason = 'to.includes(pageId) only';
              } else {
                // Ambiguous case - default to false (assume from page)
                finalIsFromCustomer = false;
                decisionReason = 'ambiguous - default false';
              }
            } else {
              decisionReason = 'no to field - default false';
            }
          }
        } else {
          decisionReason = 'no from field - default false';
        }

        // Parse created_time
        const createdAt = fbMessage.created_time ? new Date(fbMessage.created_time) : new Date();

        // Prepare content for saving (do this BEFORE logging)
        let finalContent = content;
        if (messageType === 'IMAGE' && !finalContent) {
          finalContent = '📷 صورة';
        } else if (messageType === 'FILE' && !finalContent) {
          finalContent = '📎 ملف';
        } else if (messageType === 'TEXT' && (!finalContent || finalContent.trim() === '')) {
          finalContent = 'رسالة';
        }


        // Add to batch for bulk insert
        messagesToSave.push({
          content: finalContent,
          type: messageType,
          conversationId: conversationId,
          isFromCustomer: finalIsFromCustomer,
          isRead: false, // Mark as unread for old messages
          metadata: JSON.stringify({
            platform: 'facebook',
            source: 'graph_api_sync',
            facebookMessageId: fbMessage.id,
            syncedAt: new Date().toISOString(),
            fromId: fbMessage.from?.id || null,
            toIds: fbMessage.to?.data?.map(t => t.id) || [],
            originalMessage: fbMessage.message || null, // Store original message text if exists
            hasAttachments: !!(fbMessage.attachments || fbMessage.sticker),
            hasButtons: !!(fbMessage.attachments?.data?.[0]?.type === 'template' && fbMessage.attachments.data[0].payload?.buttons),
            shares: fbMessage.shares || null,
            // Store full attachment data for reference
            attachmentDetails: fbMessage.attachments?.data || null
          }),
          createdAt: createdAt
        });

      } catch (parseError) {
        console.error(`Error parsing message ${fbMessage.id}:`, parseError);
        errorCount++;
        // Continue with next message
      }
    }

    // Bulk save messages to database (much faster than individual creates)
    let savedCount = 0;

    // Console summary for debugging
    const customerMessages = messagesToSave.filter(m => m.isFromCustomer);
    const pageMessages = messagesToSave.filter(m => !m.isFromCustomer);
    const messagesWithAttachments = messagesToSave.filter(m => {
      try {
        const meta = JSON.parse(m.metadata);
        return meta.hasAttachments || meta.hasButtons;
      } catch { return false; }
    });

    console.log(`📊 [SYNC-SUMMARY] Messages to save:`, {
      total: messagesToSave.length,
      fromCustomer: customerMessages.length,
      fromPage: pageMessages.length,
      withAttachments: messagesWithAttachments.length,
      messageTypes: messagesToSave.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
      }, {})
    });

    if (messagesToSave.length > 0) {
      try {
        // Use createMany for bulk insert (faster)
        const result = await prisma.message.createMany({
          data: messagesToSave,
          skipDuplicates: true // Skip duplicates if any
        });
        savedCount = result.count;

        console.log(`✅ [SYNC-FB-MESSAGES] Saved ${savedCount} messages in bulk`);
      } catch (bulkSaveError) {
        console.error('❌ [SYNC-FB-MESSAGES] Error in bulk save, trying individual saves:', bulkSaveError);
        // Fallback to individual saves if bulk fails
        for (const msgData of messagesToSave) {
          try {
            await prisma.message.create({ data: msgData });
            savedCount++;
          } catch (indError) {
            console.error('❌ [SYNC-FB-MESSAGES] Error saving individual message:', indError);
            errorCount++;
          }
        }
      }
    }

    // Update conversation last message time
    if (savedCount > 0) {
      try {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            updatedAt: new Date()
          }
        });
      } catch (updateError) {
        console.error('Error updating conversation:', updateError);
      }
    }

    // Always return success if we fetched messages, even if some failed to save
    const successMessage = savedCount > 0
      ? `تم جلب ${savedCount} رسالة جديدة وتم تخطي ${skippedCount} رسالة موجودة${errorCount > 0 ? ` وفشل حفظ ${errorCount} رسالة` : ''}`
      : `تم جلب ${allMessages.length} رسالة ولكنها موجودة مسبقاً (تم تخطي ${skippedCount} رسالة)${errorCount > 0 ? ` وفشل حفظ ${errorCount} رسالة` : ''}`;

    res.json({
      success: true,
      message: successMessage,
      data: {
        totalFetched: allMessages.length,
        saved: savedCount,
        skipped: skippedCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('❌ [SYNC-FB-MESSAGES] Error syncing Facebook messages:', error);
    console.error('❌ [SYNC-FB-MESSAGES] Error stack:', error.stack);

    // Provide more detailed error message
    let errorMessage = 'حدث خطأ أثناء جلب الرسائل';
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get external messages statistics (messages from external sites without employee name)
const getExternalMessagesStats = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح بالوصول - معرف الشركة مطلوب'
      });
    }

    // Get date from query parameter, default to today
    const { date } = req.query;
    let targetDate = new Date();
    
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'تاريخ غير صحيح. استخدم الصيغة YYYY-MM-DD'
        });
      }
    }

    // Set time to start of day (00:00:00)
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log(`📊 [EXTERNAL MSGS STATS] جلب إحصائيات الرسائل الخارجية - الشركة: ${companyId}, التاريخ: ${targetDate.toISOString().split('T')[0]}`);

    const prisma = getSharedPrismaClient();

    // Build where clause for external messages
    // External messages: isFromCustomer = false AND senderId = null
    const whereClause = {
      conversation: {
        companyId: companyId
      },
      isFromCustomer: false,
      senderId: null,
      createdAt: {
        gte: targetDate,
        lt: nextDay
      }
    };

    // 1. Count total external messages
    const totalMessages = await prisma.message.count({
      where: whereClause
    });

    // 2. Get unique conversations that contain external messages
    const messagesWithConversations = await prisma.message.findMany({
      where: whereClause,
      select: {
        conversationId: true
      },
      distinct: ['conversationId']
    });

    const uniqueConversations = messagesWithConversations.length;

    // 3. Get hourly distribution
    const messages = await prisma.message.findMany({
      where: whereClause,
      select: {
        createdAt: true
      }
    });

    // Initialize hourly distribution array (0-23)
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0
    }));

    // Count messages per hour
    messages.forEach(msg => {
      const hour = new Date(msg.createdAt).getHours();
      hourlyDistribution[hour].count++;
    });

    console.log(`✅ [EXTERNAL MSGS STATS] تم جلب الإحصائيات - الرسائل: ${totalMessages}, المحادثات: ${uniqueConversations}`);

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        totalMessages,
        uniqueConversations,
        hourlyDistribution
      }
    });

  } catch (error) {
    console.error('❌ [EXTERNAL MSGS STATS] خطأ في جلب إحصائيات الرسائل الخارجية:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'فشل في جلب الإحصائيات'
    });
  }
};

module.exports = {
  deleteConverstation,
  postMessageConverstation,
  uploadFile,
  postReply,
  checkHealth,
  markConversationAsRead,
  markConversationAsUnread,
  sendExistingImage,
  getConversationPostDetails,
  getPostsAITracking,
  getPostDetails,
  updatePostFeaturedProduct,
  // New exports
  getConversations,
  getConversation,
  updateConversation,
  getMessages,
  // Media and message management
  sendMediaMessage,
  editMessage,
  deleteMessage,
  toggleMessageStar,
  toggleMessageReaction,
  snoozeConversation,
  sendLocationMessage,
  bulkUpdateConversations,
  // Statistics
  getConversationStats,
  getExternalMessagesStats,
  syncFacebookMessages
};

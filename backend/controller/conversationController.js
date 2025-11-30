const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();
const socketService = require('../services/socketService');
const axios = require('axios');
const MessageHealthChecker = require('../utils/messageHealthChecker');
// Import production Facebook fix functions
const { sendProductionFacebookMessage } = require('../production-facebook-fix');
// Import cache invalidation utility
const { conversationCache } = require('../utils/cachingUtils');

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
    const page = await prisma.facebookPage.findUnique({
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
    const conversation = await prisma.conversation.findUnique({
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
    const deletedMessages = await prisma.message.deleteMany({
      where: { conversationId: id }
    });

    // Delete conversation memory
    await prisma.conversationMemory.deleteMany({
      where: { conversationId: id }
    });

    // Delete the conversation
    await prisma.conversation.delete({
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
    const { message } = req.body;

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
    
    const [conversation, user] = await Promise.all([
      prisma.conversation.findUnique({
        where: { id },
        include: {
          customer: true
        }
      }),
      // جلب معلومات المستخدم فقط إذا كان موجود
      senderId ? prisma.user.findUnique({
        where: { id: senderId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }) : Promise.resolve(null)
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
      
      //console.log(`🔍 [DEBUG] req.user data:`, {
      //   userId: req.user.userId,
      //   id: req.user.id,
      //   email: req.user.email,
      //   role: req.user.role,
      //   calculatedName: senderName
      // });
      
      conversationMetadata.lastSenderId = senderId; // معرف الموظف اللي بعت الرسالة
      conversationMetadata.lastSenderName = senderName; // اسم الموظف
      
      //console.log(`👤 [SENDER-INFO] Saved sender info: ${senderId} - ${senderName}`);
    } else {
      console.warn(`⚠️ [SENDER-INFO] req.user or senderId is missing!`, req.user);
    }

    // ⚡ OPTIMIZATION: Combine all conversation updates into one query
    const conversationUpdateData = {
      metadata: JSON.stringify(conversationMetadata),
      updatedAt: new Date()
    };
    
    // Add lastMessage fields if message is not empty
    if (message && message.trim() !== '') {
      conversationUpdateData.lastMessageAt = new Date();
      conversationUpdateData.lastMessagePreview = message.length > 100 ? message.substring(0, 100) + '...' : message;
    }
    
    // Single update query instead of 2-3 separate ones
    await prisma.conversation.update({
      where: { id },
      data: conversationUpdateData
    });

    // ⚡ OPTIMIZATION: Cache invalidation moved after update
    if (conversation && conversation.companyId) {
      // Non-blocking cache invalidation
      conversationCache.invalidateConversation(id, conversation.companyId);
      //console.log(`🧹 [CACHE] Invalidated cache for conversation ${id}`);
    }

    // 💾 حفظ الرسالة فوراً في قاعدة البيانات (INSTANT SAVE)
    let savedMessage = null;
    try {
      savedMessage = await prisma.message.create({
        data: {
          content: message,
          type: 'TEXT',
          conversationId: id,
          isFromCustomer: false,
          senderId: senderId, // معرف الموظف
          metadata: JSON.stringify({
            platform: 'facebook',
            source: 'manual_reply',
            employeeId: senderId,
            employeeName: senderName,
            isFacebookReply: true,
            timestamp: new Date(),
            instantSave: true // علامة لتحديد أن هذه الرسالة تم حفظها فوراً
          }),
          createdAt: new Date()
        }
      });
      
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
          isFacebookReply: true,
          senderId: senderId,
          senderName: senderName,
          lastMessageIsFromCustomer: false,
          lastCustomerMessageIsUnread: false
        };
        
        io.emit('new_message', socketData);
        console.log(`⚡ [SOCKET] Message emitted immediately to frontend`);
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
            const facebookPage = await prisma.facebookPage.findFirst({
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
            const { sendProductionFacebookMessage } = require('../production-facebook-fix');
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
                await prisma.message.update({
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
              await prisma.conversation.update({
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
              await prisma.conversation.update({
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

    const uploadedFiles = [];

    // Process each file
    for (const file of files) {
      const fileUrl = `/uploads/conversations/${file.filename}`;

      // 🔧 تحسين: استخدام ngrok URL إذا كان متاحاً
      let fullUrl;
      const ngrokUrl = 'https://www.mokhtarelhenawy.online';
      if (ngrokUrl && ngrokUrl.startsWith('http')) {
        // استخدام ngrok للصور ليتمكن Facebook من الوصول إليها
        fullUrl = `${ngrokUrl}${fileUrl}`;
      } else {
        // العودة للرابط المحلي العادي
        fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;
      }

      // Determine message type
      const messageType = file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE';

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
        const user = await prisma.user.findUnique({
          where: { id: senderId },
          select: { firstName: true, lastName: true, email: true }
        });
        if (user) {
          senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'موظف';
        }
      }

      // 💾 حفظ الملف فوراً في قاعدة البيانات (INSTANT SAVE)
      let savedFileMessage = null;
      try {
        savedFileMessage = await prisma.message.create({
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
            lastCustomerMessageIsUnread: false
          };
          
          io.emit('new_message', socketData);
          console.log(`⚡ [SOCKET-FILE] ${messageType} emitted immediately to frontend`);
        }
      } catch (saveError) {
        console.error(`❌ [INSTANT-SAVE-FILE] Error saving ${messageType}:`, saveError.message);
      }

      // Update conversation last message
      await prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: messageType === 'IMAGE' ? '📷 صورة' : `📎 ${file.originalname}`,
          updatedAt: new Date()
        }
      });

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
        const conversation = await prisma.conversation.findUnique({
          where: { id },
          include: { customer: true }
        });

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
            facebookPage = await prisma.facebookPage.findFirst({
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
                    await prisma.message.update({
                      where: { id: savedFileMessage.id },
                      data: {
                        metadata: JSON.stringify({
                          ...JSON.parse(savedFileMessage.metadata),
                          facebookMessageId: facebookMessageId,
                          sentToFacebook: true
                        })
                      }
                    });
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
                  await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: {
                      metadata: JSON.stringify({
                        ...conversation.metadata ? JSON.parse(conversation.metadata) : {},
                        lastFacebookError: 'NO_MATCHING_USER',
                        lastFacebookErrorMessage: 'العميل لم يبدأ محادثة مع الصفحة',
                        lastFacebookErrorAt: new Date().toISOString()
                      })
                    }
                  });
                }
              }
            } catch (fbError) {
              console.error(`❌ [FACEBOOK-FILE] Production send error:`, fbError.message);
            }
          } else {
            //console.log(`⚠️ [FACEBOOK-FILE] No Facebook page configured for company ${conversation.companyId}`);
          }
        } else {
          //console.log(`⚠️ [FACEBOOK-FILE] Conversation ${id} is not from Facebook or customer has no Facebook ID`);
        }
      } catch (facebookError) {
        console.error(`❌ [FACEBOOK-FILE] Error in Facebook integration:`, facebookError.message);
      }
    }

    // Return success response with all uploaded files
    res.json({
      success: true,
      message: `${files.length} file(s) uploaded successfully`,
      data: uploadedFiles
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
} 

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
      prisma.conversation.findUnique({
        where: { id },
        include: { customer: true }
      }),
      senderId ? prisma.user.findUnique({
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
      savedMessage = await prisma.message.create({
        data: {
          content: message || (hasImages ? `${imageUrls.length} صورة` : ''),
          type: messageType,
          conversationId: id,
          isFromCustomer: false,
          senderId: senderId,
          attachments: attachmentsData ? JSON.stringify(attachmentsData) : null,
          metadata: JSON.stringify({
            platform: 'facebook',
            source: 'quick_reply',
            employeeId: senderId,
            employeeName: senderName,
            isFacebookReply: true,
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
          isFacebookReply: true,
          senderId: senderId,
          senderName: senderName,
          lastMessageIsFromCustomer: false,
          lastCustomerMessageIsUnread: false
        };
        
        io.emit('new_message', socketData);
        console.log(`⚡ [SOCKET-REPLY] Message emitted immediately to frontend`);
      }
      
      // Update conversation last message
      await prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: message.length > 100 ? message.substring(0, 100) + '...' : message,
          updatedAt: new Date()
        }
      });
    } catch (saveError) {
      console.error('❌ [INSTANT-SAVE-REPLY] Error saving message:', saveError.message);
    }

    // NEW: Send message to Facebook Messenger if conversation is from Facebook
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
          facebookPage = await prisma.facebookPage.findFirst({
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
                } catch (_) {}
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
                await prisma.message.update({
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
              await prisma.conversation.update({
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
              await prisma.conversation.update({
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
      await prisma.conversation.update({
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

    // Verify conversation belongs to this company
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        companyId
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة أو غير مصرح بالوصول'
      });
    }

    // Update all unread messages from customer to read
    const result = await prisma.message.updateMany({
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

    //console.log(`✅ [MARK-READ] Marked ${result.count} messages as read in conversation ${id}`);

    res.json({
      success: true,
      message: `تم تحديد ${result.count} رسالة كمقروءة`,
      markedCount: result.count
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
    const conversation = await prisma.conversation.findFirst({
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
    await prisma.conversation.update({
      where: { id },
      data: {
        isRead: !isMarkAsUnread, // عكس unreadCount
        updatedAt: new Date()
      }
    });

    // Update last customer message if exists
    if (conversation.messages && conversation.messages.length > 0) {
      const lastMessage = conversation.messages[0];
      await prisma.message.update({
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
      const user = await prisma.user.findUnique({
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
    const savedMessage = await prisma.message.create({
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
        isFacebookReply: true,
        senderId: senderId,
        senderName: senderName,
        lastMessageIsFromCustomer: false,
        lastCustomerMessageIsUnread: false
      };
      
      io.emit('new_message', socketData);
      console.log(`⚡ [SEND-EXISTING-IMAGE] Message emitted to socket`);
    }

    // Update conversation last message
    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: '📷 صورة من الحافظة',
        updatedAt: new Date()
      }
    });

    // محاولة إرسال للـ Facebook (نفس طريقة uploadFile)
    try {
      const conversation = await prisma.conversation.findUnique({
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
          facebookPage = await prisma.facebookPage.findFirst({
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
              await prisma.message.update({
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
    const conversation = await prisma.conversation.findFirst({
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
    const facebookPage = await prisma.facebookPage.findFirst({
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
    const postTrackingData = await prisma.postTracking.findMany({
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
    const conversations = await prisma.conversation.findMany({
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
    const postSettings = await prisma.postResponseSettings.findMany({
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
      const conversations = await prisma.conversation.findMany({
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
        const allPages = await prisma.facebookPage.findMany({
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
    const facebookPage = await prisma.facebookPage.findFirst({
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
      const product = await prisma.product.findFirst({
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
    let postSettings = await prisma.postResponseSettings.findUnique({
      where: {
        postId_companyId: {
          postId: postId,
          companyId: companyId
        }
      }
    });

    if (postSettings) {
      // Update existing settings
      postSettings = await prisma.postResponseSettings.update({
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
      postSettings = await prisma.postResponseSettings.create({
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
    console.error('❌ Error updating post featured product:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ في الخادم',
      message: error.message
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
  updatePostFeaturedProduct
}
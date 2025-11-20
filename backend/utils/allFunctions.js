// Enhanced allFunctions.js with Facebook profile fetching
const { getSharedPrismaClient } = require('../services/sharedDatabase');

// ✅ FIX: Don't create prisma instance at module load time
// Always use getPrisma() inside async functions
function getPrisma() {
  return getSharedPrismaClient();
}

// Global variables
const pageTokenCache = new Map();
let lastWebhookPageId = null;
const sentMessagesCache = new Set();
const facebookSentCache = new Set();
const customerProfileCache = new Map(); // Cache for customer profiles

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

// 📊 دالة لتسجيل زيارة البوست (تلقائي)
async function trackPostVisit(postId, companyId) {
  if (!postId || !companyId) {
    return; // لا تسجل إذا لم يكن هناك postId أو companyId
  }

  try {
    const prisma = getPrisma();
    
    // البحث عن PostTracking موجود
    const existingTracking = await prisma.postTracking.findUnique({
      where: {
        postId_companyId: {
          postId: postId,
          companyId: companyId
        }
      }
    });

    if (existingTracking) {
      // تحديث العداد وتاريخ آخر زيارة
      await prisma.postTracking.update({
        where: {
          postId_companyId: {
            postId: postId,
            companyId: companyId
          }
        },
        data: {
          visitCount: {
            increment: 1
          },
          lastVisitAt: new Date()
        }
      });
      //console.log(`📊 [POST-TRACKING] Updated visit count for post ${postId}: ${existingTracking.visitCount + 1}`);
    } else {
      // إنشاء تسجيل جديد
      await prisma.postTracking.create({
        data: {
          postId: postId,
          companyId: companyId,
          visitCount: 1,
          firstVisitAt: new Date(),
          lastVisitAt: new Date()
        }
      });
      //console.log(`📊 [POST-TRACKING] Created new tracking for post ${postId}`);
    }
  } catch (error) {
    // لا نرمي الخطأ حتى لا نؤثر على تدفق العملية الرئيسية
    console.error(`❌ [POST-TRACKING] Error tracking post visit:`, error.message);
  }
}

function updatePageTokenCache(pageId, pageAccessToken, pageName, companyId) {
  pageTokenCache.set(pageId, {
    pageAccessToken: pageAccessToken,
    pageName: pageName,
    companyId: companyId,
    lastUsed: Date.now()
  });
  //console.log(`💾 [PAGE-CACHE] Updated cache for page: ${pageName} (${pageId})`);
}

async function getPageToken(pageId) {
  // 🔒 CRITICAL FIX: Always check database for status, even if cached
  // This ensures disconnected pages are not used
  try {
    const prisma = getPrisma(); // ✅ Get connected instance
    const page = await prisma.facebookPage.findUnique({
      where: { pageId: pageId }
    });

    // Check if page exists and is connected
    if (!page) {
      console.log(`⚠️ [PAGE-CACHE] Page ${pageId} not found in database`);
      // Remove from cache if exists
      if (pageTokenCache.has(pageId)) {
        pageTokenCache.delete(pageId);
        console.log(`🗑️ [PAGE-CACHE] Removed ${pageId} from cache`);
      }
      return null;
    }

    // 🔒 CRITICAL: Check if page is disconnected
    if (page.status === 'disconnected') {
      console.log(`❌ [PAGE-CACHE] Page ${page.pageName} (${pageId}) is DISCONNECTED - cannot use`);
      console.log(`   Disconnected at: ${page.disconnectedAt}`);
      // Remove from cache if exists
      if (pageTokenCache.has(pageId)) {
        pageTokenCache.delete(pageId);
        console.log(`🗑️ [PAGE-CACHE] Removed disconnected page from cache`);
      }
      return null;
    }

    // Page is connected - update cache and return
    if (page.pageAccessToken) {
      updatePageTokenCache(pageId, page.pageAccessToken, page.pageName, page.companyId);
      //console.log(`✅ [PAGE-CACHE] Using connected page: ${page.pageName}`);
      return {
        pageAccessToken: page.pageAccessToken,
        pageName: page.pageName,
        companyId: page.companyId,
        status: page.status,
        lastUsed: Date.now()
      };
    }
  } catch (error) {
    console.error(`❌ [PAGE-CACHE] Error searching for page ${pageId}:`, error);
  }

  return null;
}

// NEW: Function to fetch Facebook user profile
async function fetchFacebookUserProfile(userId, pageAccessToken) {
  try {
    //console.log(`🔍 [PROFILE] Fetching Facebook profile for user: ${userId}`);
    
    // Validate inputs
    if (!userId || !pageAccessToken) {
      //console.log(`❌ [PROFILE] Missing required parameters - userId: ${!!userId}, token: ${!!pageAccessToken}`);
      return null;
    }
    
    // Check cache first
    if (customerProfileCache.has(userId)) {
      const cached = customerProfileCache.get(userId);
      const ageInMinutes = (Date.now() - cached.timestamp) / (1000 * 60);
      if (ageInMinutes < 60) { // Cache for 1 hour
        //console.log(`⚡ [PROFILE] Using cached profile for: ${cached.first_name} ${cached.last_name}`);
        return cached;
      } else {
        //console.log(`aign: ${ageInMinutes.toFixed(1)} minutes old), fetching fresh data`);
      }
    }

    // Build the Facebook Graph API URL
    const url = `https://graph.facebook.com/${userId}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`;
    //console.log(`🌐 [PROFILE] Making request to Facebook API: ${url.replace(pageAccessToken, '[TOKEN]')}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ChatBot/1.0'
      },
      timeout: 10000 // 10 second timeout
    });
    
    //console.log(`📡 [PROFILE] Facebook API response status: ${response.status}`);
    
    if (!response.ok) {
      //console.log(`❌ [PROFILE] HTTP error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      //console.log(`❌ [PROFILE] Error response body:`, errorText);
      return null;
    }
    
    const data = await response.json();
    //console.log(`📊 [PROFILE] Facebook API response data:`, JSON.stringify(data, null, 2));
    
    if (data.error) {
      //console.log(`❌ [PROFILE] Facebook API error:`, data.error);
      return null;
    }
    
    if (data.first_name) {
      //console.log(`✅ [PROFILE] Successfully fetched profile: ${data.first_name} ${data.last_name || '[no last name]'}`);
      
      // Cache the profile
      const profileData = {
        ...data,
        timestamp: Date.now()
      };
      customerProfileCache.set(userId, profileData);
      //console.log(`💾 [PROFILE] Profile cached for user: ${userId}`);
      
      return data;
    } else {
      //console.log(`⚠️ [PROFILE] Response missing first_name field:`, data);
      return null;
    }
  } catch (error) {
    console.error(`❌ [PROFILE] Error fetching Facebook profile for ${userId}:`, error);
    
    // Log different types of errors
    if (error.code === 'ENOTFOUND') {
      console.error(`🌐 [PROFILE] Network error - DNS lookup failed`);
    } else if (error.code === 'ECONNRESET') {
      console.error(`🔌 [PROFILE] Connection reset by Facebook`);
    } else if (error.name === 'TimeoutError') {
      console.error(`⏰ [PROFILE] Request timed out`);
    }
    
    return null;
  }
}

// Import Facebook validation functions
const {
  validateFacebookRecipientStrict,
  sendProductionFacebookMessage,
  handleProductionFacebookError,
  sendFacebookSenderAction
} = require('../production-facebook-fix');

// Send message to Facebook Messenger
async function sendFacebookMessage(recipientId, messageContent, messageType = 'TEXT', pageId = null) {
  try {
    //console.log(`📤 [FACEBOOK-SEND] Sending message to ${recipientId}`);
    

    // منع التكرار - فحص إذا كانت الرسالة أُرسلت من قبل
    // استخدام رابط كامل للصور لتجنب اعتبار صور مختلفة كمكررة
    const contentForHash = messageType === 'IMAGE' ? messageContent : messageContent.substring(0, 50);
    const messageHash = `${recipientId}_${contentForHash}_${Date.now() - (Date.now() % 60000)}`;
    if (facebookSentCache.has(messageHash)) {
      console.log(`⚠️ [FACEBOOK-SEND] Message already sent recently - skipping duplicate: ${messageHash}`);
      return { success: true, message: 'Message already sent recently', wasCached: true };
    }

    // Basic recipient ID validation
    if (!recipientId || typeof recipientId !== 'string' || recipientId.trim() === '') {
      //console.log('❌ [FACEBOOK-SEND] Invalid recipient ID:', recipientId);
      return {
        success: false,
        error: 'INVALID_RECIPIENT_ID',
        message: 'معرف المستلم غير صحيح'
      };
    }

    // Skip sending for test IDs
    if (recipientId.includes('test-') || recipientId.length < 10) {
      //console.log('⚠️ [FACEBOOK-SEND] Skipping Facebook send for test ID:', recipientId);
      return { success: true, message: 'Test ID - message not sent to Facebook' };
    }

    // Find the appropriate page for sending
    let pageData = null;
    let actualPageId = null;

    // First: Use specified Page ID if available
    if (pageId) {
      pageData = await getPageToken(pageId);
      actualPageId = pageId;
      //console.log(`🎯 [PAGE-SELECT] Using specified page: ${pageId}`);
    }

    // Second: Use last webhook Page ID
    if (!pageData && lastWebhookPageId) {
      pageData = await getPageToken(lastWebhookPageId);
      actualPageId = lastWebhookPageId;
      //console.log(`🔄 [PAGE-SELECT] Using last webhook page: ${lastWebhookPageId}`);
    }

    // Third: Find default page
    if (!pageData) {
      const prisma = getPrisma(); // ✅ Get connected instance
      const defaultPage = await prisma.facebookPage.findFirst({
        where: { status: 'connected' },
        orderBy: { connectedAt: 'desc' }
      });

      if (defaultPage) {
        pageData = {
          pageAccessToken: defaultPage.pageAccessToken,
          pageName: defaultPage.pageName,
          companyId: defaultPage.companyId,
          lastUsed: Date.now()
        };
        actualPageId = defaultPage.pageId;
        updatePageTokenCache(defaultPage.pageId, defaultPage.pageAccessToken, defaultPage.pageName, defaultPage.companyId);
        //console.log(`🔄 [PAGE-SELECT] Using default page: ${defaultPage.pageName}`);
      } else {
        console.error(`❌ [SECURITY] No valid page found`);
        return {
          success: false,
          error: 'NO_VALID_PAGE',
          message: 'لم يتم العثور على صفحة فيسبوك صالحة'
        };
      }
    }

    if (!pageData || !pageData.pageAccessToken) {
      //console.log('⚠️ Facebook Page Access Token not found');
      return { success: false, error: 'No active page found' };
    }

    if (!actualPageId) {
      //console.log('⚠️ Page ID not found');
      return { success: false, error: 'Page ID not found' };
    }

    const PAGE_ACCESS_TOKEN = pageData.pageAccessToken;
    //console.log(`🔑 Using Page Access Token for page: ${pageData.pageName} (${actualPageId})`);

    // Use enhanced sending function
    const result = await sendProductionFacebookMessage(
      recipientId,
      messageContent,
      messageType,
      actualPageId,
      PAGE_ACCESS_TOKEN
    );

    if (result.success) {
      console.log(`✅ [FACEBOOK-SEND] Message sent successfully: ${result.messageId} (Type: ${messageType})`);
      
      // إضافة للكاش لمنع التكرار
      facebookSentCache.add(messageHash);
      if (messageType === 'IMAGE') {
        console.log(`📸 [CACHE] Image URL added to cache: ${contentForHash.substring(0, 80)}...`);
      }
      
      // تنظيف الكاش بعد 5 دقائق
      setTimeout(() => {
        facebookSentCache.delete(messageHash);
      }, 5 * 60 * 1000);
      
      return result;
    } else {
      console.error(`❌ [FACEBOOK-SEND] Failed to send message: ${result.message}`);
      return result;
    }

  } catch (error) {
    console.error('❌ [FACEBOOK-SEND] Error in Facebook message:', error);
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'خطأ في الشبكة أو الاتصال',
      details: error.message
    };
  }
}

// NEW: Function to handle Facebook comments with AI or static response based on AI settings
async function handleFacebookComment(commentData, pageId = null) {
  const prisma = getPrisma(); // ✅ Get connected instance
  try {
    //console.log(`💬 [COMMENT] Processing Facebook comment: ${commentData.comment_id}`);

    // Extract comment information
    const commentId = commentData.comment_id;
    const postId = commentData.post_id;
    const senderId = commentData.from?.id;
    const senderName = commentData.from?.name;
    const commentText = commentData.message;
    const createdTime = new Date(commentData.created_time * 1000);

    // Validate required data
    if (!commentId || !postId || !senderId || !commentText) {
      //console.log('❌ [COMMENT] Missing required comment data');
      return;
    }

    // Get page access token
    let pageData = null;
    if (pageId) {
      pageData = await getPageToken(pageId);
    }

    if (!pageData && lastWebhookPageId) {
      pageData = await getPageToken(lastWebhookPageId);
    }

    if (!pageData) {
      const defaultPage = await prisma.facebookPage.findFirst({
        where: { status: 'connected' },
        orderBy: { connectedAt: 'desc' }
      }); // ✅ Using prisma from function scope

      if (defaultPage) {
        pageData = {
          pageAccessToken: defaultPage.pageAccessToken,
          pageName: defaultPage.pageName,
          companyId: defaultPage.companyId,
          lastUsed: Date.now()
        };
      }
    }

    // 📊 تسجيل زيارة البوست تلقائياً
    if (postId && pageData && pageData.companyId) {
      trackPostVisit(postId, pageData.companyId).catch(err => {
        console.error('❌ [POST-TRACKING] Failed to track post visit:', err.message);
      });
    }

    if (!pageData || !pageData.pageAccessToken) {
      //console.log('❌ [COMMENT] No valid page data found for comment response');
      return;
    }

    // Check if this is a new comment (not a reply from our bot)
    const existingComment = await prisma.facebookComment.findUnique({
      where: { commentId: commentId }
    });

    // DEBUG: Log the existing comment check
    //console.log(`🔍 [COMMENT] Checking existing comment ${commentId}:`, existingComment ? 'FOUND' : 'NOT FOUND');
    
    // NEW: Check if we've already responded to this comment
    if (existingComment && existingComment.response && existingComment.respondedAt) {
      //console.log(`⚠️ [COMMENT] Already responded to comment ${commentId} at ${existingComment.respondedAt}`);
      return;
    }
    
    // DEBUG: Log why we're processing (or not processing) this comment
    if (existingComment) {
      if (existingComment.response) {
        //console.log(`🔍 [COMMENT] Comment ${commentId} has response but no respondedAt`);
      } else {
        //console.log(`🔍 [COMMENT] Comment ${commentId} has no response yet`);
      }
    } else {
      //console.log(`🔍 [COMMENT] Comment ${commentId} is new`);
    }

    // Save or update comment in database
    let savedComment;
    if (existingComment) {
      // Update existing comment
      savedComment = await prisma.facebookComment.update({
        where: { id: existingComment.id },
        data: {
          message: commentText, // Update in case comment was edited
          createdTime: createdTime,
          pageId: pageId || lastWebhookPageId,
          companyId: pageData.companyId
        }
      });
      //console.log(`💾 [COMMENT] Updated existing comment in database: ${commentId}`);
    } else {
      // Create new comment
      savedComment = await prisma.facebookComment.create({
        data: {
          commentId: commentId,
          postId: postId,
          senderId: senderId,
          senderName: senderName,
          message: commentText,
          createdTime: createdTime,
          pageId: pageId || lastWebhookPageId,
          companyId: pageData.companyId
        }
      });
      //console.log(`💾 [COMMENT] Saved new comment to database: ${commentId}`);
    }

    // CORRECT FLOW: Check Post Settings FIRST (Priority), then Page Settings (Fallback)
    // BUT: If post settings is 'manual', skip to page settings
    let postSettings = null;
    let settingsSource = null;
    
    // 1. FIRST: Check for post-specific settings (PRIORITY)
    try {
      const postSpecificSettings = await prisma.postResponseSettings.findUnique({
        where: {
          postId_companyId: {
            postId: postId,
            companyId: pageData.companyId
          }
        }
      });
      
      // Only use post settings if it's NOT manual
      if (postSpecificSettings && postSpecificSettings.responseMethod !== 'manual') {
        console.log(`📝 [COMMENT] Using POST-SPECIFIC settings for post ${postId} (PRIORITY) - Method: ${postSpecificSettings.responseMethod}`);
        postSettings = postSpecificSettings;
        settingsSource = 'post';
      } else if (postSpecificSettings && postSpecificSettings.responseMethod === 'manual') {
        console.log(`⏭️ [COMMENT] Post settings is 'manual', checking page settings...`);
      }
    } catch (error) {
      //console.log('⚠️ [COMMENT] Could not fetch post response settings from database');
    }

    // 2. FALLBACK: If no post settings OR post is manual, check page-level settings
    if (!postSettings && pageId) {
      try {
        const pageSettings = await prisma.pageResponseSettings.findUnique({
          where: {
            pageId_companyId: {
              pageId: pageId,
              companyId: pageData.companyId
            }
          }
        });
        
        if (pageSettings) {
          console.log(`📄 [COMMENT] Using PAGE-LEVEL settings for page ${pageId} (FALLBACK) - Method: ${pageSettings.responseMethod}`);
          postSettings = pageSettings;
          settingsSource = 'page';
        }
      } catch (error) {
        //console.log('⚠️ [COMMENT] Could not fetch page response settings from database');
      }
    }
    
    if (settingsSource) {
      console.log(`✅ [COMMENT] Settings loaded from: ${settingsSource}`);
    } else {
      console.log(`ℹ️ [COMMENT] No post/page settings found, will check AI settings`);
    }

    // Handle based on response method
    if (postSettings) {
      // Process based on the specific response method for this post
      if (postSettings.responseMethod === 'fixed' && postSettings.commentMessages) {
        // Pick a random comment response from variations
        let commentResponseText = '';
        try {
          const messagesArray = JSON.parse(postSettings.commentMessages);
          if (messagesArray && messagesArray.length > 0) {
            const randomIndex = Math.floor(Math.random() * messagesArray.length);
            commentResponseText = messagesArray[randomIndex];
          }
        } catch (e) {
          console.warn('⚠️ [FIXED-COMMENT] Failed to parse comment messages:', e);
          commentResponseText = postSettings.commentMessages; // Fallback to raw string
        }
        
        if (!commentResponseText || !commentResponseText.trim()) {
          console.log('⚠️ [FIXED-COMMENT] No valid comment message found, skipping');
          return;
        }
        
        const messengerResponseText = postSettings.fixedMessengerMessage || commentResponseText;
        
        // Mark as responded BEFORE sending the reply
        try {
          await prisma.facebookComment.update({
            where: { id: savedComment.id },
            data: {
              response: commentResponseText,
              respondedAt: new Date()
            }
          });
        } catch (dbError) {
          console.error(`❌ [COMMENT] Failed to mark comment ${commentId} as responded in database:`, dbError);
          return;
        }
        
        // Send the response as a comment reply
        console.log(`📤 [FIXED-COMMENT] Sending fixed comment reply: "${commentResponseText}"`);
        await sendFacebookCommentReply(commentId, commentResponseText, pageData.pageAccessToken);
        
        // NEW: Also send the response to Facebook Messenger
        if (senderId) {
          // Import the sendProductionFacebookMessage function
          const { sendProductionFacebookMessage } = require('../production-facebook-fix');
          
          // Find customer by Facebook ID
          let customer = await prisma.customer.findFirst({
            where: {
              facebookId: senderId,
              companyId: pageData.companyId
            }
          });
          
          // If customer doesn't exist, create one
          if (!customer) {
            customer = await prisma.customer.create({
              data: {
                facebookId: senderId,
                firstName: senderName || 'Facebook User',
                lastName: '',
                email: null,
                phone: null,
                companyId: pageData.companyId,
                metadata: JSON.stringify({
                  source: 'facebook_comment',
                  commentId: commentId,
                  postId: postId
                })
              }
            });
          }
          
          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: {
              customerId: customer.id,
              status: { in: ['ACTIVE', 'RESOLVED'] }
            },
            orderBy: { updatedAt: 'desc' }
          });
          
          // If no conversation exists, create one
          if (!conversation) {
            // Get page data for metadata
            let pageName = null;
            if (pageData) {
              pageName = pageData.pageName;
            } else if (pageId) {
              // Try to get page name from database
              const page = await prisma.facebookPage.findUnique({
                where: { pageId: pageId }
              });
              if (page) {
                pageName = page.pageName;
              }
            }
            
            const conversationMetadata = {
              platform: 'facebook',
              source: 'comment_reply',
              pageId: pageId,
              pageName: pageName
            };
            
            conversation = await prisma.conversation.create({
              data: {
                customerId: customer.id,
                companyId: pageData.companyId,
                channel: 'FACEBOOK',
                status: 'ACTIVE',
                lastMessageAt: new Date(),
                metadata: JSON.stringify(conversationMetadata)
              }
            });
          } else if (conversation.status === 'RESOLVED') {
            // Reactivate resolved conversation
            conversation = await prisma.conversation.update({
              where: { id: conversation.id },
              data: {
                status: 'ACTIVE',
                lastMessageAt: new Date(),
                updatedAt: new Date()
              }
            });
          }
          
          // Save the response as a message from the admin (not from customer)
          const message = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              content: messengerResponseText,
              type: 'TEXT',
              isFromCustomer: false,
              metadata: JSON.stringify({
                platform: 'facebook',
                source: 'comment_reply',
                isFixedResponse: true,
                senderId: 'system',
                commentId: commentId,
                postId: postId
              })
            }
          });
          
          // Send the message to Facebook Messenger
          console.log(`📤 [FIXED-COMMENT-MESSENGER] Sending messenger message: "${messengerResponseText}"`);
          let messengerSuccess = true;
          if (customer.facebookId && pageData && pageData.pageAccessToken) {
            const messengerResponse = await sendProductionFacebookMessage(
              customer.facebookId,
              messengerResponseText,
              'TEXT',
              pageId,
              pageData.pageAccessToken
            );
            
            if (messengerResponse.success) {
              console.log(`✅ [FIXED-COMMENT-MESSENGER] Successfully sent fixed response to Messenger for user ${customer.facebookId}`);
              
              // Update message with Facebook message ID
              await prisma.message.update({
                where: { id: message.id },
                data: {
                  metadata: JSON.stringify({
                    ...JSON.parse(message.metadata),
                    facebookMessageId: messengerResponse.messageId,
                    facebookSentAt: new Date().toISOString()
                  })
                }
              });
            } else {
              console.warn(`⚠️ [FIXED-COMMENT-MESSENGER] Failed to send fixed response to Messenger for user ${customer.facebookId}:`, messengerResponse.message);
              messengerSuccess = false;
            }
          } else {
            console.warn(`⚠️ [FIXED-COMMENT-MESSENGER] Cannot send to Messenger - missing data for user ${customer.facebookId}`);
            messengerSuccess = false;
          }
        }
        return; // Exit after sending fixed response
      } else if (postSettings.responseMethod === 'manual') {
        // For manual method, we don't do anything automatically
        //console.log(`📝 [COMMENT] Manual response method set for post ${postId} - no automatic response`);
        return;
      }
      // For 'ai' method, we'll continue to the AI processing below
    }

    // Import AI agent service to check if AI is enabled (fallback for 'ai' method or when no settings)
    const aiAgentService = require('../services/aiAgentService');
    // Get AI settings for the company
    const aiSettings = await aiAgentService.getSettings(pageData.companyId);
    
    // Respond with AI only if:
    // 1. No specific post settings OR post settings method is 'ai'
    // 2. AI is enabled
    const shouldUseAI = (!postSettings || postSettings.responseMethod === 'ai') && aiSettings && aiSettings.isEnabled;
    
    if (shouldUseAI) {
      console.log(`🤖 [AI-COMMENT] Processing comment with AI for post ${postId}`);
      
      // Check if there's a custom AI prompt for this post
      const customPrompt = postSettings?.aiPrompt;
      if (customPrompt) {
        console.log(`📝 [AI-COMMENT] Using custom AI prompt for post ${postId}`);
      }
      
      // Prepare message data for AI Agent
      const aiMessageData = {
        conversationId: null,
        senderId: senderId,
        content: commentText,
        attachments: [],
        timestamp: new Date(),
        companyId: pageData.companyId,
        customerData: {
          name: senderName || 'Facebook User',
          companyId: pageData.companyId
        },
        customPrompt: customPrompt // Pass custom prompt to AI
      };
      
      // Process comment with AI Agent
      const aiResponse = await aiAgentService.processCustomerMessage(aiMessageData);
      
      // Check if we got a valid AI response
      if (aiResponse && aiResponse.content && !aiResponse.silent) {
        const responseText = aiResponse.content;
        
        // Mark as responded BEFORE sending the reply
        try {
          await prisma.facebookComment.update({
            where: { id: savedComment.id },
            data: {
              response: responseText,
              respondedAt: new Date()
            }
          });
        } catch (dbError) {
          console.error(`❌ [COMMENT] Failed to mark comment ${commentId} as responded in database:`, dbError);
          return;
        }
        
        // Send the response as a comment reply
        await sendFacebookCommentReply(commentId, responseText, pageData.pageAccessToken);
        
        // NEW: Also send the response to Facebook Messenger
        if (senderId) {
          // Import the sendProductionFacebookMessage function
          const { sendProductionFacebookMessage } = require('../production-facebook-fix');
          
          // Find customer by Facebook ID
          let customer = await prisma.customer.findFirst({
            where: {
              facebookId: senderId,
              companyId: pageData.companyId
            }
          });
          
          // If customer doesn't exist, create one
          if (!customer) {
            customer = await prisma.customer.create({
              data: {
                facebookId: senderId,
                firstName: senderName || 'Facebook User',
                lastName: '',
                email: null,
                phone: null,
                companyId: pageData.companyId,
                metadata: JSON.stringify({
                  source: 'facebook_comment',
                  commentId: commentId,
                  postId: postId
                })
              }
            });
          }
          
          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: {
              customerId: customer.id,
              status: { in: ['ACTIVE', 'RESOLVED'] }
            },
            orderBy: { updatedAt: 'desc' }
          });
          
          // If no conversation exists, create one
          if (!conversation) {
            // Get page data for metadata
            let pageName = null;
            if (pageData) {
              pageName = pageData.pageName;
            } else if (pageId) {
              // Try to get page name from database
              const page = await prisma.facebookPage.findUnique({
                where: { pageId: pageId }
              });
              if (page) {
                pageName = page.pageName;
              }
            }
            
            const conversationMetadata = {
              platform: 'facebook',
              source: 'comment_reply',
              pageId: pageId,
              pageName: pageName
            };
            
            conversation = await prisma.conversation.create({
              data: {
                customerId: customer.id,
                companyId: pageData.companyId,
                channel: 'FACEBOOK',
                status: 'ACTIVE',
                lastMessageAt: new Date(),
                metadata: JSON.stringify(conversationMetadata)
              }
            });
          } else if (conversation.status === 'RESOLVED') {
            // Reactivate resolved conversation
            conversation = await prisma.conversation.update({
              where: { id: conversation.id },
              data: {
                status: 'ACTIVE',
                lastMessageAt: new Date(),
                updatedAt: new Date()
              }
            });
          }
          
          // Save the response as a message from the admin (not from customer)
          const message = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              content: responseText,
              type: 'TEXT',
              isFromCustomer: false,
              metadata: JSON.stringify({
                platform: 'facebook',
                source: 'comment_reply',
                isAIResponse: true,
                senderId: 'system',
                commentId: commentId,
                postId: postId
              })
            }
          });
          
          // Send the message to Facebook Messenger
          let messengerSuccess = true;
          if (customer.facebookId && pageData && pageData.pageAccessToken) {
            const messengerResponse = await sendProductionFacebookMessage(
              customer.facebookId,
              responseText,
              'TEXT',
              pageId,
              pageData.pageAccessToken
            );
            
            if (messengerResponse.success) {
              console.log(`✅ [AI-COMMENT-MESSENGER] Successfully sent AI response to Messenger for user ${customer.facebookId}`);
              
              // Update message with Facebook message ID
              await prisma.message.update({
                where: { id: message.id },
                data: {
                  metadata: JSON.stringify({
                    ...JSON.parse(message.metadata),
                    facebookMessageId: messengerResponse.messageId,
                    facebookSentAt: new Date().toISOString()
                  })
                }
              });
            } else {
              console.warn(`⚠️ [AI-COMMENT-MESSENGER] Failed to send AI response to Messenger for user ${customer.facebookId}:`, messengerResponse.message);
              messengerSuccess = false;
            }
          } else {
            console.warn(`⚠️ [AI-COMMENT-MESSENGER] Cannot send to Messenger - missing data for user ${customer.facebookId}`);
            messengerSuccess = false;
          }
        }
      }
    } else if (!postSettings) {
      // If no post settings exist and AI is disabled, we could implement a default response
      // For now, we'll just log that no response was sent
      //console.log(`📝 [COMMENT] No post settings found and AI disabled - no automatic response for comment ${commentId}`);
    }

  } catch (error) {
    console.error('❌ [COMMENT] Error handling Facebook comment:', error);
  }
}

// NEW: Function to generate AI response for comments
async function generateAICommentResponse(commentText, senderName) {
  try {
    //console.log(`🤖 [COMMENT-AI] Generating response for comment from ${senderName}: "${commentText}"`);
    
    // Simple AI response logic - this can be enhanced with more sophisticated AI
    const responses = [
      `Thanks for your comment, ${senderName}! We appreciate your feedback.`,
      `Thank you for sharing your thoughts, ${senderName}. We're glad you enjoyed our content!`,
      `Hi ${senderName}, thanks for engaging with our post! How can we help you further?`,
      `We appreciate your comment, ${senderName}! Our team will get back to you soon if needed.`,
      `Thanks for reaching out, ${senderName}! We're here to help with any questions you might have.`
    ];
    
    // Select a random response
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    //console.log(`🤖 [COMMENT-AI] Generated response: "${response}"`);
    return response;
  } catch (error) {
    console.error('❌ [COMMENT-AI] Error generating comment response:', error);
    return null;
  }
}

// NEW: Function to send a reply to a Facebook comment
async function sendFacebookCommentReply(commentId, messageText, pageAccessToken) {
  try {
    //console.log(`📤 [COMMENT-REPLY] Sending reply to comment ${commentId}: "${messageText}"`);
    
    // For Facebook comment replies, we need to send the message as form data
    const formData = new URLSearchParams();
    formData.append('message', messageText);
    formData.append('access_token', pageAccessToken);
    
    const url = `https://graph.facebook.com/v18.0/${commentId}/comments`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    const responseData = await response.json();
    
    // Log the full response for debugging
    //console.log(`📊 [COMMENT-REPLY] Full response:`, JSON.stringify(responseData, null, 2));
    
    if (responseData.error) {
      console.error('❌ [COMMENT-REPLY] Error sending comment reply:', responseData.error);
      
      // Log additional debugging information
      if (responseData.error.code === 200) {
        console.error('💡 [COMMENT-REPLY] Code 200 usually means permission issues. Check if:');
        console.error('   1. The page access token has pages_manage_engagement permission');
        console.error('   2. The app is properly installed on the page');
        console.error('   3. The page admin has granted the necessary permissions');
      }
      
      return false;
    }
    
    //console.log(`✅ [COMMENT-REPLY] Successfully sent comment reply. Response ID: ${responseData.id}`);
    return true;
  } catch (error) {
    console.error('❌ [COMMENT-REPLY] Error sending comment reply:', error);
    return false;
  }
}

// ENHANCED: Handle Facebook messages with real profile fetching
async function handleFacebookMessage(webhookEvent, currentPageId = null) {
  const handleStartTime = Date.now();
  const messageId = webhookEvent.message?.mid || `msg_${Date.now()}`;
  const prisma = getPrisma(); // ✅ Get connected instance
  try {
    console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [0ms] 🔍 [HANDLE] Starting handleFacebookMessage`);
  
    const senderId = webhookEvent.sender.id;
    // 🆕 Handle referral events without message object (OPEN_THREAD events)
    const messageText = webhookEvent.message?.text || null;
    let attachments = webhookEvent.message?.attachments || null;

    // 🆕 Extract postId from webhookEvent (fast - already extracted in webhookController)
    // ✅ FIX: Also extract directly from referral if not already extracted
    let postId = webhookEvent._extractedPostId || null;
    
    // ✅ FIX: If postId not found, try to extract from referral directly
    if (!postId && webhookEvent.referral) {
      if (webhookEvent.referral.ads_context_data?.post_id) {
        postId = webhookEvent.referral.ads_context_data.post_id;
        console.log('✅ [POST-REF] Extracted postId directly from referral.ads_context_data.post_id:', postId);
      } else if (webhookEvent.referral.post_id) {
        postId = webhookEvent.referral.post_id;
        console.log('✅ [POST-REF] Extracted postId directly from referral.post_id:', postId);
      } else if (webhookEvent.referral.post_ref) {
        postId = webhookEvent.referral.post_ref;
        console.log('✅ [POST-REF] Extracted postId directly from referral.post_ref:', postId);
      } else if (webhookEvent.referral.ad_ref) {
        postId = webhookEvent.referral.ad_ref;
        console.log('✅ [POST-REF] Extracted postId directly from referral.ad_ref:', postId);
      } else if (webhookEvent.referral.ad_id) {
        postId = webhookEvent.referral.ad_id;
        console.log('✅ [POST-REF] Extracted postId directly from referral.ad_id (fallback):', postId);
      }
      
      // Attach to webhookEvent for later use
      if (postId) {
        webhookEvent._extractedPostId = postId;
      }
    }

    // Use pageId from current message or fallback to last webhook
    const messagePageId = currentPageId || webhookEvent.recipient?.id || lastWebhookPageId;
    //console.log(`📄 [MESSAGE-PAGE] Using page ID for this message: ${messagePageId}`);

    // Update lastWebhookPageId
    if (webhookEvent.recipient?.id) {
      lastWebhookPageId = webhookEvent.recipient.id;
    }

    // Find or create customer
    let pageData = null;
    if (messagePageId) {
      const pageDataStartTime = Date.now();
      pageData = await getPageToken(messagePageId);
      console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - pageDataStartTime}ms] 📄 [HANDLE] Got pageData for pageId: ${messagePageId}`);
    }

    // Enhanced page data diagnostics
    //console.log(`🔍 [PAGE-DIAGNOSTIC] Page ID: ${messagePageId}`);
    //console.log(`🔍 [PAGE-DIAGNOSTIC] Page data found:`, pageData ? 'YES' : 'NO');
    
    // 📊 تسجيل زيارة البوست تلقائياً
    if (postId && pageData && pageData.companyId) {
      trackPostVisit(postId, pageData.companyId).catch(err => {
        console.error('❌ [POST-TRACKING] Failed to track post visit:', err.message);
      });
    }
    
    if (pageData) {
      //console.log(`🔍 [PAGE-DIAGNOSTIC] Page name: ${pageData.pageName}`);
      //console.log(`🔍 [PAGE-DIAGNOSTIC] Company ID: ${pageData.companyId}`);
      //console.log(`🔍 [PAGE-DIAGNOSTIC] Has access token: ${!!pageData.pageAccessToken}`);
    } else {
      // Check all available pages
      //console.log(`🔍 [PAGE-DIAGNOSTIC] Checking all available pages...`);
      const allPages = await prisma.facebookPage.findMany({
        select: {
          pageId: true,
          pageName: true,
          status: true,
          companyId: true,
          connectedAt: true
        }
      });
      //console.log(`🔍 [PAGE-DIAGNOSTIC] All pages in database:`, allPages);
    }

    if (!pageData) {
      console.error(`❌ [SECURITY] No page data found for pageId: ${messagePageId}`);
      return;
    }

    let targetCompanyId = pageData.companyId;
    if (!targetCompanyId) {
      console.error(`❌ [SECURITY] No companyId found - rejecting request`);
      return;
    }

    // Verify company exists
    const companyExists = await prisma.company.findUnique({
      where: { id: targetCompanyId }
    });

    if (!companyExists) {
      console.error(`❌ [SECURITY] Company not found: ${targetCompanyId}`);
      return;
    }

    //console.log(`✅ [SECURITY] Verified company: ${companyExists.name} (${targetCompanyId})`);

    // NEW: Check global AI settings before processing
    const aiAgentService = require('../services/aiAgentService');
    const aiSettings = await aiAgentService.getSettings(targetCompanyId);
    
    // If AI is disabled globally, don't process with AI
    if (!aiSettings.isEnabled) {
      //console.log(`🚫 [AI-DISABLED] Global AI is disabled for company ${targetCompanyId}, skipping AI processing`);
      
      // Still create the conversation and save the message, but don't send to AI
      // Use try-catch to handle race condition
      
      // NEW: Fetch real Facebook profile before creating/updating customer
      const facebookProfile = await fetchFacebookUserProfile(senderId, pageData.pageAccessToken);
      
      let firstName = 'عميل فيسبوك';
      let lastName = senderId.slice(-4);
      
      if (facebookProfile && facebookProfile.first_name) {
        firstName = facebookProfile.first_name;
        lastName = facebookProfile.last_name || '';
      }

      // Try to find existing customer first (using compound unique key)
      const customerStartTime = Date.now();
      let customer = await prisma.customer.findFirst({
        where: { 
          facebookId: senderId,
          companyId: targetCompanyId
        }
      });
      console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - customerStartTime}ms] 👤 [HANDLE] ${customer ? 'Found' : 'Creating'} customer for ${senderId}`);

      if (!customer) {
        // Customer doesn't exist, try to create
        try {
          customer = await prisma.customer.create({
            data: {
              facebookId: senderId,
              firstName: firstName,
              lastName: lastName,
              email: `facebook_${senderId}@example.com`,
              phone: '',
              companyId: targetCompanyId,
              metadata: JSON.stringify({
                facebookProfile: facebookProfile,
                profileFetched: !!facebookProfile,
                profileFetchedAt: new Date().toISOString(),
                profilePicture: facebookProfile?.profile_pic
              })
            }
          });
        } catch (createError) {
          // If create failed due to race condition, try to find again
          if (createError.code === 'P2002') {
            //console.log(`🔄 [RACE-CONDITION] Customer created by another request, fetching...`);
            customer = await prisma.customer.findFirst({
              where: { 
                facebookId: senderId,
                companyId: targetCompanyId
              }
            });
            
            if (!customer) {
              // This should never happen, but just in case
              throw new Error(`Failed to find customer after race condition: ${senderId}`);
            }
          } else {
            // Different error, rethrow
            throw createError;
          }
        }
      } else {
        // OPTIONAL: Update existing customer's name if we have better data
        //console.log(`👤 [CUSTOMER-UPDATE] Checking if we should update existing customer: ${customer.firstName} ${customer.lastName}`);
        
        // Only update if current name is generic or from previous failed attempts
        const isGenericName = customer.firstName === 'عميل فيسبوك' || 
                             customer.firstName.includes('عميل فيسبوك') || 
                             customer.firstName === 'Facebook' || 
                             customer.lastName === 'User' ||
                             customer.firstName === 'مستخدم';
        
        if (isGenericName) {
          //console.log(`🔄 [CUSTOMER-UPDATE] Current name is generic, attempting to fetch real name...`);
          
          const facebookProfile = await fetchFacebookUserProfile(senderId, pageData.pageAccessToken);
          
          if (facebookProfile && (facebookProfile.first_name || facebookProfile.name)) {
            // Use first_name and last_name if available
            let firstName = customer.firstName;
            let lastName = customer.lastName;
            
            if (facebookProfile.first_name) {
              firstName = facebookProfile.first_name;
              lastName = facebookProfile.last_name || '';
            } 
            // Fallback to parsing the 'name' field
            else if (facebookProfile.name) {
              const nameParts = facebookProfile.name.split(' ');
              firstName = nameParts[0] || facebookProfile.name;
              lastName = nameParts.slice(1).join(' ') || '';
            }
            
            // Only update if we got a better name than what we already have
            if (firstName !== customer.firstName || lastName !== customer.lastName) {
              const updatedCustomer = await prisma.customer.update({
                where: { id: customer.id },
                data: {
                  firstName: firstName,
                  lastName: lastName,
                  metadata: JSON.stringify({
                    ...customer.metadata ? JSON.parse(customer.metadata) : {},
                    facebookProfile: facebookProfile,
                    profileUpdated: true,
                    profileUpdatedAt: new Date().toISOString(),
                    profilePicture: facebookProfile.profile_pic
                  })
                }
              });
              
              customer = updatedCustomer;
              //console.log(`✅ [CUSTOMER-UPDATE] Updated customer name to: ${customer.firstName} ${customer.lastName}`);
            } else {
              //console.log(`ℹ️ [CUSTOMER-UPDATE] Name unchanged: ${customer.firstName} ${customer.lastName}`);
            }
          } else {
            //console.log(`⚠️ [CUSTOMER-UPDATE] Could not fetch better name, keeping existing: ${customer.firstName} ${customer.lastName}`);
          }
        } else {
          //console.log(`ℹ️ [CUSTOMER-UPDATE] Customer already has a non-generic name: ${customer.firstName} ${customer.lastName}`);
        }
      }

      // 🚫 فحص إذا كان العميل محظور على هذه الصفحة
      const blockedCheckStartTime = Date.now();
      const facebookPage = await prisma.facebookPage.findUnique({
        where: { pageId: messagePageId },
        select: { id: true }
      });
      
      if (facebookPage) {
        const isBlocked = await prisma.blockedCustomerOnPage.findFirst({
          where: {
            facebookPageId: facebookPage.id,
            OR: [
              { customerId: customer.id },
              { facebookId: senderId }
            ]
          }
        });
        
        if (isBlocked) {
          console.log(`🚫 [BLOCKED] Customer ${customer.id} (${senderId}) is blocked on page ${messagePageId} - ignoring message`);
          console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - blockedCheckStartTime}ms] 🚫 [BLOCKED] Block check completed`);
          return; // تجاهل الرسالة تماماً
        }
      }
      console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - blockedCheckStartTime}ms] ✅ [BLOCKED] Customer not blocked`);

      // Find or create conversation
      const conversationStartTime = Date.now();
      let conversation = await prisma.conversation.findFirst({
        where: {
          customerId: customer.id,
          status: { in: ['ACTIVE', 'RESOLVED'] }
        },
        orderBy: { updatedAt: 'desc' }
      });
      console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - conversationStartTime}ms] 💬 [HANDLE] ${conversation ? 'Found' : 'Will create'} conversation for customer ${customer.id}`);

      const timestamp = new Date();

      if (conversation && conversation.status === 'RESOLVED') {
        // Update metadata with page information when reactivating conversation
        let updatedMetadata = {};
        if (conversation.metadata) {
          try {
            updatedMetadata = JSON.parse(conversation.metadata);
          } catch (e) {
            // If parsing fails, start with empty object
            updatedMetadata = {};
          }
        }
        
        // Add/Update page information and post reference
        updatedMetadata.platform = 'facebook';
        updatedMetadata.source = 'messenger';
        updatedMetadata.pageId = messagePageId;
        updatedMetadata.pageName = pageData?.pageName || null;
        // Preserve existing postId or add new one if available
        if (!updatedMetadata.postId && postId) {
          updatedMetadata.postId = postId;
          console.log('✅ [POST-REF] Adding postId to reactivated conversation:', postId);
        }
        
        conversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            status: 'ACTIVE',
            lastMessageAt: timestamp,
            updatedAt: new Date(),
            metadata: JSON.stringify(updatedMetadata)
          }
        });
        //console.log(`🔄 Reactivated conversation: ${conversation.id}`);
      } else if (conversation && conversation.status === 'ACTIVE') {
        // Update metadata with page information when updating active conversation
        let updatedMetadata = {};
        if (conversation.metadata) {
          try {
            updatedMetadata = JSON.parse(conversation.metadata);
          } catch (e) {
            // If parsing fails, start with empty object
            updatedMetadata = {};
          }
        }
        
        // Add/Update page information and post reference
        updatedMetadata.platform = 'facebook';
        updatedMetadata.source = 'messenger';
        updatedMetadata.pageId = messagePageId;
        updatedMetadata.pageName = pageData?.pageName || null;
        // Preserve existing postId or add new one if available
        if (!updatedMetadata.postId && postId) {
          updatedMetadata.postId = postId;
          console.log('✅ [POST-REF] Adding postId to active conversation:', postId);
        }
        
        conversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: timestamp,
            updatedAt: new Date(),
            metadata: JSON.stringify(updatedMetadata)
          }
        });
        
        //console.log(`🔄 Updated existing active conversation: ${conversation.id}`);
      }

      let isNewConversation = false;
      if (!conversation) {
        // Create metadata with page information and post reference
        const conversationMetadata = {
          platform: 'facebook',
          source: 'messenger',
          pageId: messagePageId,
          pageName: pageData?.pageName || null,
          postId: postId || null // 🆕 Save postId if available (fast - no API calls)
        };
        
        if (postId) {
          console.log('✅ [POST-REF] Saving postId to new conversation:', postId);
        }
        
        conversation = await prisma.conversation.create({
          data: {
            customerId: customer.id,
            companyId: customer.companyId,
            channel: 'FACEBOOK',
            status: 'ACTIVE',
            lastMessageAt: timestamp,
            metadata: JSON.stringify(conversationMetadata)
          }
        });
        
        //console.log(`💬 New conversation created: ${conversation.id}`);
        isNewConversation = true;
      }

      // Determine message type and content
      let messageType = 'TEXT';
      let content = messageText || '';
      let attachmentsData = [];

      if (attachments && attachments.length > 0) {
        const attachment = attachments[0];
        if (attachment.type === 'image') {
          messageType = 'IMAGE';
          content = attachment.payload.url;
        } else if (attachment.type === 'file') {
          messageType = 'FILE';
          content = attachment.payload.url;
        }
        attachmentsData = attachments;
      }

      // 🆕 Handle referral events without message (OPEN_THREAD events)
      // For OPEN_THREAD events, just create/update conversation without creating a message
      const hasReferral = !!webhookEvent.referral;
      const hasNoMessage = !webhookEvent.message;
      
      if (hasReferral && hasNoMessage) {
        console.log('✅ [POST-REF] OPEN_THREAD event - conversation created/updated with postId:', postId);
        return; // Conversation already created/updated above, no need to create message
      }

      // ✅ FIX: التحقق من صحة محتوى الرسالة لجميع الأنواع (بما في ذلك الرسائل الفارغة من الإعلانات)
      const isEmptyMessage = messageType === 'TEXT' && !isValidMessageContent(content);
      const hasNoAttachments = !attachments || attachments.length === 0;
      
      if (isEmptyMessage && hasNoAttachments) {
        // ✅ FIX: إذا كانت الرسالة فارغة لكن يوجد referral، نحدث المحادثة بـ postId فقط بدون إنشاء رسالة
        if (hasReferral && postId) {
          console.log(`⚠️ [CUSTOMER-MESSAGE] رسالة فارغة من إعلان تم تجاهلها - تحديث المحادثة بـ postId: ${postId}`);
          
          // ✅ FIX: تحديث metadata المحادثة بـ postId إذا لم يكن موجوداً (حتى لو كانت المحادثة موجودة مسبقاً)
          if (conversation) {
            try {
              let metadata = {};
              if (conversation.metadata) {
                try {
                  metadata = JSON.parse(conversation.metadata);
                } catch (e) {
                  metadata = {};
                }
              }
              
              // تحديث postId إذا لم يكن موجوداً أو إذا كان postId الجديد مختلفاً
              if (!metadata.postId && postId) {
                metadata.postId = postId;
                // إضافة معلومات الإعلان أيضاً
                if (webhookEvent.referral?.ad_id) {
                  metadata.adId = webhookEvent.referral.ad_id;
                }
                if (webhookEvent.referral?.ad_ref) {
                  metadata.adRef = webhookEvent.referral.ad_ref;
                }
                if (webhookEvent.referral?.ads_context_data) {
                  metadata.adsContextData = webhookEvent.referral.ads_context_data;
                }
                
                await prisma.conversation.update({
                  where: { id: conversation.id },
                  data: {
                    metadata: JSON.stringify(metadata)
                  }
                });
                console.log(`✅ [POST-REF] تم تحديث المحادثة بـ postId: ${postId} من رسالة فارغة`);
              } else if (metadata.postId && metadata.postId !== postId) {
                // إذا كان postId موجوداً لكن مختلفاً، نحدثه
                metadata.postId = postId;
                await prisma.conversation.update({
                  where: { id: conversation.id },
                  data: {
                    metadata: JSON.stringify(metadata)
                  }
                });
                console.log(`✅ [POST-REF] تم تحديث postId في المحادثة من ${metadata.postId} إلى ${postId}`);
              }
            } catch (e) {
              console.warn('⚠️ [POST-REF] Error updating conversation metadata:', e.message);
            }
          }
        } else {
          console.log(`⚠️ [CUSTOMER-MESSAGE] رسالة فارغة أو غير صالحة تم تجاهلها من العميل: "${content}"`);
        }
        return; // تجاهل الرسالة الفارغة
      }

      // NEW: Capture Facebook message ID and reply reference
      const fbMessageId = webhookEvent.message?.mid;
      const replyToMid = webhookEvent.message?.reply_to?.mid;
      
      // 🔍 DEBUG: Log reply_to information
      // console.log('🔍 [REPLY-DEBUG] Message data:', {
      //   mid: fbMessageId,
      //   hasReplyTo: !!webhookEvent.message?.reply_to,
      //   replyToMid: replyToMid,
      //   fullMessage: JSON.stringify(webhookEvent.message).substring(0, 200)
      // });
      
      let replyMeta = {};
      if (replyToMid) {
        try {
          const parentMsg = await prisma.message.findFirst({
            where: {
              conversationId: conversation.id,
              metadata: { contains: replyToMid }
            },
            orderBy: { createdAt: 'desc' }
          });
          if (parentMsg) {
            const snippet = parentMsg.type === 'IMAGE' ? '📷 صورة' : parentMsg.type === 'FILE' ? '📎 ملف' : (parentMsg.content || '').substring(0, 80);
            replyMeta = {
              replyToResolvedMessageId: parentMsg.id,
              replyToContentSnippet: snippet,
              replyToSenderIsCustomer: !!parentMsg.isFromCustomer,
              replyToType: parentMsg.type
            };
          }
        } catch (e) {
          // ignore reply resolution errors
        }
      }

      // Save message to database
      const messageData = {
        content: content,
        type: messageType,
        conversationId: conversation.id,
        isFromCustomer: true,
        isRead: false, // ⚡ رسالة جديدة من العميل = غير مقروءة
        attachments: attachmentsData ? JSON.stringify(attachmentsData) : null,
        metadata: JSON.stringify({
          platform: 'facebook',
          source: 'messenger',
          senderId: senderId,
          hasAttachments: !!attachments,
          messageType: messageType,
          customerName: `${customer.firstName} ${customer.lastName}`.trim(),
          facebookMessageId: fbMessageId,
          replyToFacebookMessageId: replyToMid,
          ...replyMeta
        }),
        createdAt: timestamp
      };

      const saveStartTime = Date.now();
      const newMessage = await prisma.message.create({
        data: messageData
      });
      const afterSaveTime = Date.now();
      console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${afterSaveTime - saveStartTime}ms] 💾 [HANDLE] Message saved to DB: ${newMessage.id} from ${customer.firstName} ${customer.lastName}`);
      console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${afterSaveTime - handleStartTime}ms] ⏱️ [HANDLE] Total time to save message`);

      // ⚡ OPTIMIZATION: Send socket event IMMEDIATELY after saving message
      // Don't wait for conversation update - send message first, update conversation in background
      const socketStartTime = Date.now();
      const socketService = require('../services/socketService');
      const io = socketService.getIO();
      if (io) {
        const socketData = {
          id: newMessage.id,
          conversationId: newMessage.conversationId,
          content: newMessage.content,
          type: newMessage.type.toLowerCase(),
          isFromCustomer: newMessage.isFromCustomer,
          timestamp: newMessage.createdAt,
          attachments: newMessage.attachments ? JSON.parse(newMessage.attachments) : null,
          metadata: newMessage.metadata ? JSON.parse(newMessage.metadata) : null,
          customerName: `${customer.firstName} ${customer.lastName}`.trim(),
          // 🏢 Company Isolation
          companyId: customer.companyId
        };

        // ✅ إرسال للشركة فقط - Company Isolation
        io.to(`company_${customer.companyId}`).emit('new_message', socketData);
        console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - socketStartTime}ms] 🔌 [SOCKET] Message emitted to company ${customer.companyId} - MESSAGE SHOULD BE VISIBLE NOW!`);
        console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - handleStartTime}ms] ✅ [HANDLE] Message saved and sent to frontend - Total time so far`);
        
        // Emit new conversation event if this is a new conversation
        if (isNewConversation) {
          const convEventStartTime = Date.now();
          // Transform conversation data to match frontend format
          const conversationData = {
            id: conversation.id,
            customerName: `${customer.firstName} ${customer.lastName}`.trim() || 'عميل',
            lastMessage: newMessage.content,
            lastMessageTime: newMessage.createdAt,
            unreadCount: 1,
            platform: 'facebook',
            isOnline: false,
            messages: [socketData],
            // Add page information
            pageName: pageData?.pageName || null,
            pageId: messagePageId,
            // 🆕 Add flags for unread tab filtering
            lastMessageIsFromCustomer: true,
            lastCustomerMessageIsUnread: true
          };
          
          // Emit to company room
          socketService.emitNewConversation(customer.companyId, conversationData);
          console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - convEventStartTime}ms] 📤 [SOCKET] New conversation event emitted`);
        }
      }

      // 🔧 FIX: Update conversation lastMessagePreview AFTER sending socket (non-blocking)
      const lastMessagePreview = messageType === 'IMAGE' ? '📷 صورة' : 
                                 messageType === 'FILE' ? '📎 ملف' : 
                                 (content && content.trim() !== '' ? 
                                   (content.length > 100 ? content.substring(0, 100) + '...' : content) : 
                                   null);
      
      if (lastMessagePreview) {
        const updateConvStartTime = Date.now();
        // ⚡ OPTIMIZATION: Don't await - update in background
        prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: timestamp,
            lastMessagePreview: lastMessagePreview,
            updatedAt: new Date()
          }
        }).then(() => {
          console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - updateConvStartTime}ms] 🔄 [HANDLE] Updated conversation preview (background)`);
        }).catch(error => {
          console.error(`⏱️ [TIMING-${messageId.slice(-8)}] ❌ [HANDLE] Error updating conversation preview:`, error);
        });
      }

      // 🔔 إنشاء إشعار للرسالة الجديدة من العميل
      if (newMessage.isFromCustomer && customer.companyId) {
        try {
          // 🚫 NOTIFICATIONS DISABLED TEMPORARILY
          /*
          const notificationContent = newMessage.content 
            ? (newMessage.content.length > 50 ? newMessage.content.substring(0, 50) + '...' : newMessage.content)
            : (newMessage.type === 'IMAGE' ? '📷 صورة' : newMessage.type === 'FILE' ? '📎 ملف' : 'رسالة جديدة');

          await prisma.notification.create({
            data: {
              companyId: customer.companyId,
              userId: null, // إشعار عام للشركة
              type: 'new_message',
              title: `رسالة جديدة من ${customer.firstName || 'عميل'}`,
              message: notificationContent,
              data: JSON.stringify({
                conversationId: conversation.id,
                messageId: newMessage.id,
                customerId: customer.id,
                customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
                messageType: newMessage.type
              })
            }
          });

          // 🔌 إرسال إشعار عبر Socket للشركة
          const socketService = require('../services/socketService');
          socketService.emitToCompany(customer.companyId, 'new_message_notification', {
            conversationId: conversation.id,
            customerId: customer.id,
            customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
            message: notificationContent,
            timestamp: newMessage.createdAt
          });

          console.log(`🔔 [NOTIFICATION] Created new message notification for company ${customer.companyId}`);
          */
        } catch (notifError) {
          console.error('❌ [NOTIFICATION] Error creating message notification:', notifError);
        }
      }
      
      console.log(`⏱️ [TIMING-${messageId.slice(-8)}] [${Date.now() - handleStartTime}ms] ✅ [HANDLE] Total handleFacebookMessage time - Message should be visible now!`);

      //console.log(`🎉 [WEBHOOK] Message processing completed for customer: ${customer.firstName} ${customer.lastName} (AI disabled)`);
      return;
    }

    // Continue with AI processing if AI is enabled
    // 🆕 Extract postId from webhookEvent (fast - already extracted in webhookController)
    // Use existing postId if already extracted, otherwise extract it now
    if (!postId) {
      postId = webhookEvent._extractedPostId || null;
    }
    
    // ✅ DEBUG: Log postId extraction
    if (postId) {
      console.log(`✅ [POST-REF-AI] PostId extracted for AI path: ${postId}`);
    } else {
      console.log(`⚠️ [POST-REF-AI] No postId found in webhookEvent._extractedPostId`);
      console.log(`🔍 [POST-REF-AI] webhookEvent keys:`, Object.keys(webhookEvent));
      if (webhookEvent.referral) {
        console.log(`🔍 [POST-REF-AI] Referral exists:`, JSON.stringify(webhookEvent.referral, null, 2));
      }
    }
    
    let customer = await prisma.customer.findFirst({
      where: {
        facebookId: senderId,
        companyId: targetCompanyId
      }
    });

    if (!customer) {
      // NEW: Fetch real Facebook profile before creating customer
      //console.log(`👤 [PROFILE] Fetching Facebook profile for new customer: ${senderId}`);
      //console.log(`🔑 [PROFILE] Using page access token: ${pageData.pageAccessToken ? 'Available' : 'Missing'}`);
      
      const facebookProfile = await fetchFacebookUserProfile(senderId, pageData.pageAccessToken);
      //console.log(`📊 [PROFILE] Facebook profile result:`, facebookProfile);
      
      let firstName = 'عميل فيسبوك';
      let lastName = senderId.slice(-4);
      
      if (facebookProfile && facebookProfile.first_name) {
        firstName = facebookProfile.first_name;
        lastName = facebookProfile.last_name || '';
        //console.log(`✅ [PROFILE] Got real name: ${firstName} ${lastName}`);
      } else {
        //console.log(`⚠️ [PROFILE] Could not fetch real name, using fallback: ${firstName} ${lastName}`);
        
        // Debug: Log why profile fetch failed
        if (!facebookProfile) {
          //console.log(`🔍 [PROFILE-DEBUG] Profile fetch returned null/undefined`);
        } else {
          //console.log(`🔍 [PROFILE-DEBUG] Profile data missing first_name:`, facebookProfile);
        }
      }

      // Create new customer with real name
      //console.log(`👤 [CUSTOMER-DEBUG] Creating new customer for facebookId: ${senderId} in company: ${targetCompanyId}`);

      customer = await prisma.customer.create({
        data: {
          facebookId: senderId,
          firstName: firstName,
          lastName: lastName,
          email: `facebook_${senderId}@example.com`,
          phone: '',
          companyId: targetCompanyId,
          // Store additional Facebook data
          metadata: JSON.stringify({
            facebookProfile: facebookProfile,
            profileFetched: !!facebookProfile,
            profileFetchedAt: new Date().toISOString(),
            profilePicture: facebookProfile?.profile_pic
          })
        }
      });
      //console.log(`👤 New customer created with real name: ${customer.firstName} ${customer.lastName} (${customer.id})`);
    } else {
      // OPTIONAL: Update existing customer's name if we have better data
      //console.log(`👤 [CUSTOMER-UPDATE] Checking if we should update existing customer: ${customer.firstName} ${customer.lastName}`);
      
      // Only update if current name is generic or from previous failed attempts
      const isGenericName = customer.firstName === 'عميل فيسبوك' || 
                           customer.firstName.includes('عميل فيسبوك') || 
                           customer.firstName === 'Facebook' || 
                           customer.lastName === 'User' ||
                           customer.firstName === 'مستخدم';
      
      if (isGenericName) {
        //console.log(`🔄 [CUSTOMER-UPDATE] Current name is generic, attempting to fetch real name...`);
        
        const facebookProfile = await fetchFacebookUserProfile(senderId, pageData.pageAccessToken);
        
        if (facebookProfile && (facebookProfile.first_name || facebookProfile.name)) {
          // Use first_name and last_name if available
          let firstName = customer.firstName;
          let lastName = customer.lastName;
          
          if (facebookProfile.first_name) {
            firstName = facebookProfile.first_name;
            lastName = facebookProfile.last_name || '';
          } 
          // Fallback to parsing the 'name' field
          else if (facebookProfile.name) {
            const nameParts = facebookProfile.name.split(' ');
            firstName = nameParts[0] || facebookProfile.name;
            lastName = nameParts.slice(1).join(' ') || '';
          }
          
          // Only update if we got a better name than what we already have
          if (firstName !== customer.firstName || lastName !== customer.lastName) {
            const updatedCustomer = await prisma.customer.update({
              where: { id: customer.id },
              data: {
                firstName: firstName,
                lastName: lastName,
                metadata: JSON.stringify({
                  ...customer.metadata ? JSON.parse(customer.metadata) : {},
                  facebookProfile: facebookProfile,
                  profileUpdated: true,
                  profileUpdatedAt: new Date().toISOString(),
                  profilePicture: facebookProfile.profile_pic
                })
              }
            });
            
            customer = updatedCustomer;
            //console.log(`✅ [CUSTOMER-UPDATE] Updated customer name to: ${customer.firstName} ${customer.lastName}`);
          } else {
            //console.log(`ℹ️ [CUSTOMER-UPDATE] Name unchanged: ${customer.firstName} ${customer.lastName}`);
          }
        } else {
          //console.log(`⚠️ [CUSTOMER-UPDATE] Could not fetch better name, keeping existing: ${customer.firstName} ${customer.lastName}`);
        }
      } else {
        //console.log(`ℹ️ [CUSTOMER-UPDATE] Customer already has a non-generic name: ${customer.firstName} ${customer.lastName}`);
      }
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        customerId: customer.id,
        status: { in: ['ACTIVE', 'RESOLVED'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const timestamp = new Date();

    if (conversation && conversation.status === 'RESOLVED') {
      // Update metadata with page information when reactivating conversation
      let updatedMetadata = {};
      if (conversation.metadata) {
        try {
          updatedMetadata = JSON.parse(conversation.metadata);
        } catch (e) {
          // If parsing fails, start with empty object
          updatedMetadata = {};
        }
      }
      
      // Add/Update page information and post reference
      updatedMetadata.platform = 'facebook';
      updatedMetadata.source = 'messenger';
      updatedMetadata.pageId = messagePageId;
      updatedMetadata.pageName = pageData?.pageName || null;
      // ✅ FIX: Preserve existing postId or add new one if available
      if (postId) {
        if (!updatedMetadata.postId) {
          updatedMetadata.postId = postId;
          console.log('✅ [POST-REF-AI] Adding postId to reactivated conversation:', postId);
        } else if (updatedMetadata.postId !== postId) {
          // Update postId if different (may happen if user clicked different ad)
          updatedMetadata.postId = postId;
          console.log('✅ [POST-REF-AI] Updating postId in reactivated conversation from', updatedMetadata.postId, 'to', postId);
        } else {
          console.log('ℹ️ [POST-REF-AI] PostId already exists in reactivated conversation:', postId);
        }
      } else {
        console.log('⚠️ [POST-REF-AI] No postId available to add to reactivated conversation');
      }
      
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'ACTIVE',
          lastMessageAt: timestamp,
          updatedAt: new Date(),
          metadata: JSON.stringify(updatedMetadata)
        }
      });
      //console.log(`🔄 Reactivated conversation: ${conversation.id}`);
    } else if (conversation && conversation.status === 'ACTIVE') {
      // Update metadata with page information when updating active conversation
      let updatedMetadata = {};
      if (conversation.metadata) {
        try {
          updatedMetadata = JSON.parse(conversation.metadata);
        } catch (e) {
          // If parsing fails, start with empty object
          updatedMetadata = {};
        }
      }
      
      // Add/Update page information and post reference
      updatedMetadata.platform = 'facebook';
      updatedMetadata.source = 'messenger';
      updatedMetadata.pageId = messagePageId;
      updatedMetadata.pageName = pageData?.pageName || null;
      // ✅ FIX: Preserve existing postId or add new one if available
      if (postId) {
        if (!updatedMetadata.postId) {
          updatedMetadata.postId = postId;
          console.log('✅ [POST-REF-AI] Adding postId to active conversation:', postId);
        } else if (updatedMetadata.postId !== postId) {
          // Update postId if different (may happen if user clicked different ad)
          updatedMetadata.postId = postId;
          console.log('✅ [POST-REF-AI] Updating postId in active conversation from', updatedMetadata.postId, 'to', postId);
        } else {
          console.log('ℹ️ [POST-REF-AI] PostId already exists in active conversation:', postId);
        }
      } else {
        console.log('⚠️ [POST-REF-AI] No postId available to add to active conversation');
      }
      
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: timestamp,
          updatedAt: new Date(),
          metadata: JSON.stringify(updatedMetadata)
        }
      });
      //console.log(`🔄 Updated existing active conversation: ${conversation.id}`);
    }

    let isNewConversation = false;
    if (!conversation) {
      // Create metadata with page information and post reference
      const conversationMetadata = {
        platform: 'facebook',
        source: 'messenger',
        pageId: messagePageId,
        pageName: pageData?.pageName || null,
        postId: postId || null // 🆕 Save postId if available (fast - no API calls)
      };
      
      if (postId) {
        console.log('✅ [POST-REF-AI] Saving postId to new conversation:', postId);
      } else {
        console.log('⚠️ [POST-REF-AI] No postId available for new conversation');
      }
      
      conversation = await prisma.conversation.create({
        data: {
          customerId: customer.id,
          companyId: customer.companyId,
          channel: 'FACEBOOK',
          status: 'ACTIVE',
          lastMessageAt: timestamp,
          metadata: JSON.stringify(conversationMetadata)
        }
      });
      //console.log(`💬 New conversation created: ${conversation.id}`);
      isNewConversation = true;
    }

    // Determine message type and content
    let messageType = 'TEXT';
    let content = messageText || '';
    let attachmentsData = [];

    if (attachments && attachments.length > 0) {
      const attachment = attachments[0];
      if (attachment.type === 'image') {
        messageType = 'IMAGE';
        content = attachment.payload.url;
      } else if (attachment.type === 'file') {
        messageType = 'FILE';
        content = attachment.payload.url;
      }
      attachmentsData = attachments;
    }

    // ✅ FIX: التحقق من صحة محتوى الرسالة قبل الحفظ (خاصة عندما يكون AI مفعّل)
    const isEmptyMessage = messageType === 'TEXT' && !isValidMessageContent(content);
    const hasNoAttachments = !attachments || attachments.length === 0;
    
    if (isEmptyMessage && hasNoAttachments) {
      console.log(`⚠️ [CUSTOMER-MESSAGE-AI] رسالة فارغة تم تجاهلها من العميل: "${content}"`);
      // ✅ لا نحفظ الرسالة الفارغة، لكن نستمر في معالجة AI إذا كان هناك محتوى في messageText الأصلي
      // (قد يكون هناك محتوى في messageText لكن content أصبح فارغاً بسبب معالجة خاطئة)
      if (!messageText || !isValidMessageContent(messageText)) {
        return; // تجاهل الرسالة الفارغة تماماً
      }
      // إذا كان messageText الأصلي صحيحاً، نستخدمه
      content = messageText;
    }

    // NEW: Extract reply_to information from webhook event (if available)
    const fbMessageId = webhookEvent?.message?.mid;
    const replyToMid = webhookEvent?.message?.reply_to?.mid;
    
    console.log('🔍 [REPLY-DEBUG-AI] Checking for reply_to:', {
      mid: fbMessageId,
      hasReplyTo: !!webhookEvent?.message?.reply_to,
      replyToMid: replyToMid,
      hasWebhookEvent: !!webhookEvent
    });
    
    let replyMeta = {};
    if (replyToMid) {
      try {
        const parentMsg = await prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            metadata: { contains: replyToMid }
          },
          orderBy: { createdAt: 'desc' }
        });
        if (parentMsg) {
          const snippet = parentMsg.type === 'IMAGE' ? '📷 صورة' : parentMsg.type === 'FILE' ? '📎 ملف' : (parentMsg.content || '').substring(0, 80);
          replyMeta = {
            replyToResolvedMessageId: parentMsg.id,
            replyToContentSnippet: snippet,
            replyToSenderIsCustomer: !!parentMsg.isFromCustomer,
            replyToType: parentMsg.type
          };
          console.log('✅ [REPLY-DEBUG-AI] Resolved reply_to:', replyMeta);
        }
      } catch (e) {
        console.log('⚠️ [REPLY-DEBUG-AI] Error resolving reply_to:', e.message);
      }
    }

    // ✅ FIX: التحقق النهائي من المحتوى قبل الحفظ
    if (messageType === 'TEXT' && !isValidMessageContent(content)) {
      console.log(`⚠️ [CUSTOMER-MESSAGE-AI] رسالة فارغة نهائية تم تجاهلها - لن يتم حفظها: "${content}"`);
      return; // تجاهل الرسالة الفارغة تماماً
    }

    // Save message to database
    const messageData = {
      content: content,
      type: messageType,
      conversationId: conversation.id,
      isFromCustomer: true,
      attachments: attachmentsData ? JSON.stringify(attachmentsData) : null,
      metadata: JSON.stringify({
        platform: 'facebook',
        source: 'messenger',
        senderId: senderId,
        hasAttachments: !!attachments,
        messageType: messageType,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        facebookMessageId: fbMessageId,
        replyToFacebookMessageId: replyToMid,
        ...replyMeta
      }),
      createdAt: timestamp
    };

    const newMessage = await prisma.message.create({
      data: messageData
    });

    //console.log(`✅ Message saved: ${newMessage.id} from ${customer.firstName} ${customer.lastName}`);

    // 🔧 FIX: Update conversation lastMessagePreview (only if content is not empty)
    const lastMessagePreview = messageType === 'IMAGE' ? '📷 صورة' : 
                               messageType === 'FILE' ? '📎 ملف' : 
                               (content && content.trim() !== '' ? 
                                 (content.length > 100 ? content.substring(0, 100) + '...' : content) : 
                                 null);
    
    if (lastMessagePreview) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: timestamp,
          lastMessagePreview: lastMessagePreview,
          updatedAt: new Date()
        }
      });
    }

    // 🔔 إنشاء إشعار للرسالة الجديدة من العميل
    if (newMessage.isFromCustomer && customer.companyId) {
      try {
        // 🚫 NOTIFICATIONS DISABLED TEMPORARILY
        /*
        const notificationContent = newMessage.content 
          ? (newMessage.content.length > 50 ? newMessage.content.substring(0, 50) + '...' : newMessage.content)
          : (newMessage.type === 'IMAGE' ? '📷 صورة' : newMessage.type === 'FILE' ? '📎 ملف' : 'رسالة جديدة');

        await prisma.notification.create({
          data: {
            companyId: customer.companyId,
            userId: null, // إشعار عام للشركة
            type: 'new_message',
            title: `رسالة جديدة من ${customer.firstName || 'عميل'}`,
            message: notificationContent,
            data: JSON.stringify({
              conversationId: conversation.id,
              messageId: newMessage.id,
              customerId: customer.id,
              customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
              messageType: newMessage.type
            })
          }
        });

        // 🔌 إرسال إشعار عبر Socket للشركة
        const socketService = require('../services/socketService');
        socketService.emitToCompany(customer.companyId, 'new_message_notification', {
          conversationId: conversation.id,
          customerId: customer.id,
          customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
          message: notificationContent,
          timestamp: newMessage.createdAt
        });

        console.log(`🔔 [NOTIFICATION] Created new message notification for company ${customer.companyId}`);
        */
      } catch (notifError) {
        console.error('❌ [NOTIFICATION] Error creating message notification:', notifError);
      }
    }

    // Send Socket.IO event for new message
    const socketService = require('../services/socketService');
    const io = socketService.getIO();
    if (io) {
      const parsedMetadata = newMessage.metadata ? JSON.parse(newMessage.metadata) : null;
      const socketData = {
        id: newMessage.id,
        conversationId: newMessage.conversationId,
        content: newMessage.content,
        type: newMessage.type.toLowerCase(),
        isFromCustomer: newMessage.isFromCustomer,
        timestamp: newMessage.createdAt,
        attachments: newMessage.attachments ? JSON.parse(newMessage.attachments) : null,
        metadata: parsedMetadata,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        // 🏢 Company Isolation
        companyId: customer.companyId
      };

      // 🔍 DEBUG: Log reply metadata being sent via Socket
      if (parsedMetadata?.replyToContentSnippet || parsedMetadata?.replyToFacebookMessageId) {
        console.log('📤 [SOCKET-REPLY] Sending message with reply metadata:', {
          messageId: socketData.id,
          replyToSnippet: parsedMetadata.replyToContentSnippet,
          replyToMid: parsedMetadata.replyToFacebookMessageId,
          replyToResolvedId: parsedMetadata.replyToResolvedMessageId
        });
      }

      //console.log(`🔌 [SOCKET] Emitting new_message event to company ${customer.companyId}:`, socketData);
      // ✅ إرسال للشركة فقط - Company Isolation
      io.to(`company_${customer.companyId}`).emit('new_message', socketData);
      
      // Emit new conversation event if this is a new conversation
      if (isNewConversation) {
        // Transform conversation data to match frontend format
        const conversationData = {
          id: conversation.id,
          customerName: `${customer.firstName} ${customer.lastName}`.trim() || 'عميل',
          lastMessage: newMessage.content,
          lastMessageTime: newMessage.createdAt,
          unreadCount: 1,
          platform: 'facebook',
          isOnline: false,
          messages: [socketData],
          // Add page information
          pageName: pageData?.pageName || null,
          pageId: messagePageId,
          // 🆕 Add flags for unread tab filtering
          lastMessageIsFromCustomer: true,
          lastCustomerMessageIsUnread: true
        };
        
        // Emit to company room
        socketService.emitNewConversation(customer.companyId, conversationData);
        //console.log(`🔌 [SOCKET] Emitting new_conversation event for company ${customer.companyId} with customer: ${conversationData.customerName}`);
      }
    }

    // Prepare message data for AI Agent
    const aiMessageData = {
      conversationId: conversation.id,
      senderId: senderId,
      content: messageText || '',
      attachments: attachmentsData || [],
      timestamp: timestamp,
      companyId: customer.companyId,
      customerData: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        phone: customer.phone,
        email: customer.email,
        companyId: customer.companyId
      }
    };

    // Send message to AI Agent with enhanced diagnostics
    //console.log('🚀 [AI-DIAGNOSTIC] Sending message to AI Agent...');
    //console.log('🚀 [AI-DIAGNOSTIC] Customer name:', `${customer.firstName} ${customer.lastName}`.trim());
    
    // ✍️ Start typing indicators (Frontend + Facebook)
    try {
      // Frontend typing event
      const socketService = require('../services/socketService');
      socketService.emitToCompany(customer.companyId, 'ai_typing', {
        conversationId: conversation.id,
        isTyping: true,
        source: 'ai_agent'
      });
      
      // Facebook typing_on
      if (pageData && pageData.pageAccessToken && messagePageId) {
        await sendFacebookSenderAction(senderId, 'typing_on', messagePageId, pageData.pageAccessToken);
      }
    } catch (typingErr) {
      //console.log('⚠️ [TYPING] Failed to start typing indicators:', typingErr.message);
    }
    
    // ♻️ Keep typing alive until reply is sent
    let typingKeepAlive = null;
    try {
      if (pageData && pageData.pageAccessToken && messagePageId) {
        typingKeepAlive = setInterval(async () => {
          try {
            // Facebook keep-alive
            await sendFacebookSenderAction(senderId, 'typing_on', messagePageId, pageData.pageAccessToken);
          } catch (e) {
            // ignore
          }
          try {
            // Frontend keep-alive
            const socketService = require('../services/socketService');
            socketService.emitToCompany(customer.companyId, 'ai_typing', {
              conversationId: conversation.id,
              isTyping: true,
              source: 'ai_agent'
            });
          } catch (e) {
            // ignore
          }
        }, 7000); // every 7s
      }
    } catch (keepErr) {
      // ignore
    }
    
    // 📊 Track response time for monitoring
    const startTime = Date.now();
    const aiResponse = await aiAgentService.processCustomerMessage(aiMessageData);
    const processingTime = Date.now() - startTime;
    
    // 📊 Log to Simple Monitor for tracking
    const { simpleMonitor } = require('../services/simpleMonitor');
    const isEmpty = !aiResponse || !aiResponse.content || aiResponse.silent;
    const isSuccessful = aiResponse && aiResponse.success !== false;
    simpleMonitor.logResponse(processingTime, isEmpty, isSuccessful);
    
    if (aiResponse && aiResponse.content && !aiResponse.silent) {
      //console.log('🤖 AI Response:', aiResponse.content);

      // ✅ FINAL CHECK: Before sending response, check if employee replied recently
      // This prevents race condition where employee message was saved after AI processing started
      try {
        const lastEmployeeMessage = await prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            isFromCustomer: false,
            senderId: { not: null } // Employee message (not AI)
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            content: true
          }
        });

        if (lastEmployeeMessage) {
          const now = new Date();
          const employeeMessageTime = new Date(lastEmployeeMessage.createdAt);
          const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
          
          // If employee replied in last 30 seconds, cancel sending
          if (employeeMessageTime > thirtySecondsAgo) {
            console.log(`🚫 [PRE-SEND-CHECK] Employee replied recently (${employeeMessageTime.toISOString()}) - Cancelling AI response`);
            console.log(`🚫 [PRE-SEND-CHECK] Employee message: "${(lastEmployeeMessage.content || '').substring(0, 50)}..."`);
            
            // Stop typing indicators
            try {
              if (typingKeepAlive) { clearInterval(typingKeepAlive); typingKeepAlive = null; }
              const socketService = require('../services/socketService');
              socketService.emitToCompany(customer.companyId, 'ai_typing', {
                conversationId: conversation.id,
                isTyping: false,
                source: 'ai_agent'
              });
              if (pageData && pageData.pageAccessToken && messagePageId) {
                await sendFacebookSenderAction(senderId, 'typing_off', messagePageId, pageData.pageAccessToken);
              }
            } catch (typingErr) {
              // ignore
            }
            
            // Skip sending - employee is handling the conversation
            return;
          }
        }
      } catch (preSendCheckError) {
        console.error('⚠️ [PRE-SEND-CHECK] Error checking employee messages before send:', preSendCheckError);
        // Continue with sending if check fails (fail-safe)
      }

      // 💾 INSTANT SAVE: حفظ رد AI فوراً قبل الإرسال للفيسبوك
      let savedAIMessage = null;
      try {
        savedAIMessage = await prisma.message.create({
          data: {
            content: aiResponse.content,
            type: 'TEXT',
            conversationId: conversation.id,
            isFromCustomer: false,
            senderId: null, // AI message has no employee sender
            metadata: JSON.stringify({
              platform: 'facebook',
              source: 'ai_agent',
              isAIGenerated: true,
              isFacebookReply: true,
              timestamp: new Date(),
              instantSave: true,
              intent: aiResponse.intent,
              sentiment: aiResponse.sentiment,
              confidence: aiResponse.confidence
            }),
            createdAt: new Date()
          }
        });
        
        console.log(`💾 [INSTANT-SAVE-AI] AI message saved immediately: ${savedAIMessage.id}`);
        
        // إرسال الرسالة فوراً للـ socket
        const socketService = require('../services/socketService');
        const io = socketService.getIO();
        if (io) {
          const socketData = {
            id: savedAIMessage.id,
            conversationId: savedAIMessage.conversationId,
            content: savedAIMessage.content,
            type: savedAIMessage.type.toLowerCase(),
            isFromCustomer: savedAIMessage.isFromCustomer,
            timestamp: savedAIMessage.createdAt,
            metadata: JSON.parse(savedAIMessage.metadata),
            isFacebookReply: true,
            isAiGenerated: true,
            lastMessageIsFromCustomer: false,
            lastCustomerMessageIsUnread: false,
            // 🏢 Company Isolation
            companyId: conversation.companyId
          };
          
          // ✅ إرسال للشركة فقط - Company Isolation
          io.to(`company_${conversation.companyId}`).emit('new_message', socketData);
          console.log(`⚡ [SOCKET-AI] AI message emitted to company ${conversation.companyId}`);
        }
      } catch (saveError) {
        console.error('❌ [INSTANT-SAVE-AI] Error saving AI message:', saveError.message);
      }

      // Send AI response back to Facebook
      const facebookResult = await sendFacebookMessage(senderId, aiResponse.content, 'TEXT', messagePageId);
      
      if (facebookResult.success) {
        //console.log('✅ AI response sent successfully to Facebook');
        
        // 🔄 تحديث الرسالة المحفوظة بـ Facebook Message ID
        if (facebookResult.messageId && savedAIMessage) {
          try {
            await prisma.message.update({
              where: { id: savedAIMessage.id },
              data: {
                metadata: JSON.stringify({
                  ...JSON.parse(savedAIMessage.metadata),
                  facebookMessageId: facebookResult.messageId,
                  sentToFacebook: true
                })
              }
            });
            console.log(`✅ [UPDATE-AI] AI message ${savedAIMessage.id} updated with Facebook ID: ${facebookResult.messageId}`);
          } catch (updateError) {
            console.error('⚠️ [UPDATE-AI] Failed to update AI message with Facebook ID:', updateError.message);
          }
        }
        
        // ⚡ Mark this message as AI-generated in the webhook cache
        if (facebookResult.messageId) {
          const { markMessageAsAI } = require('../controller/webhookController');
          markMessageAsAI(facebookResult.messageId, {
            isAIGenerated: true,
            source: 'ai_agent',
            intent: aiResponse.intent,
            sentiment: aiResponse.sentiment,
            confidence: aiResponse.confidence
          });
        }
      } else {
        //console.log('❌ Failed to send AI response to Facebook:', facebookResult.error);
      }

      // NEW: Handle AI response images
      console.log('🔍 [IMAGE-DEBUG] Checking for images in AI response...');
      console.log('🔍 [IMAGE-DEBUG] aiResponse.images:', aiResponse.images);
      console.log('🔍 [IMAGE-DEBUG] aiResponse.images type:', typeof aiResponse.images);
      console.log('🔍 [IMAGE-DEBUG] aiResponse.images length:', aiResponse.images ? aiResponse.images.length : 'undefined');
      
      if (aiResponse.images && aiResponse.images.length > 0) {
        console.log('🔍 [IMAGE-DEBUG] First image structure:', JSON.stringify(aiResponse.images[0], null, 2));
        console.log('🔍 [IMAGE-DEBUG] All images URLs:');
        aiResponse.images.forEach((img, i) => {
          console.log(`  ${i + 1}. ${img?.payload?.url || 'NO URL'} - Title: ${img?.payload?.title || 'NO TITLE'}`);
        });
      }

      // Send images if available
      if (aiResponse.images && aiResponse.images.length > 0) {
        //console.log(`📸 Processing ${aiResponse.images.length} product images...`);

        // Filter only valid images
        const validImages = aiResponse.images.filter(image => {
          if (!image || !image.payload || !image.payload.url) {
            //console.log('❌ [IMAGE-FILTER] Invalid image structure');
            return false;
          }

          const url = image.payload.url;

          // Check that URL starts with http or https
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            //console.log(`❌ [IMAGE-FILTER] Invalid URL protocol: ${url}`);
            return false;
          }

          // Check that URL contains a dot (domain)
          if (!url.includes('.')) {
            //console.log(`❌ [IMAGE-FILTER] Invalid URL format: ${url}`);
            return false;
          }

          // Check that URL is not just a single character
          if (url.length < 10) {
            //console.log(`❌ [IMAGE-FILTER] URL too short: ${url}`);
            return false;
          }

          // Check that URL doesn't contain only strange characters
          if (url === 'h' || url === 't' || url.length === 1) {
            //console.log(`❌ [IMAGE-FILTER] Invalid single character URL: ${url}`);
            return false;
          }

          try {
            new URL(url);
            //console.log(`✅ [IMAGE-FILTER] Valid URL: ${url}`);
            return true;
          } catch (error) {
            //console.log(`❌ [IMAGE-FILTER] Invalid URL format: ${url} - ${error.message}`);
            return false;
          }
        });

        console.log(`📸 [IMAGE-FILTER] Filtered ${validImages.length}/${aiResponse.images.length} valid images`);
        
        if (validImages.length < aiResponse.images.length) {
          console.log(`⚠️ [IMAGE-FILTER] ${aiResponse.images.length - validImages.length} images were rejected during filtering`);
          console.log('🔍 [IMAGE-FILTER] Valid images that passed:');
          validImages.forEach((img, i) => {
            console.log(`  ✅ ${i + 1}. ${img?.payload?.url} - ${img?.payload?.title || 'No title'}`);
          });
        }
        
        if (validImages.length === 0) {
          console.log('❌ [IMAGE-FILTER] No valid images after filtering! Check image URLs.');
        }

        if (validImages.length > 0) {
          // Send confirmation message first
          const confirmResult = await sendFacebookMessage(senderId, `📸 جاري إرسال ${validImages.length} صور للمنتجات...`, 'TEXT', messagePageId);
          
          // ⚡ Mark confirmation message as AI-generated
          if (confirmResult.success && confirmResult.messageId) {
            const { markMessageAsAI } = require('../controller/webhookController');
            markMessageAsAI(confirmResult.messageId, {
              isAIGenerated: true,
              source: 'ai_agent_confirmation',
              messageType: 'TEXT'
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));

          let sentCount = 0;
          console.log(`📸 [IMAGE-LOOP] Starting to send ${validImages.length} images...`);

          for (const image of validImages) {
            console.log(`📸 [IMAGE-LOOP] Sending image ${sentCount + 1}/${validImages.length}: ${image.payload.url}`);

            try {
              const result = await sendFacebookMessage(senderId, image.payload.url, 'IMAGE', messagePageId);
              
              if (result.success) {
                sentCount++;
                console.log(`✅ [IMAGE-LOOP] Image ${sentCount}/${validImages.length} sent successfully - ID: ${result.messageId}`);

                // ⚡ Mark this image as AI-generated in the webhook cache
                // الصورة هتتحفظ من الـ echo زي الرسائل النصية
                if (result.messageId) {
                  const { markMessageAsAI } = require('../controller/webhookController');
                  markMessageAsAI(result.messageId, {
                    isAIGenerated: true,
                    source: 'ai_agent_image',
                    messageType: 'IMAGE',
                    imageIndex: sentCount,
                    totalImages: validImages.length
                  });
                  console.log(`📸 [CACHE] Image marked as AI - will be saved when echo is received: ${result.messageId.slice(-8)}`);
                }
              } else {
                console.log(`❌ [IMAGE-LOOP] Failed to send image ${sentCount + 1}/${validImages.length}:`, result.error);
                console.log(`❌ [IMAGE-LOOP] Failed image URL: ${image.payload.url}`);
                
                // Handle Facebook error 2018001 specifically for images
                // في حالة الفشل، مفيش echo فمحتاجين نحفظ يدوياً
                if (result.error === 'NO_MATCHING_USER') {
                  console.log(`⚠️ [FACEBOOK-IMAGE] Failed to send - saving with error info`);
                }
              }
            } catch (error) {
              //console.log(`❌ [IMAGE-LOOP] Error in sendFacebookMessage:`, error);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // ⚡ OPTIMIZATION: مش هنحفظ الصور هنا - هنستنى الـ echo من Facebook
          // الصور هتتحفظ تلقائياً لما الـ echo يجي من Facebook زي الرسائل النصية
          console.log(`⌛ [IMAGE-SAVE] Images sent to Facebook - will be saved when echoes are received (${sentCount} images)`);
        }
      }

      // ⚡ OPTIMIZATION NOTE: Socket.IO event will be emitted when Facebook echo is received
      // This prevents duplicate emissions and ensures consistency with database state
      // The webhook controller handles Socket.IO emission when the echo arrives

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: aiResponse.content.length > 100 ? 
            aiResponse.content.substring(0, 100) + '...' : aiResponse.content
        }
      });

      // 🛑 Stop typing indicators (Frontend + Facebook)
      try {
        if (typingKeepAlive) { clearInterval(typingKeepAlive); typingKeepAlive = null; }
        const socketService = require('../services/socketService');
        socketService.emitToCompany(customer.companyId, 'ai_typing', {
          conversationId: conversation.id,
          isTyping: false,
          source: 'ai_agent'
        });
        if (pageData && pageData.pageAccessToken && messagePageId) {
          await sendFacebookSenderAction(senderId, 'typing_off', messagePageId, pageData.pageAccessToken);
        }
      } catch (typingErr) {
        //console.log('⚠️ [TYPING] Failed to stop typing indicators:', typingErr.message);
      }

      //console.log(`🎉 [WEBHOOK] Message processing completed for customer: ${customer.firstName} ${customer.lastName}`);
    } else {
      //console.log('🤖 AI response was silent or empty - no reply sent');
      // Ensure typing stops even if no reply
      try {
        if (typingKeepAlive) { clearInterval(typingKeepAlive); typingKeepAlive = null; }
        const socketService = require('../services/socketService');
        socketService.emitToCompany(customer.companyId, 'ai_typing', {
          conversationId: conversation.id,
          isTyping: false,
          source: 'ai_agent'
        });
        if (pageData && pageData.pageAccessToken && messagePageId) {
          await sendFacebookSenderAction(senderId, 'typing_off', messagePageId, pageData.pageAccessToken);
        }
      } catch (typingErr) {
        //console.log('⚠️ [TYPING] Failed to stop typing indicators (silent):', typingErr.message);
      }
    }

  } catch (error) {
    console.error('❌ Error processing Facebook message:', error);
    // Failsafe: stop typing on errors
    try {
      // typingKeepAlive may not be defined if error occurred earlier but it's harmless
      if (typeof typingKeepAlive !== 'undefined' && typingKeepAlive) {
        clearInterval(typingKeepAlive);
      }
      const socketService = require('../services/socketService');
      if (conversation && customer) {
        socketService.emitToCompany(customer.companyId, 'ai_typing', {
          conversationId: conversation.id,
          isTyping: false,
          source: 'ai_agent'
        });
      }
      if (pageData && pageData.pageAccessToken && messagePageId) {
        await sendFacebookSenderAction(senderId, 'typing_off', messagePageId, pageData.pageAccessToken);
      }
    } catch (e) {
      // ignore
    }
  }
}

// Stub functions for compatibility
async function handleMessageDirectly(senderId, messageText, webhookEvent) {
  //console.log(`📨 Direct message from ${senderId}: "${messageText}"`);
  await handleFacebookMessage(webhookEvent);
}

// NEW: Function to delete a Facebook comment
async function deleteFacebookComment(commentId, pageAccessToken) {
  try {
    //console.log(`🗑️ [COMMENT-DELETE] Deleting comment ${commentId} from Facebook`);
    
    const url = `https://graph.facebook.com/v18.0/${commentId}?access_token=${pageAccessToken}`;
    
    const response = await fetch(url, {
      method: 'DELETE'
    });
    
    const responseData = await response.json();
    
    // Log the full response for debugging
    //console.log(`📊 [COMMENT-DELETE] Full response:`, JSON.stringify(responseData, null, 2));
    
    if (responseData.error) {
      console.error('❌ [COMMENT-DELETE] Error deleting comment:', responseData.error);
      return false;
    }
    
    if (responseData.success === true) {
      //console.log(`✅ [COMMENT-DELETE] Successfully deleted comment ${commentId} from Facebook`);
      return true;
    } else {
      console.error('❌ [COMMENT-DELETE] Unexpected response format:', responseData);
      return false;
    }
  } catch (error) {
    console.error('❌ [COMMENT-DELETE] Error deleting comment:', error);
    return false;
  }
}

// Enhanced diagnostic function
async function diagnoseFacebookSending(recipientId, messageContent, pageId = null) {
  const prisma = getPrisma(); // ✅ Get connected instance
  //console.log('🔍 [DIAGNOSTIC] Starting Facebook sending diagnosis...');
  
  try {
    // Step 1: Check recipient ID
    //console.log(`🔍 [DIAGNOSTIC] Step 1 - Recipient ID: ${recipientId}`);
    if (!recipientId || typeof recipientId !== 'string' || recipientId.trim() === '') {
      //console.log('❌ [DIAGNOSTIC] Invalid recipient ID');
      return { success: false, error: 'INVALID_RECIPIENT_ID' };
    }

    // Step 2: Check page data
    //console.log(`🔍 [DIAGNOSTIC] Step 2 - Page ID: ${pageId}`);
    let pageData = null;
    if (pageId) {
      pageData = await getPageToken(pageId);
      //console.log(`🔍 [DIAGNOSTIC] Page data found:`, pageData ? 'YES' : 'NO');
    }

    // Step 3: Check last webhook page
    //console.log(`🔍 [DIAGNOSTIC] Step 3 - Last webhook page: ${lastWebhookPageId}`);
    if (!pageData && lastWebhookPageId) {
      pageData = await getPageToken(lastWebhookPageId);
      //console.log(`🔍 [DIAGNOSTIC] Last webhook page data:`, pageData ? 'YES' : 'NO');
    }

    // Step 4: Check default page
    if (!pageData) {
      //console.log(`🔍 [DIAGNOSTIC] Step 4 - Searching for default page...`);
      const defaultPage = await prisma.facebookPage.findFirst({
        where: { status: 'connected' },
        orderBy: { connectedAt: 'desc' }
      });
      //console.log(`🔍 [DIAGNOSTIC] Default page found:`, defaultPage ? 'YES' : 'NO');
      if (defaultPage) {
        pageData = {
          pageAccessToken: defaultPage.pageAccessToken,
          pageName: defaultPage.pageName,
          companyId: defaultPage.companyId,
          lastUsed: Date.now()
        };
      }
    }

    // Step 5: Final validation
    //console.log(`🔍 [DIAGNOSTIC] Step 5 - Final validation:`);
    //console.log(`   - Page data exists: ${!!pageData}`);
    //console.log(`   - Page access token exists: ${!!pageData?.pageAccessToken}`);
    //console.log(`   - Page name: ${pageData?.pageName || 'N/A'}`);
    //console.log(`   - Company ID: ${pageData?.companyId || 'N/A'}`);

    if (!pageData || !pageData.pageAccessToken) {
      //console.log('❌ [DIAGNOSTIC] No valid page data found');
      return { success: false, error: 'NO_VALID_PAGE' };
    }

    return {
      success: true,
      message: 'Diagnostic completed - no actual message sent',
      diagnostic: {
        recipientId,
        pageId: pageId || lastWebhookPageId,
        hasToken: !!pageData.pageAccessToken,
        pageName: pageData.pageName
      }
    };

  } catch (error) {
    console.error('❌ [DIAGNOSTIC] Error during diagnosis:', error);
    return { success: false, error: 'DIAGNOSTIC_ERROR', details: error.message };
  }
}

module.exports = { 
  sendFacebookMessage, 
  handleMessageDirectly, 
  handleFacebookMessage, 
  getPageToken,
  updatePageTokenCache, 
  diagnoseFacebookSending,
  fetchFacebookUserProfile,
  handleFacebookComment,  // Export the new comment function
  generateAICommentResponse,  // Export the AI function
  sendFacebookCommentReply,   // Export the reply function
  deleteFacebookComment      // Export the new delete function
};
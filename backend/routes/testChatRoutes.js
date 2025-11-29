const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSharedPrismaClient } = require('../services/sharedDatabase');
const aiAgentService = require('../services/aiAgentService');
const testQuestionGenerator = require('../services/testQuestionGenerator');
const testMessageSender = require('../services/testMessageSender');
const testReportGenerator = require('../services/testReportGenerator');

// ✅ Don't cache prisma at module load - get fresh instance in each route
function getPrisma() {
  return getSharedPrismaClient();
}

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/v1/test-chat/conversations
 * جلب قائمة محادثات الاختبار
 */
router.get('/conversations', async (req, res) => {
  try {
    const prisma = getPrisma();
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // البحث عن customer اختبار للشركة
    let testCustomer = await prisma.customer.findFirst({
      where: {
        companyId: companyId,
        firstName: 'عميل اختبار',
        lastName: 'Test Customer'
      }
    });

    // إذا لم يوجد، إنشاء customer جديد
    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          companyId: companyId,
          firstName: 'عميل اختبار',
          lastName: 'Test Customer',
          phone: '0000000000',
          email: `test-${companyId}@test.com`
        }
      });
    }

    // جلب محادثات الاختبار
    const conversations = await prisma.conversation.findMany({
      where: {
        companyId: companyId,
        channel: 'TEST', // TEST is now in CommunicationChannel enum
        customerId: testCustomer.id
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    // تحويل البيانات للتنسيق المطلوب
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      customerId: conv.customerId,
      customerName: `${conv.customer.firstName} ${conv.customer.lastName}`,
      customerAvatar: null,
      lastMessage: conv.lastMessagePreview || 'لا توجد رسائل',
      lastMessageTime: conv.lastMessageAt,
      unreadCount: 0,
      isOnline: false,
      platform: 'test',
      messages: [],
      aiEnabled: true,
      pageName: 'اختبار',
      pageId: null,
      lastMessageIsFromCustomer: false,
      hasUnreadMessages: false,
      lastCustomerMessageIsUnread: false,
      adSource: null
    }));

    res.json({
      success: true,
      data: formattedConversations,
      pagination: {
        total: formattedConversations.length,
        page: 1,
        limit: 50,
        hasNextPage: false
      }
    });

  } catch (error) {
    console.error('❌ Error fetching test conversations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/test-chat/conversations
 * إنشاء محادثة اختبار جديدة
 */
router.post('/conversations', async (req, res) => {
  try {
    const prisma = getPrisma();
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // البحث عن customer اختبار للشركة
    let testCustomer = await prisma.customer.findFirst({
      where: {
        companyId: companyId,
        firstName: 'عميل اختبار',
        lastName: 'Test Customer'
      }
    });

    // إذا لم يوجد، إنشاء customer جديد
    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          companyId: companyId,
          firstName: 'عميل اختبار',
          lastName: 'Test Customer',
          phone: '0000000000',
          email: `test-${companyId}@test.com`
        }
      });
    }

    // التحقق من صحة البيانات قبل الإنشاء
    if (!companyId || !testCustomer?.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid company ID or customer ID'
      });
    }

    // ✅ CRITICAL: Ensure channel is always set and not empty
    // Use enum value directly to avoid any serialization issues
    const channelValue = 'TEST'; // This is a valid CommunicationChannel enum value
    
    // Validate channel value
    const validChannels = ['FACEBOOK', 'WHATSAPP', 'TELEGRAM', 'EMAIL', 'SMS', 'PHONE', 'WEBSITE', 'TEST'];
    if (!validChannels.includes(channelValue)) {
      console.error('❌ [TEST-CHAT] Invalid channel value:', channelValue);
      return res.status(400).json({
        success: false,
        error: `Invalid channel value. Valid values: ${validChannels.join(', ')}`
      });
    }

    // إنشاء محادثة جديدة
    // ✅ CRITICAL: Create data object with explicit channel value
    const conversationData = {
      companyId: companyId,
      customerId: testCustomer.id,
      channel: channelValue, // ✅ Explicitly set to 'TEST' enum value
      status: 'ACTIVE',
      lastMessageAt: new Date(),
      lastMessagePreview: 'محادثة اختبار جديدة'
    };
    
    // ✅ Final validation: Ensure channel is not empty or undefined
    if (!conversationData.channel || conversationData.channel === '' || conversationData.channel === null || conversationData.channel === undefined) {
      console.error('❌ [TEST-CHAT] Channel is empty or invalid before Prisma call!', conversationData.channel);
      conversationData.channel = 'TEST'; // Force to TEST as fallback
      console.warn('⚠️ [TEST-CHAT] Channel was empty, forced to TEST');
    }

    // ✅ Log البيانات قبل الإرسال
    console.log('🔍 [TEST-CHAT] Creating conversation with data:', JSON.stringify(conversationData, null, 2));
    console.log('🔍 [TEST-CHAT] Channel value:', conversationData.channel);
    console.log('🔍 [TEST-CHAT] Channel type:', typeof conversationData.channel);
    console.log('🔍 [TEST-CHAT] Channel length:', conversationData.channel?.length);
    console.log('🔍 [TEST-CHAT] Channel is valid enum:', validChannels.includes(conversationData.channel));

    // ✅ Final validation before Prisma - double check
    if (!conversationData.channel || conversationData.channel === '' || conversationData.channel.trim() === '') {
      console.error('❌ [TEST-CHAT] Channel is empty before Prisma call!');
      return res.status(400).json({
        success: false,
        error: 'Channel cannot be empty'
      });
    }

    // ✅ Create a fresh copy of data to ensure no mutation issues
    const prismaData = {
      companyId: String(conversationData.companyId),
      customerId: String(conversationData.customerId),
      channel: String(conversationData.channel).toUpperCase(), // Ensure uppercase enum value
      status: String(conversationData.status),
      lastMessageAt: conversationData.lastMessageAt,
      lastMessagePreview: String(conversationData.lastMessagePreview || '')
    };
    
    // ✅ Final validation on prismaData
    if (!prismaData.channel || prismaData.channel === '' || !validChannels.includes(prismaData.channel)) {
      console.error('❌ [TEST-CHAT] Invalid channel in prismaData:', prismaData.channel);
      prismaData.channel = 'TEST'; // Force to TEST
      console.warn('⚠️ [TEST-CHAT] Channel was invalid, forced to TEST');
    }
    
    console.log('🔍 [TEST-CHAT] Final prismaData:', JSON.stringify(prismaData, null, 2));
    console.log('🔍 [TEST-CHAT] Final channel value:', prismaData.channel);

    let conversation;
    try {
      conversation = await prisma.conversation.create({
        data: prismaData,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          }
        }
      });
    } catch (prismaError) {
      console.error('❌ [TEST-CHAT] Prisma error details:');
      console.error('❌ [TEST-CHAT] Error message:', prismaError.message);
      console.error('❌ [TEST-CHAT] Error code:', prismaError.code);
      console.error('❌ [TEST-CHAT] Data sent to Prisma:', JSON.stringify(conversationData, null, 2));
      console.error('❌ [TEST-CHAT] Channel in error:', conversationData.channel);
      throw prismaError;
    }

    res.json({
      success: true,
      data: {
        id: conversation.id,
        customerId: conversation.customerId,
        customerName: `${conversation.customer.firstName} ${conversation.customer.lastName}`,
        customerAvatar: null,
        lastMessage: conversation.lastMessagePreview || 'لا توجد رسائل',
        lastMessageTime: conversation.lastMessageAt,
        unreadCount: 0,
        isOnline: false,
        platform: 'test',
        messages: [],
        aiEnabled: true,
        pageName: 'اختبار',
        pageId: null
      }
    });

  } catch (error) {
    console.error('❌ Error creating test conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/test-chat/conversations/:id/messages
 * جلب رسائل محادثة
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const companyId = req.user.companyId;

    // التحقق من أن المحادثة تخص الشركة
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: id,
        companyId: companyId,
        channel: 'TEST'
      },
      include: {
        customer: true
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // جلب الرسائل
    const messages = await prisma.message.findMany({
      where: {
        conversationId: id
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // تحويل البيانات للتنسيق المطلوب
    const formattedMessages = messages.map(msg => {
      // ✅ FIX: استخراج معلومات AI response من metadata
      let aiResponseInfo = null;
      if (msg.metadata && !msg.isFromCustomer) {
        try {
          const metadata = JSON.parse(msg.metadata);
          console.log(`🔍 [TEST-CHAT] Parsed metadata for message ${msg.id}:`, metadata);
          if (metadata.model || metadata.processingTime || metadata.intent) {
            aiResponseInfo = {
              model: metadata.model,
              processingTime: metadata.processingTime,
              intent: metadata.intent,
              sentiment: metadata.sentiment,
              confidence: metadata.confidence,
              keyId: metadata.keyId,
              silent: metadata.silent,
              error: metadata.error
            };
            console.log(`✅ [TEST-CHAT] Created aiResponseInfo for message ${msg.id}:`, aiResponseInfo);
          }
        } catch (e) {
          // إذا فشل parsing، تجاهل
          console.warn('⚠️ [TEST-CHAT] Failed to parse message metadata:', e);
          console.warn('⚠️ [TEST-CHAT] Raw metadata:', msg.metadata);
        }
      } else if (!msg.isFromCustomer) {
        console.log(`⚠️ [TEST-CHAT] Message ${msg.id} is from AI but has no metadata`);
      }

      return {
        id: msg.id,
        content: msg.content || '',
        senderId: msg.isFromCustomer ? conversation.customerId : 'ai-agent',
        senderName: msg.isFromCustomer ? 'عميل اختبار' : 'الذكاء الاصطناعي',
        timestamp: msg.createdAt,
        type: msg.type?.toLowerCase() || 'text',
        isFromCustomer: msg.isFromCustomer,
        status: 'sent',
        conversationId: msg.conversationId,
        isAiGenerated: !msg.isFromCustomer,
        aiResponseInfo: aiResponseInfo
      };
    });

    res.json({
      success: true,
      data: formattedMessages
    });

  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/test-chat/conversations/:id/messages
 * إرسال رسالة وحفظها مع استدعاء AI
 */
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const { message } = req.body;
    const companyId = req.user.companyId;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // التحقق من أن المحادثة تخص الشركة
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: id,
        companyId: companyId,
        channel: 'TEST'
      },
      include: {
        customer: true
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // حفظ رسالة المستخدم
    const userMessage = await prisma.message.create({
      data: {
        conversationId: id,
        content: message.trim(),
        type: 'TEXT',
        isFromCustomer: true,
        createdAt: new Date()
      }
    });

    // تحديث المحادثة
    await prisma.conversation.update({
      where: { id: id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: message.trim().length > 100 
          ? message.trim().substring(0, 100) + '...' 
          : message.trim()
      }
    });

    // استدعاء AI Agent
    const messageData = {
      conversationId: id,
      senderId: conversation.customerId,
      content: message.trim(),
      attachments: [],
      companyId: companyId,
      customerData: {
        id: conversation.customerId,
        name: `${conversation.customer.firstName} ${conversation.customer.lastName}`,
        phone: conversation.customer.phone || '0000000000',
        email: conversation.customer.email || `test-${companyId}@test.com`,
        orderCount: 0,
        companyId: companyId
      }
    };

    let aiResponse = null;
    let aiMessage = null;

    try {
      aiResponse = await aiAgentService.processCustomerMessage(messageData);

      // حفظ رد AI إذا كان موجوداً
      if (aiResponse && aiResponse.content) {
        // ✅ FIX: حفظ معلومات AI response في metadata
        const aiMetadata = {
          model: aiResponse.model,
          processingTime: aiResponse.processingTime,
          intent: aiResponse.intent,
          sentiment: aiResponse.sentiment,
          confidence: aiResponse.confidence,
          keyId: aiResponse.keyId,
          silent: aiResponse.silent,
          error: aiResponse.error
        };

        console.log('💾 [TEST-CHAT] Saving AI message with metadata:', aiMetadata);

        aiMessage = await prisma.message.create({
          data: {
            conversationId: id,
            content: aiResponse.content,
            type: 'TEXT',
            isFromCustomer: false,
            metadata: JSON.stringify(aiMetadata),
            createdAt: new Date()
          }
        });

        console.log('✅ [TEST-CHAT] AI message saved with ID:', aiMessage.id, 'Metadata:', aiMessage.metadata);

        // تحديث المحادثة برد AI
        await prisma.conversation.update({
          where: { id: id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: aiResponse.content.length > 100 
              ? aiResponse.content.substring(0, 100) + '...' 
              : aiResponse.content
          }
        });
      } else if (aiResponse && aiResponse.silent) {
        // النظام صامت - لا نرسل رد
        console.log('🤐 [TEST-CHAT] AI is silent - no response sent');
      }
    } catch (aiError) {
      console.error('❌ Error processing AI response:', aiError);
      // لا نرمي الخطأ، فقط نسجله
    }

    // إرجاع النتيجة
    res.json({
      success: true,
      data: {
        userMessage: {
          id: userMessage.id,
          content: userMessage.content,
          senderId: conversation.customerId,
          senderName: 'عميل اختبار',
          timestamp: userMessage.createdAt,
          type: 'text',
          isFromCustomer: true,
          status: 'sent',
          conversationId: id
        },
        aiMessage: aiMessage ? {
          id: aiMessage.id,
          content: aiMessage.content,
          senderId: 'ai-agent',
          senderName: 'الذكاء الاصطناعي',
          timestamp: aiMessage.createdAt,
          type: 'text',
          isFromCustomer: false,
          status: 'sent',
          conversationId: id,
          isAiGenerated: true,
          aiResponseInfo: aiResponse ? {
            model: aiResponse.model,
            processingTime: aiResponse.processingTime,
            intent: aiResponse.intent,
            sentiment: aiResponse.sentiment,
            confidence: aiResponse.confidence,
            keyId: aiResponse.keyId,
            silent: aiResponse.silent,
            error: aiResponse.error
          } : null
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
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/v1/test-chat/conversations/:id
 * حذف محادثة
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const companyId = req.user.companyId;

    // التحقق من أن المحادثة تخص الشركة
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: id,
        companyId: companyId,
        channel: 'TEST'
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // حذف جميع الرسائل أولاً
    await prisma.message.deleteMany({
      where: {
        conversationId: id
      }
    });

    // حذف المحادثة
    await prisma.conversation.delete({
      where: { id: id }
    });

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/test-chat/marketing-company/info
 * جلب معلومات شركة التسويق
 */
router.get('/marketing-company/info', async (req, res) => {
  try {
    const prisma = getPrisma();
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // البحث عن شركة التسويق (يمكن البحث في الشركة الحالية أو البحث عن شركة معينة)
    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        OR: [
          { name: { contains: 'التسويق' } },
          { name: { contains: 'تسويق' } },
          { email: { contains: 'marketing' } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        website: true,
        isActive: true,
        plan: true,
        currency: true,
        createdAt: true,
        _count: {
          select: {
            products: true,
            categories: true,
            customers: true,
            orders: true
          }
        }
      }
    });

    if (!company) {
      // إذا لم يتم العثور على شركة التسويق، إرجاع معلومات الشركة الحالية
      const currentCompany = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          website: true,
          isActive: true,
          plan: true,
          currency: true,
          createdAt: true,
          _count: {
            select: {
              products: true,
              categories: true,
              customers: true,
              orders: true
            }
          }
        }
      });

      if (!currentCompany) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      return res.json({
        success: true,
        data: currentCompany,
        isMarketingCompany: false
      });
    }

    res.json({
      success: true,
      data: company,
      isMarketingCompany: true
    });

  } catch (error) {
    console.error('❌ Error fetching company info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/test-chat/marketing-company/products
 * جلب جميع منتجات شركة التسويق
 */
router.get('/marketing-company/products', async (req, res) => {
  try {
    const prisma = getPrisma();
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    const { page = 1, limit = 100, categoryId, search, isActive } = req.query;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 500); // حد أقصى 500
    const skip = (pageNum - 1) * limitNum;

    // بناء شروط البحث
    const where = {
      companyId: companyId
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // جلب المنتجات
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          variants: {
            where: { isActive: true },
            orderBy: [
              { type: 'asc' },
              { sortOrder: 'asc' }
            ]
          },
          _count: {
            select: {
              orderItems: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.product.count({ where })
    ]);

    // معالجة البيانات للاستجابة
    const formattedProducts = products.map(product => {
      // معالجة الصور
      let images = [];
      if (product.images) {
        try {
          images = JSON.parse(product.images);
        } catch (e) {
          if (typeof product.images === 'string') {
            images = [product.images];
          }
        }
      }

      // معالجة tags
      let tags = [];
      if (product.tags) {
        try {
          tags = JSON.parse(product.tags);
        } catch (e) {
          if (typeof product.tags === 'string') {
            tags = product.tags.split(',').map(t => t.trim());
          }
        }
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        sku: product.sku,
        barcode: product.barcode,
        price: parseFloat(product.price),
        comparePrice: product.comparePrice ? parseFloat(product.comparePrice) : null,
        cost: product.cost ? parseFloat(product.cost) : null,
        stock: product.stock,
        trackInventory: product.trackInventory,
        weight: product.weight ? parseFloat(product.weight) : null,
        dimensions: product.dimensions,
        images: images,
        tags: tags,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        hasPromotedAd: product.hasPromotedAd,
        category: product.category,
        categoryId: product.categoryId,
        variants: product.variants.map(variant => {
          let variantImages = [];
          if (variant.images) {
            try {
              variantImages = JSON.parse(variant.images);
            } catch (e) {
              if (typeof variant.images === 'string') {
                variantImages = [variant.images];
              }
            }
          }

          return {
            id: variant.id,
            name: variant.name,
            type: variant.type,
            sku: variant.sku,
            price: variant.price ? parseFloat(variant.price) : null,
            comparePrice: variant.comparePrice ? parseFloat(variant.comparePrice) : null,
            cost: variant.cost ? parseFloat(variant.cost) : null,
            stock: variant.stock,
            trackInventory: variant.trackInventory,
            images: variantImages,
            isActive: variant.isActive,
            sortOrder: variant.sortOrder
          };
        }),
        orderCount: product._count.orderItems,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });

    // حساب الإحصائيات
    const stats = {
      total: total,
      active: await prisma.product.count({ where: { ...where, isActive: true } }),
      inactive: await prisma.product.count({ where: { ...where, isActive: false } }),
      featured: await prisma.product.count({ where: { ...where, isFeatured: true } }),
      inStock: await prisma.product.count({ where: { ...where, stock: { gt: 0 } } }),
      outOfStock: await prisma.product.count({ where: { ...where, stock: 0 } })
    };

    res.json({
      success: true,
      data: formattedProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1
      },
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/test-chat/test-questions
 * جلب أسئلة الاختبار للذكاء الاصطناعي
 */
router.get('/test-questions', async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // جلب المنتجات إذا كانت مطلوبة
    const prisma = getPrisma();
    let products = null;

    if (req.query.includeProducts === 'true') {
      products = await prisma.product.findMany({
        where: {
          companyId: companyId,
          isActive: true
        },
        include: {
          category: true,
          variants: {
            where: { isActive: true }
          }
        },
        take: 50
      });

      products = products.map(p => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price),
        description: p.description,
        category: p.category?.name,
        hasImages: !!p.images,
        stock: p.stock,
        sku: p.sku
      }));
    }

    // إنشاء أسئلة الاختبار
    const testQuestions = await testQuestionGenerator.generateTestQuestions(companyId, products);

    res.json({
      success: true,
      data: testQuestions
    });

  } catch (error) {
    console.error('❌ Error generating test questions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/test-chat/send-test-messages
 * إرسال رسائل اختبار تلقائياً
 */
router.post('/send-test-messages', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { conversationId, questions, options = {} } = req.body;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID is required'
      });
    }

    // التحقق من أن المحادثة تخص الشركة
    const prisma = getPrisma();
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        companyId: companyId,
        channel: 'TEST'
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // إذا لم يتم توفير الأسئلة، جلبها تلقائياً
    let testQuestions = questions;
    if (!testQuestions || testQuestions.length === 0) {
      const { intent, difficulty } = req.body;
      const testQuestionsData = await testQuestionGenerator.generateTestQuestions(companyId);
      
      if (intent) {
        testQuestions = testQuestionsData.questions[intent] || [];
      } else {
        // جمع جميع الأسئلة
        testQuestions = [];
        Object.values(testQuestionsData.questions).forEach(intentQuestions => {
          testQuestions = testQuestions.concat(intentQuestions);
        });
      }

      // فلترة حسب الصعوبة
      if (difficulty) {
        testQuestions = testQuestions.filter(q => q.difficulty === difficulty);
      }
    }

    if (!testQuestions || testQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No test questions found'
      });
    }

    // إرسال رسائل الاختبار
    const results = await testMessageSender.sendTestMessages(
      conversationId,
      testQuestions,
      options
    );

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('❌ Error sending test messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/test-chat/test-results/:conversationId
 * جلب نتائج الاختبار من المحادثة
 */
router.get('/test-results/:conversationId', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { conversationId } = req.params;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // التحقق من أن المحادثة تخص الشركة
    const prisma = getPrisma();
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        companyId: companyId,
        channel: 'TEST'
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // جلب نتائج الاختبار
    const testResults = await testMessageSender.getTestResults(conversationId);

    if (!testResults) {
      return res.json({
        success: true,
        data: null,
        message: 'No test results found for this conversation'
      });
    }

    res.json({
      success: true,
      data: testResults
    });

  } catch (error) {
    console.error('❌ Error getting test results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/test-chat/run-quick-test
 * تشغيل اختبار سريع للذكاء الاصطناعي
 */
router.post('/run-quick-test', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { intent, difficulty, questionCount = 8 } = req.body;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    const prisma = getPrisma();
    
    // البحث عن أو إنشاء customer اختبار
    let testCustomer = await prisma.customer.findFirst({
      where: {
        companyId: companyId,
        firstName: 'عميل اختبار',
        lastName: 'Test Customer'
      }
    });

    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          companyId: companyId,
          firstName: 'عميل اختبار',
          lastName: 'Test Customer',
          phone: '0000000000',
          email: `test-${companyId}@test.com`
        }
      });
    }

    // إنشاء محادثة
    const conversation = await prisma.conversation.create({
      data: {
        companyId: companyId,
        customerId: testCustomer.id,
        channel: 'TEST',
        status: 'ACTIVE',
        lastMessageAt: new Date(),
        lastMessagePreview: 'اختبار سريع'
      }
    });

    // جلب الأسئلة
    const testQuestionsData = await testQuestionGenerator.generateTestQuestions(companyId);
    
    let questions = [];
    if (intent) {
      questions = (testQuestionsData.questions[intent] || []).slice(0, questionCount);
    } else {
      // جمع أسئلة من أنواع مختلفة
      questions = [
        ...testQuestionsData.questions.greeting.slice(0, 2),
        ...testQuestionsData.questions.product_inquiry.slice(0, 2),
        ...testQuestionsData.questions.price_inquiry.slice(0, 2),
        ...testQuestionsData.questions.shipping_inquiry.slice(0, 1),
        ...testQuestionsData.questions.order_inquiry.slice(0, 1)
      ].slice(0, questionCount);
    }

    if (difficulty) {
      questions = questions.filter(q => q.difficulty === difficulty);
    }

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No test questions found'
      });
    }

    // إرسال الرسائل
    const results = await testMessageSender.sendTestMessages(
      conversation.id,
      questions,
      {
        delayBetweenMessages: 1000,
        stopOnError: false
      }
    );

    // فحص جودة الردود
    const qualityCheck = {
      total: results.messages.length,
      withResponse: 0,
      appropriate: 0,
      inappropriate: 0,
      hasIntent: 0,
      hasSentiment: 0,
      averageProcessingTime: 0
    };

    let totalProcessingTime = 0;
    results.messages.forEach(msg => {
      if (msg.success && msg.aiResponse && msg.aiResponse.content) {
        qualityCheck.withResponse++;
        if (msg.aiResponse.intent) qualityCheck.hasIntent++;
        if (msg.aiResponse.sentiment) qualityCheck.hasSentiment++;
        if (msg.processingTime) {
          totalProcessingTime += msg.processingTime;
        }
        
        // فحص بسيط للجودة
        const isAppropriate = msg.aiResponse.content.length > 10 && 
                             !msg.aiResponse.content.toLowerCase().includes('error');
        if (isAppropriate) {
          qualityCheck.appropriate++;
        } else {
          qualityCheck.inappropriate++;
        }
      }
    });

    qualityCheck.averageProcessingTime = qualityCheck.withResponse > 0 
      ? Math.round(totalProcessingTime / qualityCheck.withResponse)
      : 0;

    res.json({
      success: true,
      data: {
        conversationId: conversation.id,
        results: results,
        qualityCheck: qualityCheck,
        message: 'تم إكمال الاختبار بنجاح'
      }
    });

  } catch (error) {
    console.error('❌ Error running quick test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/test-chat/analyze-and-fix
 * تشغيل تحليل شامل مع إرسال سؤال بسؤال وتحليل كل رد
 */
router.post('/analyze-and-fix', async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // استخدام السكريبت المباشر
    const { AIAnalyzerAndFixer } = require('../scripts/analyzeAndFixAITest');
    const analyzer = new AIAnalyzerAndFixer();
    analyzer.companyId = companyId;

    // تهيئة النظام
    await analyzer.initialize();

    // جلب الأسئلة
    const testQuestionsData = await testQuestionGenerator.generateTestQuestions(companyId);
    const questions = [
      ...testQuestionsData.questions.greeting.slice(0, 3),
      ...testQuestionsData.questions.product_inquiry.slice(0, 5),
      ...testQuestionsData.questions.price_inquiry.slice(0, 4),
      ...testQuestionsData.questions.shipping_inquiry.slice(0, 2),
      ...testQuestionsData.questions.order_inquiry.slice(0, 3),
      ...testQuestionsData.questions.general_inquiry.slice(0, 2)
    ];

    analyzer.analysisResults.totalQuestions = questions.length;

    // إرسال وتحليل كل سؤال
    const results = [];
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const result = await analyzer.sendAndAnalyzeQuestion(
        question.question,
        question,
        i + 1
      );
      results.push(result);

      // تأخير بين الأسئلة
      if (i < questions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // إنشاء التقرير
    const report = {
      conversationId: analyzer.conversationId,
      totalQuestions: analyzer.analysisResults.totalQuestions,
      analyzed: analyzer.analysisResults.analyzed,
      problems: analyzer.analysisResults.problems,
      fixes: analyzer.analysisResults.fixes,
      improvements: [...new Set(analyzer.analysisResults.improvements)],
      results: results,
      summary: {
        successRate: analyzer.analysisResults.totalQuestions > 0
          ? ((analyzer.analysisResults.analyzed / analyzer.analysisResults.totalQuestions) * 100).toFixed(2)
          : '0',
        problemRate: analyzer.analysisResults.analyzed > 0
          ? ((analyzer.analysisResults.problems.length / analyzer.analysisResults.analyzed) * 100).toFixed(2)
          : '0'
      }
    };

    res.json({
      success: true,
      data: report,
      message: 'تم إكمال التحليل بنجاح'
    });

  } catch (error) {
    console.error('❌ Error in analyze-and-fix:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/test-chat/run-test-and-analyze
 * تشغيل الاختبار وتحليل النتائج مباشرة
 */
router.post('/run-test-and-analyze', async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    console.log('🚀 بدء تشغيل الاختبار وتحليل النتائج...');

    // الخطوة 1: تشغيل الاختبار
    const { AIAnalyzerAndFixer } = require('../scripts/analyzeAndFixAITest');
    const analyzer = new AIAnalyzerAndFixer();
    analyzer.companyId = companyId;

    await analyzer.initialize();
    const testQuestionsData = await testQuestionGenerator.generateTestQuestions(companyId);
    const questions = [
      ...testQuestionsData.questions.greeting.slice(0, 3),
      ...testQuestionsData.questions.product_inquiry.slice(0, 5),
      ...testQuestionsData.questions.price_inquiry.slice(0, 4),
      ...testQuestionsData.questions.shipping_inquiry.slice(0, 2),
      ...testQuestionsData.questions.order_inquiry.slice(0, 3),
      ...testQuestionsData.questions.general_inquiry.slice(0, 2)
    ];

    analyzer.analysisResults.totalQuestions = questions.length;

    const results = [];
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const result = await analyzer.sendAndAnalyzeQuestion(
        question.question,
        question,
        i + 1
      );
      results.push(result);

      if (i < questions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // انتظار قصير لحفظ البيانات
    await new Promise(resolve => setTimeout(resolve, 3000));

    // الخطوة 2: تحليل المشاكل
    const { ProblemsAnalyzer } = require('../scripts/getAndAnalyzeProblems');
    const problemsAnalyzer = new ProblemsAnalyzer();
    const prisma = getPrisma();
    
    const testConversations = await prisma.conversation.findMany({
      where: {
        companyId: companyId,
        channel: 'TEST',
        id: analyzer.conversationId
      },
      include: {
        customer: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        company: true
      },
      take: 1
    });

    if (testConversations.length > 0) {
      for (const conversation of testConversations) {
        await problemsAnalyzer.analyzeConversation(conversation);
      }
    }

    const problemsReport = problemsAnalyzer.generateReport();

    // إنشاء التقرير النهائي
    const finalReport = {
      testResults: {
        conversationId: analyzer.conversationId,
        totalQuestions: analyzer.analysisResults.totalQuestions,
        analyzed: analyzer.analysisResults.analyzed,
        problems: analyzer.analysisResults.problems,
        fixes: analyzer.analysisResults.fixes,
        improvements: [...new Set(analyzer.analysisResults.improvements)],
        results: results,
        summary: {
          successRate: analyzer.analysisResults.totalQuestions > 0
            ? ((analyzer.analysisResults.analyzed / analyzer.analysisResults.totalQuestions) * 100).toFixed(2)
            : '0',
          problemRate: analyzer.analysisResults.analyzed > 0
            ? ((analyzer.analysisResults.problems.length / analyzer.analysisResults.analyzed) * 100).toFixed(2)
            : '0'
        }
      },
      problemsAnalysis: problemsReport || {
        totalProblems: 0,
        problemsByType: {},
        problemsBySeverity: {
          critical: [],
          high: [],
          medium: [],
          low: []
        },
        solutions: []
      }
    };

    res.json({
      success: true,
      data: finalReport,
      message: 'تم إكمال الاختبار والتحليل بنجاح'
    });

  } catch (error) {
    console.error('❌ Error in run-test-and-analyze:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/test-chat/get-problems
 * جلب المشاكل والحلول من قاعدة البيانات
 */
router.get('/get-problems', async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // استخدام سكريبت التحليل
    const { ProblemsAnalyzer } = require('../scripts/getAndAnalyzeProblems');
    const analyzer = new ProblemsAnalyzer();

    // جلب المحادثات الاختبارية للشركة
    const prisma = getPrisma();
    const testConversations = await prisma.conversation.findMany({
      where: {
        companyId: companyId,
        channel: 'TEST'
      },
      include: {
        customer: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        company: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    if (testConversations.length === 0) {
      return res.json({
        success: true,
        data: {
          message: 'لا توجد محادثات اختبارية للتحليل',
          problems: [],
          solutions: []
        }
      });
    }

    // تحليل كل محادثة
    for (const conversation of testConversations) {
      await analyzer.analyzeConversation(conversation);
    }

    // إنشاء التقرير
    const report = analyzer.generateReport();

    res.json({
      success: true,
      data: {
        totalProblems: analyzer.problems.length,
        problems: analyzer.problems,
        solutions: analyzer.solutions,
        report: report
      }
    });

  } catch (error) {
    console.error('❌ Error getting problems:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/test-chat/analyze-results
 * تحليل نتائج الاختبارات السابقة
 */
router.get('/analyze-results', async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // استخدام سكريبت التحليل
    const { TestResultsAnalyzer } = require('../scripts/analyzeTestResults');
    const analyzer = new TestResultsAnalyzer();

    // تحليل جميع المحادثات الاختبارية للشركة
    const prisma = getPrisma();
    
    // جلب المحادثات الاختبارية
    const testConversations = await prisma.conversation.findMany({
      where: {
        companyId: companyId,
        channel: 'TEST'
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyId: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'asc'
          },
          select: {
            id: true,
            content: true,
            isFromCustomer: true,
            createdAt: true,
            type: true
          }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    if (testConversations.length === 0) {
      return res.json({
        success: true,
        data: {
          message: 'لا توجد محادثات اختبارية للتحليل',
          conversations: 0,
          problems: []
        }
      });
    }

    // تحليل كل محادثة
    const analysisResults = [];
    for (const conversation of testConversations) {
      const analysis = analyzer.analyzeConversation(conversation);
      analysisResults.push({
        conversationId: conversation.id,
        companyId: conversation.companyId,
        companyName: conversation.company?.name,
        createdAt: conversation.createdAt,
        analysis: analysis
      });
    }

    // إنشاء تقرير شامل
    const summary = analyzer.generateSummaryReportData(analysisResults);

    res.json({
      success: true,
      data: {
        totalConversations: testConversations.length,
        analysisResults: analysisResults,
        summary: summary
      }
    });

  } catch (error) {
    console.error('❌ Error analyzing results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/test-chat/send-message
 * إرسال رسالة مباشرة للذكاء الاصطناعي (للاختبار المتوازي)
 */
router.post('/send-message', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { message, conversationId, senderId } = req.body;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    const prisma = getPrisma();

    // البحث عن أو إنشاء customer اختبار
    let testCustomer = await prisma.customer.findFirst({
      where: {
        companyId: companyId,
        firstName: 'عميل اختبار',
        lastName: 'Test Customer'
      }
    });

    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          companyId: companyId,
          firstName: 'عميل اختبار',
          lastName: 'Test Customer',
          phone: '0000000000',
          email: `test-${companyId}@test.com`
        }
      });
    }

    // البحث عن أو إنشاء محادثة اختبار
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          companyId: companyId,
          channel: 'TEST'
        }
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          companyId: companyId,
          customerId: testCustomer.id,
          channel: 'TEST',
          status: 'ACTIVE',
          lastMessageAt: new Date(),
          lastMessagePreview: message.trim().length > 100 
            ? message.trim().substring(0, 100) + '...' 
            : message.trim()
        }
      });
    }

    // حفظ رسالة المستخدم
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: message.trim(),
        type: 'TEXT',
        isFromCustomer: true,
        createdAt: new Date()
      }
    });

    // إعداد بيانات الرسالة للذكاء الاصطناعي
    const messageData = {
      conversationId: conversation.id,
      senderId: senderId || testCustomer.id,
      content: message.trim(),
      attachments: [],
      companyId: companyId,
      customerData: {
        id: testCustomer.id,
        name: `${testCustomer.firstName} ${testCustomer.lastName}`,
        phone: testCustomer.phone || '0000000000',
        email: testCustomer.email || `test-${companyId}@test.com`,
        orderCount: 0,
        companyId: companyId
      }
    };

    const startTime = Date.now();
    let aiResponse = null;
    let aiMessage = null;
    let error = null;

    try {
      // استدعاء الذكاء الاصطناعي
      aiResponse = await aiAgentService.processCustomerMessage(messageData);

      // حفظ رد AI إذا كان موجوداً
      if (aiResponse && aiResponse.content) {
        // ✅ FIX: حفظ معلومات AI response في metadata
        const aiMetadata = {
          model: aiResponse.model,
          processingTime: aiResponse.processingTime || processingTime,
          intent: aiResponse.intent,
          sentiment: aiResponse.sentiment,
          confidence: aiResponse.confidence,
          keyId: aiResponse.keyId,
          silent: aiResponse.silent,
          error: aiResponse.error
        };

        aiMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            content: aiResponse.content,
            type: 'TEXT',
            isFromCustomer: false,
            metadata: JSON.stringify(aiMetadata),
            createdAt: new Date()
          }
        });

        // تحديث المحادثة برد AI
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: aiResponse.content.length > 100 
              ? aiResponse.content.substring(0, 100) + '...' 
              : aiResponse.content
          }
        });
      }
    } catch (aiError) {
      console.error('❌ Error processing AI response:', aiError);
      error = aiError.message;
    }

    const processingTime = Date.now() - startTime;

    // إرجاع النتيجة
    res.json({
      success: true,
      data: {
        conversationId: conversation.id,
        userMessage: {
          id: userMessage.id,
          content: userMessage.content,
          timestamp: userMessage.createdAt,
          isFromCustomer: true
        },
        aiResponse: aiResponse ? {
          content: aiResponse.content,
          intent: aiResponse.intent,
          sentiment: aiResponse.sentiment,
          confidence: aiResponse.confidence,
          processingTime: aiResponse.processingTime || processingTime,
          model: aiResponse.model,
          keyId: aiResponse.keyId,
          silent: aiResponse.silent,
          error: aiResponse.error
        } : null,
        aiMessage: aiMessage ? {
          id: aiMessage.id,
          content: aiMessage.content,
          timestamp: aiMessage.createdAt,
          isFromCustomer: false
        } : null,
        processingTime: processingTime,
        error: error
      }
    });

  } catch (error) {
    console.error('❌ Error in send-message endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      processingTime: 0
    });
  }
});

/**
 * POST /api/v1/test-chat/generate-report/:conversationId
 * إنشاء تقرير شامل عن نتائج الاختبار
 */
router.post('/generate-report/:conversationId', async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { conversationId } = req.params;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // التحقق من أن المحادثة تخص الشركة
    const prisma = getPrisma();
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        companyId: companyId,
        channel: 'TEST'
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // جلب نتائج الاختبار
    const testResults = await testMessageSender.getTestResults(conversationId);

    if (!testResults) {
      return res.status(404).json({
        success: false,
        error: 'No test results found for this conversation'
      });
    }

    // إنشاء التقرير
    const reportPath = await testReportGenerator.generateReport(testResults, req.body);

    res.json({
      success: true,
      data: {
        reportPath: reportPath,
        message: 'Report generated successfully'
      }
    });

  } catch (error) {
    console.error('❌ Error generating report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;


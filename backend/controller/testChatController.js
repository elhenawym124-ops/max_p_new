const { getSharedPrismaClient } = require('../services/sharedDatabase');

/**
 * Test Chat Controller
 * Handles test conversations for AI testing
 */

/**
 * Get all test conversations for the company
 */
exports.getConversations = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const prisma = getSharedPrismaClient();
    
    // Get test conversations (channel = 'TEST')
    const conversations = await prisma.conversation.findMany({
      where: {
        companyId,
        channel: 'TEST'
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: conversations.map(conv => ({
        id: conv.id,
        customerId: conv.customerId,
        customerName: conv.customer ? `${conv.customer.firstName} ${conv.customer.lastName}`.trim() : 'Test User',
        customerAvatar: conv.customer?.avatar || null,
        lastMessage: conv.lastMessagePreview || 'No messages',
        lastMessageTime: conv.lastMessageAt || conv.createdAt,
        unreadCount: conv.unreadCount || 0,
        createdAt: conv.createdAt
      })),
      pagination: {
        total: conversations.length,
        page: 1,
        limit: 100
      }
    });

  } catch (error) {
    console.error('❌ [TEST-CHAT] Error getting conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get test conversations',
      error: error.message
    });
  }
};

/**
 * Create new test conversation
 */
exports.createConversation = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const prisma = getSharedPrismaClient();
    
    // Create or get test customer
    let customer = await prisma.customer.findFirst({
      where: {
        companyId,
        firstName: 'Test',
        lastName: 'User'
      }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId,
          firstName: 'Test',
          lastName: 'User',
          email: `test-${Date.now()}@test.com`,
          phone: '0000000000'
        }
      });
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        companyId,
        customerId: customer.id,
        channel: 'TEST',
        status: 'ACTIVE',
        lastMessagePreview: 'New test conversation',
        lastMessageAt: new Date()
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        id: conversation.id,
        customerId: conversation.customerId,
        customerName: `${conversation.customer.firstName} ${conversation.customer.lastName}`,
        customerAvatar: conversation.customer.avatar,
        lastMessage: conversation.lastMessagePreview,
        lastMessageTime: conversation.lastMessageAt,
        unreadCount: 0,
        createdAt: conversation.createdAt
      }
    });

  } catch (error) {
    console.error('❌ [TEST-CHAT] Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test conversation',
      error: error.message
    });
  }
};

/**
 * Get messages for a conversation
 */
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const prisma = getSharedPrismaClient();
    
    // Verify conversation belongs to company
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        companyId
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: {
        conversationId
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    res.json({
      success: true,
      data: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        timestamp: msg.timestamp,
        metadata: msg.metadata
      }))
    });

  } catch (error) {
    console.error('❌ [TEST-CHAT] Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages',
      error: error.message
    });
  }
};

/**
 * Send message in a conversation
 */
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const prisma = getSharedPrismaClient();
    
    // Verify conversation belongs to company
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        companyId
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Create user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        content: message,
        sender: 'USER',
        timestamp: new Date(),
        metadata: {}
      }
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessagePreview: message.substring(0, 100),
        lastMessageAt: new Date()
      }
    });

    // TODO: Generate AI response here
    // For now, just return the user message
    
    res.json({
      success: true,
      data: {
        userMessage: {
          id: userMessage.id,
          content: userMessage.content,
          sender: userMessage.sender,
          timestamp: userMessage.timestamp
        },
        aiResponse: null // Will be implemented later
      }
    });

  } catch (error) {
    console.error('❌ [TEST-CHAT] Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

/**
 * Delete a test conversation
 */
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const prisma = getSharedPrismaClient();
    
    // Verify conversation belongs to company
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        companyId,
        channel: 'TEST' // Only allow deleting test conversations
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Test conversation not found'
      });
    }

    // Delete messages first
    await prisma.message.deleteMany({
      where: { conversationId }
    });

    // Delete conversation
    await prisma.conversation.delete({
      where: { id: conversationId }
    });

    res.json({
      success: true,
      message: 'Test conversation deleted successfully'
    });

  } catch (error) {
    console.error('❌ [TEST-CHAT] Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: error.message
    });
  }
};

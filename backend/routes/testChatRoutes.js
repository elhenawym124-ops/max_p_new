const express = require('express');
const router = express.Router();
const verifyToken = require('../utils/verifyToken');
const testChatController = require('../controller/testChatController');

/**
 * Test Chat Routes
 * For testing AI conversations in a sandbox environment
 */

// Get all test conversations
router.get('/conversations', verifyToken.authenticateToken, testChatController.getConversations);

// Create new test conversation
router.post('/conversations', verifyToken.authenticateToken, testChatController.createConversation);

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', verifyToken.authenticateToken, testChatController.getMessages);

// Send message in a conversation
router.post('/conversations/:conversationId/messages', verifyToken.authenticateToken, testChatController.sendMessage);

// Delete a test conversation
router.delete('/conversations/:conversationId', verifyToken.authenticateToken, testChatController.deleteConversation);

module.exports = router;

const express = require('express');
const router = express.Router();
const telegramBotService = require('../services/TelegramBotService');
const { globalSecurity } = require('../middleware/globalSecurity');

// Apply security middleware to all routes
router.use(globalSecurity);

// Send reply from Dashboard -> Telegram User
router.post('/bot/send', async (req, res) => {
    try {
        const { conversationId, content, attachment } = req.body;

        if (!conversationId || !content) {
            return res.status(400).json({
                success: false,
                message: 'Missing conversationId or content'
            });
        }

        const result = await telegramBotService.sendReply(conversationId, content, attachment);

        if (result.success) {
            res.json({ success: true, message: 'Message sent via Telegram Bot' });
        } else {
            res.status(500).json({ success: false, message: result.error });
        }

    } catch (error) {
        console.error('❌ Error sending Telegram message:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;

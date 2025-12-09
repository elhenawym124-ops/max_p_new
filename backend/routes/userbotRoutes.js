const express = require('express');
const router = express.Router();
const telegramUserbotService = require('../services/TelegramUserbotService');

// 1. Login (Send Code)
router.post('/login', async (req, res) => {
    try {
        const { companyId, phoneNumber } = req.body;
        if (!companyId || !phoneNumber) {
            return res.status(400).json({ error: 'Missing companyId or phoneNumber' });
        }

        const result = await telegramUserbotService.sendCode(companyId, phoneNumber);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Verify (Sign In)
router.post('/verify', async (req, res) => {
    try {
        const { companyId, code, password } = req.body; // password for 2FA if needed
        if (!companyId || !code) {
            return res.status(400).json({ error: 'Missing companyId or code' });
        }

        const result = await telegramUserbotService.signIn(companyId, code, password);
        if (result.success) {
            res.json(result);
        } else {
            res.status(401).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Get Dialogs (Chats)
router.get('/dialogs', async (req, res) => {
    try {
        const { companyId } = req.query;
        if (!companyId) {
            return res.status(400).json({ error: 'Missing companyId' });
        }

        const result = await telegramUserbotService.getDialogs(companyId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Send Message
router.post('/message', async (req, res) => {
    try {
        const { companyId, chatId, message } = req.body;
        if (!companyId || !chatId || !message) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const result = await telegramUserbotService.sendMessage(companyId, chatId, message);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Get Messages (History)
router.get('/messages', async (req, res) => {
    try {
        const { companyId, chatId, limit } = req.query;
        if (!companyId || !chatId) {
            return res.status(400).json({ error: 'Missing companyId or chatId' });
        }

        const result = await telegramUserbotService.getMessages(companyId, chatId, parseInt(limit) || 50);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

// 6. Logout
router.post('/logout', async (req, res) => {
    try {
        const { companyId } = req.body;
        if (!companyId) return res.status(400).json({ error: 'Missing companyId' });

        const result = await telegramUserbotService.logout(companyId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Send File (Uses multer for file handling)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Store in memory to pass buffer

router.post('/message/file', upload.single('file'), async (req, res) => {
    try {
        // Multer adds req.file
        // Body fields: companyId, chatId, caption
        const { companyId, chatId, caption } = req.body;
        const file = req.file;

        if (!companyId || !chatId || !file) {
            return res.status(400).json({ error: 'Missing file, companyId or chatId' });
        }

        const result = await telegramUserbotService.sendFile(companyId, chatId, file.buffer, file.originalname, caption);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

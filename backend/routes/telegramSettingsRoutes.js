const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const telegramBotService = require('../services/TelegramBotService');
const { globalSecurity } = require('../middleware/globalSecurity');

// Apply security middleware
router.use(globalSecurity);

// Connect/Add Bot
router.post('/connect', async (req, res) => {
    try {
        const { companyId, botToken, label } = req.body;

        if (!companyId || !botToken) {
            return res.status(400).json({ success: false, message: 'Missing companyId or botToken' });
        }

        // Create new config (Multi-Bot)
        const config = await prisma.telegramConfig.create({
            data: {
                companyId,
                botToken,
                label: label || 'Official Bot',
                isActive: true
            }
        });

        // Start Bot
        await telegramBotService.startBot(config.id, companyId, botToken);

        res.json({ success: true, message: 'Telegram Bot connected successfully', config });

    } catch (error) {
        console.error('❌ Error connecting bot:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Disconnect Bot
router.post('/disconnect', async (req, res) => {
    try {
        const { id, companyId } = req.body; // id is configId

        if (!id) {
            return res.status(400).json({ success: false, message: 'Missing config ID' });
        }

        // Find config to verify companyId (security)
        const config = await prisma.telegramConfig.findUnique({ where: { id } });
        if (!config || config.companyId !== companyId) {
            return res.status(404).json({ success: false, message: 'Bot config not found' });
        }

        // Delete config (or set inactive)
        await prisma.telegramConfig.delete({
            where: { id }
        });

        await telegramBotService.stopBot(id);

        res.json({ success: true, message: 'Telegram Bot disconnected' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get Status (List Bots)
router.get('/status/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;

        // Fetch all bots for company
        const configs = await prisma.telegramConfig.findMany({
            where: { companyId }
        });

        const bots = configs.map(config => ({
            id: config.id,
            label: config.label || config.botName || 'Bot',
            botName: config.botName,
            username: config.botUsername,
            connected: !!config.botToken,
            active: !!config.isActive,
            running: telegramBotService.bots.has(config.id)
        }));

        res.json({
            bots: bots
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;

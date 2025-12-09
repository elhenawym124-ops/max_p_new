const { Telegraf } = require('telegraf');
const { getSharedPrismaClient } = require('./sharedDatabase');
const socketService = require('./socketService');

class TelegramBotService {
    constructor() {
        this.bots = new Map();
        this.prisma = getSharedPrismaClient();
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            const configs = await this.prisma.telegramConfig.findMany({
                where: { isActive: true, botToken: { not: null } }
            });
            console.log(`🤖 [Telegram] Found ${configs.length} active bot configs`);
            for (const config of configs) {
                await this.startBot(config.id, config.companyId, config.botToken);
            }
            this.isInitialized = true;
            console.log('✅ [Telegram] Bot Manager initialized');
        } catch (error) {
            console.error('❌ Error initializing Telegram Bot Manager:', error);
        }
    }

    async startBot(configId, companyId, token) {
        if (this.bots.has(configId)) {
            console.log(`⚠️ [Telegram] Bot ${configId} already running. Restarting...`);
            await this.stopBot(configId);
        }
        try {
            const bot = new Telegraf(token);
            bot.use(async (ctx, next) => {
                ctx.companyId = companyId;
                ctx.telegramConfigId = configId;
                await next();
            });
            bot.start((ctx) => this.handleStart(ctx, companyId));
            bot.on('text', (ctx) => this.handleTextMessage(ctx, companyId));
            bot.on('photo', (ctx) => this.handlePhotoMessage(ctx, companyId));
            bot.launch();
            this.bots.set(configId, bot);
            console.log(`✅ [Telegram] Bot ${configId} started`);
        } catch (error) {
            console.error(`❌ [Telegram] Error starting bot ${configId}:`, error);
        }
    }

    async stopBot(configId) {
        const bot = this.bots.get(configId);
        if (bot) {
            try {
                bot.stop();
                this.bots.delete(configId);
                console.log(`✅ [Telegram] Bot ${configId} stopped`);
            } catch (error) {
                console.error(`❌ [Telegram] Error stopping bot ${configId}:`, error);
            }
        }
    }

    async handleStart(ctx, companyId) {
        await ctx.reply('مرحباً بك! 👋\nنحن هنا لمساعدتك.');
    }

    async handleTextMessage(ctx, companyId) {
        try {
            const { id, first_name, last_name, username } = ctx.from;
            const text = ctx.message.text;
            await this.processMessage(companyId, id.toString(), {
                firstName: first_name || 'User',
                lastName: last_name || '',
                username: username
            }, text, 'TEXT', { telegramConfigId: ctx.telegramConfigId });
        } catch (error) {
            console.error(`❌ [Telegram] Error handling message:`, error);
        }
    }

    async handlePhotoMessage(ctx, companyId) {
        try {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const fileLink = await ctx.telegram.getFileLink(photo.file_id);
            const text = ctx.message.caption ? `[Photo] ${ctx.message.caption}` : '[Photo]';
            await this.processMessage(companyId, ctx.from.id.toString(), {
                firstName: ctx.from.first_name || 'User',
                lastName: ctx.from.last_name || '',
                username: ctx.from.username
            }, text, 'IMAGE', { fileUrl: fileLink.href, telegramConfigId: ctx.telegramConfigId });
        } catch (error) {
            console.error(`❌ [Telegram] Error handling photo:`, error);
        }
    }

    async processMessage(companyId, telegramId, userData, content, type = 'TEXT', metadata = {}) {
        let customer = await this.prisma.customer.findFirst({
            where: { telegramId, companyId }
        });
        if (!customer) {
            customer = await this.prisma.customer.create({
                data: {
                    telegramId,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    companyId,
                    metadata: JSON.stringify({ username: userData.username }),
                    status: 'LEAD'
                }
            });
        }
        let conversation = await this.prisma.conversation.findFirst({
            where: {
                customerId: customer.id,
                companyId,
                channel: 'TELEGRAM',
                status: { in: ['ACTIVE', 'PENDING'] }
            }
        });
        if (!conversation) {
            conversation = await this.prisma.conversation.create({
                data: {
                    customerId: customer.id,
                    companyId,
                    channel: 'TELEGRAM',
                    status: 'ACTIVE',
                    subject: 'Telegram Chat',
                    metadata: JSON.stringify({ lastTelegramConfigId: metadata.telegramConfigId })
                }
            });
            socketService.emitNewConversation(companyId, conversation);
        }
        const message = await this.prisma.message.create({
            data: {
                conversationId: conversation.id,
                content: content,
                type: type === 'IMAGE' ? 'IMAGE' : 'TEXT',
                isFromCustomer: true,
                metadata: JSON.stringify(metadata)
            }
        });
        await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                lastMessagePreview: content.substring(0, 50),
                isRead: false
            }
        });
        socketService.sendToConversationSecure(conversation.id, companyId, 'new_message', {
            ...message,
            senderName: `${customer.firstName} ${customer.lastName}`
        });
    }

    async sendReply(conversationId, content, imageUrls = []) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { customer: true }
        });
        if (!conversation || !conversation.customer || !conversation.customer.telegramId) {
            return { success: false, error: 'Customer not found' };
        }
        const meta = conversation.metadata ? JSON.parse(conversation.metadata) : {};
        const configId = meta.lastTelegramConfigId;

        // If no specific config ID, try to find one for the company
        let bot;
        if (configId) {
            bot = this.bots.get(configId);
        }

        if (!bot) {
            // Fallback: try to find any active bot for this company
            const config = await this.prisma.telegramConfig.findFirst({
                where: { companyId: conversation.companyId, isActive: true }
            });
            if (config) {
                if (!this.bots.has(config.id)) {
                    await this.startBot(config.id, config.companyId, config.botToken);
                }
                bot = this.bots.get(config.id);
            }
        }

        if (!bot) {
            return { success: false, error: 'No active bot found' };
        }

        try {
            // Send text message if content exists
            if (content && content.trim()) {
                await bot.telegram.sendMessage(conversation.customer.telegramId, content);
            }

            // Send images if they exist
            if (imageUrls && imageUrls.length > 0) {
                for (const url of imageUrls) {
                    await bot.telegram.sendPhoto(conversation.customer.telegramId, url);
                }
            }

            return { success: true };
        } catch (error) {
            console.error(`❌ [Telegram] Failed to send reply:`, error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new TelegramBotService();
